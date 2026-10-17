// /perfil/js/perfil-publico.js
import { supabase } from '/supabaseClient.js';

function safeNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}











// Exibe mensagem amigavel caso o ID seja invalido ou o jogador nao seja encontrado
function showNotFound() {
  const notFoundEl = document.getElementById('playerNotFound');
  const containerEl = document.getElementById('profileContainer');
  if (notFoundEl) notFoundEl.style.display = 'block';
  if (containerEl) containerEl.style.display = 'none';
  document.title = 'Jogador não encontrado - VersusHub';
}

// Preenche a interface com os dados retornados do Supabase
async function renderPublicProfile(userData) {
  const notFoundEl = document.getElementById('playerNotFound');
  const containerEl = document.getElementById('profileContainer');
  if (notFoundEl) notFoundEl.style.display = 'none';
  if (containerEl) containerEl.style.display = 'block';

  // Titulo da pagina
  const nomeExibicao = userData.nome || 'Jogador Sem Nome';
  document.title = `${nomeExibicao} - Perfil Público | VersusHub`;

  // 1. Dados basicos (nome, bio, avatar, banner, regiao, plataformas)
  const profileName = document.getElementById('profileName');
  if (profileName) profileName.textContent = nomeExibicao;

  const bioText = document.getElementById('bioText');
  if (bioText) bioText.textContent = userData.bio || 'Este jogador ainda não adicionou uma biografia.';

  let resolvedAvatar = (userData.avatar || '').trim();
  // Limpa quaisquer imagens residuais inválidas
  if (resolvedAvatar.includes('microsoft.png') || resolvedAvatar.includes('pngtree-avatar-icon')) {
    resolvedAvatar = '';
  }

  if (!resolvedAvatar) {
    resolvedAvatar = '/image/boneco_logo_ofc.png';
  }

  const avatarEl = document.getElementById('profileAvatarImg');
  if (avatarEl) {
    avatarEl.src = resolvedAvatar;
    avatarEl.onerror = () => { avatarEl.src = '/image/boneco_logo_ofc.png'; };
  }

  const bannerEl = document.getElementById('profileBannerImg');
  if (bannerEl) bannerEl.src = userData.banner || '/images/torneio_csgo2.webp';

  const metaRegion = document.getElementById('metaRegion');
  if (metaRegion) metaRegion.textContent = userData.regiao || 'Brasil';

  // Plataformas
  let plataformas = userData.plataformas;
  if (typeof plataformas === 'string') {
    try {
      plataformas = JSON.parse(plataformas);
    } catch {
      plataformas = [plataformas];
    }
  }
  if (!Array.isArray(plataformas) || plataformas.length === 0) {
    plataformas = ['PC'];
  }
  const metaPlatforms = document.getElementById('metaPlatforms');
  if (metaPlatforms) metaPlatforms.textContent = plataformas.join(' • ');

  // 2. Estatísticas unificadas extraídas diretamente de public.usuarios
  let rawStats = userData.stats || {};
  if (typeof rawStats === 'string') {
    try { rawStats = JSON.parse(rawStats); } catch { rawStats = {}; }
  }

  

  const pontos = safeNum(rawStats.points ?? userData.pontos ?? userData.pontuacao_total ?? 0);
  const vitorias = safeNum(rawStats.wins ?? userData.vitorias ?? 0);
  const derrotas = safeNum(rawStats.losses ?? userData.derrotas ?? 0);
  const torneiosDisputados = safeNum(rawStats.disputed ?? userData.torneios_disputados ?? 0);
  const primeiroLugar = safeNum(rawStats.won ?? userData.primeiro_lugar ?? 0);

  const total = vitorias + derrotas;
  const winRate = total > 0 ? Math.round((vitorias / total) * 100) : 0;

  const stats = {
    points: pontos,
    disputed: torneiosDisputados,
    won: primeiroLugar,
    wins: vitorias,
    losses: derrotas,
    winRate: winRate
  };

  const statPontos = document.getElementById('statPontos');
  if (statPontos) statPontos.textContent = `${pontos.toLocaleString('pt-BR')} pts`;

  const statDisputados = document.getElementById('statDisputados');
  if (statDisputados) statDisputados.textContent = stats.disputed;

  const statVencidos = document.getElementById('statVencidos');
  if (statVencidos) statVencidos.textContent = stats.won;

  const statWins = document.getElementById('statWins');
  if (statWins) statWins.textContent = stats.wins;

  const statLosses = document.getElementById('statLosses');
  if (statLosses) statLosses.textContent = stats.losses;

  const statWinRateText = document.getElementById('statWinRateText');
  if (statWinRateText) statWinRateText.textContent = `${winRate}%`;

  const winRateCircularNumber = document.getElementById('winRateCircularNumber');
  if (winRateCircularNumber) winRateCircularNumber.textContent = `${winRate}%`;

  const feedEl = document.getElementById('statFeedback');
  if (feedEl) {
    if (winRate >= 75) {
      feedEl.innerHTML = '<i class="fa-solid fa-crown" style="color: #4ade80; margin-right: 6px;"></i> Desempenho de Nível Mundial (Tier S)';
      feedEl.style.color = '#4ade80';
    } else if (winRate >= 60) {
      feedEl.innerHTML = '<i class="fa-solid fa-fire-flame-curved" style="color: #facc15; margin-right: 6px;"></i> Combatente de Elite (Alta Elite)';
      feedEl.style.color = '#facc15';
    } else {
      feedEl.innerHTML = '<i class="fa-solid fa-crosshairs" style="color: #9cb1cf; margin-right: 6px;"></i> Lutador Persistente (Evoluindo)';
      feedEl.style.color = '#9cb1cf';
    }
  }

  const winsPercent = total > 0 ? (vitorias / total) * 100 : 50;
  const lossesPercent = total > 0 ? (derrotas / total) * 100 : 50;
  const barWins = document.getElementById('combatBarWins');
  const barLosses = document.getElementById('combatBarLosses');
  if (barWins) barWins.style.width = winsPercent + '%';
  if (barLosses) barLosses.style.width = lossesPercent + '%';

  const circleProgress = document.getElementById('winRateCircleProgress');
  if (circleProgress) {
    const strokeOffset = 188.4 - (188.4 * winsPercent) / 100;
    circleProgress.style.strokeDashoffset = strokeOffset;
  }

    // 3. Jogos favoritos
  let jogos = userData.jogosFavoritos;
  if (typeof jogos === 'string') {
    try {
      jogos = JSON.parse(jogos);
    } catch {
      jogos = [];
    }
  }
  if (!Array.isArray(jogos)) jogos = [];

  const gamesContainer = document.getElementById('gamesListPublic');
  if (gamesContainer) {
    gamesContainer.innerHTML = '';
    if (jogos.length > 0) {
      jogos.forEach(game => {
        const badge = document.createElement('div');
        badge.className = 'game-badge-public';
        badge.innerHTML = `
          <i class="fa-solid fa-fire-flame-simple"></i>
          <span>${game}</span>
        `;
        gamesContainer.appendChild(badge);
      });
    } else {
      gamesContainer.innerHTML = '<span style="font-size: 13px; color: #9ca3af;">Nenhum jogo listado na coleção de favoritos.</span>';
    }
  }

  // 4. Equipes do jogador
  const teamsContainer = document.getElementById('teamsPublicGrid');
  if (teamsContainer) {
    teamsContainer.innerHTML = '';
    let userTeams = [];
    if (Array.isArray(userData.teams)) {
      userTeams = [...userData.teams];
    }
    // Equipes lideradas ou aceitas no Supabase
    try {
      const userEmail = (userData.email || '').toLowerCase().trim();
      const userNome = (userData.nome || '').toLowerCase().trim();

      // Equipes lideradas no banco
      const { data: leaderTeams } = await supabase
        .from('equipes')
        .select('id, nome, sobre, logo')
        .or(`leaderEmail.eq.${userEmail},leaderName.eq.${userData.nome}`);

      if (leaderTeams) {
        leaderTeams.forEach(team => {
          const jaExiste = userTeams.some(t => (t.nome || '').toLowerCase() === (team.nome || '').toLowerCase());
          if (!jaExiste) {
            userTeams.push({
              nome: team.nome,
              desc: team.sobre || 'Equipe ativa na VersusHub',
              role: 'Líder fundador',
              logo: team.logo || '/image/logo.png',
              link: `/equipes/template_equipe.html?id=${team.id}`
            });
          }
        });
      }

      // Equipes como membro aceito
      if (userEmail) {
        const { data: mems } = await supabase
          .from('membros_equipe')
          .select('equipe_id')
          .eq('user_email', userEmail)
          .eq('status', 'Aceito');

        if (mems && mems.length > 0) {
          const tIds = mems.map(m => m.equipe_id).filter(Boolean);
          const { data: dbEqs } = await supabase
            .from('equipes')
            .select('id, nome, sobre, logo')
            .in('id', tIds);

          if (dbEqs) {
            dbEqs.forEach(eq => {
              const jaExiste = userTeams.some(t => (t.nome || '').toLowerCase() === (eq.nome || '').toLowerCase());
              if (!jaExiste) {
                userTeams.push({
                  nome: eq.nome,
                  desc: eq.sobre || 'Membro oficial da equipe',
                  role: 'Membro',
                  logo: eq.logo || '/image/logo.png',
                  link: `/equipes/template_equipe.html?id=${eq.id}`
                });
              }
            });
          }
        }
      }
    } catch (dbErr) {
    }

    try {
      const rawTeams = localStorage.getItem('vh_createdTeams');
      if (rawTeams) {
        const allCreated = JSON.parse(rawTeams);
        allCreated.forEach(team => {
          const isLider = (team.leaderName || '').toLowerCase() === (userData.nome || '').toLowerCase() ||
                          (team.leaderEmail && userData.email && team.leaderEmail.toLowerCase() === userData.email.toLowerCase());
          const jaExiste = userTeams.some(t => (t.nome || '').toLowerCase() === (team.nome || '').toLowerCase());
          if (isLider && !jaExiste) {
            userTeams.push({
              nome: team.nome,
              desc: team.sobre || 'Equipe ativa na VersusHub',
              role: 'Líder fundador',
              logo: team.logo || '/image/logo.png',
              link: `/equipes/template_equipe.html?id=${team.id}`
            });
          }
        });
      }
    } catch (err) {
    }

    if (userTeams.length > 0) {
      userTeams.forEach(t => {
        const card = document.createElement('div');
        card.className = 'team-badge-card';
        card.innerHTML = `
          <div class="team-badge-left">
            <div class="team-logo-wrapper">
              <img referrerpolicy="no-referrer" src="${t.logo || '/image/logo.png'}" alt="${t.nome}">
            </div>
            <div class="team-logo-text">
              <a href="${t.link || '#'}" style="text-decoration: none; color: inherit;">
                <h4>${t.nome}</h4>
                <p>${t.desc || ''}</p>
              </a>
            </div>
          </div>
          <div class="team-status-role">
            <i class="fa-solid fa-ranking-star"></i> ${t.role || 'Membro'}
          </div>
        `;
        teamsContainer.appendChild(card);
      });
    } else {
      teamsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; background: #111116; border: 1px solid #2a2a38; border-radius: 14px; padding: 36px 20px; text-align: center; color: #9ca3af;">
          <i class="fa-solid fa-users-slash" style="font-size: 32px; color: #4b5563; margin-bottom: 12px; display: block;"></i>
          <h4 style="color: #ffffff; margin: 0 0 6px; font-size: 15px;">Jogador Solo</h4>
          <p style="margin: 0; font-size: 13px;">Este jogador ainda não está associado a nenhuma equipe registrada.</p>
        </div>
      `;
    }

    const publicTeamsCountBadge = document.getElementById('publicTeamsCountBadge');
    if (publicTeamsCountBadge) {
      publicTeamsCountBadge.textContent = String(userTeams.length);
    }
  }

  // 5. Pontuação Global e Ranking do Usuário
  await updatePublicUserRankingDisplay(userData, stats);

  // 5.5 Torneios Criados pelo Jogador / Organizador
  const tournamentsGrid = document.getElementById('publicTournamentsGrid');
  const countBadge = document.getElementById('publicTournamentsCountBadge');
  if (tournamentsGrid) {
    try {
      const userEmail = (userData.email || '').toLowerCase().trim();
      let createdTournaments = [];
      if (userEmail) {
        const { data, error } = await supabase
          .from('torneios')
          .select('id, nome, jogo, status, statusClass, data, banner, vagas, tipo, modalidade, formato, regras, organizador_id, criadorEmail, criador_email, created_at')
          .ilike('criadorEmail', userEmail)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          createdTournaments = data;
        }
      }

      if (countBadge) {
        countBadge.textContent = String(createdTournaments.length);
      }

      if (createdTournaments.length === 0) {
        tournamentsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; background: #111116; border: 1px solid #2a2a38; border-radius: 14px; padding: 36px 20px; text-align: center; color: #9ca3af;">
            <i class="fa-solid fa-trophy" style="font-size: 32px; color: #4b5563; margin-bottom: 12px; display: block;"></i>
            <h4 style="color: #ffffff; margin: 0 0 6px; font-size: 15px;">Nenhum torneio criado ainda</h4>
            <p style="margin: 0; font-size: 13px;">Este jogador ainda não organizou nenhum campeonato público no VersusHub.</p>
          </div>
        `;
      } else {
        tournamentsGrid.innerHTML = createdTournaments.map(t => {
          const isLive = t.ao_vivo === true || (t.status && t.status.toLowerCase().includes('vivo'));
          let statusBadgeClass = t.statusClass || 'status-aberto';
          let statusText = t.status || 'Inscrições abertas';
          if (isLive) {
            statusBadgeClass = 'status-andamento';
            statusText = '<i class="fa-solid fa-tower-broadcast"></i> Ao Vivo';
          }
          const link = t.link || ('/torneio/custom.html?id=' + encodeURIComponent(t.id));
          return `
            <article class="card-torneio-publico">
              <div class="card-torneio-publico-banner">
                <img referrerpolicy="no-referrer" src="${t.banner || '/images/cerradocup.jpg'}" alt="${t.nome || ''}" onerror="this.src='/images/cerradocup.jpg'">
                <span class="card-torneio-publico-badge ${statusBadgeClass}">${statusText}</span>
              </div>
              <div class="card-torneio-publico-info">
                <h3 class="card-torneio-publico-title">${t.nome || 'Torneio'}</h3>
                <div class="card-torneio-publico-meta">
                  <span><i class="fa-solid fa-gamepad"></i> ${t.jogo || 'Competitivo'}</span>
                  <span><i class="fa-regular fa-calendar"></i> ${t.data || 'A definir'}</span>
                </div>
                <a href="${link}" class="btn-card-torneio-publico">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Detalhes
                </a>
              </div>
            </article>
          `;
        }).join('');
      }
    } catch (errTorn) {
    }
  }

  // 5.6 Controle de Abas no Perfil Público: "Torneios do Jogador" e "Equipes do Jogador"
  setupPublicTabs();

  // 6. Assegura perfil estritamente Somente Leitura (remove eventuais botoes de edicao legados)
  document.querySelectorAll('.edit-btn, .btn-salvar, #btnSaveProfile, #inputPhoto, .change-photo-btn, .change-banner-btn').forEach(el => {
    el.remove();
  });

  // 7. Se for o próprio perfil do usuário logado, adiciona botão de ação "Editar Meu Perfil"
  const rawLogged = localStorage.getItem('vh_loggedUser');
  let loggedUser = null;
  if (rawLogged) {
    try { loggedUser = JSON.parse(rawLogged); } catch(e) {}
  }
  const isOwner = Boolean(
    loggedUser && (
      (userData.id && loggedUser.id && userData.id === loggedUser.id) ||
      (userData.email && loggedUser.email && userData.email.toLowerCase() === loggedUser.email.toLowerCase()) ||
      (userData.nome && loggedUser.nome && normalizeText(userData.nome) === normalizeText(loggedUser.nome))
    )
  );

  let ownerActions = document.getElementById('ownerActions');
  if (!ownerActions) {
    ownerActions = document.createElement('div');
    ownerActions.id = 'ownerActions';
    ownerActions.style.marginTop = '14px';
    const summaryEl = document.querySelector('.profile-user-summary');
    if (summaryEl) summaryEl.appendChild(ownerActions);
  }

  if (isOwner && ownerActions) {
    ownerActions.style.display = 'block';
    ownerActions.innerHTML = `
      <a href="/perfil/perfil.html" id="btnEditarMeuPerfil" style="display: inline-flex; align-items: center; gap: 8px; background: #d41111; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; box-shadow: 0 4px 14px rgba(212, 17, 17, 0.45); transition: transform 0.15s, background 0.15s;">
        <i class="fa-solid fa-pen-to-square"></i> Editar Meu Perfil
      </a>
    `;
  } else if (ownerActions) {
    ownerActions.style.display = 'none';
  }
}

