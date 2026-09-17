// /equipes/js/equipes.js
import { supabase } from '/supabaseClient.js';

let cacheEquipes = [];

// Equipes padrão da plataforma VersusHub para garantir exibição imediata e fallback resiliente
const DEFAULT_EQUIPES = [
  {
    id: 'viltrumitas',
    nome: 'Viltrumitas',
    tag: 'VLT',
    jogos: 'Valorant',
    plataforma: 'pc',
    regiao: 'BR',
    limite: '6',
    sobre: 'Equipe competitiva de Valorant com foco em torneios de alto nível.',
    logo: '/equipes/image/Viltrumitas.jpg',
    leaderName: 'OmniMan',
    leaderAvatar: '/equipes/image/Viltrumitas.jpg',
    status: 'Recrutando',
    link: '/equipes/detalhes-viltrumitas.html'
  },
  {
    id: 'the-caras',
    nome: 'The Caras',
    tag: 'CRS',
    jogos: 'CS2',
    plataforma: 'pc',
    regiao: 'BR',
    limite: '4',
    sobre: 'Time experiente de CS2 pronto para dominar as ligas.',
    logo: '/equipes/image/the%20caras.png',
    leaderName: 'Butcher',
    leaderAvatar: '/equipes/image/the%20caras.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-thecaras.html'
  },
  {
    id: 'the-jacksons',
    nome: 'The Jacksons',
    tag: 'JKS',
    jogos: 'Free Fire',
    plataforma: 'mobile',
    regiao: 'BR',
    limite: '10',
    sobre: 'Squad tático de Free Fire focado em rush e posicionamento.',
    logo: '/equipes/image/jacksons.png',
    leaderName: 'Jackson',
    leaderAvatar: '/equipes/image/jacksons.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-thejacksons.html'
  },
  {
    id: 'os-vagalumes',
    nome: 'Os Vagalumes',
    tag: 'VGL',
    jogos: 'Fortnite',
    plataforma: 'console',
    regiao: 'BR',
    limite: '5',
    sobre: 'Construção rápida e precisão cirúrgica no Fortnite.',
    logo: '/equipes/image/vagalumes.png',
    leaderName: 'Firefly',
    leaderAvatar: '/equipes/image/vagalumes.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-vagalumes.html'
  },
  {
    id: 'shadow-foxes',
    nome: 'Shadow Foxes',
    tag: 'SFX',
    jogos: 'Valorant',
    plataforma: 'pc',
    regiao: 'BR',
    limite: '6',
    sobre: 'Estratégia e furtividade nos mapas competitivos de Valorant.',
    logo: '/equipes/image/shadow_foxes.png',
    leaderName: 'Fox',
    leaderAvatar: '/equipes/image/shadow_foxes.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-shadowfoxes.html'
  },
  {
    id: 'sky-titans',
    nome: 'Sky Titans',
    tag: 'SKT',
    jogos: 'CS2',
    plataforma: 'pc',
    regiao: 'BR',
    limite: '5',
    sobre: 'Equipe de mira afiada e comunicação limpa no CS2.',
    logo: '/equipes/image/sky_titans.png',
    leaderName: 'Titan',
    leaderAvatar: '/equipes/image/sky_titans.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-skytitans.html'
  },
  {
    id: 'dark-wolves',
    nome: 'Dark Wolves',
    tag: 'DW',
    jogos: 'Free Fire',
    plataforma: 'mobile',
    regiao: 'BR',
    limite: '5',
    sobre: 'Alcateia implacável pronta para conquistar cada safe zone.',
    logo: '/equipes/image/dark_wolves.png',
    leaderName: 'Alpha',
    leaderAvatar: '/equipes/image/dark_wolves.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-darkwolves.html'
  },
  {
    id: 'royal-dragons',
    nome: 'Royal Dragons',
    tag: 'RDG',
    jogos: 'Valorant',
    plataforma: 'pc',
    regiao: 'BR',
    limite: '5',
    sobre: 'Domínio do mapa e execuções perfeitas no Valorant.',
    logo: '/equipes/image/royal_dragons.png',
    leaderName: 'Dragon',
    leaderAvatar: '/equipes/image/royal_dragons.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-royaldragons.html'
  },
  {
    id: 'red-vipers',
    nome: 'Red Vipers',
    tag: 'RVP',
    jogos: 'CS2',
    plataforma: 'pc',
    regiao: 'BR',
    limite: '5',
    sobre: 'Agressividade calculada e precisão nos confrontos diretos.',
    logo: '/equipes/image/red_vipers.png',
    leaderName: 'Viper',
    leaderAvatar: '/equipes/image/red_vipers.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-redvipers.html'
  },
  {
    id: 'storm-riders',
    nome: 'Storm Riders',
    tag: 'STR',
    jogos: 'Fortnite',
    plataforma: 'console',
    regiao: 'BR',
    limite: '5',
    sobre: 'Velocidade e controle da tempestade nas partidas de Fortnite.',
    logo: '/equipes/image/storm_riders.png',
    leaderName: 'Rider',
    leaderAvatar: '/equipes/image/storm_riders.png',
    status: 'Recrutando',
    link: '/equipes/detalhes-stormriders.html'
  }
];

