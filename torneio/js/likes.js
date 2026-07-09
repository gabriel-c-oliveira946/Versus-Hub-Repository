// /torneio/js/likes.js
// sistema de like por torneio (um "YouTubezinho" local)

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".like-btn");
  if (!btn) return; // se não tiver botão, não faz nada

  const torneioId = btn.dataset.id; // ex: "cerrado-cup-csgo"
  const countSpan = btn.querySelector(".like-count");

  // Verificar se há usuário logado
  const loggedUserRaw = localStorage.getItem("vh_loggedUser");
  let loggedUser = null;
  if (loggedUserRaw) {
    try {
      loggedUser = JSON.parse(loggedUserRaw);
    } catch (e) {
      loggedUser = null;
    }
  }

  // Se houver usuário logado, vamos carregar as curtidas específicas desse usuário
  let userLikes = {};
  if (loggedUser && loggedUser.email) {
    try {
      userLikes = JSON.parse(localStorage.getItem(`vh_userLikes_${loggedUser.email}`) || "{}");
    } catch (e) {
      userLikes = {};
    }
  }

  // Se o usuário logado curtiu este torneio, marca o botão como liked
  if (loggedUser && userLikes[torneioId]) {
    btn.classList.add("liked");
  }

  // O contador de likes total do torneio é global
  let globalLikes = {};
  try {
    globalLikes = JSON.parse(localStorage.getItem("vh_torneioLikeCounts") || "{}");
  } catch (e) {
    globalLikes = {};
  }

  // Se não houver contador global iniciado para este torneio, vamos ler do antigo vh_torneioLikes para compatibilidade
  if (globalLikes[torneioId] === undefined) {
    try {
      const oldLikes = JSON.parse(localStorage.getItem("vh_torneioLikes") || "{}");
      globalLikes[torneioId] = oldLikes[torneioId]?.count ?? 0;
    } catch (e) {
      globalLikes[torneioId] = 0;
    }
  }

  const initialCount = globalLikes[torneioId] ?? 0;
  countSpan.textContent = initialCount;

  btn.addEventListener("click", () => {
    // --- VERIFICAÇÃO DE LOGIN ---
    if (!loggedUser || !loggedUser.email) {
      showAuthToast("Faça login para curtir este torneio!");
      return;
    }

    let currentCount = parseInt(countSpan.textContent) || 0;

    if (btn.classList.contains("liked")) {
      // DESCURTIR
      btn.classList.remove("liked");
      currentCount = Math.max(currentCount - 1, 0);
      userLikes[torneioId] = false;
    } else {
      // CURTIR
      btn.classList.add("liked");
      currentCount += 1;
      userLikes[torneioId] = true;
    }

    countSpan.textContent = currentCount;
    globalLikes[torneioId] = currentCount;

    localStorage.setItem(`vh_userLikes_${loggedUser.email}`, JSON.stringify(userLikes));
    localStorage.setItem("vh_torneioLikeCounts", JSON.stringify(globalLikes));
  });

  // Função auxiliar para exibir o toast de autenticação de forma elegante
  function showAuthToast(message) {
    let toast = document.getElementById("vh-auth-toast");
    if (toast) {
      toast.remove();
    }

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
        <span style="font-size: 20px;">🔒</span>
        <span style="font-weight: 600; font-size: 14px;">${message}</span>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 4px;">
        <a href="/login/login.html" style="background: #d41111; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-align: center; flex: 1;">Entrar</a>
        <button id="close-toast-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex: 1;">Fechar</button>
      </div>
    `;

    document.body.appendChild(toast);

    if (!document.getElementById("vh-toast-style")) {
      const style = document.createElement("style");
      style.id = "vh-toast-style";
      style.innerHTML = `
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { transform: scale(0.9); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

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
});
