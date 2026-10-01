// /ranking.js
import { supabase } from '/supabaseClient.js';

// Utilitário oficial de sanitização contra XSS armazenado
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Utilitário para remover acentos e padronizar textos para buscas
function normalizeText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Mapeamento inteligente de fallback para integrantes com fotos autênticas
function resolvePlayerAvatar(u) {
  const customAvatar = (u.avatar || '').trim();
  if (customAvatar && customAvatar !== '/image/boneco_logo_ofc.png') {
    if (!customAvatar.includes('microsoft.png') && !customAvatar.includes('pngtree-avatar-icon')) {
      return customAvatar;
    }
  }

  const nome = normalizeText(u.nome);
  const email = normalizeText(u.email);

  if (nome.includes('caique') || email.includes('caique')) {
    return '/equipes/images/caiquebrandao.jpg';
  }
  if (nome.includes('gabriel') || email.includes('costaoliveira')) {
    return '/equipes/images/gabrieloliveira.webp';
  }

  return '/image/boneco_logo_ofc.png';
}

// Estado global do Ranking
let currentTab = 'jogadores'; // 'jogadores' | 'equipes'
let sortedPlayers = [];
let sortedTeams = [];
let currentSortedList = [];
let currentLoggedUser = null;

// Elementos do DOM
let podiumContainer = null;
let tableContainer = null;
let tableHeaderRow = null;
let searchInput = null;
let tabJogadoresBtn = null;
let tabEquipesBtn = null;

