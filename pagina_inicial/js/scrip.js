// ===================================
//  AUTENTICAÇÃO & ELEMENTOS DO HEADER
// ===================================

// Limpeza preventiva total de torneios e equipes estáticos






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
//  CARROSSEL DE TORNEIOS: RENDERIZADOR E CONTROLES (EXCLUSIVO SUPABASE)
// =========================================================
let autoPlayInterval = null;

function renderizarCarrossel(data) {
  const carouselEl = document.getElementById("carousel");
  const slidesContainer = document.getElementById("carouselSlidesContainer") || carouselEl;
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const indicatorsContainer = document.getElementById("carouselIndicators");
  const loadingEl = document.getElementById('carouselLoading');

  if (!carouselEl || !slidesContainer) return;

  if (loadingEl) loadingEl.style.display = 'none';

  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  }

  const listaCarrossel = (Array.isArray(data) ? data : []).filter(
    t => t 
  );

  // Se a lista estiver vazia
  if (listaCarrossel.length === 0) {
    slidesContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; width: 100%; color: #9ca3af; text-align: center; background: rgba(14, 13, 22, 0.7); border-radius: 16px;">
        <i class="fa-solid fa-trophy" style="font-size: 36px; color: #4b5563; margin-bottom: 12px;"></i>
        <h4 style="font-size: 16px; color: #f3f4f6; margin-bottom: 4px;">Nenhum torneio cadastrado no momento</h4>
        <p style="font-size: 13px; color: #6b7280;">Novos campeonatos aparecerão aqui em breve.</p>
      </div>
    `;
    if (indicatorsContainer) indicatorsContainer.innerHTML = '';
    return;
  }

  // Limpar slides anteriores e indicadores
  slidesContainer.innerHTML = '';
  if (indicatorsContainer) indicatorsContainer.innerHTML = '';

  // Utiliza os torneios cadastrados (exibe até 8 em destaque no carrossel)
  const torneiosDestaque = listaCarrossel.slice(0, 8);

  torneiosDestaque.forEach((t, i) => {
    const banner = t.banner || '/images/logo_versushub.png';
    const idValido = t.id || t.id_torneio || (t.nome ? encodeURIComponent(t.nome) : '');
    const link = (t.link && t.link.startsWith('/') && !t.link.includes('?'))
      ? t.link
      : ('/torneio/custom.html?id=' + encodeURIComponent(idValido));
    const nomeSeguro = escapeHtml(t.nome || 'Torneio');
    const tagSegura = escapeHtml(t.jogo ? t.jogo.split('•')[0].trim() : (t.categoria || 'Torneio')).toUpperCase();

    const slideDiv = document.createElement('div');
    slideDiv.className = `carousel-slide ${i === 0 ? 'active' : ''}`;
    slideDiv.innerHTML = `
      <a href="${link}" class="carousel-link">
        <img referrerpolicy="no-referrer" src="${banner}" alt="${nomeSeguro}" onerror="this.onerror=null;this.src='/images/logo_versushub.png';">
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
  const slidesContainer = document.getElementById("carouselSlidesContainer") || carouselEl;
  const loadingEl = document.getElementById('carouselLoading');
  if (!carouselEl) return;

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('torneios')
      .select('id, nome, jogo, status, statusClass, data, banner')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      console.warn('Aviso ao carregar carrossel do Supabase:', error);
      if (loadingEl) loadingEl.style.display = 'none';
      if (slidesContainer) {
        slidesContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; width: 100%; color: #9ca3af; text-align: center; background: rgba(14, 13, 22, 0.7); border-radius: 16px; padding: 20px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: #f59e0b; margin-bottom: 12px;"></i>
            <h4 style="font-size: 16px; color: #f3f4f6; margin-bottom: 4px;">Não foi possível carregar os torneios em destaque</h4>
            <p style="font-size: 13px; color: #6b7280;">Houve uma instabilidade na conexão com o servidor.</p>
          </div>
        `;
      }
      return;
    }

    renderizarCarrossel(data);
  } catch (err) {
    console.warn('Falha na consulta de carrossel de torneios:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (slidesContainer) {
      slidesContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; width: 100%; color: #9ca3af; text-align: center; background: rgba(14, 13, 22, 0.7); border-radius: 16px; padding: 20px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: #f59e0b; margin-bottom: 12px;"></i>
          <h4 style="font-size: 16px; color: #f3f4f6; margin-bottom: 4px;">Não foi possível carregar os torneios em destaque</h4>
          <p style="font-size: 13px; color: #6b7280;">Verifique sua conexão e tente novamente.</p>
        </div>
      `;
    }
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
      if (user.email) { iniciarEscutaNotificacoes(user.email); }

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
      desativarEscutaNotificacoes();
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
        // Usuário autenticado via Supabase Auth: sincroniza perfil atualizado
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
          avatar: profile?.avatar || session.user.user_metadata?.avatar_url || '/image/boneco_logo_ofc.png',
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
        // Se a sessão GoTrue não estiver ativa no momento, verifica se há usuário em vh_loggedUser
        const rawLocal = localStorage.getItem("vh_loggedUser");
        if (rawLocal) {
          try {
            const localUser = JSON.parse(rawLocal);
            if (localUser && localUser.email) {
              const { data: dbUser } = await supabase
                .from('usuarios')
                .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
                .eq('email', localUser.email.toLowerCase().trim())
                .maybeSingle();

              if (dbUser) {
                const synchronizedUser = { ...localUser, ...dbUser };
                localStorage.setItem("vh_loggedUser", JSON.stringify(synchronizedUser));
                aplicarEstadoHeader(synchronizedUser);
                return;
              } else {
                aplicarEstadoHeader(localUser);
                return;
              }
            }
          } catch (e) {}
        }
        aplicarEstadoHeader(null);
      }

      // Escuta alterações de estado de autenticação em tempo real
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem("vh_loggedUser");
          aplicarEstadoHeader(null);
        } else if (session && session.user) {
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
            avatar: profile?.avatar || session.user.user_metadata?.avatar_url || '/image/boneco_logo_ofc.png',
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
      console.warn('Erro ao carregar torneios no grid:', error);
      if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
      if (noTournamentsMsg) {
        noTournamentsMsg.style.display = 'block';
        if (noTournamentsTitle) noTournamentsTitle.textContent = 'Erro ao Carregar Torneios';
        if (noTournamentsDesc) noTournamentsDesc.textContent = 'Não foi possível carregar os torneios do banco de dados no momento. Tente recarregar a página.';
      }
      return;
    }

    const listaParaExibir = (Array.isArray(data) ? data : []).filter(
      t => t 
    );

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
        statusFiltro.innerHTML = `Exibindo <strong>${listaParaExibir.length}</strong> torneio(s) • <button type="button" id="btnResetarFiltrosBadge" style="background: none; border: none; color: #ff3e3e; text-decoration: underline; cursor: pointer; font-size: 13px; font-weight: 600; padding: 0 4px;">Limpar filtros</button>`;
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

    if (listaParaExibir.length === 0) {
      if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
      if (noTournamentsMsg) {
        noTournamentsMsg.style.display = 'block';
        if (categoria && termo) {
          if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Encontrado';
          if (noTournamentsDesc) noTournamentsDesc.textContent = `Não encontramos torneios de ${nomesCategorias[categoria] || categoria} correspondentes a "${termo}".`;
        } else if (categoria) {
          if (noTournamentsTitle) noTournamentsTitle.textContent = `Nenhum Torneio em ${nomesCategorias[categoria] || categoria}`;
          if (noTournamentsDesc) noTournamentsDesc.textContent = `Não existem torneios cadastrados para esta modalidade no momento. Seja o primeiro a criar um campeonato!`;
        } else if (termo) {
          if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Encontrado';
          if (noTournamentsDesc) noTournamentsDesc.textContent = `Não encontramos torneios cadastrados correspondentes à sua pesquisa por "${termo}".`;
        } else {
          if (noTournamentsTitle) noTournamentsTitle.textContent = 'Nenhum Torneio Cadastrado';
          if (noTournamentsDesc) noTournamentsDesc.textContent = 'Ainda não há torneios registrados no momento.';
        }
      }
      return;
    }

    if (noTournamentsMsg) noTournamentsMsg.style.display = 'none';

    // Renderiza os cards reais
    if (gridTorneiosHome) {
      gridTorneiosHome.innerHTML = listaParaExibir.map(t => {
        const banner = t.banner || '/images/logo_versushub.png';
        const idValido = t.id || t.id_torneio || (t.nome ? encodeURIComponent(t.nome) : '');
        const link = (t.link && t.link.startsWith('/') && !t.link.includes('?')) ? t.link : ('/torneio/custom.html?id=' + encodeURIComponent(idValido));
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

        if (window.setCachedImage && t.banner) {
          window.setCachedImage(`torneio_banner_${t.id}`, t.banner);
        }

        return `
          <article class="card-torneio"
            data-id="${t.id}"
            data-nome="${nomeSeguro}"
            data-jogo="${jogoSeguro}"
            data-categoria="${t.categoria || ''}"
            data-plataforma="${t.plataforma || ''}"
            data-status="${t.status || ''}">
            
            <img referrerpolicy="no-referrer" src="${banner}" alt="${nomeSeguro}" onerror="this.onerror=null;this.src='/images/logo_versushub.png';">
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
      gridTorneiosHome.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    }
  }

  // Monta a query com filtros para o Supabase
  function construirQueryGrid(supabaseClient, categoria, termo) {
    let query = supabaseClient
      .from('torneios')
      .select('id, nome, jogo, status, statusClass, data, banner');

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

    return query.order('created_at', { ascending: false }).limit(6);
  }

  // ===================================================================
  // CARREGAMENTO INICIAL PARALELO DA HOMEPAGE COM PROMISE.ALL
  // ===================================================================
  async function carregarDadosIniciaisHomepage() {
    if (homeLoading) homeLoading.style.display = 'flex';
    if (gridTorneiosHome) gridTorneiosHome.style.display = 'none';
    if (noTournamentsMsg) noTournamentsMsg.style.display = 'none';

    const carouselLoading = document.getElementById('carouselLoading');
    if (carouselLoading) carouselLoading.style.display = 'flex';

    try {
      const supabase = await getSupabase();

      // Monta as promessas diretamente para o Supabase
      const promessaCarrossel = carouselEl
        ? supabase.from('torneios').select('id, nome, jogo, status, statusClass, data, banner').order('created_at', { ascending: false }).limit(6)
        : Promise.resolve({ data: null, error: null });

      const promessaGrid = gridTorneiosHome
        ? construirQueryGrid(supabase, categoriaAtiva, termoBuscaAtivo)
        : Promise.resolve({ data: null, error: null });

      const [resCarrossel, resGrid] = await Promise.all([
        promessaCarrossel,
        promessaGrid
      ]);

      if (carouselEl) {
        renderizarCarrossel(resCarrossel?.data || []);
      }

      if (gridTorneiosHome) {
        renderizarGridTorneios(resGrid?.data || [], resGrid?.error || null, termoBuscaAtivo, categoriaAtiva);
      }

    } catch (err) {
      console.warn('Falha na consulta ao banco Supabase:', err);
      if (carouselEl) renderizarCarrossel([]);
      if (gridTorneiosHome) renderizarGridTorneios([], err, termoBuscaAtivo, categoriaAtiva);
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
      const res = await query;
      renderizarGridTorneios(res?.data || [], res?.error || null, termoBuscaAtivo, categoriaAtiva);
    } catch (err) {
      console.warn('Erro ao filtrar torneios do Supabase:', err);
      renderizarGridTorneios([], err, termoBuscaAtivo, categoriaAtiva);
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



// =========================================================
// SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL VIA SUPABASE
// =========================================================
let currentNotifUserEmail = '';
let notifInterval = null;
let realtimeChannel = null;

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (isNaN(seconds) || seconds < 30) return 'agora mesmo';
  if (seconds < 60) return `há ${seconds} seg`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  return `há ${months} mes${months > 1 ? 'es' : ''}`;
}

function renderNotifBellUI() {
  if (document.getElementById('vhNotifBellWrapper')) return;
  const userIconDiv = document.querySelector('.user-icon');
  if (!userIconDiv) return;

  if (!document.getElementById('vhNotifStyles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'vhNotifStyles';
    styleEl.textContent = `
      .vh-notif-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin-right: 12px;
      }
      .vh-notif-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e5e7eb;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 15px;
        position: relative;
        transition: all 0.2s ease;
      }
      .vh-notif-btn:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.3);
      }
      .vh-notif-badge {
        position: absolute;
        top: -3px;
        right: -3px;
        background: #ef4444;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        height: 18px;
        min-width: 18px;
        padding: 0 4px;
        border-radius: 9px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid #0c0a13;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }
      .vh-notif-dropdown {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: #111118;
        border: 1px solid #2a2a38;
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
        z-index: 9999;
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      .vh-notif-dropdown.show {
        display: flex;
      }
      .vh-notif-header {
        padding: 12px 16px;
        border-bottom: 1px solid #2a2a38;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #161622;
        gap: 8px;
      }
      .vh-notif-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .vh-notif-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .vh-notif-mark-all {
        background: transparent;
        border: none;
        color: #3b82f6;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 4px;
        transition: color 0.15s;
      }
      .vh-notif-mark-all:hover {
        color: #60a5fa;
        text-decoration: underline;
      }
      .vh-notif-clear-all {
        background: transparent;
        border: none;
        color: #9ca3af;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 4px;
        transition: color 0.15s;
      }
      .vh-notif-clear-all:hover {
        color: #ef4444;
        text-decoration: underline;
      }
      .vh-notif-list {
        max-height: 360px;
        overflow-y: auto;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .vh-notif-item {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        gap: 10px;
        align-items: flex-start;
        transition: background 0.15s;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        position: relative;
      }
      .vh-notif-item:hover {
        background: rgba(255, 255, 255, 0.04);
      }
      .vh-notif-item.unread {
        background: rgba(239, 68, 68, 0.06);
      }
      .vh-notif-item.unread:hover {
        background: rgba(239, 68, 68, 0.12);
      }
      .vh-notif-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .vh-notif-icon.equipe { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
      .vh-notif-icon.torneio { background: rgba(234, 179, 8, 0.15); color: #facc15; }
      .vh-notif-icon.sucesso { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
      .vh-notif-icon.sistema { background: rgba(239, 68, 68, 0.15); color: #f87171; }
      .vh-notif-icon.default { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
      .vh-notif-content {
        flex: 1;
        min-width: 0;
      }
      .vh-notif-title {
        font-size: 13px;
        font-weight: 600;
        color: #f3f4f6;
        margin: 0 0 2px 0;
        line-height: 1.3;
      }
      .vh-notif-msg {
        font-size: 12px;
        color: #9ca3af;
        margin: 0 0 4px 0;
        line-height: 1.35;
        word-break: break-word;
      }
      .vh-notif-time {
        font-size: 11px;
        color: #6b7280;
      }
      .vh-notif-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        flex-shrink: 0;
        margin-top: 6px;
      }
      .vh-notif-delete-btn {
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        font-size: 12.5px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        margin-left: 2px;
        flex-shrink: 0;
      }
      .vh-notif-delete-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.15);
      }
      .vh-notif-empty {
        padding: 32px 16px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      }
      .vh-notif-empty i {
        font-size: 28px;
        display: block;
        margin-bottom: 8px;
        color: #4b5563;
      }

      @media (max-width: 768px) {
        .vh-notif-wrapper,
        #vhNotifBellWrapper {
          position: static !important;
        }
        .vh-notif-dropdown,
        #notifDropdown {
          position: fixed !important;
          top: 60px !important;
          left: 12px !important;
          right: 12px !important;
          width: auto !important;
          max-width: calc(100vw - 24px) !important;
          max-height: 80vh !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          border-radius: 14px !important;
          z-index: 999999 !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85) !important;
        }
        .vh-notif-header {
          padding: 10px 14px !important;
          flex-wrap: wrap !important;
        }
        .vh-notif-actions {
          gap: 6px !important;
        }
        .vh-notif-mark-all,
        .vh-notif-clear-all {
          font-size: 11px !important;
        }
        .vh-notif-list,
        #notifList {
          max-height: 60vh !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          box-sizing: border-box !important;
        }
        .vh-notif-item {
          padding: 10px 12px !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .vh-notif-content {
          min-width: 0 !important;
          flex: 1 !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
        .vh-notif-title {
          font-size: 12.5px !important;
          line-height: 1.3 !important;
        }
        .vh-notif-msg {
          font-size: 11.5px !important;
          line-height: 1.35 !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'vhNotifBellWrapper';
  wrapper.className = 'vh-notif-wrapper';
  wrapper.innerHTML = `
    <button type="button" id="notifBtn" class="vh-notif-btn" title="Notificações" aria-label="Notificações">
      <i class="fa-solid fa-bell"></i>
      <span id="notifBadge" class="vh-notif-badge">0</span>
    </button>
    <div id="notifDropdown" class="vh-notif-dropdown">
      <div class="vh-notif-header">
        <h4><i class="fa-solid fa-bell" style="color:#ef4444;"></i> Notificações</h4>
        <div class="vh-notif-actions">
          <button type="button" id="btnNotifMarkAllRead" class="vh-notif-mark-all" title="Marcar todas como lidas">Marcar lidas</button>
          <button type="button" id="btnClearNotifs" class="vh-notif-clear-all" title="Limpar todas as notificações">Limpar todas</button>
        </div>
      </div>
      <div id="notifList" class="vh-notif-list">
        <div class="vh-notif-empty">
          <i class="fa-solid fa-bell-slash"></i>
          Nenhuma notificação por enquanto
        </div>
      </div>
    </div>
  `;

  userIconDiv.parentNode.insertBefore(wrapper, userIconDiv);

  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const btnMarkAll = document.getElementById('btnNotifMarkAllRead');
  const btnClearAll = document.getElementById('btnClearNotifs');

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menuUser = document.getElementById('menuUser');
      if (menuUser) menuUser.style.display = 'none';
      notifDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        notifDropdown.classList.remove('show');
      }
    });
  }

  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await marcarTodasComoLidas();
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await limparTodasNotificacoes();
    });
  }
}

