// /equipes/js/gerenciar_equipes.js
import { supabase, enviarNotificacao } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  let loggedUser = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      const raw = localStorage.getItem('vh_loggedUser');
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
        localStorage.setItem('vh_loggedUser', JSON.stringify(loggedUser));
      }
    }
  } catch (err) {
    console.warn('Aviso ao ler usuário autenticado no Supabase:', err);
  }

  if (!loggedUser || !loggedUser.email) {
    const container = document.querySelector('.manage-teams-page');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #121217; border-radius: 16px; border: 1px solid #23232e; max-width: 540px; margin: 60px auto; box-shadow: 0 15px 35px rgba(0,0,0,0.5);">
          <i class="fa-solid fa-lock" style="font-size: 48px; color: #ff3b30; margin-bottom: 18px; display: block;"></i>
          <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">Acesso Restrito</h2>
          <p style="font-size: 15px; color: #9ca3af; margin-bottom: 24px; line-height: 1.5;">Você precisa estar conectado à sua conta VersusHub para gerenciar suas equipes.</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <a href="/login/login.html" style="background: #ff3b30; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">Entrar na Conta</a>
            <a href="/pagina_inicial/index.html" style="background: #20202a; color: #e5e7eb; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #2c2c3d;">Página Inicial</a>
          </div>
        </div>
      `;
    }
    return;
  }

  const userEmail = (loggedUser.email || '').toLowerCase().trim();
  const userNome  = (loggedUser.nome || '').toLowerCase().trim();

  const minhasEquipesList = document.getElementById('minhasEquipesList');
  const equipesQueParticipoList = document.getElementById('equipesQueParticipoList');
  const teamDetailsPanel = document.getElementById('teamDetailsPanel');

  let equipesLideradas = [];
  let equipeSelecionada = null;

  // Modal de edição
  const modalEditarEquipe = document.getElementById('modalEditarEquipe');
  const formEditTeam = document.getElementById('formEditTeam');
  const btnFecharModalEdit = document.getElementById('btnFecharModalEdit');
  const btnCancelarModalEdit = document.getElementById('btnCancelarModalEdit');

  function showToast(message, type = 'success') {
    let toast = document.getElementById('manageToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'manageToast';
      toast.style.position = 'fixed';
      toast.style.bottom = '24px';
      toast.style.right = '24px';
      toast.style.padding = '12px 20px';
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
      toast.style.zIndex = '999999';
      toast.style.fontSize = '14px';
      toast.style.fontWeight = '600';
      toast.style.transition = 'all 0.3s ease';
      document.body.appendChild(toast);
    }

    if (type === 'error') {
      toast.style.background = '#1a1012';
      toast.style.color = '#ef4444';
      toast.style.border = '1px solid #ef4444';
    } else {
      toast.style.background = '#0e1c16';
      toast.style.color = '#10b981';
      toast.style.border = '1px solid #10b981';
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==============================================================================
  // MODAL DE CONFIRMAÇÃO DIRETO NA TELA (INTERFACIAL, ELEGANTE E AMIGÁVEL)
  // Substitui completamente alerts e confirms do navegador
  // ==============================================================================
  function abrirModalConfirmacao({
    titulo = 'Confirmar Ação',
    icone = 'fa-solid fa-triangle-exclamation',
    tipoIcone = 'danger',
    mensagem = '',
    subtexto = '',
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    iconeConfirmar = ''
  }) {
    return new Promise((resolve) => {
      const anterior = document.getElementById('modalConfirmacaoAcao');
      if (anterior) anterior.remove();

      const overlay = document.createElement('div');
      overlay.id = 'modalConfirmacaoAcao';
      overlay.className = 'modal-confirm-overlay';

      overlay.innerHTML = `
        <div class="modal-confirm-card" role="dialog" aria-modal="true" aria-labelledby="modalConfirmTitle">
          <button type="button" class="modal-confirm-close-btn" id="btnConfirmModalClose" aria-label="Fechar">&times;</button>
          <div class="modal-confirm-icon-box ${tipoIcone}">
            <i class="${icone}"></i>
          </div>
          <h3 id="modalConfirmTitle" class="modal-confirm-title">${titulo}</h3>
          <div class="modal-confirm-message">
            <p style="margin: 0;">${mensagem}</p>
            ${subtexto ? `<div class="modal-confirm-subtext ${tipoIcone === 'warning' ? 'warning-subtext' : ''}"><i class="fa-solid fa-circle-exclamation"></i><span>${subtexto}</span></div>` : ''}
          </div>
          <div class="modal-confirm-actions">
            <button type="button" class="btn-modal-cancel" id="btnConfirmModalCancel">${textoCancelar}</button>
            <button type="button" class="btn-modal-confirm-danger ${tipoIcone === 'warning' ? 'btn-modal-warning' : ''}" id="btnConfirmModalOk">
              ${iconeConfirmar ? `<i class="${iconeConfirmar}"></i>` : ''} <span>${textoConfirmar}</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        overlay.classList.add('active');
      });

      const btnOk = overlay.querySelector('#btnConfirmModalOk');
      const btnCancel = overlay.querySelector('#btnConfirmModalCancel');
      const btnClose = overlay.querySelector('#btnConfirmModalClose');

      let resolvido = false;

      function fechar(resultado) {
        if (resolvido) return;
        resolvido = true;
        overlay.classList.remove('active');
        document.removeEventListener('keydown', onKeyDown);
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(resultado);
        }, 220);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          fechar(false);
        }
      }

      document.addEventListener('keydown', onKeyDown);

      btnCancel.addEventListener('click', (e) => {
        e.stopPropagation();
        fechar(false);
      });

      if (btnClose) {
        btnClose.addEventListener('click', (e) => {
          e.stopPropagation();
          fechar(false);
        });
      }

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          fechar(false);
        }
      });

      btnOk.addEventListener('click', (e) => {
        e.stopPropagation();
        btnOk.disabled = true;
        btnCancel.disabled = true;
        btnOk.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processando...`;
        fechar(true);
      });

      setTimeout(() => {
        if (btnOk) btnOk.focus();
      }, 50);
    });
  }

  // ==============================================================================
  // 1. CARREGAR EQUIPES LIDERADAS
  // ==============================================================================
  async function carregarEquipesLideradas() {
    minhasEquipesList.innerHTML = `
      <div class="empty-state-box">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 20px; color: #ff3b30; margin-bottom: 8px;"></i>
        Carregando suas equipes...
      </div>
    `;
    try {
      // Consulta equipes do Supabase onde o usuário logado é o líder
      let query = supabase.from('equipes').select('id, nome, tag, jogos, logo, regiao, limite, criador_email, leaderName, leaderEmail, descricao, status, created_at');
      if (userEmail && loggedUser && loggedUser.nome) {
        query = query.or(`leaderEmail.ilike.${userEmail},leaderName.ilike.${loggedUser.nome}`);
      } else if (userEmail) {
        query = query.ilike('leaderEmail', userEmail);
      } else if (loggedUser && loggedUser.nome) {
        query = query.ilike('leaderName', loggedUser.nome);
      }
      const { data: dbTeams, error } = await query;
      equipesLideradas = dbTeams || [];
    } catch (e) {
      equipesLideradas = [];
    }

    if (equipesLideradas.length > 0) {
      minhasEquipesList.innerHTML = '';
      equipesLideradas.forEach(eq => {
        const card = document.createElement('div');
        card.className = `team-select-card ${equipeSelecionada && String(equipeSelecionada.id) === String(eq.id) ? 'active' : ''}`;
        card.innerHTML = `
          <div class="team-select-info">
            <img referrerpolicy="no-referrer" src="${eq.logo || '/image/logo.png'}" alt="${eq.nome}" class="team-select-logo" onerror="this.src='/image/logo.png'">
            <div class="team-select-text">
              <h4>${eq.nome} ${eq.tag ? `<span style="color:#ef4444; font-size:12px;">[${eq.tag}]</span>` : ''}</h4>
              <p>${eq.jogos || 'Multi-jogos'}</p>
            </div>
          </div>
          <button type="button" class="btn-team-delete" title="Excluir Equipe Permanentemente" data-id="${eq.id}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        `;
        card.addEventListener('click', (ev) => {
          if (ev.target.closest('.btn-team-delete')) return;
          selecionarEquipe(eq);
        });
        const btnDel = card.querySelector('.btn-team-delete');
        if (btnDel) {
          btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmarExclusaoEquipe(eq);
          });
        }
        minhasEquipesList.appendChild(card);
      });
      selecionarEquipe(equipesLideradas[0]);
    } else {
      minhasEquipesList.innerHTML = `
        <div class="empty-state-box">
          <i class="fa-solid fa-shield-halved" style="font-size: 24px; color: #6b7280; margin-bottom: 8px; display: block;"></i>
          Você ainda não possui uma equipe.
        </div>
      `;
      renderEmptyDetailsPanel();
    }
  }

  // ==============================================================================
  // 2. EXCLUIR EQUIPE (COM CONFIRMAÇÃO DIRETO NA TELA E SINCRONIZAÇÃO COMPLETA)
  // ==============================================================================
  async function confirmarExclusaoEquipe(equipe) {
    if (!equipe) return;
    const nomeSeguro = escapeHtml(equipe.nome || 'Equipe');

    const confirmou = await abrirModalConfirmacao({
      titulo: 'Excluir Equipe',
      icone: 'fa-solid fa-trash-can',
      tipoIcone: 'danger',
      mensagem: `Deseja realmente excluir permanentemente a equipe <strong>"${nomeSeguro}"</strong>?`,
      subtexto: 'Esta ação é irreversível. A equipe, dados e todas as solicitações de membros associadas serão apagados definitivamente.',
      textoConfirmar: 'Sim, Excluir Equipe',
      textoCancelar: 'Cancelar',
      iconeConfirmar: 'fa-solid fa-trash-can'
    });

    if (!confirmou) return;

    try {
      // 1. Remove do Supabase tabela equipes
      const { error: eqErr } = await supabase
        .from('equipes')
        .delete()
        .eq('id', equipe.id);

      if (eqErr) {
        console.warn('Erro ao excluir equipe no Supabase:', eqErr);
      }

      // 2. Remove membros vinculados
      await supabase
        .from('membros_equipe')
        .delete()
        .eq('equipe_id', equipe.id);

      

      showToast(`Equipe "${equipe.nome}" excluída com sucesso!`);

      if (equipeSelecionada && String(equipeSelecionada.id) === String(equipe.id)) {
        equipeSelecionada = null;
      }

      await carregarEquipesLideradas();
    } catch (err) {
      console.error('Falha ao excluir equipe:', err);
      showToast('Ocorreu um erro ao excluir a equipe.', 'error');
    }
  }

  // ==============================================================================
  // 3. CARREGAR EQUIPES QUE PARTICIPO (MEMBRO ACEITO)
  // ==============================================================================
  async function carregarEquipesQueParticipo() {
    equipesQueParticipoList.innerHTML = `
      <div class="empty-state-box">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 20px; color: #ff3b30; margin-bottom: 8px;"></i>
        Buscando equipes...
      </div>
    `;

    try {
      // 1. Busca membresias aceitas
      const { data: mems, error: memErr } = await supabase
        .from('membros_equipe')
        .select('id, equipe_id, user_email, status, created_at')
        .eq('user_email', userEmail)
        .eq('status', 'Aceito');

      if (memErr) {
        console.warn('Erro ao buscar membros_equipe:', memErr);
      }

      if (!mems || mems.length === 0) {
        equipesQueParticipoList.innerHTML = `
          <div class="empty-state-box">
            <i class="fa-solid fa-user-group"></i>
            Você ainda não participa de nenhuma equipe como membro.
          </div>
        `;
        return;
      }

      const teamIds = mems.map(m => m.equipe_id).filter(Boolean);

      // 2. Busca detalhes das equipes
      const { data: dbEqs } = await supabase
        .from('equipes')
        .select('id, nome, tag, jogos, logo, regiao, limite, criador_email, leaderName, leaderEmail, descricao, status, created_at')
        .in('id', teamIds);

      const mapaEquipes = {};
      if (dbEqs) {
        dbEqs.forEach(t => { mapaEquipes[t.id] = t; });
      }

      

      equipesQueParticipoList.innerHTML = '';

      mems.forEach(m => {
        const rawEq = mapaEquipes[m.equipe_id];
        const eqId = rawEq?.id || m.equipe_id;
        const eq = rawEq || { id: eqId, nome: 'Equipe ' + eqId, logo: '/image/logo.png', leaderName: 'Líder' };
        const detalhesUrl = `/equipes/template_equipe.html?id=${encodeURIComponent(eqId)}`;

        const card = document.createElement('div');
        card.className = 'team-select-card';
        card.innerHTML = `
          <a href="${detalhesUrl}" class="team-select-info team-select-info-link" style="text-decoration: none; color: inherit; cursor: pointer; display: flex; align-items: center; gap: 12px; width: 100%;">
            <img referrerpolicy="no-referrer" src="${eq.logo || '/image/logo.png'}" alt="${eq.nome}" class="team-select-logo" onerror="this.src='/image/logo.png'">
            <div class="team-select-text">
              <h4 style="transition: color 0.2s ease; color: #ffffff;">${eq.nome}</h4>
              <p>Líder: ${eq.leaderName || 'Não informado'}</p>
            </div>
          </a>
          <div class="team-member-actions">
            <a href="${detalhesUrl}" class="btn-team-view-details" title="Ver detalhes da equipe">
              <i class="fa-solid fa-eye"></i> Ver Detalhes
            </a>
            <button type="button" class="btn-team-leave" title="Sair desta equipe" data-memid="${m.id}" data-nome="${eq.nome}">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Sair da Equipe
            </button>
          </div>
        `;

        const btnLeave = card.querySelector('.btn-team-leave');
        btnLeave.addEventListener('click', async (e) => {
          e.stopPropagation();
          const nomeSeguro = escapeHtml(eq.nome || 'Equipe');

          const confirmou = await abrirModalConfirmacao({
            titulo: 'Sair da Equipe',
            icone: 'fa-solid fa-arrow-right-from-bracket',
            tipoIcone: 'warning',
            mensagem: `Deseja realmente sair da equipe <strong>"${nomeSeguro}"</strong>?`,
            subtexto: 'Você deixará de ser integrante desta equipe e sua participação nela será encerrada.',
            textoConfirmar: 'Sim, Sair da Equipe',
            textoCancelar: 'Cancelar',
            iconeConfirmar: 'fa-solid fa-arrow-right-from-bracket'
          });

          if (!confirmou) return;

          try {
            const { error: delErr } = await supabase
              .from('membros_equipe')
              .delete()
              .eq('id', m.id);

            if (delErr) {
              console.warn('Erro ao sair da equipe no Supabase:', delErr);
            }

            showToast(`Você saiu da equipe "${eq.nome}".`);
            await carregarEquipesQueParticipo();
          } catch (err) {
            console.error('Erro ao sair da equipe:', err);
            showToast('Erro ao sair da equipe.', 'error');
          }
        });

        equipesQueParticipoList.appendChild(card);
      });
    } catch (err) {
      console.error('Falha ao carregar equipes que participo:', err);
      equipesQueParticipoList.innerHTML = `
        <div class="empty-state-box">
          <i class="fa-solid fa-user-group"></i>
          Você ainda não participa de nenhuma equipe como membro.
        </div>
      `;
    }
  }

  // ==============================================================================
  // 4. PAINEL DA EQUIPE SELECIONADA
  // ==============================================================================
  function renderEmptyDetailsPanel() {
    teamDetailsPanel.innerHTML = `
      <div class="empty-state-box" style="padding: 60px 20px; text-align: center;">
        <i class="fa-solid fa-shield-halved" style="font-size: 48px; color: #4b5563; margin-bottom: 16px; display: block;"></i>
        <h3 style="color: #f3f4f6; font-size: 20px; font-weight: 700; margin-bottom: 8px;">Você ainda não possui uma equipe</h3>
        <p style="color: #9ca3af; font-size: 14px; max-width: 440px; margin: 0 auto 24px; line-height: 1.5;">Crie sua equipe personalizada agora mesmo para recrutar jogadores, gerenciar solicitações e disputar torneios no VersusHub!</p>
        <a href="/cria_equipe/criar_equipe.html" class="btn-edit-team" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 10px; background: #ff3b30; color: #ffffff;">
          <i class="fa-solid fa-plus"></i> Criar Equipe
        </a>
      </div>
    `;
  }

  function selecionarEquipe(equipe) {
    equipeSelecionada = equipe;

    // Atualiza classe active nos cards da lista
    document.querySelectorAll('.team-select-card').forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-id') === String(equipe.id));
    });

    renderPainelEquipe(equipe);
  }

  async function renderPainelEquipe(equipe) {
    // 1. Estrutura do Painel com indicador de carregamento
    teamDetailsPanel.innerHTML = `
      <div class="team-details-header">
        <div class="team-details-left">
          <img referrerpolicy="no-referrer" src="${equipe.logo || '/image/logo.png'}" alt="${equipe.nome}" class="team-banner-img" onerror="this.src='/image/logo.png'">
          <div class="team-details-text">
            <h2>${equipe.nome} ${equipe.tag ? `<span style="font-size: 14px; color: #ef4444;">[${equipe.tag}]</span>` : ''}</h2>
            <p><strong>Jogos:</strong> ${equipe.jogos || 'Não informado'} • <strong>Região:</strong> ${equipe.regiao || 'Brasil'}</p>
          </div>
        </div>
        <div class="team-actions-row">
          <button type="button" class="btn-edit-team" id="btnAbrirModalEdit">
            <i class="fa-solid fa-pen-to-square"></i> Editar Equipe
          </button>
          <a href="/equipes/template_equipe.html?id=${encodeURIComponent(equipe.id)}" class="btn-view-public" target="_blank">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Página Pública
          </a>
          <button type="button" class="btn-delete-team-panel" id="btnExcluirEquipePainel" title="Excluir equipe permanentemente">
            <i class="fa-solid fa-trash-can"></i> Excluir Equipe
          </button>
        </div>
      </div>

      <!-- Seção: Membros Atuais -->
      <div class="panel-sub-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <h3><i class="fa-solid fa-users" style="color: #60a5fa;"></i> Integrantes da Equipe <span class="count-badge" id="badgeTotalMembros">0</span></h3>
        <button type="button" class="btn-add-member" id="btnAbrirModalAddMember" style="background: #2563eb; color: #ffffff; border: 1px solid #3b82f6; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-user-plus"></i> Adicionar Integrante
        </button>
      </div>
      <div class="members-list" id="panelMembersList">
        <div class="empty-state-box">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 20px; color: #ff3b30; margin-bottom: 8px;"></i>
          Carregando integrantes...
        </div>
      </div>

      <!-- Seção: Solicitações de Entrada -->
      <div class="panel-sub-header" style="margin-top: 30px;">
        <h3><i class="fa-solid fa-user-plus" style="color: #10b981;"></i> Solicitações Pendentes <span class="count-badge" id="badgeTotalRequests">0</span></h3>
      </div>
      <div class="requests-list" id="panelRequestsList">
        <div class="empty-state-box">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 20px; color: #ff3b30; margin-bottom: 8px;"></i>
          Carregando solicitações...
        </div>
      </div>
    `;

    // Botão de adicionar integrante
    const btnAbrirModalAddMember = document.getElementById('btnAbrirModalAddMember');
    if (btnAbrirModalAddMember) {
      btnAbrirModalAddMember.addEventListener('click', () => abrirModalAdicionarMembro(equipe));
    }

    // Botão de editar
    const btnAbrirModalEdit = document.getElementById('btnAbrirModalEdit');
    if (btnAbrirModalEdit) {
      btnAbrirModalEdit.addEventListener('click', () => abrirModalEdicao(equipe));
    }

    // Botão de excluir equipe no painel
    const btnExcluirEquipePainel = document.getElementById('btnExcluirEquipePainel');
    if (btnExcluirEquipePainel) {
      btnExcluirEquipePainel.addEventListener('click', () => {
        confirmarExclusaoEquipe(equipe);
      });
    }

    // 2. Consulta membros e solicitações no Supabase
    await carregarMembrosESolicitacoes(equipe);
  }

  async function carregarMembrosESolicitacoes(equipe) {
    const membersContainer = document.getElementById('panelMembersList');
    const requestsContainer = document.getElementById('panelRequestsList');
    const badgeMembers = document.getElementById('badgeTotalMembros');
    const badgeRequests = document.getElementById('badgeTotalRequests');

    try {
      const { data: memberships, error } = await supabase
        .from('membros_equipe')
        .select('id, equipe_id, user_email, status, created_at')
        .in('equipe_id', [String(equipe.id), String(equipe.nome)]);

      if (error) {
        console.warn('Erro ao consultar membros da equipe:', error);
      }

      const allMemberships = memberships || [];

      // Separa entre membros aceitos e pendentes
      const aceitos = allMemberships.filter(m => m.status === 'Aceito');
      const pendentes = allMemberships.filter(m => m.status === 'Pendente');

      // Coleta todos os e-mails para buscar perfis na tabela 'usuarios'
      const emailsParaBuscar = [...new Set(allMemberships.map(m => (m.user_email || '').toLowerCase().trim()).filter(Boolean))];

      let usersMap = {};
      if (emailsParaBuscar.length > 0) {
        const { data: dbUsers } = await supabase
          .from('usuarios')
          .select('id, nome, email, avatar')
          .in('email', emailsParaBuscar);

        if (dbUsers) {
          dbUsers.forEach(u => {
            if (u.email) usersMap[u.email.toLowerCase()] = u;
          });
        }
      }

      // --- RENDERIZAÇÃO DOS MEMBROS ATUAIS (Líder + Aceitos) ---
      membersContainer.innerHTML = '';
      
      // Card do Líder da Equipe
      const leaderEmailNormalized = (equipe.leaderEmail || '').toLowerCase();
      const leaderUser = usersMap[leaderEmailNormalized] || {};
      const leaderNome = equipe.leaderName || leaderUser.nome || 'Líder';
      const leaderAvatar = equipe.leaderAvatar || leaderUser.avatar || '/image/boneco_logo_ofc.png';

      const leaderCard = document.createElement('div');
      leaderCard.className = 'member-item-card';
      leaderCard.innerHTML = `
        <div class="member-left">
          <img referrerpolicy="no-referrer" src="${leaderAvatar}" alt="${leaderNome}" class="member-avatar" onerror="this.src='/image/boneco_logo_ofc.png'">
          <div class="member-info">
            <h4>${leaderNome} <span class="role-badge role-leader"><i class="fa-solid fa-crown"></i> Líder</span></h4>
            <p>${equipe.leaderEmail || 'Líder da equipe'}</p>
          </div>
        </div>
        <div class="member-actions">
          <span style="font-size: 12px; color: #9ca3af; font-weight: 600;">Fundador</span>
        </div>
      `;
      membersContainer.appendChild(leaderCard);

      // Filtra aceitos sem duplicar email do líder
      const aceitosFiltrados = aceitos.filter(m => {
        const mEmail = (m.user_email || '').toLowerCase().trim();
        return !leaderEmailNormalized || mEmail !== leaderEmailNormalized;
      });

      // Membros aceitos
      if (aceitosFiltrados.length > 0) {
        aceitosFiltrados.forEach(m => {
          const mEmail = (m.user_email || '').toLowerCase();
          const uData = usersMap[mEmail] || {};
          const nome = uData.nome || m.user_email;
          const avatar = uData.avatar || '/image/boneco_logo_ofc.png';

          const card = document.createElement('div');
          card.className = 'member-item-card';
          card.innerHTML = `
            <div class="member-left">
              <img referrerpolicy="no-referrer" src="${avatar}" alt="${nome}" class="member-avatar" onerror="this.src='/image/boneco_logo_ofc.png'">
              <div class="member-info">
                <h4>${nome} <span class="role-badge role-member">Membro</span></h4>
                <p>${m.user_email}</p>
              </div>
            </div>
            <div class="member-actions">
              <button type="button" class="btn-kick-member" data-id="${m.id}" data-nome="${nome}">
                <i class="fa-solid fa-user-xmark"></i> Expulsar
              </button>
            </div>
          `;

          const btnKick = card.querySelector('.btn-kick-member');
          btnKick.addEventListener('click', async () => {
            const nomeSeguro = escapeHtml(nome);
            const eqNomeSeguro = escapeHtml(equipe.nome || 'Equipe');

            const confirmou = await abrirModalConfirmacao({
              titulo: 'Expulsar Integrante',
              icone: 'fa-solid fa-user-xmark',
              tipoIcone: 'danger',
              mensagem: `Tem certeza que deseja expulsar <strong>"${nomeSeguro}"</strong> da equipe <strong>"${eqNomeSeguro}"</strong>?`,
              subtexto: 'O integrante será removido imediatamente desta equipe.',
              textoConfirmar: 'Sim, Expulsar',
              textoCancelar: 'Cancelar',
              iconeConfirmar: 'fa-solid fa-user-xmark'
            });

            if (!confirmou) return;

            try {
              const { error: kickErr } = await supabase
                .from('membros_equipe')
                .delete()
                .eq('id', m.id);

              if (kickErr) {
                showToast('Erro ao remover membro.', 'error');
                return;
              }

              showToast(`Membro "${nome}" foi expulso da equipe.`);
              await carregarMembrosESolicitacoes(equipe);
            } catch (err) {
              console.error('Erro ao expulsar membro:', err);
              showToast('Falha na operação.', 'error');
            }
          });

          membersContainer.appendChild(card);
        });
      }

      const leaderCount = (equipe.leaderEmail || equipe.leaderName) ? 1 : 0;
      const totalMembrosAtuais = leaderCount + aceitosFiltrados.length;
      const limiteMax = parseInt(equipe.limite, 10) > 0 ? parseInt(equipe.limite, 10) : 5;

      if (badgeMembers) {
        badgeMembers.textContent = `${totalMembrosAtuais} / ${limiteMax}`;
      }

      // --- RENDERIZAÇÃO DAS SOLICITAÇÕES PENDENTES ---
      requestsContainer.innerHTML = '';
      if (badgeRequests) {
        badgeRequests.textContent = String(pendentes.length);
      }

      if (pendentes.length === 0) {
        requestsContainer.innerHTML = `
          <div class="empty-state-box">
            <i class="fa-solid fa-inbox"></i>
            Nenhuma solicitação pendente no momento.
          </div>
        `;
      } else {
        pendentes.forEach(p => {
          const pEmail = (p.user_email || '').toLowerCase();
          const uData = usersMap[pEmail] || {};
          const nome = uData.nome || p.user_email;
          const avatar = uData.avatar || '/image/boneco_logo_ofc.png';

          const card = document.createElement('div');
          card.className = 'member-item-card';
          card.innerHTML = `
            <div class="member-left">
              <img referrerpolicy="no-referrer" src="${avatar}" alt="${nome}" class="member-avatar" onerror="this.src='/image/boneco_logo_ofc.png'">
              <div class="member-info">
                <h4>${nome}</h4>
                <p>${p.user_email} • Solicitou entrada</p>
              </div>
            </div>
            <div class="member-actions">
              <button type="button" class="btn-accept-request" data-id="${p.id}" data-nome="${nome}">
                <i class="fa-solid fa-check"></i> Aceitar
              </button>
              <button type="button" class="btn-refuse-request" data-id="${p.id}" data-nome="${nome}">
                <i class="fa-solid fa-xmark"></i> Recusar
              </button>
            </div>
          `;

          // Botão Aceitar com verificação estrita de limite de vagas
          const btnAccept = card.querySelector('.btn-accept-request');
          btnAccept.addEventListener('click', async () => {
            btnAccept.disabled = true;
            btnAccept.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aceitando...';

            try {
              // 1. Verifica contagem atualizada no banco de dados para evitar estouro de vagas
              const { data: membrosAtuaisDb } = await supabase
                .from('membros_equipe')
                .select('id, user_email')
                .in('equipe_id', [String(equipe.id), String(equipe.nome)])
                .eq('status', 'Aceito');

              const currentAccepted = (membrosAtuaisDb || []).filter(m => {
                const mEmail = (m.user_email || '').toLowerCase().trim();
                return !equipe.leaderEmail || mEmail !== equipe.leaderEmail.toLowerCase().trim();
              });

              const lCount = (equipe.leaderEmail || equipe.leaderName) ? 1 : 0;
              const lotacaoAtual = lCount + currentAccepted.length;
              const maxVagas = parseInt(equipe.limite, 10) > 0 ? parseInt(equipe.limite, 10) : 5;

              if (lotacaoAtual >= maxVagas) {
                showToast(`A equipe "${equipe.nome}" já atingiu o limite de ${maxVagas} integrantes (${lotacaoAtual}/${maxVagas}). Não há vagas disponíveis para aceitar novos membros.`, 'error');
                btnAccept.disabled = false;
                btnAccept.innerHTML = '<i class="fa-solid fa-check"></i> Aceitar';
                return;
              }

              // 2. Atualiza a solicitação para Aceito e normaliza o equipe_id no Supabase
              const userEmailP = (p.user_email || p.email || '').trim();
              const { error: updErr } = await supabase
                .from('membros_equipe')
                .update({ status: 'Aceito', equipe_id: String(equipe.id) })
                .or(`id.eq.${p.id},and(user_email.eq.${userEmailP},equipe_id.eq.${equipe.id})`);

              // Atualiza status no cache local (localStorage/vh_createdTeams) para a interface atualizar imediatamente
              try {
                const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
                const tIdx = localTeams.findIndex(t => String(t.id) === String(equipe.id));
                if (tIdx !== -1) {
                  if (!localTeams[tIdx].membros) localTeams[tIdx].membros = [];
                  let achou = false;
                  if (Array.isArray(localTeams[tIdx].solicitacoes)) {
                    localTeams[tIdx].solicitacoes.forEach(s => {
                      if (String(s.id) === String(p.id) || (s.user_email && userEmailP && s.user_email.toLowerCase() === userEmailP.toLowerCase())) {
                        s.status = 'Aceito';
                        achou = true;
                      }
                    });
                  }
                  if (Array.isArray(localTeams[tIdx].membros)) {
                    localTeams[tIdx].membros.forEach(m => {
                      if (String(m.id) === String(p.id) || (m.user_email && userEmailP && m.user_email.toLowerCase() === userEmailP.toLowerCase())) {
                        m.status = 'Aceito';
                        achou = true;
                      }
                    });
                  }
                  if (!achou) {
                    localTeams[tIdx].membros.push({ ...p, status: 'Aceito', equipe_id: String(equipe.id) });
                  }
                  localStorage.setItem('vh_createdTeams', JSON.stringify(localTeams));
                }
              } catch (eLoc) {
                console.warn('Erro ao atualizar cache local vh_createdTeams:', eLoc);
              }

              const emailDestino = userEmailP.toLowerCase();
              if (emailDestino) {
                try {
                  await supabase.from('notificacoes').insert([{
                    user_email: emailDestino,
                    titulo: 'Solicitação de Equipe Aceita!',
                    mensagem: `Sua solicitação para entrar na equipe "${equipe.nome}" foi aprovada!`,
                    tipo: 'equipe',
                    link: 'gerenciar_equipes.html',
                    lida: false
                  }]);
                } catch (eNotif) {}
              }

              if (updErr) {
                console.warn('Erro de conexão/banco ao aceitar solicitação no Supabase, mantendo via cache local:', updErr);
              }

              showToast(`Solicitação de "${nome}" aceita! A equipe agora possui ${lotacaoAtual + 1}/${maxVagas} integrantes.`);
              await carregarMembrosESolicitacoes(equipe);
            } catch (err) {
              console.error('Erro ao aceitar solicitação:', err);
              showToast('Erro ao processar solicitação.', 'error');
              btnAccept.disabled = false;
              btnAccept.innerHTML = '<i class="fa-solid fa-check"></i> Aceitar';
            }
          });

          // Botão Recusar
          const btnRefuse = card.querySelector('.btn-refuse-request');
          btnRefuse.addEventListener('click', async () => {
            btnRefuse.disabled = true;
            try {
              const { error: delErr } = await supabase
                .from('membros_equipe')
                .delete()
                .eq('id', p.id);

              if (delErr) {
                showToast('Erro ao recusar solicitação.', 'error');
                btnRefuse.disabled = false;
                return;
              }

              showToast(`Solicitação de "${nome}" recusada.`);
              await carregarMembrosESolicitacoes(equipe);
            } catch (err) {
              console.error('Erro ao recusar:', err);
              showToast('Erro ao processar.', 'error');
              btnRefuse.disabled = false;
            }
          });

          requestsContainer.appendChild(card);
        });
      }
    } catch (err) {
      console.warn('Aviso de rede ao buscar membros e solicitações:', err);
      membersContainer.innerHTML = '<div class="empty-state-box">Nenhum membro registrado.</div>';
      requestsContainer.innerHTML = '<div class="empty-state-box">Nenhuma solicitação pendente.</div>';
    }
  }

  // ==============================================================================
  // 5. MODAL DE EDIÇÃO DE EQUIPE
  // ==============================================================================
  let editTeamLogoDataUrl = '';
  const editTeamLogoFileInput = document.getElementById('editTeamLogoFile');
  const editTeamLogoImg = document.getElementById('editTeamLogoImg');

  if (editTeamLogoFileInput) {
    editTeamLogoFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Selecione apenas arquivos de imagem.', 'error');
        return;
      }

      try {
        let compressedDataUrl = '';
        if (window.comprimirImagemCanvas) {
          compressedDataUrl = await window.comprimirImagemCanvas(file, 200, 200, 0.6);
        } else {
          compressedDataUrl = await new Promise((resolve) => {
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

        editTeamLogoDataUrl = compressedDataUrl;
        if (editTeamLogoImg) {
          editTeamLogoImg.src = editTeamLogoDataUrl;
        }
      } catch (err) {
        console.warn('Erro ao comprimir imagem do logo:', err);
      }
    });
  }

  
  // Modal de Convidar/Adicionar Integrante por Busca em Tempo Real
  function abrirModalAdicionarMembro(equipe) {
    const antigo = document.getElementById('modalAdicionarMembro');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalAdicionarMembro';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 480px; width: 90%; background: #161622; border: 1px solid #2b2b3d; border-radius: 14px; padding: 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); color: #f3f4f6; position: relative;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #2b2b3d; padding-bottom: 12px;">
          <h3 style="margin: 0; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-user-plus" style="color: #60a5fa;"></i> Convidar Integrante para a Equipe
          </h3>
          <button type="button" class="modal-close" id="btnFecharModalAddMember" style="background: none; border: none; color: #9ca3af; font-size: 22px; cursor: pointer;">&times;</button>
        </div>
        <p style="font-size: 13.5px; color: #9ca3af; margin-top: 0; margin-bottom: 18px; line-height: 1.5;">
          Pesquise pelo nome ou nick do jogador para enviar um convite para a equipe <strong>${equipe.nome}</strong>.
        </p>
        <div class="form-group" style="margin-bottom: 18px; position: relative;">
          <label for="inputBuscaUsuarioConvite" style="display: block; font-size: 13px; font-weight: 600; color: #e5e7eb; margin-bottom: 6px;">Buscar Jogador *</label>
          <div style="position: relative;">
            <input type="text" id="inputBuscaUsuarioConvite" placeholder="Digite o nome ou nick do jogador..." style="width: 100%; box-sizing: border-box; background: #0f0f17; border: 1px solid #2b2b3d; border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 14px;">
            <div id="dropdownResultadoBusca" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #1f1f2e; border: 1px solid #374151; border-radius: 8px; margin-top: 6px; max-height: 240px; overflow-y: auto; z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"></div>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn-cancel" id="btnCancelarAddMember" style="background: #2b2b3d; color: #d1d5db; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer;">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const fechar = () => overlay.remove();
    overlay.querySelector('#btnFecharModalAddMember').addEventListener('click', fechar);
    overlay.querySelector('#btnCancelarAddMember').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    const inputBusca = overlay.querySelector('#inputBuscaUsuarioConvite');
    const dropdown = overlay.querySelector('#dropdownResultadoBusca');

    let debounceTimer = null;

    inputBusca.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const termoBusca = (inputBusca.value || '').trim();

      if (termoBusca.length < 2) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const { data: usuariosEncontrados, error } = await supabase
            .from('usuarios')
            .select('id, nome, email, avatar')
            .or(`nome.ilike.%${termoBusca}%,email.ilike.%${termoBusca}%`)
            .limit(6);

          if (error) {
            console.error('Erro ao buscar usuários:', error);
            dropdown.style.display = 'none';
            return;
          }

          if (!usuariosEncontrados || usuariosEncontrados.length === 0) {
            dropdown.innerHTML = `<div style="padding: 12px; color: #9ca3af; font-size: 13px; text-align: center;">Nenhum usuário encontrado.</div>`;
            dropdown.style.display = 'block';
            return;
          }

          dropdown.innerHTML = usuariosEncontrados.map(user => {
            const foto = user.avatar || '/image/boneco_logo_ofc.png';
            const nome = user.nome || 'Usuário';
            const email = user.email || '';
            return `
              <div class="user-search-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #2b2b3d; cursor: pointer; gap: 12px;" data-user-email="${email}" data-user-nome="${nome}">
                <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                  <img referrerpolicy="no-referrer" src="${escapeHtml(foto)}" alt="${escapeHtml(nome)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid #374151;">
                  <div style="overflow: hidden;">
                    <div style="font-size: 14px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(nome)}</div>
                    <div style="font-size: 12px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(email)}</div>
                  </div>
                </div>
                <button type="button" class="btn-convidar-user" style="background: #2563eb; color: #ffffff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer; flex-shrink: 0;">Convidar</button>
              </div>
            `;
          }).join('');
          dropdown.style.display = 'block';

          dropdown.querySelectorAll('.user-search-item').forEach(item => {
            item.addEventListener('click', async (evt) => {
              evt.stopPropagation();
              const userEmail = item.getAttribute('data-user-email');
              const userNome = item.getAttribute('data-user-nome');

              if (!userEmail) {
                showToast('E-mail de usuário inválido.', 'error');
                return;
              }

              if (equipe.leaderEmail && userEmail.toLowerCase().trim() === equipe.leaderEmail.toLowerCase().trim()) {
                showToast('Você já é o líder desta equipe.', 'error');
                return;
              }

              const { error: insMemErr } = await supabase
                .from('membros_equipe')
                .insert([{
                  equipe_id: String(equipe.id),
                  user_email: userEmail,
                  status: 'Pendente'
                }]);

              if (insMemErr) {
                console.error('[VersusHub] Erro ao enviar convite:', insMemErr);
                showToast('Erro ao salvar no banco de dados remoto', 'error');
                return;
              }

              try {
                await supabase.from('notificacoes').insert([{
                  user_email: userEmail.toLowerCase().trim(),
                  titulo: 'Convite de Equipe!',
                  mensagem: `Você recebeu um convite para entrar na equipe "${equipe.nome}"!`,
                  tipo: 'equipe',
                  link: `/equipes/template_equipe.html?id=${encodeURIComponent(equipe.id)}`,
                  lida: false
                }]);
              } catch (eNotif) {
                console.warn('Aviso ao notificar usuário:', eNotif);
              }

              inputBusca.value = '';
              dropdown.style.display = 'none';
              dropdown.innerHTML = '';
              showToast(`Convite enviado para ${userNome}!`);
              fechar();
              if (typeof carregarMembrosESolicitacoes === 'function') {
                await carregarMembrosESolicitacoes(equipe);
              }
            });
          });

        } catch (err) {
          console.error('Erro ao buscar usuários:', err);
        }
      }, 300);
    });
  }

