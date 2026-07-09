// =========================
//  CARROSSEL 
// =========================

const slides = document.querySelectorAll(".carousel-slide");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const indicatorsContainer = document.getElementById("carouselIndicators");

   const btEntrar = document.getElementById("btentrar");
  const btCadastrar = document.getElementById("btcadastrar");
  const userBtn = document.getElementById("userBtn");
  const menuUser = document.getElementById("menuUser");
  const userIconDiv = document.querySelector(".user-icon");

  // ========= NOVO: elementos da busca do header =========
  const searchForm  = document.querySelector(".search-header");
  const searchInput = document.getElementById("searchInput");
  const searchBtn   = document.getElementById("searchBtn");

  // Função que filtra os cards de torneio e de equipe
  function executarBuscaHeader() {
    if (!searchInput) return;

    const termo = searchInput.value.trim().toLowerCase();
    const cardsTorneio = document.querySelectorAll(".card-torneio");
    const cardsEquipe = document.querySelectorAll(".card-equipe");

    if (cardsTorneio.length) {
      cardsTorneio.forEach((card) => {
        const nomeData = (card.dataset.nome || "").toLowerCase();
        const textoCard = card.textContent.toLowerCase();
        const corresponde =
          termo === "" ||
          nomeData.includes(termo) ||
          textoCard.includes(termo);
        card.style.display = corresponde ? "flex" : "none";
      });
    }

    if (cardsEquipe.length) {
      const filtroBuscaEquipe = document.getElementById('filtroBuscaEquipe');
      if (filtroBuscaEquipe && filtroBuscaEquipe.value !== searchInput.value) {
        filtroBuscaEquipe.value = searchInput.value;
      }
      cardsEquipe.forEach((card) => {
        const nomeData = (card.dataset.nome || "").toLowerCase();
        const jogoData = (card.dataset.jogo || "").toLowerCase();
        const textoCard = card.textContent.toLowerCase();
        const corresponde =
          termo === "" ||
          nomeData.includes(termo) ||
          jogoData.includes(termo) ||
          textoCard.includes(termo);
        card.style.display = corresponde ? "block" : "none";
      });
    }
  }

  // quando digitar na caixa de pesquisa do header (busca em tempo real)
  if (searchInput) {
    searchInput.addEventListener("input", executarBuscaHeader);
  }

  // quando enviar o formulário (Enter no input)
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      executarBuscaHeader();
    });
  }

  // quando clicar na lupa
  if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      executarBuscaHeader();
    });
  }

// Só monta o carrossel se a página tiver slides
if (slides.length && nextBtn && prevBtn && indicatorsContainer) {
  let index = 0;
  let autoPlayInterval = null;
  const carouselEl = document.getElementById("carousel");

  // Cria as "bolinhas" (indicadores)
  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.addEventListener("click", () => {
      goToSlide(i);
      resetAutoPlay();
    });
    indicatorsContainer.appendChild(dot);
  });

  function updateIndicators() {
    const dots = document.querySelectorAll("#carouselIndicators span");
    dots.forEach((d) => d.classList.remove("active"));
    if (dots[index]) {
      dots[index].classList.add("active");
    }
  }

  function showSlide() {
    slides.forEach((slide) => slide.classList.remove("active"));
    if (slides[index]) {
      slides[index].classList.add("active");
    }
    updateIndicators();
  }

  function goToSlide(idx) {
    index = idx;
    showSlide();
  }

  function nextSlide() {
    index = (index + 1) % slides.length;
    showSlide();
  }

  function prevSlide() {
    index = (index - 1 + slides.length) % slides.length;
    showSlide();
  }

  nextBtn.addEventListener("click", () => {
    nextSlide();
    resetAutoPlay();
  });

  prevBtn.addEventListener("click", () => {
    prevSlide();
    resetAutoPlay();
  });

  // Função para iniciar reprodução automática (5 segundos por slide)
  function startAutoPlay() {
    if (!autoPlayInterval) {
      autoPlayInterval = setInterval(nextSlide, 5000);
    }
  }

  // Função para parar reprodução automática
  function stopAutoPlay() {
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
  }

  // Reseta o timer ao interagir manualmente
  function resetAutoPlay() {
    stopAutoPlay();
    startAutoPlay();
  }

  // Eventos de mouse no container para pausar / retomar
  if (carouselEl) {
    carouselEl.addEventListener("mouseenter", stopAutoPlay);
    carouselEl.addEventListener("mouseleave", startAutoPlay);
  }

  showSlide(); // mostra o primeiro slide
  startAutoPlay(); // inicia o auto play

  // -------- efeito de "pulso" no carrossel --------
  document.addEventListener("DOMContentLoaded", () => {
    const carousel = document.getElementById("carousel");
    const prev = document.getElementById("prevBtn");
    const next = document.getElementById("nextBtn");

    const SLIDE_DURATION = 500; // tempo da transição do slide

    if (!carousel) return;

    function runSequence() {
      // escurece um pouco enquanto troca
      carousel.classList.add("shadow-off");

      setTimeout(() => {
        carousel.classList.remove("shadow-off");

        // reinicia a animação pulse
        carousel.classList.remove("pulse");
        void carousel.offsetWidth; // força reflow
        carousel.classList.add("pulse");

        // remove classe depois da animação
        setTimeout(() => carousel.classList.remove("pulse"), 800);
      }, SLIDE_DURATION);
    }

    if (prev) prev.addEventListener("click", runSequence);
    if (next) next.addEventListener("click", runSequence);

    carousel.addEventListener("slideChanged", runSequence);
  });
}

