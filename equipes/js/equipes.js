// /equipes/js/equipes.js
import { supabase } from '/supabaseClient.js';

let cacheEquipes = [];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Funcao para renderizar os cards de equipe dinamicamente no container
export function renderCards(equipes) {
  const containerLista = document.getElementById('listaEquipes');
  if (!containerLista) return;

  containerLista.setAttribute('aria-busy', 'false');

  if (!equipes || equipes.length === 0) {
    containerLista.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #9ca3af; background: #141419; border: 1px dashed #2c2c3b; border-radius: 12px; margin: 20px 0;">
        <i class="fa-solid fa-users-slash" style="font-size: 38px; margin-bottom: 14px; color: #ef4444; display: block;"></i>
        <h3 style="color: #ffffff; font-size: 18px; margin-bottom: 8px;">Nenhuma equipe encontrada</h3>
        <p style="font-size: 14px; color: #9ca3af;">Não há equipes correspondentes aos critérios de busca selecionados.</p>
      </div>
    `;
    return;
  }

  containerLista.innerHTML = equipes.map(eq => {
    const id = eq.id || '';
    const nome = escapeHtml(eq.nome || 'Equipe Sem Nome');
    const tag = eq.tag ? `<span style="font-size: 13px; color: #ef4444; font-weight: 600; margin-left: 6px;">[${escapeHtml(eq.tag)}]</span>` : '';
    const lider = escapeHtml(eq.leaderName || eq.lider || 'Não informado');
    const logo = eq.logo || (window.getCachedImage && window.getCachedImage(`team_logo_${id}`)) || '/image/logo.png';
    if (window.setCachedImage && eq.logo) {
      window.setCachedImage(`team_logo_${id}`, eq.logo);
    }
    const jogo = escapeHtml(eq.jogos || 'Geral');
    const plataforma = escapeHtml(eq.plataforma || 'Todas');
    const totalMembros = eq.totalMembrosCalculado !== undefined ? eq.totalMembrosCalculado : (eq.membrosCount || 1);
    const limiteMax = parseInt(eq.limite, 10) || 5;
    const isCheia = Boolean(eq.isCheiaCalculado !== undefined ? eq.isCheiaCalculado : (totalMembros >= limiteMax));
    const statusTexto = isCheia ? 'Equipe Cheia' : (eq.status || 'Recrutando');
    const statusCor = isCheia ? '#ef4444' : '#22c55e';
    const linkDetalhes = `/equipes/template_equipe.html?id=${encodeURIComponent(id)}`;

    return `
      <article class="card-equipe"
        data-id="${escapeHtml(id)}"
        data-nome="${nome.toLowerCase()}"
        data-jogo="${jogo.toLowerCase()}"
        data-plataforma="${plataforma.toLowerCase()}"
        data-status="${isCheia ? 'completa' : 'recrutando'}">
        
        <img referrerpolicy="no-referrer" src="${logo}" alt="${nome}" onerror="this.src='/image/logo.png'">
        <div class="card-info">
          <h2>${nome} ${tag}</h2>
          <p><strong>Líder:</strong> ${lider}</p>
          <p><strong>Jogo principal:</strong> ${jogo}</p>
          <p><strong>Vagas:</strong> <span style="font-weight: 600; color: ${isCheia ? '#f87171' : '#e4e4e7'};">${totalMembros} / ${limiteMax}</span></p>
          <p><strong>Status:</strong> <span style="color: ${statusCor}; font-weight: 700;">${statusTexto}</span></p>
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
      const isCheia = Boolean(eq.isCheiaCalculado);
      if (statusFiltro === 'completa') {
        matchStatus = isCheia;
      } else if (statusFiltro === 'recrutando') {
        matchStatus = !isCheia;
      }
    }

    return matchBusca && matchJogo && matchPlataforma && matchStatus;
  });

  renderCards(filtradas);
}

// Limpeza preventiva total de equipes e torneios estáticos salvos no localStorage de sessões anteriores


// Removidas todas as equipes estáticas prontas: dados carregados exclusivamente do Supabase
const DEFAULT_EQUIPES_SEED = [];

// Funcao assincrona resiliente para buscar equipes com fallbacks automaticos
export async function buscarEquipes() {
  const containerLista = document.getElementById('listaEquipes');
  if (containerLista && cacheEquipes.length === 0) {
    containerLista.setAttribute('aria-busy', 'true');
    containerLista.innerHTML = `
      <div class="card-equipe skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-img"></div>
        <div class="card-info">
          <div class="skeleton-shimmer skeleton-card-line title"></div>
          <div class="skeleton-shimmer skeleton-card-line"></div>
          <div class="skeleton-shimmer skeleton-card-line"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
          <div class="skeleton-shimmer skeleton-card-btn"></div>
        </div>
      </div>
      <div class="card-equipe skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-card-img"></div>
        <div class="card-info">
          <div class="skeleton-shimmer skeleton-card-line title"></div>
          <div class="skeleton-shimmer skeleton-card-line"></div>
          <div class="skeleton-shimmer skeleton-card-line"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
          <div class="skeleton-shimmer skeleton-card-btn"></div>
        </div>
      </div>
    `;
  }

  let rawEquipes = [];
  let rawMembros = [];

  // 1. Consulta em tempo real na tabela public.equipes do Supabase
  try {
    const fetchPromise = Promise.all([
      supabase.from('equipes').select('id, nome, tag, jogos, logo, regiao, limite, criador_email').order('created_at', { ascending: false }),
      supabase.from('membros_equipe').select('id, equipe_id, user_email, status').eq('status', 'Aceito')
    ]);
    const [resEquipes, resMembros] = await fetchPromise;

    if (!resEquipes.error && Array.isArray(resEquipes.data)) {
      rawEquipes = resEquipes.data;
    }
    if (!resMembros.error && Array.isArray(resMembros.data)) {
      rawMembros = resMembros.data;
    }
  } catch (err) {}

  // 2. Se a consulta não retornar equipes ou se houver erro, exibe graciosamente Nenhuma equipe encontrada
  if (!rawEquipes || rawEquipes.length === 0) {
    cacheEquipes = [];
    if (containerLista) {
      containerLista.setAttribute('aria-busy', 'false');
      containerLista.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 20px; text-align: center; color: #9ca3af; background: #111116; border: 1px solid #2a2a38; border-radius: 14px;">
          <i class="fa-solid fa-users-slash" style="font-size: 36px; color: #4b5563; margin-bottom: 12px; display: block;"></i>
          <h4 style="color: #ffffff; margin: 0 0 6px; font-size: 16px;">Nenhuma equipe encontrada</h4>
          <p style="margin: 0; font-size: 13px;">Ainda não existem equipes cadastradas no VersusHub.</p>
        </div>
      `;
    }
    return;
  }

  // Mapeia os membros aceitos
  const mapaMembros = {};
  rawMembros.forEach(m => {
    if (m.equipe_id) {
      mapaMembros[m.equipe_id] = (mapaMembros[m.equipe_id] || 0) + 1;
    }
  });

  cacheEquipes = rawEquipes.map(eq => {
    const totalMembros = mapaMembros[eq.id] || 1;
    const limiteMax = parseInt(eq.limite, 10) || 5;
    const isCheia = totalMembros >= limiteMax;
    return {
      ...eq,
      membrosCount: totalMembros,
      totalMembrosCalculado: totalMembros,
      limiteMaxCalculado: limiteMax,
      isCheiaCalculado: isCheia
    };
  });

  filtrarEquipes();
}

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

  // Busca inicial das equipes
  buscarEquipes();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEquipes);
} else {
  initEquipes();
}
