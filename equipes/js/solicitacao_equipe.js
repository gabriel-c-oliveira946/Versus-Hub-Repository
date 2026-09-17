// /equipes/js/solicitacao_equipe.js
// Solicitação de ingresso em equipes conectada ao Supabase (tabela membros_equipe)

import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const joinBtn = document.querySelector('.btn-join-team');
  if (!joinBtn) return;

  // Evita registro duplicado de listeners
  if (joinBtn.dataset.solicitacaoInit) return;
  joinBtn.dataset.solicitacaoInit = 'true';

  // Se a equipe não estiver recrutando (botão desabilitado), encerra
  if (joinBtn.disabled) return;

  const teamNameEl = document.querySelector('.team-info h1') || document.querySelector('.team-hero h1');
  const teamName = teamNameEl ? teamNameEl.textContent.trim() : 'Equipe';

  const loggedUserRaw = localStorage.getItem('vh_loggedUser');
  let loggedUser = null;
  if (loggedUserRaw) {
    try {
      loggedUser = JSON.parse(loggedUserRaw);
    } catch (e) {
      loggedUser = null;
    }
  }

  // Verifica se o usuário já tem uma solicitação na tabela 'membros_equipe'
  if (loggedUser && loggedUser.email) {
    try {
      const { data, error } = await supabase
        .from('membros_equipe')
        .select('*')
        .eq('user_email', loggedUser.email)
        .eq('equipe_id', teamName);

      if (data && data.length > 0) {
        joinBtn.innerHTML = 'Pendente de Aprovação <i class="fa-solid fa-envelope" style="color: #60a5fa; margin-left: 6px;"></i>';
        joinBtn.style.background = '#22c55e';
        joinBtn.style.borderColor = '#22c55e';
      }
    } catch (err) {
      console.warn('Erro ao consultar solicitação de equipe:', err);
    }
  }

  // Clique no botão de solicitação
  joinBtn.addEventListener('click', async () => {
    const userRaw = localStorage.getItem('vh_loggedUser');
    if (!userRaw) {
      showAuthToast("Faça login para se inscrever ou entrar em equipes!");
      return;
    }

    let user;
    try {
      user = JSON.parse(userRaw);
    } catch (e) {
      showAuthToast("Faça login para se inscrever ou entrar em equipes!");
      return;
    }

    joinBtn.disabled = true;

    try {
      // 1. Verifica solicitação prévia
      const { data: existingList } = await supabase
        .from('membros_equipe')
        .select('*')
        .eq('user_email', user.email)
        .eq('equipe_id', teamName);

      const jaSolicitou = existingList && existingList.length > 0;

      if (jaSolicitou) {
        // Cancela a solicitação
        await supabase
          .from('membros_equipe')
          .delete()
          .eq('user_email', user.email)
          .eq('equipe_id', teamName);

        // Atualiza cache local
        let currentRequests = {};
        try {
          currentRequests = JSON.parse(localStorage.getItem('vh_teamJoinRequests') || '{}');
          delete currentRequests[teamName];
          localStorage.setItem('vh_teamJoinRequests', JSON.stringify(currentRequests));
        } catch (e) {}

        joinBtn.innerHTML = 'Pedir para entrar';
        joinBtn.style.background = '#d41111';
        joinBtn.style.borderColor = '#d41111';
        showNotificationToast("Solicitação de entrada cancelada.", "info");
      } else {
        // Grava no Supabase (tabela membros_equipe)
        const { error: insertError } = await supabase
          .from('membros_equipe')
          .insert([{
            equipe_id: teamName,
            user_email: user.email,
            status: 'Pendente'
          }]);

        if (insertError) {
          console.error('Erro ao enviar solicitação:', insertError);
          showNotificationToast("Não foi possível enviar a solicitação. Tente novamente.", "info");
          joinBtn.disabled = false;
          return;
        }

        // Atualiza cache local
        let currentRequests = {};
        try {
          currentRequests = JSON.parse(localStorage.getItem('vh_teamJoinRequests') || '{}');
        } catch (e) {
          currentRequests = {};
        }
        currentRequests[teamName] = {
          userEmail: user.email,
          userName: user.nome || '',
          date: new Date().toISOString()
        };
        localStorage.setItem('vh_teamJoinRequests', JSON.stringify(currentRequests));

        joinBtn.innerHTML = 'Pendente de Aprovação <i class="fa-solid fa-envelope" style="color: #60a5fa; margin-left: 6px;"></i>';
        joinBtn.style.background = '#22c55e';
        joinBtn.style.borderColor = '#22c55e';
        showNotificationToast(`Solicitação enviada para o time ${teamName}!`, "success");
      }
    } catch (err) {
      console.error('Falha ao processar solicitação de equipe:', err);
      showNotificationToast("Não foi possível processar a solicitação no momento.", "info");
    } finally {
      joinBtn.disabled = false;
    }
  });

  // Toasts visuais existentes
  function showAuthToast(message) {
    let toast = document.getElementById("vh-auth-toast");
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = "vh-auth-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.right = "30px";
    toast.style.background = "#141419";
    toast.style.color = "#ffffff";
    toast.style.border = "1px solid #d41111";
    toast.style.borderRadius = "12px";
    toast.style.padding = "16px 20px";
    toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "system-ui, sans-serif";
    toast.style.display = "flex";
    toast.style.flexDirection = "column";
    toast.style.gap = "10px";
    toast.style.maxWidth = "320px";
    toast.style.animation = "slideInRight 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards";

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-lock" style="color: #f59e0b; font-size: 18px;"></i>
        <span style="font-weight: 600; font-size: 14px;">${message}</span>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 4px;">
        <a href="/login/login.html" style="background: #d41111; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-align: center; flex: 1;">Entrar</a>
        <button id="close-toast-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex: 1;">Fechar</button>
      </div>
    `;

    document.body.appendChild(toast);
    setupToastAnimation();

    const closeBtn = toast.querySelector("#close-toast-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      });
    }

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  function showNotificationToast(message, type) {
    let toast = document.getElementById("vh-notif-toast");
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = "vh-notif-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.right = "30px";
    toast.style.background = "#141419";
    toast.style.color = "#ffffff";
    toast.style.border = type === "success" ? "1px solid #22c55e" : "1px solid #3b82f6";
    toast.style.borderRadius = "12px";
    toast.style.padding = "16px 20px";
    toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "system-ui, sans-serif";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.style.maxWidth = "320px";
    toast.style.animation = "slideInRight 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards";

    const icon = type === "success"
      ? '<i class="fa-solid fa-check" style="color: #22c55e; font-size: 18px;"></i>'
      : '<i class="fa-solid fa-circle-info" style="color: #3b82f6; font-size: 18px;"></i>';

    toast.innerHTML = `
      ${icon}
      <span style="font-size: 14px; font-weight: 500;">${message}</span>
    `;

    document.body.appendChild(toast);
    setupToastAnimation();

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }

  function setupToastAnimation() {
    if (!document.getElementById("vh-toast-styles")) {
      const style = document.createElement("style");
      style.id = "vh-toast-styles";
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
      `;
      document.head.appendChild(style);
    }
  }
});
