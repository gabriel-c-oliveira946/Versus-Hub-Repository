document.addEventListener('DOMContentLoaded', () => {
  // --- nome do usuário no topo ---
  const nomeEl = document.getElementById('manageUserName');
  const rawUser = localStorage.getItem('vh_loggedUser');
  let loggedUser = null;
  if (rawUser) {
    try {
      loggedUser = JSON.parse(rawUser);
      if (loggedUser && loggedUser.nome && nomeEl) nomeEl.textContent = loggedUser.nome;
    } catch (e) {
      console.error('Erro ao ler vh_loggedUser', e);
    }
  }

  if (!loggedUser) {
    const container = document.querySelector('.manage-page');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #141419; border-radius: 20px; border: 2px solid #2a2a38; max-width: 600px; margin: 80px auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <span style="font-size: 64px; display: block; margin-bottom: 20px;">🔒</span>
          <h2 style="font-size: 28px; font-weight: 800; color: #ff2c2c; margin-bottom: 12px; font-family: system-ui, sans-serif;">Área Restrita</h2>
          <p style="font-size: 16px; color: #9ca3af; margin-bottom: 30px; line-height: 1.6; font-family: system-ui, sans-serif;">Você precisa estar logado na sua conta VersusHub para poder visualizar e gerenciar seus torneios.</p>
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <a href="/login/login.html" style="background: #d41111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Fazer Login</a>
            <a href="/pagina_inicial/index.html" style="background: #222230; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; border: 1px solid #353545; transition: 0.2s;" onmouseover="this.style.background='#2c2c3e'" onmouseout="this.style.background='#222230'">Voltar ao Início</a>
          </div>
        </div>
      `;
    }
    return;
  }

  // --- abas ---
  const tabs = document.querySelectorAll('.tab-btn');
  const lista = document.getElementById('listaTorneios');

  // Filtra criados e lê os específicos do usuário
  const allCreated = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
  const userCreated = allCreated.filter(t => !t.criadorEmail || t.criadorEmail === loggedUser.email);

  const data = {
    created: userCreated,
    joined:  JSON.parse(localStorage.getItem(`vh_joinedTournaments_${loggedUser.email}`) || '[]'),
    visited: JSON.parse(localStorage.getItem(`vh_visitedTournaments_${loggedUser.email}`) || '[]'),
  };

  function criarCard(torneio) {
    const article = document.createElement('article');
    article.className = 'card-torneio manage-card-item';

    article.innerHTML = `
      <img src="${torneio.banner}" alt="${torneio.nome}">
      <div class="card-info">
        <h2>${torneio.nome}</h2>
        <p class="jogo">${torneio.jogo || ''}</p>
        <p class="data">${torneio.data || ''}</p>
        <p class="status ${torneio.statusClass || ''}">${torneio.status || ''}</p>
        <a href="${torneio.link || '#'}" class="btn-detalhes">Ver detalhes</a>
      </div>
    `;
    return article;
  }

  function render(tabKey) {
    const listaT = data[tabKey] || [];
    lista.innerHTML = '';

    if (!listaT.length) {
      lista.innerHTML = `
        <p class="empty-state">
          Você ainda não possui torneios nesta seção.
        </p>`;
      return;
    }

    listaT.forEach(t => {
      lista.appendChild(criarCard(t));
    });
  }

  // clique nas abas
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const chave = btn.dataset.tab; // "created", "joined", "visited"
      render(chave);
    });
  });

  // carrega a primeira aba (Seus torneios)
  render('created');
});