// Funcao para renderizar os cards de equipe dinamicamente no container
export function renderCards(equipes) {
  const containerLista = document.getElementById('listaEquipes');
  if (!containerLista) return;

  if (!equipes || equipes.length === 0) {
    containerLista.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #9ca3af; background: #141419; border: 1px dashed #2c2c3b; border-radius: 12px; margin: 20px 0;">
        <i class="fa-solid fa-users-slash" style="font-size: 38px; margin-bottom: 14px; color: #ef4444; display: block;"></i>
        <h3 style="color: #ffffff; font-size: 18px; margin-bottom: 8px;">Nenhuma equipe encontrada</h3>
        <p style="font-size: 14px; color: #9ca3af;">Não encontramos equipes correspondentes aos filtros selecionados.</p>
      </div>
    `;
    return;
  }

  containerLista.innerHTML = equipes.map(eq => {
    const id = eq.id || '';
    const nome = eq.nome || 'Equipe Sem Nome';
    const tag = eq.tag ? `<span style="font-size: 13px; color: #ef4444; font-weight: 600; margin-left: 6px;">[${eq.tag}]</span>` : '';
    const lider = eq.leaderName || eq.lider || 'Não informado';
    const logo = eq.logo || '/image/logo.png';
    const jogo = eq.jogos || 'Geral';
    const plataforma = eq.plataforma || 'Todas';
    const status = eq.status || 'Recrutando';
    const limite = eq.limite ? `${eq.limite} integrantes` : '5 integrantes';
    const linkDetalhes = eq.link || `/equipes/template_equipe.html?id=${encodeURIComponent(id)}`;

    return `
      <article class="card-equipe"
        data-id="${id}"
        data-nome="${nome.toLowerCase()}"
        data-jogo="${jogo.toLowerCase()}"
        data-plataforma="${plataforma.toLowerCase()}"
        data-status="${status.toLowerCase()}">
        
        <img referrerpolicy="no-referrer" src="${logo}" alt="${nome}" onerror="this.src='/image/logo.png'">
        <div class="card-info">
          <h2>${nome} ${tag}</h2>
          <p><strong>Líder:</strong> ${lider}</p>
          <p><strong>Jogo principal:</strong> ${jogo}</p>
          <p><strong>Jogadores:</strong> ${limite}</p>
          <p><strong>Status:</strong> ${status}</p>
          <a href="${linkDetalhes}">
            <button class="btn-detalhes">Ver detalhes</button>
          </a>
        </div>
      </article>
    `;
  }).join('');
}

// Funcao para filtrar as equipes com base nos inputs e dropdowns
export function filtrarEquipes() {
  const campoBusca = document.getElementById('filtroBuscaEquipe');
  const filtroJogo = document.getElementById('filtroJogoEquipe');
  const filtroPlataforma = document.getElementById('filtroPlataformaEquipe');
  const filtroStatus = document.getElementById('filtroStatusEquipe');

  const termo = (campoBusca ? campoBusca.value : '').toLowerCase().trim();
  const jogoFiltro = filtroJogo ? filtroJogo.value : 'todos';
  const plataformaFiltro = filtroPlataforma ? filtroPlataforma.value : 'todas';
  const statusFiltro = filtroStatus ? filtroStatus.value : 'todos';

  const filtradas = cacheEquipes.filter(eq => {
    // 1. Busca textual por nome, tag, jogos ou lider
    const eqNome = (eq.nome || '').toLowerCase();
    const eqTag = (eq.tag || '').toLowerCase();
    const eqJogos = (eq.jogos || '').toLowerCase();
    const eqLider = (eq.leaderName || eq.lider || '').toLowerCase();

    const matchBusca = !termo ||
      eqNome.includes(termo) ||
      eqTag.includes(termo) ||
      eqJogos.includes(termo) ||
      eqLider.includes(termo);

    // 2. Filtro por jogo principal
    let matchJogo = true;
    if (jogoFiltro !== 'todos') {
      const j = jogoFiltro.toLowerCase();
      if (j === 'cs2') {
        matchJogo = eqJogos.includes('cs2') || eqJogos.includes('cs:go') || eqJogos.includes('cs');
      } else if (j === 'freefire') {
        matchJogo = eqJogos.includes('free fire') || eqJogos.includes('freefire');
      } else {
        matchJogo = eqJogos.includes(j);
      }
    }

    // 3. Filtro por plataforma
    let matchPlataforma = true;
    if (plataformaFiltro !== 'todas') {
      const p = plataformaFiltro.toLowerCase();
      const eqPlat = (eq.plataforma || '').toLowerCase();
      matchPlataforma = eqPlat.includes(p);
    }

    // 4. Filtro por status
    let matchStatus = true;
    if (statusFiltro !== 'todos') {
      const s = statusFiltro.toLowerCase();
      const eqStatus = (eq.status || 'recrutando').toLowerCase();
      matchStatus = eqStatus.includes(s);
    }

    return matchBusca && matchJogo && matchPlataforma && matchStatus;
  });

  renderCards(filtradas);
}

// Funcao assincrona para buscar todas as equipes ativas com fallback resiliente
export async function buscarEquipes() {
  const containerLista = document.getElementById('listaEquipes');

  // Inicializa imediatamente com equipes em cache ou padrão para não travar a interface
  if (cacheEquipes.length === 0) {
    try {
      const cachedRaw = localStorage.getItem('vh_cachedEquipes');
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cacheEquipes = parsed;
          filtrarEquipes();
        }
      }
    } catch (e) {
      // Ignora erro de leitura do cache
    }

    if (cacheEquipes.length === 0 && containerLista) {
      containerLista.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #9ca3af;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: #ff7300; margin-bottom: 12px; display: block;"></i>
          Carregando equipes...
        </div>
      `;
    }
  }

  let dbData = null;

  try {
    const { data, error } = await supabase
      .from('equipes')
      .select('*');

    if (error) {
      console.warn('Aviso na sincronização do Supabase:', error?.message || error);
    } else if (Array.isArray(data) && data.length > 0) {
      dbData = data;
    }
  } catch (err) {
    console.warn('Aviso de rede ao buscar equipes no Supabase:', err?.message || err);
  }

  // Fallback REST caso a chamada do cliente Supabase tenha tido falha de conexão (Failed to fetch)
  if (!dbData) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch('https://qhnajddajpqzueropwul.supabase.co/rest/v1/equipes?select=*', {
        headers: {
          'apikey': 'sb_publishable_UvcPG7ubk8Cf88lOt8I7nA_Jnjqyk6P',
          'Authorization': 'Bearer sb_publishable_UvcPG7ubk8Cf88lOt8I7nA_Jnjqyk6P'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json) && json.length > 0) {
          dbData = json;
        }
      }
    } catch (restErr) {
      // Falha silenciosa para ativar fallback local
    }
  }

  // Base da lista: banco de dados > cache anterior > equipes padrão
  let lista = Array.isArray(dbData) && dbData.length > 0 ? [...dbData] : [...DEFAULT_EQUIPES];

  // Garante que todas as equipes oficiais estejam incluídas
  DEFAULT_EQUIPES.forEach(defEq => {
    if (!lista.some(item => String(item.id) === String(defEq.id))) {
      lista.push(defEq);
    }
  });

  // Mescla equipes criadas localmente pelo usuário (vh_createdTeams)
  try {
    const locais = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
    if (Array.isArray(locais)) {
      locais.forEach(loc => {
        if (!lista.some(item => String(item.id) === String(loc.id))) {
          lista.unshift(loc);
        }
      });
    }
  } catch (storageErr) {
    console.warn('Aviso ao mesclar equipes locais:', storageErr);
  }

  cacheEquipes = lista;

  // Persiste no cache local para carregamento instantâneo offline/subsequente
  try {
    localStorage.setItem('vh_cachedEquipes', JSON.stringify(cacheEquipes));
  } catch (e) {
    // Quota ou navegação privada
  }

  filtrarEquipes();
  return cacheEquipes;
}

