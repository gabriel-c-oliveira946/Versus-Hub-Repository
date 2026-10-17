// /gerenciartorneios/js/Script.js
// Gerenciamento completo de torneios com Supabase (Edição, Exclusão, Inscrições e Chaveamento)

import { supabase, enviarNotificacao } from '/supabaseClient.js';
import {
  gerarChaveamentoTorneio,
  carregarPartidasTorneio,
  buscarParticipantesConfirmados,
  renderizarChaveamentoVisual,
  abrirModalEditarPartida,
  abrirModalCriarPartidaManual,
  abrirModalCriarPartidaExtra,
  abrirModalMontagemManual,
  showBracketToast,
  abrirModalConfirmacaoEncerramentoTorneio
} from '/torneio/js/brackets.js';

function obterMaxIntegrantesTorneio(t) {
  if (!t) return 5;
  if (t.maxIntegrantes != null && !isNaN(parseInt(t.maxIntegrantes, 10)) && parseInt(t.maxIntegrantes, 10) > 0) {
    return parseInt(t.maxIntegrantes, 10);
  }
  if (t.max_integrantes != null && !isNaN(parseInt(t.max_integrantes, 10)) && parseInt(t.max_integrantes, 10) > 0) {
    return parseInt(t.max_integrantes, 10);
  }

  const textoGeral = `${t.nome || ''} ${t.jogo || ''} ${t.regras || ''} ${t.descricao || ''}`.toLowerCase();
  const matchXvX = textoGeral.match(/\b([1-9]|10|11|12|15|20)v\1\b/);
  if (matchXvX) return parseInt(matchXvX[1], 10);

  const matchJogadores = textoGeral.match(/(\d+)\s*(?:jogadores|integrantes|players|membros)\s*(?:por\s*equipe|por\s*time)?/i);
  if (matchJogadores && parseInt(matchJogadores[1], 10) > 0 && parseInt(matchJogadores[1], 10) <= 50) {
    return parseInt(matchJogadores[1], 10);
  }

  if (textoGeral.includes('squad') || textoGeral.includes('4v4')) return 4;
  if (textoGeral.includes('trio') || textoGeral.includes('3v3')) return 3;
  if (textoGeral.includes('duo') || textoGeral.includes('2v2')) return 2;

  const jogo = (t.jogo || '').toLowerCase();
  if (jogo.includes('rocket league')) return 3;
  if (jogo.includes('free fire') || jogo.includes('pubg')) return 4;
  if (jogo.includes('apex')) return 3;
  if (jogo.includes('valorant') || jogo.includes('league of legends') || jogo.includes('cs') || jogo.includes('dota') || jogo.includes('rainbow')) return 5;
  if (jogo.includes('fifa') || jogo.includes('eafc') || jogo.includes('street fighter') || jogo.includes('mortal kombat') || jogo.includes('tekken') || jogo.includes('clash royale')) return 1;

  return 5;
}

// Limpeza preventiva total de torneios e equipes estáticos




