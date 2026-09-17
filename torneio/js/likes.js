// /torneio/js/likes.js
// Sistema de curtidas assíncrono sincronizado com o Supabase
import { supabase } from '/supabaseClient.js';

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".like-btn");
  if (!btn) return;

  const torneioId = btn.dataset.id; // ex: "cerrado-cup-csgo"
  const countSpan = btn.querySelector(".like-count");

  // Obter usuário autenticado
  const loggedUserRaw = localStorage.getItem("vh_loggedUser");
  let loggedUser = null;
  if (loggedUserRaw) {
    try {
      loggedUser = JSON.parse(loggedUserRaw);
    } catch (e) {
      loggedUser = null;
    }
  }

  // Carrega contagem e status do usuário diretamente do Supabase
  async function carregarCurtidasSupabase() {
    try {
      // 1. Contagem total de curtidas do torneio
      const { count, error } = await supabase
        .from('curtidas')
        .select('*', { count: 'exact', head: true })
        .eq('torneio_id', torneioId);

      if (!error && count !== null) {
        countSpan.textContent = count;
      }

      // 2. Verificar se o usuário atual já curtiu
      if (loggedUser && loggedUser.email) {
        const { data: curtida, error: userError } = await supabase
          .from('curtidas')
          .select('id')
          .eq('torneio_id', torneioId)
          .eq('user_email', loggedUser.email)
          .maybeSingle();

        if (!userError && curtida) {
          btn.classList.add("liked");
        } else {
          btn.classList.remove("liked");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar curtidas do Supabase:", err);
    }
  }

  carregarCurtidasSupabase();

  // Clique de curtir / descurtir
  btn.addEventListener("click", async () => {
    // Verificação de autenticação
    if (!loggedUser || !loggedUser.email) {
      showAuthToast("Faça login para curtir este torneio!");
      return;
    }

    const isLiked = btn.classList.contains("liked");
    let currentCount = parseInt(countSpan.textContent) || 0;

    // Atualização otimista na tela
    if (isLiked) {
      btn.classList.remove("liked");
      currentCount = Math.max(0, currentCount - 1);
    } else {
      btn.classList.add("liked");
      currentCount += 1;
    }
    countSpan.textContent = currentCount;

    try {
      if (isLiked) {
        // Remover curtida no Supabase
        const { error } = await supabase
          .from('curtidas')
          .delete()
          .eq('torneio_id', torneioId)
          .eq('user_email', loggedUser.email);

        if (error) {
          console.error("Erro ao remover curtida no Supabase:", error);
          // Reverte visual em caso de falha
          btn.classList.add("liked");
          countSpan.textContent = currentCount + 1;
        }
      } else {
        // Inserir curtida no Supabase
        const { error } = await supabase
          .from('curtidas')
          .insert([{
            torneio_id: torneioId,
            user_email: loggedUser.email
          }]);

        if (error) {
          console.error("Erro ao registrar curtida no Supabase:", error);
          // Reverte visual em caso de falha
          btn.classList.remove("liked");
          countSpan.textContent = Math.max(0, currentCount - 1);
        }
      }
    } catch (err) {
      console.error("Erro ao sincronizar curtida com Supabase:", err);
    }
  });

  // Toast de autenticação
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
        <i class="fa-solid fa-lock" style="font-size: 18px; color: #ff7300;"></i>
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