async function carregarNotificacoesUsuario(email) {
  const target = email || currentNotifUserEmail;
  if (!target) return;
  return await carregarNotificacoes(target);
}

if (typeof window !== 'undefined') {
  window.carregarNotificacoesUsuario = carregarNotificacoesUsuario;
  window.carregarNotificacoes = carregarNotificacoes;
}

async function carregarNotificacoes(userEmail) {
  if (!userEmail) return;
  currentNotifUserEmail = userEmail.toLowerCase().trim();

  // 1. Exibição imediata via cache local se disponível
  try {
    const cachedRaw = localStorage.getItem(`vh_cached_notif_${currentNotifUserEmail}`);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (Array.isArray(cached) && cached.length > 0) {
        atualizarInterfaceNotificacoes(cached);
      }
    }
  } catch (eCache) {}

  let notificacoes = null;

  // 2. Consulta via Supabase JS Client com timeout de segurança
  try {
    const supabase = await getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, tipo, lida, link, created_at')
        .ilike('user_email', currentNotifUserEmail)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && Array.isArray(data)) {
        notificacoes = data;
      } else if (error) {
        console.warn('[VersusHub Notificações] Aviso ao consultar via client (tentando proxy):', error?.message || error);
      }
    }
  } catch (eClient) {
    console.warn('[VersusHub Notificações] Exceção via client (tentando proxy):', eClient?.message || eClient);
  }

  // 3. Fallback: se não obteve via client, tenta via proxy /api/notificacoes
  if (!notificacoes) {
    try {
      const resp = await fetch(`/api/notificacoes?email=${encodeURIComponent(currentNotifUserEmail)}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json && Array.isArray(json.data)) {
          notificacoes = json.data;
        }
      }
    } catch (eProxy) {
      console.warn('[VersusHub Notificações] Aviso ao consultar via proxy:', eProxy?.message || eProxy);
    }
  }

  // 4. Se obteve com sucesso, atualiza o cache local e a interface
  if (notificacoes) {
    try {
      localStorage.setItem(`vh_cached_notif_${currentNotifUserEmail}`, JSON.stringify(notificacoes));
    } catch (eSave) {}
    atualizarInterfaceNotificacoes(notificacoes);
  } else {
    // 5. Se falhou tudo (offline total), mantém o cache ou exibe estado vazio
    try {
      const fallbackCache = JSON.parse(localStorage.getItem(`vh_cached_notif_${currentNotifUserEmail}`) || '[]');
      atualizarInterfaceNotificacoes(fallbackCache);
    } catch (e) {
      atualizarInterfaceNotificacoes([]);
    }
  }
}

function atualizarInterfaceNotificacoes(notificacoes) {
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  if (!notifList) return;

  const naoLidas = (notificacoes || []).filter(n => !n.lida);
  const totalNaoLidas = naoLidas.length;

  if (notifBadge) {
    if (totalNaoLidas > 0) {
      notifBadge.textContent = totalNaoLidas > 9 ? '9+' : String(totalNaoLidas);
      notifBadge.style.display = 'flex';
    } else {
      notifBadge.style.display = 'none';
    }
  }

  if (!notificacoes || notificacoes.length === 0) {
    notifList.innerHTML = `
      <div class="vh-notif-empty">
        <i class="fa-solid fa-bell-slash"></i>
        Nenhuma notificação por enquanto
      </div>
    `;
    return;
  }

  notifList.innerHTML = notificacoes.map(n => {
    let iconClass = 'fa-solid fa-bell';
    let typeClass = 'default';
    if (n.tipo === 'equipe') {
      iconClass = 'fa-solid fa-users';
      typeClass = 'equipe';
    } else if (n.tipo === 'torneio') {
      iconClass = 'fa-solid fa-trophy';
      typeClass = 'torneio';
    } else if (n.tipo === 'sucesso') {
      iconClass = 'fa-solid fa-circle-check';
      typeClass = 'sucesso';
    } else if (n.tipo === 'sistema') {
      iconClass = 'fa-solid fa-shield-halved';
      typeClass = 'sistema';
    }

    const unreadClass = !n.lida ? 'unread' : '';
    const href = n.link || '#';

    return `
      <div class="vh-notif-item ${unreadClass}" data-id="${n.id}" data-link="${escapeHtml(href)}">
        <div class="vh-notif-icon ${typeClass}">
          <i class="${iconClass}"></i>
        </div>
        <div class="vh-notif-content">
          <div class="vh-notif-title">${escapeHtml(n.titulo || 'Notificação')}</div>
          <div class="vh-notif-msg">${escapeHtml(n.mensagem || '')}</div>
          ${(n.tipo === 'equipe' || (n.titulo && n.titulo.includes('Convite de Equipe'))) ? `
            <div class="vh-notif-actions" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn-notif-aceitar-eq" data-id="${n.id}" data-link="${escapeHtml(href)}" style="background: #059669; border: none; color: #ffffff; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(5,150,105,0.3);">
                <i class="fa-solid fa-check"></i> Aceitar Convite
              </button>
              <button type="button" class="btn-notif-recusar-eq" data-id="${n.id}" data-link="${escapeHtml(href)}" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-xmark"></i> Recusar
              </button>
            </div>
          ` : ''}
          <div class="vh-notif-time">${timeAgo(n.created_at)}</div>
        </div>
        ${!n.lida ? '<div class="vh-notif-dot" title="Não lida"></div>' : ''}
        <button type="button" class="vh-notif-delete-btn" data-id="${n.id}" title="Excluir notificação" aria-label="Excluir notificação">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');

  // Cliques nos botões de Aceitar/Recusar convite de equipe direto
  notifList.querySelectorAll('.btn-notif-aceitar-eq').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const notifId = btn.dataset.id;
      const link = btn.dataset.link || '';
      const match = link.match(/id=([^&]+)/);
      const eqId = match ? decodeURIComponent(match[1]) : '';

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aceitando...';

      try {
        const sb = await getSupabase();
        if (eqId && currentNotifUserEmail) {
          await sb.from('membros_equipe')
            .update({ status: 'Aceito' })
            .eq('equipe_id', String(eqId))
            .ilike('user_email', currentNotifUserEmail);
        }
        if (notifId) {
          await sb.from('notificacoes').delete().eq('id', notifId);
        }

        if (typeof showToast === 'function') {
          showToast('Você agora faz parte da equipe!');
        } else if (typeof window.showToast === 'function') {
          window.showToast('Você agora faz parte da equipe!');
        } else {
          alert('Você agora faz parte da equipe!');
        }

        await carregarNotificacoesUsuario();
      } catch (err) {
        console.error('Erro ao aceitar convite pela notificação:', err);
      }
    });
  });

  notifList.querySelectorAll('.btn-notif-recusar-eq').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const notifId = btn.dataset.id;
      const link = btn.dataset.link || '';
      const match = link.match(/id=([^&]+)/);
      const eqId = match ? decodeURIComponent(match[1]) : '';

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recusando...';

      try {
        const sb = await getSupabase();
        if (eqId && currentNotifUserEmail) {
          await sb.from('membros_equipe')
            .delete()
            .eq('equipe_id', String(eqId))
            .ilike('user_email', currentNotifUserEmail);
        }
        if (notifId) {
          await sb.from('notificacoes').delete().eq('id', notifId);
        }

        if (typeof showToast === 'function') {
          showToast('Convite recusado.');
        } else if (typeof window.showToast === 'function') {
          window.showToast('Convite recusado.');
        } else {
          alert('Convite recusado.');
        }

        await carregarNotificacoesUsuario();
      } catch (err) {
        console.error('Erro ao recusar convite pela notificação:', err);
      }
    });
  });

  // Cliques nos itens para marcar lida e navegar
  notifList.querySelectorAll('.vh-notif-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.vh-notif-delete-btn')) return;
      if (e.target.closest('.vh-notif-actions')) return;

      const notifId = item.getAttribute('data-id');
      const targetLink = item.getAttribute('data-link');
      if (notifId) {
        await marcarComoLida(notifId);
      }
      if (targetLink && targetLink !== '#' && targetLink !== 'null' && targetLink !== 'undefined') {
        window.location.href = targetLink;
      }
    });
  });

  // Cliques no botão de excluir notificação individual
  notifList.querySelectorAll('.vh-notif-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const notifId = btn.getAttribute('data-id');
      if (notifId) {
        const itemEl = btn.closest('.vh-notif-item');
        if (itemEl) {
          itemEl.style.transition = 'all 0.18s ease';
          itemEl.style.opacity = '0';
          itemEl.style.transform = 'translateX(20px)';
        }
        await excluirNotificacao(notifId);
      }
    });
  });
}

