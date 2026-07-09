// /ranking.js
document.addEventListener("DOMContentLoaded", () => {
  // --------- SETUP & INITIAL STATE ---------

  // Core points formula
  function calculatePoints(stats) {
    if (!stats) return 0;
    const disputed = parseInt(stats.disputed) || 0;
    const won = parseInt(stats.won) || 0;
    const wins = parseInt(stats.wins) || 0;
    const losses = parseInt(stats.losses) || 0;

    // formula: 300 for tournaments won + 15 for individual wins + 5 for participation - 2 for losses
    const score = (won * 300) + (wins * 15) + (disputed * 5) - (losses * 2);
    return Math.max(0, score);
  }

  // 1) Benchmark mock profiles
  const defaultCompetitors = [
    {
      id: "dean",
      nome: "zZ_Dinho_Winchexxter_Zz",
      avatar: "/equipes/images/dinhowinches.jpg",
      email: "dinho@gmail.com",
      link: "/perfil/perfil-publico.html?id=dean",
      stats: { disputed: 18, won: 6, wins: 54, losses: 18 }
    },
    {
      id: "caique",
      nome: "Caíque Brandão",
      avatar: "/equipes/images/caiquebrandao.jpg",
      email: "caique@gmail.com",
      link: "/perfil/perfil-publico.html?id=caique",
      stats: { disputed: 12, won: 4, wins: 35, losses: 10 }
    },
    {
      id: "marcuzcuz",
      nome: "Mar_cuzcuz",
      avatar: "/equipes/images/marcuzcuz.jpg",
      email: "marcuzcuz@gmail.com",
      link: "/perfil/perfil-publico.html?id=marcuzcuz",
      stats: { disputed: 14, won: 3, wins: 32, losses: 20 }
    },
    {
      id: "sr_gonzalez",
      nome: "Luiz Gonzalez",
      avatar: "/image/boneco_logo_ofc.png",
      email: "gonzalez@gmail.com",
      link: "/perfil/perfil-publico.html?id=sr_gonzalez",
      stats: { disputed: 11, won: 2, wins: 25, losses: 14 }
    },
    {
      id: "toxic_rebel",
      nome: "Gabriel Lima",
      avatar: "/image/boneco_logo_ofc.png",
      email: "rebel@gmail.com",
      link: "/perfil/perfil-publico.html?id=toxic_rebel",
      stats: { disputed: 10, won: 2, wins: 20, losses: 12 }
    },
    {
      id: "furia_gamer",
      nome: "Ana \"fUria\" Silveira",
      avatar: "/image/boneco_logo_ofc.png",
      email: "furia@gmail.com",
      link: "/perfil/perfil-publico.html?id=furia_gamer",
      stats: { disputed: 8, won: 1, wins: 17, losses: 10 }
    },
    {
      id: "apex_predator",
      nome: "Pedro Silveira",
      avatar: "/image/boneco_logo_ofc.png",
      email: "apex@gmail.com",
      link: "/perfil/perfil-publico.html?id=apex_predator",
      stats: { disputed: 7, won: 1, wins: 14, losses: 9 }
    },
    {
      id: "skyline_player",
      nome: "Thiago Dias",
      avatar: "/image/boneco_logo_ofc.png",
      email: "skyline@gmail.com",
      link: "/perfil/perfil-publico.html?id=skyline_player",
      stats: { disputed: 6, won: 0, wins: 12, losses: 12 }
    },
    {
      id: "ghost_sniper",
      nome: "Juliana Mello",
      avatar: "/image/boneco_logo_ofc.png",
      email: "ghost@gmail.com",
      link: "/perfil/perfil-publico.html?id=ghost_sniper",
      stats: { disputed: 6, won: 0, wins: 10, losses: 14 }
    },
    {
      id: "vibe_lord",
      nome: "Matheus Costa",
      avatar: "/image/boneco_logo_ofc.png",
      email: "vibe@gmail.com",
      link: "/perfil/perfil-publico.html?id=vibe_lord",
      stats: { disputed: 5, won: 0, wins: 8, losses: 12 }
    }
  ];

  // 2) Sincronizar dados vivos de localStorage
  let loggedUser = null;
  let registeredUsers = [];
  try {
    const rawLogged = localStorage.getItem("vh_loggedUser");
    if (rawLogged) loggedUser = JSON.parse(rawLogged);

    const rawReg = localStorage.getItem("vh_users");
    if (rawReg) registeredUsers = JSON.parse(rawReg);
  } catch (err) {
    console.error("Localstorage loading error in ranking:", err);
  }

  // Prepara lista combinada
  let activeCompetitors = [...defaultCompetitors];

  // Se o usuário logado existe, garantir que seu perfil e estatísticas estão no ranking!
  if (loggedUser) {
    const userEmail = (loggedUser.email || "").toLowerCase().trim();
    // Procura se coincide com um competidor padrão ou registrado por e-mail, e atualiza
    const defaultIdx = activeCompetitors.findIndex(c => (c.email || "").toLowerCase() === userEmail);

    if (defaultIdx !== -1) {
      // Mescla estatísticas atualizadas no perfil nativo
      activeCompetitors[defaultIdx].nome = loggedUser.nome || activeCompetitors[defaultIdx].nome;
      if (loggedUser.avatar) {
        activeCompetitors[defaultIdx].avatar = loggedUser.avatar;
      }
      if (loggedUser.stats) {
        activeCompetitors[defaultIdx].stats = {
          disputed: parseInt(loggedUser.stats.disputed) || 0,
          won: parseInt(loggedUser.stats.won) || 0,
          wins: parseInt(loggedUser.stats.wins) || 0,
          losses: parseInt(loggedUser.stats.losses) || 0
        };
      }
      activeCompetitors[defaultIdx].isCurrentUser = true;
    } else {
      // É um novo competidor dinâmico (não nativo), monta e adiciona na lista
      const slugName = (loggedUser.nome || "player").trim().toLowerCase().replace(/\s+/g, "");
      const userStats = loggedUser.stats || { disputed: 10, won: 3, wins: 22, losses: 12 };
      
      activeCompetitors.push({
        id: slugName,
        nome: loggedUser.nome || "Você (Convidado)",
        avatar: loggedUser.avatar || "/image/boneco_logo_ofc.png",
        email: loggedUser.email || "",
        link: `/perfil/perfil-publico.html?id=${slugName}`,
        stats: {
          disputed: parseInt(userStats.disputed) || 0,
          won: parseInt(userStats.won) || 0,
          wins: parseInt(userStats.wins) || 0,
          losses: parseInt(userStats.losses) || 0
        },
        isCurrentUser: true
      });
    }
  }

  // Adiciona outros usuários do cadastro (se houver mais que não estejam listados)
  if (registeredUsers.length > 0) {
    registeredUsers.forEach(regU => {
      const regEmail = (regU.email || "").toLowerCase().trim();
      if (!regEmail) return;

      // Se já está logado ou é o mesmo email padrão, ignoramos para não duplicar
      if (loggedUser && (loggedUser.email || "").toLowerCase().trim() === regEmail) return;
      if (activeCompetitors.some(c => (c.email || "").toLowerCase() === regEmail)) return;

      const slugName = (regU.nome || "player").trim().toLowerCase().replace(/\s+/g, "");
      const stats = regU.stats || { disputed: 8, won: 2, wins: 18, losses: 10 };

      activeCompetitors.push({
        id: slugName,
        nome: regU.nome || "Pro Player",
        avatar: regU.avatar || "/image/boneco_logo_ofc.png",
        email: regU.email,
        link: `/perfil/perfil-publico.html?id=${slugName}`,
        stats: {
          disputed: parseInt(stats.disputed) || 0,
          won: parseInt(stats.won) || 0,
          wins: parseInt(stats.wins) || 0,
          losses: parseInt(stats.losses) || 0
        }
      });
    });
  }

  // Atribui pontos para todos
  activeCompetitors.forEach(c => {
    c.points = calculatePoints(c.stats);
  });

  // Ordena por pontos decrescente
  activeCompetitors.sort((a, b) => b.points - a.points);

  // Armazena vetor ordenado para buscas e filtros
  let sortedList = [...activeCompetitors];

  // --------- RENDERIZADORES ---------
  const podiumContainer = document.getElementById("podiumContainer");
  const tableContainer  = document.getElementById("leaderboardTableBody");
  const searchInput     = document.getElementById("rankingSearch");

  // Função para renderizar o Top 3 do Podium
  function renderPodium(players) {
    if (!podiumContainer) return;
    podiumContainer.innerHTML = "";

    // Pegamos os 3 primeiros colocados globais
    const top3 = players.slice(0, 3);
    if (!top3.length) {
      podiumContainer.style.display = "none";
      return;
    } else {
      podiumContainer.style.display = "flex";
    }

    // Mapeamento de posições para classes
    const orderConfig = [
      { pos: 2, cssClass: "second", label: "2º Lugar", title: "Silver" },
      { pos: 1, cssClass: "first", label: "#1", title: "Supremo" },
      { pos: 3, cssClass: "third", label: "3º Lugar", title: "Cooper" }
    ];

    // Cria os cards na ordem correta para visualização (2º esq, 1º centro, 3º dir)
    orderConfig.forEach(cfg => {
      const playerIndex = cfg.pos - 1; // 0 para 1st, 1 para 2nd, 2 para 3rd
      const player = top3[playerIndex];

      if (!player) return;

      const card = document.createElement("div");
      card.className = `podium-card ${cfg.cssClass}`;
      if (player.isCurrentUser) {
        card.style.borderWidth = "2.5px";
        card.style.boxShadow = "0 10px 30px rgba(212, 17, 17, 0.3)";
      }

      const winRate = player.stats.disputed ? Math.round((player.stats.wins / (player.stats.wins + player.stats.losses)) * 100) : 0;

      card.innerHTML = `
        <div class="podium-rank-badge">
          ${cfg.cssClass === "first" ? '<i class="fa-solid fa-crown" style="color: inherit;"></i>' : cfg.pos}
        </div>
        <div class="podium-avatar-wrapper">
          <div class="podium-avatar" style="background-image: url('${player.avatar}');"></div>
        </div>
        <h3 class="podium-name">${player.nome}</h3>
        <p class="podium-title">${cfg.title} ${player.isCurrentUser ? ' • VOCÊ' : ''}</p>
        <div class="podium-score">${player.points} pts</div>
        
        <div class="podium-stats-micro">
          <div class="podium-stat-item">
            <span class="podium-stat-label">Disputas</span>
            <span class="podium-stat-value">${player.stats.disputed}</span>
          </div>
          <div class="podium-stat-item">
            <span class="podium-stat-label">Vitórias</span>
            <span class="podium-stat-value">${player.stats.wins}</span>
          </div>
          <div class="podium-stat-item">
            <span class="podium-stat-label">Aproveit.</span>
            <span class="podium-stat-value">${winRate}%</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        window.location.href = player.link;
      });

      podiumContainer.appendChild(card);
    });
  }

  // Função para renderizar a lista da tabela
  function renderTableList(players, isFiltered = false) {
    if (!tableContainer) return;
    tableContainer.innerHTML = "";

    // Se estiver filtrado, renderizamos a partir do primeiro item retornado.
    // Se for listagem global completa, o top 3 já está no Podium, então a tabela mostra a partir do 4º player.
    const startIndex = isFiltered ? 0 : 3;
    const listToShow = players.slice(startIndex);

    if (listToShow.length === 0) {
      tableContainer.innerHTML = `
        <div class="ranking-no-results">
          <i class="fa-regular fa-face-frown" style="font-size: 32px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
          Nenhum jogador encontrado com este nome.
        </div>
      `;
      return;
    }

    listToShow.forEach((player, index) => {
      // A posição do ranking real é o index absoluto na lista completa
      const originalRank = players.indexOf(player) + 1;

      const row = document.createElement("div");
      row.className = "leaderboard-row";
      if (player.isCurrentUser) {
        row.classList.add("current-user");
      }

      // Calcula taxa de vitórias
      const totalPartidas = player.stats.wins + player.stats.losses;
      const winRate = totalPartidas > 0 ? Math.round((player.stats.wins / totalPartidas) * 100) : 0;
      
      let winRateClass = "mid";
      if (winRate >= 70) winRateClass = "high";
      else if (winRate < 50) winRateClass = "low";

      row.innerHTML = `
        <div class="player-rank">#${originalRank}</div>
        <div class="player-identity">
          <div class="player-img" style="background-image: url('${player.avatar}');"></div>
          <div class="player-name-wrapper">
            <span class="player-name">${player.nome}</span>
            ${player.isCurrentUser ? '<span class="player-badge">Você</span>' : ''}
          </div>
        </div>
        <div class="player-points" style="color: #ff7300;">${player.points} pts</div>
        <div class="player-stat">${player.stats.disputed}</div>
        <div class="player-stat" style="color: #4ade80;">${player.stats.wins}</div>
        <div class="player-stat" style="color: #f97373;">${player.stats.losses}</div>
        <div class="player-winrate ${winRateClass}">${winRate}%</div>
        <div class="player-action">
          <button type="button" title="Ver perfil completo">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      `;

      row.addEventListener("click", () => {
        window.location.href = player.link;
      });

      tableContainer.appendChild(row);
    });
  }

  // Realiza a renderização inicial
  renderPodium(sortedList);
  renderTableList(sortedList);

  // Filtro inteligente de pesquisa
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase().trim();

      if (term === "") {
        // Se a busca estiver vazia, volta ao padrão (Top 3 no Podium, resto na tabela)
        renderPodium(sortedList);
        renderTableList(sortedList);
      } else {
        // Se houver busca, filtra todos qualificatórios
        const filtered = sortedList.filter(p => p.nome.toLowerCase().includes(term));
        
        // Esconde o Podium ao pesquisar para exibir os resultados diretamente numa tabela unificada
        const podiumDiv = document.getElementById("podiumContainer");
        if (podiumDiv) podiumDiv.style.display = "none";

        renderTableList(filtered, true);
      }
    });
  }
});
