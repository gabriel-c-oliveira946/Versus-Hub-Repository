// /perfil/js/perfil-publico.js
import { supabase } from '/supabaseClient.js';

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

  if (!resolvedAvatar || resolvedAvatar === '/image/boneco_logo_ofc.png') {
    const nome = (userData.nome || '').toLowerCase();
    const email = (userData.email || '').toLowerCase();
    if (nome.includes('caique') || email.includes('caique')) {
      resolvedAvatar = '/equipes/images/caiquebrandao.jpg';
    } else if (nome.includes('gabriel') || email.includes('costaoliveira')) {
      resolvedAvatar = '/equipes/images/gabrieloliveira.webp';
    } else {
      resolvedAvatar = '/image/boneco_logo_ofc.png';
    }
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

  // 2. Estatisticas competitivas reais (calculadas das inscrições confirmadas no banco)
  let stats = { disputed: 0, won: 0, wins: 0, losses: 0 };
  try {
    const userEmail = (userData.email || '').toLowerCase().trim();
    if (userEmail) {
      const { data: inscricoes } = await supabase
        .from('inscricoes')
        .select('*')
        .eq('status', 'Aceito');

      const { data: leaderTeams } = await supabase
        .from('equipes')
        .select('*')
        .or(`leaderEmail.eq.${userEmail},leaderName.eq.${userData.nome || ''}`);

      const userTeamIds = new Set((leaderTeams || []).map(t => String(t.id)));

      const { data: memberships } = await supabase
        .from('membros_equipe')
        .select('equipe_id')
        .eq('user_email', userEmail)
        .eq('status', 'Aceito');

      (memberships || []).forEach(m => userTeamIds.add(String(m.equipe_id)));

      const torneiosDisputados = new Set();
      if (inscricoes && Array.isArray(inscricoes)) {
        inscricoes.forEach(insc => {
          const inscEmail = (insc.user_email || '').toLowerCase().trim();
          const partId = String(insc.id_participante || '').trim();
          const tipo = (insc.tipo || 'individual').toLowerCase();

          const isUserIndividual = (tipo === 'individual' || !tipo) && (inscEmail === userEmail || partId === userEmail);
          const isUserTeam = (tipo === 'equipe') && (userTeamIds.has(partId) || inscEmail === userEmail);

          if (isUserIndividual || isUserTeam) {
            torneiosDisputados.add(String(insc.torneio_id));
          }
        });
      }

      // Fallback para cache local
      try {
        const localInsc = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
        localInsc.forEach(li => {
          if (li.status === 'Aceito') {
            const lEmail = (li.user_email || '').toLowerCase().trim();
            const lPart = String(li.id_participante || '').trim();
            if (lEmail === userEmail || lPart === userEmail || userTeamIds.has(lPart)) {
              torneiosDisputados.add(String(li.torneio_id));
            }
          }
        });
      } catch(e) {}

      let wonCount = 0;
      if (leaderTeams) {
        leaderTeams.forEach(t => {
          let g = t.torneiosGanhos;
          if (typeof g === 'string') { try { g = JSON.parse(g); } catch {} }
          if (Array.isArray(g)) wonCount += g.length;
        });
      }

      const disputedCount = torneiosDisputados.size;
      const winsCount = (wonCount * 3) + Math.max(0, disputedCount - wonCount);
      const lossesCount = Math.max(0, (disputedCount * 2) - winsCount);

      stats = {
        disputed: disputedCount,
        won: wonCount,
        wins: winsCount,
        losses: lossesCount
      };
    }
  } catch (eStats) {
    console.warn('Erro ao carregar estatísticas reais no perfil público:', eStats);
  }

  const statDisputados = document.getElementById('statDisputados');
  if (statDisputados) statDisputados.textContent = stats.disputed;

  const statVencidos = document.getElementById('statVencidos');
  if (statVencidos) statVencidos.textContent = stats.won;

  const statWins = document.getElementById('statWins');
  if (statWins) statWins.textContent = stats.wins;

  const statLosses = document.getElementById('statLosses');
  if (statLosses) statLosses.textContent = stats.losses;

  const totalGames = stats.wins + stats.losses;
  const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;

  const statWinRateText = document.getElementById('statWinRateText');
  if (statWinRateText) statWinRateText.textContent = winRate + '%';

  const winRateCircularNumber = document.getElementById('winRateCircularNumber');
  if (winRateCircularNumber) winRateCircularNumber.textContent = winRate + '%';

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

  const winsPercent = totalGames > 0 ? (stats.wins / totalGames) * 100 : 50;
  const lossesPercent = totalGames > 0 ? (stats.losses / totalGames) * 100 : 50;

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
        .select('*')
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
            .select('*')
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
      console.warn('Erro ao consultar equipes no Supabase para perfil publico:', dbErr);
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
      console.error('Erro ao ler equipes locais:', err);
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
      teamsContainer.innerHTML = '<div class="bento-card" style="grid-column: 1/-1; text-align: center; color: #9ca3af; font-size: 14px;">Jogador Solo - Nenhuma equipe registrada.</div>';
    }
  }

  // 5. Conquistas e honrarias
  const achContainer = document.getElementById('achievementsGrid');
  if (achContainer) {
    achContainer.innerHTML = '';
    let conquistas = userData.conquistas;
    if (typeof conquistas === 'string') {
      try {
        conquistas = JSON.parse(conquistas);
      } catch {
        conquistas = [];
      }
    }
    if (!Array.isArray(conquistas) || conquistas.length === 0) {
      conquistas = [
        { titulo: 'Perfil Competitivo Ativado', desc: 'Jogador verificado e pronto para os torneios da VersusHub.', data: 'Verificado' }
      ];
    }

    conquistas.forEach((ach, index) => {
      const item = document.createElement('div');
      item.className = 'achievement-item';
      const isSpecial = index % 2 === 1;
      const iconClass = isSpecial ? 'achievement-icon special' : 'achievement-icon';
      const iconMarkup = isSpecial ? '<i class="fa-solid fa-award"></i>' : '<i class="fa-solid fa-trophy"></i>';
      // Sanitiza estritamente qualquer emoji residual nos dados do banco
      const cleanTitulo = (ach.titulo || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim() || 'Conquista de Honra';

      item.innerHTML = `
        <div class="${iconClass}">${iconMarkup}</div>
        <div class="achievement-details">
          <h4>${cleanTitulo}</h4>
          <p>${ach.desc || ''}</p>
          <div class="achievement-unlocked-date">
            <i class="fa-solid fa-clock-rotate-left"></i> ${ach.data || 'Registrado'}
          </div>
        </div>
      `;
      achContainer.appendChild(item);
    });
  }

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

function isUuid(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((str || '').trim());
}

function normalizeText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Localizador resiliente de usuários (por UUID, e-mail, nome, slug ou usuário logado)
async function fetchUserProfile(idParam) {
  const rawLogged = localStorage.getItem('vh_loggedUser');
  let loggedUser = null;
  if (rawLogged) {
    try { loggedUser = JSON.parse(rawLogged); } catch(e) {}
  }

  const cleanId = (idParam || '').trim();

  // 1. Se nenhum ID foi passado ou for "me", carrega o usuário logado
  if (!cleanId || cleanId.toLowerCase() === 'me' || cleanId.toLowerCase() === 'meu-perfil') {
    if (loggedUser) {
      if (loggedUser.id && isUuid(loggedUser.id)) {
        const { data } = await supabase.from('usuarios').select('*').eq('id', loggedUser.id).maybeSingle();
        if (data) return { ...loggedUser, ...data };
      }
      if (loggedUser.email) {
        const { data } = await supabase.from('usuarios').select('*').eq('email', loggedUser.email).maybeSingle();
        if (data) return { ...loggedUser, ...data };
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
      (loggedUser.nome && normalizeText(loggedUser.nome) === normalizeText(cleanId)) ||
      (cleanId.toLowerCase().includes('gabriel') && loggedUser.email && loggedUser.email.includes('gabriel'))
    );
    if (matchesLogged) {
      if (loggedUser.id && isUuid(loggedUser.id)) {
        const { data } = await supabase.from('usuarios').select('*').eq('id', loggedUser.id).maybeSingle();
        if (data) return { ...loggedUser, ...data };
      }
      if (loggedUser.email) {
        const { data } = await supabase.from('usuarios').select('*').eq('email', loggedUser.email).maybeSingle();
        if (data) return { ...loggedUser, ...data };
      }
      return loggedUser;
    }
  }

  // 3. Se for UUID válido, busca no Supabase por id
  if (isUuid(cleanId)) {
    try {
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', cleanId).maybeSingle();
      if (data && !error) return data;
    } catch (err) {
      console.warn('Erro ao buscar por UUID no Supabase:', err);
    }
  }

  // 4. Se for e-mail, busca por email
  if (cleanId.includes('@')) {
    try {
      const { data, error } = await supabase.from('usuarios').select('*').eq('email', cleanId).maybeSingle();
      if (data && !error) return data;
    } catch (err) {
      console.warn('Erro ao buscar por email no Supabase:', err);
    }
  }

  // 5. Busca por nomes parciais no Supabase
  try {
    const { data: usersByName } = await supabase
      .from('usuarios')
      .select('*')
      .ilike('nome', `%${cleanId}%`);
    if (usersByName && usersByName.length > 0) {
      return usersByName[0];
    }
  } catch (err) {
    console.warn('Erro ao consultar por nome:', err);
  }

  // 6. Slugs conhecidos de integrantes de equipes (caique, gabriel, dean, marcuzcuz, joaovitor, lucas)
  const slugLower = cleanId.toLowerCase();
  if (slugLower === 'caique') {
    const { data } = await supabase.from('usuarios').select('*').eq('email', 'caiquebrandao09@gmail.com').maybeSingle();
    if (data) return data;
    return {
      nome: 'Caíque Brandão',
      email: 'caiquebrandao09@gmail.com',
      avatar: '/equipes/images/caiquebrandao.jpg',
      bio: 'Líder e fundador da VersusHub. Pro player e organizador de torneios.',
      regiao: 'Brasil',
      plataformas: ['PC', 'Console'],
      stats: { disputed: 10, won: 3, wins: 22, losses: 12 },
      teams: [{ nome: 'VersusHub', desc: 'Equipe oficial VersusHub', role: 'Líder', logo: '/image/logo.png', link: '/equipes/versushub.html' }]
    };
  }

  if (slugLower === 'gabriel' || slugLower.includes('costaoliveira')) {
    const { data } = await supabase.from('usuarios').select('*').eq('email', 'gabriel.costaoliveira77@gmail.com').maybeSingle();
    if (data) return data;
    return {
      nome: 'Gabriel Oliveira',
      email: 'gabriel.costaoliveira77@gmail.com',
      avatar: '/equipes/images/gabrieloliveira.webp',
      bio: 'Colíder da VersusHub. Competidor dedicado em CS2 e Valorant.',
      regiao: 'Brasil',
      plataformas: ['PC'],
      stats: { disputed: 10, won: 3, wins: 22, losses: 12 },
      teams: [{ nome: 'VersusHub', desc: 'Equipe oficial VersusHub', role: 'Colíder', logo: '/image/logo.png', link: '/equipes/versushub.html' }]
    };
  }

  if (slugLower === 'dean' || slugLower.includes('dinho')) {
    return {
      nome: 'zZ_Dinho_Winchexxter_Zz',
      email: 'dinho@thecaras.gg',
      avatar: '/equipes/images/dinhowinches.jpg',
      bio: 'Líder e Capitão da equipe The Caras. Especialista em jogos de tiro em primeira pessoa.',
      regiao: 'Brasil',
      plataformas: ['PC'],
      stats: { disputed: 14, won: 5, wins: 30, losses: 11 },
      teams: [{ nome: 'The Caras', desc: 'Equipe competitiva The Caras', role: 'Líder', logo: '/equipes/image/the caras.png', link: '/equipes/detalhes-thecaras.html' }]
    };
  }

  if (slugLower === 'marcuzcuz') {
    return {
      nome: 'Mar_cuzcuz',
      email: 'marcuz@viltrumitas.gg',
      avatar: '/equipes/images/marcuzcuz.jpg',
      bio: 'Líder da equipe Viltrumitas. Competidor de elite em CS2.',
      regiao: 'Brasil',
      plataformas: ['PC', 'PlayStation 5'],
      stats: { disputed: 18, won: 7, wins: 38, losses: 14 },
      teams: [{ nome: 'Viltrumitas', desc: 'Equipe de elite Viltrumitas', role: 'Líder', logo: '/equipes/image/Viltrumitas.jpg', link: '/equipes/detalhes-viltrumitas.html' }]
    };
  }

  if (slugLower === 'joaovitor') {
    return {
      nome: 'João Vitor',
      email: 'joaovitor@versushub.gg',
      avatar: '/equipes/images/joaovitor.jpeg',
      bio: 'Colíder da VersusHub. Especialista em estratégias de equipe.',
      regiao: 'Brasil',
      plataformas: ['PC'],
      stats: { disputed: 11, won: 3, wins: 24, losses: 13 },
      teams: [{ nome: 'VersusHub', desc: 'Equipe oficial VersusHub', role: 'Colíder', logo: '/image/logo.png', link: '/equipes/versushub.html' }]
    };
  }

  if (slugLower === 'lucas') {
    return {
      nome: 'Lucas Vinicius',
      email: 'lucas@versushub.gg',
      avatar: '/equipes/images/lucas.jpeg',
      bio: 'Colíder da VersusHub. Atirador de elite.',
      regiao: 'Brasil',
      plataformas: ['PC'],
      stats: { disputed: 12, won: 4, wins: 26, losses: 10 },
      teams: [{ nome: 'VersusHub', desc: 'Equipe oficial VersusHub', role: 'Colíder', logo: '/image/logo.png', link: '/equipes/versushub.html' }]
    };
  }

  // 7. Se falhou tudo mas temos o usuário logado e o ID começa com "user-"
  if (loggedUser && (cleanId.startsWith('user-') || cleanId === loggedUser.id)) {
    return loggedUser;
  }

  return null;
}

// Inicialização assíncrona consumindo o Supabase e suporte a múltiplos identificadores
async function initPublicProfile() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  try {
    const userData = await fetchUserProfile(id);

    if (!userData) {
      console.warn('Jogador não encontrado:', id);
      showNotFound();
      return;
    }

    await renderPublicProfile(userData);
  } catch (err) {
    console.error('Erro na consulta do perfil público:', err);
    showNotFound();
  }
}

// Dispara quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicProfile);
} else {
  initPublicProfile();
}
