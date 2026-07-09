document.addEventListener('DOMContentLoaded', () => {
  const campoBusca = document.getElementById('filtroBuscaEquipe');
  const filtroJogo = document.getElementById('filtroJogoEquipe');
  const filtroPlataforma = document.getElementById('filtroPlataformaEquipe');
  const filtroStatus = document.getElementById('filtroStatusEquipe');
  const cards = document.querySelectorAll('.card-equipe');

  // Sincroniza valor inicial do header se houver
  const headerSearch = document.getElementById('searchInput');
  if (headerSearch && headerSearch.value && campoBusca) {
    campoBusca.value = headerSearch.value;
  }

  function aplicarFiltros() {
    const texto = (campoBusca.value || '').toLowerCase();
    const jogo = filtroJogo.value;
    const plataforma = filtroPlataforma.value;
    const status = filtroStatus.value;

    cards.forEach(card => {
      const nomeCard = card.dataset.nome.toLowerCase();
      const jogoCard = card.dataset.jogo;
      const platCard = card.dataset.plataforma;
      const statusCard = card.dataset.status;

      const passaTexto = !texto || nomeCard.includes(texto);
      const passaJogo = (jogo === 'todos' || jogo === jogoCard);
      const passaPlataforma = (plataforma === 'todas' || plataforma === platCard);
      const passaStatus = (status === 'todos' || status === statusCard);

      if (passaTexto && passaJogo && passaPlataforma && passaStatus) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }

  if (campoBusca) {
    campoBusca.addEventListener('input', () => {
      if (headerSearch) {
        headerSearch.value = campoBusca.value;
      }
      aplicarFiltros();
    });
  }
  filtroJogo.addEventListener('change', aplicarFiltros);
  filtroPlataforma.addEventListener('change', aplicarFiltros);
  filtroStatus.addEventListener('change', aplicarFiltros);

  aplicarFiltros(); // inicia tudo visível
});