// =========================
//  SIDEBAR (menu lateral)
// =========================

const menuToggle = document.getElementById("menuToggle"); // botão hamburguer
const sidebar = document.getElementById("sidebar"); // aside da sidebar
const sidebarOverlay = document.getElementById("sidebarOverlay"); // fundo escuro

if (menuToggle && sidebar && sidebarOverlay) {
  // abre/fecha sidebar
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("open");
  });

  // fecha clicando no fundo escuro
  sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("open");
  });
}

// =========================================
//  LOGIN FAKE + MENU DO USUARIO NO HEADER
// =========================================

document.addEventListener("DOMContentLoaded", () => {
  const btEntrar = document.getElementById("btentrar");
  const btCadastrar = document.getElementById("btcadastrar");
  const userBtn = document.getElementById("userBtn"); // ícone (imagem)
  const menuUser = document.getElementById("menuUser"); // UL do menu
  const userIconDiv = document.querySelector(".user-icon");

  // se não tiver esses elementos, não faz nada :

  if (!userBtn || !menuUser || !userIconDiv) return;

  // Garante menu escondido no início
  menuUser.style.display = "none";

  // Abre/fecha menu ao clicar no ícone
  userBtn.addEventListener("click", (e) => {

    e.stopPropagation(); // evita fechar pelo clique global

    menuUser.style.display =

      menuUser.style.display === "block" ? "none" : "block";
  });

  // Fecha menu ao clicar fora
  document.addEventListener("click", (e) => {
    if (!userIconDiv.contains(e.target)) {
      menuUser.style.display = "none";
    }
  });

  // ===========================
  //  Le usuário do localstorage
  // ===========================
  let loggedUser = null;
  const raw = localStorage.getItem("vh_loggedUser");

  if (raw) {
    try {
      loggedUser = JSON.parse(raw); // { nome, email, ... }
    } catch (err) {
      console.error("Erro ao ler vh_loggedUser:", err);
    }
  }

  // Função para aplicar o estado visual do header //

  function aplicarEstadoHeader(user) {
    if (user && user.nome) {

      // ---------- USUÁRIO LOGADO ----------

      // some com entrar e cadastrar

      if (btEntrar) btEntrar.style.display = "none";
      if (btCadastrar) btCadastrar.style.display = "none";

      // cria/atualiza span com o nome à ESQUERDA do ícone
      let nomeSpan = document.getElementById("vhUserName");
      if (!nomeSpan) {
        nomeSpan = document.createElement("span");
        nomeSpan.id = "vhUserName";
        nomeSpan.className = "username-header";
        // insere ANTES da imagem do usuário => nome à esquerda
        userIconDiv.insertBefore(nomeSpan, userBtn);
      }
      nomeSpan.textContent = user.nome;

      // monta menu do usuario logado

      menuUser.innerHTML = `
        <li class="vh-user-name">Olá, <strong>${user.nome}</strong></li>
        <hr>
        <li><a href="/perfil/perfil-publico.html" id="linkPerfilPublico">Ver Perfil Público</a></li>
        <li><a href="/perfil/perfil.html" id="linkPerfil">Editar Perfil</a></li>
        <li><a href="#" id="trocarConta">Mudar de conta</a></li>
        <li><a href="#" id="sairConta">Sair da conta</a></li>
      `;

      const linkSair = document.getElementById("sairConta");
      const linkTrocar = document.getElementById("trocarConta");

      // quando clica sair da conta o localstarage é apagado e carrega a pagina 
      if (linkSair) {
        linkSair.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.removeItem("vh_loggedUser");
          window.location.reload();
        });
      }

      // aqui qundo o cara clica pra mudar conta o local storage é apagado e o user vai pra page de login

      if (linkTrocar) {
        linkTrocar.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.removeItem("vh_loggedUser");
          window.location.href = "/login/login.html";
        });
      }
    } else {

      // ---------- ninguem LOGADO ----------

      // mostra botões padrão
      if (btEntrar) btEntrar.style.display = "";
      if (btCadastrar) btCadastrar.style.display = "";

      // remove span com nome se existir
      const nomeSpan = document.getElementById("vhUserName");
      if (nomeSpan) nomeSpan.remove();

      // menu simples com Login / Cadastro
      menuUser.innerHTML = `
        <li><a href="/login/login.html">Login</a></li>
        <hr>
        <li><a href="/cadastro/cadastro.html">Cadastro</a></li>
      `;
    }
  }


  
  // deixa apenas a fotinha do cara n logado e os botões pra logar e cadastrar

  aplicarEstadoHeader(loggedUser);
});