// ==============================================================================
// RENDERIZAÇÃO DO PODIUM (TOP 3) DIRETO DOS DADOS DA VIEW
// ==============================================================================
function renderPodium(items) {
  if (!podiumContainer) return;
  podiumContainer.innerHTML = '';

  const top3 = items.slice(0, 3);
  if (!top3.length) {
    podiumContainer.style.display = 'none';
    return;
  } else {
    podiumContainer.style.display = 'flex';
  }

  // Mapeamento visual das 3 posições: 2º (esquerda), 1º (centro/destaque), 3º (direita)
  const orderConfig = [
    { pos: 2, cssClass: 'second', title: 'Vice-Campeão' },
    { pos: 1, cssClass: 'first', title: 'Líder Supremo' },
    { pos: 3, cssClass: 'third', title: 'Terceiro Lugar' }
  ];

  orderConfig.forEach(cfg => {
    const itemIndex = cfg.pos - 1;
    const item = top3[itemIndex];
    if (!item) return;

    const card = document.createElement('div');
    card.className = `podium-card ${cfg.cssClass}`;

    const isTeam = currentTab === 'equipes';
    const avatarImg = escapeHtml(isTeam ? (item.logo || '/image/logo.png') : item.avatar);
    const fallbackImg = escapeHtml(isTeam ? '/image/logo.png' : '/image/boneco_logo_ofc.png');
    const escapedNome = escapeHtml(item.nome);
    const escapedTag = item.tag ? `[${escapeHtml(item.tag)}] ` : '';
    const escapedTitle = escapeHtml(cfg.title);
    const escapedPoints = escapeHtml(item.points);
    const escapedDisputed = escapeHtml(item.stats.disputed);

    const middleStatLabel = isTeam ? 'Títulos' : 'Vitórias';
    const middleStatValue = escapeHtml(isTeam ? item.stats.won : item.stats.wins);
    const winRate = item.winRate !== undefined ? item.winRate : 0;

    card.innerHTML = `
      <div class="podium-rank-badge">
        ${cfg.cssClass === 'first' ? '<i class="fa-solid fa-crown" style="color: inherit;"></i>' : cfg.pos}
      </div>
      <div class="podium-avatar-wrapper">
        <img referrerpolicy="no-referrer" src="${avatarImg}" alt="${escapedNome}" class="podium-avatar" onerror="this.onerror=null; this.src='${fallbackImg}';" />
      </div>
      <h3 class="podium-name">${escapedNome}</h3>
      <p class="podium-title">${escapedTag}${escapedTitle}</p>
      <div class="podium-score">${escapedPoints} pts</div>
      
      <div class="podium-stats-micro">
        <div class="podium-stat-item">
          <span class="podium-stat-label">Torneios</span>
          <span class="podium-stat-value">${escapedDisputed}</span>
        </div>
        <div class="podium-stat-item">
          <span class="podium-stat-label">${middleStatLabel}</span>
          <span class="podium-stat-value" style="color: #4ade80;">${middleStatValue}</span>
        </div>
        <div class="podium-stat-item">
          <span class="podium-stat-label">Aprov.</span>
          <span class="podium-stat-value">${winRate}%</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      window.location.href = item.link;
    });

    podiumContainer.appendChild(card);
  });
}

// ==============================================================================
// RENDERIZAÇÃO DA TABELA (4º EM DIANTE OU RESULTADOS BUSCADOS)
// ==============================================================================
function renderTableList(items, isFiltered = false) {
  if (!tableContainer) return;
  tableContainer.innerHTML = '';

  const isTeam = currentTab === 'equipes';
  const startIndex = isFiltered ? 0 : 3;
  const listToShow = items.slice(startIndex);

  if (listToShow.length === 0) {
    if (isFiltered) {
      tableContainer.innerHTML = `
        <div class="ranking-no-results">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 32px; color: #ff7300; margin-bottom: 12px; display: block;"></i>
          Nenhum ${isTeam ? 'time' : 'jogador'} encontrado com este termo de busca.
        </div>
      `;
    } else if (items.length === 0) {
      tableContainer.innerHTML = `
        <div class="ranking-no-results" style="color: #9cb1cf; padding: 24px;">
          <i class="fa-solid fa-users-slash" style="font-size: 32px; color: #ff7300; margin-bottom: 12px; display: block;"></i>
          Nenhum ${isTeam ? 'time registrado' : 'jogador com inscrições confirmadas'} no momento.
        </div>
      `;
    } else {
      tableContainer.innerHTML = `
        <div class="ranking-no-results" style="color: #9cb1cf; padding: 24px;">
          <i class="fa-solid fa-trophy" style="font-size: 28px; color: #ff7300; margin-bottom: 12px; display: block;"></i>
          Todos os participantes classificados estão atualmente no pódio acima.
        </div>
      `;
    }
    return;
  }

  listToShow.forEach((item, index) => {
    const originalRank = currentSortedList.findIndex(x => x.id === item.id) + 1 || (index + 1);

    const isCurrentUser = Boolean(
      !isTeam && currentLoggedUser && (
        (currentLoggedUser.id && item.id === currentLoggedUser.id) ||
        (currentLoggedUser.email && item.email && normalizeText(item.email) === normalizeText(currentLoggedUser.email))
      )
    );

    const row = document.createElement('div');
    row.className = 'leaderboard-row' + (isCurrentUser ? ' current-user' : '');

    const winRate = item.winRate !== undefined ? item.winRate : 0;
    let winRateClass = 'mid';
    if (winRate >= 70) winRateClass = 'high';
    else if (winRate < 50) winRateClass = 'low';

    const avatarSrc = escapeHtml(isTeam ? (item.logo || '/image/logo.png') : item.avatar);
    const fallbackSrc = escapeHtml(isTeam ? '/image/logo.png' : '/image/boneco_logo_ofc.png');

    const rawSubTitle = isTeam ? (item.tag ? `[${item.tag}] ${item.jogos || 'E-Sports'}` : (item.jogos || 'E-Sports')) : (item.email || '');
    const subTitle = escapeHtml(rawSubTitle);
    const escapedNome = escapeHtml(item.nome);
    const escapedPoints = escapeHtml(item.points);
    const escapedDisputed = escapeHtml(item.stats.disputed);
    const escapedLeader = escapeHtml(item.leaderName || 'Líder');
    const escapedWon = escapeHtml(item.stats.won);
    const escapedWins = escapeHtml(item.stats.wins);
    const escapedLosses = escapeHtml(item.stats.losses);

    const col5 = isTeam ? `<div class="player-stat" style="color: #4ade80;">${escapedWon}</div>` : `<div class="player-stat" style="color: #4ade80;">${escapedWins}</div>`;
    const col6 = isTeam ? `<div class="player-stat" style="color: #9cb1cf; font-size: 13px;">${escapedLeader}</div>` : `<div class="player-stat" style="color: #f97373;">${escapedLosses}</div>`;

    row.innerHTML = `
      <div class="player-rank">#${originalRank}</div>
      <div class="player-identity">
        <img referrerpolicy="no-referrer" src="${avatarSrc}" alt="${escapedNome}" class="player-img" onerror="this.onerror=null; this.src='${fallbackSrc}';" />
        <div class="player-name-wrapper">
          <span class="player-name">
            ${escapedNome}
            ${isCurrentUser ? '<span class="player-badge">VOCÊ</span>' : ''}
          </span>
          <span style="font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${subTitle}</span>
        </div>
      </div>
      <div class="player-points" style="color: #ff7300;">${escapedPoints} pts</div>
      <div class="player-stat">${escapedDisputed}</div>
      ${col5}
      ${col6}
      <div class="player-winrate ${winRateClass}">${winRate}%</div>
      <div class="player-action">
        <button type="button" title="${isTeam ? 'Ver equipe completa' : 'Ver perfil completo'}">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;

    row.addEventListener('click', () => {
      window.location.href = item.link;
    });

    tableContainer.appendChild(row);
  });
}

