-- ==============================================================================
-- VERSUSHUB - ATUALIZAÇÃO DE SEGURANÇA (RLS)
-- Cole este script inteiro no SQL Editor do Supabase e execute UMA vez.
-- Pode ser executado de novo sem problemas (é idempotente).
--
-- O que ele faz:
--   1. Cria a tabela de notificações (se ainda não existir).
--   2. Cria o perfil em public.usuarios automaticamente quando alguém se cadastra
--      (assim o cadastro não precisa mais gravar como visitante anônimo).
--   3. Remove a coluna antiga "senha" (o Supabase Auth já guarda a senha com hash).
--   4. Apaga TODAS as políticas antigas e recria regras que exigem login:
--      - visitante (anon) só pode LER dados públicos;
--      - cada usuário só altera o que é dele;
--      - só o organizador mexe nas partidas/chaveamento do próprio torneio;
--      - cada usuário só lê/altera as próprias notificações.
--   5. Cria a função vh_encerrar_torneio, que grava a pontuação final de
--      todos os participantes (o organizador não pode alterar o perfil dos
--      outros diretamente, então o banco faz isso depois de conferir tudo).
--   6. Cria o bucket 'imagens' no Storage, onde ficam avatares, logos e
--      banners (o banco guarda só o endereço da imagem).
--   7. Cria a tabela de comentários dos torneios, com regras e limite anti-spam.
--   8. Avisa o organizador sobre comentários com uma notificação agrupada
--      ("fulano e mais 3 pessoas comentaram no torneio X").
--   9. Liga o tempo real (placar, comentários, notificações) nas tabelas usadas.
--  10. Remove inscrições repetidas e impede que voltem a acontecer.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Colunas usadas pelas políticas (caso ainda não existam)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.equipes ADD COLUMN IF NOT EXISTS "leaderId" UUID;
ALTER TABLE IF EXISTS public.membros_equipe ADD COLUMN IF NOT EXISTS user_id UUID;
-- Colunas de pontuação usadas no encerramento de torneios
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS pontos INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS vitorias INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS derrotas INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS torneios_disputados INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.equipes ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS public.torneios ADD COLUMN IF NOT EXISTS pontos_consolidados BOOLEAN DEFAULT false;

-- ------------------------------------------------------------------------------
-- 1. Tabela de notificações
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    titulo TEXT NOT NULL DEFAULT 'Notificação',
    mensagem TEXT DEFAULT '',
    tipo TEXT DEFAULT 'geral',
    link TEXT DEFAULT '#',
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes(user_email);

-- ------------------------------------------------------------------------------
-- 2. Perfil criado automaticamente no cadastro (Supabase Auth -> public.usuarios)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vh_criar_perfil_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT := lower(trim(NEW.email));
    v_nome  TEXT := coalesce(
        nullif(trim(NEW.raw_user_meta_data ->> 'nome'), ''),
        nullif(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        split_part(v_email, '@', 1)
    );
BEGIN
    IF v_email IS NULL OR v_email = '' THEN
        RETURN NEW;
    END IF;
    BEGIN
        INSERT INTO public.usuarios (id, email, nome)
        VALUES (NEW.id, v_email, v_nome)
        ON CONFLICT (email) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Nunca bloqueia o cadastro: o site recria o perfil no primeiro login.
        RAISE WARNING 'vh_criar_perfil_usuario: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vh_on_auth_user_created ON auth.users;
CREATE TRIGGER vh_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.vh_criar_perfil_usuario();

-- ------------------------------------------------------------------------------
-- 3. Remove a coluna antiga de senha em texto puro
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE public.usuarios DROP COLUMN IF EXISTS senha;
EXCEPTION WHEN OTHERS THEN
    -- Se algum objeto ainda depender da coluna, ao menos garante que ela fique vazia.
    RAISE WARNING 'Não foi possível remover usuarios.senha (%). Limpando os valores.', SQLERRM;
    EXECUTE 'UPDATE public.usuarios SET senha = '''' WHERE senha IS NOT NULL AND senha <> ''''';
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Liga o RLS e apaga todas as políticas antigas destas tabelas
--    (inclusive políticas criadas pelo painel com outros nomes)
-- ------------------------------------------------------------------------------
ALTER TABLE public.usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curtidas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscricoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('usuarios', 'torneios', 'equipes', 'curtidas', 'inscricoes',
                            'membros_equipe', 'partidas', 'notificacoes')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END;
$$;

-- Função auxiliar: e-mail do usuário logado (minúsculo, sem espaços)
CREATE OR REPLACE FUNCTION public.vh_email_logado()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ------------------------------------------------------------------------------
-- 4.1 usuarios: leitura pública; cada um cria/altera/exclui só o próprio perfil
-- ------------------------------------------------------------------------------
CREATE POLICY "usuarios_select_publico" ON public.usuarios
    FOR SELECT USING (true);

CREATE POLICY "usuarios_insert_proprio" ON public.usuarios
    FOR INSERT TO authenticated WITH CHECK (
        id = auth.uid() OR lower(trim(email)) = public.vh_email_logado()
    );

CREATE POLICY "usuarios_update_proprio" ON public.usuarios
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR lower(trim(email)) = public.vh_email_logado())
    WITH CHECK (id = auth.uid() OR lower(trim(email)) = public.vh_email_logado());