document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = localStorage.getItem('vh_loggedUser');
    if (!raw) return;

    const user = JSON.parse(raw);
    if (!user || !user.avatar) return;

    // pega todos os ícones de usuário (caso tenha em mais de um lugar)
    const userImgs = document.querySelectorAll('#userBtn, .user-icon img');

    userImgs.forEach(img => {
      img.src = user.avatar;
    });
  } catch (err) {
    console.error('Erro ao aplicar avatar no header:', err);
  }
});

// =========================================
//  PROCESSO DE SOLICITAÇÃO DE INGRESSO EM EQUIPES
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  const joinBtn = document.querySelector('.btn-join-team');
  if (!joinBtn) return;

  const teamNameEl = document.querySelector('.team-info h1') || document.querySelector('.team-hero h1');
  const teamName = teamNameEl ? teamNameEl.textContent.trim() : 'Equipe';

  // Verificar se há uma solicitação pendente no localStorage
  let requests = {};
  try {
    requests = JSON.parse(localStorage.getItem('vh_teamJoinRequests') || '{}');
  } catch (e) {
    requests = {};
  }

  const loggedUserRaw = localStorage.getItem('vh_loggedUser');

  // Ajusta estado inicial do botão se já solicitado e logado
  if (loggedUserRaw && requests[teamName]) {
    joinBtn.innerHTML = 'Pendente de Aprovação <i class="fa-solid fa-envelope" style="color: #60a5fa; margin-left: 6px;"></i>';
    joinBtn.style.background = '#22c55e'; // cor verde
    joinBtn.style.borderColor = '#22c55e';
  }

  joinBtn.addEventListener('click', () => {
    const userRaw = localStorage.getItem('vh_loggedUser');
    if (!userRaw) {
      showAuthToast("Faça login para se inscrever ou entrar em equipes!");
      return;
    }

    const user = JSON.parse(userRaw);
    let currentRequests = {};
    try {
      currentRequests = JSON.parse(localStorage.getItem('vh_teamJoinRequests') || '{}');
    } catch (e) {
      currentRequests = {};
    }

    if (currentRequests[teamName]) {
      // Cancela a solicitação (Alterna estado)
      delete currentRequests[teamName];
      localStorage.setItem('vh_teamJoinRequests', JSON.stringify(currentRequests));
      joinBtn.innerHTML = 'Pedir para entrar';
      joinBtn.style.background = '#d41111'; // cor vermelha original
      joinBtn.style.borderColor = '#d41111';
      showNotificationToast("Solicitação de entrada cancelada.", "info");
    } else {
      // Cria a solicitação
      currentRequests[teamName] = {
        userEmail: user.email,
        userName: user.nome,
        date: new Date().toISOString()
      };
      localStorage.setItem('vh_teamJoinRequests', JSON.stringify(currentRequests));
      joinBtn.innerHTML = 'Pendente de Aprovação <i class="fa-solid fa-envelope" style="color: #60a5fa; margin-left: 6px;"></i>';
      joinBtn.style.background = '#22c55e'; // cor verde
      joinBtn.style.borderColor = '#22c55e';
      showNotificationToast(`Solicitação enviada para o time ${teamName}!`, "success");
    }
  });

  // Toasts personalizados e responsivos para segurança de autenticação
  function showAuthToast(message) {
    let toast = document.getElementById("vh-auth-toast");
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = "vh-auth-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.right = "30px";
    toast.style.background = "#141419";
    toast.style.color = "#ffffff";
    toast.style.border = "1px solid #d41111";
    toast.style.borderRadius = "12px";
    toast.style.padding = "16px 20px";
    toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "system-ui, sans-serif";
    toast.style.display = "flex";
    toast.style.flexDirection = "column";
    toast.style.gap = "10px";
    toast.style.maxWidth = "320px";
    toast.style.animation = "slideInRight 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards";

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">🔒</span>
        <span style="font-weight: 600; font-size: 14px;">${message}</span>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 4px;">
        <a href="/login/login.html" style="background: #d41111; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-align: center; flex: 1;">Entrar</a>
        <button id="close-toast-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex: 1;">Fechar</button>
      </div>
    `;

    document.body.appendChild(toast);
    setupToastAnimation();

    const closeBtn = toast.querySelector("#close-toast-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      });
    }

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  function showNotificationToast(message, type) {
    let toast = document.getElementById("vh-notif-toast");
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = "vh-notif-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.right = "30px";
    toast.style.background = "#141419";
    toast.style.color = "#ffffff";
    toast.style.border = type === "success" ? "1px solid #22c55e" : "1px solid #3b82f6";
    toast.style.borderRadius = "12px";
    toast.style.padding = "16px 20px";
    toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "system-ui, sans-serif";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.style.maxWidth = "320px";
    toast.style.animation = "slideInRight 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards";

    const icon = type === "success" 
      ? '<i class="fa-solid fa-circle-check" style="color: #22c55e; font-size: 18px;"></i>' 
      : '<i class="fa-solid fa-circle-info" style="color: #3b82f6; font-size: 18px;"></i>';
    toast.innerHTML = `
      <span>${icon}</span>
      <span style="font-weight: 600; font-size: 14px;">${message}</span>
    `;

    document.body.appendChild(toast);
    setupToastAnimation();

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }

  function setupToastAnimation() {
    if (!document.getElementById("vh-toast-style")) {
      const style = document.createElement("style");
      style.id = "vh-toast-style";
      style.innerHTML = `
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }
});

