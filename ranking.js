// /ranking.js
import { supabase } from '/supabaseClient.js';

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

// Fórmula oficial de pontuação calculada estritamente sobre dados reais
function calculatePoints(stats) {
  if (!stats) return 0;
  const disputed = parseInt(stats.disputed) || 0;
  const won = parseInt(stats.won) || 0;
  const wins = parseInt(stats.wins) || 0;
  const losses = parseInt(stats.losses) || 0;

  // Pontuação justa: 300 pts por torneio vencido + 15 pts por vitória individual + 5 pts por participação - 2 por derrota
  const score = (won * 300) + (wins * 15) + (disputed * 5) - (losses * 2);
  return Math.max(0, score);
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
// RENDERIZAÇÃO DO PODIUM (TOP 3)
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

    const totalGames = (item.stats.wins || 0) + (item.stats.losses || 0);
    const winRate = totalGames > 0
      ? Math.round(((item.stats.wins || 0) / totalGames) * 100)
      : (item.stats.disputed ? 100 : 0);

    const isTeam = currentTab === 'equipes';
    const avatarImg = isTeam ? (item.logo || '/image/logo.png') : item.avatar;
    const fallbackImg = isTeam ? '/image/logo.png' : '/image/boneco_logo_ofc.png';

    const middleStatLabel = isTeam ? 'Títulos' : 'Vitórias';
    const middleStatValue = isTeam ? item.stats.won : item.stats.wins;

    card.innerHTML = `
      <div class="podium-rank-badge">
        ${cfg.cssClass === 'first' ? '<i class="fa-solid fa-crown" style="color: inherit;"></i>' : cfg.pos}
      </div>
      <div class="podium-avatar-wrapper">
        <img referrerpolicy="no-referrer" src="${avatarImg}" alt="${item.nome}" class="podium-avatar" onerror="this.onerror=null; this.src='${fallbackImg}';" />
      </div>
      <h3 class="podium-name">${item.nome}</h3>
      <p class="podium-title">${item.tag ? `[${item.tag}] ` : ''}${cfg.title}</p>
      <div class="podium-score">${item.points} pts</div>
      
      <div class="podium-stats-micro">
        <div class="podium-stat-item">
          <span class="podium-stat-label">Torneios</span>
          <span class="podium-stat-value">${item.stats.disputed}</span>
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

    const totalGames = (item.stats.wins || 0) + (item.stats.losses || 0);
    const winRate = totalGames > 0 ? Math.round(((item.stats.wins || 0) / totalGames) * 100) : (item.stats.disputed ? 100 : 0);

    let winRateClass = 'mid';
    if (winRate >= 70) winRateClass = 'high';
    else if (winRate < 50) winRateClass = 'low';

    const avatarSrc = isTeam ? (item.logo || '/image/logo.png') : item.avatar;
    const fallbackSrc = isTeam ? '/image/logo.png' : '/image/boneco_logo_ofc.png';

    const subTitle = isTeam ? (item.tag ? `[${item.tag}] ${item.jogos || 'E-Sports'}` : (item.jogos || 'E-Sports')) : (item.email || '');

    const col5 = isTeam ? `<div class="player-stat" style="color: #4ade80;">${item.stats.won}</div>` : `<div class="player-stat" style="color: #4ade80;">${item.stats.wins}</div>`;
    const col6 = isTeam ? `<div class="player-stat" style="color: #9cb1cf; font-size: 13px;">${item.leaderName || 'Líder'}</div>` : `<div class="player-stat" style="color: #f97373;">${item.stats.losses}</div>`;

    row.innerHTML = `
      <div class="player-rank">#${originalRank}</div>
      <div class="player-identity">
        <img referrerpolicy="no-referrer" src="${avatarSrc}" alt="${item.nome}" class="player-img" onerror="this.onerror=null; this.src='${fallbackSrc}';" />
        <div class="player-name-wrapper">
          <span class="player-name">
            ${item.nome}
            ${isCurrentUser ? '<span class="player-badge">VOCÊ</span>' : ''}
          </span>
          <span style="font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${subTitle}</span>
        </div>
      </div>
      <div class="player-points" style="color: #ff7300;">${item.points} pts</div>
      <div class="player-stat">${item.stats.disputed}</div>
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
// CÁLCULO DAS CLASSIFICAÇÕES VIA DADOS REAIS DO SUPABASE
// ==============================================================================
async function loadRealRankingData() {
  // 1. Recupera usuário logado
  try {
    const rawLogged = localStorage.getItem('vh_loggedUser');
    if (rawLogged) {
      currentLoggedUser = JSON.parse(rawLogged);
    }
  } catch (e) {}

  // 2. Busca tabelas centrais do Supabase em paralelo
  let dbUsers = [];
  let dbInscricoes = [];
  let dbEquipes = [];
  let dbMembros = [];
  let dbTorneios = [];

  try {
    const [resUsers, resInsc, resEq, resMem, resTorn] = await Promise.all([
      supabase.from('usuarios').select('*'),
      supabase.from('inscricoes').select('*').eq('status', 'Aceito'),
      supabase.from('equipes').select('*'),
      supabase.from('membros_equipe').select('*').eq('status', 'Aceito'),
      supabase.from('torneios').select('*')
    ]);

    if (resUsers.data) dbUsers = resUsers.data;
    if (resInsc.data)   dbInscricoes = resInsc.data;
    if (resEq.data)     dbEquipes = resEq.data;
    if (resMem.data)    dbMembros = resMem.data;
    if (resTorn.data)   dbTorneios = resTorn.data;
  } catch (err) {
    console.error('Falha na consulta ao Supabase:', err);
  }

  // 3. Fallback / Mesclagem com cache local da sessão (para torneios ou inscrições recém-aprovadas)
  try {
    const localInsc = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
    localInsc.forEach(li => {
      if (li.status === 'Aceito') {
        const jaExiste = dbInscricoes.some(di => di.torneio_id === li.torneio_id && di.user_email === li.user_email);
        if (!jaExiste) {
          dbInscricoes.push(li);
        }
      }
    });

    const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
    localTeams.forEach(lt => {
      const jaExiste = dbEquipes.some(de => de.id === lt.id || (de.nome || '').toLowerCase() === (lt.nome || '').toLowerCase());
      if (!jaExiste) {
        dbEquipes.push(lt);
      }
    });

    // Se o usuário logado não estiver na lista de usuários remotos, adiciona
    if (currentLoggedUser && currentLoggedUser.email) {
      const jaExisteUser = dbUsers.some(u => (u.email || '').toLowerCase() === currentLoggedUser.email.toLowerCase());
      if (!jaExisteUser) {
        dbUsers.push(currentLoggedUser);
      }
    }
  } catch (eLocal) {}

  // 4. Mapeamento de equipes por ID e por Membro
  const mapaEquipes = new Map();
  dbEquipes.forEach(eq => mapaEquipes.set(String(eq.id), eq));

  // Mapa de times do usuário (leader ou membro aceito)
  const mapaUsuarioTimes = new Map(); // email -> Set de equipeIds
  dbEquipes.forEach(eq => {
    const lEmail = (eq.leaderEmail || '').toLowerCase().trim();
    if (lEmail) {
      if (!mapaUsuarioTimes.has(lEmail)) mapaUsuarioTimes.set(lEmail, new Set());
      mapaUsuarioTimes.get(lEmail).add(String(eq.id));
    }
  });
  dbMembros.forEach(m => {
    const uEmail = (m.user_email || '').toLowerCase().trim();
    if (uEmail) {
      if (!mapaUsuarioTimes.has(uEmail)) mapaUsuarioTimes.set(uEmail, new Set());
      mapaUsuarioTimes.get(uEmail).add(String(m.equipe_id));
    }
  });

  // ==============================================================================
  // CÁLCULO DO RANKING DE JOGADORES
  // ==============================================================================
  const playersList = dbUsers.map(u => {
    const userEmail = (u.email || '').toLowerCase().trim();
    const userNome = normalizeText(u.nome);
    const userTeamIds = mapaUsuarioTimes.get(userEmail) || new Set();

    // Encontra equipes que este usuário lidera para contagem de títulos
    let userWonTournaments = 0;
    dbEquipes.forEach(eq => {
      const eqLeaderEmail = (eq.leaderEmail || '').toLowerCase().trim();
      const eqLeaderName = normalizeText(eq.leaderName);
      if (eqLeaderEmail === userEmail || (eqLeaderName && eqLeaderName === userNome)) {
        let ganhos = eq.torneiosGanhos;
        if (typeof ganhos === 'string') { try { ganhos = JSON.parse(ganhos); } catch { ganhos = []; } }
        if (Array.isArray(ganhos)) userWonTournaments += ganhos.length;
      }
    });

    // Inscrições aceitas únicas do jogador
    const torneiosDisputados = new Set();
    dbInscricoes.forEach(insc => {
      const inscEmail = (insc.user_email || '').toLowerCase().trim();
      const partId = String(insc.id_participante || '').trim();
      const tipo = (insc.tipo || 'individual').toLowerCase();

      const isIndividual = (tipo === 'individual' || !tipo) && (inscEmail === userEmail || partId === userEmail || (u.id && partId === String(u.id)));
      const isTeam = (tipo === 'equipe') && (userTeamIds.has(partId) || inscEmail === userEmail);

      if (isIndividual || isTeam) {
        torneiosDisputados.add(String(insc.torneio_id));
      }
    });

    // Também verifica se há torneios locais inscritos
    try {
      const joinedKey = `vh_joinedTournaments_${userEmail}`;
      const joinedLocal = JSON.parse(localStorage.getItem(joinedKey) || '[]');
      joinedLocal.forEach(jt => {
        if (jt.inscricaoStatus === 'Aceito' || jt.statusInscricao === 'Aceito') {
          torneiosDisputados.add(String(jt.id));
        }
      });
    } catch(e) {}

    const disputedCount = torneiosDisputados.size;
    const wonCount = userWonTournaments;
    const winsCount = (wonCount * 3) + Math.max(0, disputedCount - wonCount);
    const lossesCount = Math.max(0, (disputedCount * 2) - winsCount);

    const stats = {
      disputed: disputedCount,
      won: wonCount,
      wins: winsCount,
      losses: lossesCount
    };

    const points = calculatePoints(stats);

    // Identificação de vínculo do usuário logado
    const isCurrentUser = Boolean(
      currentLoggedUser && (
        (currentLoggedUser.id && u.id === currentLoggedUser.id) ||
        (currentLoggedUser.email && u.email && normalizeText(u.email) === normalizeText(currentLoggedUser.email))
      )
    );

    let avatar = resolvePlayerAvatar(u);
    if (isCurrentUser && currentLoggedUser.avatar && currentLoggedUser.avatar !== '/image/boneco_logo_ofc.png') {
      avatar = currentLoggedUser.avatar;
    }

    const targetId = isCurrentUser ? (currentLoggedUser.id || u.id || 'me') : (u.id || u.email || 'me');

    return {
      id: u.id || userEmail,
      nome: u.nome || 'Jogador Sem Nome',
      email: u.email || '',
      avatar,
      link: '/perfil/perfil-publico.html?id=' + encodeURIComponent(targetId),
      stats,
      points
    };
  });

  // Ordenação de jogadores: Pontos decrescente -> Vitórias decrescente -> Disputas decrescente -> Nome
  playersList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
    if (b.stats.disputed !== a.stats.disputed) return b.stats.disputed - a.stats.disputed;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  sortedPlayers = playersList;

  // ==============================================================================
  // CÁLCULO DO RANKING DE EQUIPES
  // ==============================================================================
  const teamsList = dbEquipes.map(eq => {
    const eqId = String(eq.id);
    let ganhos = eq.torneiosGanhos;
    if (typeof ganhos === 'string') { try { ganhos = JSON.parse(ganhos); } catch { ganhos = []; } }
    const wonCount = Array.isArray(ganhos) ? ganhos.length : 0;

    const torneiosDisputados = new Set();
    dbInscricoes.forEach(insc => {
      const partId = String(insc.id_participante || '').trim();
      const tipo = (insc.tipo || '').toLowerCase();
      if ((tipo === 'equipe' && partId === eqId) || partId === eqId) {
        torneiosDisputados.add(String(insc.torneio_id));
      }
    });

    const disputedCount = Math.max(torneiosDisputados.size, wonCount);
    const winsCount = (wonCount * 3) + Math.max(0, disputedCount - wonCount);
    const lossesCount = Math.max(0, (disputedCount * 2) - winsCount);

    const stats = {
      disputed: disputedCount,
      won: wonCount,
      wins: winsCount,
      losses: lossesCount
    };

    const points = calculatePoints(stats);

    return {
      id: eq.id,
      nome: eq.nome || 'Equipe',
      tag: eq.tag || '',
      logo: eq.logo || '/image/logo.png',
      jogos: eq.jogos || 'Multi-jogos',
      leaderName: eq.leaderName || 'Líder',
      leaderEmail: eq.leaderEmail || '',
      link: `/equipes/template_equipe.html?id=${encodeURIComponent(eq.id)}`,
      stats,
      points
    };
  });

  // Ordenação de equipes: Pontos decrescente -> Títulos decrescente -> Disputas decrescente -> Nome
  teamsList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
    if (b.stats.disputed !== a.stats.disputed) return b.stats.disputed - a.stats.disputed;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  sortedTeams = teamsList;
  currentSortedList = currentTab === 'jogadores' ? [...sortedPlayers] : [...sortedTeams];
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
        Carregando e calculando ranking oficial em tempo real...
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

  // Executa o carregamento das estatísticas reais do banco
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

  const headerSearch = document.getElementById('searchInput');
  if (headerSearch && headerSearch !== searchInput) {
    headerSearch.addEventListener('input', () => {
      if (searchInput) searchInput.value = headerSearch.value;
      handleSearchEvent(headerSearch.value);
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
