// /aovivo/js/aovivo_dinamico.js
import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const containerLista = document.getElementById('listaAoVivoDinamica');
  if (!containerLista) return;

  const searchInput = document.getElementById('searchInput');
  const searchForm = document.getElementById('searchHeaderForm') || document.querySelector('.search-header');

  let todosTorneios = [];

  function showLoading() {
    containerLista.innerHTML = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #9ca3af; text-align: center;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 38px; color: #ff3b30; margin-bottom: 16px; display: block;"></i>
        <span style="font-size: 16px; font-weight: 700; color: #f3f4f6;">Carregando transmissões ao vivo...</span>
        <span style="font-size: 13px; color: #6b7280; margin-top: 6px;">Sincronizando com os servidores VersusHub</span>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function carregarTorneiosAoVivo() {
    showLoading();

    let list = [];

    // 1. Busca no Supabase
    try {
      const { data: dbTorneios, error } = await supabase
        .from('torneios')
        .select('*');

      if (!error && Array.isArray(dbTorneios)) {
        list = dbTorneios;
      }
    } catch (err) {
      console.warn('Erro ao consultar torneios no Supabase:', err);
    }

    // 2. Mescla com localStorage vh_createdTournaments
    try {
      const rawLocal = localStorage.getItem('vh_createdTournaments');
      if (rawLocal) {
        const localT = JSON.parse(rawLocal);
        localT.forEach(loc => {
          const idx = list.findIndex(t => String(t.id) === String(loc.id));
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...loc };
          } else {
            list.push(loc);
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao ler vh_createdTournaments:', e);
    }

    todosTorneios = list;
    renderizarCards();
  }

  function renderizarCards(termoFiltro = '') {
    const termo = termoFiltro.toLowerCase().trim();

    let filtrados = todosTorneios;
    if (termo) {
      filtrados = todosTorneios.filter(t => {
        const nome = (t.nome || '').toLowerCase();
        const jogo = (t.jogo || '').toLowerCase();
        const categoria = (t.categoria || '').toLowerCase();
        const plataforma = (t.plataforma || '').toLowerCase();
        return nome.includes(termo) || jogo.includes(termo) || categoria.includes(termo) || plataforma.includes(termo);
      });
    }

    // Torneios em transmissão ativa
    const aoVivoList = filtrados.filter(t => t.ao_vivo === true || t.transmissao_status === 'ao_vivo');

    // Torneios com transmissão finalizada
    const finalizadosList = filtrados.filter(t => !aoVivoList.includes(t) && t.transmissao_status === 'finalizada');

    containerLista.innerHTML = '';

    if (aoVivoList.length === 0 && finalizadosList.length === 0) {
      containerLista.innerHTML = `
        <div class="empty-aovivo-container">
          <i class="fa-solid fa-tower-broadcast main-icon"></i>
          <h2>Nenhum torneio transmitindo ao vivo</h2>
          <p>
            No momento não há streams ativas. Os organizadores de torneios podem iniciar transmissões oficiais diretamente pelo painel <strong>Gerenciar Torneios</strong> inserindo o link da live.
          </p>
          <div class="empty-aovivo-actions">
            <a href="/pagina_inicial/torneios.html" class="btn-aovivo-action-primary">
              <i class="fa-solid fa-trophy"></i> Explorar Todos os Torneios
            </a>
            <a href="/gerenciartorneios/gerentornindex.html" class="btn-aovivo-action-secondary">
              <i class="fa-solid fa-file-invoice"></i> Gerenciar Meus Torneios
            </a>
          </div>
        </div>
      `;
      return;
    }

    // Se houver transmissões ativas
    if (aoVivoList.length > 0) {
      const sectionTitle = document.createElement('h3');
      sectionTitle.className = 'aovivo-section-title';
      sectionTitle.innerHTML = `<i class="fa-solid fa-tower-broadcast" style="color: #ff3b30;"></i> Transmissões Ativas Agora (${aoVivoList.length})`;
      containerLista.appendChild(sectionTitle);

      aoVivoList.forEach(t => {
        containerLista.appendChild(criarCardAoVivo(t, true));
      });
    }

    // Se houver transmissões finalizadas
    if (finalizadosList.length > 0) {
      const sectionFinalizados = document.createElement('h3');
      sectionFinalizados.className = 'aovivo-section-title';
      sectionFinalizados.style.marginTop = '40px';
      sectionFinalizados.innerHTML = `<i class="fa-solid fa-flag-checkered" style="color: #94a3b8;"></i> Transmissões Finalizadas Recentemente (${finalizadosList.length})`;
      containerLista.appendChild(sectionFinalizados);

      finalizadosList.forEach(t => {
        containerLista.appendChild(criarCardAoVivo(t, false));
      });
    }
  }

  function criarCardAoVivo(t, isLive) {
    const article = document.createElement('article');
    article.className = `card-torneio ${isLive ? 'ao-vivo' : 'finalizado'}`;
    article.setAttribute('data-nome', t.nome || '');

    const banner = t.banner || '/images/cerradocup.jpg';
    const streamUrl = t.transmissao_url || t.link || `/torneio/custom.html?id=${encodeURIComponent(t.id)}`;

    let horarioInfo = '';
    if (isLive) {
      if (t.transmissao_inicio) {
        try {
          const d = new Date(t.transmissao_inicio);
          horarioInfo = `Transmissão iniciada às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch (e) {
          horarioInfo = 'Ao vivo agora';
        }
      } else {
        horarioInfo = t.data ? `Data: ${t.data}` : 'Ao vivo agora';
      }
    } else {
      if (t.transmissao_fim) {
        try {
          const d = new Date(t.transmissao_fim);
          horarioInfo = `Transmissão encerrada às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch (e) {
          horarioInfo = 'Transmissão finalizada';
        }
      } else {
        horarioInfo = 'Transmissão finalizada';
      }
    }

    article.innerHTML = `
      ${isLive ? `
        <div class="badge-ao-vivo">
          <span class="dot"></span> Ao vivo
        </div>
      ` : `
        <div class="badge-finalizado">
          <span class="dot-finalizado"></span> Encerrado
        </div>
      `}

      <img referrerpolicy="no-referrer" src="${banner}" alt="${escapeHtml(t.nome)}" onerror="this.src='/images/cerradocup.jpg'">

      <div class="card-info">
        <h2>${escapeHtml(t.nome)}</h2>
        <p class="jogo">Jogo: ${escapeHtml(t.jogo || 'Competitivo')} ${t.categoria ? `• ${escapeHtml(t.categoria)}` : ''} ${t.plataforma ? `• ${escapeHtml(t.plataforma)}` : ''}</p>
        <p class="data"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${horarioInfo}</p>
        
        <div style="margin-top: 14px; display: flex; gap: 8px;">
          ${isLive ? `
            <a href="${streamUrl}" ${streamUrl.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''} style="flex: 1; text-decoration: none;">
              <button type="button" class="btn-assistir" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-play"></i> Assistir agora
              </button>
            </a>
          ` : `
            <a href="/torneio/custom.html?id=${encodeURIComponent(t.id)}" style="flex: 1; text-decoration: none;">
              <button type="button" class="btn-assistir" style="background: #1e293b; border-color: #334155; color: #cbd5e1; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-trophy"></i> Ver Detalhes
              </button>
            </a>
          `}
        </div>
      </div>
    `;

    return article;
  }

  // Busca no header
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderizarCards(searchInput.value);
    });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (searchInput) renderizarCards(searchInput.value);
    });
  }

  await carregarTorneiosAoVivo();
});