// =========================================
//  FILTRO DE CATEGORIAS (BOTÕES VERMELHOS)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  const categoryButtons = document.querySelectorAll('.btn-filtro-categoria');
  const tournamentSections = document.querySelectorAll('.bloco-categoria');
  
  if (!categoryButtons.length) return;

  // Cria dinamicamente a mensagem de "nenhum torneio" se ela não existir
  let noTournamentsMsg = document.getElementById("no-tournaments-msg");
  if (!noTournamentsMsg) {
    noTournamentsMsg = document.createElement("div");
    noTournamentsMsg.id = "no-tournaments-msg";
    noTournamentsMsg.style.textAlign = "center";
    noTournamentsMsg.style.padding = "60px 20px";
    noTournamentsMsg.style.background = "#141419";
    noTournamentsMsg.style.borderRadius = "20px";
    noTournamentsMsg.style.border = "1px dashed rgba(255, 255, 255, 0.1)";
    noTournamentsMsg.style.maxWidth = "600px";
    noTournamentsMsg.style.margin = "40px auto 80px auto";
    noTournamentsMsg.style.display = "none";
    noTournamentsMsg.style.fontFamily = "system-ui, sans-serif";
    noTournamentsMsg.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
    
    noTournamentsMsg.innerHTML = `
      <span style="font-size: 56px; display: block; margin-bottom: 20px; color: #ff3e3e;"><i class="fa-solid fa-gamepad"></i></span>
      <h3 style="font-size: 22px; color: #ffffff; margin-bottom: 10px; font-weight: 800;">Nenhum Torneio Nesta Categoria</h3>
      <p style="font-size: 15px; color: #9ca3af; margin-bottom: 25px; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.6;">Não existem torneios competitivos ativos para esta categoria no momento. Que tal ser o pioneiro e criar o seu?</p>
      <a href="/criar_torneio/criar_torneio.html" style="display: inline-flex; align-items: center; justify-content: center; background: #d41111; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 999px; font-size: 14px; font-weight: 700; gap: 8px; box-shadow: 0 4px 15px rgba(212, 17, 17, 0.4); transition: 0.3s ease-in-out;">Criar Torneio <i class="fa-solid fa-trophy" style="color: #ffd700; margin-left: 6px;"></i></a>
    `;
    
    // Inserir antes do footer
    const footer = document.querySelector('footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(noTournamentsMsg, footer);
    }
  }

  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedCategory = btn.getAttribute('data-categoria-filtro');
      const isAlreadyActive = btn.classList.contains('active');

      // 1. Resetar estados de todos os botões
      categoryButtons.forEach(b => b.classList.remove('active'));

      // 2. Se já estava ativo, remove o filtro e exibe tudo
      if (isAlreadyActive) {
        // Exibir todas as seções e todos os cards
        tournamentSections.forEach(section => {
          section.style.display = 'block';
          const cards = section.querySelectorAll('.card-torneio');
          cards.forEach(card => {
            card.style.display = 'flex';
          });
        });
        noTournamentsMsg.style.display = 'none';
        return;
      }

      // 3. Caso contrário, ativa o filtro
      btn.classList.add('active');

      // Mapear o filtro do botão para as categorias dos cards
      // Tiro engloba 'fps' e 'battle-royale'
      // Moba engloba 'moba'
      // Luta engloba 'luta' ou 'combate'
      // Esportes engloba 'esportes'
      // Cartas engloba 'cartas' ou 'card'
      let matchingCategories = [selectedCategory];
      if (selectedCategory === 'tiro') {
        matchingCategories = ['fps', 'battle-royale'];
      } else if (selectedCategory === 'cartas') {
        matchingCategories = ['cartas', 'card', 'card_game'];
      }

      let anyCardVisibleOverall = false;

      tournamentSections.forEach(section => {
        const cards = section.querySelectorAll('.card-torneio');
        let visibleCardsInSectionCount = 0;

        cards.forEach(card => {
          const cardCategory = card.getAttribute('data-categoria');
          const isMatch = matchingCategories.includes(cardCategory);

          if (isMatch) {
            card.style.display = 'flex';
            visibleCardsInSectionCount++;
            anyCardVisibleOverall = true;
          } else {
            card.style.display = 'none';
          }
        });

        // Se a seção não tiver nenhum card visível, esconde a seção inteira
        if (visibleCardsInSectionCount > 0) {
          section.style.display = 'block';
        } else {
          section.style.display = 'none';
        }
      });

      // Se não houver nenhum card visível em toda a página, exibe a mensagem de feedback amigável
      if (anyCardVisibleOverall) {
        noTournamentsMsg.style.display = 'none';
      } else {
        noTournamentsMsg.style.display = 'block';
      }

      // Rolar suavemente até a âncora de torneios
      const targetAnchor = document.getElementById('categorias');
      if (targetAnchor) {
        targetAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});

