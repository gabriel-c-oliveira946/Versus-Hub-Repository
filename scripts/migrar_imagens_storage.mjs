// ==============================================================================
// VERSUSHUB - MIGRAÇÃO DAS IMAGENS ANTIGAS (Base64 no banco -> Supabase Storage)
//
// Imagens antigas (avatares, banners, logos) estão gravadas como texto Base64
// dentro das tabelas. Este script envia cada uma para o bucket 'imagens' e troca
// o valor no banco pela URL pública. Imagens que já são URL não são tocadas.
//
// PRÉ-REQUISITOS
//   - Node.js 18 ou mais novo (usa o fetch nativo; não precisa de npm install)
//   - Ter rodado o supabase_seguranca.sql (cria o bucket 'imagens')
//   - A chave "service_role" do projeto (Supabase > Project Settings > API Keys).
//     ATENÇÃO: essa chave ignora todas as regras de segurança. Use só no seu
//     computador, nunca coloque no código do site nem faça commit dela.
//
// COMO USAR (na pasta do projeto)
//   1. Simulação (não altera nada, só mostra o que seria migrado):
//        SUPABASE_URL=https://SEU-PROJETO.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrar_imagens_storage.mjs
//   2. Migração de verdade:
//        SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrar_imagens_storage.mjs --executar
//   No Windows (PowerShell), defina as variáveis antes:
//        $env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY="..."
//        node scripts/migrar_imagens_storage.mjs --executar
//
// Pode rodar mais de uma vez: na segunda vez não haverá mais Base64 para migrar.
// ==============================================================================

import { createHash } from 'node:crypto';

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const EXECUTAR = process.argv.includes('--executar');
const BUCKET = 'imagens';

if (!URL_BASE || !CHAVE) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (veja as instruções no topo do arquivo).');
  process.exit(1);
}

const headers = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };
const ehBase64 = (v) => typeof v === 'string' && v.startsWith('data:image/');
const enviadas = new Map(); // hash da imagem -> URL (a mesma imagem é enviada uma vez só)
const resumo = { encontradas: 0, enviadas: 0, reaproveitadas: 0, linhasAtualizadas: 0, erros: 0 };

async function buscarTodos(tabela, colunas) {
  const linhas = [];
  const passo = 200;
  for (let inicio = 0; ; inicio += passo) {
    const resp = await fetch(`${URL_BASE}/rest/v1/${tabela}?select=${encodeURIComponent(colunas)}&order=id.asc&offset=${inicio}&limit=${passo}`, { headers });
    if (!resp.ok) throw new Error(`Erro ao ler ${tabela}: ${resp.status} ${await resp.text()}`);
    const lote = await resp.json();
    linhas.push(...lote);
    if (lote.length < passo) break;
  }
  return linhas;
}

