// ==============================================================================
// VERSUSHUB - PÁGINA DE TORNEIOS AO VIVO
// Sincronização dinâmica via Supabase e interrupção do carregamento infinito
// ==============================================================================

import { supabase } from '/supabaseClient.js';

let cacheTorneiosAoVivo = [];

/**
 * Escapa strings HTML para segurança contra XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Interrompe a tela de carregamento imediatamente
 */
function fecharLoader() {
  const loader = document.getElementById('aovivoLoader');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Renderiza os cards de torneios ao vivo ou o estado neutro/vazio
 */
function renderizarTorneiosAoVivo(torneios, termoBusca = '') {
  const container = document.getElementById('listaAoVivo');
  if (!container) return;

  const termo = termoBusca.trim().toLowerCase();
  const filtrados = torneios.filter(t => {
    if (!termo) return true;
    const nome = (t.nome || '').toLowerCase();
    const jogo = (t.jogo || '').toLowerCase();
    return nome.includes(termo) || jogo.includes(termo);
  });

  container.innerHTML = '';

  if (filtrados.length === 0) {
    container.innerHTML = `
      <div class="empty-aovivo-container" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-tower-broadcast main-icon"></i>
        <h2>Nenhuma transmissão ao vivo no momento</h2>
        <p>${termo ? 'Nenhuma transmissão corresponde aos termos da sua pesquisa.' : 'Não há torneios com transmissão ao vivo ativa neste instante. Acompanhe os próximos campeonatos ou explore todos os torneios disponíveis.'}</p>
        <div class="empty-aovivo-actions">
          <a href="/pagina_inicial/torneios.html" class="btn-aovivo-action-primary">
            <i class="fa-solid fa-trophy"></i> Ver Todos os Torneios
          </a>
          <a href="/gerenciartorneios/gerentornindex.html" class="btn-aovivo-action-secondary">
            <i class="fa-solid fa-file-invoice"></i> Gerenciar Meus Torneios
          </a>
        </div>
      </div>
    `;
    return;
  }

  filtrados.forEach(torneio => {
    const card = document.createElement('article');
    card.className = 'card-torneio ao-vivo';
    card.setAttribute('data-nome', torneio.nome || '');

    const banner = torneio.banner || torneio.imagem || '/images/cerradocup.jpg';
    const nome = torneio.nome || 'Torneio Ao Vivo';
    const jogo = torneio.jogo || 'Competitivo';
    const categoria = (torneio.categoria || 'E-Sports').toUpperCase();
    const plataforma = (torneio.plataforma || 'Multi').toUpperCase();
    const dataInfo = torneio.data ? `Início: ${torneio.data}` : 'Transmissão em andamento';

    // Determina o link da transmissão
    let streamUrl = torneio.link || torneio.transmissao_url;
    if (!streamUrl || streamUrl.startsWith('/')) {
      streamUrl = `/torneio/custom.html?id=${encodeURIComponent(torneio.id)}`;
    }

    card.innerHTML = `
      <div class="badge-ao-vivo">
        <span class="dot"></span> Ao vivo
      </div>
      <img referrerpolicy="no-referrer" src="${escapeHtml(banner)}" alt="${escapeHtml(nome)}">
      <div class="card-info">
        <h2>${escapeHtml(nome)}</h2>
        <p class="jogo">Jogo: ${escapeHtml(jogo)} • ${escapeHtml(categoria)} • ${escapeHtml(plataforma)}</p>
        <p class="data">${escapeHtml(dataInfo)}</p>
        <a href="${escapeHtml(streamUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; width: 100%;">
          <button type="button" class="btn-detalhes btn-assistir" style="width: 100%;">
            <i class="fa-solid fa-play"></i> Assistir agora
          </button>
        </a>
      </div>
    `;

    container.appendChild(card);
  });
}

// Transmissões oficiais de destaque exibidas quando não há transmissões criadas ativas
const transmissoesOficiais = [
  {
    id: 'oficial-cerrado',
    nome: 'Cerrado Cup CS:GO - Grande Final',
    jogo: 'CS:GO • FPS / Tiro • PC',
    categoria: 'FPS',
    plataforma: 'PC',
    data: 'Ao vivo agora',
    status: 'Ao Vivo',
    statusClass: 'status-andamento',
    banner: '/images/cerradocup.jpg',
    link: '/aovivo/cerrado-transmissao.html'
  },
  {
    id: 'oficial-fortnite',
    nome: 'Fortnite Battle Cup - Rodada Decisiva',
    jogo: 'Fortnite • Battle Royale • Multi',
    categoria: 'BATTLE ROYALE',
    plataforma: 'MULTI',
    data: 'Ao vivo agora',
    status: 'Ao Vivo',
    statusClass: 'status-andamento',
    banner: '/images/fileirafortnite.jpeg',
    link: '/aovivo/fortnite-battlecup.html'
  },
  {
    id: 'oficial-kingscup',
    nome: 'Clash Royale Kings Cup - Quartas de Final',
    jogo: 'Clash Royale • Card Game • Mobile',
    categoria: 'CARTAS',
    plataforma: 'MOBILE',
    data: 'Ao vivo agora',
    status: 'Ao Vivo',
    statusClass: 'status-andamento',
    banner: '/images/fileiraclash.jpeg',
    link: '/aovivo/clash-royale-kingscup.html'
  }
];

/**
 * Avalia se um torneio possui transmissão ativa ou status ao vivo
 */
function isTorneioAoVivo(t) {
  if (!t) return false;
  const status = (t.status || '').toLowerCase();
  const statusClass = (t.statusClass || '').toLowerCase();
  const link = (t.link || '').toLowerCase();

  // Torneios encerrados não estão ao vivo
  if (status.includes('encerrado') || status.includes('finalizado')) {
    return false;
  }

  // 1. Marcados como Ao Vivo ou em andamento
  if (status.includes('ao vivo') || statusClass === 'status-andamento') {
    return true;
  }

  // 2. Flags booleanas
  if (t.ao_vivo === true || t.ao_vivo === 'true' || t.transmissao_status === 'ao_vivo') {
    return true;
  }

  // 3. Torneios com links de live externos válidos
  if (link.includes('youtube.com') || link.includes('youtu.be') || link.includes('twitch.tv')) {
    return true;
  }

  return false;
}

/**
 * Busca torneios no Supabase e localStorage que estejam ao vivo
 */
async function buscarTorneiosAoVivo() {
  let listaDb = [];

  try {
    // Consulta todos os torneios no Supabase sem cláusulas or() quebradas
    const { data, error } = await supabase
      .from('torneios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Aviso ao consultar torneios no Supabase:', error);
    } else if (Array.isArray(data)) {
      listaDb = data.filter(isTorneioAoVivo);
    }
  } catch (err) {
    console.error('Falha ao conectar com Supabase em buscarTorneiosAoVivo:', err);
  } finally {
    fecharLoader();
  }

  // Mescla com torneios do localStorage (vh_createdTournaments)
  try {
    const locais = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
    locais.forEach(loc => {
      if (isTorneioAoVivo(loc) && !listaDb.some(t => String(t.id) === String(loc.id))) {
        listaDb.unshift(loc);
      }
    });
  } catch (err) {
    console.warn('Erro ao ler torneios locais:', err);
  }

  // Se não houver transmissões de organizadores ativas, inclui as transmissões padrão em destaque
  if (listaDb.length === 0) {
    listaDb = [...transmissoesOficiais];
  }

  cacheTorneiosAoVivo = listaDb;
  renderizarTorneiosAoVivo(cacheTorneiosAoVivo);
}

// Configura busca no input do Header
function configurarBuscaHeader() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderizarTorneiosAoVivo(cacheTorneiosAoVivo, searchInput.value);
    });
  }
}

// Inicialização segura após o carregamento do DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    configurarBuscaHeader();
    buscarTorneiosAoVivo();
  });
} else {
  configurarBuscaHeader();
  buscarTorneiosAoVivo();
}
