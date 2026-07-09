// /criar_equipe/js/criar_equipe.js
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY_TEAMS = 'vh_createdTeams';

  // --- LOGIN VERIFICATION ---
  const loggedUserRaw = localStorage.getItem("vh_loggedUser");
  if (!loggedUserRaw) {
    const container = document.querySelector('.criar-torneio-page') || document.querySelector('.team-page') || document.querySelector('main');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #141419; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); max-width: 600px; margin: 80px auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5); font-family: system-ui, sans-serif;">
          <span style="font-size: 64px; display: block; margin-bottom: 20px;">🔒</span>
          <h2 style="font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 12px;">Área Restrita</h2>
          <p style="font-size: 16px; color: #9ca3af; margin-bottom: 30px; line-height: 1.6;">Você precisa estar logado na sua conta VersusHub para poder criar uma nova equipe.</p>
          <div style="display: flex; gap: 15px; justify-content: center;">
            <a href="/login/login.html" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; padding: 12px 32px; border-radius: 999px; border: none; background: #d41111; color: #ffffff; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 4px 15px rgba(212, 17, 17, 0.3);">Fazer Login</a>
            <a href="/pagina_inicial/index.html" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; padding: 12px 28px; border-radius: 999px; border: 1.5px solid #272735; background: transparent; color: #e5e7eb; font-weight: 700; font-size: 14px; cursor: pointer;">Voltar ao Início</a>
          </div>
        </div>
      `;
    }
    return;
  }

  const form = document.getElementById('formCriarEquipe');
  const logoInput = document.getElementById('logoInput');
  const logoPreview = document.getElementById('logoPreview');


  const nomeEquipe = document.getElementById('nomeEquipe');
  const tagEquipe = document.getElementById('tagEquipe');
  const jogosEquipe = document.getElementById('jogosEquipe');
  const plataformaEquipe = document.getElementById('plataformaEquipe');
  const regiaoEquipe = document.getElementById('regiaoEquipe');
  const limiteMembros = document.getElementById('limiteMembros'); // <- é ESSA
  const sobreEquipe = document.getElementById('sobreEquipe');
  const feedbackMsg = document.getElementById('feedbackMsgEquipe');


  let logoDataUrl = ''; // guarda a imagem em base64


  // ========= PREVIEW LOGO =========
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        logoDataUrl = '';
        logoPreview.innerHTML = '<span>Nenhuma imagem selecionada</span>';
        return;
      }


      const reader = new FileReader();
      reader.onload = (ev) => {
        logoDataUrl = ev.target.result;
        logoPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = logoDataUrl;
        logoPreview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }


  // ========= LOCALSTORAGE =========
  
  function loadTeams() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS) || '[]');
    } catch (e) {
      return [];
    }
  }


  function saveTeams(arr) {
    localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(arr));
  }


  // pega o usuário logado pra marcar como lider da equipe

  function getLoggedUser() {
    try {
      const raw = localStorage.getItem('vh_loggedUser');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }


  // ========= codigos que fazem o criar equipe funciona =========

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();


      if (!nomeEquipe.value.trim()) {
        feedbackMsg.textContent = 'Dê um nome para a sua equipe.';
        feedbackMsg.style.color = '#fecaca';
        return;
      }


      const loggedUser = getLoggedUser();
      const id = 'team-' + Date.now();


      const novaEquipe = {
        id,
        nome: nomeEquipe.value.trim(),
        tag: tagEquipe.value.trim(),        // ex: "FPS, Competitivo"
        jogos: jogosEquipe.value.trim(),    // ex: "Valorant, CS2"
        plataforma: plataformaEquipe.value,
        regiao: regiaoEquipe.value.trim(),
        limite: limiteMembros.value,        // <-- aqui corrigido
        sobre: sobreEquipe.value.trim() || 'Nenhuma descrição informada.',


        // se não escolher logo, usa uma padrão
        logo: logoDataUrl || '/image/logo.png',


        // infos do líder (quem criou a equipe)
        leaderName: loggedUser?.nome || 'Líder',
        leaderAvatar: loggedUser?.avatar || '/image/boneco_logo_ofc.png',


        // no futuro dá pra preencher isso
        torneiosGanhos: [],
        torneiosAtuais: [],


        // página de detalhes dinâmica
        link: '/equipes/template_equipe.html?id=' + encodeURIComponent(id)
      };


      const lista = loadTeams();
      lista.push(novaEquipe);
      saveTeams(lista);


      feedbackMsg.textContent = 'Equipe criada com sucesso! Indo para seu perfil...';
      feedbackMsg.style.color = '#a7f3d0';


      setTimeout(() => {
        window.location.href = '/perfil/perfil.html';
      }, 1200);
    });
  }
});