async function excluirNotificacao(id) {
  if (!id) return;
  try {
    const supabase = await getSupabase();
    let deletado = false;
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id);

      if (!error) deletado = true;
      else console.warn('[VersusHub Notificações] Aviso ao excluir via client:', error?.message || error);
    }
    if (!deletado) {
      try {
        await fetch(`/api/notificacoes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (eProxy) {}
    }
  } catch (err) {
    console.warn('[VersusHub Notificações] Aviso ao excluir notificação:', err?.message || err);
  }

  // Atualiza cache local imediatamente
  if (currentNotifUserEmail) {
    try {
      const cached = JSON.parse(localStorage.getItem(`vh_cached_notif_${currentNotifUserEmail}`) || '[]');
      const filtrado = cached.filter(n => String(n.id) !== String(id));
      localStorage.setItem(`vh_cached_notif_${currentNotifUserEmail}`, JSON.stringify(filtrado));
      atualizarInterfaceNotificacoes(filtrado);
    } catch (e) {}
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

async function limparTodasNotificacoes() {
  if (!currentNotifUserEmail) return;
  try {
    const supabase = await getSupabase();
    let limpo = false;
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .ilike('user_email', currentNotifUserEmail);

      if (!error) limpo = true;
      else console.warn('[VersusHub Notificações] Aviso ao limpar via client:', error?.message || error);
    }
    if (!limpo) {
      try {
        await fetch(`/api/notificacoes?user_email=${encodeURIComponent(currentNotifUserEmail)}`, { method: 'DELETE' });
      } catch (eProxy) {}
    }
  } catch (err) {
    console.warn('[VersusHub Notificações] Aviso ao limpar notificações:', err?.message || err);
  }

  try {
    localStorage.setItem(`vh_cached_notif_${currentNotifUserEmail}`, '[]');
  } catch (e) {}
  atualizarInterfaceNotificacoes([]);
  if (currentNotifUserEmail) {
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

async function marcarComoLida(id) {
  if (!id) return;
  try {
    const supabase = await getSupabase();
    let atualizado = false;
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);
      if (!error) atualizado = true;
      else console.warn('[VersusHub Notificações] Aviso ao marcar como lida via client:', error?.message || error);
    }
    if (!atualizado) {
      try {
        await fetch('/api/notificacoes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, lida: true })
        });
      } catch (eProxy) {}
    }
  } catch (e) {
    console.warn('[VersusHub Notificações] Aviso ao marcar como lida:', e?.message || e);
  }
  if (currentNotifUserEmail) {
    try {
      const cached = JSON.parse(localStorage.getItem(`vh_cached_notif_${currentNotifUserEmail}`) || '[]');
      const mod = cached.map(n => String(n.id) === String(id) ? { ...n, lida: true } : n);
      localStorage.setItem(`vh_cached_notif_${currentNotifUserEmail}`, JSON.stringify(mod));
      atualizarInterfaceNotificacoes(mod);
    } catch (e) {}
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

async function marcarTodasComoLidas() {
  if (!currentNotifUserEmail) return;
  try {
    const supabase = await getSupabase();
    let atualizado = false;
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .ilike('user_email', currentNotifUserEmail)
        .eq('lida', false);
      if (!error) atualizado = true;
      else console.warn('[VersusHub Notificações] Aviso ao marcar todas como lidas via client:', error?.message || error);
    }
    if (!atualizado) {
      try {
        await fetch('/api/notificacoes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_email: currentNotifUserEmail, lida: true })
        });
      } catch (eProxy) {}
    }
  } catch (e) {
    console.warn('[VersusHub Notificações] Aviso ao marcar todas como lidas:', e?.message || e);
  }
  if (currentNotifUserEmail) {
    try {
      const cached = JSON.parse(localStorage.getItem(`vh_cached_notif_${currentNotifUserEmail}`) || '[]');
      const mod = cached.map(n => ({ ...n, lida: true }));
      localStorage.setItem(`vh_cached_notif_${currentNotifUserEmail}`, JSON.stringify(mod));
      atualizarInterfaceNotificacoes(mod);
    } catch (e) {}
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

function iniciarEscutaNotificacoes(userEmail) {
  if (!userEmail) return;
  const emailClean = userEmail.toLowerCase().trim();
  currentNotifUserEmail = emailClean;

  renderNotifBellUI();
  carregarNotificacoes(emailClean);

  if (notifInterval) clearInterval(notifInterval);
  notifInterval = setInterval(() => {
    carregarNotificacoes(emailClean);
  }, 10000);

  getSupabase().then(supabase => {
    if (!supabase || typeof supabase.channel !== 'function') return;
    try {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      realtimeChannel = supabase
        .channel(`notif-${emailClean}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notificacoes',
            filter: `user_email=eq.${emailClean}`
          },
          () => {
            carregarNotificacoes(emailClean);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[VersusHub Notificações] Erro ao subscrever canal realtime:', e);
    }
  });
}

function desativarEscutaNotificacoes() {
  if (notifInterval) clearInterval(notifInterval);
  const bellWrapper = document.getElementById('vhNotifBellWrapper');
  if (bellWrapper) bellWrapper.remove();
}

window.excluirNotificacao = excluirNotificacao;
window.limparTodasNotificacoes = limparTodasNotificacoes;
window.marcarComoLida = marcarComoLida;
window.marcarTodasComoLidas = marcarTodasComoLidas;
window.carregarNotificacoes = carregarNotificacoes;