// ==============================================================================
// FILTRAGEM E BUSCA DINÂMICA
// ==============================================================================
function matchesSearch(item, rawTerm) {
  if (!rawTerm) return true;
  const term = normalizeText(rawTerm);
  if (!term) return true;

  const nome = normalizeText(item.nome);
  const email = normalizeText(item.email || '');
  const tag = normalizeText(item.tag || '');
  const leader = normalizeText(item.leaderName || '');
  const jogos = normalizeText(item.jogos || '');

  if (nome.includes(term) || email.includes(term) || tag.includes(term) || leader.includes(term) || jogos.includes(term)) {
    return true;
  }

  const words = term.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const combined = `${nome} ${email} ${tag} ${leader} ${jogos}`;
    return words.every(w => combined.includes(w));
  }

  return false;
}

function applySearchFilter(term) {
  const trimmed = (term || '').trim();

  if (trimmed === '') {
    if (podiumContainer) podiumContainer.style.display = 'flex';
    renderPodium(currentSortedList);
    renderTableList(currentSortedList, false);
  } else {
    const filtered = currentSortedList.filter(item => matchesSearch(item, trimmed));
    if (podiumContainer) podiumContainer.style.display = 'none';
    renderTableList(filtered, true);
  }
}

// ==============================================================================
// ALTERNÂNCIA DE ABAS: JOGADORES VS EQUIPES
// ==============================================================================
function updateTableHeader() {
  if (!tableHeaderRow) return;
  if (currentTab === 'jogadores') {
    tableHeaderRow.innerHTML = `
      <div>Rank</div>
      <div>Jogador</div>
      <div>Pontos</div>
      <div>Torneios</div>
      <div>Vitórias</div>
      <div>Derrotas</div>
      <div>Aprov.</div>
      <div>Perfil</div>
    `;
  } else {
    tableHeaderRow.innerHTML = `
      <div>Rank</div>
      <div>Equipe</div>
      <div>Pontos</div>
      <div>Torneios</div>
      <div>Títulos</div>
      <div>Líder</div>
      <div>Aprov.</div>
      <div>Ver Equipe</div>
    `;
  }
}

function switchTab(newTab) {
  if (currentTab === newTab) return;
  currentTab = newTab;

  if (tabJogadoresBtn && tabEquipesBtn) {
    if (currentTab === 'jogadores') {
      tabJogadoresBtn.classList.add('active');
      tabEquipesBtn.classList.remove('active');
      if (searchInput) searchInput.placeholder = 'Buscar player pelo nome ou tag...';
      currentSortedList = [...sortedPlayers];
    } else {
      tabEquipesBtn.classList.add('active');
      tabJogadoresBtn.classList.remove('active');
      if (searchInput) searchInput.placeholder = 'Buscar equipe por nome, tag ou líder...';
      currentSortedList = [...sortedTeams];
    }
  }

  updateTableHeader();
  const currentSearch = searchInput ? searchInput.value : '';
  applySearchFilter(currentSearch);
}

