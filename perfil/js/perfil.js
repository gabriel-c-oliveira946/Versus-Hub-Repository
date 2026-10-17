// /perfil/js/perfil.js
window.__perfilJsLoaded = true;

// Limpeza preventiva total de equipes e torneios estáticos






document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "vh_loggedUser";
  const USER_FIELDS = 'id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas';

  // --------- UTILIDADES ---------

  function loadUser() {
    let u = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) u = JSON.parse(raw);
    } catch (err) {
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
      u.stats = {
        disputed: safeNum(u.torneios_disputados || 0),
        won: safeNum(u.primeiro_lugar || 0),
        wins: safeNum(u.vitorias || 0),
        losses: safeNum(u.derrotas || 0),
        points: safeNum(u.pontos || u.pontuacao_total || 0)
      };
    } else {
      if (u.stats.disputed === 10 && u.stats.won === 3 && u.stats.wins === 22 && u.stats.losses === 12) {
        u.stats = { disputed: 0, won: 0, wins: 0, losses: 0, points: 0 };
      }
      if (typeof u.stats.disputed === "undefined") u.stats.disputed = safeNum(u.torneios_disputados || 0);
      if (typeof u.stats.won === "undefined") u.stats.won = safeNum(u.primeiro_lugar || 0);
      if (typeof u.stats.wins === "undefined") u.stats.wins = safeNum(u.vitorias || 0);
      if (typeof u.stats.losses === "undefined") u.stats.losses = safeNum(u.derrotas || 0);
      if (typeof u.stats.points === "undefined") u.stats.points = safeNum(u.pontos || u.pontuacao_total || 0);
    }
    
    if (!Array.isArray(u.conquistas)) {
      u.conquistas = [];
    }

    return u;
  }

  // Função auxiliar de compressão de imagem via HTML5 Canvas (máx 200x200px para avatar, JPEG 0.6)
  function compressImage(file, maxWidth = 200, maxHeight = 200, quality = 0.6) {
    return new Promise((resolve) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#141419';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  // Renderiza rigorosamente as estatísticas do usuário nos inputs e cards da tela
  function renderUserStatsCards(target) {
    if (!target) return;
    let raw = target.stats || {};
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
    const disputed = safeNum(raw.disputed ?? target.torneios_disputados ?? target.disputed ?? 0);
    const won = safeNum(raw.won ?? target.primeiro_lugar ?? target.torneios_vencidos ?? 0);
    const wins = safeNum(raw.wins ?? target.vitorias ?? target.wins ?? 0);
    const losses = safeNum(raw.losses ?? target.derrotas ?? target.losses ?? 0);
    const points = safeNum(raw.points ?? target.pontos ?? target.pontuacao_total ?? target.points ?? 0);
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const elDisputed = document.getElementById('statsDisputed');
    const elWon = document.getElementById('statsWon');
    const elWins = document.getElementById('statsWins');
    const elLosses = document.getElementById('statsLosses');
    const elWinRate = document.getElementById('statsWinRate');
    const elPoints = document.getElementById('statsPontosVal');
    const headerPts = document.getElementById('headerPointsText');

    if (elDisputed) {
      elDisputed.value = disputed;
      elDisputed.defaultValue = disputed;
      elDisputed.readOnly = true;
    }
    if (elWon) {
      elWon.value = won;
      elWon.defaultValue = won;
      elWon.readOnly = true;
    }
    if (elWins) {
      elWins.value = wins;
      elWins.defaultValue = wins;
      elWins.readOnly = true;
    }
    if (elLosses) {
      elLosses.value = losses;
      elLosses.defaultValue = losses;
      elLosses.readOnly = true;
    }
    if (elWinRate) {
      elWinRate.value = `${winRate}%`;
      elWinRate.defaultValue = `${winRate}%`;
      elWinRate.readOnly = true;
    }

    const formattedPts = `${points.toLocaleString('pt-BR')} pts`;
    if (elPoints) elPoints.textContent = formattedPts;
    if (headerPts) headerPts.textContent = formattedPts;
  }

  // Identificação e tratamento de violação de unicidade de nickname (código 23505 ou duplicate key)
  function isNicknameDuplicateError(err) {
    if (!err) return false;
    const code = String(err.code || '');
    const msg = String(err.message || '').toLowerCase();
    const details = String(err.details || '').toLowerCase();
    const hint = String(err.hint || '').toLowerCase();

    const isDuplicate = code === '23505' ||
      msg.includes('23505') ||
      msg.includes('duplicate key') ||
      details.includes('duplicate key') ||
      hint.includes('duplicate key') ||
      msg.includes('unique constraint') ||
      details.includes('unique constraint');

    if (!isDuplicate) return false;

    // Se o erro for especificamente apenas de e-mail e não envolver o nome/nickname
    if ((msg.includes('email') || details.includes('email')) && !msg.includes('nome') && !details.includes('nome') && !msg.includes('nickname') && !details.includes('nickname')) {
      return false;
    }
    return true;
  }

  function mostrarErroNicknamePerfil(msg) {
    const errEl = document.getElementById('usernameProfileErrorMsg');
    if (errEl) {
      errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
      errEl.style.display = 'flex';
    }
    if (inputUsername) {
      inputUsername.classList.add('input-invalid');
      inputUsername.focus();
    }
    if (btnSaveProfile) {
      btnSaveProfile.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Nickname em uso';
      btnSaveProfile.style.background = '#ef4444';
      btnSaveProfile.disabled = false;
      setTimeout(() => {
        btnSaveProfile.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Perfil';
        btnSaveProfile.style.background = '';
      }, 4000);
    }
  }

  function limparErroNicknamePerfil() {
    const errEl = document.getElementById('usernameProfileErrorMsg');
    if (errEl) {
      errEl.innerHTML = '';
      errEl.style.display = 'none';
    }
    if (inputUsername) {
      inputUsername.classList.remove('input-invalid');
    }
  }

  async function syncUserWithSupabase(u) {
    if (!u) return { success: false };
    try {
      const { supabase, ensureUserProfile } = await import('/supabaseClient.js');
      const email = (u.email || '').toLowerCase().trim();
      const userId = u.id;

      // 1. Garante que a linha do usuário exista na tabela 'usuarios' antes de atualizar
      if (ensureUserProfile) {
        try {
          await ensureUserProfile({
            id: userId,
            email: email,
            user_metadata: { nome: u.nome, avatar_url: u.avatar }
          });
        } catch (eEns) {
          if (isNicknameDuplicateError(eEns)) {
            return { error: eEns, isDuplicateNickname: true };
          }
        }
      }

      const payload = {
        nome: u.nome,
        bio: u.bio,
        avatar: u.avatar,
        banner: u.banner,
        regiao: u.regiao,
        plataformas: u.plataformas,
        jogosFavoritos: u.jogosFavoritos
      };

      let updateError = null;
      if (userId) {
        const res = await supabase.from('usuarios').update(payload).eq('id', userId);
        updateError = res.error;
      } else if (email) {
        const res = await supabase.from('usuarios').update(payload).eq('email', email);
        updateError = res.error;
      }

      // Se a linha não existia ou o update falhou
      if (updateError) {
        if (isNicknameDuplicateError(updateError)) {
          return { error: updateError, isDuplicateNickname: true };
        }
        const upsertPayload = {
          id: userId || undefined,
          email: email,
          ...payload
        };
        const upsertRes = await supabase.from('usuarios').upsert(upsertPayload, { onConflict: 'email' });
        if (upsertRes.error) {
          if (isNicknameDuplicateError(upsertRes.error)) {
            return { error: upsertRes.error, isDuplicateNickname: true };
          }
          return { error: upsertRes.error };
        }
      }
      return { success: true };
    } catch (err) {
      if (isNicknameDuplicateError(err)) {
        return { error: err, isDuplicateNickname: true };
      }
      return { error: err };
    }
  }

  async function saveUser(u) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch (err) {
    }
    return await syncUserWithSupabase(u);
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

    // Renderiza cards e inputs com os dados reais
    renderUserStatsCards(targetUser);
    // Ranking e Pontuação
    updateUserRankingDisplay(targetUser);

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
      configurarConviteEquipePerfil(targetUser);
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

  // Consulta Obrigatória ao Supabase no Carregamento Inicial (DOMContentLoaded):
  import('/supabaseClient.js').then(async ({ supabase }) => {
    try {
      if (hasUrlTarget) {
        let dbUser = null;
        const targetVal = (paramId || paramEmail || '').trim();
        if (targetVal) {
          if (targetVal.includes('@')) {
            try {
              const { data } = await supabase
                .from('usuarios')
                .select(USER_FIELDS)
                .ilike('email', targetVal)
                .maybeSingle();
              if (data) dbUser = data;
            } catch (eEmail) {
            }
          } else {
            try {
              const { data, error } = await supabase
                .from('usuarios')
                .select(USER_FIELDS)
                .eq('id', targetVal)
                .maybeSingle();
              if (data && !error) dbUser = data;
            } catch (eId) {
            }
          }
          if (!dbUser) {
            try {
              const cleanVal = targetVal.replace(/\[.*?\]/g, '').trim();
              const { data: dataFallback } = await supabase
                .from('usuarios')
                .select(USER_FIELDS)
                .or(`email.ilike.${targetVal},nome.ilike.%${cleanVal}%`)
                .maybeSingle();
              if (dataFallback) dbUser = dataFallback;
            } catch (eFb) {
            }
          }
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
        let authEmail = '';
        let authId = '';
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData && sessionData.session && sessionData.session.user) {
            authEmail = (sessionData.session.user.email || '').toLowerCase().trim();
            authId = sessionData.session.user.id || '';
          }
        } catch (eAuth) {}

        const userEmail = authEmail || (loggedUser?.email || '').toLowerCase().trim();
        const userId = authId || loggedUser?.id || '';
        const userName = (loggedUser?.nome || '').trim();

        let usuario = null;
        // 1. Consulta prioritária por e-mail:
        if (userEmail) {
          const { data } = await supabase
            .from('usuarios')
            .select(USER_FIELDS)
            .ilike('email', userEmail)
            .maybeSingle();
          if (data) usuario = data;
        }
        // 2. Consulta de fallback por id:
        if (!usuario && userId) {
          const { data } = await supabase
            .from('usuarios')
            .select(USER_FIELDS)
            .eq('id', userId)
            .maybeSingle();
          if (data) usuario = data;
        }
        // 3. Consulta de fallback por nome/nickname (exato e limpo sem tags de admin):
        if (!usuario && userName && userName !== 'Usuário convidado') {
          const cleanName = userName.replace(/\[.*?\]/g, '').trim();
          const { data: dataName } = await supabase
            .from('usuarios')
            .select(USER_FIELDS)
            .ilike('nome', `%${cleanName}%`)
            .maybeSingle();
          if (dataName) usuario = dataName;
        }

        if (usuario) {
          user = { ...user, ...usuario };
          // Atualiza a chave vh_loggedUser do localStorage com o objeto atualizado vindo do Supabase
          localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        }
      }

      // Renderiza os cards e inputs imediatamente com os dados atualizados do banco
      renderUserStatsCards(user);
      atualizarInterfaceDonoPerfil(user, isOwner);
      await updateUserRankingDisplay(user);
      carregarTorneiosCriadosEAtualizarUI(true);
      carregarTorneiosFavoritos(true);
    } catch (e) {
      renderUserStatsCards(user);
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
  const statsWinRate      = document.getElementById("statsWinRate");

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
      if (targetId === "tabFavoritos") {
        carregarTorneiosFavoritos();
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

  // Renderiza estatísticas iniciais
  renderUserStatsCards(user);

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
  async function handleAvatarFile(file) {
    if (!file) return;
    if (avatarUploadHint) avatarUploadHint.textContent = `Processando foto: ${file.name}...`;
    try {
      const dataUrl = await compressImage(file, 200, 200, 0.6);
      if (!dataUrl) return;

      imgProfile.style.backgroundImage = `url('${dataUrl}')`;
      if (headerUserImg) headerUserImg.src = dataUrl;
      if (avatarPreviewImg) avatarPreviewImg.src = dataUrl;
      if (avatarUploadHint) avatarUploadHint.textContent = `Foto salva: ${file.name}`;

      user.avatar = dataUrl;
      if (window.setCachedImage && user.email) {
        window.setCachedImage(`user_avatar_${user.email}`, dataUrl);
      }
      saveUser(user);
    } catch (err) {
    }
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
  async function handleBannerFile(file) {
    if (!file) return;
    if (bannerUploadHint) bannerUploadHint.textContent = `Processando banner: ${file.name}...`;
    try {
      const dataUrl = await compressImage(file, 600, 300, 0.6);
      if (!dataUrl) return;

      if (bannerPreviewImg) {
        bannerPreviewImg.src = dataUrl;
        bannerPreviewImg.style.display = "block";
      }
      if (bannerPlaceholder) {
        bannerPlaceholder.style.display = "none";
      }
      if (bannerUploadHint) {
        bannerUploadHint.textContent = `Banner salvo: ${file.name}`;
      }
      user.banner = dataUrl;
      if (window.setCachedImage && user.email) {
        window.setCachedImage(`user_banner_${user.email}`, dataUrl);
      }
      saveUser(user);
    } catch (err) {
    }
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

  if (inputUsername) {
    inputUsername.addEventListener("input", limparErroNicknamePerfil);
    inputUsername.addEventListener("blur", async () => {
      const val = inputUsername.value.trim();
      const nomeAtual = (user.nome || '').trim();
      if (val && val.length >= 2 && val.length <= 33 && val.toLowerCase() !== nomeAtual.toLowerCase()) {
        try {
          const { supabase } = await import('/supabaseClient.js');
          const { data: existingPlayer, error: checkErr } = await supabase
            .from('usuarios')
            .select('id, email, nome')
            .ilike('nome', val)
            .maybeSingle();

          if (checkErr && isNicknameDuplicateError(checkErr)) {
            mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
            return;
          }

          if (existingPlayer && existingPlayer.nome && existingPlayer.nome.toLowerCase() === val.toLowerCase()) {
            const currentEmail = (user.email || '').toLowerCase().trim();
            const currentId = user.id;
            const isOtherUser = (existingPlayer.email && existingPlayer.email.toLowerCase() !== currentEmail) ||
                                (existingPlayer.id && currentId && existingPlayer.id !== currentId);
            if (isOtherUser) {
              mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
            }
          }
        } catch (e) {
          if (isNicknameDuplicateError(e)) {
            mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
          }
        }
      }
    });
  }

  // --------- SALVAR PERFIL (nome, email, bio, platforms, stats, banner, região) ---------
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener("click", async () => {
      limparErroNicknamePerfil();
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

        // Validação de unicidade se o usuário alterou seu nickname
        const nomeAtual = (user.nome || '').trim();
        if (novoNome.toLowerCase() !== nomeAtual.toLowerCase()) {
          try {
            btnSaveProfile.disabled = true;
            btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validando nickname...';

            const { supabase } = await import('/supabaseClient.js');
            const { data: existingPlayer, error: checkErr } = await supabase
              .from('usuarios')
              .select('id, email, nome')
              .ilike('nome', novoNome)
              .maybeSingle();

            if (checkErr && isNicknameDuplicateError(checkErr)) {
              mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
              return;
            }

            if (existingPlayer && existingPlayer.nome && existingPlayer.nome.toLowerCase() === novoNome.toLowerCase()) {
              const currentEmail = (user.email || '').toLowerCase().trim();
              const currentId = user.id;
              const isOtherUser = (existingPlayer.email && existingPlayer.email.toLowerCase() !== currentEmail) ||
                                  (existingPlayer.id && currentId && existingPlayer.id !== currentId);
              if (isOtherUser) {
                mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
                return;
              }
            }
          } catch (eNick) {
            if (isNicknameDuplicateError(eNick)) {
              mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
              return;
            }
          } finally {
            btnSaveProfile.disabled = false;
          }
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

      btnSaveProfile.disabled = true;
      btnSaveProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

      const syncResult = await saveUser(user);

      if (syncResult && syncResult.isDuplicateNickname) {
        mostrarErroNicknamePerfil('Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
        return;
      }

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

      btnSaveProfile.disabled = false;
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


  // --------- PONTUAÇÃO GLOBAL E RANKING DO USUÁRIO (FONTE ÚNICA DE VERDADE: SUPABASE) ---------
  function safeNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function escapeHtml(str) { return escapeHtml(str); }

function normalizeText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

  async function updateUserRankingDisplay(targetUser) {
    if (!targetUser) return;
    const headerPointsText = document.getElementById('headerPointsText');
    const headerRankPosition = document.getElementById('headerRankPosition');
    const statsPontosVal = document.getElementById('statsPontosVal');
    const statsRankPosValText = document.getElementById('statsRankPosValText');

    const targetEmail = (targetUser.email || '').toLowerCase().trim();
    const targetId = String(targetUser.id || '').trim();
    const targetName = (targetUser.nome || '').toLowerCase().trim();

    let computedPoints = 0;
    let rankPositionText = '#-- no Ranking';

    let torneiosDisputados = 0;
    let primeiroLugar = 0;
    let vitorias = 0;
    let derrotas = 0;
    let winRate = 0;

    try {
      const { supabase } = await import('/supabaseClient.js');

      // 1. Consulta em tempo real à tabela public.usuarios (Fonte Única de Verdade)
      let dbUser = null;
      if (targetId) {
        if (targetId.includes('@')) {
          const { data } = await supabase.from('usuarios').select(USER_FIELDS).ilike('email', targetId.trim()).maybeSingle();
          if (data) dbUser = data;
        } else {
          const { data } = await supabase.from('usuarios').select(USER_FIELDS).eq('id', targetId).maybeSingle();
          if (data) dbUser = data;
        }
      }
      if (!dbUser && targetEmail) {
        const { data } = await supabase.from('usuarios').select(USER_FIELDS).ilike('email', targetEmail).maybeSingle();
        if (data) dbUser = data;
      }
      if (!dbUser && targetName) {
        const { data } = await supabase.from('usuarios').select(USER_FIELDS).ilike('nome', targetName).maybeSingle();
        if (data) dbUser = data;
      }

      const dataSource = dbUser || targetUser;
      let rawStats = dataSource.stats || {};
      if (typeof rawStats === 'string') {
        try { rawStats = JSON.parse(rawStats); } catch { rawStats = {}; }
      }

      // 1.1 Recupera valores atualizados com tratamento unificado e fallback seguro entre colunas e JSON stats
      // 1.1 Recupera estatísticas com prioridade estrita ao objeto JSONB stats:
      computedPoints = safeNum(rawStats.points ?? dataSource.pontos ?? dataSource.pontuacao_total ?? dataSource.points ?? 0);
      torneiosDisputados = safeNum(rawStats.disputed ?? dataSource.torneios_disputados ?? dataSource.disputed ?? 0);
      vitorias = safeNum(rawStats.wins ?? dataSource.vitorias ?? dataSource.wins ?? 0);
      derrotas = safeNum(rawStats.losses ?? dataSource.derrotas ?? dataSource.losses ?? 0);
      primeiroLugar = safeNum(rawStats.won ?? dataSource.primeiro_lugar ?? dataSource.torneios_vencidos ?? dataSource.won ?? 0);

      const totalPartidas = vitorias + derrotas;
      winRate = totalPartidas > 0 ? Math.round((vitorias / totalPartidas) * 100) : 0;

      // 2. Consulta da tabela 'usuarios' selecionando APENAS colunas existentes no Supabase
      const { data: dbUsers } = await supabase
        .from('usuarios')
        .select('id, email, nome, stats');

      let rankingList = [];
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
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

      // Garante que o usuário alvo está presente na lista do ranking
      const jaExiste = rankingList.some(item =>
        (targetId && item.id === targetId) ||
        (targetEmail && item.email === targetEmail) ||
        (targetName && item.nome.toLowerCase() === targetName)
      );
      if (!jaExiste) {
        rankingList.push({
          id: targetId,
          email: targetEmail,
          nome: targetUser.nome || targetName,
          pontos: computedPoints,
          vitorias: vitorias
        });
      }

      // Realize a ordenação por pontos e vitórias:
      rankingList.sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || a.nome.localeCompare(b.nome));

      // Calcule a posição real do usuário na lista ordenada (index + 1)
      const foundIdx = rankingList.findIndex(item => 
        (targetId && item.id === targetId) ||
        (targetEmail && item.email === targetEmail) ||
        (targetName && item.nome.toLowerCase() === targetName)
      );

      if (foundIdx !== -1) {
        rankPositionText = `#${foundIdx + 1} no Ranking`;
      } else {
        rankPositionText = rankingList.length > 0 ? `#${rankingList.length + 1} no Ranking` : '#1 no Ranking';
      }

      // Sincroniza o objeto do usuário na memória para consistência
      targetUser.pontos = computedPoints;
      targetUser.pontuacao_total = computedPoints;
      targetUser.torneios_disputados = torneiosDisputados;
      targetUser.vitorias = vitorias;
      targetUser.derrotas = derrotas;
      targetUser.primeiro_lugar = primeiroLugar;
      targetUser.stats = {
        disputed: torneiosDisputados,
        won: primeiroLugar,
        wins: vitorias,
        losses: derrotas,
        points: computedPoints
      };

      if (isOwner) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(targetUser));
        } catch (e) {}
      }
    } catch (err) {
      computedPoints = safeNum(targetUser.stats?.points ?? targetUser.pontos ?? 0);
      torneiosDisputados = safeNum(targetUser.stats?.disputed ?? targetUser.torneios_disputados ?? 0);
      vitorias = safeNum(targetUser.stats?.wins ?? targetUser.vitorias ?? 0);
      derrotas = safeNum(targetUser.stats?.losses ?? targetUser.derrotas ?? 0);
      primeiroLugar = safeNum(targetUser.stats?.won ?? targetUser.primeiro_lugar ?? 0);
      const totalPartidasFallback = vitorias + derrotas;
      winRate = totalPartidasFallback > 0 ? Math.round((vitorias / totalPartidasFallback) * 100) : 0;
      rankPositionText = '#1 no Ranking';
    }

    // 3. Atualização Simultânea de Todos os Elementos do Perfil
    const formattedPts = `${computedPoints.toLocaleString('pt-BR')} pts`;

    // 3.1 Badge do Cabeçalho: '[X] pts | #[Y] no Ranking'
    if (headerPointsText) headerPointsText.textContent = formattedPts;
    if (headerRankPosition) headerRankPosition.textContent = rankPositionText;

    // 3.2 Card Pontuação Global no Ranking:
    if (statsPontosVal) statsPontosVal.textContent = formattedPts;
    if (statsRankPosValText) statsRankPosValText.textContent = rankPositionText;

    // 3.3 Estatísticas de Desempenho (Vitórias, Derrotas, Taxa de Vitória, Torneios Disputados e Vencidos):
    const elDisputed = document.getElementById('statsDisputed');
    const elWon = document.getElementById('statsWon');
    const elWins = document.getElementById('statsWins');
    const elLosses = document.getElementById('statsLosses');
    const elWinRate = document.getElementById('statsWinRate');

    if (elDisputed) elDisputed.value = torneiosDisputados;
    if (elWon)      elWon.value      = primeiroLugar;
    if (elWins)     elWins.value     = vitorias;
    if (elLosses)   elLosses.value   = derrotas;
    if (elWinRate)  elWinRate.value  = `${winRate}%`;
  }

  


  // ========= EQUIPES DO USUÁRIO NO PERFIL =========
  async function loadUserTeams() {
    const userTeams = [];
    const userNome = (user.nome || '').toLowerCase().trim();
    const userEmail = (user.email || '').toLowerCase().trim();

    try {
      const { supabase } = await import('/supabaseClient.js');
      if (supabase) {
        // 1. Equipes do Supabase onde o usuário é o líder
        if (userEmail || user.nome) {
          let query = supabase.from('equipes').select('id, nome, logo, jogos, regiao, tag, leaderEmail, leaderName');
          if (userEmail && user.nome) {
            query = query.or('leaderEmail.ilike.' + userEmail + ',leaderName.ilike.' + user.nome);
          } else if (userEmail) {
            query = query.ilike('leaderEmail', userEmail);
          } else if (user.nome) {
            query = query.ilike('leaderName', user.nome);
          }
          const { data: leaderTeams } = await query;
          if (leaderTeams && Array.isArray(leaderTeams)) {
            leaderTeams.forEach(team => {
              if (!userTeams.some(t => String(t.id) === String(team.id))) {
                userTeams.push({
                  id: team.id,
                  nome: team.nome || 'Equipe sem nome',
                  logo: team.logo || '/image/logo.png',
                  jogos: team.jogos || '',
                  regiao: team.regiao || 'Brasil',
                  link: team.id ? ('/equipes/template_equipe.html?id=' + encodeURIComponent(team.id)) : '#',
                  role: 'Líder fundador'
                });
              }
            });
          }
        }

        // 2. Equipes onde o usuário é membro aceito (membros_equipe)
        if (userEmail) {
          const { data: memberships } = await supabase
            .from('membros_equipe')
            .select('equipe_id, status')
            .eq('user_email', userEmail)
            .eq('status', 'Aceito');

          if (memberships && memberships.length > 0) {
            const teamIds = memberships.map(m => m.equipe_id).filter(Boolean);
            const { data: dbTeams } = await supabase
              .from('equipes')
              .select('id, nome, logo, jogos, regiao, tag, leaderEmail, leaderName')
              .in('id', teamIds);

            if (dbTeams && Array.isArray(dbTeams)) {
              dbTeams.forEach(team => {
                if (!userTeams.some(t => String(t.id) === String(team.id))) {
                  userTeams.push({
                    id: team.id,
                    nome: team.nome || 'Equipe sem nome',
                    logo: team.logo || '/image/logo.png',
                    jogos: team.jogos || '',
                    regiao: team.regiao || 'Brasil',
                    link: team.id ? ('/equipes/template_equipe.html?id=' + encodeURIComponent(team.id)) : '#',
                    role: 'Membro'
                  });
                }
              });
            }
          }
        }
      }
    } catch (e) {
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
    container.setAttribute("aria-busy", "false");
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
      }
    }
    return cachedSupabaseInstance;
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

    const tournamentLink = t.link || `/torneio/custom.html?id=${encodeURIComponent(t.id)}`;
    const actionsHtml = isOwnerMode
      ? `
        <div class="card-torneio-actions">
          <a href="/gerenciartorneios/gerentornindex.html?id=${encodeURIComponent(t.id)}" class="btn-card-torneio-primary" title="Gerenciar torneio e inscrições">
            <i class="fa-solid fa-sliders"></i> Gerenciar
          </a>
          <a href="${tournamentLink}" class="btn-card-torneio-secondary" title="Página do torneio">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Detalhes
          </a>
        </div>
      `
      : `
        <div class="card-torneio-actions">
          <a href="${tournamentLink}" class="btn-card-torneio-primary" style="width: 100%; text-align: center;">
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

  // --------- SEÇÃO DE TORNEIOS FAVORITOS ---------
  let dadosTorneiosFavoritos = null;
  let isCarregandoFavoritos = false;

  async function carregarTorneiosFavoritos(forceReload = false) {
    const listaEl = document.getElementById("listaTorneiosFavoritos");
    if (!listaEl) return;
    if (isCarregandoFavoritos) return;
    if (dadosTorneiosFavoritos !== null && !forceReload) {
      return;
    }

    isCarregandoFavoritos = true;
    listaEl.setAttribute('aria-busy', 'true');
    listaEl.innerHTML = `
      <div class="card-torneio skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-img"></div>
        <div class="card-info">
          <div class="skeleton-shimmer skeleton-card-line title"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
          <div class="skeleton-shimmer skeleton-card-btn"></div>
        </div>
      </div>
      <div class="card-torneio skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-img"></div>
        <div class="card-info">
          <div class="skeleton-shimmer skeleton-card-line title"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
          <div class="skeleton-shimmer skeleton-card-btn"></div>
        </div>
      </div>
    `;

    try {
      const supabase = await getSupabase();
      if (!supabase) {
        throw new Error('Supabase indisponível');
      }

      // Obtém e-mail do usuário logado
      let userEmail = (user && user.email ? user.email : (loggedUser && loggedUser.email ? loggedUser.email : '')).trim().toLowerCase();
      if (!userEmail) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user && session.user.email) {
            userEmail = session.user.email.trim().toLowerCase();
          }
        } catch (eAuth) {}
      }

      if (!userEmail) {
        listaEl.innerHTML = `
          <div class="empty-state-torneios">
            <div class="empty-state-icon-box" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08);">
              <i class="fa-solid fa-heart-crack"></i>
            </div>
            <h3 class="empty-state-title">Nenhum torneio favoritado</h3>
            <p class="empty-state-desc">
              Você ainda não favoritou nenhum torneio. Clique no coração de um torneio para salvá-lo aqui!
            </p>
            <a href="/pagina_inicial/torneios.html" class="btn-perfil-empty-cta">
              <i class="fa-solid fa-compass"></i> Explorar Torneios
            </a>
          </div>
        `;
        isCarregandoFavoritos = false;
        return;
      }

      // 1. Consulte a tabela 'curtidas' no Supabase para o user_email do usuário logado
      const { data: curtidas, error: errCurtidas } = await supabase
        .from('curtidas')
        .select('torneio_id')
        .ilike('user_email', userEmail);

      if (errCurtidas) {
        console.error('Erro ao consultar curtidas do usuário:', errCurtidas);
      }

      const arrayDeIdsTorneios = [...new Set((curtidas || []).map(c => c.torneio_id).filter(Boolean))];

      // Atualiza badge de favoritos na aba
      const badgeFavoritos = document.getElementById('badgeNavFavoritos');
      if (badgeFavoritos) {
        if (arrayDeIdsTorneios.length > 0) {
          badgeFavoritos.textContent = String(arrayDeIdsTorneios.length);
          badgeFavoritos.style.display = 'inline-flex';
        } else {
          badgeFavoritos.style.display = 'none';
        }
      }

      // Se lista vazia, exiba mensagem informativa
      if (arrayDeIdsTorneios.length === 0) {
        dadosTorneiosFavoritos = [];
        listaEl.innerHTML = `
          <div class="empty-state-torneios">
            <div class="empty-state-icon-box" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08);">
              <i class="fa-solid fa-heart-crack"></i>
            </div>
            <h3 class="empty-state-title">Nenhum torneio favoritado</h3>
            <p class="empty-state-desc">
              Você ainda não favoritou nenhum torneio. Clique no coração de um torneio para salvá-lo aqui!
            </p>
            <a href="/pagina_inicial/torneios.html" class="btn-perfil-empty-cta">
              <i class="fa-solid fa-compass"></i> Explorar Torneios
            </a>
          </div>
        `;
        isCarregandoFavoritos = false;
        return;
      }

      // 2. Recupere os torneios correspondentes na tabela 'torneios' (.in('id', arrayDeIdsTorneios))
      const { data: torneiosData, error: errTorneios } = await supabase
        .from('torneios')
        .select('*')
        .in('id', arrayDeIdsTorneios);

      if (errTorneios) {
        console.error('Erro ao buscar torneios favoritados:', errTorneios);
        throw errTorneios;
      }

      const lista = (torneiosData || []).map(t => ({
        id: t.id,
        nome: t.nome || 'Torneio sem nome',
        jogo: t.jogo || 'Competitivo',
        data: t.data || 'A definir',
        formato: t.formato || 'Mata-mata',
        vagas: t.vagas || 'Sem limite',
        banner: t.banner || '/images/cerradocup.jpg',
        status: t.status || 'Inscrições abertas',
        statusClass: t.statusClass || 'status-aberto',
        ao_vivo: Boolean(t.ao_vivo),
        link: t.link || `/torneio/custom.html?id=${encodeURIComponent(t.id)}`,
        criadorEmail: t.criadorEmail
      }));

      dadosTorneiosFavoritos = lista;

      if (lista.length === 0) {
        listaEl.innerHTML = `
          <div class="empty-state-torneios">
            <div class="empty-state-icon-box" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08);">
              <i class="fa-solid fa-heart-crack"></i>
            </div>
            <h3 class="empty-state-title">Nenhum torneio favoritado</h3>
            <p class="empty-state-desc">
              Você ainda não favoritou nenhum torneio. Clique no coração de um torneio para salvá-lo aqui!
            </p>
            <a href="/pagina_inicial/torneios.html" class="btn-perfil-empty-cta">
              <i class="fa-solid fa-compass"></i> Explorar Torneios
            </a>
          </div>
        `;
      } else {
        listaEl.innerHTML = lista.map(t => renderCardTorneio(t, false)).join('');
      }
    } catch (err) {
      console.error('Erro em carregarTorneiosFavoritos:', err);
      listaEl.innerHTML = `
        <div class="empty-state-torneios">
          <div class="empty-state-icon-box" style="border-color: #ef4444; color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="empty-state-title">Não foi possível carregar os favoritos</h3>
          <p class="empty-state-desc">Você ainda não favoritou nenhum torneio. Clique no coração de um torneio para salvá-lo aqui!</p>
          <button type="button" class="btn-perfil-empty-cta" onclick="window.carregarTorneiosFavoritos(true)">
            <i class="fa-solid fa-arrow-rotate-right"></i> Tentar novamente
          </button>
        </div>
      `;
    } finally {
      isCarregandoFavoritos = false;
      listaEl.removeAttribute('aria-busy');
    }
  }

  window.carregarTorneiosFavoritos = carregarTorneiosFavoritos;

  // Consulta torneios organizados pelo dono do perfil no Supabase
  async function consultarTorneiosCriados(targetUser) {
    if (!targetUser) return [];
    const targetEmail = (targetUser.email || '').trim().toLowerCase();
    const targetId = targetUser.id ? String(targetUser.id) : null;
    let criadosDb = [];
    const supabase = await getSupabase();
    if (supabase && (targetEmail || targetId)) {
      // 1. Consulta na tabela 'torneios' por criadorEmail
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
          }
        }
      } catch (errEmail) {
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

    return criadosDb.map(t => ({
      id: t.id,
      nome: t.nome || 'Torneio sem nome',
      jogo: t.jogo || 'Competitivo',
      data: t.data || 'A definir',
      formato: t.formato || 'Mata-mata',
      vagas: t.vagas || 'Sem limite',
      banner: t.banner || '/images/cerradocup.jpg',
      status: t.status || 'Inscrições abertas',
      statusClass: t.statusClass || 'status-aberto',
      ao_vivo: Boolean(t.ao_vivo),
      link: t.link || `/torneio/custom.html?id=${encodeURIComponent(t.id)}`
    }));
  }

  async function carregarTorneiosCriadosEAtualizarUI(forceReload = false) {
    if (!listaTorneiosCriadosEl) return;
    if (isCarregandoCriados) return;
    if (dadosTorneiosCriados !== null && !forceReload) {
      atualizarBadgeTorneiosCriados(dadosTorneiosCriados.length);
      return;
    }

    isCarregandoCriados = true;
    listaTorneiosCriadosEl.setAttribute('aria-busy', 'true');
    listaTorneiosCriadosEl.innerHTML = `
      <div class="card-torneio skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-img"></div>
        <div class="card-info">
          <div class="skeleton-shimmer skeleton-card-line title"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
          <div class="skeleton-shimmer skeleton-card-btn"></div>
        </div>
      </div>
      <div class="card-torneio skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-img"></div>
        <div class="card-info">
          <div class="skeleton-shimmer skeleton-card-line title"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
          <div class="skeleton-shimmer skeleton-card-btn"></div>
        </div>
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
      listaTorneiosCriadosEl.setAttribute('aria-busy', 'false');
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


// ==========================================
// CONVITE PARA EQUIPE NO PERFIL (MODO VISITANTE)
// ==========================================
async function configurarConviteEquipePerfil(targetUser) {
  const sidebarActionsBox = document.getElementById('sidebarActionsBox');
  if (!sidebarActionsBox || !targetUser) return;

  const existingBtn = document.getElementById('btnConvidarEquipePerfil');
  if (existingBtn) existingBtn.remove();

  let loggedUser = null;
  const raw = localStorage.getItem('vh_loggedUser');
  if (raw) {
    try { loggedUser = JSON.parse(raw); } catch (e) {}
  }
  if (!loggedUser || !loggedUser.email) {
    try {
      const sb = await getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user?.email) {
        loggedUser = { email: session.user.email, nome: session.user.user_metadata?.nome || '' };
      }
    } catch (e) {}
  }

  if (!loggedUser || !loggedUser.email) return;

  const loggedEmail = (loggedUser.email || '').trim().toLowerCase();
  const visitedEmail = (targetUser.email || '').trim().toLowerCase();

  if (!visitedEmail || loggedEmail === visitedEmail) return;

  try {
    const sb = await getSupabase();
    const { data: equipesLideradas, error: eqErr } = await sb
      .from('equipes')
      .select('*')
      .ilike('leaderEmail', loggedEmail);

    if (eqErr || !equipesLideradas || equipesLideradas.length === 0) return;

    const btn = document.createElement('button');
    btn.id = 'btnConvidarEquipePerfil';
    btn.type = 'button';
    btn.className = 'btn-subnav-action';
    btn.style.cssText = 'background: #059669; border-color: #10b981; color: #ffffff; width: 100%; justify-content: center; font-size: 13.5px; padding: 10px; margin-top: 4px;';
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Convidar para Equipe';

    btn.addEventListener('click', () => {
      abrirModalConviteEquipeGeral(targetUser, equipesLideradas);
    });

    sidebarActionsBox.appendChild(btn);
  } catch (err) {
    console.error('Erro ao verificar equipes do líder no perfil:', err);
  }
}

function abrirModalConviteEquipeGeral(targetUser, equipes) {
  let modal = document.getElementById('modalConviteEquipeGeral');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalConviteEquipeGeral';
    modal.className = 'modal-convite-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
    document.body.appendChild(modal);
  }

  const visitedEmail = (targetUser.email || '').trim().toLowerCase();
  const visitedName = targetUser.nome || visitedEmail;

  modal.innerHTML = `
    <div style="background: #111118; border: 1px solid #28283a; border-radius: 18px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 16px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column;">
      <div style="padding: 18px 24px; border-bottom: 1px solid #232332; display: flex; justify-content: space-between; align-items: center; background: #161622; border-radius: 18px 18px 0 0;">
        <h3 style="margin: 0; color: #ffffff; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-user-plus" style="color: #10b981;"></i> Convidar para Equipe
        </h3>
        <button type="button" id="btnFecharModalConviteEquipeGeral" style="background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 4px;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="padding: 24px;">
        <p style="color: #9ca3af; font-size: 14px; margin-top: 0; margin-bottom: 18px; line-height: 1.5;">
          Selecione a equipe para a qual deseja convidar <strong style="color: #ffffff;">${escapeHtml(visitedName)}</strong>:
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${equipes.map(eq => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px; background: #161622; border: 1px solid #262638; border-radius: 12px; gap: 12px;">
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
              <button type="button" class="btn-enviar-convite-eq-geral" data-id="${escapeHtml(eq.id)}" data-nome="${escapeHtml(eq.nome)}" style="background: #059669; border: 1px solid #10b981; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s;">
                <i class="fa-solid fa-paper-plane"></i> Convidar
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  document.getElementById('btnFecharModalConviteEquipeGeral').onclick = () => {
    modal.style.display = 'none';
  };
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };

  modal.querySelectorAll('.btn-enviar-convite-eq-geral').forEach(btn => {
    btn.addEventListener('click', async () => {
      const equipeId = btn.dataset.id;
      const equipeNome = btn.dataset.nome;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

      try {
        const sb = await getSupabase();
        const { data: existing } = await sb
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

        await sb.from('membros_equipe').insert([{
          equipe_id: String(equipeId),
          user_email: visitedEmail,
          status: 'Convidado'
        }]);

        await sb.from('notificacoes').insert([{
          user_email: visitedEmail,
          titulo: 'Convite de Equipe!',
          mensagem: `Você recebeu um convite para entrar na equipe "${equipeNome}"!`,
          tipo: 'equipe',
          link: `/equipes/template_equipe.html?id=${encodeURIComponent(equipeId)}`,
          lida: false
        }]);

        if (typeof showToast === 'function') {
          showToast('Convite enviado com sucesso!');
        } else {
          alert('Convite enviado com sucesso!');
        }

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Convite Enviado';
        btn.disabled = true;
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
        alert('Erro ao enviar convite.');
      }
    });
  });
}
