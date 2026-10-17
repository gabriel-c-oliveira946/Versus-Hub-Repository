// /cria_equipe/js/criar_equipe.js
import { supabase } from '/supabaseClient.js';



document.addEventListener('DOMContentLoaded', async () => {
  const STORAGE_KEY_TEAMS = 'vh_createdTeams';

  try {
    ['vh_cachedEquipes', 'vh_createdTeams', 'vh_equipes', 'equipes'].forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(item => item );
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    });
  } catch (e) {}

  // --- LOGIN VERIFICATION COM SUPABASE AUTH ---
  let loggedUser = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      const raw = localStorage.getItem("vh_loggedUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.email === email) loggedUser = parsed;
        } catch (e) {}
      }
      if (!loggedUser) {
        const { data: profile } = await supabase.from('usuarios').select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas').eq('email', email).maybeSingle();
        loggedUser = {
          id: profile?.id || session.user.id,
          nome: profile?.nome || session.user.user_metadata?.nome || email.split('@')[0],
          email: email,
          avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
          auth_id: session.user.id
        };
        localStorage.setItem("vh_loggedUser", JSON.stringify(loggedUser));
      }
    }
  } catch (err) {
    console.warn("Aviso ao validar auth em cria_equipe:", err);
  }

  if (!loggedUser) {
    const container = document.querySelector('.criar-torneio-page') || document.querySelector('.team-page') || document.querySelector('main');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #141419; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); max-width: 600px; margin: 80px auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5); font-family: system-ui, sans-serif;">
          <i class="fa-solid fa-lock" style="font-size: 56px; color: #f59e0b; display: block; margin-bottom: 20px;"></i>
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
  const limiteMembros = document.getElementById('limiteMembros');
  const sobreEquipe = document.getElementById('sobreEquipe');
  const feedbackMsg = document.getElementById('feedbackMsgEquipe');

  let logoDataUrl = ''; // guarda a imagem em base64

  // ========= PREVIEW LOGO =========
  if (logoInput) {
    logoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        logoDataUrl = '';
        logoPreview.innerHTML = '<span>Nenhuma imagem selecionada</span>';
        return;
      }

      try {
        let compressed = '';
        if (window.comprimirImagemCanvas) {
          compressed = await window.comprimirImagemCanvas(file, 200, 200, 0.6);
        } else {
          compressed = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                let w = img.width, h = img.height;
                const ratio = Math.min(200 / w, 200 / h, 1);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#141419';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', 0.6));
              };
              img.onerror = () => resolve(ev.target.result);
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          });
        }

        logoDataUrl = compressed;
        logoPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = logoDataUrl;
        logoPreview.appendChild(img);
      } catch (err) {
        console.warn('Erro ao comprimir logo da equipe:', err);
      }
    });
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

  // ========= CRIAÇÃO DA EQUIPE COM SUPABASE =========
  if (form) {
    let clickedByButton = false;
    const submitBtn = document.getElementById('btnCriarEquipe') || form.querySelector('button[type="submit"]');

    // Intercepta a tecla Enter nos campos de texto (input) para evitar envio acidental
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.tagName.toLowerCase() === 'input') {
        e.preventDefault();
        return false;
      }
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        clickedByButton = true;
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Envio permitido apenas quando o usuário clicar diretamente no botão Criar Equipe
      if (!clickedByButton) {
        return;
      }
      clickedByButton = false;

      const nomeLimpo = nomeEquipe.value.trim();
      if (!nomeLimpo) {
        feedbackMsg.textContent = 'Dê um nome para a sua equipe antes de continuar.';
        feedbackMsg.style.color = '#fecaca';
        nomeEquipe.focus();
        return;
      }

      const loggedUser = getLoggedUser();
      const id = 'team-' + Date.now();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Criando equipe...';
      }

      feedbackMsg.textContent = 'Criando sua equipe...';
      feedbackMsg.style.color = '#ffffff';

      const novaEquipe = {
        id,
        nome: nomeEquipe.value.trim(),
        tag: tagEquipe.value.trim(),
        jogos: jogosEquipe.value.trim(),
        plataforma: plataformaEquipe.value,
        regiao: regiaoEquipe.value.trim(),
        limite: limiteMembros.value,
        sobre: sobreEquipe.value.trim() || 'Nenhuma descrição informada.',
        logo: logoDataUrl || '/image/logo.png',

        // Atrelado ao usuário logado (líder)
        leaderName: loggedUser?.nome || 'Líder',
        leaderAvatar: loggedUser?.avatar || '/image/boneco_logo_ofc.png',
        leaderEmail: loggedUser?.email || '',

        torneiosGanhos: [],
        torneiosAtuais: [],
        link: '/equipes/template_equipe.html?id=' + encodeURIComponent(id)
      };

      try {
        // 1. Inserir no Supabase (tabela equipes)
        const { data, error } = await supabase
          .from('equipes')
          .insert([novaEquipe])
          .select()
          .single();

        if (error) {
          console.error('Erro ao inserir equipe no Supabase:', error);
          feedbackMsg.textContent = 'Erro ao salvar equipe: ' + (error.message || 'Tente novamente.');
          feedbackMsg.style.color = '#fecaca';
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Criar Equipe';
          }
          return;
        }

        // 2. Sincronizar cache local para compatibilidade imediata com as telas de visualização
        try {
          const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS) || '[]');
          const lista = (Array.isArray(raw) ? raw : []).filter(e => e );
          lista.push(novaEquipe);
          localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(lista));
        } catch (storageErr) {
          console.warn('Cache local não atualizado:', storageErr);
        }

        const teamUrl = `/equipes/template_equipe.html?id=${encodeURIComponent(novaEquipe.id)}`;
        
        // Exibe mensagem informativa na página com as opções requeridas
        feedbackMsg.innerHTML = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 14px; padding: 18px 22px; margin-top: 16px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 100%; box-sizing: border-box;">
            <p style="color: #6ee7b7; font-size: 16px; font-weight: 700; margin: 0 0 14px 0;">
              <i class="fa-solid fa-circle-check"></i> Equipe "${escapeHtml(novaEquipe.nome)}" criada com sucesso!
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <a href="${teamUrl}" style="display: inline-flex; align-items: center; gap: 8px; background: #059669; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; transition: background 0.2s;">
                <i class="fa-solid fa-users"></i> Ver Minha Equipe
              </a>
              <a href="/ranking.html" style="display: inline-flex; align-items: center; gap: 8px; background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; transition: background 0.2s;">
                <i class="fa-solid fa-trophy"></i> Recrutar Jogadores no Ranking
              </a>
            </div>
          </div>
        `;
        feedbackMsg.style.display = 'block';

        // Exibe modal de incentivo pós-criação
        exibirModalSucessoEquipe(novaEquipe);
      } catch (err) {
        console.error('Erro inesperado ao criar equipe:', err);
        feedbackMsg.textContent = 'Ocorreu um erro ao salvar a equipe.';
        feedbackMsg.style.color = '#fecaca';
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Criar Equipe';
        }
      }
    });
  }
});


function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exibirModalSucessoEquipe(equipe) {
  let modal = document.getElementById('modalSucessoEquipe');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalSucessoEquipe';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
    document.body.appendChild(modal);
  }

  const teamUrl = `/equipes/template_equipe.html?id=${encodeURIComponent(equipe.id)}`;

  modal.innerHTML = `
    <div style="background: #111118; border: 1px solid #28283a; border-radius: 20px; width: 100%; max-width: 480px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; text-align: center; animation: modalPop 0.25s ease;">
      <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.05) 100%); padding: 32px 24px 20px; border-bottom: 1px solid #232332;">
        <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 0 25px rgba(16, 185, 129, 0.4);">
          <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 36px;"></i>
        </div>
        <h2 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">Equipe Criada com Sucesso!</h2>
        <p style="color: #9ca3af; font-size: 14.5px; margin: 0; line-height: 1.5;">
          A equipe <strong style="color: #ffffff;">"${escapeHtml(equipe.nome)}"</strong> está pronta para competir no VersusHub.
        </p>
      </div>
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 12px;">
        <a href="${teamUrl}" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 13px 20px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35); transition: transform 0.15s;">
          <i class="fa-solid fa-users"></i> Ver Minha Equipe
        </a>
        <a href="/ranking.html" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #ffffff; padding: 13px 20px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.35); transition: transform 0.15s;">
          <i class="fa-solid fa-trophy"></i> Recrutar Jogadores no Ranking
        </a>
        <a href="/perfil/perfil.html" style="color: #9ca3af; font-size: 13px; text-decoration: none; margin-top: 6px; padding: 4px;">
          Ir para meu perfil &rarr;
        </a>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}