// Gerencia as abas públicas: "Torneios do Jogador" e "Equipes do Jogador"
function setupPublicTabs() {
  const publicTabBtns = document.querySelectorAll('.public-tab-btn');
  const publicTabPanels = document.querySelectorAll('.public-tab-panel');

  publicTabBtns.forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-target');
      if (!targetId) return;

      publicTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      publicTabPanels.forEach(p => {
        if (p.id === targetId) {
          p.style.display = 'block';
        } else {
          p.style.display = 'none';
        }
      });
    };
  });
}

function isUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((str || '').trim());
}



// Localizador resiliente de usuários (por UUID, e-mail, nome, slug ou usuário logado)
async function fetchUserProfile(idParam) {
  const rawLogged = localStorage.getItem('vh_loggedUser');
  let loggedUser = null;
  if (rawLogged) {
    try { loggedUser = JSON.parse(rawLogged); } catch(e) {}
  }
  const cleanId = (idParam || '').trim();
  const SAFE_COLS = '*';

  // 1. Se nenhum ID foi passado ou for "me", carrega o usuário logado
  if (!cleanId || cleanId.toLowerCase() === 'me' || cleanId.toLowerCase() === 'meu-perfil') {
    if (loggedUser) {
      if (loggedUser.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loggedUser.id)) {
        try {
          const { data } = await supabase.from('usuarios').select(SAFE_COLS).eq('id', loggedUser.id).maybeSingle();
          if (data) return { ...loggedUser, ...data };
        } catch (e) {}
      }
      if (loggedUser.email) {
        try {
          const { data } = await supabase.from('usuarios').select(SAFE_COLS).ilike('email', loggedUser.email).maybeSingle();
          if (data) return { ...loggedUser, ...data };
        } catch (e) {}
      }
      return loggedUser;
    }
    return null;
  }

  // 2. Se for o próprio usuário logado (por id, email ou nome)
  if (loggedUser) {
    const matchesLogged = (
      (loggedUser.id && loggedUser.id === cleanId) ||
      (loggedUser.email && loggedUser.email.toLowerCase() === cleanId.toLowerCase()) ||
      (loggedUser.nome && normalizeText(loggedUser.nome) === normalizeText(cleanId))
    );
    if (matchesLogged) {
      if (loggedUser.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loggedUser.id)) {
        try {
          const { data } = await supabase.from('usuarios').select(SAFE_COLS).eq('id', loggedUser.id).maybeSingle();
          if (data) return { ...loggedUser, ...data };
        } catch (e) {}
      }
      if (loggedUser.email) {
        try {
          const { data } = await supabase.from('usuarios').select(SAFE_COLS).ilike('email', loggedUser.email).maybeSingle();
          if (data) return { ...loggedUser, ...data };
        } catch (e) {}
      }
      return loggedUser;
    }
  }

  // 3. Se contiver '@', faz busca por e-mail no Supabase via .ilike('email', cleanId)
  if (cleanId.includes('@')) {
    try {
      const { data, error } = await supabase.from('usuarios').select(SAFE_COLS).ilike('email', cleanId).maybeSingle();
      if (data && !error) return data;
    } catch (err) {
    }
  } else {
    // 4. Se NÃO contiver '@', faz busca por ID via .eq('id', cleanId) protegida por try/catch
    try {
      const { data, error } = await supabase.from('usuarios').select(SAFE_COLS).eq('id', cleanId).maybeSingle();
      if (data && !error) return data;
    } catch (err) {
    }
  }

  // 5. Busca de fallback por nome/nickname com try/catch
  try {
    const cleanName = cleanId.replace(/\[.*?\]/g, '').trim();
    const { data: userByNome } = await supabase
      .from('usuarios')
      .select(SAFE_COLS)
      .ilike('nome', `%${cleanName}%`)
      .maybeSingle();
    if (userByNome) return userByNome;
  } catch (e) {
  }

  // 6. Fallback final para usuário logado se os identificadores coincidirem
  if (loggedUser && (cleanId.startsWith('user-') || cleanId === loggedUser.id || (loggedUser.email && cleanId.toLowerCase() === loggedUser.email.toLowerCase()))) {
    return loggedUser;
  }

  return null;
}