document.addEventListener('DOMContentLoaded', async () => {
  let loggedUser = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      const rawUser = localStorage.getItem('vh_loggedUser');
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
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
    console.warn('Aviso ao consultar sessão em gerenciartorneios:', err);
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
        .select('id, nome, jogo, status, data, maxParticipantes, max_participantes, banner, link')
        .eq('criadorEmail', loggedUser.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erro ao consultar torneios criados no banco:', error);
      }

      let criadosDb = data || [];

      // Une com os salvos localmente caso haja algum recente (apenas torneios válidos do usuário)
      const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
      const userLocal = allLocal.filter(t => t  && (!t.criadorEmail || t.criadorEmail === loggedUser.email));

      userLocal.forEach(loc => {
        if (!criadosDb.some(d => String(d.id) === String(loc.id))) {
          criadosDb.push(loc);
        }
      });

      userCreatedTournaments = criadosDb;
    } catch (e) {
      console.error('Falha de conexão ao carregar torneios criados:', e);
      const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
      userCreatedTournaments = allLocal.filter(t => t  && (!t.criadorEmail || t.criadorEmail === loggedUser.email));
    }
  }

  async function carregarTorneiosInscritos() {
    try {
      const { data: inscricoesDb, error } = await supabase
        .from('inscricoes')
        .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
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
          .select('id, nome, jogo, status, data, maxParticipantes, max_participantes, banner, link')
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
              banner: (t.banner && !t.banner.includes('cerradocup')) ? t.banner : '/images/logo_versushub.png',
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

  async function carregarTorneiosFrequentados() {
    if (!loggedUser || !loggedUser.email) {
      userVisitedTournaments = [];
      return;
    }
    try {
      // 1. Consulte na tabela 'inscricoes' todas as inscrições do user_email logado
      const { data: inscricoesDb, error } = await supabase
        .from('inscricoes')
        .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
        .ilike('user_email', loggedUser.email);

      if (error) {
        console.warn('Erro ao consultar inscrições para frequentados:', error);
      }

      const listaInscricoes = inscricoesDb || [];
      const torneiosIds = [...new Set(listaInscricoes.map(i => i.torneio_id).filter(id => id && !id.startsWith('equipe:')))];

      let torneiosFrequentados = [];

      if (torneiosIds.length > 0) {
        // 2. Consulte na tabela 'torneios' os torneios correspondentes
        const { data: torneiosDb, error: errT } = await supabase
          .from('torneios')
          .select('id, nome, jogo, status, data, maxParticipantes, max_participantes, banner, link')
          .in('id', torneiosIds);

        if (errT) {
          console.warn('Erro ao consultar torneios para frequentados:', errT);
        }

        const mapaInsc = {};
        listaInscricoes.forEach(i => { mapaInsc[String(i.torneio_id)] = i; });

        // 3. Filtra apenas torneios cujo status seja 'Encerrado'
        torneiosFrequentados = (torneiosDb || [])
          .filter(t => t.status && (t.status === 'Encerrado' || t.status.toLowerCase().includes('encerrad')))
          .map(t => {
            const insc = mapaInsc[String(t.id)] || {};
            return {
              id: t.id,
              nome: t.nome || 'Torneio',
              jogo: t.jogo || 'Livre',
              data: t.data || 'Encerrado',
              status: 'Encerrado',
              statusClass: 'status-encerrado',
              banner: (t.banner && !t.banner.includes('cerradocup')) ? t.banner : '/images/logo_versushub.png',
              link: t.link || `/torneio/custom.html?id=${encodeURIComponent(t.id)}`,
              inscricaoStatus: 'Histórico'
            };
          });
      }

      userVisitedTournaments = torneiosFrequentados;
    } catch (err) {
      console.error('Erro ao carregar torneios frequentados:', err);
      userVisitedTournaments = [];
    }
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

  /**
   * Comprime o banner do torneio via Canvas para no máximo 600x300px JPEG com qualidade 0.6.
   * Evita estouro de payload no Supabase e otimiza a performance e consumo de Egress.
   */
  function comprimirBannerCanvas(imageSource, maxWidth = 600, maxHeight = 300, quality = 0.6) {
    return new Promise((resolve, reject) => {
      if (!imageSource) return resolve('/images/logo_versushub.png');

      const img = new Image();
      img.crossOrigin = 'anonymous';

      const renderCanvas = () => {
        let width = img.naturalWidth || img.width || 1200;
        let height = img.naturalHeight || img.height || 400;

        let targetWidth = width;
        let targetHeight = height;

        if (targetWidth > maxWidth) {
          targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
          targetWidth = maxWidth;
        }
        if (targetHeight > maxHeight) {
          targetWidth = Math.round((targetWidth * maxHeight) / targetHeight);
          targetHeight = maxHeight;
        }

        if (targetWidth <= 0) targetWidth = 1200;
        if (targetHeight <= 0) targetHeight = 400;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b0a12';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          if (typeof imageSource === 'string') resolve(imageSource);
          else reject(err);
        }
      };

      img.onload = renderCanvas;
      img.onerror = () => {
        if (typeof imageSource === 'string') resolve(imageSource);
        else reject(new Error('Falha ao processar arquivo de imagem'));
      };

      if (imageSource instanceof File || imageSource instanceof Blob) {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo da imagem'));
        reader.readAsDataURL(imageSource);
      } else if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else {
        resolve('/images/logo_versushub.png');
      }
    });
  }

  function dataURLtoBlob(dataUrl) {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      return null;
    }
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
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 999999; padding: 16px; box-sizing: border-box; overflow-y: auto;';

    overlay.innerHTML = `
      <div class="modal-content" style="background: #141419; border: 1px solid #282838; border-radius: 18px; width: 100%; max-width: 580px; max-height: 85vh; overflow-y: auto; padding: 24px; box-shadow: 0 24px 50px rgba(0,0,0,0.8); box-sizing: border-box; display: flex; flex-direction: column; margin: auto;">
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

        <form class="modal-form modal-editar-torneio-content" id="formEditarTorneio" style="padding-top: 24px;">
          <!-- ABA 1: APARÊNCIA -->
          <div class="modal-tab-pane active" id="tabAparencia">
            <div class="modal-field">
              <label>Banner do Torneio</label>
              <div class="banner-preview-box">
                <img id="editBannerPreview" src="${escapeHtml((torneio.banner && !torneio.banner.includes('cerradocup')) ? torneio.banner : '/images/logo_versushub.png')}" alt="Preview do banner" referrerpolicy="no-referrer">
              </div>
              <input type="file" id="editBannerFile" accept="image/*" style="display: none;">
              <label for="editBannerFile" class="banner-upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i> Selecionar novo banner
              </label>
              <span id="bannerFileName" style="font-size: 12px; color: #9ca3af; text-align: center; display: block; margin-top: 4px;"></span>
            </div>

            <!-- Status é gerenciado automaticamente pelas fases e chaveamento -->
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
              <label for="editData">Data e Horário de Abertura (Início do Torneio) *</label>
              <input type="text" id="editData" value="${escapeHtml(torneio.data || '')}" placeholder="Ex: 22/03/2026 às 20h" required />
              <p style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">Define quando o torneio entra em andamento e as inscrições fecham.</p>
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
                <label for="editLimite">Máximo de Vagas (Equipes/Participantes) *</label>
                <input type="number" id="editLimite" min="2" max="512" value="${escapeHtml(String(torneio.maxParticipantes || torneio.max_participantes || (torneio.limite ? (torneio.limite.match(/\d+/) ? torneio.limite.match(/\d+/)[0] : '16') : '16')))}" placeholder="Ex: 8, 16, 32, 64" required />
              </div>
            </div>

            <div class="modal-field full-row" style="margin-bottom: 16px;">
              <label style="font-size: 13px; font-weight: 700; color: #f3f4f6; margin-bottom: 8px; display: block;">Formato do Torneio *</label>
              <input type="hidden" id="editFormatoTorneio" value="${escapeHtml(torneio.formato || torneio.formato_torneio || 'Mata-Mata (Eliminatória)')}">
              <div class="tile-selector double" id="editFormatoSelector" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
                <div class="tile-option ${(!torneio.formato || torneio.formato.toLowerCase().includes('mata')) ? 'selected' : ''}" data-value="Mata-Mata (Eliminatória)" style="padding: 16px; border-radius: 10px; border: 1.5px solid ${(!torneio.formato || torneio.formato.toLowerCase().includes('mata')) ? '#ff3e3e' : '#334155'}; background: ${(!torneio.formato || torneio.formato.toLowerCase().includes('mata')) ? 'rgba(255,62,62,0.1)' : '#1e293b'}; cursor: pointer; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;">
                  <i class="fa-solid fa-sitemap" style="color: #ff3e3e; font-size: 20px;"></i>
                  <span style="font-size: 14.5px; font-weight: 700; color: #fff;">Mata-Mata (Eliminatória)</span>
                  <span style="font-size: 13px; line-height: 1.4; color: #cbd5e1; margin-top: 6px; font-weight: 500;">Quem perde a partida é automaticamente eliminado do torneio.</span>
                </div>
                <div class="tile-option ${(torneio.formato && (torneio.formato.toLowerCase().includes('pontos') || torneio.formato.toLowerCase().includes('liga'))) ? 'selected' : ''}" data-value="Pontos Corridos (Liga)" style="padding: 16px; border-radius: 10px; border: 1.5px solid ${(torneio.formato && (torneio.formato.toLowerCase().includes('pontos') || torneio.formato.toLowerCase().includes('liga'))) ? '#ff3e3e' : '#334155'}; background: ${(torneio.formato && (torneio.formato.toLowerCase().includes('pontos') || torneio.formato.toLowerCase().includes('liga'))) ? 'rgba(255,62,62,0.1)' : '#1e293b'}; cursor: pointer; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;">
                  <i class="fa-solid fa-list-ol" style="color: #ff3e3e; font-size: 20px;"></i>
                  <span style="font-size: 14.5px; font-weight: 700; color: #fff;">Pontos Corridos (Liga)</span>
                  <span style="font-size: 13px; line-height: 1.4; color: #cbd5e1; margin-top: 6px; font-weight: 500;">Todos continuam jogando e acumulando vitórias e saldo de pontos até o encerramento.</span>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div class="modal-field">
                <label for="editTipoInscricao">Tipo de Inscrição</label>
                <select id="editTipoInscricao">
                  <option value="Apenas Solo (1v1)" ${(torneio.tipoInscricao === 'Apenas Solo (1v1)' || torneio.tipo_inscricao === 'Apenas Solo (1v1)') ? 'selected' : ''}>Apenas Solo (1v1)</option>
                  <option value="Apenas Equipe" ${(torneio.tipoInscricao === 'Apenas Equipe' || torneio.tipo_inscricao === 'Apenas Equipe') ? 'selected' : ''}>Apenas Equipe</option>
                  <option value="Solo ou Equipe" ${(!torneio.tipoInscricao || torneio.tipoInscricao === 'Solo ou Equipe' || torneio.tipo_inscricao === 'Solo ou Equipe') ? 'selected' : ''}>Solo ou Equipe</option>
                </select>
              </div>

              <div class="modal-field" id="editMaxIntegrantesField">
                <label for="editMaxIntegrantes">Número de participantes por equipe *</label>
                <input type="number" id="editMaxIntegrantes" min="1" max="30" value="${escapeHtml(String(torneio.maxIntegrantes || torneio.max_integrantes || obterMaxIntegrantesTorneio(torneio)))}" placeholder="Ex: 5" required />
                <div class="team-size-presets" style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
                  <button type="button" class="btn-preset-script" data-size="1" style="padding: 3px 8px; font-size: 11px; background: #222230; border: 1px solid #3b3b4f; color: #cbd5e1; border-radius: 4px; cursor: pointer;">1 (Solo)</button>
                  <button type="button" class="btn-preset-script" data-size="2" style="padding: 3px 8px; font-size: 11px; background: #222230; border: 1px solid #3b3b4f; color: #cbd5e1; border-radius: 4px; cursor: pointer;">2 (Duo)</button>
                  <button type="button" class="btn-preset-script" data-size="3" style="padding: 3px 8px; font-size: 11px; background: #222230; border: 1px solid #3b3b4f; color: #cbd5e1; border-radius: 4px; cursor: pointer;">3 (Trio)</button>
                  <button type="button" class="btn-preset-script" data-size="4" style="padding: 3px 8px; font-size: 11px; background: #222230; border: 1px solid #3b3b4f; color: #cbd5e1; border-radius: 4px; cursor: pointer;">4 (Squad)</button>
                  <button type="button" class="btn-preset-script" data-size="5" style="padding: 3px 8px; font-size: 11px; background: #222230; border: 1px solid #3b3b4f; color: #cbd5e1; border-radius: 4px; cursor: pointer;">5 (Padrão)</button>
                </div>
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

    // Listener interativo do Formato do Torneio (Tiles clicáveis)
    const inputEditFormato = overlay.querySelector('#editFormatoTorneio');
    const hintEditFormato = overlay.querySelector('#editFormatoTorneioHint');
    const tileOptionsEditFormato = overlay.querySelectorAll('#editFormatoSelector .tile-option');

    tileOptionsEditFormato.forEach(tile => {
      tile.addEventListener('click', () => {
        tileOptionsEditFormato.forEach(t => {
          t.classList.remove('selected');
          t.style.border = '1px solid #334155';
          t.style.background = '#1e293b';
        });
        tile.classList.add('selected');
        tile.style.border = '1px solid #ff3e3e';
        tile.style.background = 'rgba(255,62,62,0.1)';

        const val = tile.getAttribute('data-value');
        if (inputEditFormato) inputEditFormato.value = val;

        if (hintEditFormato) {
          if (val.toLowerCase().includes('pontos') || val.toLowerCase().includes('liga')) {
            hintEditFormato.textContent = 'Todos continuam jogando e acumulando vitórias e saldo de pontos até o encerramento.';
          } else {
            hintEditFormato.textContent = 'Quem perde a partida é automaticamente eliminado do torneio.';
          }
        }
      });
    });
    const bannerFileInput = overlay.querySelector('#editBannerFile');
    const bannerPreview = overlay.querySelector('#editBannerPreview');
    const bannerFileName = overlay.querySelector('#bannerFileName');
    let arquivoBannerNovo = null;
    let bannerComprimidoDataUrl = null;

    // Interatividade do Tipo de Inscrição e presets de tamanho de equipe
    const selTipoInsc = overlay.querySelector('#editTipoInscricao');
    const inputMaxInteg = overlay.querySelector('#editMaxIntegrantes');
    if (selTipoInsc && inputMaxInteg) {
      selTipoInsc.addEventListener('change', () => {
        if (selTipoInsc.value === 'Apenas Solo (1v1)') {
          inputMaxInteg.value = '1';
          inputMaxInteg.disabled = true;
          inputMaxInteg.style.opacity = '0.5';
        } else {
          inputMaxInteg.disabled = false;
          inputMaxInteg.style.opacity = '1';
          if (inputMaxInteg.value === '1' || !inputMaxInteg.value) {
            inputMaxInteg.value = '5';
          }
        }
      });
      overlay.querySelectorAll('.btn-preset-script').forEach(btn => {
        btn.addEventListener('click', () => {
          const sz = btn.getAttribute('data-size');
          if (sz) {
            inputMaxInteg.value = sz;
            if (sz === '1') {
              if (selTipoInsc.value === 'Apenas Equipe') {
                selTipoInsc.value = 'Solo ou Equipe';
              }
            } else {
              if (selTipoInsc.value === 'Apenas Solo (1v1)') {
                selTipoInsc.value = 'Solo ou Equipe';
                inputMaxInteg.disabled = false;
                inputMaxInteg.style.opacity = '1';
              }
            }
          }
        });
      });
    }

    bannerFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          showToast('Selecione apenas arquivos de imagem.', 'warning');
          return;
        }
        arquivoBannerNovo = file;
        bannerFileName.textContent = `${file.name} (otimizando banner...)`;

        try {
          // Compressão de imagem via Canvas (máximo 1200x400px JPEG)
          bannerComprimidoDataUrl = await comprimirBannerCanvas(file, 1200, 400, 0.82);
          bannerPreview.src = bannerComprimidoDataUrl;
          bannerFileName.textContent = `${file.name} (otimizado: 1200x400 JPEG)`;
        } catch (compErr) {
          console.warn('Falha na compressão do banner via Canvas, usando FileReader padrão:', compErr);
          const reader = new FileReader();
          reader.onload = (ev) => {
            bannerPreview.src = ev.target.result;
            bannerComprimidoDataUrl = ev.target.result;
          };
          reader.readAsDataURL(file);
          bannerFileName.textContent = file.name;
        }
      }
    });

    // Salvamento com Upload
    const form = overlay.querySelector('#formEditarTorneio');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSalvar = form.querySelector('#btnSalvarEdicao');
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

      // Remove aviso de erro anterior da tela se existir
      const erroAnterior = form.querySelector('.modal-error-feedback');
      if (erroAnterior) erroAnterior.remove();

      let bannerFinal = (torneio.banner && !torneio.banner.includes('cerradocup')) ? torneio.banner : '/images/logo_versushub.png';

      // Se o usuário selecionou um novo banner, garante a compressão Canvas (1200x400 JPEG)
      if (arquivoBannerNovo || bannerComprimidoDataUrl) {
        if (!bannerComprimidoDataUrl && arquivoBannerNovo) {
          try {
            bannerComprimidoDataUrl = await comprimirBannerCanvas(arquivoBannerNovo, 1200, 400, 0.82);
          } catch (cErr) {
            console.warn('Falha ao comprimir imagem antes de salvar:', cErr);
          }
        }

        bannerFinal = bannerComprimidoDataUrl || bannerPreview.src;

        // Se for data URL, tenta subir o blob comprimido para o Storage do Supabase
        if (bannerFinal && bannerFinal.startsWith('data:')) {
          try {
            const blobComprimido = dataURLtoBlob(bannerFinal);
            if (blobComprimido) {
              const fileName = `banner_${torneio.id}_${Date.now()}.jpg`;
              const filePath = `banners/${fileName}`;

              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('torneios')
                .upload(filePath, blobComprimido, {
                  contentType: 'image/jpeg',
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
              }
            }
          } catch (storageErr) {
            console.warn('Salvando banner comprimido JPEG diretamente no registro:', storageErr);
          }
        }
      }

      const novoNome = form.querySelector('#editNome').value.trim();
      const novoJogo = form.querySelector('#editJogo').value.trim();
      const novaData = form.querySelector('#editData').value.trim();
      const novaLocalizacao = form.querySelector('#editLocalizacao').value.trim();
      const novaModalidade = form.querySelector('#editModalidade').value;
      const editLimiteVal = parseInt(form.querySelector('#editLimite').value, 10) || 16;
      const novoLimite = `${editLimiteVal} vagas`;
      const novoStatus = torneio.status || 'Inscrições abertas';
      const novaCat = form.querySelector('#editCategoria').value;
      const novaPlat = form.querySelector('#editPlataforma').value;
      const editLinkInput = form.querySelector('#editLink');
      const novoLink = editLinkInput ? editLinkInput.value.trim() : (torneio.link || `/torneio/custom.html?id=${encodeURIComponent(torneio.id)}`);
      const novaDescricao = form.querySelector('#editDescricao').value.trim();
      const novasRegras = form.querySelector('#editRegras').value.trim();
      const novosRequisitos = form.querySelector('#editRequisitos').value.trim();

      const novoStatusClass = novoStatus.toLowerCase().includes('andamento') || novoStatus.toLowerCase().includes('vivo') ? 'status-andamento' :
                              novoStatus.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto';

      const selFormatoVal = form.querySelector('#editFormatoTorneio') ? form.querySelector('#editFormatoTorneio').value : (torneio.formato || torneio.formato_torneio || 'Mata-Mata (Eliminatória)');
      const selTipoInscVal = form.querySelector('#editTipoInscricao') ? form.querySelector('#editTipoInscricao').value : (torneio.tipoInscricao || 'Solo ou Equipe');
      const inputMaxIntegVal = form.querySelector('#editMaxIntegrantes') ? (parseInt(form.querySelector('#editMaxIntegrantes').value, 10) || obterMaxIntegrantesTorneio(torneio)) : obterMaxIntegrantesTorneio(torneio);

      // 1. Preservar o Criador do Torneio (mantém coluna criadorEmail com e-mail do criador original ou do usuário logado)
      const criadorEmailFinal = torneio.criadorEmail || torneio.criador_email || loggedUser?.email || '';

      const updatePayload = {
        nome: novoNome,
        jogo: novoJogo,
        data: novaData,
        localizacao: novaLocalizacao,
        modalidade: novaModalidade,
        limite: novoLimite,
        maxParticipantes: editLimiteVal,
        max_participantes: editLimiteVal,
        tipoInscricao: selTipoInscVal,
        tipo_inscricao: selTipoInscVal,
        formato: selFormatoVal,
        maxIntegrantes: inputMaxIntegVal,
        max_integrantes: inputMaxIntegVal,
        status: novoStatus,
        statusClass: novoStatusClass,
        categoria: novaCat,
        plataforma: novaPlat,
        link: novoLink,
        descricao: novaDescricao,
        regras: novasRegras,
        requisitos: novosRequisitos,
        banner: bannerFinal,
        criadorEmail: criadorEmailFinal
      };

      try {
        let { error } = await supabase
          .from('torneios')
          .update(updatePayload)
          .eq('id', torneio.id);

        if (error) {
          // Fallback resiliente preservando tipoInscricao e tipo_inscricao
          const fallbackCamel = { ...updatePayload };
          delete fallbackCamel.max_participantes;
          delete fallbackCamel.max_integrantes;
          const resCamel = await supabase.from('torneios').update(fallbackCamel).eq('id', torneio.id);
          if (!resCamel.error) {
            error = null;
          } else {
            const fallbackSnake = { ...updatePayload };
            delete fallbackSnake.maxParticipantes;
            delete fallbackSnake.maxIntegrantes;
            const resSnake = await supabase.from('torneios').update(fallbackSnake).eq('id', torneio.id);
            if (!resSnake.error) {
              error = null;
            } else {
              const fallbackBase = { ...updatePayload };
              delete fallbackBase.maxParticipantes;
              delete fallbackBase.max_participantes;
              delete fallbackBase.maxIntegrantes;
              delete fallbackBase.max_integrantes;
              const resBase = await supabase.from('torneios').update(fallbackBase).eq('id', torneio.id);
              if (!resBase.error) error = null;
            }
          }
        }

        if (error) {
          const msgErro = error.message || 'Erro desconhecido retornado pelo servidor';
          console.error('Erro ao atualizar torneio:', msgErro, error);
          showToast(`Erro ao atualizar torneio: ${msgErro}`, 'error');

          // Exibe o erro detalhado diretamente na tela (dentro do modal de edição)
          let errorBox = form.querySelector('.modal-error-feedback');
          if (!errorBox) {
            errorBox = document.createElement('div');
            errorBox.className = 'modal-error-feedback';
            errorBox.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 14px; display: flex; align-items: center; gap: 8px; line-height: 1.4;';
            form.appendChild(errorBox);
          }
          errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; flex-shrink: 0;"></i> <span><strong>Erro do Servidor:</strong> ${escapeHtml(msgErro)}</span>`;
          errorBox.style.display = 'flex';

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
        const msgErro = err?.message || 'Falha inesperada ao tentar salvar';
        console.error('Falha na edição do torneio:', msgErro, err);
        showToast(`Ocorreu um erro ao salvar: ${msgErro}`, 'error');

        let errorBox = form.querySelector('.modal-error-feedback');
        if (!errorBox) {
          errorBox = document.createElement('div');
          errorBox.className = 'modal-error-feedback';
          errorBox.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 14px; display: flex; align-items: center; gap: 8px; line-height: 1.4;';
          form.appendChild(errorBox);
        }
        errorBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; flex-shrink: 0;"></i> <span><strong>Erro:</strong> ${escapeHtml(msgErro)}</span>`;
        errorBox.style.display = 'flex';

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

    const banner = (torneio.banner && typeof torneio.banner === 'string' && !torneio.banner.includes('cerradocup')) ? torneio.banner : '/images/logo_versushub.png';
    const vagasNum = parseInt(torneio.maxParticipantes || torneio.max_participantes || (torneio.limite ? (torneio.limite.match(/\d+/) ? torneio.limite.match(/\d+/)[0] : '16') : '16'), 10) || 16;
    const modalidadeTexto = (torneio.modalidade === 'presencial') ? 'Presencial' : 'Online';

    let statusClass = torneio.statusClass || (
      torneio.status && (torneio.status.toLowerCase().includes('andamento') || torneio.status.toLowerCase().includes('vivo')) ? 'status-andamento' :
      torneio.status && torneio.status.toLowerCase().includes('encerrado') ? 'status-encerrado' : 'status-aberto'
    );
    let statusTexto = torneio.status || 'Inscrições abertas';

    const link = '/torneio/custom.html?id=' + encodeURIComponent(torneio.id);

    // Botões de Ação para a aba "Seus torneios" (sem botão de transmissão, design profissional)
    let botoesAcao = '';

    if (tabKey === 'created') {
      botoesAcao = `
        <div class="manage-actions-stack">
          <button type="button" class="btn-manage-primary btn-solicitacoes" data-id="${escapeHtml(torneio.id)}">
            <i class="fa-solid fa-users"></i> Gerenciar Inscrições
          </button>
          <button type="button" class="btn-manage-secondary btn-chaveamento" data-id="${escapeHtml(torneio.id)}">
            <i class="fa-solid fa-sitemap"></i> Chaveamento & Partidas
          </button>
          <button type="button" class="btn-manage-neutral btn-convidar-torneio" data-id="${escapeHtml(torneio.id)}" data-nome="${escapeHtml(torneio.nome || '')}" style="background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.35); color: #93c5fd; font-weight: 600;">
            <i class="fa-solid fa-paper-plane" style="color: #3b82f6;"></i> Convidar Participantes
          </button>
          <div class="manage-actions-row">
            <button type="button" class="btn-manage-neutral btn-editar" data-id="${escapeHtml(torneio.id)}">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
            <button type="button" class="btn-manage-danger btn-excluir" data-id="${escapeHtml(torneio.id)}">
              <i class="fa-solid fa-trash-can"></i> Excluir
            </button>
          </div>
        </div>
      `;
    }

    let badgeStatusInscricao = '';
    if (tabKey === 'joined' && torneio.inscricaoStatus) {
      badgeStatusInscricao = `<div class="manage-inscricao-chip"><i class="fa-solid fa-circle-check"></i> Inscrição: ${escapeHtml(torneio.inscricaoStatus)}</div>`;
    }

    article.innerHTML = `
      <div class="manage-card-banner-wrapper">
        <img referrerpolicy="no-referrer" src="${banner}" alt="${escapeHtml(torneio.nome || '')}" onerror="this.onerror=null;this.src='/images/logo_versushub.png';">
        <div class="manage-banner-overlay"></div>
        <span class="manage-card-format-tag"><i class="fa-solid fa-location-dot" style="font-size: 10px;"></i> ${escapeHtml(modalidadeTexto)}</span>
        <span class="manage-card-status-badge ${statusClass}">${escapeHtml(statusTexto.replace(/<[^>]*>/g, ''))}</span>
      </div>
      <div class="card-info manage-card-body">
        <h2 title="${escapeHtml(torneio.nome || '')}">${escapeHtml(torneio.nome || 'Torneio sem título')}</h2>
        <div class="manage-meta-list">
          <span class="manage-meta-tag"><i class="fa-solid fa-gamepad" style="color: #ef4444;"></i> ${escapeHtml(torneio.jogo || 'Geral')}</span>
          <span class="manage-meta-tag"><i class="fa-solid fa-calendar-days" style="color: #9ca3af;"></i> ${escapeHtml(torneio.data || 'Data a definir')}</span>
          <span class="manage-meta-tag"><i class="fa-solid fa-users" style="color: #60a5fa;"></i> Capacidade: ${vagasNum} vagas</span>
        </div>
        ${badgeStatusInscricao}
        <a href="${link}" class="btn-ver-torneio">
          <span>Acessar Torneio</span>
          <i class="fa-solid fa-arrow-right"></i>
        </a>
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
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <h3><i class="fa-solid fa-users" style="color: #60a5fa;"></i> Inscrições: ${escapeHtml(torneio.nome || 'Torneio')}</h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-manage-neutral btn-abrir-convidar-modal" data-id="${escapeHtml(torneio.id)}" data-nome="${escapeHtml(torneio.nome || '')}" style="background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #93c5fd; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-paper-plane" style="color: #3b82f6;"></i> Convidar
            </button>
            <button type="button" class="btn-close-modal" id="btnFecharModalInsc" aria-label="Fechar">&times;</button>
          </div>
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
          .select('id, torneio_id, id_participante, tipo, status, user_email, nome_participante, foto_participante, lineup, created_at')
          .eq('torneio_id', String(torneio.id))
          .eq('status', 'Pendente');

        if (!error && Array.isArray(data)) {
          pendentes = data;
        } else if (error) {
          console.warn('Aviso ao carregar inscrições pendentes do Supabase:', error);
        }
      } catch (errDb) {
        console.warn('Aviso ao carregar inscrições pendentes do Supabase:', errDb);
      }

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
        let lineupList = [];

        // Extrai lineup gravada na inscrição
        if (insc.lineup) {
          if (Array.isArray(insc.lineup)) {
            lineupList = insc.lineup;
          } else if (typeof insc.lineup === 'string') {
            try { lineupList = JSON.parse(insc.lineup); } catch (e) {}
          }
        }

        if (tipo === 'equipe') {
          try {
            let eqData = null;

            // 1. Consulte a tabela 'equipes' no Supabase buscando tanto pelo ID quanto pelo nome da equipe
            try {
              const { data: resOr, error: errOr } = await supabase
                .from('equipes')
                .select('id, nome, tag, logo, leaderName, leaderEmail')
                .or(`id.eq.${idPart},nome.eq.${idPart}`)
                .maybeSingle();

              if (!errOr && resOr) {
                eqData = resOr;
              }
            } catch (eOr) {}

            if (!eqData) {
              try {
                const { data: resById } = await supabase
                  .from('equipes')
                  .select('id, nome, tag, logo, leaderName, leaderEmail')
                  .eq('id', String(idPart))
                  .maybeSingle();

                if (resById) {
                  eqData = resById;
                } else {
                  const { data: resByNome } = await supabase
                    .from('equipes')
                    .select('id, nome, tag, logo, leaderName, leaderEmail')
                    .eq('nome', String(idPart))
                    .maybeSingle();
                  if (resByNome) eqData = resByNome;
                }
              } catch (eFallback) {}
            }

            // 2. RENDERIZAÇÃO DO CARD DE SOLICITAÇÃO
            if (eqData) {
              nome = eqData.nome + (eqData.tag ? ` [${eqData.tag}]` : '');
              foto = eqData.logo || '/image/logo.png';
              sub = `Líder: ${eqData.leaderName || eqData.leaderEmail || insc.user_email}`;
              if (window.setCachedImage && eqData.logo) {
                window.setCachedImage(`team_logo_${idPart}`, eqData.logo);
              }
            } else {
              // Se não for encontrada no banco remoto, busque no cache local (vh_createdTeams / vh_cachedEquipes) pelo id ou nome
              let found = null;
              try {
                const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
                const cachedTeams = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
                const allLocal = [...localTeams, ...cachedTeams];

                found = allLocal.find(t => 
                  String(t.id) === String(idPart) || 
                  (t.nome && String(t.nome).toLowerCase() === String(idPart).toLowerCase())
                );
              } catch (eLoc) {}

              if (found) {
                nome = found.nome + (found.tag ? ` [${found.tag}]` : '');
                foto = found.logo || '/image/logo.png';
                sub = `Líder: ${found.leaderName || found.leaderEmail || insc.user_email}`;
              } else {
                if (insc.equipe_nome) {
                  nome = insc.equipe_nome;
                } else if (String(idPart).startsWith('team-')) {
                  nome = 'Equipe ' + String(idPart).replace('team-', '');
                } else {
                  nome = idPart;
                }
                foto = (window.getCachedImage && window.getCachedImage(`team_logo_${idPart}`)) || '/image/logo.png';
                sub = `Líder: ${insc.user_email || 'Não informado'}`;
              }
            }

            // Fallback para buscar a lineup na tabela membros_equipe caso esteja vazia na inscrição
            if (!lineupList || lineupList.length === 0) {
              try {
                const searchIds = [String(idPart)];
                if (eqData?.id) searchIds.push(String(eqData.id));
                if (eqData?.nome) searchIds.push(String(eqData.nome));

                const { data: membrosAceitos } = await supabase
                  .from('membros_equipe')
                  .select('id, user_email, status')
                  .in('equipe_id', searchIds)
                  .eq('status', 'Aceito');

                if (Array.isArray(membrosAceitos) && membrosAceitos.length > 0) {
                  const emails = Array.from(new Set(membrosAceitos.map(m => m.user_email).filter(Boolean)));
                  if (emails.length > 0) {
                    const { data: uData } = await supabase
                      .from('usuarios')
                      .select('id, nome, email, avatar')
                      .in('email', emails);

                    const uMap = new Map((uData || []).map(u => [u.email, u]));
                    lineupList = emails.map(em => {
                      const u = uMap.get(em) || {};
                      return {
                        id: u.id || em,
                        email: em,
                        nome: u.nome || em.split('@')[0],
                        avatar: u.avatar || '/image/boneco_logo_ofc.png'
                      };
                    });
                  }
                }
              } catch (errLineupFb) {
                console.warn('Erro ao carregar lineup fallback:', errLineupFb);
              }
            }

          } catch (errEq) {
            console.warn('Erro ao consultar equipe:', errEq);
          }
        } else {
          try {
            const { data: uData } = await supabase
              .from('usuarios')
              .select('id, nome, email, avatar')
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
          sub,
          lineup: lineupList
        };
      });

      const detalhes = await Promise.all(promessas);

      container.innerHTML = detalhes.map(item => `
        <div class="solicitacao-card" style="display: flex; flex-direction: column; gap: 10px; background: #161622; border: 1px solid #28283a; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; width: 100%;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 200px; flex: 1;">
              <img
                src="${item.foto}"
                alt="${escapeHtml(item.nome)}"
                onerror="this.src='/image/boneco_logo_ofc.png'"
                style="width: 46px; height: 46px; border-radius: ${item.tipo === 'equipe' ? '10px' : '50%'}; object-fit: cover; border: 2px solid ${item.tipo === 'equipe' ? '#3b82f6' : '#ef4444'}; flex-shrink: 0;"
              / referrerpolicy="no-referrer">
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <strong style="color: #ffffff; font-size: 14px; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">${escapeHtml(item.nome)}</strong>
                  <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: ${item.tipo === 'equipe' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${item.tipo === 'equipe' ? '#60a5fa' : '#f87171'}; border: 1px solid ${item.tipo === 'equipe' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
                    <i class="fa-solid ${item.tipo === 'equipe' ? 'fa-shield-halved' : 'fa-user'}"></i> ${item.tipo === 'equipe' ? 'Equipe' : 'Individual'}
                  </span>
                </div>
                <span style="display: block; font-size: 12px; color: #9ca3af; margin-top: 3px;">${escapeHtml(item.sub)}</span>

                ${item.tipo === 'equipe' && item.lineup && item.lineup.length > 0 ? `
                  <div style="margin-top: 6px;">
                    <button
                      type="button"
                      class="btn-toggle-lineup-modal"
                      data-card-id="${escapeHtml(item.id)}"
                      style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;"
                    >
                      <i class="fa-solid fa-users"></i> Ver Escalados (${item.lineup.length}) <i class="fa-solid fa-chevron-down" style="font-size: 10px;"></i>
                    </button>
                  </div>
                ` : ''}
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

          ${item.tipo === 'equipe' && item.lineup && item.lineup.length > 0 ? `
            <div id="lineup-expand-${escapeHtml(item.id)}" style="display: none; width: 100%; margin-top: 6px; padding: 10px 12px; background: #11111a; border: 1px solid #2b2b3d; border-radius: 8px; box-sizing: border-box;">
              <div style="font-size: 12px; font-weight: 700; color: #818cf8; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-list-check"></i> Line-up Escalada (${item.lineup.length} Jogadores)
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px;">
                ${item.lineup.map(p => `
                  <div style="display: flex; align-items: center; gap: 8px; background: #1a1a26; padding: 6px 10px; border-radius: 6px; border: 1px solid #2a2a3c;">
                    <img src="${p.avatar || p.foto || '/image/boneco_logo_ofc.png'}" alt="${escapeHtml(p.nome || 'Jogador')}" onerror="this.src='/image/boneco_logo_ofc.png'" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid #3b82f6; flex-shrink: 0;" / referrerpolicy="no-referrer">
                    <div style="overflow: hidden;">
                      <div style="font-size: 12px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.nome || p.email || 'Jogador')}</div>
                      <div style="font-size: 10px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.email || '')}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `).join('');

      // Listener para toggle da lineup
      container.querySelectorAll('.btn-toggle-lineup-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const cardId = btn.getAttribute('data-card-id');
          const expandContainer = container.querySelector(`#lineup-expand-${cardId}`);
          if (expandContainer) {
            const isHidden = expandContainer.style.display === 'none';
            expandContainer.style.display = isHidden ? 'block' : 'none';
            btn.style.background = isHidden ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.15)';
          }
        });
      });

      const isUuidValido = (id) => typeof id === 'string' && id.length === 36 && id.includes('-');

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
            const nomeTorneio = (torneio && torneio.nome) ? torneio.nome : 'Torneio';
            let targetInscEmail = (userEmail || '').toLowerCase().trim();
            if (!targetInscEmail && idPart && idPart.includes('@')) {
              targetInscEmail = idPart.toLowerCase().trim();
            }

            // Atualiza Supabase com validação estrita de UUID e fallback por torneio_id + user_email / id_participante
            let atualizou = false;
            const novoStatus = 'Aceito';

            if (isUuidValido(idInsc)) {
              try {
                const { data, error } = await supabase.from('inscricoes').update({ status: novoStatus }).eq('id', idInsc).select();
                if (!error && data && data.length > 0) atualizou = true;
              } catch (e) {}
            }

            if (!atualizou) {
              try {
                if (userEmail) {
                  await supabase.from('inscricoes').update({ status: novoStatus }).eq('torneio_id', String(idTorneio)).eq('user_email', userEmail);
                }
                if (idPart) {
                  await supabase.from('inscricoes').update({ status: novoStatus }).eq('torneio_id', String(idTorneio)).eq('id_participante', String(idPart));
                }
              } catch (e) {}
            }

            const emailParticipante = (userEmail || '').trim().toLowerCase();
            if (emailParticipante) {
              try {
                await supabase.from('notificacoes').insert([{
                  user_email: emailParticipante,
                  titulo: 'Inscrição Confirmada!',
                  mensagem: `Sua inscrição no torneio foi aprovada pelo organizador!`,
                  tipo: 'torneio',
                  link: `/torneio/custom.html?id=${idTorneio}`,
                  lida: false
                }]);
              } catch (eNotif) {}
            }
          } catch (errDb) {
            console.warn('[VersusHub Torneios] Aviso ao atualizar inscrição no Supabase:', errDb?.message || errDb);
          }

          // Atualiza cache local vh_inscricoes e vh_joinedTournaments_
          try {
            const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
            allLocal.forEach(i => {
              if (
                String(i.torneio_id) === String(idTorneio) &&
                ((idInsc && String(i.id) === String(idInsc)) ||
                 (idPart && String(i.id_participante) === String(idPart)) ||
                 (userEmail && String(i.user_email).toLowerCase() === String(userEmail).toLowerCase()))
              ) {
                i.status = 'Aceito';
              }
            });
            try { localStorage.setItem('vh_inscricoes', JSON.stringify(allLocal)); } catch (eSet) {}

            // Atualiza status em vh_joinedTournaments_ do usuário
            const targetEmailKey = userEmail || idPart || '';
            if (targetEmailKey) {
              const storageKey = `vh_joinedTournaments_${targetEmailKey}`;
              const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
              joined.forEach(j => {
                if (String(j.id) === String(idTorneio) || String(j.torneio_id) === String(idTorneio)) {
                  j.inscricaoStatus = 'Aceito';
                  j.status = 'Aceito';
                }
              });
              try { localStorage.setItem(storageKey, JSON.stringify(joined)); } catch (eSet) {}
            }
          } catch (eLocal) {
            console.warn('Erro ao atualizar cache local de inscricoes:', eLocal);
          }

          if (typeof showToast === 'function') {
            showToast('Inscrição aceita com sucesso!');
          }

          // Atualiza a contagem de participantes confirmados na tela do torneio e dispara eventos
          if (typeof carregarParticipantesConfirmados === 'function') {
            try { carregarParticipantesConfirmados(idTorneio, null, torneio); } catch (e) {}
          }
          if (typeof window.carregarParticipantesConfirmados === 'function') {
            try { window.carregarParticipantesConfirmados(idTorneio, null, torneio); } catch (e) {}
          }

          const payloadEv = { detail: { torneioId: idTorneio }, bubbles: true };
          document.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));
          window.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));
          document.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
          window.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));

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

          const confirmou = await abrirModalConfirmacao({
            titulo: 'Recusar Inscrição',
            mensagem: 'Deseja realmente recusar esta solicitação de inscrição?',
            subtexto: 'O participante será removido da lista do torneio e não constará no chaveamento.',
            tipoIcone: 'warning',
            textoConfirmar: 'Sim, Recusar',
            iconeConfirmar: 'fa-solid fa-user-xmark'
          });
          if (!confirmou) return;

          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recusando...';

          try {
            let deletou = false;

            // Delete por UUID se for válido
            if (isUuidValido(idInsc)) {
              try {
                const { data, error } = await supabase.from('inscricoes').delete().eq('id', idInsc).select();
                if (!error && data && data.length > 0) deletou = true;
              } catch (e) {}
            }

            // Fallback obrigatório por torneio_id + user_email / id_participante
            if (!deletou) {
              try {
                if (userEmail) {
                  await supabase.from('inscricoes').delete().eq('torneio_id', String(idTorneio)).eq('user_email', userEmail);
                }
                if (idPart) {
                  await supabase.from('inscricoes').delete().eq('torneio_id', String(idTorneio)).eq('id_participante', String(idPart));
                }
              } catch (e) {}
            }
          } catch (errDb) {
            console.warn('Erro ao deletar inscrição no Supabase:', errDb);
          }

          // Remove do cache local vh_inscricoes e vh_joinedTournaments_
          try {
            const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
            const filtrado = allLocal.filter(i => {
              if (String(i.torneio_id) !== String(idTorneio)) return true;
              if (idInsc && String(i.id) === String(idInsc)) return false;
              if (userEmail && String(i.user_email).toLowerCase() === String(userEmail).toLowerCase()) return false;
              if (idPart && (String(i.id_participante) === String(idPart) || String(i.equipe_nome) === String(idPart))) return false;
              return true;
            });
            try { localStorage.setItem('vh_inscricoes', JSON.stringify(filtrado)); } catch (eSet) {}

            const targetEmailKey = userEmail || idPart || '';
            if (targetEmailKey) {
              const storageKey = `vh_joinedTournaments_${targetEmailKey}`;
              const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const joinedFiltrado = (Array.isArray(joined) ? joined : []).filter(j => String(j.id) !== String(idTorneio) && String(j.torneio_id) !== String(idTorneio));
              try { localStorage.setItem(storageKey, JSON.stringify(joinedFiltrado)); } catch (eSet) {}
            }
          } catch (eLocal) {}

          if (typeof showToast === 'function') {
            showToast('Inscrição recusada.');
          }

          // Atualiza a contagem de participantes confirmados na tela do torneio e dispara eventos
          if (typeof carregarParticipantesConfirmados === 'function') {
            try { carregarParticipantesConfirmados(idTorneio, null, torneio); } catch (e) {}
          }
          if (typeof window.carregarParticipantesConfirmados === 'function') {
            try { window.carregarParticipantesConfirmados(idTorneio, null, torneio); } catch (e) {}
          }

          const payloadEv = { detail: { torneioId: idTorneio }, bubbles: true };
          document.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));
          window.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));
          document.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
          window.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));

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
  // AÇÃO 4: GERENCIADOR E SORTEIO DO CHAVEAMENTO / BRACKETS
  // ==============================================================================
  async function abrirModalGerenciarChaveamento(torneio) {
    const antigo = document.getElementById('modalGerenciarChaveamento');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalGerenciarChaveamento';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100000';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 1040px; width: 96%; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255, 59, 48, 0.15); border: 1px solid rgba(255, 59, 48, 0.35); display: flex; align-items: center; justify-content: center; font-size: 20px; color: #ff3b30;">
              <i class="fa-solid fa-gamepad"></i>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 19px; color: #ffffff;">Partidas & Confrontos: ${escapeHtml(torneio.nome || 'Torneio')}</h3>
              <p style="font-size: 13px; color: #9ca3af; margin: 4px 0 0 0;">
                Crie confrontos livremente entre os competidores inscritos, registre placares e marque vencedores.
              </p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" id="btnFecharModalChave" aria-label="Fechar">&times;</button>
        </div>

        <!-- Barra de Ações do Organizador -->
        <div class="bracket-modal-toolbar" style="flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; background: #161524; border: 1px solid #27263c; padding: 12px 18px; border-radius: 12px;">
          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <span id="badgeInfoPartidas" style="font-size: 13px; font-weight: 700; color: #e5e7eb; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-gamepad" style="color: #ff3b30;"></i> <span id="textoQtdPartidas">Consultando partidas...</span>
            </span>
            <span id="badgeInfoConfirmados" style="font-size: 13px; color: #9ca3af; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-users" style="color: #10b981;"></i> <span id="textoQtdConfirmados">Carregando inscritos...</span>
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <a href="/torneio/custom.html?id=${encodeURIComponent(torneio.id)}&tab=brackets" target="_blank" rel="noopener noreferrer" style="background: #1e1d2c; color: #93c5fd; border: 1px solid #333249; font-weight: 600; padding: 8px 14px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Página Pública
            </a>
          </div>
        </div>

        <!-- Área de renderização dos cards das partidas -->
        <div id="modalBracketTreeContainer" style="flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 280px; padding-right: 4px;">
          <div style="text-align: center; padding: 48px; color: #9ca3af;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: #ff3b30; margin-bottom: 12px; display: block;"></i>
            <span>Carregando partidas do torneio...</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const btnClose = overlay.querySelector('#btnFecharModalChave');
    function fechar() {
      overlay.remove();
    }
    btnClose.addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fechar();
    });

    const container = overlay.querySelector('#modalBracketTreeContainer');
    const textoQtdPartidas = overlay.querySelector('#textoQtdPartidas');
    const textoQtdConfirmados = overlay.querySelector('#textoQtdConfirmados');

    let partidasDoTorneio = [];
    let participantesConfirmados = [];

    async function atualizarModal() {
      try {
        const [parts, confs] = await Promise.all([
          carregarPartidasTorneio(torneio.id),
          buscarParticipantesConfirmados(torneio.id)
        ]);
        partidasDoTorneio = parts || [];
        participantesConfirmados = confs || [];

        if (textoQtdConfirmados) {
          textoQtdConfirmados.textContent = `${participantesConfirmados.length} participante(s) confirmado(s)`;
        }

        if (textoQtdPartidas) {
          if (partidasDoTorneio.length > 0) {
            textoQtdPartidas.textContent = `${partidasDoTorneio.length} confronto(s) criado(s)`;
          } else {
            textoQtdPartidas.textContent = 'Nenhuma partida criada';
          }
        }

        const tipoInsc = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
        const isTorneioSolo = tipoInsc === 'Apenas Solo (1v1)';
        const isTorneioEquipe = tipoInsc === 'Apenas Equipe';

        renderizarChaveamentoVisual(container, partidasDoTorneio, {
          torneioId: torneio.id,
          permiteEditar: true,
          isEncerrado: torneio.status === 'Encerrado',
          statusTorneio: torneio.status,
          participantesConfirmados,
          isTorneioSolo,
          isTorneioEquipe,
          torneioTipo: tipoInsc,
          onAtualizado: () => {
            atualizarModal();
            render('created');
          },
          onEncerrarTorneio: () => {
            abrirModalConfirmacaoEncerramentoTorneio({
              torneioId: torneio.id,
              onConcluido: () => {
                atualizarModal();
                render('created');
              }
            });
          },
          onCriarPartida: () => {
            abrirModalCriarPartidaManual(torneio.id, participantesConfirmados, () => {
              atualizarModal();
              render('created');
            }, { isTorneioSolo, isTorneioEquipe });
          }
        });
      } catch (err) {
        console.error('Erro ao atualizar modal do chaveamento:', err);
      }
    }

    await atualizarModal();
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
      const confirmou = await abrirModalConfirmacao({
        titulo: 'Excluir Torneio',
        mensagem: 'Deseja realmente excluir permanentemente este torneio?',
        subtexto: 'Esta ação não pode ser desfeita. Todos os confrontos do chaveamento e inscrições serão removidos.',
        tipoIcone: 'danger',
        textoConfirmar: 'Sim, Excluir Torneio',
        iconeConfirmar: 'fa-solid fa-trash-can'
      });
      if (confirmou) {
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

    // 2. Editar Torneio
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

    // Convidar Participantes para o Torneio
    const btnConvidar = e.target.closest('.btn-convidar-torneio, .btn-abrir-convidar-modal');
    if (btnConvidar) {
      e.preventDefault();
      const id = btnConvidar.dataset.id;
      const nome = btnConvidar.dataset.nome || 'Torneio';
      abrirModalConvidarParticipantes(id, nome);
      return;
    }

    // 6. Gerenciar / Gerar Chaveamento (Ação 4)
    const btnChaveamento = e.target.closest('.btn-chaveamento');
    if (btnChaveamento) {
      e.preventDefault();
      const id = btnChaveamento.dataset.id;
      const torneio = userCreatedTournaments.find(t => String(t.id) === String(id)) || { id, nome: 'Torneio' };
      abrirModalGerenciarChaveamento(torneio);
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
        await carregarTorneiosFrequentados();
      }

      render(chave);
    });
  });

  // Carga inicial assíncrona com tela de carregamento
  showLoadingState();
  await carregarTorneiosCriados();
  await carregarTorneiosInscritos();
  await carregarTorneiosFrequentados();

  render('created');

  // Abre automaticamente o modal de chaveamento se passado via parâmetro na URL
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const chaveId = urlParams.get('chaveTorneioId');
    if (chaveId) {
      const torneioAlvo = userCreatedTournaments.find(t => String(t.id) === String(chaveId));
      if (torneioAlvo) {
        setTimeout(() => {
          abrirModalGerenciarChaveamento(torneioAlvo);
        }, 150);
      }
    }
  } catch (e) {}
});

 
// ==========================================
// MODAL DE CONVIDAR PARTICIPANTES / EQUIPES (ORGANIZADOR)
// ==========================================
function abrirModalConvidarParticipantes(torneioId, torneioNome) {
  let modal = document.getElementById('modalConvidarParticipantesManage');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalConvidarParticipantesManage';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 560px; max-height: 90vh; overflow: hidden; padding: 0; background: #111118; border: 1px solid #28283a; border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); display: flex; flex-direction: column;">
      <div class="modal-header" style="padding: 18px 24px; border-bottom: 1px solid #232332; display: flex; justify-content: space-between; align-items: center; background: #161622;">
        <h3 style="margin: 0; color: #ffffff; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-paper-plane" style="color: #3b82f6;"></i> Convidar Participantes
        </h3>
        <button type="button" class="btn-close-modal" id="btnFecharModalConvidarManage" aria-label="Fechar" style="background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 4px;">&times;</button>
      </div>
      <div style="padding: 20px 24px;">
        <p style="color: #9ca3af; font-size: 13.5px; margin-top: 0; margin-bottom: 14px; line-height: 1.5;">
          Pesquise jogadores ou equipes no VersusHub para enviar convites diretos para <strong style="color: #ffffff;">"${escapeHtml(torneioNome || 'o torneio')}"</strong>:
        </p>
        <div style="position: relative; margin-bottom: 14px;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 13px; color: #6b7280;"></i>
          <input
            type="text"
            id="inputBuscaPartManage"
            placeholder="Digite nome de jogador, equipe ou e-mail..."
            style="width: 100%; box-sizing: border-box; padding: 11px 14px 11px 40px; background: #161622; border: 1px solid #2a2a3c; border-radius: 10px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s;"
          />
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
          <button type="button" class="btn-filtro-manage active" data-filter="todos" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.2); color: #93c5fd; font-size: 12px; font-weight: 600; cursor: pointer;">Todos</button>
          <button type="button" class="btn-filtro-manage" data-filter="jogadores" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #2a2a3c; background: #161622; color: #9ca3af; font-size: 12px; font-weight: 600; cursor: pointer;">Jogadores</button>
          <button type="button" class="btn-filtro-manage" data-filter="equipes" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #2a2a3c; background: #161622; color: #9ca3af; font-size: 12px; font-weight: 600; cursor: pointer;">Equipes</button>
        </div>
        <div id="listaResultadosPartManage" style="max-height: 330px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px;">
          <div style="text-align: center; color: #6b7280; padding: 30px 10px; font-size: 13.5px;">
            <i class="fa-solid fa-user-group" style="font-size: 28px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
            Digite no campo acima para pesquisar jogadores e equipes.
          </div>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const btnFechar = document.getElementById('btnFecharModalConvidarManage');
  btnFechar.onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  const inputBusca = document.getElementById('inputBuscaPartManage');
  const listaContainer = document.getElementById('listaResultadosPartManage');
  const filtroBtns = modal.querySelectorAll('.btn-filtro-manage');

  let filtroAtual = 'todos';
  let debounceTimeout = null;

  filtroBtns.forEach(b => {
    b.addEventListener('click', () => {
      filtroBtns.forEach(btn => {
        btn.classList.remove('active');
        btn.style.border = '1px solid #2a2a3c';
        btn.style.background = '#161622';
        btn.style.color = '#9ca3af';
      });
      b.classList.add('active');
      b.style.border = '1px solid #3b82f6';
      b.style.background = 'rgba(59, 130, 246, 0.2)';
      b.style.color = '#93c5fd';
      filtroAtual = b.dataset.filter;
      executarBusca();
    });
  });

  function executarBusca() {
    const q = inputBusca.value.trim();
    if (!q || q.length < 2) {
      listaContainer.innerHTML = `
        <div style="text-align: center; color: #6b7280; padding: 30px 10px; font-size: 13.5px;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 26px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
          Digite pelo menos 2 caracteres para pesquisar...
        </div>
      `;
      return;
    }
    pesquisarParticipantesManage(q, filtroAtual, torneioId, torneioNome, listaContainer);
  }

  inputBusca.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(executarBusca, 280);
  });

  inputBusca.focus();
}