function abrirModalEdicao(equipe) {
    document.getElementById('editTeamId').value = equipe.id;
    document.getElementById('editTeamNome').value = equipe.nome || '';
    document.getElementById('editTeamTag').value = equipe.tag || '';
    document.getElementById('editTeamJogos').value = equipe.jogos || '';
    
    // Reseta estado do arquivo e carrega imagem atual no preview
    editTeamLogoDataUrl = '';
    if (editTeamLogoFileInput) editTeamLogoFileInput.value = '';
    if (editTeamLogoImg) {
      editTeamLogoImg.src = equipe.logo || '/image/logo.png';
      editTeamLogoImg.onerror = () => {
        editTeamLogoImg.src = '/image/logo.png';
      };
    }

    document.getElementById('editTeamRegiao').value = equipe.regiao || '';
    document.getElementById('editTeamSobre').value = equipe.sobre || '';

    modalEditarEquipe.style.display = 'flex';
  }

  function fecharModalEdicao() {
    modalEditarEquipe.style.display = 'none';
  }

  if (btnFecharModalEdit) btnFecharModalEdit.addEventListener('click', fecharModalEdicao);
  if (btnCancelarModalEdit) btnCancelarModalEdit.addEventListener('click', fecharModalEdicao);

  if (modalEditarEquipe) {
    modalEditarEquipe.addEventListener('click', (e) => {
      if (e.target === modalEditarEquipe) fecharModalEdicao();
    });
  }

  if (formEditTeam) {
    formEditTeam.addEventListener('submit', async (e) => {
      e.preventDefault();
      const teamId = document.getElementById('editTeamId').value;
      const novoNome = document.getElementById('editTeamNome').value.trim();
      const novaTag = document.getElementById('editTeamTag').value.trim();
      const novosJogos = document.getElementById('editTeamJogos').value.trim();
      
      // Preserva a logo anterior caso nenhum arquivo novo tenha sido enviado
      const logoAtual = (equipeSelecionada && String(equipeSelecionada.id) === String(teamId))
        ? equipeSelecionada.logo
        : (editTeamLogoImg ? editTeamLogoImg.src : '/image/logo.png');
      const novoLogo = editTeamLogoDataUrl || logoAtual || '/image/logo.png';

      const novaRegiao = document.getElementById('editTeamRegiao').value.trim() || 'Brasil';
      const novoSobre = document.getElementById('editTeamSobre').value.trim();

      const btnSave = document.getElementById('btnSalvarModalEdit');
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';

      const updatePayload = {
        nome: novoNome,
        tag: novaTag,
        jogos: novosJogos,
        logo: novoLogo,
        regiao: novaRegiao,
        sobre: novoSobre
      };

      try {
        // 1. Atualiza no Supabase
        const { error } = await supabase
          .from('equipes')
          .update(updatePayload)
          .eq('id', teamId);

        if (error) {
          console.error('Erro ao atualizar equipe no Supabase:', error);
          showToast('Erro ao salvar alterações no banco de dados.', 'error');
          btnSave.disabled = false;
          btnSave.textContent = 'Salvar Alterações';
          return;
        }

        

        // 3. Atualiza objeto em memória
        if (equipeSelecionada && String(equipeSelecionada.id) === String(teamId)) {
          Object.assign(equipeSelecionada, updatePayload);
        }

        fecharModalEdicao();
        showToast('Equipe atualizada com sucesso!');
        await carregarEquipesLideradas();
      } catch (err) {
        console.error('Falha geral na edição da equipe:', err);
        showToast('Erro inesperado ao salvar alterações.', 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Salvar Alterações';
      }
    });
  }

  // Inicializa carregamentos
  await Promise.all([
    carregarEquipesLideradas(),
    carregarEquipesQueParticipo()
  ]);
});
