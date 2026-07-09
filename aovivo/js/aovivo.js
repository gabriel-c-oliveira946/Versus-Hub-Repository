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

  // Função que filtra os cards de torneio
  function executarBuscaHeader() {
    if (!searchInput) return;

    const termo = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".card-torneio");

    if (!cards.length) return; // página sem cards

    cards.forEach((card) => {
      // tenta pegar do data-nome; se não tiver, usa o texto do card
      const nomeData = (card.dataset.nome || "").toLowerCase();
      const textoCard = card.textContent.toLowerCase();

      const corresponde =
        termo === "" ||
        nomeData.includes(termo) ||
        textoCard.includes(termo);

      // seus cards são display:flex, então mostramos como 'flex'
      card.style.display = corresponde ? "flex" : "none";
    });
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

  // Cria as "bolinhas" (indicadores)
  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.addEventListener("click", () => goToSlide(i));
    indicatorsContainer.appendChild(dot);
  });

  function updateIndicators() {
    const dots = document.querySelectorAll("#carouselIndicators span");
    dots.forEach((d) => d.classList.remove("active"));
    dots[index].classList.add("active");
  }

  function showSlide() {
    slides.forEach((slide) => slide.classList.remove("active"));
    slides[index].classList.add("active");
    updateIndicators();
  }

  function goToSlide(idx) {
    index = idx;
    showSlide();
  }

  nextBtn.addEventListener("click", () => {
    index = (index + 1) % slides.length;
    showSlide();
  });

  prevBtn.addEventListener("click", () => {
    index = (index - 1 + slides.length) % slides.length;
    showSlide();
  });

  showSlide(); // mostra o primeiro slide

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
//  LOGIN FAKE + MENU DO USUÁRIO NO HEADER
// =========================================

document.addEventListener("DOMContentLoaded", () => {
  const btEntrar = document.getElementById("btentrar");
  const btCadastrar = document.getElementById("btcadastrar");
  const userBtn = document.getElementById("userBtn"); // ícone (imagem)
  const menuUser = document.getElementById("menuUser"); // UL do menu
  const userIconDiv = document.querySelector(".user-icon");

  // Se não tiver esses elementos, não faz nada (outra página)
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

  // 
  //  Lê usuário do localstorage
  // 
  
  let loggedUser = null;
  const raw = localStorage.getItem("vh_loggedUser");

  if (raw) {
    try {
      loggedUser = JSON.parse(raw); // { nome, email, ... }
    } catch (err) {
      console.error("Erro ao ler vh_loggedUser:", err);
    }
  }

  // Função para aplicar o estado visual do header
  function aplicarEstadoHeader(user) {
    if (user && user.nome) {
      // ---------- USUÁRIO LOGADO ----------

      // some com "Entrar" e "Cadastrar-se"
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

      // monta menu do usuário logado
      menuUser.innerHTML = `
        <li class="vh-user-name">Olá, <strong>${user.nome}</strong></li>
        <hr>
        <li><a href="#" id="linkPerfil">Perfil</a></li>
        <li><a href="#" id="trocarConta">Mudar de conta</a></li>
        <li><a href="#" id="sairConta">Sair da conta</a></li>
      `;

      const linkSair = document.getElementById("sairConta");
      const linkTrocar = document.getElementById("trocarConta");

      // sair da conta limpa localstorage e recarrega
      if (linkSair) {
        linkSair.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.removeItem("vh_loggedUser");
          window.location.reload();
        });
      }

      // mudar de conta  limpa e leva para login

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

  //header iniicial quando recarregar pagina quando tiver logado
  aplicarEstadoHeader(loggedUser);
});