// ==============================================================================
// CONSULTA DIRETA DAS SQL VIEWS NO SUPABASE (vw_ranking_jogadores e vw_ranking_equipes)
// ==============================================================================
async function loadRealRankingData() {
  // 1. Recupera usuário logado
  try {
    const rawLogged = localStorage.getItem('vh_loggedUser');
    if (rawLogged) {
      currentLoggedUser = JSON.parse(rawLogged);
    }
  } catch (e) {}

  // 2. Consulta direta das SQL Views pré-computadas no Supabase
  try {
    const [resJogadores, resEquipes] = await Promise.all([
      supabase.from('vw_ranking_jogadores').select('*'),
      supabase.from('vw_ranking_equipes').select('*')
    ]);

    if (resJogadores.data && resJogadores.data.length > 0) {
      sortedPlayers = resJogadores.data.map(p => ({
        id: p.id,
        nome: p.nome || 'Jogador Sem Nome',
        email: p.email || '',
        avatar: resolvePlayerAvatar(p),
        tag: p.tag || '',
        link: p.link || `/perfil/perfil-publico.html?id=${encodeURIComponent(p.id || p.email)}`,
        points: parseInt(p.points, 10) || 0,
        winRate: p.win_rate !== undefined ? parseInt(p.win_rate, 10) : 0,
        stats: {
          disputed: parseInt(p.disputed, 10) || 0,
          won: parseInt(p.won, 10) || 0,
          wins: parseInt(p.wins, 10) || 0,
          losses: parseInt(p.losses, 10) || 0
        }
      }));
    } else {
      sortedPlayers = await fallbackJogadoresRanking();
    }

    if (resEquipes.data && resEquipes.data.length > 0) {
      sortedTeams = resEquipes.data.map(eq => ({
        id: eq.id,
        nome: eq.nome || 'Equipe',
        tag: eq.tag || '',
        logo: eq.logo || '/image/logo.png',
        jogos: eq.jogos || 'Multi-jogos',
        leaderName: eq.leaderName || 'Líder',
        leaderEmail: eq.leaderEmail || '',
        link: eq.link || `/equipes/template_equipe.html?id=${encodeURIComponent(eq.id)}`,
        points: parseInt(eq.points, 10) || 0,
        winRate: eq.win_rate !== undefined ? parseInt(eq.win_rate, 10) : 0,
        stats: {
          disputed: parseInt(eq.disputed, 10) || 0,
          won: parseInt(eq.won, 10) || 0,
          wins: parseInt(eq.wins, 10) || 0,
          losses: parseInt(eq.losses, 10) || 0
        }
      }));
    } else {
      sortedTeams = await fallbackEquipesRanking();
    }
  } catch (err) {
    console.warn('Consulta às SQL Views retornou aviso, acionando fallback estruturado:', err);
    sortedPlayers = await fallbackJogadoresRanking();
    sortedTeams = await fallbackEquipesRanking();
  }

  currentSortedList = currentTab === 'jogadores' ? [...sortedPlayers] : [...sortedTeams];
}

// ==============================================================================
// FALLBACKS ESTRUTURADOS (CASO AS VIEWS AINDA NÃO TENHAM SIDO CRIADAS NO BANCO)
// ==============================================================================
async function fallbackJogadoresRanking() {
  try {
    const { data: users } = await supabase
      .from('usuarios')
      .select('id, nome, email, avatar, stats');

    if (!users || !users.length) return [];

    const list = users.map(u => {
      const stats = u.stats || { disputed: 0, won: 0, wins: 0, losses: 0 };
      const disputed = parseInt(stats.disputed, 10) || 0;
      const won = parseInt(stats.won, 10) || 0;
      const wins = parseInt(stats.wins, 10) || 0;
      const losses = parseInt(stats.losses, 10) || 0;
      const points = Math.max(0, (won * 300) + (wins * 15) + (disputed * 5) - (losses * 2));
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : (disputed > 0 ? 100 : 0);

      return {
        id: u.id,
        nome: u.nome || 'Jogador Sem Nome',
        email: u.email || '',
        avatar: resolvePlayerAvatar(u),
        tag: '',
        link: `/perfil/perfil-publico.html?id=${encodeURIComponent(u.id || u.email)}`,
        points,
        winRate,
        stats: { disputed, won, wins, losses }
      };
    });

    list.sort((a, b) => b.points - a.points || b.stats.wins - a.stats.wins || (a.nome || '').localeCompare(b.nome || ''));
    return list;
  } catch (e) {
    return [];
  }
}

