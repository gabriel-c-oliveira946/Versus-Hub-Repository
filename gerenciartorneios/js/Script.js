// /gerenciartorneios/js/Script.js
// Gerenciamento completo de torneios com Supabase (Edição, Exclusão e Inscrições)

import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const rawUser = localStorage.getItem('vh_loggedUser');
  let loggedUser = null;
  if (rawUser) {
    try {
      loggedUser = JSON.parse(rawUser);
    } catch (e) {
      console.error('Erro ao ler usuário logado:', e);
    }
  }

  // Se não estiver logado, exibe aviso amigável de autenticação
  if (!loggedUser) {
    const container = document.querySelector('.manage-page');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #141419; border-radius: 20px; border: 2px solid #2a2a38; max-width: 600px; margin: 80px auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <i class="fa-solid fa-lock" style="font-size: 56px; display: block; margin-bottom: 20px; color: #ff2c2c;"></i>
          <h2 style="font-size: 28px; font-weight: 800; color: #ff2c2c; margin-bottom: 12px; font-family: system-ui, sans-serif;">Área Restrita</h2>
          <p style="font-size: 16px; color: #9ca3af; margin-bottom: 30px; line-height: 1.6; font-family: system-ui, sans-serif;">Você precisa estar logado na sua conta VersusHub para poder visualizar e gerenciar seus torneios.</p>
          <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <a href="/login/login.html" style="background: #d41111; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; transition: 0.2s;">Fazer Login</a>
            <a href="/pagina_inicial/index.html" style="background: #222230; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; border: 1px solid #353545; transition: 0.2s;">Voltar ao Início</a>
          </div>
        </div>
      `;
    }
    return;
  }

  const tabs = document.querySelectorAll('.tab-btn');
  const lista = document.getElementById('listaTorneios');
  let currentTab = 'created';

  // Cache em memória dos torneios carregados do banco
  let userCreatedTournaments = [];
  let userJoinedTournaments = [];
  let userVisitedTournaments = [];

  // ==============================================================================
  // FUNÇÕES AUXILIARES E TOAST
  // ==============================================================================

  function showToast(message, type = 'success') {
    let toast = document.getElementById('manageToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'manageToast';
      toast.style.position = 'fixed';
      toast.style.bottom = '30px';
      toast.style.right = '30px';
      toast.style.padding = '14px 24px';
      toast.style.borderRadius = '10px';
      toast.style.boxShadow = '0 12px 30px rgba(0,0,0,0.6)';
      toast.style.zIndex = '9999999';
      toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      toast.style.fontSize = '14px';
      toast.style.fontWeight = '600';
      toast.style.transition = 'all 0.3s ease';
      document.body.appendChild(toast);
    }

    if (type === 'error') {
      toast.style.background = '#1e1418';
      toast.style.color = '#ff6b6b';
      toast.style.border = '1px solid #ef4444';
    } else if (type === 'warning') {
      toast.style.background = '#221a0f';
      toast.style.color = '#f59e0b';
      toast.style.border = '1px solid #d97706';
    } else {
      toast.style.background = '#121d19';
      toast.style.color = '#34d399';
      toast.style.border = '1px solid #10b981';
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
    }, 4000);
  }

  /**
   * Verifica se o torneio já iniciou ou finalizou com base na data/hora e status
   */
  function torneioJaIniciou(torneio) {
    const agora = new Date();
    const st = (torneio.status || '').toLowerCase();

    // 1. Status explícito
    if (st.includes('andamento') || st.includes('encerrado') || st.includes('finalizado')) {
      return true;
    }

    // 2. Campo ISO
    if (torneio.inicioIso) {
      const dataIso = new Date(torneio.inicioIso);
      if (!isNaN(dataIso.getTime()) && agora >= dataIso) {
        return true;
      }
    }

    // 3. Campo de texto formatado (ex: "22/03/2026", "22/03/2026 às 20h")
    if (torneio.data) {
      const match = torneio.data.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const dia = parseInt(match[1], 10);
        const mes = parseInt(match[2], 10) - 1;
        const ano = parseInt(match[3], 10);

        let hora = 0;
        let min = 0;
        const horaMatch = torneio.data.match(/(\d{1,2})[h:](\d{2})?/i);
        if (horaMatch) {
          hora = parseInt(horaMatch[1], 10);
          if (horaMatch[2]) min = parseInt(horaMatch[2], 10);
        }

        const dataTorneio = new Date(ano, mes, dia, hora, min);
        if (!isNaN(dataTorneio.getTime()) && agora >= dataTorneio) {
          return true;
        }
      }
    }

    return false;
  }

  // ==============================================================================
  // CARREGAMENTO DOS DADOS NO SUPABASE
  // ==============================================================================

  async function carregarTorneiosCriados() {
    try {
      const { data, error } = await supabase
        .from('torneios')
        .select('*')
        .eq('criadorEmail', loggedUser.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro ao consultar torneios criados no banco:', error);
      }

      let criadosDb = data || [];

      // Une com os salvos localmente caso haja algum recente
      const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
      const userLocal = allLocal.filter(t => !t.criadorEmail || t.criadorEmail === loggedUser.email);

      userLocal.forEach(loc => {
        if (!criadosDb.some(d => String(d.id) === String(loc.id))) {
          criadosDb.push(loc);
        }
      });

      userCreatedTournaments = criadosDb;
    } catch (e) {
      console.error('Falha de conexão ao carregar torneios criados:', e);
      const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
      userCreatedTournaments = allLocal.filter(t => !t.criadorEmail || t.criadorEmail === loggedUser.email);
    }
  }

  async function carregarTorneiosInscritos() {
    try {
      const { data: inscricoesDb, error } = await supabase
        .from('inscricoes')
        .select('*')
        .eq('user_email', loggedUser.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro ao consultar inscrições:', error);
      }

      const listaInscricoes = inscricoesDb || [];
      const torneiosIds = listaInscricoes
        .map(i => i.torneio_id)
        .filter(id => id && !id.startsWith('equipe:'));

      let torneiosCarregados = [];

      if (torneiosIds.length > 0) {
        const { data: torneiosDb } = await supabase
          .from('torneios')
          .select('*')
          .in('id', torneiosIds);

        const mapaTorneios = {};
        (torneiosDb || []).forEach(t => { mapaTorneios[String(t.id)] = t; });

        torneiosCarregados = listaInscricoes
          .filter(i => !i.torneio_id.startsWith('equipe:'))
          .map(insc => {
            const t = mapaTorneios[String(insc.torneio_id)] || {};
            return {
              id: insc.torneio_id,
              nome: t.nome || insc.torneio_id,
              jogo: t.jogo || 'Livre',
              data: t.data || 'Em breve',
              status: t.status || 'Inscrição ' + insc.status,
              statusClass: t.statusClass || 'status-aberto',
              banner: t.banner || '/images/cerradocup.jpg',
              link: '/torneio/custom.html?id=' + encodeURIComponent(insc.torneio_id),
              inscricaoStatus: insc.status || 'Pendente'
            };
          });
      }

      // Une com cache local por segurança
      const localJoined = JSON.parse(localStorage.getItem(`vh_joinedTournaments_${loggedUser.email}`) || '[]');
      localJoined.forEach(loc => {
        if (!torneiosCarregados.some(j => String(j.id) === String(loc.id))) {
          torneiosCarregados.push(loc);
        }
      });

      userJoinedTournaments = torneiosCarregados;
    } catch (e) {
      console.error('Falha de conexão ao carregar inscrições:', e);
      userJoinedTournaments = JSON.parse(localStorage.getItem(`vh_joinedTournaments_${loggedUser.email}`) || '[]');
    }
  }

  function carregarTorneiosFrequentados() {
    userVisitedTournaments = JSON.parse(localStorage.getItem(`vh_visitedTournaments_${loggedUser.email}`) || '[]');
  }

  // ==============================================================================
  // AUXILIARES E SINCRONIZAÇÃO LOCAL
  // ==============================================================================

  function salvarTorneioCriadoLocal(torneio) {
    if (!torneio || !torneio.id) return;
    try {
      const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
      const idx = allLocal.findIndex(t => String(t.id) === String(torneio.id));
      if (idx !== -1) {
        allLocal[idx] = { ...allLocal[idx], ...torneio };
      } else {
        allLocal.push(torneio);
      }
      localStorage.setItem('vh_createdTournaments', JSON.stringify(allLocal));
    } catch (err) {
      console.warn('Erro ao atualizar localStorage vh_createdTournaments:', err);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==============================================================================
  // AÇÕES: EDITAR TORNEIO (MODAL COM SISTEMA DE ABAS E UPLOAD)
  // ==============================================================================

  function abrirModalEdicao(torneio) {
    // Remove modal anterior se existir
    const antigo = document.getElementById('modalEditarTorneio');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalEditarTorneio';
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <h3><i class="fa-solid fa-pen-to-square" style="color: #38bdf8;"></i> Editar Torneio</h3>
          <button type="button" class="btn-close-modal" id="btnFecharModal" aria-label="Fechar">&times;</button>
        </div>

        <!-- Menu superior de Abas -->
        <div class="modal-tab-nav">
          <button type="button" class="modal-tab-btn active" data-tab-target="tabAparencia">
            <i class="fa-solid fa-palette"></i> Aparência
          </button>
          <button type="button" class="modal-tab-btn" data-tab-target="tabInfo">
            <i class="fa-solid fa-circle-info"></i> Informações
          </button>
          <button type="button" class="modal-tab-btn" data-tab-target="tabRegras">
            <i class="fa-solid fa-scale-balanced"></i> Regras
          </button>
        </div>

        <form class="modal-form" id="formEditarTorneio">
          <!-- ABA 1: APARÊNCIA -->
          <div class="modal-tab-pane active" id="tabAparencia">
            <div class="modal-field">
              <label>Banner do Torneio</label>
              <div class="banner-preview-box">
                <img id="editBannerPreview" src="${escapeHtml(torneio.banner || '/images/cerradocup.jpg')}" alt="Preview do banner">
              </div>
              <input type="file" id="editBannerFile" accept="image/*" style="display: none;">
              <label for="editBannerFile" class="banner-upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i> Selecionar novo banner
              </label>
              <span id="bannerFileName" style="font-size: 12px; color: #9ca3af; text-align: center; display: block; margin-top: 4px;"></span>
            </div>

            <div class="modal-field">
              <label for="editStatus">Status do Torneio</label>
              <select id="editStatus">
                <option value="Inscrições abertas" ${torneio.status === 'Inscrições abertas' ? 'selected' : ''}>Inscrições abertas</option>
                <option value="Em andamento" ${torneio.status === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
                <option value="Ao Vivo" ${torneio.status === 'Ao Vivo' ? 'selected' : ''}>Ao Vivo</option>
                <option value="Encerrado" ${torneio.status === 'Encerrado' ? 'selected' : ''}>Encerrado</option>
              </select>
            </div>

            <div class="modal-field">
              <label for="editLink">Link da Transmissão / Página</label>
              <input type="text" id="editLink" value="${escapeHtml(torneio.link || '')}" placeholder="https://twitch.tv/... ou link do torneio" />
            </div>
          </div>

          <!-- ABA 2: INFORMAÇÕES -->
          <div class="modal-tab-pane" id="tabInfo">
            <div class="modal-field">
              <label for="editNome">Nome do Torneio *</label>
              <input type="text" id="editNome" value="${escapeHtml(torneio.nome || '')}" required />
            </div>

            <div class="modal-field">
              <label for="editJogo">Jogo *</label>
              <input type="text" id="editJogo" value="${escapeHtml(torneio.jogo || '')}" required />
            </div>

            <div class="modal-field">
              <label for="editData">Data / Horário de Início *</label>
              <input type="text" id="editData" value="${escapeHtml(torneio.data || '')}" placeholder="Ex: 22/03/2026 às 20h" required />
            </div>

            <div class="modal-field">
              <label for="editLocalizacao">Localização</label>
              <input type="text" id="editLocalizacao" value="${escapeHtml(torneio.localizacao || '')}" placeholder="Ex: Online (Servidor SP) ou Av. Paulista, 1000 - SP" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-field">
                <label for="editModalidade">Modalidade</label>
                <select id="editModalidade">
                  <option value="online" ${torneio.modalidade !== 'presencial' ? 'selected' : ''}>Online</option>
                  <option value="presencial" ${torneio.modalidade === 'presencial' ? 'selected' : ''}>Presencial</option>
                </select>
              </div>

              <div class="modal-field">
                <label for="editLimite">Limite de Participantes</label>
                <input type="text" id="editLimite" value="${escapeHtml(torneio.limite || '')}" placeholder="Ex: 16 equipes ou 32 jogadores" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-field">
                <label for="editCategoria">Categoria</label>
                <select id="editCategoria">
                  <option value="fps" ${torneio.categoria === 'fps' ? 'selected' : ''}>FPS</option>
                  <option value="battle-royale" ${torneio.categoria === 'battle-royale' ? 'selected' : ''}>Battle Royale</option>
                  <option value="moba" ${torneio.categoria === 'moba' ? 'selected' : ''}>MOBA</option>
                  <option value="esportes" ${torneio.categoria === 'esportes' ? 'selected' : ''}>Esportes</option>
                  <option value="luta" ${torneio.categoria === 'luta' ? 'selected' : ''}>Luta</option>
                  <option value="outros" ${torneio.categoria === 'outros' ? 'selected' : ''}>Outros</option>
                </select>
              </div>

              <div class="modal-field">
                <label for="editPlataforma">Plataforma</label>
                <select id="editPlataforma">
                  <option value="pc" ${torneio.plataforma === 'pc' ? 'selected' : ''}>PC</option>
                  <option value="mobile" ${torneio.plataforma === 'mobile' ? 'selected' : ''}>Mobile</option>
                  <option value="console" ${torneio.plataforma === 'console' ? 'selected' : ''}>Console</option>
                  <option value="crossplay" ${torneio.plataforma === 'crossplay' ? 'selected' : ''}>Crossplay (Multi)</option>
                </select>
              </div>
            </div>

            <div class="modal-field">
              <label for="editDescricao">Descrição</label>
              <textarea id="editDescricao" rows="3" placeholder="Descrição sobre o torneio...">${escapeHtml(torneio.descricao || '')}</textarea>
            </div>
          </div>

          <!-- ABA 3: REGRAS -->
          <div class="modal-tab-pane" id="tabRegras">
            <div class="modal-field">
              <label for="editRegras">Regras do Torneio</label>
              <textarea id="editRegras" rows="6" placeholder="Digite uma regra por linha...">${escapeHtml(torneio.regras || '')}</textarea>
            </div>

            <div class="modal-field">
              <label for="editRequisitos">Requisitos de Participação</label>
              <textarea id="editRequisitos" rows="3" placeholder="Requisitos como nível, elo, equipamento...">${escapeHtml(torneio.requisitos || '')}</textarea>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-modal-cancel" id="btnCancelarEdicao">Cancelar</button>
            <button type="submit" class="btn-modal-save" id="btnSalvarEdicao">
              <i class="fa-solid fa-floppy-disk"></i> Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    overlay.querySelector('#btnFecharModal').addEventListener('click', fechar);
    overlay.querySelector('#btnCancelarEdicao').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fechar();
    });

    // Navegação entre as Abas
    const tabBtns = overlay.querySelectorAll('.modal-tab-btn');
    const tabPanes = overlay.querySelectorAll('.modal-tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const targetId = btn.dataset.tabTarget;
        tabPanes.forEach(pane => {
          if (pane.id === targetId) {
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
          }
        });
      });
    });

    // Preview do novo Banner
    const bannerFileInput = overlay.querySelector('#editBannerFile');
    const bannerPreview = overlay.querySelector('#editBannerPreview');
    const bannerFileName = overlay.querySelector('#bannerFileName');
    let arquivoBannerNovo = null;

    bannerFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        arquivoBannerNovo = file;
        bannerFileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
          bannerPreview.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // Salvamento com Upload
    const form = overlay.querySelector('#formEditarTorneio');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSalvar = form.querySelector('#btnSalvarEdicao');
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

      let bannerFinal = torneio.banner || '/images/cerradocup.jpg';

      // Upload do arquivo para o Storage se houver arquivo novo
      if (arquivoBannerNovo) {
        try {
          const fileExt = arquivoBannerNovo.name.split('.').pop() || 'png';
          const fileName = `banner_${torneio.id}_${Date.now()}.${fileExt}`;
          const filePath = `banners/${fileName}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('torneios')
            .upload(filePath, arquivoBannerNovo, {
              cacheControl: '3600',
              upsert: true
            });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('torneios')
              .getPublicUrl(filePath);

            if (publicUrlData && publicUrlData.publicUrl) {
              bannerFinal = publicUrlData.publicUrl;
            }
          } else {
            bannerFinal = bannerPreview.src;
          }
        } catch (storageErr) {
          console.warn('Fallback para imagem base64:', storageErr);
          bannerFinal = bannerPreview.src;
        }
      }

      const novoNome = form.querySelector('#editNome').value.trim();
      const novoJogo = form.querySelector('#editJogo').value.trim();
      const novaData = form.querySelector('#editData').value.trim();
      const novaLocalizacao = form.querySelector('#editLocalizacao').value.trim();
      const novaModalidade = form.querySelector('#editModalidade').value;
      const novoLimite = form.querySelector('#editLimite').value.trim();
      const novoStatus = form.querySelector('#editStatus').value;
      const novaCat = form.querySelector('#editCategoria').value;
      const novaPlat = form.querySelector('#editPlataforma').value;
      const novoLink = form.querySelector('#editLink').value.trim() || `/torneio/custom.html?id=${encodeURIComponent(torneio.id)}`;
      const novaDescricao = form.querySelector('#editDescricao').value.trim();
      const novasRegras = form.querySelector('#editRegras').value.trim();
      const novosRequisitos = form.querySelector('#editRequisitos').value.trim();

      const novoStatusClass = novoStatus.toLowerCase().includes('andamento') || novoStatus.toLowerCase().includes('vivo') ? 'status-andamento' :
                              novoStatus.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto';

      const updatePayload = {
        nome: novoNome,
        jogo: novoJogo,
        data: novaData,
        localizacao: novaLocalizacao,
        modalidade: novaModalidade,
        limite: novoLimite,
        status: novoStatus,
        statusClass: novoStatusClass,
        categoria: novaCat,
        plataforma: novaPlat,
        link: novoLink,
        descricao: novaDescricao,
        regras: novasRegras,
        requisitos: novosRequisitos,
        banner: bannerFinal
      };

      try {
        const { error } = await supabase
          .from('torneios')
          .update(updatePayload)
          .eq('id', torneio.id);

        if (error) {
          console.error('Erro ao atualizar torneio no Supabase:', error);
          showToast('Não foi possível salvar as alterações. Tente novamente.', 'error');
          btnSalvar.disabled = false;
          btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações';
          return;
        }

        // Atualiza objeto em memória e cache local
        Object.assign(torneio, updatePayload);
        salvarTorneioCriadoLocal(torneio);

        fechar();
        showToast('Torneio atualizado com sucesso!');
        render('created');
      } catch (err) {
        console.error('Falha na edição:', err);
        showToast('Ocorreu um erro ao salvar.', 'error');
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações';
      }
    });
  }

  // ==============================================================================
  // RENDERIZAÇÃO DOS CARDS
  // ==============================================================================

  function criarCard(torneio, tabKey) {
    const article = document.createElement('article');
    article.className = 'card-torneio manage-card-item';
    article.setAttribute('data-id', String(torneio.id));

    const banner = torneio.banner || '/images/cerradocup.jpg';
    const isLive = torneio.ao_vivo === true || torneio.transmissao_status === 'ao_vivo';

    let statusClass = torneio.statusClass || (
      torneio.status && (torneio.status.toLowerCase().includes('andamento') || torneio.status.toLowerCase().includes('vivo')) ? 'status-andamento' :
      torneio.status && torneio.status.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto'
    );
    let statusTexto = torneio.status || 'Inscrições abertas';

    if (isLive) {
      statusTexto = "<i class='fa-solid fa-tower-broadcast'></i> Ao Vivo Agora";
      statusClass = 'status-andamento';
    }

    const link = '/torneio/custom.html?id=' + encodeURIComponent(torneio.id);

    // Botões de Ação para a aba "Seus torneios"
    let botoesAcao = '';

    if (tabKey === 'created') {
      botoesAcao = `
        <div class="manage-actions" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
          ${isLive ? `
            <div class="live-active-badge" style="margin-bottom: 2px;">
              <span class="live-dot-pulse"></span> Ao Vivo Agora
            </div>
            <button type="button" class="btn-card-action btn-encerrar" data-id="${escapeHtml(torneio.id)}" style="background: #991b1b; border-color: #ef4444; color: #ffffff; width: 100%;">
              <i class="fa-solid fa-circle-stop"></i> Encerrar Transmissão
            </button>
          ` : `
            <button type="button" class="btn-card-action btn-transmitir" data-id="${escapeHtml(torneio.id)}" style="width: 100%;">
              <i class="fa-solid fa-tower-broadcast"></i> Iniciar Transmissão
            </button>
          `}
          <button type="button" class="btn-card-action btn-solicitacoes" data-id="${escapeHtml(torneio.id)}" style="width: 100%; background: #1e1e2d; border-color: #3b3b4f; color: #60a5fa;">
            <i class="fa-solid fa-users"></i> Gerenciar Inscrições
          </button>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-card-action btn-card-edit btn-editar" data-id="${escapeHtml(torneio.id)}" style="flex: 1;">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
            <button type="button" class="btn-card-action btn-card-delete btn-excluir" data-id="${escapeHtml(torneio.id)}" style="flex: 1;">
              <i class="fa-solid fa-trash-can"></i> Excluir
            </button>
          </div>
        </div>
      `;
    }

    let badgeStatusInscricao = '';
    if (tabKey === 'joined' && torneio.inscricaoStatus) {
      badgeStatusInscricao = `<p style="font-size: 12px; color: #60a5fa; margin-top: 4px; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Inscrição: ${escapeHtml(torneio.inscricaoStatus)}</p>`;
    }

    article.innerHTML = `
      <img referrerpolicy="no-referrer" src="${banner}" alt="${escapeHtml(torneio.nome || '')}">
      <div class="card-info">
        <h2>${escapeHtml(torneio.nome || '')}</h2>
        <p class="jogo">${escapeHtml(torneio.jogo || '')}</p>
        <p class="data">${escapeHtml(torneio.data || '')}</p>
        <p class="status ${statusClass}">${statusTexto}</p>
        ${badgeStatusInscricao}
        <a href="${link}" class="btn-detalhes" style="display: block; text-decoration: none; margin-top: 8px;">Ver detalhes</a>
        ${botoesAcao}
      </div>
    `;

    return article;
  }

  // ==============================================================================
  // AÇÃO 3: PAINEL DE APROVAÇÃO DO ORGANIZADOR (MODAL DE GERENCIAR INSCRIÇÕES)
  // ==============================================================================
  function abrirModalGerenciarInscricoes(torneio) {
    const antigo = document.getElementById('modalGerenciarInscricoes');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalGerenciarInscricoes';
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 620px;">
        <div class="modal-header">
          <h3><i class="fa-solid fa-users" style="color: #60a5fa;"></i> Inscrições: ${escapeHtml(torneio.nome || 'Torneio')}</h3>
          <button type="button" class="btn-close-modal" id="btnFecharModalInsc" aria-label="Fechar">&times;</button>
        </div>

        <p style="font-size: 13px; color: #9ca3af; margin-top: -6px; margin-bottom: 16px;">
          Avalie as solicitações de jogadores e equipes para participar deste campeonato.
        </p>

        <div id="listaSolicitacoesInscricao" style="min-height: 180px; max-height: 460px; overflow-y: auto;">
          <div style="text-align: center; padding: 30px; color: #9ca3af;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: #60a5fa;"></i>
            <span style="display: block; margin-top: 10px; font-size: 14px;">Carregando solicitações...</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    overlay.querySelector('#btnFecharModalInsc').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fechar();
    });

    carregarSolicitacoesTorneio(torneio, overlay);
  }

  async function carregarSolicitacoesTorneio(torneio, modalOverlay) {
    const container = modalOverlay.querySelector('#listaSolicitacoesInscricao');
    if (!container) return;

    try {
      let pendentes = [];
      try {
        const { data, error } = await supabase
          .from('inscricoes')
          .select('*')
          .eq('torneio_id', String(torneio.id))
          .eq('status', 'Pendente');

        if (!error && Array.isArray(data)) {
          pendentes = data;
        }
      } catch (errDb) {
        console.warn('Aviso ao carregar inscrições pendentes do Supabase:', errDb);
      }

      // Mescla com cache local vh_inscricoes
      try {
        const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
        allLocal
          .filter(i => String(i.torneio_id) === String(torneio.id) && i.status === 'Pendente')
          .forEach(li => {
            if (!pendentes.some(p => (p.id && String(p.id) === String(li.id)) || (String(p.id_participante) === String(li.id_participante) && String(p.user_email) === String(li.user_email)))) {
              pendentes.push(li);
            }
          });
      } catch (eLocal) {}

      if (pendentes.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; background: #181824; border-radius: 12px; border: 1px dashed #2b2b3d;">
            <i class="fa-solid fa-clipboard-check" style="font-size: 38px; color: #34d399; margin-bottom: 12px; display: block;"></i>
            <strong style="color: #ffffff; font-size: 15px; display: block;">Nenhuma solicitação pendente</strong>
            <p style="font-size: 13px; color: #9ca3af; margin: 6px 0 0 0;">
              Todas as inscrições para este torneio foram respondidas ou ainda não há novos pedidos.
            </p>
          </div>
        `;
        return;
      }

      // Busca dados detalhados de cada participante pendente
      const promessas = pendentes.map(async (insc) => {
        const tipo = (insc.tipo || 'individual').toLowerCase();
        const idPart = insc.id_participante || insc.user_email;

        let nome = idPart;
        let foto = '/image/boneco_logo_ofc.png';
        let sub = insc.user_email || 'Solicitante';

        if (tipo === 'equipe') {
          try {
            const { data: eqData } = await supabase
              .from('equipes')
              .select('*')
              .eq('id', idPart)
              .maybeSingle();

            if (eqData) {
              nome = eqData.nome + (eqData.tag ? ` [${eqData.tag}]` : '');
              if (eqData.logo) foto = eqData.logo;
              sub = 'Líder: ' + (eqData.leaderName || eqData.leaderEmail || insc.user_email);
            } else {
              const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
              const cachedTeams = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
              const found = localTeams.find(t => String(t.id) === String(idPart)) || cachedTeams.find(t => String(t.id) === String(idPart));
              if (found) {
                nome = found.nome + (found.tag ? ` [${found.tag}]` : '');
                if (found.logo) foto = found.logo;
                sub = 'Líder: ' + (found.leaderName || found.leaderEmail || insc.user_email);
              }
            }
          } catch (errEq) {
            console.warn('Erro ao consultar equipe:', errEq);
          }
        } else {
          try {
            const { data: uData } = await supabase
              .from('usuarios')
              .select('*')
              .eq('email', idPart)
              .maybeSingle();

            if (uData) {
              if (uData.nome) nome = uData.nome;
              if (uData.avatar) foto = uData.avatar;
              sub = uData.email || idPart;
            } else {
              const rawLogged = localStorage.getItem('vh_loggedUser');
              if (rawLogged) {
                const u = JSON.parse(rawLogged);
                if (u.email === idPart) {
                  nome = u.nome || idPart;
                  if (u.avatar) foto = u.avatar;
                }
              }
            }
          } catch (errU) {
            console.warn('Erro ao consultar usuário:', errU);
          }
        }

        return {
          id: insc.id || '',
          tipo,
          id_participante: idPart,
          user_email: insc.user_email,
          nome,
          foto,
          sub
        };
      });

      const detalhes = await Promise.all(promessas);

      container.innerHTML = detalhes.map(item => `
        <div class="solicitacao-card" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #161622; border: 1px solid #28283a; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 200px; flex: 1;">
            <img
              src="${item.foto}"
              alt="${escapeHtml(item.nome)}"
              onerror="this.src='/image/boneco_logo_ofc.png'"
              style="width: 46px; height: 46px; border-radius: ${item.tipo === 'equipe' ? '10px' : '50%'}; object-fit: cover; border: 2px solid ${item.tipo === 'equipe' ? '#3b82f6' : '#ef4444'}; flex-shrink: 0;"
            />
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <strong style="color: #ffffff; font-size: 14px; font-weight: 600;">${escapeHtml(item.nome)}</strong>
                <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: ${item.tipo === 'equipe' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${item.tipo === 'equipe' ? '#60a5fa' : '#f87171'}; border: 1px solid ${item.tipo === 'equipe' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
                  <i class="fa-solid ${item.tipo === 'equipe' ? 'fa-shield-halved' : 'fa-user'}"></i> ${item.tipo === 'equipe' ? 'Equipe' : 'Individual'}
                </span>
              </div>
              <span style="display: block; font-size: 12px; color: #9ca3af; margin-top: 3px;">${escapeHtml(item.sub)}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-shrink: 0;">
            <button
              type="button"
              class="btn-aprovar-inscricao"
              data-id="${escapeHtml(item.id)}"
              data-torneio="${escapeHtml(torneio.id)}"
              data-part="${escapeHtml(item.id_participante)}"
              data-email="${escapeHtml(item.user_email)}"
              style="background: #059669; border: 1px solid #10b981; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;"
            >
              <i class="fa-solid fa-check"></i> Aceitar
            </button>
            <button
              type="button"
              class="btn-recusar-inscricao"
              data-id="${escapeHtml(item.id)}"
              data-torneio="${escapeHtml(torneio.id)}"
              data-part="${escapeHtml(item.id_participante)}"
              data-email="${escapeHtml(item.user_email)}"
              style="background: #7f1d1d; border: 1px solid #ef4444; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;"
            >
              <i class="fa-solid fa-xmark"></i> Recusar
            </button>
          </div>
        </div>
      `).join('');

      // Eventos de Aceitar
      container.querySelectorAll('.btn-aprovar-inscricao').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const idInsc = btn.dataset.id;
          const idTorneio = btn.dataset.torneio;
          const idPart = btn.dataset.part;
          const userEmail = btn.dataset.email;

          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aceitando...';

          try {
            // Atualiza Supabase
            if (idInsc) {
              await supabase.from('inscricoes').update({ status: 'Aceito' }).eq('id', idInsc);
            } else {
              await supabase.from('inscricoes').update({ status: 'Aceito' }).eq('torneio_id', String(idTorneio)).eq('user_email', userEmail);
            }
          } catch (errDb) {
            console.warn('Erro ao atualizar inscrição no Supabase:', errDb);
          }

          // Atualiza cache local vh_inscricoes
          try {
            const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
            allLocal.forEach(i => {
              if (String(i.torneio_id) === String(idTorneio) && (String(i.id_participante) === String(idPart) || String(i.user_email) === String(userEmail))) {
                i.status = 'Aceito';
              }
            });
            localStorage.setItem('vh_inscricoes', JSON.stringify(allLocal));

            // Atualiza status em vh_joinedTournaments
            const storageKey = `vh_joinedTournaments_${userEmail}`;
            const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
            joined.forEach(j => {
              if (String(j.id) === String(idTorneio)) {
                j.inscricaoStatus = 'Aceito';
              }
            });
            localStorage.setItem(storageKey, JSON.stringify(joined));
          } catch (eLocal) {}

          if (typeof showToast === 'function') {
            showToast('Inscrição aceita com sucesso!');
          }

          // Recarrega o modal
          carregarSolicitacoesTorneio(torneio, modalOverlay);
        });
      });

      // Eventos de Recusar
      container.querySelectorAll('.btn-recusar-inscricao').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const idInsc = btn.dataset.id;
          const idTorneio = btn.dataset.torneio;
          const idPart = btn.dataset.part;
          const userEmail = btn.dataset.email;

          if (!confirm('Deseja realmente recusar esta solicitação de inscrição?')) return;

          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recusando...';

          try {
            // Delete no Supabase
            if (idInsc) {
              await supabase.from('inscricoes').delete().eq('id', idInsc);
            } else {
              await supabase.from('inscricoes').delete().eq('torneio_id', String(idTorneio)).eq('user_email', userEmail);
            }
          } catch (errDb) {
            console.warn('Erro ao deletar inscrição no Supabase:', errDb);
          }

          // Remove do cache local vh_inscricoes
          try {
            const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
            const filtrado = allLocal.filter(i => !(String(i.torneio_id) === String(idTorneio) && (String(i.id_participante) === String(idPart) || String(i.user_email) === String(userEmail))));
            localStorage.setItem('vh_inscricoes', JSON.stringify(filtrado));

            // Remove do vh_joinedTournaments
            const storageKey = `vh_joinedTournaments_${userEmail}`;
            const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const joinedFiltrado = joined.filter(j => String(j.id) !== String(idTorneio));
            localStorage.setItem(storageKey, JSON.stringify(joinedFiltrado));
          } catch (eLocal) {}

          if (typeof showToast === 'function') {
            showToast('Inscrição recusada.');
          }

          // Recarrega o modal
          carregarSolicitacoesTorneio(torneio, modalOverlay);
        });
      });

    } catch (err) {
      console.error('Erro ao listar solicitações:', err);
      container.innerHTML = `
        <div style="color: #ef4444; padding: 20px; text-align: center;">
          <i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar solicitações.
        </div>
      `;
    }
  }

  // ==============================================================================
  // EVENT DELEGATION GLOBAL NO BODY PARA OS BOTÕES DA LISTA DE TORNEIOS
  // ==============================================================================
  document.body.addEventListener('click', async (e) => {
    // 1. Excluir Torneio
    const btnExcluir = e.target.closest('.btn-excluir');
    if (btnExcluir) {
      e.preventDefault();
      const id = btnExcluir.dataset.id;
      if (confirm("Deseja realmente excluir permanentemente este torneio?")) {
        btnExcluir.disabled = true;
        btnExcluir.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...';
        
        await supabase.from('torneios').delete().eq('id', id);
        
        // Atualiza a interface
        userCreatedTournaments = userCreatedTournaments.filter(t => String(t.id) !== String(id));
        try {
          const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
          const filteredLocal = allLocal.filter(t => String(t.id) !== String(id));
          localStorage.setItem('vh_createdTournaments', JSON.stringify(filteredLocal));
        } catch (eLocal) {}
        render('created'); 
        
        // Toast opcional se a função existir
        if (typeof showToast === 'function') showToast('Torneio excluído com sucesso!');
      }
      return;
    }

    // 2. Iniciar Transmissão
    const btnTransmitir = e.target.closest('.btn-transmitir');
    if (btnTransmitir) {
      e.preventDefault();
      const id = btnTransmitir.dataset.id;
      const link = prompt("Insira o link da Twitch ou YouTube para iniciar a transmissão:");
      
      if (link && link.trim() !== "") {
        btnTransmitir.disabled = true;
        btnTransmitir.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
        
        await supabase.from('torneios').update({
          link: link.trim(),
          status: 'Ao Vivo',
          statusClass: 'status-andamento'
        }).eq('id', id);
        
        // Atualiza os dados em memória para a tela recarregar certa
        const torneio = userCreatedTournaments.find(t => String(t.id) === String(id));
        if (torneio) {
          torneio.status = 'Ao Vivo';
          torneio.statusClass = 'status-andamento';
          torneio.link = link.trim();
          torneio.ao_vivo = true;
          salvarTorneioCriadoLocal(torneio);
        }
        render('created');
        
        if (typeof showToast === 'function') showToast('Transmissão iniciada!');
      }
      return;
    }

    // 3. Encerrar Transmissão
    const btnEncerrar = e.target.closest('.btn-encerrar');
    if (btnEncerrar) {
      e.preventDefault();
      const id = btnEncerrar.dataset.id;
      if (!id) return;

      if (confirm("Deseja realmente encerrar a transmissão ao vivo deste torneio?")) {
        btnEncerrar.disabled = true;
        try {
          await supabase.from('torneios').update({
            status: 'Inscrições abertas',
            statusClass: 'status-aberto'
          }).eq('id', id);

          const torneio = userCreatedTournaments.find(t => String(t.id) === String(id));
          if (torneio) {
            torneio.ao_vivo = false;
            torneio.status = 'Inscrições abertas';
            torneio.statusClass = 'status-aberto';
            salvarTorneioCriadoLocal(torneio);
          }

          if (typeof showToast === 'function') showToast('Transmissão finalizada com sucesso!');
          render(currentTab);
        } catch (err) {
          console.error('Erro ao encerrar transmissão:', err);
          if (typeof showToast === 'function') showToast('Erro ao encerrar transmissão.', 'error');
          btnEncerrar.disabled = false;
        }
      }
      return;
    }

    // 4. Editar Torneio
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      e.preventDefault();
      const id = btnEditar.dataset.id;
      const torneio = userCreatedTournaments.find(t => String(t.id) === String(id));
      if (torneio) {
        abrirModalEdicao(torneio);
      }
      return;
    }

    // 5. Gerenciar Inscrições (Ação 3)
    const btnSolicitacoes = e.target.closest('.btn-solicitacoes');
    if (btnSolicitacoes) {
      e.preventDefault();
      const id = btnSolicitacoes.dataset.id;
      const torneio = userCreatedTournaments.find(t => String(t.id) === String(id)) || { id, nome: 'Torneio' };
      abrirModalGerenciarInscricoes(torneio);
      return;
    }
  });

  function render(tabKey) {
    currentTab = tabKey;
    let listaT = [];

    if (tabKey === 'created') {
      listaT = userCreatedTournaments;
    } else if (tabKey === 'joined') {
      listaT = userJoinedTournaments;
    } else if (tabKey === 'visited') {
      listaT = userVisitedTournaments;
    }

    lista.innerHTML = '';

    if (!listaT.length) {
      let mensagem = 'Você ainda não possui torneios nesta seção.';
      if (tabKey === 'created') {
        mensagem = 'Você ainda não criou nenhum torneio. Que tal criar o seu primeiro?';
      } else if (tabKey === 'joined') {
        mensagem = 'Você ainda não se inscreveu em nenhum torneio.';
      }
      lista.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
          <p style="font-size: 16px; color: #9ca3af; margin-bottom: 16px;">${mensagem}</p>
          ${tabKey === 'created' ? '<a href="/criar_torneio/criar_torneio.html" style="background: #d41111; color: #fff; padding: 10px 20px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 13px; display: inline-block;">Criar Torneio Agora</a>' : ''}
        </div>`;
      return;
    }

    listaT.forEach(t => {
      lista.appendChild(criarCard(t, tabKey));
    });
  }

  function showLoadingState() {
    lista.innerHTML = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #9ca3af; text-align: center;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 36px; color: #ff3b30; margin-bottom: 14px; display: block;"></i>
        <span style="font-size: 15px; font-weight: 600; color: #f3f4f6;">Carregando torneios...</span>
        <span style="font-size: 13px; color: #6b7280; margin-top: 4px;">Aguarde enquanto sincronizamos com o servidor</span>
      </div>
    `;
  }

  // Eventos de clique nas abas
  tabs.forEach(btn => {
    btn.addEventListener('click', async () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const chave = btn.dataset.tab;

      showLoadingState();

      if (chave === 'created') {
        await carregarTorneiosCriados();
      } else if (chave === 'joined') {
        await carregarTorneiosInscritos();
      } else if (chave === 'visited') {
        carregarTorneiosFrequentados();
      }

      render(chave);
    });
  });

  // Carga inicial assíncrona com tela de carregamento
  showLoadingState();
  await carregarTorneiosCriados();
  await carregarTorneiosInscritos();
  carregarTorneiosFrequentados();

  render('created');
});

 