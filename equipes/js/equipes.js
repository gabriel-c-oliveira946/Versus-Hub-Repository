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
    const logo = eq.logo || '/image/logo.png';
    const jogo = escapeHtml(eq.jogos || 'Geral');
    const plataforma = escapeHtml(eq.plataforma || 'Todas');
    const totalMembros = eq.totalMembrosCalculado || 1;
    const limiteMax = eq.limiteMaxCalculado || 5;
    const isCheia = Boolean(eq.isCheiaCalculado);
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

// Funcao assincrona para buscar todas as equipes ativas exclusivamente no banco de dados
export async function buscarEquipes() {
  const containerLista = document.getElementById('listaEquipes');

  if (containerLista && cacheEquipes.length === 0) {
    containerLista.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #9ca3af;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: #ff3e3e; margin-bottom: 12px; display: block;"></i>
        Carregando equipes...
      </div>
    `;
  }

  try {
    // 1. Consulta estrita na tabela 'equipes'
    const { data: equipesData, error: eqErr } = await supabase
      .from('equipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (eqErr) {
      console.error('Erro ao consultar equipes:', eqErr);
      if (containerLista) {
        containerLista.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #ef4444;">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
            Não foi possível carregar as equipes no momento.
          </div>
        `;
      }
      return [];
    }

    const listaEquipes = Array.isArray(equipesData) ? equipesData : [];

    // 2. Consulta membros aceitos para cálculo estrito de vagas
    const { data: membrosAceitos, error: memErr } = await supabase
      .from('membros_equipe')
      .select('id, equipe_id, user_email, status')
      .eq('status', 'Aceito');

    if (memErr) {
      console.warn('Erro ao consultar membros aceitos:', memErr);
    }

    const membrosMap = new Map();
    (membrosAceitos || []).forEach(m => {
      const eqIdKey = String(m.equipe_id || '').trim().toLowerCase();
      if (!membrosMap.has(eqIdKey)) {
        membrosMap.set(eqIdKey, []);
      }
      membrosMap.get(eqIdKey).push(m);
    });

    // 3. Processa cada equipe com base na contagem real de integrantes
    const equipesProcessadas = listaEquipes.map(eq => {
      const idKey = String(eq.id || '').trim().toLowerCase();
      const nomeKey = String(eq.nome || '').trim().toLowerCase();

      // Membros aceitos vinculados tanto pelo id quanto pelo nome
      const membrosDoTime = [
        ...(membrosMap.get(idKey) || []),
        ...(membrosMap.get(nomeKey) || [])
      ];

      // Remove duplicações se houver e desconsidera o próprio email do líder na lista de membros adicionais
      const uniqueEmails = new Set();
      const membrosFiltrados = membrosDoTime.filter(m => {
        const email = String(m.user_email || '').toLowerCase().trim();
        if (!email) return false;
        if (eq.leaderEmail && email === String(eq.leaderEmail).toLowerCase().trim()) return false;
        if (uniqueEmails.has(email)) return false;
        uniqueEmails.add(email);
        return true;
      });

      const leaderCount = (eq.leaderEmail || eq.leaderName || eq.lider) ? 1 : 0;
      const totalMembros = leaderCount + membrosFiltrados.length;
      const limiteMax = parseInt(eq.limite, 10) > 0 ? parseInt(eq.limite, 10) : 5;
      const isCheia = totalMembros >= limiteMax;

      return {
        ...eq,
        totalMembrosCalculado: totalMembros,
        limiteMaxCalculado: limiteMax,
        isCheiaCalculado: isCheia
      };
    });

    cacheEquipes = equipesProcessadas;
    filtrarEquipes();
    return cacheEquipes;

  } catch (err) {
    console.error('Falha geral ao buscar equipes:', err);
    if (containerLista) {
      containerLista.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #ef4444;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
          Erro ao processar equipes. Tente novamente mais tarde.
        </div>
      `;
    }
    return [];
  }
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

  // Busca inicial das equipes
  buscarEquipes();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEquipes);
} else {
  initEquipes();
}
