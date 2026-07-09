// /pagina_inicial/js/torneios.js
// Filtros da página "Todos os Torneios"

document.addEventListener('DOMContentLoaded', () => {
  const cards = Array.from(document.querySelectorAll('.card-torneio'));

  const filtroBusca       = document.getElementById('filtroBusca');
  const filtroCategoria   = document.getElementById('filtroCategoria');
  const filtroJogo        = document.getElementById('filtroJogo');
  const filtroPlataforma  = document.getElementById('filtroPlataforma');
  const filtroStatus      = document.getElementById('filtroStatus');

  // busca do HEADER (barra lá de cima)
  const headerSearchInput = document.getElementById('searchInput');

  function aplicarFiltros() {
    const texto    = (filtroBusca.value || '').toLowerCase();
    const cat      = filtroCategoria.value;      // fps, moba, ...
    const jogo     = filtroJogo.value;           // csgo, freefire...
    const plat     = filtroPlataforma.value;     // pc, console, mobile
    const status   = filtroStatus.value;         // aberto, andamento, encerrado

    cards.forEach(card => {
      const nomeCard       = (card.dataset.nome || '').toLowerCase();
      const jogoCard       = card.dataset.jogo || '';
      const catCard        = card.dataset.categoria || '';
      const platCard       = card.dataset.plataforma || '';
      const statusCard     = card.dataset.status || '';

      let visivel = true;

      // texto
      if (texto && !nomeCard.includes(texto)) {
        visivel = false;
      }

      // categoria
      if (cat !== 'todos' && catCard !== cat) {
        visivel = false;
      }

      // jogo
      if (jogo !== 'todos' && jogoCard !== jogo) {
        visivel = false;
      }

      // plataforma
      if (plat !== 'todas' && platCard !== plat) {
        visivel = false;
      }

      // status
      if (status !== 'todos' && statusCard !== status) {
        visivel = false;
      }

      card.style.display = visivel ? '' : 'none';
    });
  }

  // eventos dos filtros
  if (filtroBusca) {
    filtroBusca.addEventListener('input', aplicarFiltros);
  }
  if (filtroCategoria) {
    filtroCategoria.addEventListener('change', aplicarFiltros);
  }
  if (filtroJogo) {
    filtroJogo.addEventListener('change', aplicarFiltros);
  }
  if (filtroPlataforma) {
    filtroPlataforma.addEventListener('change', aplicarFiltros);
  }
  if (filtroStatus) {
    filtroStatus.addEventListener('change', aplicarFiltros);
  }

  // sincronizar a busca do HEADER com o filtroBusca da página
  if (headerSearchInput && filtroBusca) {
    headerSearchInput.addEventListener('input', () => {
      filtroBusca.value = headerSearchInput.value;
      aplicarFiltros();
    });
  }

  // clique em "Ver detalhes" -> ir pra página certa (ajusta os links como quiser)
  document.querySelectorAll('.card-torneio').forEach(card => {
    const btn = card.querySelector('.btn-detalhes');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const nome = card.dataset.nome;

      if (nome === 'Cerrado Cup CS:GO') {
        window.location.href = '/torneio/cerradocup.html';
      } else if (nome === 'Contra Cup Free Fire') {
        window.location.href = '/torneio/contracup-freefire.html';
      } else if (nome === 'Liga FF Brasil') {
        window.location.href = '/torneio/liga-ff-brasil.html';
      } else if (nome === 'FIFA Global Series') {
        window.location.href = '/torneio/fifa-global-series.html';
      }
      // pode continuar esse if/else ou trocar por data-id no HTML
    });
  });

  // aplica uma vez ao carregar (caso tenha algo pré-digitado)
  aplicarFiltros();
});
