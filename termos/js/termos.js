// /termos/js/termos.js
// Gerenciamento dinâmico de abas e navegação por âncoras na Central de Termos e Privacidade

document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.terms-tab-btn');
  const tabPanels = document.querySelectorAll('.terms-tab-panel');

  function switchTab(targetId, updateHash = true) {
    if (!targetId) return;

    // Atualiza botões
    tabBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-target') === targetId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // Atualiza painéis
    tabPanels.forEach(panel => {
      const isTarget = panel.id === targetId;
      panel.classList.toggle('active', isTarget);
      if (isTarget) {
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    });

    // Atualiza URL hash de forma limpa
    if (updateHash) {
      const newHash = targetId === 'tab-privacidade' ? '#privacidade' : '#termos';
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash);
      }
    }
  }

  // Event listeners nos botões de abas
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      switchTab(targetId, true);
    });
  });

  // Links internos que apontam para as abas (ex: botões ou links inline com data-tab-switch)
  document.querySelectorAll('[data-switch-to]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-switch-to');
      switchTab(target, true);
      const targetEl = document.getElementById(target);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Leitura do hash da URL na inicialização
  const rawHash = (window.location.hash || '').toLowerCase();
  if (rawHash === '#privacidade' || rawHash === '#politica-privacidade' || rawHash === '#lgpd' || rawHash === '#dados') {
    switchTab('tab-privacidade', false);
  } else {
    switchTab('tab-termos', false);
  }

  // Escuta mudanças de hash na janela (ex: navegação do histórico ou clique no footer)
  window.addEventListener('hashchange', () => {
    const curHash = (window.location.hash || '').toLowerCase();
    if (curHash === '#privacidade' || curHash === '#politica-privacidade' || curHash === '#lgpd') {
      switchTab('tab-privacidade', false);
    } else {
      switchTab('tab-termos', false);
    }
  });
});
