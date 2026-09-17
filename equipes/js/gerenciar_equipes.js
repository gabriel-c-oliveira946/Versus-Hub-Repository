// /equipes/js/gerenciar_equipes.js
import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  let loggedUser = null;
  try {
    const raw = localStorage.getItem('vh_loggedUser');
    if (raw) loggedUser = JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler usuário logado:', err);
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
      // 1. Busca no Supabase
      const { data: dbTeams, error } = await supabase
        .from('equipes')
        .select('*')
        .or(`leaderEmail.eq.${userEmail},leaderName.eq.${loggedUser.nome}`);

      let list = dbTeams || [];

      // 2. Mescla com cache local vh_createdTeams
      const rawLocal = localStorage.getItem('vh_createdTeams');
      if (rawLocal) {
        try {
          const localTeams = JSON.parse(rawLocal);
          localTeams.forEach(loc => {
            const locLeaderEmail = (loc.leaderEmail || '').toLowerCase().trim();
            const locLeaderName = (loc.leaderName || '').toLowerCase().trim();
            const isLeader = (locLeaderEmail && locLeaderEmail === userEmail) || (locLeaderName && locLeaderName === userNome);
            if (isLeader && !list.some(t => String(t.id) === String(loc.id))) {
              list.push(loc);
            }
          });
        } catch (e) {
          console.warn('Erro ao mesclar equipes locais:', e);
        }
      }

      equipesLideradas = list;

      if (equipesLideradas.length === 0) {
        minhasEquipesList.innerHTML = `
          <div class="empty-state-box">
            <i class="fa-solid fa-shield-halved"></i>
            Você não lidera nenhuma equipe no momento.
          </div>
        `;
        renderEmptyDetailsPanel();
        return;
      }

      minhasEquipesList.innerHTML = '';
      equipesLideradas.forEach(eq => {
        const card = document.createElement('div');
        card.className = `team-select-card ${equipeSelecionada && String(equipeSelecionada.id) === String(eq.id) ? 'active' : ''}`;
        card.setAttribute('data-id', eq.id);

        card.innerHTML = `
          <div class="team-select-info">
            <img referrerpolicy="no-referrer" src="${eq.logo || '/image/logo.png'}" alt="${eq.nome}" class="team-select-logo" onerror="this.src='/image/logo.png'">
            <div class="team-select-text">
              <h4>${eq.nome} ${eq.tag ? `<span style="color:#ef4444; font-size:12px;">[${eq.tag}]</span>` : ''}</h4>
              <p>${eq.jogos || 'Multi-jogos'}</p>
            </div>
          </div>
          <button type="button" class="btn-team-delete" title="Excluir Equipe Permanentemente" data-id="${eq.id}">
            <i class="fa-solid fa-trash-can"></i> Excluir
          </button>
        `;

        // Clique no card para selecionar equipe
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-team-delete')) return;
          selecionarEquipe(eq);
        });

        // Clique no botão excluir
        const btnDelete = card.querySelector('.btn-team-delete');
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          confirmarExclusaoEquipe(eq);
        });

        minhasEquipesList.appendChild(card);
      });

      // Se nenhuma estiver selecionada ou a selecionada sumiu, seleciona a primeira
      if (!equipeSelecionada || !equipesLideradas.some(t => String(t.id) === String(equipeSelecionada.id))) {
        selecionarEquipe(equipesLideradas[0]);
      } else {
        // Atualiza a referência
        const updated = equipesLideradas.find(t => String(t.id) === String(equipeSelecionada.id));
        if (updated) selecionarEquipe(updated);
      }
    } catch (err) {
      console.warn('Aviso de rede ao carregar equipes do Supabase:', err);

      // Tenta recuperar ao menos as equipes do cache local
      try {
        const rawLocal = localStorage.getItem('vh_createdTeams');
        if (rawLocal) {
          const localTeams = JSON.parse(rawLocal);
          equipesLideradas = localTeams.filter(loc => {
            const locLeaderEmail = (loc.leaderEmail || '').toLowerCase().trim();
            const locLeaderName = (loc.leaderName || '').toLowerCase().trim();
            return (locLeaderEmail && locLeaderEmail === userEmail) || (locLeaderName && locLeaderName === userNome);
          });
        }
      } catch (e) {}

      if (equipesLideradas.length > 0) {
        minhasEquipesList.innerHTML = '';
        equipesLideradas.forEach(eq => {
          const card = document.createElement('div');
          card.className = `team-select-card ${equipeSelecionada && String(equipeSelecionada.id) === String(eq.id) ? 'active' : ''}`;
          card.innerHTML = `
            <img referrerpolicy="no-referrer" src="${eq.logo || '/image/logo.png'}" alt="${eq.nome}" onerror="this.src='/image/logo.png'">
            <div class="team-select-info">
              <h3>${eq.nome} ${eq.tag ? `[${eq.tag}]` : ''}</h3>
              <p>${eq.jogos || 'Geral'} • ${eq.plataforma || 'Todas'}</p>
            </div>
          `;
          card.addEventListener('click', () => selecionarEquipe(eq));
          minhasEquipesList.appendChild(card);
        });
        selecionarEquipe(equipesLideradas[0]);
      } else {
        minhasEquipesList.innerHTML = `
          <div class="empty-state-box">
            <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i>
            Você não lidera nenhuma equipe ou está offline.
          </div>
        `;
      }
    }
  }

  // ==============================================================================
  // 2. EXCLUIR EQUIPE (COM CONFIRMAÇÃO E SINCRONIZAÇÃO COMPLETA)
  // ==============================================================================
  async function confirmarExclusaoEquipe(equipe) {
    const confirmacao = window.confirm(`Atenção: Deseja realmente excluir a equipe "${equipe.nome}"?\n\nEsta ação apagará permanentemente a equipe e todas as suas solicitações de membros associadas.`);
    if (!confirmacao) return;

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

      // 3. Remove de vh_createdTeams do localStorage
      try {
        const allCreated = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
        const filtered = allCreated.filter(t => String(t.id) !== String(equipe.id));
        localStorage.setItem('vh_createdTeams', JSON.stringify(filtered));
      } catch (e) {
        console.warn('Erro ao atualizar localStorage de equipes:', e);
      }

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
        .select('*')
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
        .select('*')
        .in('id', teamIds);

      const mapaEquipes = {};
      if (dbEqs) {
        dbEqs.forEach(t => { mapaEquipes[t.id] = t; });
      }

      // Fallback em localStorage
      const allCreated = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
      allCreated.forEach(t => {
        if (!mapaEquipes[t.id]) mapaEquipes[t.id] = t;
      });

      equipesQueParticipoList.innerHTML = '';

      mems.forEach(m => {
        const eq = mapaEquipes[m.equipe_id] || { nome: 'Equipe ' + m.equipe_id, logo: '/image/logo.png', leaderName: 'Líder' };

        const card = document.createElement('div');
        card.className = 'team-select-card';
        card.innerHTML = `
          <div class="team-select-info">
            <img referrerpolicy="no-referrer" src="${eq.logo || '/image/logo.png'}" alt="${eq.nome}" class="team-select-logo" onerror="this.src='/image/logo.png'">
            <div class="team-select-text">
              <h4>${eq.nome}</h4>
              <p>Líder: ${eq.leaderName || 'Não informado'}</p>
            </div>
          </div>
          <button type="button" class="btn-team-leave" title="Sair desta equipe" data-memid="${m.id}" data-nome="${eq.nome}">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Sair
          </button>
        `;

        const btnLeave = card.querySelector('.btn-team-leave');
        btnLeave.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmar = window.confirm(`Deseja realmente sair da equipe "${eq.nome}"?`);
          if (!confirmar) return;

          try {
            await supabase.from('membros_equipe').delete().eq('id', m.id);
            showToast(`Você saiu da equipe "${eq.nome}".`);
            carregarEquipesQueParticipo();
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
          <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i>
          Erro ao carregar equipes.
        </div>
      `;
    }
  }

  // ==============================================================================
  // 4. PAINEL DA EQUIPE SELECIONADA
  // ==============================================================================
  function renderEmptyDetailsPanel() {
    teamDetailsPanel.innerHTML = `
      <div class="empty-state-box" style="padding: 60px 20px;">
        <i class="fa-solid fa-shield-halved" style="font-size: 40px; color: #4b5563; margin-bottom: 14px;"></i>
        <h3 style="color: #f3f4f6; font-size: 18px; margin-bottom: 6px;">Nenhuma equipe selecionada</h3>
        <p style="color: #9ca3af; max-width: 400px; margin: 0 auto 18px;">Crie uma nova equipe para começar a recrutar membros e participar de torneios exclusivos.</p>
        <a href="/cria_equipe/criar_equipe.html" class="btn-edit-team" style="display: inline-flex; text-decoration: none;">
          <i class="fa-solid fa-plus"></i> Criar Equipe Agora
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
        </div>
      </div>

      <!-- Seção: Membros Atuais -->
      <div class="panel-sub-header">
        <h3><i class="fa-solid fa-users" style="color: #60a5fa;"></i> Integrantes da Equipe <span class="count-badge" id="badgeTotalMembros">0</span></h3>
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

    // Botão de editar
    const btnAbrirModalEdit = document.getElementById('btnAbrirModalEdit');
    if (btnAbrirModalEdit) {
      btnAbrirModalEdit.addEventListener('click', () => abrirModalEdicao(equipe));
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
        .select('*')
        .eq('equipe_id', equipe.id);

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

      // Membros aceitos
      if (aceitos.length > 0) {
        aceitos.forEach(m => {
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
                <i class="fa-solid fa-user-xmark"></i> Expulsar da Equipe
              </button>
            </div>
          `;

          const btnKick = card.querySelector('.btn-kick-member');
          btnKick.addEventListener('click', async () => {
            const confirmKick = window.confirm(`Tem certeza que deseja expulsar "${nome}" da equipe "${equipe.nome}"?`);
            if (!confirmKick) return;

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

      if (badgeMembers) {
        badgeMembers.textContent = String(1 + aceitos.length);
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

          // Botão Aceitar
          const btnAccept = card.querySelector('.btn-accept-request');
          btnAccept.addEventListener('click', async () => {
            btnAccept.disabled = true;
            try {
              const { error: updErr } = await supabase
                .from('membros_equipe')
                .update({ status: 'Aceito' })
                .eq('id', p.id);

              if (updErr) {
                showToast('Erro ao aceitar solicitação.', 'error');
                btnAccept.disabled = false;
                return;
              }

              showToast(`Solicitação de "${nome}" aceita! O usuário agora é membro da equipe.`);
              await carregarMembrosESolicitacoes(equipe);
            } catch (err) {
              console.error('Erro ao aceitar:', err);
              showToast('Erro ao processar.', 'error');
              btnAccept.disabled = false;
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
  function abrirModalEdicao(equipe) {
    document.getElementById('editTeamId').value = equipe.id;
    document.getElementById('editTeamNome').value = equipe.nome || '';
    document.getElementById('editTeamTag').value = equipe.tag || '';
    document.getElementById('editTeamJogos').value = equipe.jogos || '';
    document.getElementById('editTeamLogo').value = equipe.logo || '';
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
      const novoLogo = document.getElementById('editTeamLogo').value.trim() || '/image/logo.png';
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

        // 2. Atualiza no localStorage vh_createdTeams
        try {
          const allCreated = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
          const idx = allCreated.findIndex(t => String(t.id) === String(teamId));
          if (idx !== -1) {
            allCreated[idx] = { ...allCreated[idx], ...updatePayload };
            localStorage.setItem('vh_createdTeams', JSON.stringify(allCreated));
          }
        } catch (e) {
          console.warn('Erro ao sincronizar localStorage de equipes:', e);
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
