// /torneio/js/bracket.js

document.addEventListener("DOMContentLoaded", () => {
  // Try to find tournament ID from URL parameter (e.g. ?id=cerrado-cup-csgo)
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("id") || "default_tournament";

  // Discover tournament details (for game mode specific team names)
  let tournamentGame = "generic";
  try {
    const rawCreated = localStorage.getItem("vh_createdTournaments") || "[]";
    const rawJoined = localStorage.getItem("vh_joinedTournaments") || "[]";
    const rawVisited = localStorage.getItem("vh_visitedTournaments") || "[]";
    const allTourneys = [...JSON.parse(rawCreated), ...JSON.parse(rawJoined), ...JSON.parse(rawVisited)];
    const currentTourney = allTourneys.find(t => t.id === tournamentId);
    if (currentTourney && currentTourney.jogo) {
      tournamentGame = currentTourney.jogo.toLowerCase();
    } else {
      // Check hardcoded page associations based on path or document title
      const title = document.title.toLowerCase();
      if (title.includes("cs") || title.includes("cerrado cup")) tournamentGame = "csgo";
      else if (title.includes("fifa") || title.includes("fc")) tournamentGame = "fifa";
      else if (title.includes("free fire")) tournamentGame = "freefire";
    }
  } catch (e) {
    console.warn("Could not retrieve tournament details for bracket customization:", e);
  }

  // --- BENCHMARK POOLS BY CATEGORY ---
  const teamPools = {
    csgo: [
      { name: "FURIA Esports", avatar: "/image/boneco_logo_ofc.png" },
      { name: "MIBR", avatar: "/image/logo.png" },
      { name: "Imperial Esports", avatar: "/image/boneco_logo_ofc.png" },
      { name: "paiN Gaming", avatar: "/image/logo.png" },
      { name: "RED Canids", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Fluxo CS", avatar: "/image/logo.png" },
      { name: "Legacy Team", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Sharks", avatar: "/image/logo.png" },
      { name: "ODDIK", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Team Solid", avatar: "/image/logo.png" },
      { name: "Snipers BR", avatar: "/image/boneco_logo_ofc.png" },
      { name: "W7M Esports", avatar: "/image/logo.png" },
      { name: "Corinthians CS", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Flamengo CS", avatar: "/image/logo.png" },
      { name: "Case Esports", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Viltrumitas CS", avatar: "/image/logo.png" }
    ],
    fifa: [
      { name: "PHzin", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Young_10", avatar: "/image/logo.png" },
      { name: "Klinger", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Manoel_FC", avatar: "/image/logo.png" },
      { name: "Gabriel_Gamer", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Eduardo_FIFA", avatar: "/image/logo.png" },
      { name: "Neto_Gamer", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Ronaldo_R9", avatar: "/image/logo.png" },
      { name: "Neymar_Jr_NJ", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Ronaldinho_Bruxo", avatar: "/image/logo.png" },
      { name: "Zico_10", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Pelé_Rei", avatar: "/image/logo.png" },
      { name: "Kaká_AC", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Rivaldo_R10", avatar: "/image/logo.png" },
      { name: "Denilson_Show", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Tevez_EFC", avatar: "/image/logo.png" }
    ],
    freefire: [
      { name: "LOUD GG", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Fluxo FF", avatar: "/image/logo.png" },
      { name: "Magic Squad", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Keyd Stars", avatar: "/image/logo.png" },
      { name: "MIBR FF", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Corinthians FF", avatar: "/image/logo.png" },
      { name: "Pain Esports FF", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Netshoes Miners", avatar: "/image/logo.png" },
      { name: "E1 Sports", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Alpha FF", avatar: "/image/logo.png" },
      { name: "América RJ FF", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Vasco Esports", avatar: "/image/logo.png" },
      { name: "Cruzeiro FF", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Santos FF", avatar: "/image/logo.png" },
      { name: "Botafogo FF", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Palmeiras GG", avatar: "/image/logo.png" }
    ],
    generic: [
      { name: "Vagalumes Team", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Viltrumitas", avatar: "/image/logo.png" },
      { name: "Os Caras E-Sports", avatar: "/image/boneco_logo_ofc.png" },
      { name: "The Jacksons", avatar: "/image/logo.png" },
      { name: "Alpha Team", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Delta Force", avatar: "/image/logo.png" },
      { name: "Omega Squad", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Apex Predators", avatar: "/image/logo.png" },
      { name: "Cyber Ghosts", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Techno Wizards", avatar: "/image/logo.png" },
      { name: "Shadow Assassins", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Phoenix Reborn", avatar: "/image/logo.png" },
      { name: "Ice Breakers", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Solar Flares", avatar: "/image/logo.png" },
      { name: "Nova Alliance", avatar: "/image/boneco_logo_ofc.png" },
      { name: "Vortex Esports", avatar: "/image/logo.png" }
    ]
  };

  // Select suitable pool
  let selectedPool = teamPools.generic;
  if (tournamentGame.includes("cs") || tournamentGame.includes("strike") || tournamentGame.includes("cerrado")) {
    selectedPool = teamPools.csgo;
  } else if (tournamentGame.includes("fifa") || tournamentGame.includes("fc") || tournamentGame.includes("futebol")) {
    selectedPool = teamPools.fifa;
  } else if (tournamentGame.includes("free") || tournamentGame.includes("fire") || tournamentGame.includes("ff")) {
    selectedPool = teamPools.freefire;
  }

  // Bracket state variables
  let bracketSize = 16; // default size
  let rounds = []; // list of round arrays
  let champion = null; // final winner

  // LocalStorage Key
  const STORAGE_KEY = `vh_bracketState_${tournamentId}`;

  // DOM Elements
  const container = document.getElementById("bracketContainer");
  const sizeSelect = document.getElementById("bracketSizeSelect");
  const resetBtn = document.getElementById("btnResetBracket");

  // Load configured size default based on current page
  function setupPageDefaultSize() {
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath.includes("cerradocup")) {
      bracketSize = 16;
    } else if (currentPath.includes("fifaglobalseries")) {
      bracketSize = 8;
    } else if (currentPath.includes("freefire-champions")) {
      bracketSize = 16;
    } else if (currentPath.includes("presen-fifa")) {
      bracketSize = 4;
    } else {
      bracketSize = 8;
    }

    if (sizeSelect) {
      sizeSelect.value = bracketSize.toString();
    }
  }

  // Initialize and populate initial round or load existing state
  function initializeBracket(forceReset = false) {
    let saved = null;
    if (!forceReset) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (err) {
        console.error("Error reading bracket state:", err);
      }
    }

    if (saved && saved.rounds && saved.bracketSize === bracketSize) {
      rounds = saved.rounds;
      champion = saved.champion || null;
    } else {
      rounds = [];
      champion = null;

      // Slice the team pool to get corresponding number of participants
      const participants = selectedPool.slice(0, bracketSize);

      // Construct matches for Round 0
      const round0MatchesCount = bracketSize / 2;
      const round0 = [];
      for (let i = 0; i < round0MatchesCount; i++) {
        round0.push({
          matchId: i,
          status: "Em andamento",
          teamA: { ...participants[i * 2], score: null, isWinner: false, isLoser: false },
          teamB: { ...participants[i * 2 + 1], score: null, isWinner: false, isLoser: false },
          winnerId: null
        });
      }
      rounds.push(round0);

      // Build placeholders for subsequent rounds
      let currentMatchesCount = round0MatchesCount / 2;
      while (currentMatchesCount >= 1) {
        const roundMatches = [];
        for (let i = 0; i < currentMatchesCount; i++) {
          roundMatches.push({
            matchId: i,
            status: "Aguardando adversários",
            teamA: { name: "A definir", avatar: "/image/boneco_logo_ofc.png", score: null, isWinner: false, isLoser: false },
            teamB: { name: "A definir", avatar: "/image/boneco_logo_ofc.png", score: null, isWinner: false, isLoser: false },
            winnerId: null
          });
        }
        rounds.push(roundMatches);
        currentMatchesCount /= 2;
      }

      saveState();
    }

    renderBracket();
  }

  // Save full tree state to localstorage
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        bracketSize,
        rounds,
        champion
      }));
    } catch (err) {
      console.error("Error saving bracket state:", err);
    }
  }

  // Live score generator helper
  function getRandomScores() {
    const s1 = Math.floor(Math.random() * 4);
    let s2 = Math.floor(Math.random() * 4);
    while (s2 === s1) {
      s2 = Math.floor(Math.random() * 4);
    }
    return [Math.max(s1, s2), Math.min(s1, s2)];
  }

  // Handle Match Click Team selection
  function handleTeamWin(roundIndex, matchId, selectedTeamKey) {
    const round = rounds[roundIndex];
    if (!round) return;

    const match = round.find(m => m.matchId === matchId);
    if (!match) return;

    // Guard placeholder conditions
    if (match.teamA.name === "A definir" || match.teamB.name === "A definir") {
      return;
    }

    // Assign randomized score simulation for visual polish, guaranteeing winner gets higher score
    const scores = getRandomScores();
    
    // Toggle winners on match
    if (selectedTeamKey === "A") {
      match.teamA.score = scores[0];
      match.teamB.score = scores[1];
      match.teamA.isWinner = true;
      match.teamA.isLoser = false;
      match.teamB.isWinner = false;
      match.teamB.isLoser = true;
      match.winnerId = "A";
    } else {
      match.teamA.score = scores[1];
      match.teamB.score = scores[0];
      match.teamA.isWinner = false;
      match.teamA.isLoser = true;
      match.teamB.isWinner = true;
      match.teamB.isLoser = false;
      match.winnerId = "B";
    }
    match.status = "Finalizado";

    const winningTeamData = selectedTeamKey === "A" ? match.teamA : match.teamB;

    // Check if this was the Grand Final
    if (roundIndex === rounds.length - 1) {
      champion = { ...winningTeamData, isWinner: true, isLoser: false };
    } else {
      // Propagate automatically to the next round!
      const nextRoundIndex = roundIndex + 1;
      const nextRound = rounds[nextRoundIndex];
      const nextMatchId = Math.floor(matchId / 2);
      const isSlotB = (matchId % 2 === 1); // odd match index goes to Slot B

      const nextMatch = nextRound.find(m => m.matchId === nextMatchId);
      if (nextMatch) {
        // Reset advanced node and clean its descendants to prevent stale state trees
        invalidateSubsequentMatches(nextRoundIndex, nextMatchId, isSlotB);

        if (!isSlotB) {
          nextMatch.teamA = {
            name: winningTeamData.name,
            avatar: winningTeamData.avatar,
            score: null,
            isWinner: false,
            isLoser: false
          };
        } else {
          nextMatch.teamB = {
            name: winningTeamData.name,
            avatar: winningTeamData.avatar,
            score: null,
            isWinner: false,
            isLoser: false
          };
        }

        // Auto-unlock status if both competitors are set
        if (nextMatch.teamA.name !== "A definir" && nextMatch.teamB.name !== "A definir") {
          nextMatch.status = "Pronto";
        }
      }
    }

    saveState();
    renderBracket();
  }

  // Clear subsequent stale advanced paths recursively when a previous winner is changed
  function invalidateSubsequentMatches(roundIndex, matchId, isSlotB) {
    if (roundIndex >= rounds.length) return;

    const round = rounds[roundIndex];
    const match = round.find(m => m.matchId === matchId);
    if (!match) return;

    // Reset previous winner if it was already selected previously
    match.winnerId = null;
    match.status = (match.teamA.name !== "A definir" && match.teamB.name !== "A definir") ? "Pronto" : "Aguardando adversários";

    if (!isSlotB) {
      match.teamA.score = null;
      match.teamA.isWinner = false;
      match.teamA.isLoser = false;
    } else {
      match.teamB.score = null;
      match.teamB.isWinner = false;
      match.teamB.isLoser = false;
    }

    // Clean champion if it was reached
    champion = null;

    // Progress recursive invalidation to downstream round
    const nextRoundIndex = roundIndex + 1;
    const nextMatchId = Math.floor(matchId / 2);
    const nextSlotB = (matchId % 2 === 1);

    if (nextRoundIndex < rounds.length) {
      const nextRound = rounds[nextRoundIndex];
      const nextMatch = nextRound.find(m => m.matchId === nextMatchId);
      if (nextMatch) {
        const advancedNameBefore = nextSlotB ? nextMatch.teamB.name : nextMatch.teamA.name;
        if (advancedNameBefore !== "A definir") {
          if (!nextSlotB) {
            nextMatch.teamA = { name: "A definir", avatar: "/image/boneco_logo_ofc.png", score: null, isWinner: false, isLoser: false };
          } else {
            nextMatch.teamB = { name: "A definir", avatar: "/image/boneco_logo_ofc.png", score: null, isWinner: false, isLoser: false };
          }
          invalidateSubsequentMatches(nextRoundIndex, nextMatchId, nextSlotB);
        }
      }
    }
  }

  // Render Bracket tree to DOM
  function renderBracket() {
    if (!container) return;
    container.innerHTML = "";

    // 1) Show instruction tip if bracket is active
    const hint = document.createElement("div");
    hint.className = "bracket-hint";
    hint.innerHTML = `<i class="fa-solid fa-circle-info" style="color: #ff7300;"></i> clique no competidor vitorioso de cada partida para avançá-lo manualmente no chaveamento!`;
    container.appendChild(hint);

    // 2) Wrapper holding rounds
    const wrapper = document.createElement("div");
    wrapper.className = "bracket-tree-wrapper";

    // Build rounds html
    rounds.forEach((roundMatches, roundIndex) => {
      const roundCol = document.createElement("div");
      roundCol.className = "bracket-round";

      // Label round headings
      let roundTitleLabel = "Fase de Grupos";
      const totalRounds = rounds.length;
      const roundsFromEnd = totalRounds - roundIndex;

      if (roundsFromEnd === 1) {
        roundTitleLabel = "Grande Final🏆";
      } else if (roundsFromEnd === 2) {
        roundTitleLabel = "Semifinais";
      } else if (roundsFromEnd === 3) {
        roundTitleLabel = "Quartas de Final";
      } else if (roundsFromEnd === 4) {
        roundTitleLabel = "Oitavas de Final";
      } else {
        roundTitleLabel = `Fase Eliminatória (Roda ${roundIndex + 1})`;
      }

      const header = document.createElement("div");
      header.className = "bracket-round-header";
      header.textContent = roundTitleLabel;
      roundCol.appendChild(header);

      // Render matches in this round
      roundMatches.forEach(match => {
        const matchBox = document.createElement("div");
        matchBox.className = "bracket-match";

        // Match Status Header
        const matchStatusHeader = document.createElement("div");
        matchStatusHeader.className = `match-status ${match.status === "Pronto" || match.status === "Em andamento" ? "active" : ""}`;
        
        let statusText = match.status;
        if (match.status === "Aguardando adversários") statusText = "Aguardando";
        if (match.status === "Em andamento") statusText = "Ao vivo🔴";

        matchStatusHeader.innerHTML = `
          <span>Partida #${match.matchId + 1}</span>
          <span>${statusText}</span>
        `;
        matchBox.appendChild(matchStatusHeader);

        // Team A render
        const teamABox = document.createElement("div");
        teamABox.className = `match-team`;
        if (match.teamA.isWinner) teamABox.classList.add("team-winner");
        if (match.teamA.isLoser) teamABox.classList.add("team-loser");

        const teamAVal = match.teamA.score !== null ? match.teamA.score : "-";
        const hasA = match.teamA.name !== "A definir";

        teamABox.innerHTML = `
          <div class="team-identity">
            <div class="team-avatar" style="background-image: url('${match.teamA.avatar}');"></div>
            <span class="team-name" title="${match.teamA.name}">${match.teamA.name}</span>
            ${match.teamA.isWinner ? '<i class="fa-solid fa-crown team-winner-icon"></i>' : ''}
          </div>
          <span class="team-score">${teamAVal}</span>
        `;

        if (hasA && match.status !== "Finalizado") {
          teamABox.addEventListener("click", () => handleTeamWin(roundIndex, match.matchId, "A"));
        }
        matchBox.appendChild(teamABox);

        // Team B render
        const teamBBox = document.createElement("div");
        teamBBox.className = `match-team`;
        if (match.teamB.isWinner) teamBBox.classList.add("team-winner");
        if (match.teamB.isLoser) teamBBox.classList.add("team-loser");

        const teamBVal = match.teamB.score !== null ? match.teamB.score : "-";
        const hasB = match.teamB.name !== "A definir";

        teamBBox.innerHTML = `
          <div class="team-identity">
            <div class="team-avatar" style="background-image: url('${match.teamB.avatar}');"></div>
            <span class="team-name" title="${match.teamB.name}">${match.teamB.name}</span>
            ${match.teamB.isWinner ? '<i class="fa-solid fa-crown team-winner-icon"></i>' : ''}
          </div>
          <span class="team-score">${teamBVal}</span>
        `;

        if (hasB && match.status !== "Finalizado") {
          teamBBox.addEventListener("click", () => handleTeamWin(roundIndex, match.matchId, "B"));
        }
        matchBox.appendChild(teamBBox);

        roundCol.appendChild(matchBox);
      });

      wrapper.appendChild(roundCol);
    });

    // 3) Champion podium box on the very right of the tree
    const champCol = document.createElement("div");
    champCol.className = "bracket-round";
    
    const champHeader = document.createElement("div");
    champHeader.className = "bracket-round-header";
    champHeader.textContent = "Campeão";
    champCol.appendChild(champHeader);

    const champBox = document.createElement("div");
    champBox.className = "bracket-champion-box";

    if (champion) {
      champBox.innerHTML = `
        <i class="fa-solid fa-trophy champion-crown"></i>
        <p class="champion-title">Torneio Concluído</p>
        <span class="champion-name">${champion.name}</span>
      `;
    } else {
      champBox.innerHTML = `
        <i class="fa-solid fa-trophy champion-crown" style="color: #4b4b5c; filter: none;"></i>
        <p class="champion-title" style="color: #4b4b5c;">Aguardando</p>
        <span class="champion-name" style="color: #64748b; font-size: 13px;">Disputa final ativa</span>
      `;
    }
    champCol.appendChild(champBox);
    wrapper.appendChild(champCol);

    container.appendChild(wrapper);
  }

  // --- LISTENERS ---

  // Handle Bracket size selection dropdown switch
  if (sizeSelect) {
    sizeSelect.addEventListener("change", () => {
      bracketSize = parseInt(sizeSelect.value) || 8;
      initializeBracket(true); // force recalculation reset
    });
  }

  // Handle Manual reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      initializeBracket(true); // reset and wipe local storage matches
    });
  }

  // Initial trigger flow
  setupPageDefaultSize();
  initializeBracket();
});
