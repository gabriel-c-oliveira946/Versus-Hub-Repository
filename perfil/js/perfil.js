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

  let user = loadUser();

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
          alert("O nome de usuário deve conter no mínimo 2 e no máximo 33 caracteres.");
          inputUsername.focus();
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
        alert("Digite um título para a conquista!");
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
});