// Inicializacao dos eventos da pagina
function initEquipes() {
  const campoBusca = document.getElementById('filtroBuscaEquipe');
  const filtroJogo = document.getElementById('filtroJogoEquipe');
  const filtroPlataforma = document.getElementById('filtroPlataformaEquipe');
  const filtroStatus = document.getElementById('filtroStatusEquipe');
  const headerSearch = document.getElementById('searchInput');

  // Verifica parametro ?busca= na URL ou campo pre-existente
  const urlParams = new URLSearchParams(window.location.search);
  const termoUrl = urlParams.get('busca');

  if (termoUrl) {
    if (campoBusca) campoBusca.value = termoUrl;
    if (headerSearch) headerSearch.value = termoUrl;
  }

  // Ouvintes de digitacao e sincronizacao de pesquisa
  if (campoBusca) {
    campoBusca.addEventListener('input', () => {
      if (headerSearch && headerSearch.value !== campoBusca.value) {
        headerSearch.value = campoBusca.value;
      }
      filtrarEquipes();
    });
  }

  if (headerSearch) {
    headerSearch.addEventListener('input', () => {
      if (campoBusca && campoBusca.value !== headerSearch.value) {
        campoBusca.value = headerSearch.value;
      }
      filtrarEquipes();
    });
  }

  // Ouvintes dos dropdowns de filtros
  if (filtroJogo) {
    filtroJogo.addEventListener('change', filtrarEquipes);
  }

  if (filtroPlataforma) {
    filtroPlataforma.addEventListener('change', filtrarEquipes);
  }

  if (filtroStatus) {
    filtroStatus.addEventListener('change', filtrarEquipes);
  }

  // Busca inicial das equipes com tratamento de erros robusto
  buscarEquipes();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEquipes);
} else {
  initEquipes();
}