async function fallbackEquipesRanking() {
  try {
    const { data: equipes } = await supabase
      .from('equipes')
      .select('*');

    if (!equipes || !equipes.length) return [];

    const list = equipes.map(eq => {
      let ganhos = eq.torneiosGanhos;
      if (typeof ganhos === 'string') { try { ganhos = JSON.parse(ganhos); } catch { ganhos = []; } }
      const won = Array.isArray(ganhos) ? ganhos.length : 0;
      const disputed = Math.max(0, won);
      const wins = (won * 3);
      const losses = 0;
      const points = Math.max(0, (won * 300) + (wins * 15) + (disputed * 5));
      const winRate = won > 0 ? 100 : 0;

      return {
        id: eq.id,
        nome: eq.nome || 'Equipe',
        tag: eq.tag || '',
        logo: eq.logo || '/image/logo.png',
        jogos: eq.jogos || 'Multi-jogos',
        leaderName: eq.leaderName || 'Líder',
        leaderEmail: eq.leaderEmail || '',
        link: `/equipes/template_equipe.html?id=${encodeURIComponent(eq.id)}`,
        points,
        winRate,
        stats: { disputed, won, wins, losses }
      };
    });

    list.sort((a, b) => b.points - a.points || b.stats.won - a.stats.won || (a.nome || '').localeCompare(b.nome || ''));
    return list;
  } catch (e) {
    return [];
  }
}

// ==============================================================================
// INICIALIZAÇÃO DA PÁGINA
// ==============================================================================
async function initRanking() {
  podiumContainer = document.getElementById('podiumContainer');
  tableContainer  = document.getElementById('leaderboardTableBody');
  tableHeaderRow  = document.getElementById('leaderboardHeaderRow');
  searchInput     = document.getElementById('rankingSearch');
  tabJogadoresBtn = document.getElementById('tabJogadores');
  tabEquipesBtn   = document.getElementById('tabEquipes');

  if (tableContainer) {
    tableContainer.innerHTML = `
      <div class="ranking-no-results" style="color: #9cb1cf; padding: 32px 16px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: #ff7300; margin-bottom: 14px; display: block;"></i>
        Carregando Ranking...
      </div>
    `;
  }

  // Configura botões de alternância de abas
  if (tabJogadoresBtn) {
    tabJogadoresBtn.addEventListener('click', () => switchTab('jogadores'));
  }
  if (tabEquipesBtn) {
    tabEquipesBtn.addEventListener('click', () => switchTab('equipes'));
  }

  // Executa o carregamento das estatísticas diretas das views no banco
  await loadRealRankingData();

  // Configura ouvintes do input de pesquisa
  const handleSearchEvent = (val) => {
    applySearchFilter(val);
  };

  if (searchInput) {
    ['input', 'keyup', 'change', 'search'].forEach(evtType => {
      searchInput.addEventListener(evtType, () => handleSearchEvent(searchInput.value));
    });
  }

  // Trata parâmetros de URL caso haja busca prévia
  const urlParams = new URLSearchParams(window.location.search);
  const tipoParam = urlParams.get('tipo');
  if (tipoParam === 'equipes') {
    switchTab('equipes');
  } else {
    updateTableHeader();
  }

  const buscaUrl = urlParams.get('busca');
  const initialTerm = (searchInput && searchInput.value) ? searchInput.value : (buscaUrl || '');
  if (searchInput && initialTerm) {
    searchInput.value = initialTerm;
  }

  if (initialTerm) {
    applySearchFilter(initialTerm);
  } else {
    renderPodium(currentSortedList);
    renderTableList(currentSortedList, false);
  }
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRanking);
} else {
  initRanking();
}