// Atualiza os badges e cards de Pontuação Global e Ranking
async function updateUserRankingDisplay(userData, stats = {}) {
  const headerPointsText = document.getElementById('headerPointsText');
  const headerRankPosition = document.getElementById('headerRankPosition');
  const statPontos = document.getElementById('statPontos') || document.getElementById('statsPontosVal');
  const statRankPosText = document.getElementById('statRankPosText');
  const statsRankPosValText = document.getElementById('statsRankPosValText') || statRankPosText;

  const userEmail = (userData.email || '').toLowerCase().trim();
  const userId = String(userData.id || '').trim();
  const userName = (userData.nome || '').toLowerCase().trim();

  let computedPoints = 0;
  let rankPositionText = '#-- no Ranking';

  try {
    // 1. Consulta da tabela 'usuarios' selecionando APENAS colunas existentes no Supabase
    const { data: dbUsers } = await supabase
      .from('usuarios')
      .select('id, email, nome, stats');

    let rankingList = [];
    if (dbUsers && Array.isArray(dbUsers)) {
      rankingList = dbUsers.map(u => {
        let s = u.stats || {};
        if (typeof s === 'string') {
          try { s = JSON.parse(s); } catch { s = {}; }
        }
        const uPts = safeNum(s.points ?? s.pontos ?? 0);
        const uWins = safeNum(s.wins ?? s.vitorias ?? 0);

        return {
          id: String(u.id || '').trim(),
          email: (u.email || '').toLowerCase().trim(),
          nome: (u.nome || '').trim(),
          pontos: uPts,
          vitorias: uWins
        };
      });
    }

    // Identifica dados do usuário atual
    let rawStats = userData.stats || stats || {};
    if (typeof rawStats === 'string') {
      try { rawStats = JSON.parse(rawStats); } catch { rawStats = {}; }
    }
    computedPoints = safeNum(rawStats.points ?? rawStats.pontos ?? 0);
    const userWins = safeNum(rawStats.wins ?? rawStats.vitorias ?? 0);

    const jaExiste = rankingList.some(item =>
      (userId && item.id === userId) ||
      (userEmail && item.email === userEmail) ||
      (userName && item.nome.toLowerCase() === userName)
    );
    if (!jaExiste) {
      rankingList.push({
        id: userId,
        email: userEmail,
        nome: userData.nome || userName,
        pontos: computedPoints,
        vitorias: userWins
      });
    }

    // Realize a ordenação por pontos e vitórias:
    rankingList.sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || a.nome.localeCompare(b.nome));

    // Calcule a posição real do usuário na lista ordenada (index + 1)
    const foundIdx = rankingList.findIndex(item => 
      (userId && item.id === userId) ||
      (userEmail && item.email === userEmail) ||
      (userName && item.nome.toLowerCase() === userName)
    );

    if (foundIdx !== -1) {
      computedPoints = rankingList[foundIdx].pontos;
      rankPositionText = `#${foundIdx + 1} no Ranking`;
    } else {
      rankPositionText = rankingList.length > 0 ? `#${rankingList.length + 1} no Ranking` : '#1 no Ranking';
    }
  } catch (err) {
    console.warn("Aviso ao calcular ranking no perfil público:", err);
    let rawStats = userData.stats || stats || {};
    if (typeof rawStats === 'string') {
      try { rawStats = JSON.parse(rawStats); } catch { rawStats = {}; }
    }
    computedPoints = safeNum(rawStats.points ?? rawStats.pontos ?? 0);
    rankPositionText = '#1 no Ranking';
  }

  const formattedPts = `${computedPoints.toLocaleString('pt-BR')} pts`;

  if (headerPointsText) headerPointsText.textContent = formattedPts;
  if (headerRankPosition) headerRankPosition.textContent = rankPositionText;
  if (statPontos) statPontos.textContent = formattedPts;
  if (statRankPosText) statRankPosText.textContent = rankPositionText;
  if (statsRankPosValText) statsRankPosValText.textContent = rankPositionText;
}

