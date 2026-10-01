// ===================================
//  AUTENTICAÇÃO & ELEMENTOS DO HEADER
// ===================================

const btEntrar = document.getElementById("btentrar");
const btCadastrar = document.getElementById("btcadastrar");
const userBtn = document.getElementById("userBtn");
const menuUser = document.getElementById("menuUser");
const userIconDiv = document.querySelector(".user-icon");

// Precarrega o cliente Supabase assim que o script for lido
let _supabaseClientPromise = null;
function getSupabase() {
  if (!_supabaseClientPromise) {
    _supabaseClientPromise = import('/supabaseClient.js').then(m => m.supabase);
  }
  return _supabaseClientPromise;
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

// =========================================================
//  CARROSSEL DE TORNEIOS: RENDERIZADOR E CONTROLES
// =========================================================
let autoPlayInterval = null;

function renderizarCarrossel(data, error) {
  const carouselEl = document.getElementById("carousel");
  const slidesContainer = document.getElementById("carouselSlidesContainer") || carouselEl;
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const indicatorsContainer = document.getElementById("carouselIndicators");

  if (!carouselEl || !slidesContainer) return;

  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  }

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
  if (indicatorsContainer) indicatorsContainer.innerHTML = '';

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
    if (indicatorsContainer) {
      const dot = document.createElement('span');
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => {
        goToSlide(i);
        resetAutoPlay();
      });
      indicatorsContainer.appendChild(dot);
    }
  });

  const slidesList = slidesContainer.querySelectorAll('.carousel-slide');
  const dotsList = indicatorsContainer ? indicatorsContainer.querySelectorAll('span') : [];
  let currentIndex = 0;
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
    if (slidesList.length <= 1) return;
    currentIndex = (currentIndex + 1) % slidesList.length;
    showSlide();
  }

  function prevSlide() {
    if (slidesList.length <= 1) return;
    currentIndex = (currentIndex - 1 + slidesList.length) % slidesList.length;
    showSlide();
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      nextSlide();
      resetAutoPlay();
    };
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      prevSlide();
      resetAutoPlay();
    };
  }

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

  carouselEl.removeEventListener('mouseenter', stopAutoPlay);
  carouselEl.removeEventListener('mouseleave', startAutoPlay);
  carouselEl.addEventListener('mouseenter', stopAutoPlay);
  carouselEl.addEventListener('mouseleave', startAutoPlay);

  // Inicia rotação automática
  startAutoPlay();
}

