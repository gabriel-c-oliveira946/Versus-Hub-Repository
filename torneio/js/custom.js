// /torneio/js/custom.js
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'vh_createdTournaments';

  // 1) pega o id da URL: .../custom.html?id=custom-123456
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    alert('Torneio não encontrado (id ausente na URL).');
    return;
  }

  // 2) carrega lista de torneios criados


  let torneios = [];

  try {
    torneios = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    console.error('Erro ao ler vh_createdTournaments:', e);
  }

  // 3) procura o torneio pelo id
  
  const t = torneios.find(t => t.id === id);
  if (!t) {
    alert('Torneio não encontrado nos seus dados.');
    return;
  }

  // 4) preenche o layout
  const detBanner      = document.getElementById('detBanner');
  const detStatusBadge = document.getElementById('detStatusBadge');
  const detNome        = document.getElementById('detNome');
  const detMeta        = document.getElementById('detMeta');
  const detData        = document.getElementById('detData');

  const tagCategoria   = document.getElementById('tagCategoria');
  const tagPlataforma  = document.getElementById('tagPlataforma');
  const tagModalidade  = document.getElementById('tagModalidade');
  const tagTaxa        = document.getElementById('tagTaxa');

  const detDescricao   = document.getElementById('detDescricao');
  const detRegras      = document.getElementById('detRegras');
  const detRequisitos  = document.getElementById('detRequisitos');
  const infoLocal      = document.getElementById('infoLocal');
  const infoModalidade = document.getElementById('infoModalidade');
  const infoTaxa       = document.getElementById('infoTaxa');
  const detPremiacao   = document.getElementById('detPremiacao');

  // banner
  if (t.banner) detBanner.src = t.banner;
  detBanner.alt = t.nome || 'Banner do torneio';

  // status (texto + classe de cor)
  detStatusBadge.textContent = t.status || '';
  detStatusBadge.classList.add(t.statusClass || '');

  // título / meta / data
  detNome.textContent = t.nome || 'Torneio sem nome';
  detMeta.textContent = t.jogo || '';
  detData.textContent = t.data || '';

  // tags
  tagCategoria.textContent  = t.categoria ? `Categoria: ${t.categoria}` : '';
  tagPlataforma.textContent = t.plataforma ? `Plataforma: ${t.plataforma}` : '';
  tagModalidade.textContent = t.modalidade ? `Modalidade: ${t.modalidade}` : '';
  tagTaxa.textContent       = t.taxa ? `Taxa: ${t.taxa}` : '';

  // descrição, regras, requisitos
  detDescricao.textContent = t.descricao || 'Nenhuma descrição informada.';
  detRegras.textContent    = t.regras || 'Nenhuma regra cadastrada.';
  detRequisitos.textContent= t.requisitos || 'Nenhum requisito informado.';

  // infos gerais
  infoLocal.textContent      = t.localizacao || 'Não informada';
  infoModalidade.textContent = t.modalidade || 'Não informada';
  infoTaxa.textContent       = t.taxa || 'Gratuito';

  // premiação (já vem formatada com quebras de linha)
  detPremiacao.textContent = t.premiacao || 'Sem premiação.';
});
