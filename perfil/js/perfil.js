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
      u.stats = { disputed: 10, won: 3, wins: 22, losses: 12 };
    } else {
      if (typeof u.stats.disputed === "undefined") u.stats.disputed = 10;
      if (typeof u.stats.won === "undefined") u.stats.won = 3;
      if (typeof u.stats.wins === "undefined") u.stats.wins = 22;
      if (typeof u.stats.losses === "undefined") u.stats.losses = 12;
    }
    
    if (!Array.isArray(u.conquistas)) {
      u.conquistas = [
        { titulo: "🏅 Perfil Ativado", desc: "Configure e atualize suas conquistas para o ranking no painel de perfil.", data: "Desbloqueado" }
      ];
    }

    return u;
  }

  function saveUser(u) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch (err) {
      console.error("Erro ao salvar vh_loggedUser:", err);
    }
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

  // Novos elementos de E-sports
  const inputBanner       = document.getElementById("inputBanner");
  const inputBannerFile   = document.getElementById("inputBannerFile");
  const btnUploadBanner   = document.getElementById("btnUploadBanner");

  const statsDisputed     = document.getElementById("statsDisputed");
  const statsWon          = document.getElementById("statsWon");
  const statsWins         = document.getElementById("statsWins");
  const statsLosses       = document.getElementById("statsLosses");

  const conquistasContainer = document.getElementById("conquistasContainer");
  const newAchTitle        = document.getElementById("newAchTitle");
  const newAchDesc         = document.getElementById("newAchDesc");
  const btnAddAch          = document.getElementById("btnAddAch");


  // --------- PREENCHE A TELA COM O QUE TEM NO LOCALSTORAGE ---------

  displayName.textContent = user.nome || "Usuário convidado";
  inputUsername.value     = user.nome || "";
  emailInput.value        = user.email || "";
  bioTextarea.value       = user.bio || "";

  if (inputBanner) {
    inputBanner.value     = user.banner || "";
  }

  // Preenche dados de E-sports nos inputs
  if (statsDisputed) statsDisputed.value = user.stats.disputed;
  if (statsWon)      statsWon.value      = user.stats.won;
  if (statsWins)     statsWins.value     = user.stats.wins;
  if (statsLosses)   statsLosses.value   = user.stats.losses;

  // Região 
  if (spanRegiao) {
    spanRegiao.textContent = user.regiao || "Brasil";
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

  if (user.avatar) {
    imgProfile.style.backgroundImage = `url('${user.avatar}')`;
    if (headerUserImg) headerUserImg.src = user.avatar;
  } else {
    imgProfile.style.backgroundImage = "url('/image/boneco_logo_ofc.png')";
    if (headerUserImg) headerUserImg.src = "/image/boneco_logo_ofc.png";
  }

  // --------- FOTO DE PERFIL ---------
  function abrirSeletorFoto() {
    if (inputPhoto) inputPhoto.click();
  }

  if (btnPhoto)   btnPhoto.addEventListener("click", abrirSeletorFoto);
  if (imgProfile) imgProfile.addEventListener("click", abrirSeletorFoto);

  if (inputPhoto) {
    inputPhoto.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;

        imgProfile.style.backgroundImage = `url('${dataUrl}')`;
        if (headerUserImg) headerUserImg.src = dataUrl;

        user.avatar = dataUrl;
        saveUser(user);
      };
      reader.readAsDataURL(file);
    });
  }

  // --------- PROCESSO DE BANNER DE CAPA ---------
  if (btnUploadBanner && inputBannerFile) {
    btnUploadBanner.addEventListener("click", () => {
      inputBannerFile.click();
    });
  }

  if (inputBannerFile) {
    inputBannerFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        if (inputBanner) {
          inputBanner.value = dataUrl;
        }
        user.banner = dataUrl;
        saveUser(user);
      };
      reader.readAsDataURL(file);
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

  // --------- SALVAR PERFIL (nome, email, bio, platforms, stats, banner) ---------
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener("click", () => {
      const novoNome  = inputUsername.value.trim();
      const novoEmail = emailInput.value.trim();
      const novaBio   = bioTextarea.value.trim();

      if (novoNome) {
        user.nome = novoNome;
      }
      user.email = novoEmail;
      user.bio   = novaBio;

      if (inputBanner) {
        user.banner = inputBanner.value.trim();
      }

      // Salva estatísticas
      user.stats = {
        disputed: parseInt(statsDisputed.value) || 0,
        won: parseInt(statsWon.value) || 0,
        wins: parseInt(statsWins.value) || 0,
        losses: parseInt(statsLosses.value) || 0
      };

      // monta lista de plataformas selecionadas
      const plataformasSelecionadas = [];
      if (platPC && platPC.checked)      plataformasSelecionadas.push("PC");
      if (platConsole && platConsole.checked) plataformasSelecionadas.push("Console");
      if (platMobile && platMobile.checked)   plataformasSelecionadas.push("Mobile");

      user.plataformas = plataformasSelecionadas;

      // região continua Brasil por padrão
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

      btnSaveProfile.textContent = "Salvo com sucesso!";
      btnSaveProfile.style.background = "#22c55e";
      setTimeout(() => {
        btnSaveProfile.textContent = "Salvar alterações";
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

      row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <strong style="color: #ffc107; font-size: 13px;">${ach.titulo}</strong>
          <span style="color: #cbd5e1; font-size: 11px;">${ach.desc}</span>
        </div>
        <button type="button" class="icon-edit-small" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;" title="Remover conquista">
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


  // ========= EQUIPES CRIADAS  PERFIL =========
  function loadTeamsProfile() {
    try {
      return JSON.parse(localStorage.getItem("vh_createdTeams") || "[]");
    } catch (e) {
      return [];
    }
  }

  function renderTeamsProfile() {
    const containerDynamic = document.getElementById("dynamicTeams");
    if (!containerDynamic) return;

    const teams = loadTeamsProfile();

    containerDynamic.innerHTML = "";

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
      const jogos = team.jogos ? `Jogos: ${team.jogos}` : "Jogos não informados";
      const regiao = team.regiao ? ` • Região: ${team.regiao}` : "";
      p.textContent = jogos + regiao;

      textBox.appendChild(h3);
      textBox.appendChild(p);

      main.appendChild(img);
      main.appendChild(textBox);

      const link = document.createElement("a");
      link.href = team.link || "#";
      link.textContent = "Ver detalhes";

      card.appendChild(main);
      card.appendChild(link);

      containerDynamic.appendChild(card);
    });
  }

  // chama ao carregar a página de perfil
  renderTeamsProfile();
});
