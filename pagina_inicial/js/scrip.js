// ===================================
//  AUTENTICAÇÃO & ELEMENTOS DO HEADER
// ===================================

const btEntrar = document.getElementById("btentrar");
  const btCadastrar = document.getElementById("btcadastrar");
  const userBtn = document.getElementById("userBtn");
  const menuUser = document.getElementById("menuUser");
  const userIconDiv = document.querySelector(".user-icon");

  // ========= Busca Global no Header com redirecionamento =========
  const searchForm  = document.querySelector(".search-header");
  const searchInput = document.getElementById("searchInput");
  const searchBtn   = document.getElementById("searchBtn");

  // Redireciona o usuário com base na rota atual (Busca Inteligente)
  function executarBuscaHeader() {
    if (!searchInput) return;
    const termoDigitado = searchInput.value.trim();
    const rota = window.location.pathname.toLowerCase();

    if (rota.includes('aovivo')) {
      // Na página ao vivo, a busca é dinâmica em tempo real no próprio container
      return;
    } else if (rota.includes('ranking')) {
      window.location.href = '/ranking.html?busca=' + encodeURIComponent(termoDigitado);
    } else if (rota.includes('equipes')) {
      window.location.href = '/equipes/equipes.html?busca=' + encodeURIComponent(termoDigitado);
    } else if (rota.includes('torneios')) {
      window.location.href = '/pagina_inicial/torneios.html?busca=' + encodeURIComponent(termoDigitado);
    } else {
      // Estamos na Homepage: consulta diretamente o Supabase e rola até os resultados
      if (document.getElementById('gridTorneiosHome') && typeof window.executarBuscaHomeSupabase === 'function') {
        window.executarBuscaHomeSupabase(termoDigitado, true);
      } else {
        window.location.href = '/pagina_inicial/torneios.html?busca=' + encodeURIComponent(termoDigitado);
      }
    }
  }
  window.executarBuscaHeader = executarBuscaHeader;

  // Se o usuário já estiver na página de equipes, torneios, ranking ou homepage, sincroniza a digitação com o filtro local/supabase
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const campoEquipe = document.getElementById('filtroBuscaEquipe');
      if (campoEquipe && window.location.pathname.includes('/equipes/equipes.html')) {
        campoEquipe.value = searchInput.value;
        campoEquipe.dispatchEvent(new Event('input'));
      }
      const campoTorneios = document.getElementById('filtroBusca');
      if (campoTorneios && window.location.pathname.includes('torneios')) {
        campoTorneios.value = searchInput.value;
        campoTorneios.dispatchEvent(new Event('input'));
      }
      const campoRanking = document.getElementById('rankingSearch');
      if (campoRanking && window.location.pathname.includes('ranking')) {
        campoRanking.value = searchInput.value;
        campoRanking.dispatchEvent(new Event('input'));
      }
      const gridHome = document.getElementById('gridTorneiosHome');
      if (gridHome && typeof window.executarBuscaHomeSupabase === 'function') {
        if (window._debounceHomeSearch) clearTimeout(window._debounceHomeSearch);
        window._debounceHomeSearch = setTimeout(() => {
          window.executarBuscaHomeSupabase(searchInput.value.trim(), false);
        }, 350);
      }
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

