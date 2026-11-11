// ==============================================================================
// VERSUSHUB - COMENTÁRIOS DO TORNEIO
// Seção "Comentários" da página torneio/custom.html.
// Regras no banco (supabase_seguranca.sql, seção 7): leitura pública, comentário
// só logado e em nome próprio, apagar só o autor ou o organizador, 1 a 500
// caracteres e no máximo 5 comentários por minuto.
// ==============================================================================

import { supabase, getActiveSession, getActiveUser } from '/supabaseClient.js';

const POR_PAGINA = 20;
const AVATAR_PADRAO = '/image/boneco_logo_ofc.png';

const estado = {
  torneioId: '',
  organizadorEmail: '',
  meuEmail: '',
  carregados: 0,
  total: 0,
  perfis: new Map() // e-mail -> { id, nome, avatar }
};

const el = (id) => document.getElementById(id);

function tempoRelativo(dataIso) {
  const data = new Date(dataIso);
  const seg = Math.max(0, Math.floor((Date.now() - data.getTime()) / 1000));
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? 'há 1 dia' : `há ${d} dias`;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function mostrarErro(msg) {
  const erro = el('comentarioErro');
  if (!erro) return;
  erro.textContent = msg || '';
  erro.hidden = !msg;
}

function atualizarContagem() {
  const contagem = el('comentariosContagem');
  if (contagem) contagem.textContent = estado.total > 0 ? String(estado.total) : '';
  const vazio = el('comentariosVazio');
  if (vazio) vazio.hidden = estado.total > 0;
  const mais = el('comentariosMais');
  if (mais) mais.hidden = estado.carregados >= estado.total;
}

async function carregarPerfis(emails) {
  const faltando = [...new Set(emails)].filter(e => e && !estado.perfis.has(e));
  if (faltando.length === 0) return;
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, avatar')
    .in('email', faltando);
  (data || []).forEach(u => {
    estado.perfis.set(String(u.email || '').toLowerCase().trim(), {
      id: u.id,
      nome: u.nome || 'Jogador',
      avatar: u.avatar || AVATAR_PADRAO
    });
  });
}

/**
 * Monta o item do comentário com textContent (nunca innerHTML com o texto do
 * usuário), para que ninguém consiga injetar código pela caixa de comentário.
 */
function criarItem(c) {
  const email = String(c.user_email || '').toLowerCase().trim();
  const perfil = estado.perfis.get(email) || { nome: email.split('@')[0] || 'Jogador', avatar: AVATAR_PADRAO };
  const linkPerfil = `/perfil/perfil-publico.html?id=${encodeURIComponent(perfil.id || email)}`;

  const li = document.createElement('li');
  li.className = 'comentario-item';
  li.dataset.id = c.id;

  const aAvatar = document.createElement('a');
  aAvatar.href = linkPerfil;
  aAvatar.className = 'comentario-avatar-link';
  const img = document.createElement('img');
  img.className = 'comentario-avatar';
  img.src = perfil.avatar;
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => { img.onerror = null; img.src = AVATAR_PADRAO; };
  aAvatar.appendChild(img);

  const corpo = document.createElement('div');
  corpo.className = 'comentario-corpo';

  const topo = document.createElement('div');
  topo.className = 'comentario-topo';

  const nome = document.createElement('a');
  nome.className = 'comentario-nome';
  nome.href = linkPerfil;
  nome.textContent = perfil.nome;
  topo.appendChild(nome);

  if (email && email === estado.organizadorEmail) {
    const tag = document.createElement('span');
    tag.className = 'comentario-tag-org';
    tag.textContent = 'Organizador';
    topo.appendChild(tag);
  }

  const quando = document.createElement('time');
  quando.className = 'comentario-tempo';
  quando.dateTime = c.created_at;
  quando.title = new Date(c.created_at).toLocaleString('pt-BR');
  quando.textContent = tempoRelativo(c.created_at);
  topo.appendChild(quando);

  const podeApagar = estado.meuEmail && (estado.meuEmail === email || estado.meuEmail === estado.organizadorEmail);
  if (podeApagar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'comentario-apagar';
    btn.title = 'Apagar comentário';
    btn.setAttribute('aria-label', 'Apagar comentário');
    btn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    btn.addEventListener('click', () => apagarComentario(c.id, li, btn));
    topo.appendChild(btn);
  }

  const texto = document.createElement('p');
  texto.className = 'comentario-texto';
  texto.textContent = c.texto;

  corpo.appendChild(topo);
  corpo.appendChild(texto);
  li.appendChild(aAvatar);
  li.appendChild(corpo);
  return li;
}

async function carregarComentarios(maisAntigos = false) {
  const lista = el('comentariosLista');
  if (!lista) return;
  const btnMais = el('comentariosMais');
  if (btnMais) btnMais.disabled = true;

  const inicio = maisAntigos ? estado.carregados : 0;
  const { data, count, error } = await supabase
    .from('comentarios')
    .select('id, user_email, texto, created_at', { count: 'exact' })
    .eq('torneio_id', estado.torneioId)
    .order('created_at', { ascending: false })
    .range(inicio, inicio + POR_PAGINA - 1);

  if (btnMais) btnMais.disabled = false;

  if (error) {
    console.warn('[VersusHub Comentários] Erro ao carregar:', error?.message || error);
    if (!maisAntigos) {
      lista.innerHTML = '';
      const aviso = document.createElement('li');
      aviso.className = 'comentarios-aviso';
      aviso.textContent = 'Não foi possível carregar os comentários agora.';
      lista.appendChild(aviso);
    }
    return;
  }

  const itens = data || [];
  await carregarPerfis(itens.map(c => String(c.user_email || '').toLowerCase().trim()));

  if (!maisAntigos) lista.innerHTML = '';
  itens.forEach(c => lista.appendChild(criarItem(c)));

  estado.carregados = inicio + itens.length;
  estado.total = typeof count === 'number' ? count : estado.carregados;
  atualizarContagem();
}

async function enviarComentario(evento) {
  evento.preventDefault();
  mostrarErro('');
  const campo = el('comentarioTexto');
  const botao = el('comentarioEnviar');
  const texto = (campo?.value || '').trim();

  if (!texto) {
    mostrarErro('Escreva algo antes de enviar.');
    return;
  }
  if (texto.length > 500) {
    mostrarErro('O comentário pode ter no máximo 500 caracteres.');
    return;
  }

  botao.disabled = true;
  const { data, error } = await supabase
    .from('comentarios')
    .insert([{ torneio_id: estado.torneioId, user_email: estado.meuEmail, texto }])
    .select('id, user_email, texto, created_at')
    .single();
  botao.disabled = false;

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('Muitos comentários')) mostrarErro(msg);
    else if (msg.toLowerCase().includes('row-level security')) mostrarErro('Sua sessão expirou. Entre novamente para comentar.');
    else mostrarErro('Não foi possível enviar o comentário. Tente novamente.');
    console.warn('[VersusHub Comentários] Erro ao enviar:', msg);
    return;
  }

  campo.value = '';
  el('comentarioContador').textContent = '0/500';
  await carregarPerfis([estado.meuEmail]);
  const lista = el('comentariosLista');
  lista.querySelector('.comentarios-aviso')?.remove();
  lista.prepend(criarItem(data));
  estado.carregados += 1;
  estado.total += 1;
  atualizarContagem();
}

