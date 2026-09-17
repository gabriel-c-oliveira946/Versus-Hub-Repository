// /pagina_inicial/js/torneios.js
// Pesquisa e filtros assíncronos diretamente integrados com o Supabase

import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const listaTorneios     = document.getElementById('listaTorneios');
  const filtroBusca       = document.getElementById('filtroBusca');
  const filtroCategoria   = document.getElementById('filtroCategoria');
  const filtroJogo        = document.getElementById('filtroJogo');
  const filtroJogoTexto   = document.getElementById('filtroJogoTexto');
  const filtroPlataforma  = document.getElementById('filtroPlataforma');
  const filtroStatus      = document.getElementById('filtroStatus');
  const headerSearchInput = document.getElementById('searchInput');

  let debounceTimer = null;

  // Dicionário de jogos padrão para mapeamento amigável
  const mapaJogosPadrao = {
    csgo: 'CS:GO',
    valorant: 'Valorant',
    freefire: 'Free Fire',
    fifa: 'FIFA',
    lol: 'League of Legends',
    fortnite: 'Fortnite',
    rocketleague: 'Rocket League',
    minecraft: 'Minecraft',
    apex: 'Apex Legends',
    efootball: 'eFootball',
    kof: 'King of Fighters',
    godofwar: 'God of War',
    pokemon: 'Pokemon',
    bomberman: 'Bomberman'
  };

  // Renderiza a lista de cards dinamicamente
  function renderCards(torneios) {
    if (!listaTorneios) return;

    if (!torneios || torneios.length === 0) {
      listaTorneios.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #9ca3af; background: #0e0d16; border-radius: 16px; border: 1px dashed #28283a; margin: 20px 0;">
          <i class="fa-solid fa-trophy" style="font-size: 32px; color: #4b5563; margin-bottom: 14px; display: block;"></i>
          <p style="font-size: 16px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">Nenhum torneio encontrado</p>
          <p style="font-size: 14px; color: #6b7280;">Tente buscar por outro termo ou ajuste os filtros acima.</p>
        </div>
      `;
      return;
    }

    listaTorneios.innerHTML = torneios.map(t => {
      const banner = t.banner || '/images/cerradocup.jpg';
      const link = '/torneio/custom.html?id=' + encodeURIComponent(t.id);
      let statusClass = t.statusClass || (
        t.status && t.status.toLowerCase().includes('andamento') ? 'status-andamento' :
        t.status && t.status.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto'
      );
      let statusTexto = t.status || 'Inscrições abertas';

      if (
        t.ao_vivo === true ||
        t.transmissao_status === 'ao_vivo' ||
        (t.status && t.status.toLowerCase().includes('ao vivo'))
      ) {
        statusTexto = "Ao Vivo <i class='fa-solid fa-tower-broadcast'></i>";
        statusClass = 'status-andamento';
      }

      return `
        <article class="card-torneio"
          data-id="${t.id}"
          data-nome="${t.nome || ''}"
          data-jogo="${t.jogo || ''}"
          data-categoria="${t.categoria || ''}"
          data-plataforma="${t.plataforma || ''}"
          data-status="${t.status || ''}">
          
          <img referrerpolicy="no-referrer" src="${banner}" alt="${t.nome}">
          <div class="card-info">
            <h2>${t.nome}</h2>
            <p class="jogo">Jogo: ${t.jogo || 'Geral'} • ${(t.categoria || 'Competitivo').toUpperCase()} • ${(t.plataforma || 'Multi').toUpperCase()}</p>
            <p class="data">Início: ${t.data || 'Em breve'}</p>
            <p class="status ${statusClass}">${statusTexto}</p>
            <a href="${link}"><button class="btn-detalhes">Ver detalhes</button></a>
          </div>
        </article>
      `;
    }).join('');
  }

  // Executa a busca assíncrona no Supabase com filtragem refinada
  async function buscarTorneios() {
    if (listaTorneios) {
      listaTorneios.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #9ca3af; text-align: center;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: #ff3b30; margin-bottom: 14px; display: block;"></i>
          <span style="font-size: 15px; font-weight: 600; color: #f3f4f6;">Carregando torneios...</span>
          <span style="font-size: 13px; color: #6b7280; margin-top: 4px;">Sincronizando com o VersusHub</span>
        </div>
      `;
    }

    const termo  = (filtroBusca ? filtroBusca.value : '').trim();
    const cat    = filtroCategoria ? filtroCategoria.value : 'todos';
    const plat   = filtroPlataforma ? filtroPlataforma.value : 'todas';
    const status = filtroStatus ? filtroStatus.value : 'todos';

    // Determina o termo de jogo vindo do input de texto ou do select
    let termoJogo = '';
    if (filtroJogoTexto && filtroJogoTexto.value.trim() !== '') {
      termoJogo = filtroJogoTexto.value.trim();
    } else if (filtroJogo && filtroJogo.value !== 'todos' && filtroJogo.value !== 'outro') {
      termoJogo = mapaJogosPadrao[filtroJogo.value] || filtroJogo.value;
    }

    try {
      let query = supabase.from('torneios').select('*');

      // 1. Pesquisa por nome ou texto geral
      if (termo) {
        query = query.or(`nome.ilike.%${termo}%,jogo.ilike.%${termo}%`);
      }

      // 2. Filtro de Categoria
      if (cat !== 'todos') {
        if (cat === 'outros') {
          query = query.or('categoria.ilike.%outros%,categoria.is.null,categoria.eq.');
        } else {
          query = query.ilike('categoria', `%${cat}%`);
        }
      }

      // 3. Filtro de Jogo flexível no Supabase
      if (termoJogo) {
        const tjClean = termoJogo.toLowerCase().trim();
        if (tjClean === 'csgo' || tjClean === 'cs:go' || tjClean.includes('counter-strike') || tjClean === 'cs') {
          query = query.or('jogo.ilike.%CS:GO%,jogo.ilike.%Counter-Strike%,jogo.ilike.%CS%');
        } else if (tjClean === 'lol' || tjClean.includes('league of legends')) {
          query = query.or('jogo.ilike.%League of Legends%,jogo.ilike.%LoL%');
        } else if (tjClean.includes('fifa') || tjClean.includes('fc') || tjClean.includes('efootball')) {
          query = query.or('jogo.ilike.%FIFA%,jogo.ilike.%FC%,jogo.ilike.%Efootball%');
        } else if (tjClean.includes('free fire') || tjClean === 'freefire' || tjClean === 'ff') {
          query = query.or('jogo.ilike.%Free Fire%,jogo.ilike.%FreeFire%');
        } else if (tjClean.includes('kof') || tjClean.includes('king of fighters')) {
          query = query.or('jogo.ilike.%King of Fighters%,jogo.ilike.%KOF%');
        } else {
          query = query.ilike('jogo', `%${termoJogo}%`);
        }
      }

      // 4. Plataforma
      if (plat !== 'todas') {
        query = query.ilike('plataforma', `%${plat}%`);
      }

      // 5. Status
      if (status !== 'todos') {
        if (status === 'aberto') {
          query = query.ilike('status', '%abert%');
        } else if (status === 'andamento') {
          query = query.or('status.ilike.%andamento%,status.ilike.%ao vivo%,statusClass.eq.status-andamento');
        } else if (status === 'encerrado') {
          query = query.ilike('status', '%encerrado%');
        }
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      let listaBase = [];

      if (!error && Array.isArray(data)) {
        listaBase = data;
      } else {
        console.warn('Consulta no banco retornou aviso/erro:', error);
      }

      // Mescla com torneios locais
      try {
        const localData = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
        localData.forEach(loc => {
          if (!listaBase.some(t => String(t.id) === String(loc.id))) {
            listaBase.unshift(loc);
          }
        });
      } catch (eLocal) {}

      // Filtragem refinada em memória para assegurar correspondência 100% exata
      const filtrados = listaBase.filter(t => {
        // Categoria
        if (cat !== 'todos') {
          const tCat = (t.categoria || '').toLowerCase();
          if (cat === 'outros') {
            const padroes = ['fps', 'moba', 'battle-royale', 'esportes', 'luta', 'cartas'];
            const ehPadrao = padroes.some(p => tCat.includes(p));
            if (ehPadrao && tCat !== 'outros') return false;
          } else {
            if (!tCat.includes(cat.toLowerCase())) return false;
          }
        }

        // Jogo
        if (termoJogo) {
          const tj = termoJogo.toLowerCase();
          const jg = (t.jogo || '').toLowerCase();
          const nm = (t.nome || '').toLowerCase();

          let match = jg.includes(tj) || nm.includes(tj);
          if (!match) {
            if ((tj === 'csgo' || tj === 'cs:go' || tj === 'cs') && (jg.includes('cs') || jg.includes('counter-strike'))) match = true;
            if ((tj === 'lol' || tj.includes('league')) && (jg.includes('lol') || jg.includes('league'))) match = true;
            if ((tj === 'fifa' || tj === 'fc' || tj.includes('ea fc')) && (jg.includes('fifa') || jg.includes('fc') || jg.includes('efootball'))) match = true;
            if ((tj === 'freefire' || tj === 'free fire' || tj === 'ff') && (jg.includes('free fire') || jg.includes('freefire'))) match = true;
            if ((tj === 'kof' || tj.includes('king of fighters')) && (jg.includes('king of fighters') || jg.includes('kof'))) match = true;
            if ((tj === 'godofwar' || tj.includes('god of war')) && (jg.includes('god of war') || nm.includes('god of war'))) match = true;
            if (tj === 'apex' && jg.includes('apex')) match = true;
            if (tj.includes('bomberman') && jg.includes('bomberman')) match = true;
            if (tj.includes('efootball') && jg.includes('efootball')) match = true;
          }
          if (!match) return false;
        }

        // Plataforma
        if (plat !== 'todas') {
          const p = (t.plataforma || '').toLowerCase();
          if (!p.includes(plat.toLowerCase()) && !p.includes('multi')) return false;
        }

        // Status
        if (status !== 'todos') {
          const st = (t.status || '').toLowerCase();
          const stCls = (t.statusClass || '').toLowerCase();
          if (status === 'aberto' && !st.includes('abert')) return false;
          if (status === 'andamento' && !st.includes('andamento') && !st.includes('ao vivo') && stCls !== 'status-andamento') return false;
          if (status === 'encerrado' && !st.includes('encerrado')) return false;
        }

        // Texto livre
        if (termo) {
          const term = termo.toLowerCase();
          const nm = (t.nome || '').toLowerCase();
          const jg = (t.jogo || '').toLowerCase();
          const desc = (t.descricao || '').toLowerCase();
          if (!nm.includes(term) && !jg.includes(term) && !desc.includes(term)) return false;
        }

        return true;
      });

      renderCards(filtrados);
    } catch (err) {
      console.error('Falha na requisição de busca:', err);
    }
  }

  function dispararBuscaComDebounce() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      buscarTorneios();
    }, 250);
  }

  // Evento ao alterar o select de Jogo padrão
  if (filtroJogo) {
    filtroJogo.addEventListener('change', () => {
      const val = filtroJogo.value;
      if (val === 'todos') {
        if (filtroJogoTexto) filtroJogoTexto.value = '';
      } else if (val === 'outro') {
        if (filtroJogoTexto) {
          filtroJogoTexto.value = '';
          filtroJogoTexto.focus();
        }
      } else {
        if (filtroJogoTexto) {
          filtroJogoTexto.value = mapaJogosPadrao[val] || val;
        }
      }
      buscarTorneios();
    });
  }

  // Evento ao digitar no campo de texto de Jogo
  if (filtroJogoTexto) {
    filtroJogoTexto.addEventListener('input', () => {
      const texto = filtroJogoTexto.value.trim().toLowerCase();
      if (!texto) {
        if (filtroJogo) filtroJogo.value = 'todos';
      } else {
        let encontrouChave = null;
        for (const [chave, nomeAmigavel] of Object.entries(mapaJogosPadrao)) {
          if (nomeAmigavel.toLowerCase() === texto || chave === texto) {
            encontrouChave = chave;
            break;
          }
        }
        if (filtroJogo) {
          filtroJogo.value = encontrouChave || 'outro';
        }
      }
      dispararBuscaComDebounce();
    });
  }

  // Eventos dos outros filtros
  if (filtroBusca) {
    filtroBusca.addEventListener('input', dispararBuscaComDebounce);
  }
  if (filtroCategoria) {
    filtroCategoria.addEventListener('change', buscarTorneios);
  }
  if (filtroPlataforma) {
    filtroPlataforma.addEventListener('change', buscarTorneios);
  }
  if (filtroStatus) {
    filtroStatus.addEventListener('change', buscarTorneios);
  }

  // Sincroniza campo de busca do header com o filtroBusca da página
  if (headerSearchInput) {
    headerSearchInput.addEventListener('input', () => {
      if (filtroBusca) {
        filtroBusca.value = headerSearchInput.value;
      }
      dispararBuscaComDebounce();
    });
  }

  // Se veio parâmetro na URL (?busca=...)
  const urlParams = new URLSearchParams(window.location.search);
  const termoInicial = urlParams.get('busca');
  if (termoInicial && filtroBusca) {
    filtroBusca.value = termoInicial;
    if (headerSearchInput) headerSearchInput.value = termoInicial;
  }

  // Carga inicial dos torneios diretamente do Supabase
  buscarTorneios();
});