// Compatibilidade entre chamadas de função
const updatePublicUserRankingDisplay = updateUserRankingDisplay;
if (typeof window !== 'undefined') {
  window.updateUserRankingDisplay = updateUserRankingDisplay;
  window.updatePublicUserRankingDisplay = updatePublicUserRankingDisplay;
}

// Inicialização assíncrona consumindo o Supabase e suporte a múltiplos identificadores
async function initPublicProfile() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || params.get('email') || params.get('user');

  try {
    const userData = await fetchUserProfile(id);

    if (!userData) {
      showNotFound();
      return;
    }

    await renderPublicProfile(userData);
    await carregarTorneiosFavoritosPublico(userData);
    await configurarConviteEquipe(userData);
  } catch (err) {
    showNotFound();
  }
}

// Dispara quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicProfile);
} else {
  initPublicProfile();
}

// ==========================================
// SISTEMA DE CONVITE PARA EQUIPE NO PERFIL PÚBLICO
// ==========================================
async function configurarConviteEquipe(userData) {
  const actionsContainer = document.getElementById('profileHeaderActions');
  if (!actionsContainer || !userData) return;

  // 1. Obter usuário logado
  let loggedUser = null;
  const raw = localStorage.getItem('vh_loggedUser');
  if (raw) {
    try { loggedUser = JSON.parse(raw); } catch (e) {}
  }
  if (!loggedUser || !loggedUser.email) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        loggedUser = { email: session.user.email, nome: session.user.user_metadata?.nome || '' };
      }
    } catch (e) {}
  }

  if (!loggedUser || !loggedUser.email) return;

  const loggedEmail = (loggedUser.email || '').trim().toLowerCase();
  const visitedEmail = (userData.email || '').trim().toLowerCase();

  // Não exibe convite para o próprio perfil
  if (!visitedEmail || loggedEmail === visitedEmail) return;

  try {
    // 2. Consulta equipes onde o usuário logado é líder
    const { data: equipesLideradas, error: eqErr } = await supabase
      .from('equipes')
      .select('id, nome, tag, logo, limite, leaderEmail')
      .ilike('leaderEmail', loggedEmail);

    if (eqErr || !equipesLideradas || equipesLideradas.length === 0) return;

    actionsContainer.style.display = 'flex';
    actionsContainer.innerHTML = `
      <button id="btnConvidarEquipe" type="button" class="btn-convidar-equipe" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border: 1px solid #34d399; color: #ffffff; padding: 10px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4);">
        <i class="fa-solid fa-user-plus"></i> Convidar para Equipe
      </button>
    `;

    const btn = document.getElementById('btnConvidarEquipe');
    btn.addEventListener('click', () => {
      abrirModalConviteEquipe(userData, equipesLideradas);
    });
  } catch (err) {
    console.error('Erro ao verificar equipes do líder:', err);
  }
}