async function pesquisarParticipantesManage(termo, filtro, torneioId, torneioNome, container) {
  container.innerHTML = `
    <div style="text-align: center; color: #9ca3af; padding: 25px; font-size: 14px;">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px; color: #3b82f6;"></i> Buscando...
    </div>
  `;

  try {
    let resultados = [];

    // 1. Jogadores
    if (filtro === 'todos' || filtro === 'jogadores') {
      const { data: users, error: errU } = await supabase
        .from('usuarios')
        .select('id, nome, email, avatar')
        .or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`)
        .limit(8);

      if (!errU && users) {
        users.forEach(u => {
          resultados.push({
            tipo: 'individual',
            id: u.id,
            nome: u.nome || u.email.split('@')[0],
            email: u.email,
            avatar: u.avatar || '/image/boneco_logo_ofc.png',
            detalhe: u.email
          });
        });
      }
    }

    // 2. Equipes
    if (filtro === 'todos' || filtro === 'equipes') {
      const { data: teams, error: errT } = await supabase
        .from('equipes')
        .select('id, nome, tag, logo, leaderEmail')
        .or(`nome.ilike.%${termo}%,tag.ilike.%${termo}%,leaderEmail.ilike.%${termo}%`)
        .limit(8);

      if (!errT && teams) {
        teams.forEach(t => {
          resultados.push({
            tipo: 'equipe',
            id: t.id,
            nome: t.nome,
            tag: t.tag,
            email: t.leaderEmail,
            avatar: t.logo || '/image/logo.png',
            detalhe: t.tag ? `[${t.tag}] • Líder: ${t.leaderEmail || 'N/A'}` : (t.leaderEmail || 'Equipe')
          });
        });
      }
    }

    if (resultados.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #9ca3af; padding: 30px 10px; font-size: 13.5px;">
          <i class="fa-solid fa-user-slash" style="font-size: 26px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
          Nenhum jogador ou equipe encontrado com "${escapeHtml(termo)}".
        </div>
      `;
      return;
    }

    // 3. Consulta inscrições já existentes
    const emailsBusca = resultados.map(r => r.email).filter(Boolean);
    let inscricoesExistentes = [];
    if (emailsBusca.length > 0) {
      const { data: inscs } = await supabase
        .from('inscricoes')
        .select('user_email, status, id_participante')
        .eq('torneio_id', String(torneioId))
        .in('user_email', emailsBusca);
      inscricoesExistentes = inscs || [];
    }

    container.innerHTML = resultados.map(item => {
      const emailLower = (item.email || '').toLowerCase().trim();
      const jaInscrito = inscricoesExistentes.find(i => (i.user_email || '').toLowerCase().trim() === emailLower);
      const isEquipe = item.tipo === 'equipe';
      const badgeIcon = isEquipe ? 'fa-users' : 'fa-user';
      const badgeLabel = isEquipe ? 'Equipe' : 'Jogador';
      const badgeColor = isEquipe ? '#3b82f6' : '#10b981';

      let btnHtml = '';
      if (jaInscrito) {
        const statusTxt = jaInscrito.status === 'Aceito' ? 'Inscrito' : 'Convidado';
        btnHtml = `
          <button type="button" disabled style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #9ca3af; padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-check"></i> ${statusTxt}
          </button>
        `;
      } else {
        btnHtml = `
          <button type="button" class="btn-acao-convidar-manage" data-tipo="${item.tipo}" data-id="${escapeHtml(item.id)}" data-nome="${escapeHtml(item.nome)}" data-email="${escapeHtml(item.email || '')}" style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); border: 1px solid #60a5fa; color: #ffffff; padding: 7px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);">
            <i class="fa-solid fa-paper-plane"></i> Convidar
          </button>
        `;
      }

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #161622; border: 1px solid #232332; border-radius: 10px; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <img referrerpolicy="no-referrer" src="${item.avatar}" alt="${escapeHtml(item.nome)}" style="width: 40px; height: 40px; border-radius: ${isEquipe ? '10px' : '50%'}; object-fit: cover; border: 2px solid #2e2e42; flex-shrink: 0;" onerror="this.src='/image/boneco_logo_ofc.png'">
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="font-weight: 700; color: #ffffff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.nome)}</span>
                <span style="font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(59, 130, 246, 0.15); border: 1px solid ${badgeColor}; color: ${badgeColor};">
                  <i class="fa-solid ${badgeIcon}"></i> ${badgeLabel}
                </span>
              </div>
              <div style="font-size: 12px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.detalhe)}</div>
            </div>
          </div>
          <div>${btnHtml}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-acao-convidar-manage').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tipo = btn.dataset.tipo;
        const idPart = btn.dataset.id;
        const nomePart = btn.dataset.nome;
        const emailPart = (btn.dataset.email || '').trim().toLowerCase();

        if (!emailPart) {
          alert('Este participante não possui e-mail cadastrado para receber o convite.');
          return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Convidando...';

        try {
          // 1. Insert em inscricoes (status = Pendente)
          const payloadInsc = {
            torneio_id: String(torneioId),
            user_email: emailPart,
            tipo: tipo === 'equipe' ? 'equipe' : 'individual',
            id_participante: tipo === 'equipe' ? String(idPart) : String(idPart || emailPart),
            equipe_nome: tipo === 'equipe' ? nomePart : '',
            status: 'Pendente'
          };

          const { error: insErr } = await supabase
            .from('inscricoes')
            .insert([payloadInsc]);

          if (insErr) {
            console.error('Erro ao registrar convite em inscricoes:', insErr);
          }

          // 2. Disparar notificação no Supabase
          const { error: notifErr } = await supabase
            .from('notificacoes')
            .insert([{
              user_email: emailPart,
              titulo: 'Convite de Torneio!',
              mensagem: `Você foi convidado para participar do torneio "${torneioNome || 'Torneio'}"!`,
              tipo: 'torneio',
              link: `/torneio/custom.html?id=${encodeURIComponent(torneioId)}`,
              lida: false
            }]);

          if (notifErr) {
            console.error('Erro ao enviar notificação de convite:', notifErr);
          }

          btn.innerHTML = '<i class="fa-solid fa-check"></i> Convidado!';
          btn.style.background = 'rgba(16, 185, 129, 0.2)';
          btn.style.borderColor = '#10b981';
          btn.style.color = '#34d399';
          btn.style.cursor = 'default';

          if (typeof showToast === 'function') {
            showToast(`Convite enviado com sucesso para "${nomePart}"!`);
          } else {
            console.log(`Convite enviado para "${nomePart}"!`);
          }
        } catch (err) {
          console.error('Erro ao convidar participante no gerenciador:', err);
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Convidar';
          alert('Erro ao enviar convite.');
        }
      });
    });
  } catch (err) {
    console.error('Erro ao buscar participantes para convite:', err);
    container.innerHTML = `
      <div style="text-align: center; color: #ef4444; padding: 20px;">
        Erro ao buscar dados no Supabase.
      </div>
    `;
  }
}

window.abrirModalConvidarParticipantes = abrirModalConvidarParticipantes;