async function inicializarCarrosselTorneios() {
  const carouselEl = document.getElementById("carousel");
  if (!carouselEl) return;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('torneios')
      .select('*')
      .order('created_at', { ascending: false });
    renderizarCarrossel(data, error);
  } catch (err) {
    console.error('Erro ao carregar carrossel isolado:', err);
  }
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

  // ==============================================================================
  //  AUTENTICAÇÃO NATIVA SUPABASE (getSession, onAuthStateChange e signOut)
  // ==============================================================================
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
      if (btEntrar) btEntrar.style.display = "none";
      if (btCadastrar) btCadastrar.style.display = "none";

      // cria/atualiza span com o nome à ESQUERDA do ícone
      let nomeSpan = document.getElementById("vhUserName");
      if (!nomeSpan) {
        nomeSpan = document.createElement("span");
        nomeSpan.id = "vhUserName";
        nomeSpan.className = "username-header";
        userIconDiv.insertBefore(nomeSpan, userBtn);
      }
      nomeSpan.textContent = user.nome;

      // atualiza avatar nos botões de usuário
      if (user.avatar) {
        const userImgs = document.querySelectorAll('#userBtn, .user-icon img');
        userImgs.forEach(img => {
          img.src = user.avatar;
        });
      }

      // monta menu do usuário logado
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

      // Logout nativo com supabase.auth.signOut()
      if (linkSair) {
        linkSair.addEventListener("click", async (e) => {
          e.preventDefault();
          linkSair.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Saindo...';
          try {
            const supabase = await getSupabase();
            await supabase.auth.signOut();
          } catch (err) {
            console.warn("Erro ao fazer signOut no Supabase:", err);
          } finally {
            localStorage.removeItem("vh_loggedUser");
            window.location.reload();
          }
        });
      }

      // Mudar de conta com supabase.auth.signOut() e redirect para login
      if (linkTrocar) {
        linkTrocar.addEventListener("click", async (e) => {
          e.preventDefault();
          linkTrocar.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>Desconectando...';
          try {
            const supabase = await getSupabase();
            await supabase.auth.signOut();
          } catch (err) {
            console.warn("Erro ao fazer signOut no Supabase:", err);
          } finally {
            localStorage.removeItem("vh_loggedUser");
            window.location.href = "/login/login.html";
          }
        });
      }
    } else {
      // ---------- NINGUÉM LOGADO ----------
      if (btEntrar) btEntrar.style.display = "";
      if (btCadastrar) btCadastrar.style.display = "";

      const nomeSpan = document.getElementById("vhUserName");
      if (nomeSpan) nomeSpan.remove();

      const userImgs = document.querySelectorAll('#userBtn, .user-icon img');
      userImgs.forEach(img => {
        img.src = '/image/boneco_logo_ofc.png';
      });

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

  // Aplicação inicial otimista com cache local
  aplicarEstadoHeader(loggedUser);

  // Validação assíncrona oficial de sessão e escuta em tempo real no Supabase Auth
  getSupabase().then(async (supabase) => {
    if (!supabase || !supabase.auth) return;

    try {
      const { data: { session }, error: sessError } = await supabase.auth.getSession();
      if (sessError) {
        console.warn("Aviso ao validar sessão Supabase Auth:", sessError);
      }

      if (session && session.user) {
        // Usuário autenticado: sincroniza perfil atualizado
        const email = session.user.email;
        let profile = null;
        try {
          const { data: dbUser } = await supabase
            .from('usuarios')
            .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
            .eq('email', email)
            .maybeSingle();
          if (dbUser) profile = dbUser;
        } catch (dbErr) {
          console.warn("Aviso ao buscar perfil atualizado:", dbErr);
        }

        const freshUser = {
          id: profile?.id || session.user.id,
          nome: profile?.nome || session.user.user_metadata?.nome || email.split('@')[0],
          email: email,
          avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
          banner: profile?.banner || '',
          bio: profile?.bio || '',
          regiao: profile?.regiao || 'Brasil',
          plataformas: profile?.plataformas || [],
          jogosFavoritos: profile?.jogosFavoritos || [],
          stats: profile?.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
          conquistas: profile?.conquistas || [],
          auth_id: session.user.id
        };

        localStorage.setItem("vh_loggedUser", JSON.stringify(freshUser));
        aplicarEstadoHeader(freshUser);
      } else {
        // Sem sessão ativa no Supabase Auth: limpa qualquer estado antigo
        if (localStorage.getItem("vh_loggedUser")) {
          localStorage.removeItem("vh_loggedUser");
        }
        aplicarEstadoHeader(null);
      }

      // Escuta alterações de estado de autenticação em tempo real
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          localStorage.removeItem("vh_loggedUser");
          aplicarEstadoHeader(null);
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          if (session && session.user) {
            const email = session.user.email;
            let profile = null;
            try {
              const { data: dbUser } = await supabase
                .from('usuarios')
                .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
                .eq('email', email)
                .maybeSingle();
              if (dbUser) profile = dbUser;
            } catch (e) {}

            const freshUser = {
              id: profile?.id || session.user.id,
              nome: profile?.nome || session.user.user_metadata?.nome || email.split('@')[0],
              email: email,
              avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
              auth_id: session.user.id
            };

            localStorage.setItem("vh_loggedUser", JSON.stringify(freshUser));
            aplicarEstadoHeader(freshUser);
          }
        }
      });
    } catch (errAuth) {
      console.warn("Erro ao configurar validação de sessão Supabase:", errAuth);
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = localStorage.getItem('vh_loggedUser');
    if (!raw) return;

    const user = JSON.parse(raw);
    if (!user || !user.avatar) return;

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
  const carouselEl = document.getElementById('carousel');
  const categoryButtons = document.querySelectorAll('.btn-filtro-categoria');
  
  if (!gridTorneiosHome && !carouselEl) return;

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

  // Renderiza a lista de cards dinamicamente no grid da homepage
  function renderizarGridTorneios(data, error, termo, categoria) {
    if (homeLoading) homeLoading.style.display = 'none';

    if (error) {
      console.error('Erro na consulta de torneios:', error);
      if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
      if (noTournamentsMsg) {
        noTournamentsMsg.style.display = 'block';
        if (noTournamentsTitle) noTournamentsTitle.textContent = 'Erro ao Carregar Torneios';
        if (noTournamentsDesc) noTournamentsDesc.textContent = 'Não foi possível carregar os torneios no momento. Tente recarregar a página.';
      }
      return;
    }

    // Atualiza Título da seção
    if (termo && categoria) {
      if (tituloSecao) tituloSecao.textContent = `Busca: "${termo}" em ${nomesCategorias[categoria] || categoria}`;
    } else if (termo) {
      if (tituloSecao) tituloSecao.textContent = `Resultados da busca: "${termo}"`;
    } else if (categoria) {
      if (tituloSecao) tituloSecao.textContent = `Torneios de ${nomesCategorias[categoria] || categoria}`;
    } else {
      if (tituloSecao) tituloSecao.textContent = 'Torneios em Destaque';
    }

    // Atualiza badge de filtro ativo
    if (statusFiltro) {
      if (categoria || termo) {
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
      if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
      if (noTournamentsMsg) {
        noTournamentsMsg.style.display = 'block';
        if (categoria && termo) {
          if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Encontrado';
          if (noTournamentsDesc) noTournamentsDesc.textContent = `Não encontramos torneios de ${nomesCategorias[categoria] || categoria} correspondentes a "${termo}".`;
        } else if (categoria) {
          if (noTournamentsTitle) noTournamentsTitle.textContent = `Nenhum Torneio em ${nomesCategorias[categoria] || categoria}`;
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

    if (noTournamentsMsg) noTournamentsMsg.style.display = 'none';

    // Renderiza os cards reais
    if (gridTorneiosHome) {
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
    }
  }

  // Monta a query com filtros para o Supabase
  function construirQueryGrid(supabaseClient, categoria, termo) {
    let query = supabaseClient.from('torneios').select('*');

    // 1. Filtragem por categoria no Supabase
    if (categoria) {
      const cat = categoria.toLowerCase();
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
    const t = (termo || '').trim();
    if (t) {
      query = query.or(`nome.ilike.%${t}%,jogo.ilike.%${t}%,categoria.ilike.%${t}%`);
    }

    return query.order('created_at', { ascending: false });
  }

  // ===================================================================
  // CARREGAMENTO INICIAL PARALELO DA HOMEPAGE COM PROMISE.ALL
  // Executa simultaneamente carrossel e listagem mantendo os spinners ativos
  // ===================================================================
  async function carregarDadosIniciaisHomepage() {
    // 1. Mantém/exibe os spinners de carregamento
    if (homeLoading) homeLoading.style.display = 'flex';
    if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
    if (noTournamentsMsg) noTournamentsMsg.style.display = 'none';

    const carouselLoading = document.getElementById('carouselLoading');
    if (carouselLoading) carouselLoading.style.display = 'flex';

    try {
      const supabase = await getSupabase();

      // Monta as promessas simultâneas para execução em paralelo
      const promessaCarrossel = carouselEl
        ? supabase.from('torneios').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null, error: null });

      const promessaGrid = gridTorneiosHome
        ? construirQueryGrid(supabase, categoriaAtiva, termoBuscaAtivo)
        : Promise.resolve({ data: null, error: null });

      // EXECUTA TODAS AS CONSULTAS SIMULTANEAMENTE EM PARALELO VIA PROMISE.ALL
      const [resCarrossel, resGrid] = await Promise.all([
        promessaCarrossel,
        promessaGrid
      ]);

      // 2. Processa o resultado do carrossel assim que o Promise.all conclui
      if (carouselEl && resCarrossel) {
        renderizarCarrossel(resCarrossel.data, resCarrossel.error);
      }

      // 3. Processa o resultado do grid assim que o Promise.all conclui
      if (gridTorneiosHome && resGrid) {
        renderizarGridTorneios(resGrid.data, resGrid.error, termoBuscaAtivo, categoriaAtiva);
      }

    } catch (err) {
      console.error('Falha no carregamento inicial paralelo da Homepage:', err);
      if (homeLoading) homeLoading.style.display = 'none';
      if (noTournamentsMsg) noTournamentsMsg.style.display = 'block';
    }
  }

  // Filtragem posterior dinâmica (quando o usuário clica em categoria ou pesquisa)
  async function carregarTorneiosSupabase() {
    if (homeLoading) homeLoading.style.display = 'flex';
    if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
    if (noTournamentsMsg) noTournamentsMsg.style.display = 'none';

    try {
      const supabase = await getSupabase();
      const query = construirQueryGrid(supabase, categoriaAtiva, termoBuscaAtivo);
      const { data, error } = await query;
      renderizarGridTorneios(data, error, termoBuscaAtivo, categoriaAtiva);
    } catch (err) {
      console.error('Falha ao filtrar torneios:', err);
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

  // Dispara o carregamento inicial em paralelo via Promise.all
  carregarDadosIniciaisHomepage();
  window.recarregarHomepage = carregarDadosIniciaisHomepage;
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