function abrirModalConviteEquipe(userData, equipes) {
  let modal = document.getElementById('modalConviteEquipe');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalConviteEquipe';
    modal.className = 'modal-convite-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
    document.body.appendChild(modal);
  }

  const visitedEmail = (userData.email || '').trim().toLowerCase();
  const visitedName = userData.nome || visitedEmail;

  modal.innerHTML = `
    <div style="background: #111118; border: 1px solid #28283a; border-radius: 18px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 16px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column;">
      <div style="padding: 18px 24px; border-bottom: 1px solid #232332; display: flex; justify-content: space-between; align-items: center; background: #161622; border-radius: 18px 18px 0 0;">
        <h3 style="margin: 0; color: #ffffff; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-user-plus" style="color: #10b981;"></i> Convidar para Equipe
        </h3>
        <button type="button" id="btnFecharModalConviteEquipe" style="background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 4px;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="padding: 24px;">
        <p style="color: #9ca3af; font-size: 14px; margin-top: 0; margin-bottom: 18px; line-height: 1.5;">
          Selecione a equipe para a qual deseja convidar <strong style="color: #ffffff;">${escapeHtml(visitedName)}</strong>:
        </p>
        <div id="listaEquipesConvite" style="display: flex; flex-direction: column; gap: 12px;">
          ${equipes.map(eq => `
            <div class="card-equipe-convite" style="display: flex; align-items: center; justify-content: space-between; padding: 14px; background: #161622; border: 1px solid #262638; border-radius: 12px; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                <img referrerpolicy="no-referrer" src="${eq.logo || '/image/logo.png'}" alt="${escapeHtml(eq.nome)}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 2px solid #2e2e44; flex-shrink: 0;" onerror="this.src='/image/logo.png'">
                <div style="min-width: 0;">
                  <div style="font-weight: 700; color: #ffffff; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(eq.nome)} ${eq.tag ? `<span style="font-size: 11px; color: #10b981; font-weight: 700; padding: 1px 6px; background: rgba(16,185,129,0.15); border-radius: 6px;">[${escapeHtml(eq.tag)}]</span>` : ''}
                  </div>
                  <div style="font-size: 12px; color: #9ca3af; margin-top: 3px;">
                    <i class="fa-solid fa-gamepad" style="font-size: 11px;"></i> ${escapeHtml(eq.jogos || 'Geral')}
                  </div>
                </div>
              </div>
              <button type="button" class="btn-enviar-convite-eq" data-id="${escapeHtml(eq.id)}" data-nome="${escapeHtml(eq.nome)}" style="background: #059669; border: 1px solid #10b981; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s;">
                <i class="fa-solid fa-paper-plane"></i> Convidar
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('btnFecharModalConviteEquipe').onclick = () => {
    modal.style.display = 'none';
  };
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };

  modal.querySelectorAll('.btn-enviar-convite-eq').forEach(btn => {
    btn.addEventListener('click', async () => {
      const equipeId = btn.dataset.id;
      const equipeNome = btn.dataset.nome;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

      try {
        // Verifica se já existe vínculo
        const { data: existing } = await supabase
          .from('membros_equipe')
          .select('id, status')
          .eq('equipe_id', String(equipeId))
          .ilike('user_email', visitedEmail)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'Aceito') {
            alert(`"${visitedName}" já é membro desta equipe!`);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Convidar';
            return;
          } else if (existing.status === 'Pendente') {
            alert(`Já existe um convite ou solicitação pendente para "${visitedName}" nesta equipe!`);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Convidar';
            return;
          }
        }

        // 1. Inserir em membros_equipe
        const { error: insErr } = await supabase.from('membros_equipe').insert([{
          equipe_id: String(equipeId),
          user_email: visitedEmail,
          status: 'Convidado'
        }]);

        if (insErr) {
          console.error('Erro ao inserir em membros_equipe:', insErr);
        }

        // 2. Disparar notificação no Supabase
        const { error: notifErr } = await supabase.from('notificacoes').insert([{
          user_email: visitedEmail,
          titulo: 'Convite de Equipe!',
          mensagem: `Você foi convidado para entrar na equipe "${equipeNome}"!`,
          tipo: 'equipe',
          link: `/equipes/template_equipe.html?id=${encodeURIComponent(equipeId)}`,
          lida: false
        }]);

        if (notifErr) {
          console.error('Erro ao enviar notificação de convite:', notifErr);
        }

        if (typeof showToast === 'function') showToast('Convite enviado com sucesso!'); btn.innerHTML = '<i class="fa-solid fa-check"></i> Convite Enviado'; btn.disabled = true;
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        btn.style.borderColor = '#10b981';
        btn.style.color = '#34d399';
        btn.style.cursor = 'default';

        setTimeout(() => {
          modal.style.display = 'none';
        }, 1200);
      } catch (err) {
        console.error('Erro ao convidar jogador:', err);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Convidar';
        alert('Erro ao enviar convite. Tente novamente.');
      }
    });
  });
}