// =========================================================
//  CARROSSEL DE TORNEIOS (CONSULTA DINÂMICA AO BANCO DE DADOS)
// =========================================================
async function inicializarCarrosselTorneios() {
  const carouselEl = document.getElementById("carousel");
  const slidesContainer = document.getElementById("carouselSlidesContainer") || carouselEl;
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const indicatorsContainer = document.getElementById("carouselIndicators");

  if (!carouselEl || !nextBtn || !prevBtn || !indicatorsContainer) return;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  try {
    const { supabase } = await import('/supabaseClient.js');
    const { data, error } = await supabase
      .from('torneios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar torneios para o carrossel:', error);
      const loadingEl = document.getElementById('carouselLoading');
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div style="text-align: center; color: #a1a1aa; padding: 20px;">
            <p style="font-size: 15px; font-weight: 600; color: #f87171; margin: 0;">Não foi possível carregar os torneios no momento.</p>
          </div>
        `;
      }
      return;
    }

    if (!data || data.length === 0) {
      const loadingEl = document.getElementById('carouselLoading');
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div style="text-align: center; color: #a1a1aa; padding: 20px;">
            <p style="font-size: 15px; font-weight: 600; color: #e4e4e7; margin: 0;">Nenhum torneio cadastrado.</p>
          </div>
        `;
      }
      return;
    }

    // Limpar slides anteriores e indicadores
    slidesContainer.innerHTML = '';
    indicatorsContainer.innerHTML = '';

    // Utiliza os torneios cadastrados (exibe até 8 em destaque no carrossel)
    const torneiosDestaque = data.slice(0, 8);

    torneiosDestaque.forEach((t, i) => {
      const banner = t.banner || '/images/cerradocup.jpg';
      const link = (t.link && t.link.startsWith('/') && !t.link.includes('?'))
        ? t.link
        : ('/torneio/custom.html?id=' + encodeURIComponent(t.id));
      const nomeSeguro = escapeHtml(t.nome || 'Torneio');
      const tagSegura = escapeHtml(t.jogo ? t.jogo.split('•')[0].trim() : (t.categoria || 'Torneio')).toUpperCase();

      const slideDiv = document.createElement('div');
      slideDiv.className = `carousel-slide ${i === 0 ? 'active' : ''}`;
      slideDiv.innerHTML = `
        <a href="${link}" class="carousel-link">
          <img referrerpolicy="no-referrer" src="${banner}" alt="${nomeSeguro}" onerror="this.onerror=null;this.src='/images/cerradocup.jpg';">
          <div class="carousel-caption">
            <span class="carousel-tag">${tagSegura}</span>
            <h3 class="carousel-slide-title">${nomeSeguro}</h3>
            <span class="carousel-action-btn">Ver Torneio <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i></span>
          </div>
        </a>
      `;
      slidesContainer.appendChild(slideDiv);

      // Cria a bolinha indicadora
      const dot = document.createElement('span');
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => {
        goToSlide(i);
        resetAutoPlay();
      });
      indicatorsContainer.appendChild(dot);
    });

    const slidesList = slidesContainer.querySelectorAll('.carousel-slide');
    const dotsList = indicatorsContainer.querySelectorAll('span');
    let currentIndex = 0;
    let autoPlayInterval = null;
    const SLIDE_DURATION = 500;

    function updateIndicators() {
      dotsList.forEach((d, idx) => {
        if (idx === currentIndex) d.classList.add('active');
        else d.classList.remove('active');
      });
    }

    function runPulseEffect() {
      carouselEl.classList.add('shadow-off');
      setTimeout(() => {
        carouselEl.classList.remove('shadow-off');
        carouselEl.classList.remove('pulse');
        void carouselEl.offsetWidth; // força reflow
        carouselEl.classList.add('pulse');
        setTimeout(() => carouselEl.classList.remove('pulse'), 800);
      }, SLIDE_DURATION);
    }

    function showSlide() {
      slidesList.forEach((s, idx) => {
        if (idx === currentIndex) s.classList.add('active');
        else s.classList.remove('active');
      });
      updateIndicators();
      runPulseEffect();
    }

    function goToSlide(idx) {
      if (currentIndex === idx) return;
      currentIndex = idx;
      showSlide();
    }

    function nextSlide() {
      currentIndex = (currentIndex + 1) % slidesList.length;
      showSlide();
    }

    function prevSlide() {
      currentIndex = (currentIndex - 1 + slidesList.length) % slidesList.length;
      showSlide();
    }

    nextBtn.onclick = () => {
      nextSlide();
      resetAutoPlay();
    };

    prevBtn.onclick = () => {
      prevSlide();
      resetAutoPlay();
    };

    function startAutoPlay() {
      if (!autoPlayInterval && slidesList.length > 1) {
        autoPlayInterval = setInterval(nextSlide, 5000);
      }
    }

    function stopAutoPlay() {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
      }
    }

    function resetAutoPlay() {
      stopAutoPlay();
      startAutoPlay();
    }

    carouselEl.addEventListener('mouseenter', stopAutoPlay);
    carouselEl.addEventListener('mouseleave', startAutoPlay);

    // Inicia rotação automática
    startAutoPlay();

  } catch (err) {
    console.error('Erro ao conectar e inicializar carrossel de torneios:', err);
  }
}