async function atualizar(tabela, id, dados) {
  const resp = await fetch(`${URL_BASE}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(dados)
  });
  if (!resp.ok) throw new Error(`Erro ao atualizar ${tabela} ${id}: ${resp.status} ${await resp.text()}`);
}

async function enviar(dataUrl, pasta, dono) {
  resumo.encontradas++;
  const [cabecalho, base64] = dataUrl.split(',');
  const tipo = (cabecalho.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bytes = Buffer.from(base64 || '', 'base64');
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);

  if (enviadas.has(hash)) {
    resumo.reaproveitadas++;
    return enviadas.get(hash);
  }

  const ext = tipo === 'image/png' ? 'png' : (tipo === 'image/webp' ? 'webp' : (tipo === 'image/gif' ? 'gif' : 'jpg'));
  const caminho = `${pasta}/${dono || 'migrado'}/${hash}.${ext}`;
  const urlPublica = `${URL_BASE}/storage/v1/object/public/${BUCKET}/${caminho}`;

  if (!EXECUTAR) {
    enviadas.set(hash, urlPublica);
    return urlPublica;
  }

  const resp = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${caminho}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': tipo, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'true' },
    body: bytes
  });
  if (!resp.ok) throw new Error(`Erro ao enviar ${caminho}: ${resp.status} ${await resp.text()}`);

  resumo.enviadas++;
  enviadas.set(hash, urlPublica);
  return urlPublica;
}

async function migrarLinha(tabela, linha, campos, dono) {
  const dados = {};
  for (const [campo, pasta] of campos) {
    if (ehBase64(linha[campo])) {
      dados[campo] = await enviar(linha[campo], pasta, dono);
    }
  }
  if (Object.keys(dados).length === 0) return;
  if (EXECUTAR) await atualizar(tabela, linha.id, dados);
  resumo.linhasAtualizadas++;
  console.log(`${EXECUTAR ? '✔' : '•'} ${tabela} ${linha.id}: ${Object.keys(dados).join(', ')}`);
}

async function main() {
  console.log(EXECUTAR ? '== MIGRAÇÃO (alterando o banco) ==' : '== SIMULAÇÃO (nada será alterado; use --executar para migrar) ==');

  // Mapa e-mail -> id do usuário, para guardar cada imagem na pasta do dono
  const usuarios = await buscarTodos('usuarios', 'id,email,avatar,banner');
  const idPorEmail = new Map(usuarios.map(u => [String(u.email || '').trim().toLowerCase(), u.id]));
  const dono = (email) => idPorEmail.get(String(email || '').trim().toLowerCase()) || 'migrado';

  const tarefas = [];

  for (const u of usuarios) {
    tarefas.push(() => migrarLinha('usuarios', u, [['avatar', 'avatares'], ['banner', 'banners-perfil']], u.id));
  }

  const equipes = await buscarTodos('equipes', 'id,leaderEmail,logo,leaderAvatar,torneiosGanhos');
  for (const e of equipes) {
    tarefas.push(async () => {
      await migrarLinha('equipes', e, [['logo', 'logos'], ['leaderAvatar', 'avatares']], dono(e.leaderEmail));
      // Banners copiados para a lista de títulos da equipe
      if (Array.isArray(e.torneiosGanhos) && e.torneiosGanhos.some(t => ehBase64(t?.banner))) {
        const novos = [];
        for (const t of e.torneiosGanhos) {
          novos.push(ehBase64(t?.banner) ? { ...t, banner: await enviar(t.banner, 'banners-torneio', 'migrado') } : t);
        }
        if (EXECUTAR) await atualizar('equipes', e.id, { torneiosGanhos: novos });
        resumo.linhasAtualizadas++;
        console.log(`${EXECUTAR ? '✔' : '•'} equipes ${e.id}: torneiosGanhos`);
      }
    });
  }

  const torneios = await buscarTodos('torneios', 'id,criadorEmail,banner');
  for (const t of torneios) {
    tarefas.push(() => migrarLinha('torneios', t, [['banner', 'banners-torneio']], dono(t.criadorEmail)));
  }

  for (const tarefa of tarefas) {
    try {
      await tarefa();
    } catch (err) {
      resumo.erros++;
      console.error('✖', err.message);
    }
  }

  console.log('\n== RESUMO ==');
  console.log(`Imagens em Base64 encontradas: ${resumo.encontradas}`);
  console.log(`Arquivos ${EXECUTAR ? 'enviados' : 'a enviar'}: ${EXECUTAR ? resumo.enviadas : enviadas.size}`);
  console.log(`Imagens repetidas reaproveitadas: ${resumo.reaproveitadas}`);
  console.log(`Registros ${EXECUTAR ? 'atualizados' : 'a atualizar'}: ${resumo.linhasAtualizadas}`);
  console.log(`Erros: ${resumo.erros}`);
  if (!EXECUTAR) console.log('\nPara migrar de verdade, rode de novo com --executar.');
}

main().catch(err => {
  console.error('Falha geral:', err.message);
  process.exit(1);
});