// =========================================================
//  GLOBAL EMOJI TO PREMIUM FONTAWESOME ICON REPLACER
// =========================================================
function replaceEmojisWithIcons() {
  // Dynamically load Font Awesome on all pages if not present
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
    document.head.appendChild(link);
  }

  const emojiToIconMap = {
    "🏠": '<i class="fa-solid fa-house" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🏆": '<i class="fa-solid fa-trophy" style="color: #ffd700; margin-right: 8px;"></i>',
    "🎖️": '<i class="fa-solid fa-medal" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "👥": '<i class="fa-solid fa-users" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "📊": '<i class="fa-solid fa-chart-simple" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "📄": '<i class="fa-solid fa-file-invoice" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "💼": '<i class="fa-solid fa-briefcase" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "⭐": '<i class="fa-solid fa-star" style="color: #ffd700; margin-right: 8px;"></i>',
    "🎮": '<i class="fa-solid fa-gamepad" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "📅": '<i class="fa-solid fa-calendar-days" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🎯": '<i class="fa-solid fa-crosshairs" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "⚔️": '<i class="fa-solid fa-hand-fist" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "⚽": '<i class="fa-solid fa-futbol" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🖥️": '<i class="fa-solid fa-desktop" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "💻": '<i class="fa-solid fa-desktop" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "📱": '<i class="fa-solid fa-mobile-screen-button" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "☁️": '<i class="fa-solid fa-cloud" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🛡️": '<i class="fa-solid fa-shield-halved" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "👑": '<i class="fa-solid fa-crown" style="color: #ffd700; margin-right: 8px;"></i>',
    "✉️": '<i class="fa-solid fa-envelope" style="color: #ff3e3e; margin-left: 6px;"></i>',
    "✅": '<i class="fa-solid fa-circle-check" style="color: #22c55e; margin-right: 6px;"></i>',
    "ℹ️": '<i class="fa-solid fa-circle-info" style="color: #ff3e3e; margin-right: 6px;"></i>',
    "🪂": '<i class="fa-solid fa-parachute-box" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "📸": '<i class="fa-solid fa-camera" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "📷": '<i class="fa-solid fa-camera" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🏢": '<i class="fa-solid fa-building" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🌐": '<i class="fa-solid fa-earth-americas" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "🎁": '<i class="fa-solid fa-gift" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "💳": '<i class="fa-solid fa-credit-card" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "💵": '<i class="fa-solid fa-money-bill-1-wave" style="color: #ff3e3e; margin-right: 8px;"></i>',
    "❌": '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; margin-right: 8px;"></i>'
  };

  const elements = document.querySelectorAll("a, span, h2, h3, button, label, .badge, .tile-icon");
  elements.forEach(el => {
    if (el.querySelector("input")) {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let node;
      const nodesToReplace = [];
      while (node = walk.nextNode()) {
        nodesToReplace.push(node);
      }
      nodesToReplace.forEach(textNode => {
        let text = textNode.nodeValue;
        for (const [emoji, replacement] of Object.entries(emojiToIconMap)) {
          if (text.includes(emoji)) {
            const span = document.createElement("span");
            span.innerHTML = text.split(emoji).join(replacement);
            textNode.parentNode.replaceChild(span, textNode);
            break;
          }
        }
      });
    } else {
      let html = el.innerHTML;
      let modified = false;
      for (const [emoji, replacement] of Object.entries(emojiToIconMap)) {
        if (html.includes(emoji)) {
          html = html.split(emoji).join(replacement);
          modified = true;
        }
      }
      if (modified) {
        el.innerHTML = html;
      }
    }
  });
}

// Inicializações seguras do Replacer
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    replaceEmojisWithIcons();
    startMutationObserver();
  });
} else {
  replaceEmojisWithIcons();
  startMutationObserver();
}

function startMutationObserver() {
  if (window.emojiObserverStarted) return;
  window.emojiObserverStarted = true;

  const observer = new MutationObserver((mutations) => {
    observer.disconnect();
    replaceEmojisWithIcons();
    observer.observe(document.body, { childList: true, subtree: true });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}