// ==========================================
// EXIBIÇÃO DE TORNEIOS FAVORITOS NO PERFIL PÚBLICO
// ==========================================
async function carregarTorneiosFavoritosPublico(userData) {
  const grid = document.getElementById('publicFavoritesGrid');
  const badge = document.getElementById('publicFavoritesCountBadge');
  if (!grid || !userData) return;

  const userEmail = (userData.email || '').trim().toLowerCase();
  if (!userEmail) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 40px 20px; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 16px;">
        <i class="fa-solid fa-heart-crack" style="font-size: 32px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
        Nenhum torneio favoritado por este jogador.
      </div>
    `;
    if (badge) badge.textContent = '0';
    return;
  }

  grid.innerHTML = `
    <div class="card-torneio skeleton-card" aria-hidden="true">
      <div class="skeleton-shimmer skeleton-card-img"></div>
      <div class="card-info">
        <div class="skeleton-shimmer skeleton-card-line title"></div>
        <div class="skeleton-shimmer skeleton-card-line short"></div>
      </div>
    </div>
  `;

  try {
    // 1. Consulta a tabela 'curtidas' no Supabase
    const { data: curtidas, error: errC } = await supabase
      .from('curtidas')
      .select('torneio_id')
      .ilike('user_email', userEmail);

    if (errC) {
      console.error('Erro ao buscar curtidas do perfil público:', errC);
    }

    const arrayDeIds = [...new Set((curtidas || []).map(c => c.torneio_id).filter(Boolean))];

    if (badge) {
      badge.textContent = String(arrayDeIds.length);
    }

    if (arrayDeIds.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 40px 20px; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 16px;">
          <i class="fa-solid fa-heart-crack" style="font-size: 32px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
          Nenhum torneio favoritado por este jogador.
        </div>
      `;
      return;
    }

    // 2. Consulta os torneios correspondentes na tabela 'torneios'
    const { data: torneios, error: errT } = await supabase
      .from('torneios')
      .select('id, nome, jogo, status, statusClass, data, banner')
      .in('id', arrayDeIds);

    if (errT || !torneios || torneios.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 40px 20px; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 16px;">
          <i class="fa-solid fa-heart-crack" style="font-size: 32px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
          Nenhum torneio favoritado por este jogador.
        </div>
      `;
      return;
    }

    grid.innerHTML = torneios.map(t => {
      const isLive = t.ao_vivo === true || (t.status && t.status.toLowerCase().includes('vivo'));
      let statusBadgeClass = t.statusClass || 'status-aberto';
      let statusText = t.status || 'Inscrições abertas';
      if (isLive) {
        statusBadgeClass = 'status-andamento';
        statusText = '<i class="fa-solid fa-tower-broadcast"></i> Ao Vivo';
      }
      const tLink = t.link || `/torneio/custom.html?id=${encodeURIComponent(t.id)}`;

      return `
        <article class="card-torneio-publico">
          <div class="card-torneio-publico-banner">
            <img referrerpolicy="no-referrer" src="${t.banner || '/images/cerradocup.jpg'}" alt="${escapeHtml(t.nome || '')}" onerror="this.src='/images/cerradocup.jpg'">
            <span class="card-torneio-publico-badge ${statusBadgeClass}">${statusText}</span>
          </div>
          <div class="card-torneio-publico-info">
            <h3 class="card-torneio-publico-title">${escapeHtml(t.nome || 'Torneio')}</h3>
            <div class="card-torneio-publico-meta">
              <span><i class="fa-solid fa-gamepad"></i> ${escapeHtml(t.jogo || 'Competitivo')}</span>
              <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(t.data || 'A definir')}</span>
            </div>
            <a href="${tLink}" class="btn-card-torneio-publico">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Detalhes
            </a>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar torneios favoritos do perfil público:', err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 20px;">
        Erro ao carregar torneios favoritos.
      </div>
    `;
  }
}
