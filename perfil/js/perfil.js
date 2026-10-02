// /perfil/js/perfil.js
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "vh_loggedUser";

  // --------- UTILIDADES ---------

  function loadUser() {
    let u = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) u = JSON.parse(raw);
    } catch (err) {
      console.error("Erro ao ler vh_loggedUser:", err);
    }

    if (!u || typeof u !== "object") u = {};

    if (!u.nome) u.nome = "Usuário convidado";
    if (!u.email) u.email = "";
    if (!u.bio) u.bio = "";
    if (!u.avatar) u.avatar = "";
    if (!Array.isArray(u.jogosFavoritos)) u.jogosFavoritos = [];
    if (!u.regiao) u.regiao = "Brasil";
    if (!Array.isArray(u.plataformas)) u.plataformas = [];

    // Campos novos de e-sports
    if (!u.banner) u.banner = "";
    if (!u.stats || typeof u.stats !== "object") {
      u.stats = { disputed: 0, won: 0, wins: 0, losses: 0 };
    } else {
      // Se o usuário tinha os stats padrão de mock antigos (10, 3, 22, 12), reseta para zero
      if (u.stats.disputed === 10 && u.stats.won === 3 && u.stats.wins === 22 && u.stats.losses === 12) {
        u.stats = { disputed: 0, won: 0, wins: 0, losses: 0 };
      }
      if (typeof u.stats.disputed === "undefined") u.stats.disputed = 0;
      if (typeof u.stats.won === "undefined") u.stats.won = 0;
      if (typeof u.stats.wins === "undefined") u.stats.wins = 0;
      if (typeof u.stats.losses === "undefined") u.stats.losses = 0;
    }
    
    if (!Array.isArray(u.conquistas)) {
      u.conquistas = [
        { titulo: "Perfil Ativado", desc: "Configure e atualize suas conquistas para o ranking no painel de perfil.", data: "Desbloqueado" }
      ];
    }

    return u;
  }

  async function syncUserWithSupabase(u) {
    if (!u) return;
    try {
      const { supabase } = await import('/supabaseClient.js');
      const payload = {
        nome: u.nome,
        bio: u.bio,
        avatar: u.avatar,
        banner: u.banner,
        regiao: u.regiao,
        plataformas: u.plataformas,
        jogosFavoritos: u.jogosFavoritos,
        stats: u.stats
      };
      if (u.id) {
        await supabase.from('usuarios').update(payload).eq('id', u.id);
      } else if (u.email) {
        await supabase.from('usuarios').update(payload).eq('email', u.email);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar com Supabase:', err);
    }
  }

  function saveUser(u) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch (err) {
      console.error("Erro ao salvar vh_loggedUser:", err);
    }
    syncUserWithSupabase(u);
  }

  // 1. Identificação do Dono do Perfil (via URL ?id=... ou ?email=..., ou usuário logado)
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('id');
  const paramEmail = urlParams.get('email') || urlParams.get('user');
  const hasUrlTarget = Boolean(paramId || paramEmail);

  let loggedUser = loadUser();
  let user = { ...loggedUser };
  let isOwner = !hasUrlTarget;

  // Atualiza interface gráfica conforme o dono do perfil e o modo de visualização (visitante vs dono)
  function atualizarInterfaceDonoPerfil(targetUser, isOwnerMode) {
    if (!targetUser) return;
    const nome = targetUser.nome || (targetUser.email ? targetUser.email.split('@')[0] : 'Organizador');
    const email = targetUser.email || '';

    // Atualiza título da página
    if (!isOwnerMode) {
      document.title = `${nome} - Perfil Público | VersusHub`;
    } else {
      document.title = 'Meu Perfil - VersusHub';
    }

    // Preenche dados visuais do sidebar
    if (displayName) displayName.textContent = nome;
    if (inputUsername) inputUsername.value = nome;
    if (emailInput) emailInput.value = email;

    const emailDisplayVisitor = document.getElementById('emailDisplayVisitor');
    const emailBoxContainer = document.getElementById('emailBoxContainer');
    const spanEmailVisitor = document.getElementById('spanEmailVisitor');

    if (spanRegiao) spanRegiao.textContent = targetUser.regiao || 'Brasil';
    if (selectRegiao) selectRegiao.value = targetUser.regiao || 'Brasil';

    // Plataformas
    atualizarTextoPlataformas();

    // Avatar
    if (targetUser.avatar) {
      if (imgProfile) imgProfile.style.backgroundImage = `url('${targetUser.avatar}')`;
      if (headerUserImg) headerUserImg.src = targetUser.avatar;
      if (avatarPreviewImg) avatarPreviewImg.src = targetUser.avatar;
    } else {
      if (imgProfile) imgProfile.style.backgroundImage = "url('/image/boneco_logo_ofc.png')";
    }

    // Banner
    if (targetUser.banner && bannerPreviewImg) {
      bannerPreviewImg.src = targetUser.banner;
      bannerPreviewImg.style.display = "block";
      if (bannerPlaceholder) bannerPlaceholder.style.display = "none";
    }

    // Biografia
    if (bioTextarea) bioTextarea.value = targetUser.bio || '';

    // Jogos preferidos
    renderTags();

    // Conquistas
    renderAchievementsList();

    // Link do perfil público
    const btnLinkPerfilPublico = document.getElementById('btnLinkPerfilPublico');
    if (btnLinkPerfilPublico) {
      if (targetUser.id) {
        btnLinkPerfilPublico.href = `/perfil/perfil-publico.html?id=${encodeURIComponent(targetUser.id)}`;
      } else if (targetUser.email) {
        btnLinkPerfilPublico.href = `/perfil/perfil-publico.html?email=${encodeURIComponent(targetUser.email)}`;
      } else {
        btnLinkPerfilPublico.href = '/perfil/perfil-publico.html';
      }
    }

    // Descrição da seção de torneios criados
    const descTorneiosCriados = document.getElementById('descTorneiosCriados');
    if (descTorneiosCriados) {
      if (isOwnerMode) {
        descTorneiosCriados.textContent = 'Campeonatos organizados por você na comunidade VersusHub.';
      } else {
        descTorneiosCriados.textContent = `Campeonatos organizados por ${nome} na comunidade VersusHub.`;
      }
    }

    const bannerModoVisitante = document.getElementById('bannerModoVisitante');
    const bannerVisitanteSub = document.getElementById('bannerVisitanteSub');
    const saveRow = document.getElementById('saveProfileRow');
    const editOnlyTabs = document.querySelectorAll('.tab-edit-only');
    const ownerOnlyElements = document.querySelectorAll('.btn-owner-only');
    const btnCriarTorneioHeader = document.getElementById('btnCriarTorneioHeader');
    const labelTabInfo = document.getElementById('labelTabInfo');
    const addAchBox = document.querySelector('.add-conquista-box');

    if (!isOwnerMode) {
      // MODO VISITANTE (SEÇÃO PÚBLICA)
      if (bannerModoVisitante) bannerModoVisitante.style.display = 'flex';
      if (bannerVisitanteSub) bannerVisitanteSub.textContent = `Visualizando informações públicas e histórico de torneios organizados por ${nome}.`;

      // Oculta botões exclusivos do dono
      ownerOnlyElements.forEach(el => el.style.display = 'none');
      if (emailBoxContainer) emailBoxContainer.style.display = 'none';
      if (emailDisplayVisitor) {
        emailDisplayVisitor.style.display = 'flex';
        if (spanEmailVisitor) spanEmailVisitor.textContent = email || 'Não informado';
      }
      if (btnCriarTorneioHeader) btnCriarTorneioHeader.style.display = 'none';
      if (saveRow) saveRow.style.display = 'none';

      // Oculta abas privadas de edição (Aparência, Segurança)
      editOnlyTabs.forEach(t => t.style.display = 'none');

      if (labelTabInfo) labelTabInfo.textContent = 'Sobre o Jogador';

      // Campos de formulário em modo somente leitura para visitante
      if (inputUsername) inputUsername.readOnly = true;
      if (bioTextarea) bioTextarea.readOnly = true;
      if (selectRegiao) selectRegiao.disabled = true;
      const platInputs = document.querySelectorAll('.platform-options input');
      platInputs.forEach(inp => inp.disabled = true);
      const labelJogoInput = document.getElementById('labelJogoInput');
      const hintJogoInput = document.getElementById('hintJogoInput');
      if (jogoInput) jogoInput.style.display = 'none';
      if (labelJogoInput) labelJogoInput.textContent = 'Jogos Preferidos';
      if (hintJogoInput) hintJogoInput.style.display = 'none';

      if (addAchBox) addAchBox.style.display = 'none';

      // Para visitantes, ativa por padrão a aba de Torneios Criados!
      const tabTorneios = document.getElementById('tabBtnTorneiosCriados');
      if (tabTorneios) {
        tabTorneios.click();
      }
    } else {
      // MODO DONO
      if (bannerModoVisitante) bannerModoVisitante.style.display = 'none';
      ownerOnlyElements.forEach(el => el.style.display = '');
      if (emailBoxContainer) emailBoxContainer.style.display = 'flex';
      if (emailDisplayVisitor) emailDisplayVisitor.style.display = 'none';
      if (btnCriarTorneioHeader) btnCriarTorneioHeader.style.display = 'inline-flex';
      editOnlyTabs.forEach(t => t.style.display = 'inline-flex');
      if (labelTabInfo) labelTabInfo.textContent = 'Informações';
      if (inputUsername) inputUsername.readOnly = false;
      if (bioTextarea) bioTextarea.readOnly = false;
      if (selectRegiao) selectRegiao.disabled = false;
      const platInputs = document.querySelectorAll('.platform-options input');
      platInputs.forEach(inp => inp.disabled = false);
      if (jogoInput) jogoInput.style.display = 'block';
      if (addAchBox) addAchBox.style.display = 'flex';
    }
  }

  // Sincroniza dados com o Supabase (Dono alvo do perfil via URL ou Sessão do Usuário Logado)
  import('/supabaseClient.js').then(async ({ supabase }) => {
    try {
      if (hasUrlTarget) {
        let dbUser = null;
        if (paramId) {
          const { data } = await supabase
            .from('usuarios')
            .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
            .eq('id', paramId)
            .maybeSingle();
          if (data) dbUser = data;
        }
        if (!dbUser && paramEmail) {
          const { data } = await supabase
            .from('usuarios')
            .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
            .ilike('email', paramEmail.trim())
            .maybeSingle();
          if (data) dbUser = data;
        }

        if (dbUser) {
          user = { ...user, ...dbUser };
        } else if (paramEmail) {
          user = {
            ...user,
            email: paramEmail.trim(),
            nome: paramEmail.split('@')[0],
            regiao: 'Brasil',
            plataformas: ['PC']
          };
        }

        isOwner = Boolean(
          loggedUser && user && (
            (user.id && loggedUser.id && String(loggedUser.id) === String(user.id)) ||
            (user.email && loggedUser.email && loggedUser.email.toLowerCase() === user.email.toLowerCase())
          )
        );
      } else {
        isOwner = true;
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const email = session.user.email;
          const { data: dbUser } = await supabase
            .from('usuarios')
            .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
            .eq('email', email)
            .maybeSingle();
          if (dbUser) {
            user = { ...user, ...dbUser };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
          }
        }
      }

      atualizarInterfaceDonoPerfil(user, isOwner);
      carregarTorneiosCriadosEAtualizarUI(true);
    } catch (e) {
      console.warn("Aviso ao sincronizar perfil do banco:", e);
    }
  });

  // --------- ELEMENTOS DA TELA ---------
  const headerUserImg   = document.getElementById("userBtn");

  const imgProfile      = document.getElementById("profileImage");
  const inputPhoto      = document.getElementById("inputPhoto");
  const btnPhoto        = document.getElementById("btnPhoto");

  const emailInput      = document.getElementById("emailInput");
  const displayName     = document.getElementById("displayName");
  const inputUsername   = document.getElementById("inputUsername");
  const bioTextarea     = document.getElementById("bioTextarea");

  const btnSaveProfile  = document.getElementById("btnSaveProfile");
  const btnEmailFocus   = document.getElementById("btnEmailFocus");
  const btnNameFocus    = document.getElementById("btnNameFocus");

  const jogoInput       = document.getElementById("jogoInput");
  const jogosTags       = document.getElementById("jogosTags");

  const spanRegiao      = document.getElementById("spanRegiao");
  const spanPlataforma  = document.getElementById("spanPlataforma");

  const platPC      = document.getElementById("platPC");
  const platConsole = document.getElementById("platConsole");
  const platMobile  = document.getElementById("platMobile");

  // Novos elementos de E-sports e Abas
  const inputEmailPerfil  = document.getElementById("inputEmailPerfil");
  const selectRegiao      = document.getElementById("selectRegiao");

  // Elementos de Aparência (Upload de arquivos)
  const inputAvatarUpload = document.getElementById("inputAvatarUpload");
  const btnChooseAvatar   = document.getElementById("btnChooseAvatar");
  const avatarPreviewImg  = document.getElementById("avatarPreviewImg");
  const avatarUploadHint  = document.getElementById("avatarUploadHint");

  const inputBannerUpload = document.getElementById("inputBannerUpload");
  const btnChooseBanner   = document.getElementById("btnChooseBanner");
  const bannerPreviewImg  = document.getElementById("bannerPreviewImg");
  const bannerPlaceholder = document.getElementById("bannerPlaceholder");
  const bannerUploadHint  = document.getElementById("bannerUploadHint");

  const statsDisputed     = document.getElementById("statsDisputed");
  const statsWon          = document.getElementById("statsWon");
  const statsWins         = document.getElementById("statsWins");
  const statsLosses       = document.getElementById("statsLosses");

  const conquistasContainer = document.getElementById("conquistasContainer");
  const newAchTitle        = document.getElementById("newAchTitle");
  const newAchDesc         = document.getElementById("newAchDesc");
  const btnAddAch          = document.getElementById("btnAddAch");

  // --------- LÓGICA DE ABAS DO PERFIL ---------
  const tabButtons = document.querySelectorAll(".tab-btn-perfil");
  const tabContainers = document.querySelectorAll(".tab-container-perfil");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      if (!targetId) return;

      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      tabContainers.forEach(container => {
        if (container.id === targetId) {
          container.style.display = "block";
        } else {
          container.style.display = "none";
        }
      });

      // Visibilidade do botão Salvar Perfil (apenas para o dono nas abas de formulário)
      const saveRow = document.getElementById("saveProfileRow");
      if (saveRow) {
        if (isOwner && (targetId === "aba-info" || targetId === "aba-aparencia" || targetId === "aba-historico")) {
          saveRow.style.display = "flex";
        } else {
          saveRow.style.display = "none";
        }
      }

      if (targetId === "aba-torneios-criados") {
        carregarTorneiosCriadosEAtualizarUI();
      }
    });
  });

  // --------- PREENCHE A TELA COM O QUE TEM NO LOCALSTORAGE ---------

  displayName.textContent = user.nome || "Usuário convidado";
  inputUsername.value     = user.nome || "";
  emailInput.value        = user.email || "";
  if (inputEmailPerfil) {
    inputEmailPerfil.value = user.email || "";
    inputEmailPerfil.addEventListener("input", () => {
      emailInput.value = inputEmailPerfil.value;
    });
    emailInput.addEventListener("input", () => {
      inputEmailPerfil.value = emailInput.value;
    });
  }
  bioTextarea.value       = user.bio || "";

  // Preenche dados de E-sports nos inputs (como Somente Leitura)
  if (statsDisputed) {
    statsDisputed.value = user.stats.disputed || 0;
    statsDisputed.readOnly = true;
  }
  if (statsWon) {
    statsWon.value = user.stats.won || 0;
    statsWon.readOnly = true;
  }
  if (statsWins) {
    statsWins.value = user.stats.wins || 0;
    statsWins.readOnly = true;
  }
  if (statsLosses) {
    statsLosses.value = user.stats.losses || 0;
    statsLosses.readOnly = true;
  }

  // Função para recalcular e sincronizar estatísticas reais baseadas em inscrições aceitas
  async function refreshUserRealStats() {
    if (!user || !user.email) return;
    try {
      const { supabase } = await import('/supabaseClient.js');
      const userEmail = (user.email || '').toLowerCase().trim();

      // 1. Busca inscrições confirmadas no Supabase
      const { data: inscricoes } = await supabase
        .from('inscricoes')
        .select('*')
        .eq('status', 'Aceito');

      // 2. Busca equipes em que o usuário é líder
      const { data: leaderTeams } = await supabase
        .from('equipes')
        .select('*')
        .or(`leaderEmail.eq.${userEmail},leaderName.eq.${user.nome || ''}`);

      const userTeamIds = new Set((leaderTeams || []).map(t => String(t.id)));

      // 3. Busca equipes em que o usuário é membro aceito
      const { data: memberships } = await supabase
        .from('membros_equipe')
        .select('equipe_id')
        .eq('user_email', userEmail)
        .eq('status', 'Aceito');

      (memberships || []).forEach(m => userTeamIds.add(String(m.equipe_id)));

      // 4. Agrega torneios disputados (individuais ou por equipe)
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

      // Cache local de fallback caso haja inscrições criadas na sessão
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

        const joinedKey = `vh_joinedTournaments_${userEmail}`;
        const joinedLocal = JSON.parse(localStorage.getItem(joinedKey) || '[]');
        joinedLocal.forEach(jt => {
          if (jt.inscricaoStatus === 'Aceito' || jt.statusInscricao === 'Aceito') {
            torneiosDisputados.add(String(jt.id));
          }
        });
      } catch(e) {}

      const disputedCount = torneiosDisputados.size;

      // 5. Torneios vencidos
      let wonCount = 0;
      if (leaderTeams) {
        leaderTeams.forEach(t => {
          let g = t.torneiosGanhos;
          if (typeof g === 'string') { try { g = JSON.parse(g); } catch {} }
          if (Array.isArray(g)) wonCount += g.length;
        });
      }

      const winsCount = (wonCount * 3) + Math.max(0, disputedCount - wonCount);
      const lossesCount = Math.max(0, (disputedCount * 2) - winsCount);

      user.stats = {
        disputed: disputedCount,
        won: wonCount,
        wins: winsCount,
        losses: lossesCount
      };

      if (statsDisputed) statsDisputed.value = user.stats.disputed;
      if (statsWon)      statsWon.value      = user.stats.won;
      if (statsWins)     statsWins.value     = user.stats.wins;
      if (statsLosses)   statsLosses.value   = user.stats.losses;

      // Salva os dados autênticos atualizados
      saveUser(user);
    } catch (err) {
      console.warn('Erro ao atualizar estatísticas reais do perfil:', err);
    }
  }

  // Executa o cálculo automático ao carregar
  refreshUserRealStats();

  // Região 
  if (spanRegiao) {
    spanRegiao.textContent = user.regiao || "Brasil";
  }
  if (selectRegiao) {
    selectRegiao.value = user.regiao || "Brasil";
    selectRegiao.addEventListener("change", () => {
      if (spanRegiao) spanRegiao.textContent = selectRegiao.value;
    });
  }

  // Banner pré-carregado
  if (user.banner && bannerPreviewImg) {
    bannerPreviewImg.src = user.banner;
    bannerPreviewImg.style.display = "block";
    if (bannerPlaceholder) bannerPlaceholder.style.display = "none";
  }

  // Avatar pré-carregado
  if (user.avatar) {
    imgProfile.style.backgroundImage = `url('${user.avatar}')`;
    if (headerUserImg) headerUserImg.src = user.avatar;
    if (avatarPreviewImg) avatarPreviewImg.src = user.avatar;
  } else {
    imgProfile.style.backgroundImage = "url('/image/boneco_logo_ofc.png')";
    if (headerUserImg) headerUserImg.src = "/image/boneco_logo_ofc.png";
    if (avatarPreviewImg) avatarPreviewImg.src = "/image/boneco_logo_ofc.png";
  }

  // função pra atualizar o texto de plataforma no header
  function atualizarTextoPlataformas() {
    if (!spanPlataforma) return;

    if (!user.plataformas || user.plataformas.length === 0) {
      spanPlataforma.textContent = "Não informado";
    } else {
      spanPlataforma.textContent = user.plataformas.join(" / ");
    }
  }

  // atualiza texto ao carregar a página
  atualizarTextoPlataformas();

  // marcar checkboxes de plataformas conforme o que está salvo
  if (platPC)      platPC.checked      = user.plataformas.includes("PC");
  if (platConsole) platConsole.checked = user.plataformas.includes("Console");
  if (platMobile)  platMobile.checked  = user.plataformas.includes("Mobile");

  // Link para visualização do perfil público
  const btnViewPublic = document.querySelector('.btn-view-public');
  if (btnViewPublic) {
    if (user && user.id) {
      btnViewPublic.href = `/perfil/perfil-publico.html?id=${encodeURIComponent(user.id)}`;
    } else {
      btnViewPublic.href = '/perfil/perfil-publico.html';
    }
  }

  // --------- UPLOAD DE AVATAR (ABA APARÊNCIA E CARD LATERAL) ---------
  function handleAvatarFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      imgProfile.style.backgroundImage = `url('${dataUrl}')`;
      if (headerUserImg) headerUserImg.src = dataUrl;
      if (avatarPreviewImg) avatarPreviewImg.src = dataUrl;
      if (avatarUploadHint) avatarUploadHint.textContent = `Arquivo: ${file.name}`;

      user.avatar = dataUrl;
      saveUser(user);
    };
    reader.readAsDataURL(file);
  }

  if (btnChooseAvatar && inputAvatarUpload) {
    btnChooseAvatar.addEventListener("click", () => inputAvatarUpload.click());
    inputAvatarUpload.addEventListener("change", (e) => {
      handleAvatarFile(e.target.files[0]);
    });
  }

  function abrirSeletorFoto() {
    if (inputPhoto) inputPhoto.click();
  }

  if (btnPhoto)   btnPhoto.addEventListener("click", abrirSeletorFoto);
  if (imgProfile) imgProfile.addEventListener("click", abrirSeletorFoto);

  if (inputPhoto) {
    inputPhoto.addEventListener("change", (e) => {
      handleAvatarFile(e.target.files[0]);
    });
  }

  // --------- UPLOAD DE BANNER (ABA APARÊNCIA) ---------
  function handleBannerFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (bannerPreviewImg) {
        bannerPreviewImg.src = dataUrl;
        bannerPreviewImg.style.display = "block";
      }
      if (bannerPlaceholder) {
        bannerPlaceholder.style.display = "none";
      }
      if (bannerUploadHint) {
        bannerUploadHint.textContent = `Arquivo: ${file.name}`;
      }
      user.banner = dataUrl;
      saveUser(user);
    };
    reader.readAsDataURL(file);
  }

  if (btnChooseBanner && inputBannerUpload) {
    btnChooseBanner.addEventListener("click", () => inputBannerUpload.click());
    inputBannerUpload.addEventListener("change", (e) => {
      handleBannerFile(e.target.files[0]);
    });
  }


  // --------- FOCAR NOS CAMPOS (ícones de lápis) ---------
  if (btnEmailFocus) {
    btnEmailFocus.addEventListener("click", () => {
      emailInput.focus();
    });
  }

  if (btnNameFocus) {
    btnNameFocus.addEventListener("click", () => {
      inputUsername.focus();
      inputUsername.select();
    });
  }

  // --------- SALVAR PERFIL (nome, email, bio, platforms, stats, banner, região) ---------
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener("click", () => {
      const novoNome  = inputUsername.value.trim();
      const novoEmail = (inputEmailPerfil ? inputEmailPerfil.value : emailInput.value).trim();
      const novaBio   = bioTextarea.value.trim();

      if (novoNome) {
        if (novoNome.length < 2 || novoNome.length > 33) {
          inputUsername.focus();
          btnSaveProfile.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Nome deve ter 2 a 33 caracteres';
          btnSaveProfile.style.background = "#ef4444";
          setTimeout(() => {
            btnSaveProfile.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Perfil';
            btnSaveProfile.style.background = "";
          }, 3000);
          return;
        }
        user.nome = novoNome;
      }
      user.email = novoEmail;
      user.bio   = novaBio;

      if (selectRegiao) {
        user.regiao = selectRegiao.value;
      }

      // Estatísticas são estritamente somente leitura e calculadas pelo sistema
      // Mantém os stats reais verificados no banco, bloqueando qualquer adulteração manual
      user.stats = user.stats || {
        disputed: 0,
        won: 0,
        wins: 0,
        losses: 0
      };

      // monta lista de plataformas selecionadas
      const plataformasSelecionadas = [];
      if (platPC && platPC.checked)      plataformasSelecionadas.push("PC");
      if (platConsole && platConsole.checked) plataformasSelecionadas.push("Console");
      if (platMobile && platMobile.checked)   plataformasSelecionadas.push("Mobile");

      user.plataformas = plataformasSelecionadas;

      if (!user.regiao) {
        user.regiao = "Brasil";
      }

      displayName.textContent = user.nome || "Usuário convidado";

      // Atualiza os textos do topo
      if (spanRegiao) {
        spanRegiao.textContent = user.regiao || "Brasil";
      }
      atualizarTextoPlataformas();

      saveUser(user);

      // Sincronizar com vh_users caso exista esse cadastro lá
      let registeredUsers = [];
      try {
        const rawReg = localStorage.getItem("vh_users");
        if (rawReg) registeredUsers = JSON.parse(rawReg);
      } catch (err) {}

      if (registeredUsers.length > 0) {
        const index = registeredUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (index !== -1) {
          registeredUsers[index].nome = user.nome;
          registeredUsers[index].bio = user.bio;
          registeredUsers[index].avatar = user.avatar;
          registeredUsers[index].plataformas = user.plataformas;
          registeredUsers[index].jogosFavoritos = user.jogosFavoritos;
          localStorage.setItem("vh_users", JSON.stringify(registeredUsers));
        }
      }

      btnSaveProfile.innerHTML = '<i class="fa-solid fa-check"></i> Salvo com sucesso!';
      btnSaveProfile.style.background = "#22c55e";
      setTimeout(() => {
        btnSaveProfile.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Perfil';
        btnSaveProfile.style.background = "";
      }, 1500);
    });
  }


  // --------- JOGOS PREFERIDOS (tags) ---------
  function renderTags() {
    if (!jogosTags) return;
    jogosTags.innerHTML = "";

    user.jogosFavoritos.forEach((nomeJogo, index) => {
      const tag = document.createElement("div");
      tag.className = "game-tag";

      const span = document.createElement("span");
      span.textContent = nomeJogo;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Remover jogo");

      btn.addEventListener("click", () => {
        user.jogosFavoritos.splice(index, 1);
        saveUser(user);
        renderTags();
      });

      tag.appendChild(span);
      tag.appendChild(btn);
      jogosTags.appendChild(tag);
    });
  }

  renderTags();

  if (jogoInput) {
    jogoInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();

        const nome = jogoInput.value.trim();
        if (!nome) return;

        if (!user.jogosFavoritos.includes(nome)) {
          user.jogosFavoritos.push(nome);
          saveUser(user);
          renderTags();
        }

        jogoInput.value = "";
      }
    });
  }


  // --------- GERENCIAMENTO DE CONQUISTAS ---------
  function renderAchievementsList() {
    if (!conquistasContainer) return;
    conquistasContainer.innerHTML = "";

    if (user.conquistas.length === 0) {
      conquistasContainer.innerHTML = `<p style="font-size: 13px; color: #9cb1cf; margin: 0;">Nenhuma conquista registrada ainda.</p>`;
      return;
    }

    user.conquistas.forEach((ach, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.background = "rgba(255,255,255,0.04)";
      row.style.padding = "10px 14px";
      row.style.borderRadius = "8px";
      row.style.border = "1px solid #1f1f2b";
      row.style.width = "100%";
      row.style.boxSizing = "border-box";
      row.style.gap = "10px";

      row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; word-break: break-word;">
          <strong style="color: #ffc107; font-size: 13px; word-break: break-word;">${ach.titulo}</strong>
          <span style="color: #cbd5e1; font-size: 11px; word-break: break-word;">${ach.desc}</span>
        </div>
        <button type="button" class="icon-edit-small" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 6px; flex-shrink: 0;" title="Remover conquista">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;

      row.querySelector("button").addEventListener("click", () => {
        user.conquistas.splice(index, 1);
        saveUser(user);
        renderAchievementsList();
      });

      conquistasContainer.appendChild(row);
    });
  }

  renderAchievementsList();

  if (btnAddAch && newAchTitle && newAchDesc) {
    btnAddAch.addEventListener("click", () => {
      const title = newAchTitle.value.trim();
      const desc = newAchDesc.value.trim();

      if (!title) {
        newAchTitle.focus();
        newAchTitle.classList.add("input-invalid");
        setTimeout(() => newAchTitle.classList.remove("input-invalid"), 2000);
        return;
      }

      user.conquistas.push({
        titulo: title,
        desc: desc || "Conquista honorificadora VersusHub.",
        data: new Date().toLocaleDateString("pt-BR")
      });

      saveUser(user);
      renderAchievementsList();

      newAchTitle.value = "";
      newAchDesc.value = "";
    });
  }


  // ========= EQUIPES DO USUÁRIO NO PERFIL =========
  async function loadUserTeams() {
    const userTeams = [];
    const userNome = (user.nome || '').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();

    // 1. Equipes criadas pelo usuário (onde ele é o líder)
    try {
      const allCreated = JSON.parse(localStorage.getItem("vh_createdTeams") || "[]");
      allCreated.forEach((team) => {
        const leaderName = (team.leaderName || '').toLowerCase().trim();
        const leaderEmail = (team.leaderEmail || '').toLowerCase().trim();
        const isLeader = (leaderName && leaderName === userNome) || (leaderEmail && leaderEmail === userEmail);
        
        if (isLeader) {
          userTeams.push({
            id: team.id,
            nome: team.nome || "Equipe sem nome",
            logo: team.logo || "/image/logo.png",
            jogos: team.jogos || "",
            regiao: team.regiao || "Brasil",
            link: team.id ? `/equipes/template_equipe.html?id=${team.id}` : (team.link || "#"),
            role: "Líder fundador"
          });
        }
      });
    } catch (e) {
      console.warn("Erro ao carregar equipes criadas:", e);
    }

    // 2. Equipes onde o usuário é membro aceito (via Supabase)
    try {
      const { supabase } = await import('/supabaseClient.js');
      if (supabase && userEmail) {
        const { data: memberships, error: memErr } = await supabase
          .from('membros_equipe')
          .select('equipe_id, status')
          .eq('user_email', userEmail)
          .eq('status', 'Aceito');

        if (memErr) {
          console.warn('Erro ao consultar membros_equipe no perfil:', memErr);
        } else if (memberships && memberships.length > 0) {
          const teamIds = memberships.map(m => m.equipe_id).filter(Boolean);

          // Busca dados das equipes no Supabase
          const { data: dbTeams, error: dbTeamsErr } = await supabase
            .from('equipes')
            .select('*')
            .in('id', teamIds);

          const mapaEquipes = {};
          if (dbTeams) {
            dbTeams.forEach(t => { mapaEquipes[t.id] = t; });
          }

          // Também checa no cache local caso a equipe esteja lá
          const allCreated = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
          allCreated.forEach(t => {
            if (!mapaEquipes[t.id]) mapaEquipes[t.id] = t;
          });

          memberships.forEach(m => {
            const eq = mapaEquipes[m.equipe_id] || { nome: 'Equipe ' + m.equipe_id, logo: '/image/logo.png', jogos: '' };
            const jaExiste = userTeams.some(t => String(t.id) === String(m.equipe_id) || (t.nome || '').toLowerCase() === (eq.nome || '').toLowerCase());
            if (!jaExiste) {
              userTeams.push({
                id: m.equipe_id,
                nome: eq.nome || 'Equipe',
                logo: eq.logo || '/image/logo.png',
                jogos: eq.jogos || '',
                link: `/equipes/template_equipe.html?id=${encodeURIComponent(m.equipe_id)}`,
                role: 'Membro'
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('Falha ao carregar equipes do membro:', err);
    }

    // 3. Equipes explicitamente salvas no objeto do usuário (fallback)
    if (Array.isArray(user.equipes)) {
      user.equipes.forEach((eq) => {
        const jaExiste = userTeams.some(t => (t.nome || '').toLowerCase() === (eq.nome || '').toLowerCase());
        if (!jaExiste) {
          userTeams.push(eq);
        }
      });
    }

    return userTeams;
  }

  async function renderTeamsProfile() {
    const container = document.getElementById("minhasEquipesList");
    const containerDynamic = document.getElementById("dynamicTeams");
    if (!container) return;

    if (containerDynamic) {
      containerDynamic.innerHTML = "";
    }

    const teams = await loadUserTeams();
    container.innerHTML = "";

    if (!teams || teams.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 16px; color: #9ca3af; font-size: 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 12px; width: 100%;">
          <i class="fa-solid fa-users-slash" style="font-size: 24px; color: #6b7280; display: block; margin-bottom: 8px;"></i>
          Você ainda não faz parte de nenhuma equipe.<br>
          <a href="/cria_equipe/criar_equipe.html" style="color: #ff3b30; font-weight: 600; text-decoration: underline; margin-top: 6px; display: inline-block;">Criar uma equipe</a> ou <a href="/equipes/equipes.html" style="color: #ff3b30; font-weight: 600; text-decoration: underline; margin-left: 6px; display: inline-block;">explorar equipes</a>
        </div>
      `;
      return;
    }

    teams.forEach((team) => {
      const card = document.createElement("div");
      card.className = "profile-team-card";

      const main = document.createElement("div");
      main.className = "profile-team-main";

      const img = document.createElement("img");
      img.className = "profile-team-logo";
      img.src = team.logo || "/image/logo.png";
      img.alt = team.nome || "Equipe";

      const textBox = document.createElement("div");
      textBox.className = "profile-team-text";

      const h3 = document.createElement("h3");
      h3.textContent = team.nome || "Equipe sem nome";

      const p = document.createElement("p");
      const jogos = team.jogos ? `Jogos: ${team.jogos}` : (team.desc || "Jogos não informados");
      const regiao = team.regiao ? ` • Região: ${team.regiao}` : "";
      const roleText = team.role ? ` • [${team.role}]` : "";
      p.textContent = jogos + regiao + roleText;

      textBox.appendChild(h3);
      textBox.appendChild(p);

      main.appendChild(img);
      main.appendChild(textBox);

      const link = document.createElement("a");
      link.href = team.link || "#";
      link.textContent = "Ver detalhes";

      card.appendChild(main);
      card.appendChild(link);

      container.appendChild(card);
    });
  }

  // chama ao carregar a página de perfil
  renderTeamsProfile();

  // ==============================================================================
  // ALTERAÇÃO DE SENHA DO USUÁRIO (Supabase Auth updateUser)
  // ==============================================================================
  const formAlterarSenhaPerfil = document.getElementById("formAlterarSenhaPerfil");
  const inputNovaSenha = document.getElementById("inputNovaSenha");
  const inputConfirmarSenha = document.getElementById("inputConfirmarSenha");
  const novaSenhaErrorMsg = document.getElementById("novaSenhaErrorMsg");
  const confirmarSenhaErrorMsg = document.getElementById("confirmarSenhaErrorMsg");
  const senhaStatusMsg = document.getElementById("senhaStatusMsg");

  // Modal de Senha
  const btnOpenChangePassword = document.getElementById("btnOpenChangePassword");
  const modalAlterarSenha = document.getElementById("modalAlterarSenha");
  const btnFecharModalSenha = document.getElementById("btnFecharModalSenha");
  const btnCancelarModalSenha = document.getElementById("btnCancelarModalSenha");
  const formModalAlterarSenha = document.getElementById("formModalAlterarSenha");
  const modalNovaSenha = document.getElementById("modalNovaSenha");
  const modalConfirmarSenha = document.getElementById("modalConfirmarSenha");
  const modalNovaSenhaError = document.getElementById("modalNovaSenhaError");
  const modalConfirmarSenhaError = document.getElementById("modalConfirmarSenhaError");
  const modalSenhaStatus = document.getElementById("modalSenhaStatus");

  function setPasswordError(input, errorEl, message) {
    if (input) input.classList.add("input-invalid");
    if (errorEl) {
      errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
      errorEl.style.display = "flex";
    }
  }

  function clearPasswordError(input, errorEl) {
    if (input) input.classList.remove("input-invalid");
    if (errorEl) {
      errorEl.innerHTML = "";
      errorEl.style.display = "none";
    }
  }

  // Validações em tempo real - Formulário da Aba
  if (inputNovaSenha) {
    inputNovaSenha.addEventListener("input", () => {
      const val = inputNovaSenha.value;
      if (val.length > 0 && val.length < 6) {
        setPasswordError(inputNovaSenha, novaSenhaErrorMsg, "A senha deve ter no mínimo 6 caracteres.");
      } else {
        clearPasswordError(inputNovaSenha, novaSenhaErrorMsg);
      }
      if (inputConfirmarSenha && inputConfirmarSenha.value) {
        if (inputConfirmarSenha.value !== val) {
          setPasswordError(inputConfirmarSenha, confirmarSenhaErrorMsg, "As senhas não coincidem.");
        } else {
          clearPasswordError(inputConfirmarSenha, confirmarSenhaErrorMsg);
        }
      }
    });
  }

  if (inputConfirmarSenha) {
    inputConfirmarSenha.addEventListener("input", () => {
      const valConfirm = inputConfirmarSenha.value;
      const valNova = inputNovaSenha ? inputNovaSenha.value : "";
      if (valConfirm.length > 0 && valConfirm !== valNova) {
        setPasswordError(inputConfirmarSenha, confirmarSenhaErrorMsg, "As senhas não coincidem.");
      } else {
        clearPasswordError(inputConfirmarSenha, confirmarSenhaErrorMsg);
      }
    });
  }

  // Validações em tempo real - Modal
  if (modalNovaSenha) {
    modalNovaSenha.addEventListener("input", () => {
      const val = modalNovaSenha.value;
      if (val.length > 0 && val.length < 6) {
        setPasswordError(modalNovaSenha, modalNovaSenhaError, "A senha deve ter no mínimo 6 caracteres.");
      } else {
        clearPasswordError(modalNovaSenha, modalNovaSenhaError);
      }
      if (modalConfirmarSenha && modalConfirmarSenha.value) {
        if (modalConfirmarSenha.value !== val) {
          setPasswordError(modalConfirmarSenha, modalConfirmarSenhaError, "As senhas não coincidem.");
        } else {
          clearPasswordError(modalConfirmarSenha, modalConfirmarSenhaError);
        }
      }
    });
  }

  if (modalConfirmarSenha) {
    modalConfirmarSenha.addEventListener("input", () => {
      const valConfirm = modalConfirmarSenha.value;
      const valNova = modalNovaSenha ? modalNovaSenha.value : "";
      if (valConfirm.length > 0 && valConfirm !== valNova) {
        setPasswordError(modalConfirmarSenha, modalConfirmarSenhaError, "As senhas não coincidem.");
      } else {
        clearPasswordError(modalConfirmarSenha, modalConfirmarSenhaError);
      }
    });
  }

  // Função centralizada para atualizar senha via Supabase Auth
  async function processarAlteracaoSenha(novaSenha, confirmarSenha, elements) {
    const { inputPass, inputConf, errPass, errConf, statusBox, submitBtn } = elements;

    clearPasswordError(inputPass, errPass);
    clearPasswordError(inputConf, errConf);
    if (statusBox) {
      statusBox.innerHTML = "";
      statusBox.style.display = "none";
      statusBox.className = "form-feedback-box";
    }

    if (!novaSenha) {
      setPasswordError(inputPass, errPass, "Por favor, digite a nova senha.");
      inputPass.focus();
      return false;
    }

    if (novaSenha.length < 6) {
      setPasswordError(inputPass, errPass, "A senha deve ter no mínimo 6 caracteres.");
      inputPass.focus();
      return false;
    }

    if (!confirmarSenha) {
      setPasswordError(inputConf, errConf, "Por favor, confirme a nova senha.");
      inputConf.focus();
      return false;
    }

    if (novaSenha !== confirmarSenha) {
      setPasswordError(inputConf, errConf, "As senhas não coincidem. Digite a mesma senha nos dois campos.");
      inputConf.focus();
      return false;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';
    }

    try {
      const { supabase } = await import('/supabaseClient.js');
      
      // 1. Atualização oficial via Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (error) {
        console.error("Erro ao alterar senha:", error);
        let msg = "Não foi possível alterar a senha. Tente novamente.";
        if (error.message.includes("Password should be") || error.message.includes("least 6")) {
          msg = "A senha deve ter no mínimo 6 caracteres.";
          setPasswordError(inputPass, errPass, msg);
        } else if (error.message) {
          msg = error.message;
        }

        if (statusBox) {
          statusBox.className = "form-feedback-box error";
          statusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
          statusBox.style.display = "flex";
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> Atualizar Senha';
        }
        return false;
      }

      // 2. Sucesso
      if (statusBox) {
        statusBox.className = "form-feedback-box success";
        statusBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> Senha atualizada com sucesso no servidor!';
        statusBox.style.display = "flex";
      }

      if (inputPass) inputPass.value = "";
      if (inputConf) inputConf.value = "";

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Senha Alterada!';
        setTimeout(() => {
          submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> Atualizar Senha';
        }, 3000);
      }

      return true;
    } catch (err) {
      console.error("Erro inesperado ao alterar senha:", err);
      if (statusBox) {
        statusBox.className = "form-feedback-box error";
        statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ocorreu um erro inesperado ao alterar a senha.';
        statusBox.style.display = "flex";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-key"></i> Atualizar Senha';
      }
      return false;
    }
  }

  // Submit do formulário na Aba Segurança
  if (formAlterarSenhaPerfil) {
    formAlterarSenhaPerfil.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nova = inputNovaSenha ? inputNovaSenha.value : "";
      const conf = inputConfirmarSenha ? inputConfirmarSenha.value : "";
      const submitBtn = formAlterarSenhaPerfil.querySelector("button[type='submit']");

      await processarAlteracaoSenha(nova, conf, {
        inputPass: inputNovaSenha,
        inputConf: inputConfirmarSenha,
        errPass: novaSenhaErrorMsg,
        errConf: confirmarSenhaErrorMsg,
        statusBox: senhaStatusMsg,
        submitBtn
      });
    });
  }

  // Abertura e fechamento do Modal de Senha
  function abrirModalSenha() {
    if (!modalAlterarSenha) return;
    modalAlterarSenha.style.display = "flex";
    if (modalNovaSenha) {
      modalNovaSenha.value = "";
      clearPasswordError(modalNovaSenha, modalNovaSenhaError);
    }
    if (modalConfirmarSenha) {
      modalConfirmarSenha.value = "";
      clearPasswordError(modalConfirmarSenha, modalConfirmarSenhaError);
    }
    if (modalSenhaStatus) {
      modalSenhaStatus.style.display = "none";
      modalSenhaStatus.innerHTML = "";
    }
    setTimeout(() => {
      if (modalNovaSenha) modalNovaSenha.focus();
    }, 100);
  }

  function fecharModalSenha() {
    if (!modalAlterarSenha) return;
    modalAlterarSenha.style.display = "none";
  }

  if (btnOpenChangePassword) {
    btnOpenChangePassword.addEventListener("click", () => {
      // Abre a aba de segurança caso esteja em desktop ou abre o modal diretamente
      const abaSegurancaBtn = document.querySelector('.tab-btn-perfil[data-target="aba-seguranca"]');
      if (window.innerWidth <= 768) {
        abrirModalSenha();
      } else if (abaSegurancaBtn) {
        abaSegurancaBtn.click();
        const sec = document.getElementById("aba-seguranca");
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
      } else {
        abrirModalSenha();
      }
    });
  }

  if (btnFecharModalSenha) btnFecharModalSenha.addEventListener("click", fecharModalSenha);
  if (btnCancelarModalSenha) btnCancelarModalSenha.addEventListener("click", fecharModalSenha);

  if (modalAlterarSenha) {
    modalAlterarSenha.addEventListener("click", (e) => {
      if (e.target === modalAlterarSenha) fecharModalSenha();
    });
  }

  // Submit do formulário no Modal
  if (formModalAlterarSenha) {
    formModalAlterarSenha.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nova = modalNovaSenha ? modalNovaSenha.value : "";
      const conf = modalConfirmarSenha ? modalConfirmarSenha.value : "";
      const submitBtn = formModalAlterarSenha.querySelector("button[type='submit']");

      const success = await processarAlteracaoSenha(nova, conf, {
        inputPass: modalNovaSenha,
        inputConf: modalConfirmarSenha,
        errPass: modalNovaSenhaError,
        errConf: modalConfirmarSenhaError,
        statusBox: modalSenhaStatus,
        submitBtn
      });

      if (success) {
        setTimeout(() => {
          fecharModalSenha();
        }, 1800);
      }
    });
  }

  // ==============================================================================
  // GERENCIAMENTO DE TORNEIOS NO PERFIL: TORNEIOS QUE PARTICIPO & CRIADOS
  // ==============================================================================

  let cachedSupabaseInstance = null;
  async function getSupabase() {
    if (!cachedSupabaseInstance) {
      try {
        const mod = await import('/supabaseClient.js');
        cachedSupabaseInstance = mod.supabase;
      } catch (err) {
        console.warn('Erro ao importar supabaseClient em perfil.js:', err);
      }
    }
    return cachedSupabaseInstance;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==============================================================================
  // SEÇÃO PÚBLICA DE TORNEIOS CRIADOS NO PERFIL
  // ==============================================================================

  const badgeNavCriados = document.getElementById('badgeNavCriados');
  const listaTorneiosCriadosEl = document.getElementById('listaTorneiosCriados');

  let dadosTorneiosCriados = null;
  let isCarregandoCriados = false;

  function atualizarBadgeTorneiosCriados(total) {
    if (badgeNavCriados) {
      badgeNavCriados.textContent = String(total);
    }
  }

  // Renderizador de Card de Torneio (Tema escuro VersusHub - Seção Pública)
  function renderCardTorneio(t, isOwnerMode) {
    const isLive = t.ao_vivo === true || (t.status && t.status.toLowerCase().includes('vivo'));
    let statusBadgeClass = t.statusClass || 'status-aberto';
    let statusText = t.status || 'Inscrições abertas';

    if (isLive) {
      statusBadgeClass = 'status-andamento';
      statusText = '<i class="fa-solid fa-tower-broadcast"></i> Ao Vivo';
    }

    const actionsHtml = isOwnerMode
      ? `
        <div class="card-torneio-actions">
          <a href="/gerenciartorneios/gerentornindex.html?id=${encodeURIComponent(t.id)}" class="btn-card-torneio-primary" title="Gerenciar torneio e inscrições">
            <i class="fa-solid fa-sliders"></i> Gerenciar
          </a>
          <a href="${t.link}" class="btn-card-torneio-secondary" title="Página do torneio">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Detalhes
          </a>
        </div>
      `
      : `
        <div class="card-torneio-actions">
          <a href="${t.link}" class="btn-card-torneio-primary" style="width: 100%; text-align: center;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Detalhes do Torneio
          </a>
        </div>
      `;

    return `
      <article class="card-torneio-perfil" data-id="${escapeHtml(t.id)}">
        <div class="card-torneio-banner">
          <img referrerpolicy="no-referrer" src="${t.banner || '/images/cerradocup.jpg'}" alt="${escapeHtml(t.nome)}" onerror="this.src='/images/cerradocup.jpg'">
          <span class="card-torneio-status-badge ${statusBadgeClass}">${statusText}</span>
        </div>
        <div class="card-torneio-info">
          <h3 class="card-torneio-title">${escapeHtml(t.nome)}</h3>
          <div class="card-torneio-meta-row">
            <span><i class="fa-solid fa-gamepad"></i> ${escapeHtml(t.jogo)}</span>
            <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(t.data)}</span>
          </div>
          ${actionsHtml}
        </div>
      </article>
    `;
  }

  // Consulta torneios organizados pelo dono do perfil no Supabase
  async function consultarTorneiosCriados(targetUser) {
    if (!targetUser) return [];
    const targetEmail = (targetUser.email || '').trim().toLowerCase();
    const targetId = targetUser.id ? String(targetUser.id) : null;

    let criadosDb = [];
    const supabase = await getSupabase();

    if (supabase && (targetEmail || targetId)) {
      // 1. Consulta segura na tabela 'torneios' por criadorEmail
      try {
        if (targetEmail) {
          const { data, error } = await supabase
            .from('torneios')
            .select('*')
            .ilike('criadorEmail', targetEmail)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            criadosDb.push(...data);
          } else if (error) {
            console.warn('Aviso ao consultar torneios criados por criadorEmail:', error);
          }
        }
      } catch (errEmail) {
        console.warn('Exceção ao consultar torneios por criadorEmail:', errEmail);
      }

      // 2. Fallback complementar por criador_id se disponível
      if (criadosDb.length === 0 && targetId) {
        try {
          const { data: idData } = await supabase
            .from('torneios')
            .select('*')
            .eq('criador_id', targetId)
            .order('created_at', { ascending: false });

          if (Array.isArray(idData)) {
            idData.forEach(d => {
              if (!criadosDb.some(x => String(x.id) === String(d.id))) {
                criadosDb.push(d);
              }
            });
          }
        } catch (errId) {}
      }
    }

    // 3. Se for o dono do perfil, mescla com cache local de torneios criados recentemente
    if (isOwner) {
      try {
        const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
        const userLocal = allLocal.filter(t => {
          const cEmail = (t.criadorEmail || t.criador_email || t.organizador_email || t.user_email || '').toLowerCase().trim();
          return !cEmail || cEmail === targetEmail;
        });

        userLocal.forEach(loc => {
          if (!criadosDb.some(d => String(d.id) === String(loc.id))) {
            criadosDb.push(loc);
          }
        });
      } catch (eLocalCriados) {}
    }

    return criadosDb.map(t => ({
      id: t.id,
      nome: t.nome || 'Torneio sem nome',
      jogo: t.jogo || 'Competitivo',
      data: t.data || 'Data a definir',
      status: t.status || 'Inscrições abertas',
      statusClass: t.statusClass || (
        t.status && t.status.toLowerCase().includes('andamento') ? 'status-andamento' :
        t.status && t.status.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto'
      ),
      banner: t.banner || '/images/cerradocup.jpg',
      link: t.link || ('/torneio/custom.html?id=' + encodeURIComponent(t.id)),
      ao_vivo: t.ao_vivo || false
    }));
  }

  // Atualização de UI: Torneios Criados
  async function carregarTorneiosCriadosEAtualizarUI(forceReload = false) {
    if (!listaTorneiosCriadosEl) return;
    if (isCarregandoCriados) return;
    if (dadosTorneiosCriados !== null && !forceReload) {
      atualizarBadgeTorneiosCriados(dadosTorneiosCriados.length);
      return;
    }

    isCarregandoCriados = true;
    listaTorneiosCriadosEl.innerHTML = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; color: #9ca3af; text-align: center;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
        <span style="font-size: 15px; font-weight: 600; color: #f3f4f6;">Carregando torneios criados...</span>
      </div>
    `;

    try {
      const lista = await consultarTorneiosCriados(user);
      dadosTorneiosCriados = lista;
      atualizarBadgeTorneiosCriados(lista.length);

      if (lista.length === 0) {
        if (isOwner) {
          listaTorneiosCriadosEl.innerHTML = `
            <div class="empty-state-torneios">
              <div class="empty-state-icon-box">
                <i class="fa-solid fa-trophy"></i>
              </div>
              <h3 class="empty-state-title">Você ainda não criou nenhum torneio</h3>
              <p class="empty-state-desc">
                Organize seus próprios campeonatos de e-sports, configure regras, aprove inscrições de jogadores e transmita partidas ao vivo!
              </p>
              <a href="/criar_torneio/criar_torneio.html" class="btn-perfil-empty-cta">
                <i class="fa-solid fa-plus"></i> Criar Torneio Agora
              </a>
            </div>
          `;
        } else {
          const nomeDono = user.nome || 'Este organizador';
          listaTorneiosCriadosEl.innerHTML = `
            <div class="empty-state-torneios">
              <div class="empty-state-icon-box">
                <i class="fa-solid fa-trophy"></i>
              </div>
              <h3 class="empty-state-title">Nenhum torneio criado ainda</h3>
              <p class="empty-state-desc">
                ${escapeHtml(nomeDono)} ainda não possui campeonatos públicos cadastrados no VersusHub.
              </p>
              <a href="/pagina_inicial/torneios.html" class="btn-perfil-empty-cta">
                <i class="fa-solid fa-compass"></i> Explorar Catálogo de Torneios
              </a>
            </div>
          `;
        }
      } else {
        listaTorneiosCriadosEl.innerHTML = lista.map(t => renderCardTorneio(t, isOwner)).join('');
      }
    } catch (err) {
      console.error('Erro ao carregar torneios criados:', err);
      listaTorneiosCriadosEl.innerHTML = `
        <div class="empty-state-torneios">
          <div class="empty-state-icon-box" style="border-color: #ef4444; color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="empty-state-title">Não foi possível carregar os torneios</h3>
          <p class="empty-state-desc">Verifique sua conexão ou tente novamente mais tarde.</p>
          <a href="/pagina_inicial/torneios.html" class="btn-perfil-empty-cta">
            <i class="fa-solid fa-compass"></i> Explorar Torneios
          </a>
        </div>
      `;
    } finally {
      isCarregandoCriados = false;
    }
  }

  // Pré-carregamento em background para exibir as contagens nas abas do perfil
  setTimeout(() => {
    carregarTorneiosCriadosEAtualizarUI();
  }, 100);

  // Tratamento de hash direto na URL (ex: perfil.html#torneios-criados ou #criados)
  const currentHash = window.location.hash.toLowerCase();
  if (currentHash === '#criados' || currentHash === '#torneios-criados' || currentHash === '#torneios') {
    const btn = document.querySelector(".tab-btn-perfil[data-target='aba-torneios-criados']");
    if (btn) btn.click();
  }
});

