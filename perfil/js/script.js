// /perfil/js/script.js
// Ponto de entrada e compatibilidade para /perfil/js/perfil.js

(function() {
  if (window.__perfilJsLoaded) return;
  const script = document.createElement('script');
  script.src = '/perfil/js/perfil.js';
  script.async = false;
  document.head.appendChild(script);
})();