CREATE POLICY "usuarios_delete_proprio" ON public.usuarios
    FOR DELETE TO authenticated
    USING (id = auth.uid() OR lower(trim(email)) = public.vh_email_logado());

-- ------------------------------------------------------------------------------
-- 4.2 equipes: leitura pública; só o líder logado cria/altera/exclui
-- ------------------------------------------------------------------------------
CREATE POLICY "equipes_select_publico" ON public.equipes
    FOR SELECT USING (true);

CREATE POLICY "equipes_insert_lider" ON public.equipes
    FOR INSERT TO authenticated WITH CHECK (
        lower(trim("leaderEmail")) = public.vh_email_logado() OR "leaderId" = auth.uid()
    );

CREATE POLICY "equipes_update_lider" ON public.equipes
    FOR UPDATE TO authenticated
    USING (lower(trim("leaderEmail")) = public.vh_email_logado() OR "leaderId" = auth.uid())
    WITH CHECK (lower(trim("leaderEmail")) = public.vh_email_logado() OR "leaderId" = auth.uid());

CREATE POLICY "equipes_delete_lider" ON public.equipes
    FOR DELETE TO authenticated
    USING (lower(trim("leaderEmail")) = public.vh_email_logado() OR "leaderId" = auth.uid());

-- ------------------------------------------------------------------------------
-- 4.3 membros_equipe: leitura pública; o próprio membro ou o líder da equipe
--     (convites, solicitações, aceitar/recusar, sair/remover)
-- ------------------------------------------------------------------------------
CREATE POLICY "membros_select_publico" ON public.membros_equipe
    FOR SELECT USING (true);

CREATE POLICY "membros_insert_membro_ou_lider" ON public.membros_equipe
    FOR INSERT TO authenticated WITH CHECK (
        lower(trim(user_email)) = public.vh_email_logado()
        OR user_id = auth.uid()
        OR equipe_id IN (
            SELECT eq.id FROM public.equipes eq
            WHERE lower(trim(eq."leaderEmail")) = public.vh_email_logado() OR eq."leaderId" = auth.uid()
        )
    );

CREATE POLICY "membros_update_membro_ou_lider" ON public.membros_equipe
    FOR UPDATE TO authenticated
    USING (
        lower(trim(user_email)) = public.vh_email_logado()
        OR user_id = auth.uid()
        OR equipe_id IN (
            SELECT eq.id FROM public.equipes eq
            WHERE lower(trim(eq."leaderEmail")) = public.vh_email_logado() OR eq."leaderId" = auth.uid()
        )
    )
    WITH CHECK (
        lower(trim(user_email)) = public.vh_email_logado()
        OR user_id = auth.uid()
        OR equipe_id IN (
            SELECT eq.id FROM public.equipes eq
            WHERE lower(trim(eq."leaderEmail")) = public.vh_email_logado() OR eq."leaderId" = auth.uid()
        )
    );