async function apagarComentario(id, li, botao) {
  if (!confirm('Apagar este comentário?')) return;
  botao.disabled = true;
  const { error, count } = await supabase
    .from('comentarios')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error || count === 0) {
    botao.disabled = false;
    alert('Não foi possível apagar o comentário.');
    console.warn('[VersusHub Comentários] Erro ao apagar:', error?.message || 'nenhuma linha removida');
    return;
  }
  li.remove();
  estado.carregados = Math.max(0, estado.carregados - 1);
  estado.total = Math.max(0, estado.total - 1);
  atualizarContagem();
}

async function iniciar() {
  const secao = el('comentariosSecao');
  if (!secao) return;

  estado.torneioId = new URLSearchParams(window.location.search).get('id') || '';
  if (!estado.torneioId) {
    secao.hidden = true;
    return;
  }

  const [{ data: torneio }, sessao] = await Promise.all([
    supabase.from('torneios').select('id, criadorEmail').eq('id', estado.torneioId).maybeSingle(),
    getActiveSession()
  ]);

  // Torneio inexistente: a própria página já mostra o aviso de erro
  if (!torneio) {
    secao.hidden = true;
    return;
  }
  estado.organizadorEmail = String(torneio.criadorEmail || '').toLowerCase().trim();

  // Formulário só para quem tem sessão ativa no Supabase (exigência do banco)
  if (sessao?.user?.email) {
    estado.meuEmail = String(sessao.user.email).toLowerCase().trim();
    const form = el('comentarioForm');
    form.hidden = false;
    form.addEventListener('submit', enviarComentario);

    const campo = el('comentarioTexto');
    campo.addEventListener('input', () => {
      el('comentarioContador').textContent = `${campo.value.length}/500`;
    });
    // Ctrl+Enter envia
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
    });

    try {
      const eu = await getActiveUser();
      if (eu?.avatar) {
        const meuAvatar = el('comentarioMeuAvatar');
        meuAvatar.src = eu.avatar;
        meuAvatar.onerror = () => { meuAvatar.onerror = null; meuAvatar.src = AVATAR_PADRAO; };
      }
    } catch (e) {}
  } else {
    el('comentarioLoginAviso').hidden = false;
  }

  el('comentariosMais')?.addEventListener('click', () => carregarComentarios(true));
  await carregarComentarios(false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
