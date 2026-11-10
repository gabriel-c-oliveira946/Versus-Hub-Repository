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
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Colunas usadas pelas políticas (caso ainda não existam)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.equipes ADD COLUMN IF NOT EXISTS "leaderId" UUID;
ALTER TABLE IF EXISTS public.membros_equipe ADD COLUMN IF NOT EXISTS user_id UUID;

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