CREATE POLICY "membros_delete_membro_ou_lider" ON public.membros_equipe
    FOR DELETE TO authenticated
    USING (
        lower(trim(user_email)) = public.vh_email_logado()
        OR user_id = auth.uid()
        OR equipe_id IN (
            SELECT eq.id FROM public.equipes eq
            WHERE lower(trim(eq."leaderEmail")) = public.vh_email_logado() OR eq."leaderId" = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 4.4 torneios: leitura pública; só o criador logado cria/altera/exclui
-- ------------------------------------------------------------------------------
CREATE POLICY "torneios_select_publico" ON public.torneios
    FOR SELECT USING (true);

CREATE POLICY "torneios_insert_criador" ON public.torneios
    FOR INSERT TO authenticated WITH CHECK (
        lower(trim("criadorEmail")) = public.vh_email_logado()
    );

CREATE POLICY "torneios_update_criador" ON public.torneios
    FOR UPDATE TO authenticated
    USING (lower(trim("criadorEmail")) = public.vh_email_logado())
    WITH CHECK (lower(trim("criadorEmail")) = public.vh_email_logado());

CREATE POLICY "torneios_delete_criador" ON public.torneios
    FOR DELETE TO authenticated
    USING (lower(trim("criadorEmail")) = public.vh_email_logado());

-- ------------------------------------------------------------------------------
-- 4.5 curtidas: leitura pública; cada usuário logado curte/descurte por si
-- ------------------------------------------------------------------------------
CREATE POLICY "curtidas_select_publico" ON public.curtidas
    FOR SELECT USING (true);

CREATE POLICY "curtidas_insert_propria" ON public.curtidas
    FOR INSERT TO authenticated WITH CHECK (
        lower(trim(user_email)) = public.vh_email_logado()
    );

CREATE POLICY "curtidas_delete_propria" ON public.curtidas
    FOR DELETE TO authenticated
    USING (lower(trim(user_email)) = public.vh_email_logado());

-- ------------------------------------------------------------------------------
-- 4.6 inscricoes: leitura pública.
--     Criar: o próprio jogador, o organizador do torneio (convites) ou um
--     membro/líder da equipe que está sendo inscrita.
--     Alterar/excluir: o próprio inscrito ou o organizador do torneio.
-- ------------------------------------------------------------------------------
CREATE POLICY "inscricoes_select_publico" ON public.inscricoes
    FOR SELECT USING (true);

CREATE POLICY "inscricoes_insert_permitido" ON public.inscricoes
    FOR INSERT TO authenticated WITH CHECK (
        lower(trim(user_email)) = public.vh_email_logado()
        OR torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
        OR id_participante IN (
            SELECT eq.id FROM public.equipes eq
            WHERE lower(trim(eq."leaderEmail")) = public.vh_email_logado() OR eq."leaderId" = auth.uid()
        )
        OR id_participante IN (
            SELECT m.equipe_id FROM public.membros_equipe m
            WHERE lower(trim(m.user_email)) = public.vh_email_logado() AND m.status = 'Aceito'
        )
    );

CREATE POLICY "inscricoes_update_inscrito_ou_organizador" ON public.inscricoes
    FOR UPDATE TO authenticated
    USING (
        lower(trim(user_email)) = public.vh_email_logado()
        OR torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    )
    WITH CHECK (
        lower(trim(user_email)) = public.vh_email_logado()
        OR torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    );

CREATE POLICY "inscricoes_delete_inscrito_ou_organizador" ON public.inscricoes
    FOR DELETE TO authenticated
    USING (
        lower(trim(user_email)) = public.vh_email_logado()
        OR torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    );

-- ------------------------------------------------------------------------------
-- 4.7 partidas (chaveamento): leitura pública; só o organizador do torneio altera
-- ------------------------------------------------------------------------------
CREATE POLICY "partidas_select_publico" ON public.partidas
    FOR SELECT USING (true);

CREATE POLICY "partidas_insert_organizador" ON public.partidas
    FOR INSERT TO authenticated WITH CHECK (
        torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    );

CREATE POLICY "partidas_update_organizador" ON public.partidas
    FOR UPDATE TO authenticated
    USING (
        torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    )
    WITH CHECK (
        torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    );

CREATE POLICY "partidas_delete_organizador" ON public.partidas
    FOR DELETE TO authenticated
    USING (
        torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    );

-- ------------------------------------------------------------------------------
-- 4.8 notificacoes: cada usuário só vê, marca como lida e apaga as próprias.
--     Qualquer usuário logado pode ENVIAR notificação (convites, avisos de torneio).
-- ------------------------------------------------------------------------------
CREATE POLICY "notificacoes_select_proprias" ON public.notificacoes
    FOR SELECT TO authenticated
    USING (lower(trim(user_email)) = public.vh_email_logado());

CREATE POLICY "notificacoes_insert_logado" ON public.notificacoes
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notificacoes_update_proprias" ON public.notificacoes
    FOR UPDATE TO authenticated
    USING (lower(trim(user_email)) = public.vh_email_logado())
    WITH CHECK (lower(trim(user_email)) = public.vh_email_logado());

CREATE POLICY "notificacoes_delete_proprias" ON public.notificacoes
    FOR DELETE TO authenticated
    USING (lower(trim(user_email)) = public.vh_email_logado());

-- ------------------------------------------------------------------------------
-- 5. ENCERRAMENTO DE TORNEIO E PONTUAÇÃO (função chamada pelo site)
--    O site calcula a classificação e envia para cá. O banco confere que:
--      - quem chamou é o organizador do torneio;
--      - a pontuação do torneio ainda não foi computada (evita pontuar duas vezes);
--      - cada participante realmente está no torneio;
--      - vitórias/derrotas não passam do número de partidas;
--      - há no máximo 2 campeões (empate) e 1 vice.
--    Pontuação: campeão +500, vice +250; em empate perfeito, 375 para cada
--    co-campeão (igual ao pódio exibido no site).
-- ------------------------------------------------------------------------------

-- Converte texto em número sem dar erro (valor inválido vira NULL)
CREATE OR REPLACE FUNCTION public.vh_num(p TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN trim(coalesce(p, '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN round(trim(p)::numeric)::int END;
$$;

-- Soma estatísticas no perfil de um usuário (uso interno)
CREATE OR REPLACE FUNCTION public.vh_somar_stats_usuario(
    p_email TEXT, p_pontos INT, p_vitorias INT, p_derrotas INT, p_titulos INT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE public.usuarios u SET
        pontos = c.pts + p_pontos,
        vitorias = c.vit + p_vitorias,
        derrotas = c.der + p_derrotas,
        torneios_disputados = c.disp + 1,
        stats = c.st || jsonb_build_object(
            'points', c.pts + p_pontos,
            'wins', c.vit + p_vitorias,
            'losses', c.der + p_derrotas,
            'disputed', c.disp + 1,
            'won', c.won + p_titulos
        )
    FROM (
        SELECT x.id,
               x.st,
               coalesce(public.vh_num(x.st ->> 'points'), x.pontos, 0) AS pts,
               coalesce(public.vh_num(x.st ->> 'wins'), x.vitorias, 0) AS vit,
               coalesce(public.vh_num(x.st ->> 'losses'), x.derrotas, 0) AS der,
               coalesce(public.vh_num(x.st ->> 'disputed'), x.torneios_disputados, 0) AS disp,
               coalesce(public.vh_num(x.st ->> 'won'), 0) AS won
        FROM (
            SELECT id, pontos, vitorias, derrotas, torneios_disputados,
                   CASE WHEN jsonb_typeof(stats) = 'object' THEN stats ELSE '{}'::jsonb END AS st
            FROM public.usuarios
            WHERE lower(trim(email)) = lower(trim(p_email))
        ) x
    ) c
    WHERE u.id = c.id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.vh_encerrar_torneio(p_torneio_id TEXT, p_resultados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email      TEXT := public.vh_email_logado();
    v_torneio    public.torneios%ROWTYPE;
    v_equipe     public.equipes%ROWTYPE;
    v_partidas   INT;
    r            JSONB;
    v_tipo       TEXT;
    v_alvo       TEXT;
    v_vit        INT;
    v_der        INT;
    v_col        INT;
    v_pts        INT;
    v_campeoes   INT := 0;
    v_vices      INT := 0;
    v_alvos      TEXT[] := ARRAY[]::TEXT[];
    v_membro     TEXT;
    v_eq_st      JSONB;
    v_ganhos     JSONB;
    v_atualizados INT := 0;
BEGIN
    IF v_email = '' THEN
        RAISE EXCEPTION 'É preciso estar logado para encerrar o torneio.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_torneio FROM public.torneios WHERE id = p_torneio_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Torneio não encontrado.';
    END IF;
    IF lower(trim(coalesce(v_torneio."criadorEmail", ''))) <> v_email THEN
        RAISE EXCEPTION 'Apenas o organizador pode encerrar este torneio.' USING ERRCODE = '42501';
    END IF;
    IF coalesce(v_torneio.pontos_consolidados, false) THEN
        RAISE EXCEPTION 'A pontuação deste torneio já foi computada.';
    END IF;
    IF p_resultados IS NULL OR jsonb_typeof(p_resultados) <> 'array' THEN
        RAISE EXCEPTION 'Resultados inválidos.';
    END IF;

    SELECT count(*) INTO v_partidas FROM public.partidas WHERE torneio_id = p_torneio_id;

    -- 1ª passada: só valida (nada é gravado se algo estiver errado)
    FOR r IN SELECT value FROM jsonb_array_elements(p_resultados) LOOP
        v_tipo := coalesce(r ->> 'tipo', '');
        v_vit  := coalesce(public.vh_num(r ->> 'vitorias'), 0);
        v_der  := coalesce(public.vh_num(r ->> 'derrotas'), 0);
        v_col  := coalesce(public.vh_num(r ->> 'colocacao'), 0);

        IF v_vit < 0 OR v_der < 0 OR v_vit > v_partidas OR v_der > v_partidas THEN
            RAISE EXCEPTION 'Número de vitórias/derrotas inválido.';
        END IF;
        IF v_col = 1 THEN v_campeoes := v_campeoes + 1;
        ELSIF v_col = 2 THEN v_vices := v_vices + 1;
        ELSIF v_col <> 0 THEN RAISE EXCEPTION 'Colocação inválida.';
        END IF;

        IF v_tipo = 'equipe' THEN
            v_alvo := trim(coalesce(r ->> 'equipe_id', ''));
            IF NOT EXISTS (SELECT 1 FROM public.equipes WHERE id = v_alvo) THEN
                RAISE EXCEPTION 'Equipe % não encontrada.', v_alvo;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM public.inscricoes i
                           WHERE i.torneio_id = p_torneio_id AND i.id_participante = v_alvo)
               AND NOT EXISTS (SELECT 1 FROM public.partidas pa
                               WHERE pa.torneio_id = p_torneio_id AND v_alvo IN (pa.p1_id, pa.p2_id)) THEN
                RAISE EXCEPTION 'A equipe % não participa deste torneio.', v_alvo;
            END IF;
            v_alvo := 'equipe:' || v_alvo;
        ELSIF v_tipo = 'usuario' THEN
            v_alvo := lower(trim(coalesce(r ->> 'email', '')));
            IF NOT EXISTS (
                SELECT 1 FROM public.usuarios u
                WHERE lower(trim(u.email)) = v_alvo
                  AND (
                    EXISTS (SELECT 1 FROM public.inscricoes i
                            WHERE i.torneio_id = p_torneio_id
                              AND (lower(trim(i.user_email)) = v_alvo
                                   OR lower(trim(i.id_participante)) = v_alvo
                                   OR i.id_participante = u.id::text))
                    OR EXISTS (SELECT 1 FROM public.partidas pa
                               WHERE pa.torneio_id = p_torneio_id
                                 AND (lower(trim(pa.p1_id)) IN (v_alvo, u.id::text)
                                      OR lower(trim(pa.p2_id)) IN (v_alvo, u.id::text)))
                  )
            ) THEN
                RAISE EXCEPTION 'O jogador % não participa deste torneio.', v_alvo;
            END IF;
        ELSE
            RAISE EXCEPTION 'Tipo de participante inválido.';
        END IF;

        IF v_alvo = ANY (v_alvos) THEN
            RAISE EXCEPTION 'Participante repetido na classificação.';
        END IF;
        v_alvos := v_alvos || v_alvo;
    END LOOP;

    IF v_campeoes > 2 OR v_vices > 1 OR (v_campeoes = 2 AND v_vices > 0) THEN
        RAISE EXCEPTION 'Classificação inválida: campeões/vice em excesso.';
    END IF;

    -- 2ª passada: grava a pontuação
    FOR r IN SELECT value FROM jsonb_array_elements(p_resultados) LOOP
        v_tipo := r ->> 'tipo';
        v_vit  := coalesce(public.vh_num(r ->> 'vitorias'), 0);
        v_der  := coalesce(public.vh_num(r ->> 'derrotas'), 0);
        v_col  := coalesce(public.vh_num(r ->> 'colocacao'), 0);
        -- Empate perfeito (2 co-campeões): o bônus de 1º + 2º é dividido (375 cada),
        -- como mostra o pódio do site.
        v_pts  := CASE
                    WHEN v_col = 1 AND v_campeoes = 2 THEN 375
                    WHEN v_col = 1 THEN 500
                    WHEN v_col = 2 THEN 250
                    ELSE 0
                  END;

        IF v_tipo = 'usuario' THEN
            v_atualizados := v_atualizados + public.vh_somar_stats_usuario(
                r ->> 'email', v_pts, v_vit, v_der, CASE WHEN v_col = 1 THEN 1 ELSE 0 END);
        ELSE
            SELECT * INTO v_equipe FROM public.equipes WHERE id = trim(r ->> 'equipe_id') FOR UPDATE;

            v_eq_st := CASE WHEN jsonb_typeof(v_equipe.stats) = 'object' THEN v_equipe.stats ELSE '{}'::jsonb END;
            v_ganhos := CASE WHEN jsonb_typeof(v_equipe."torneiosGanhos") = 'array'
                             THEN v_equipe."torneiosGanhos" ELSE '[]'::jsonb END;
            IF v_col IN (1, 2) THEN
                v_ganhos := v_ganhos || jsonb_build_array(jsonb_build_object(
                    'id', v_torneio.id,
                    'nome', coalesce(v_torneio.nome, 'Torneio #' || v_torneio.id),
                    'data', coalesce(v_torneio.data, to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
                    'colocacao', CASE v_col WHEN 1 THEN '1º Lugar' ELSE '2º Lugar' END,
                    'banner', coalesce(v_torneio.banner, '')
                ));
            END IF;

            UPDATE public.equipes SET
                "torneiosGanhos" = v_ganhos,
                stats = v_eq_st || jsonb_build_object(
                    'points', coalesce(public.vh_num(v_eq_st ->> 'points'), 0) + v_pts,
                    'wins', coalesce(public.vh_num(v_eq_st ->> 'wins'), 0) + v_vit,
                    'losses', coalesce(public.vh_num(v_eq_st ->> 'losses'), 0) + v_der,
                    'disputed', coalesce(public.vh_num(v_eq_st ->> 'disputed'), 0) + 1,
                    'won', coalesce(public.vh_num(v_eq_st ->> 'won'), 0) + CASE WHEN v_col = 1 THEN 1 ELSE 0 END
                )
            WHERE id = v_equipe.id;
            v_atualizados := v_atualizados + 1;

            -- Integrantes: líder + membros aceitos + line-up inscrita (somam vitórias,
            -- derrotas e torneio disputado; os pontos de pódio ficam com a equipe)
            FOR v_membro IN
                SELECT DISTINCT lower(trim(e)) FROM (
                    SELECT v_equipe."leaderEmail" AS e
                    UNION ALL
                    SELECT m.user_email FROM public.membros_equipe m
                    WHERE m.equipe_id = v_equipe.id AND m.status = 'Aceito'
                    UNION ALL
                    SELECT CASE jsonb_typeof(l.item)
                               WHEN 'string' THEN l.item #>> '{}'
                               WHEN 'object' THEN coalesce(l.item ->> 'email', l.item ->> 'user_email')
                           END
                    FROM public.inscricoes i
                    CROSS JOIN LATERAL jsonb_array_elements(
                        CASE WHEN jsonb_typeof(i.lineup) = 'array' THEN i.lineup ELSE '[]'::jsonb END
                    ) AS l(item)
                    WHERE i.torneio_id = p_torneio_id AND i.id_participante = v_equipe.id
                ) emails
                WHERE e IS NOT NULL AND position('@' IN e) > 0
            LOOP
                v_atualizados := v_atualizados + public.vh_somar_stats_usuario(v_membro, 0, v_vit, v_der, 0);
            END LOOP;
        END IF;
    END LOOP;

    UPDATE public.torneios
    SET status = 'Encerrado', "statusClass" = 'status-encerrado', pontos_consolidados = true
    WHERE id = p_torneio_id;

    RETURN jsonb_build_object('ok', true, 'atualizados', v_atualizados);
END;
$$;

-- Só usuários logados podem chamar o encerramento; as funções internas ficam fechadas.
REVOKE ALL ON FUNCTION public.vh_encerrar_torneio(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vh_encerrar_torneio(TEXT, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.vh_somar_stats_usuario(TEXT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;

-- A marcação pontos_consolidados só pode ser alterada pela função acima.
-- Pelo site (usuários anon/authenticated) ela é sempre mantida como estava.
CREATE OR REPLACE FUNCTION public.vh_proteger_pontos_consolidados()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.pontos_consolidados := false;
        ELSE
            NEW.pontos_consolidados := OLD.pontos_consolidados;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vh_proteger_pontos_consolidados ON public.torneios;
CREATE TRIGGER vh_proteger_pontos_consolidados
    BEFORE INSERT OR UPDATE ON public.torneios
    FOR EACH ROW EXECUTE FUNCTION public.vh_proteger_pontos_consolidados();

-- ------------------------------------------------------------------------------
-- 6. ARMAZENAMENTO DE IMAGENS (Supabase Storage)
--    Bucket público 'imagens': qualquer pessoa vê as imagens pelo link, mas só
--    usuários logados enviam, e cada um só mexe nos próprios arquivos.
--    Caminho dos arquivos: <pasta>/<id do usuário>/<arquivo>
--    (pastas: avatares, banners-perfil, logos, banners-torneio)
--    Limite: 2 MB por arquivo, apenas JPEG, PNG, WebP e GIF.
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('imagens', 'imagens', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "imagens_insert_propria_pasta" ON storage.objects;
CREATE POLICY "imagens_insert_propria_pasta" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'imagens'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

DROP POLICY IF EXISTS "imagens_update_proprias" ON storage.objects;
CREATE POLICY "imagens_update_proprias" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'imagens' AND (storage.foldername(name))[2] = auth.uid()::text)
    WITH CHECK (bucket_id = 'imagens' AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS "imagens_delete_proprias" ON storage.objects;
CREATE POLICY "imagens_delete_proprias" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'imagens' AND (storage.foldername(name))[2] = auth.uid()::text);

-- ------------------------------------------------------------------------------
-- 7. COMENTÁRIOS NOS TORNEIOS
--    Qualquer pessoa lê; só usuários logados comentam, sempre em nome próprio.
--    Apagar: o autor do comentário ou o organizador do torneio.
--    Limites: 1 a 500 caracteres e no máximo 5 comentários por minuto por pessoa.
--    Ao apagar um torneio, os comentários dele são apagados junto.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneio_id TEXT NOT NULL REFERENCES public.torneios(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    texto TEXT NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comentarios_torneio ON public.comentarios(torneio_id, created_at DESC);
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

-- Normaliza os dados e bloqueia excesso de comentários em pouco tempo
CREATE OR REPLACE FUNCTION public.vh_validar_comentario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.user_email := lower(btrim(NEW.user_email));
    NEW.texto := btrim(NEW.texto);
    NEW.created_at := timezone('utc'::text, now());
    IF (SELECT count(*) FROM public.comentarios c
        WHERE c.user_email = NEW.user_email
          AND c.created_at > timezone('utc'::text, now()) - interval '1 minute') >= 5 THEN
        RAISE EXCEPTION 'Muitos comentários em pouco tempo. Aguarde um instante e tente de novo.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vh_validar_comentario ON public.comentarios;
CREATE TRIGGER vh_validar_comentario
    BEFORE INSERT ON public.comentarios
    FOR EACH ROW EXECUTE FUNCTION public.vh_validar_comentario();

DROP POLICY IF EXISTS "comentarios_select_publico" ON public.comentarios;
CREATE POLICY "comentarios_select_publico" ON public.comentarios
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "comentarios_insert_proprio" ON public.comentarios;
CREATE POLICY "comentarios_insert_proprio" ON public.comentarios
    FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(user_email)) = public.vh_email_logado());

DROP POLICY IF EXISTS "comentarios_delete_autor_ou_organizador" ON public.comentarios;
CREATE POLICY "comentarios_delete_autor_ou_organizador" ON public.comentarios
    FOR DELETE TO authenticated
    USING (
        lower(btrim(user_email)) = public.vh_email_logado()
        OR torneio_id IN (
            SELECT t.id FROM public.torneios t
            WHERE lower(trim(t."criadorEmail")) = public.vh_email_logado()
        )
    );

-- ------------------------------------------------------------------------------
-- 8. NOTIFICAÇÃO AGRUPADA DE COMENTÁRIOS PARA O ORGANIZADOR
--    Estilo Instagram: enquanto a notificação não for lida, novos comentários
--    atualizam a MESMA notificação em vez de criar outra:
--      "fered comentou no torneio "Copa X"."
--      "fered e gabriel comentaram no torneio "Copa X"."
--      "fered e mais 3 pessoas comentaram no torneio "Copa X"."
--    Depois que o organizador lê (ou apaga), o próximo comentário abre um novo
--    grupo. Comentários do próprio organizador não geram notificação.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.notificacoes ADD COLUMN IF NOT EXISTS chave_grupo TEXT;
ALTER TABLE IF EXISTS public.notificacoes ADD COLUMN IF NOT EXISTS agrupado_desde TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_notificacoes_grupo ON public.notificacoes(user_email, chave_grupo) WHERE lida = false;

CREATE OR REPLACE FUNCTION public.vh_notificar_comentario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org      TEXT;
    v_nome_t   TEXT;
    v_chave    TEXT := 'comentarios:' || NEW.torneio_id;
    v_notif    public.notificacoes%ROWTYPE;
    v_desde    TIMESTAMP WITH TIME ZONE;
    v_emails   TEXT[];
    v_qtd      INT;
    v_nome1    TEXT;
    v_nome2    TEXT;
    v_msg      TEXT;
    v_titulo   TEXT;
BEGIN
    SELECT lower(btrim(coalesce("criadorEmail", ''))), coalesce(nome, 'seu torneio')
      INTO v_org, v_nome_t
      FROM public.torneios WHERE id = NEW.torneio_id;

    IF v_org IS NULL OR v_org = '' OR v_org = NEW.user_email THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_notif
      FROM public.notificacoes
     WHERE lower(btrim(user_email)) = v_org AND chave_grupo = v_chave AND lida = false
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE;

    v_desde := CASE WHEN FOUND THEN coalesce(v_notif.agrupado_desde, v_notif.created_at) ELSE NEW.created_at END;

    -- Pessoas diferentes que comentaram desde o início do grupo (a mais recente primeiro)
    SELECT array_agg(x.email ORDER BY x.ultimo DESC), count(*)
      INTO v_emails, v_qtd
      FROM (
        SELECT c.user_email AS email, max(c.created_at) AS ultimo
          FROM public.comentarios c
         WHERE c.torneio_id = NEW.torneio_id
           AND c.created_at >= v_desde
           AND c.user_email <> v_org
         GROUP BY c.user_email
      ) x;

    IF coalesce(v_qtd, 0) = 0 THEN
        RETURN NEW;
    END IF;

    SELECT coalesce(nullif(btrim(u.nome), ''), split_part(v_emails[1], '@', 1)) INTO v_nome1
      FROM (SELECT 1) s LEFT JOIN public.usuarios u ON lower(btrim(u.email)) = v_emails[1];
    IF v_qtd >= 2 THEN
        SELECT coalesce(nullif(btrim(u.nome), ''), split_part(v_emails[2], '@', 1)) INTO v_nome2
          FROM (SELECT 1) s LEFT JOIN public.usuarios u ON lower(btrim(u.email)) = v_emails[2];
    END IF;

    v_msg := CASE
        WHEN v_qtd = 1 THEN v_nome1 || ' comentou no torneio "' || v_nome_t || '".'
        WHEN v_qtd = 2 THEN v_nome1 || ' e ' || v_nome2 || ' comentaram no torneio "' || v_nome_t || '".'
        ELSE v_nome1 || ' e mais ' || (v_qtd - 1) || ' pessoas comentaram no torneio "' || v_nome_t || '".'
    END;
    v_titulo := CASE WHEN v_qtd = 1 THEN 'Novo comentário' ELSE 'Novos comentários' END;

    IF v_notif.id IS NOT NULL THEN
        -- Atualiza o grupo e sobe a notificação para o topo da lista
        UPDATE public.notificacoes
           SET titulo = v_titulo, mensagem = v_msg, created_at = NEW.created_at
         WHERE id = v_notif.id;
    ELSE
        INSERT INTO public.notificacoes
            (user_email, titulo, mensagem, tipo, link, lida, chave_grupo, agrupado_desde)
        VALUES
            (v_org, v_titulo, v_msg, 'comentario',
             '/torneio/custom.html?id=' || NEW.torneio_id || '#comentarios',
             false, v_chave, NEW.created_at);
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Um erro na notificação nunca impede o comentário de ser publicado
    RAISE WARNING 'vh_notificar_comentario: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vh_notificar_comentario ON public.comentarios;
CREATE TRIGGER vh_notificar_comentario
    AFTER INSERT ON public.comentarios
    FOR EACH ROW EXECUTE FUNCTION public.vh_notificar_comentario();

-- ------------------------------------------------------------------------------
-- 9. TEMPO REAL (Supabase Realtime)
--    Liga o envio de mudanças em tempo real para as tabelas que o site escuta:
--    placar/partidas, status do torneio, inscrições, comentários e notificações.
--    As regras de leitura (RLS) continuam valendo: cada pessoa só recebe as
--    mudanças que ela poderia ler (ex.: notificações, só as próprias).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_tabela TEXT;
    v_todas  BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    SELECT puballtables INTO v_todas FROM pg_publication WHERE pubname = 'supabase_realtime';
    IF v_todas THEN
        RETURN; -- a publicação já inclui todas as tabelas
    END IF;

    FOREACH v_tabela IN ARRAY ARRAY['partidas', 'torneios', 'inscricoes', 'comentarios', 'notificacoes'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tabela
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tabela);
        END IF;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. INSCRIÇÕES SEM REPETIÇÃO
--     O convite do organizador gravava o código do usuário (UUID) como
--     id_participante, enquanto a inscrição feita pela própria pessoa grava o
--     e-mail. Assim a mesma pessoa podia ficar com duas inscrições no torneio.
--     1) padroniza inscrições individuais para usar o e-mail;
--     2) apaga as repetidas, mantendo a melhor de cada pessoa/equipe
--        (Aceito > Pendente > Rejeitado; em empate, a mais antiga);
--     3) cria travas: uma inscrição por jogador e uma por equipe em cada torneio.
-- ------------------------------------------------------------------------------
UPDATE public.inscricoes
   SET id_participante = lower(btrim(user_email))
 WHERE coalesce(lower(tipo), 'individual') <> 'equipe'
   AND id_participante ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND coalesce(btrim(user_email), '') <> '';

WITH ordenadas AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY torneio_id,
                            CASE WHEN coalesce(lower(tipo), 'individual') = 'equipe'
                                 THEN 'equipe:' || coalesce(id_participante, '')
                                 ELSE 'jogador:' || lower(btrim(user_email)) END
               ORDER BY CASE status WHEN 'Aceito' THEN 0 WHEN 'Rejeitado' THEN 2 ELSE 1 END,
                        created_at,
                        id
           ) AS posicao
      FROM public.inscricoes
)
DELETE FROM public.inscricoes i
 USING ordenadas o
 WHERE i.id = o.id
   AND o.posicao > 1;

CREATE UNIQUE INDEX IF NOT EXISTS inscricoes_unica_por_jogador
    ON public.inscricoes (torneio_id, lower(btrim(user_email)))
 WHERE coalesce(lower(tipo), 'individual') <> 'equipe';

CREATE UNIQUE INDEX IF NOT EXISTS inscricoes_unica_por_equipe
    ON public.inscricoes (torneio_id, id_participante)
 WHERE coalesce(lower(tipo), 'individual') = 'equipe';
