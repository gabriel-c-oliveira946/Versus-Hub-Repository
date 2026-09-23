// /equipes/js/solicitacao_equipe.js
// Gerenciamento e solicitação de ingresso em equipes com controle estrito de vagas
import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const joinBtn = document.querySelector('.btn-join-team');
  if (!joinBtn) return;

  // Evita duplicação de inicialização
  if (joinBtn.dataset.solicitacaoInit) return;
  joinBtn.dataset.solicitacaoInit = 'true';

  // Obtém informações da página da equipe
  const teamNameEl = document.querySelector('.team-info h1') || document.querySelector('.team-hero h1') || document.querySelector('h1');
  const teamName = teamNameEl ? teamNameEl.textContent.trim() : '';

  // Tenta extrair id da URL ou slug do pathname
  const urlParams = new URLSearchParams(window.location.search);
  let equipeIdParam = urlParams.get('id');
  if (!equipeIdParam) {
    const pathParts = window.location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1] || '';
    if (lastPart.startsWith('detalhes-')) {
      equipeIdParam = lastPart.replace('detalhes-', '').replace('.html', '');
    }
  }

  let loggedUser = null;
  try {
    const raw = localStorage.getItem('vh_loggedUser');
    if (raw) loggedUser = JSON.parse(raw);
  } catch (e) {
    loggedUser = null;
  }

  // 1. Busca dados oficiais da equipe no Supabase
  let equipe = null;
  try {
    let query = supabase.from('equipes').select('*');
    if (equipeIdParam) {
      const { data: eqData } = await query.eq('id', equipeIdParam).limit(1);
      if (eqData && eqData.length > 0) equipe = eqData[0];
    }
    if (!equipe && teamName) {
      const { data: eqDataByName } = await supabase
        .from('equipes')
        .select('*')
        .ilike('nome', teamName)
        .limit(1);
      if (eqDataByName && eqDataByName.length > 0) equipe = eqDataByName[0];
    }
  } catch (err) {
    console.warn('Aviso ao consultar equipe para controle de vagas:', err);
  }

  const equipeId = equipe ? String(equipe.id) : (equipeIdParam || teamName);
  const equipeNome = equipe ? equipe.nome : teamName;
  const limiteMax = equipe && parseInt(equipe.limite, 10) > 0 ? parseInt(equipe.limite, 10) : 5;
  const leaderEmail = equipe && equipe.leaderEmail ? String(equipe.leaderEmail).trim().toLowerCase() : '';

  // 2. Consulta membros aceitos no banco para controle de vagas
  let membrosAceitos = [];
  let userMembership = null;

  try {
    const { data: membersData } = await supabase
      .from('membros_equipe')
      .select('*')
      .in('equipe_id', [equipeId, equipeNome, equipeIdParam].filter(Boolean));

    if (membersData && Array.isArray(membersData)) {
      membrosAceitos = membersData.filter(m => m.status === 'Aceito');

      if (loggedUser && loggedUser.email) {
        const uEmail = loggedUser.email.trim().toLowerCase();
        userMembership = membersData.find(m => String(m.user_email).trim().toLowerCase() === uEmail);
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar lotação de membros:', err);
  }

  // Desconsidera email do líder na contagem de membros aceitos para não duplicar
  const aceitosSemLider = membrosAceitos.filter(m => {
    const mEmail = String(m.user_email || '').trim().toLowerCase();
    return !leaderEmail || mEmail !== leaderEmail;
  });

  const leaderCount = (leaderEmail || (equipe && (equipe.leaderName || equipe.lider))) ? 1 : 0;
  const totalMembros = leaderCount + aceitosSemLider.length;
  const isEquipeCheia = totalMembros >= limiteMax;

  // Atualiza exibição de integrantes no texto da página, se existir
  const allParagraphs = document.querySelectorAll('p');
  allParagraphs.forEach(p => {
    if (p.textContent.includes('Integrantes:')) {
      p.innerHTML = `<strong>Integrantes:</strong> ${totalMembros} / ${limiteMax}`;
    }
  });

  // 3. Define estado visual e comportamento do botão
  const isLider = Boolean(loggedUser && loggedUser.email && leaderEmail && loggedUser.email.trim().toLowerCase() === leaderEmail);

  if (isLider) {
    joinBtn.innerHTML = '<i class="fa-solid fa-list-check" style="margin-right: 6px;"></i>Gerenciar Equipe';
    joinBtn.style.background = '#4b5563';
    joinBtn.style.borderColor = '#6b7280';
    joinBtn.style.cursor = 'pointer';
    joinBtn.disabled = false;
    joinBtn.onclick = () => {
      window.location.href = '/equipes/gerenciar_equipes.html';
    };
    return;
  }

  if (userMembership && userMembership.status === 'Aceito') {
    joinBtn.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i>Integrante da Equipe';
    joinBtn.style.background = '#15803d';
    joinBtn.style.borderColor = '#16a34a';
    joinBtn.style.cursor = 'default';
    joinBtn.disabled = true;
    return;
  }

  let isPendente = Boolean(userMembership && userMembership.status === 'Pendente');

  function renderBtnState() {
    if (isPendente) {
      joinBtn.innerHTML = '<i class="fa-solid fa-clock" style="margin-right: 6px;"></i>Pendente (Clique p/ cancelar)';
      joinBtn.style.background = '#ca8a04';
      joinBtn.style.borderColor = '#eab308';
      joinBtn.style.cursor = 'pointer';
      joinBtn.disabled = false;
    } else if (isEquipeCheia) {
      joinBtn.innerHTML = '<i class="fa-solid fa-ban" style="margin-right: 6px;"></i>Equipe Cheia';
      joinBtn.style.background = '#374151';
      joinBtn.style.borderColor = '#4b5563';
      joinBtn.style.cursor = 'not-allowed';
      joinBtn.disabled = true;
    } else {
      joinBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 6px;"></i>Pedir para entrar';
      joinBtn.style.background = '#d41111';
      joinBtn.style.borderColor = '#d41111';
      joinBtn.style.cursor = 'pointer';
      joinBtn.disabled = false;
    }
  }

  renderBtnState();

  // 4. Ação de clique do botão
  joinBtn.addEventListener('click', async () => {
    if (!loggedUser || !loggedUser.email) {
      showAuthToast("Faça login para se inscrever ou entrar em equipes!");
      return;
    }

    if (isEquipeCheia && !isPendente) {
      showNotificationToast("Esta equipe já está cheia e não aceita novas solicitações.", "error");
      return;
    }

    joinBtn.disabled = true;
    const originalHtml = joinBtn.innerHTML;
    joinBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 6px;"></i>Processando...';

    try {
      if (isPendente) {
        // Cancelar solicitação
        const { error: delErr } = await supabase
          .from('membros_equipe')
          .delete()
          .eq('user_email', loggedUser.email)
          .in('equipe_id', [equipeId, equipeNome, equipeIdParam].filter(Boolean));

        if (delErr) throw delErr;

        isPendente = false;
        renderBtnState();
        showNotificationToast("Solicitação de entrada cancelada.", "info");
      } else {
        // Enviar solicitação: primeiro verifica em tempo real se a equipe não lotou
        const { data: latestAccepted } = await supabase
          .from('membros_equipe')
          .select('id, user_email')
          .in('equipe_id', [equipeId, equipeNome, equipeIdParam].filter(Boolean))
          .eq('status', 'Aceito');

        const latestAceitosSemLider = (latestAccepted || []).filter(m => {
          const mEmail = String(m.user_email || '').trim().toLowerCase();
          return !leaderEmail || mEmail !== leaderEmail;
        });

        const lotacaoMomento = leaderCount + latestAceitosSemLider.length;
        if (lotacaoMomento >= limiteMax) {
          showNotificationToast("A equipe acabou de atingir o limite máximo de vagas!", "error");
          joinBtn.innerHTML = '<i class="fa-solid fa-ban" style="margin-right: 6px;"></i>Equipe Cheia';
          joinBtn.style.background = '#374151';
          joinBtn.style.borderColor = '#4b5563';
          joinBtn.style.cursor = 'not-allowed';
          joinBtn.disabled = true;
          return;
        }

        const { error: insErr } = await supabase
          .from('membros_equipe')
          .insert([{
            equipe_id: equipeId,
            user_email: loggedUser.email,
            status: 'Pendente'
          }]);

        if (insErr) throw insErr;

        isPendente = true;
        renderBtnState();
        showNotificationToast(`Solicitação enviada com sucesso para a equipe!`, "success");
      }
    } catch (err) {
      console.error('Erro ao processar solicitação de equipe:', err);
      showNotificationToast("Não foi possível processar a solicitação no momento.", "error");
      joinBtn.innerHTML = originalHtml;
      joinBtn.disabled = false;
    }
  });

  // Toasts visuais padronizados
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

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fa-solid fa-lock" style="font-size: 18px; color: #ff3e3e;"></i>
        <span style="font-weight: 600; font-size: 14px;">${message}</span>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 4px;">
        <a href="/login/login.html" style="background: #d41111; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-align: center; flex: 1;">Entrar</a>
        <button id="close-toast-btn" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex: 1;">Fechar</button>
      </div>
    `;

    document.body.appendChild(toast);

    const closeBtn = toast.querySelector("#close-toast-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => toast.remove());
    }

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
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
    toast.style.border = type === "success" ? "1px solid #22c55e" : (type === "error" ? "1px solid #ef4444" : "1px solid #3b82f6");
    toast.style.borderRadius = "12px";
    toast.style.padding = "14px 18px";
    toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.5)";
    toast.style.zIndex = "10000";
    toast.style.fontFamily = "system-ui, sans-serif";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.style.maxWidth = "340px";

    let icon = '<i class="fa-solid fa-circle-info" style="color: #3b82f6; font-size: 18px;"></i>';
    if (type === "success") {
      icon = '<i class="fa-solid fa-circle-check" style="color: #22c55e; font-size: 18px;"></i>';
    } else if (type === "error") {
      icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 18px;"></i>';
    }

    toast.innerHTML = `
      <span>${icon}</span>
      <span style="font-weight: 600; font-size: 14px;">${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 4500);
  }
});