// Inicia o carrossel se estiver presente na página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarCarrosselTorneios);
} else {
  inicializarCarrosselTorneios();
}
window.recarregarCarrosselTorneios = inicializarCarrosselTorneios;

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

      const publicProfileLink = user.id ? `/perfil/perfil-publico.html?id=${encodeURIComponent(user.id)}` : '/perfil/perfil-publico.html';

      menuUser.innerHTML = `
        <li class="vh-user-name"><strong>${user.nome}</strong></li>
        <hr>
        <li><a href="${publicProfileLink}" id="linkPerfilPublico"><i class="fa-solid fa-user" style="margin-right: 8px;"></i>Ver Perfil Público</a></li>
        <li><a href="/perfil/perfil.html" id="linkPerfil"><i class="fa-solid fa-pen-to-square" style="margin-right: 8px;"></i>Editar Perfil</a></li>
        <li><a href="/gerenciartorneios/gerentornindex.html"><i class="fa-solid fa-file-invoice" style="margin-right: 8px;"></i>Gerenciar Torneios</a></li>
        <li><a href="/equipes/gerenciar_equipes.html"><i class="fa-solid fa-list-check" style="margin-right: 8px;"></i>Gerenciar Equipes</a></li>
        <hr>
        <li><a href="#" id="trocarConta"><i class="fa-solid fa-arrow-right-arrow-left" style="margin-right: 8px;"></i>Mudar de conta</a></li>
        <li><a href="#" id="sairConta"><i class="fa-solid fa-right-from-bracket" style="margin-right: 8px;"></i>Sair da conta</a></li>
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
        <li><a href="/login/login.html"><i class="fa-solid fa-right-to-bracket" style="margin-right: 8px;"></i>Login</a></li>
        <hr>
        <li><a href="/cadastro/cadastro.html"><i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i>Cadastro</a></li>
        <hr>
        <li><a href="/gerenciartorneios/gerentornindex.html"><i class="fa-solid fa-file-invoice" style="margin-right: 8px;"></i>Gerenciar Torneios</a></li>
        <li><a href="/equipes/gerenciar_equipes.html"><i class="fa-solid fa-list-check" style="margin-right: 8px;"></i>Gerenciar Equipes</a></li>
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

// =================================================================
//  HOMEPAGE: CONSULTA EXCLUSIVA E FILTRAGEM DE CATEGORIAS
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
  const gridTorneiosHome = document.getElementById('gridTorneiosHome');
  const categoryButtons = document.querySelectorAll('.btn-filtro-categoria');
  
  if (!gridTorneiosHome) return;

  const homeLoading = document.getElementById('homeLoading');
  const noTournamentsMsg = document.getElementById('no-tournaments-msg');
  const noTournamentsTitle = document.getElementById('no-tournaments-title');
  const noTournamentsDesc = document.getElementById('no-tournaments-desc');
  const btnLimparFiltrosHome = document.getElementById('btnLimparFiltrosHome');
  const tituloSecao = document.getElementById('tituloSecaoTorneios');
  const statusFiltro = document.getElementById('statusFiltroAtivo');
  const searchInput = document.getElementById('searchInput');

  let categoriaAtiva = null;
  let termoBuscaAtivo = '';

  const nomesCategorias = {
    luta: 'Jogos de Luta',
    esportes: 'Futebol e Esportes',
    futebol: 'Futebol e Esportes',
    fps: 'FPS / Tiro',
    tiro: 'FPS / Tiro',
    cartas: 'Card Games',
    card: 'Card Games',
    moba: 'Jogos MOBA'
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Consulta assíncrona exclusivamente na tabela 'torneios' do Supabase
  async function carregarTorneiosSupabase() {
    if (homeLoading) homeLoading.style.display = 'flex';
    gridTorneiosHome.style.display = 'none';
    if (noTournamentsMsg) noTournamentsMsg.style.display = 'none';

    try {
      const { supabase } = await import('/supabaseClient.js');
      let query = supabase.from('torneios').select('*');

      // 1. Filtragem por categoria no Supabase
      if (categoriaAtiva) {
        const cat = categoriaAtiva.toLowerCase();
        if (cat === 'luta') {
          query = query.or('categoria.eq.luta,categoria.ilike.%luta%');
        } else if (cat === 'esportes' || cat === 'futebol') {
          query = query.or('categoria.eq.esportes,categoria.eq.futebol,categoria.ilike.%esporte%,categoria.ilike.%futebol%');
        } else if (cat === 'fps' || cat === 'tiro') {
          query = query.or('categoria.eq.fps,categoria.eq.tiro,categoria.eq.battle-royale,categoria.ilike.%fps%,categoria.ilike.%tiro%');
        } else if (cat === 'cartas' || cat === 'card' || cat === 'card_game') {
          query = query.or('categoria.eq.cartas,categoria.eq.card,categoria.eq.card_game,categoria.ilike.%carta%,categoria.ilike.%card%,jogo.ilike.%tcg%,nome.ilike.%tcg%');
        } else if (cat === 'moba') {
          query = query.or('categoria.eq.moba,categoria.ilike.%moba%');
        } else {
          query = query.eq('categoria', cat);
        }
      }

      // 2. Filtragem por busca no Supabase
      const termo = (termoBuscaAtivo || '').trim();
      if (termo) {
        query = query.or(`nome.ilike.%${termo}%,jogo.ilike.%${termo}%,categoria.ilike.%${termo}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (homeLoading) homeLoading.style.display = 'none';

      if (error) {
        console.error('Erro na consulta de torneios:', error);
        if (noTournamentsMsg) {
          noTournamentsMsg.style.display = 'block';
          if (noTournamentsTitle) noTournamentsTitle.textContent = 'Erro ao Carregar Torneios';
          if (noTournamentsDesc) noTournamentsDesc.textContent = 'Não foi possível carregar os torneios no momento. Tente recarregar a página.';
        }
        return;
      }

      // Atualiza Título da seção
      if (termo && categoriaAtiva) {
        if (tituloSecao) tituloSecao.textContent = `Busca: "${termo}" em ${nomesCategorias[categoriaAtiva] || categoriaAtiva}`;
      } else if (termo) {
        if (tituloSecao) tituloSecao.textContent = `Resultados da busca: "${termo}"`;
      } else if (categoriaAtiva) {
        if (tituloSecao) tituloSecao.textContent = `Torneios de ${nomesCategorias[categoriaAtiva] || categoriaAtiva}`;
      } else {
        if (tituloSecao) tituloSecao.textContent = 'Torneios em Destaque';
      }

      // Atualiza badge de filtro ativo
      if (statusFiltro) {
        if (categoriaAtiva || termo) {
          statusFiltro.style.display = 'inline-block';
          statusFiltro.innerHTML = `Exibindo <strong>${data ? data.length : 0}</strong> torneio(s) cadastrado(s) • <button type="button" id="btnResetarFiltrosBadge" style="background: none; border: none; color: #ff3e3e; text-decoration: underline; cursor: pointer; font-size: 13px; font-weight: 600; padding: 0 4px;">Limpar filtros</button>`;
          const btnResetBadge = document.getElementById('btnResetarFiltrosBadge');
          if (btnResetBadge) {
            btnResetBadge.onclick = (e) => {
              e.preventDefault();
              limparTodosFiltros();
            };
          }
        } else {
          statusFiltro.style.display = 'none';
        }
      }

      if (!data || data.length === 0) {
        gridTorneiosHome.style.display = 'none';
        if (noTournamentsMsg) {
          noTournamentsMsg.style.display = 'block';
          if (categoriaAtiva && termo) {
            if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Encontrado';
            if (noTournamentsDesc) noTournamentsDesc.textContent = `Não encontramos torneios de ${nomesCategorias[categoriaAtiva] || categoriaAtiva} correspondentes a "${termo}".`;
          } else if (categoriaAtiva) {
            if (noTournamentsTitle) noTournamentsTitle.textContent = `Nenhum Torneio em ${nomesCategorias[categoriaAtiva] || categoriaAtiva}`;
            if (noTournamentsDesc) noTournamentsDesc.textContent = `Não existem torneios competitivos cadastrados para esta modalidade no momento. Seja o primeiro a criar um campeonato!`;
          } else if (termo) {
            if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Encontrado';
            if (noTournamentsDesc) noTournamentsDesc.textContent = `Não encontramos torneios cadastrados correspondentes à sua pesquisa por "${termo}".`;
          } else {
            if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Cadastrado';
            if (noTournamentsDesc) noTournamentsDesc.textContent = 'Ainda não há torneios registrados no banco de dados.';
          }
        }
        return;
      }

      // Renderiza os cards reais
      gridTorneiosHome.innerHTML = data.map(t => {
        const banner = t.banner || '/images/cerradocup.jpg';
        const link = (t.link && t.link.startsWith('/') && !t.link.includes('?')) ? t.link : ('/torneio/custom.html?id=' + encodeURIComponent(t.id));
        let statusClass = t.statusClass || (
          t.status && t.status.toLowerCase().includes('andamento') ? 'status-andamento' :
          t.status && t.status.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto'
        );
        let statusTexto = t.status || 'Inscrições abertas';

        if (t.ao_vivo === true || t.transmissao_status === 'ao_vivo' || (t.status && t.status.toLowerCase().includes('ao vivo'))) {
          statusTexto = "Ao Vivo <i class='fa-solid fa-tower-broadcast' style='margin-left: 4px;'></i>";
          statusClass = 'status-andamento';
        }

        const nomeSeguro = escapeHtml(t.nome || 'Torneio');
        const jogoSeguro = escapeHtml(t.jogo || 'Geral');
        const catSegura = (t.categoria || 'Competitivo').toUpperCase();
        const platSegura = (t.plataforma || 'Multi').toUpperCase();

        return `
          <article class="card-torneio"
            data-id="${t.id}"
            data-nome="${nomeSeguro}"
            data-jogo="${jogoSeguro}"
            data-categoria="${t.categoria || ''}"
            data-plataforma="${t.plataforma || ''}"
            data-status="${t.status || ''}">
            
            <img referrerpolicy="no-referrer" src="${banner}" alt="${nomeSeguro}" onerror="this.onerror=null;this.src='/images/cerradocup.jpg';">
            <div class="card-info">
              <h2>${nomeSeguro}</h2>
              <p class="jogo">Jogo: ${jogoSeguro} • ${catSegura} • ${platSegura}</p>
              <p class="data">Início: ${t.data || 'Em breve'}</p>
              <p class="status ${statusClass}">${statusTexto}</p>
              <a href="${link}"><button class="btn-detalhes">Ver detalhes</button></a>
            </div>
          </article>
        `;
      }).join('');

      gridTorneiosHome.style.display = 'grid';

    } catch (err) {
      console.error('Falha ao conectar no banco de dados:', err);
      if (homeLoading) homeLoading.style.display = 'none';
      if (noTournamentsMsg) noTournamentsMsg.style.display = 'block';
    }
  }

  function limparTodosFiltros() {
    categoriaAtiva = null;
    termoBuscaAtivo = '';
    categoryButtons.forEach(b => b.classList.remove('active'));
    if (searchInput) searchInput.value = '';
    carregarTorneiosSupabase();
  }

  // Interação com botões de categoria
  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedCategory = btn.getAttribute('data-categoria-filtro');
      const isAlreadyActive = btn.classList.contains('active');

      categoryButtons.forEach(b => b.classList.remove('active'));

      if (isAlreadyActive) {
        categoriaAtiva = null;
      } else {
        btn.classList.add('active');
        categoriaAtiva = selectedCategory;
      }

      if (searchInput) termoBuscaAtivo = searchInput.value.trim();
      carregarTorneiosSupabase();

      const targetAnchor = document.getElementById('categorias');
      if (targetAnchor) {
        targetAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Botão de limpar filtros no estado vazio
  if (btnLimparFiltrosHome) {
    btnLimparFiltrosHome.addEventListener('click', () => {
      limparTodosFiltros();
    });
  }

  // Expor busca da Home para ser invocada pelo Header
  window.executarBuscaHomeSupabase = function(termo, rolarAteSecao = false) {
    termoBuscaAtivo = termo || '';
    carregarTorneiosSupabase();
    if (rolarAteSecao) {
      const targetAnchor = document.getElementById('categorias');
      if (targetAnchor) {
        targetAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Se a URL já trouxer um parâmetro de busca (?busca=...)
  const urlParams = new URLSearchParams(window.location.search);
  const buscaUrl = urlParams.get('busca');
  if (buscaUrl) {
    termoBuscaAtivo = buscaUrl;
    if (searchInput) searchInput.value = buscaUrl;
  }

  // Carga inicial dos torneios reais
  carregarTorneiosSupabase();
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
