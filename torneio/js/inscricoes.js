// /torneio/js/inscricoes.js
// Sistema unificado de inscrições em torneios conectado ao Supabase

import { supabase } from '/supabaseClient.js';
import { abrirModalConfirmacaoPartida } from '/torneio/js/brackets.js';

/**
 * Obtém o usuário logado a partir do localStorage ou valida com Supabase Auth
 */
export async function getLoggedUser() {
  const raw = localStorage.getItem('vh_loggedUser');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('Erro ao ler usuário logado:', e);
    }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      const { data: profile } = await supabase.from('usuarios').select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas').eq('email', email).maybeSingle();
      const userObj = {
        id: profile?.id || session.user.id,
        nome: profile?.nome || session.user.user_metadata?.nome || email.split('@')[0],
        email: email,
        avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
        auth_id: session.user.id
      };
      localStorage.setItem('vh_loggedUser', JSON.stringify(userObj));
      return userObj;
    }
  } catch (err) {
    console.warn('Erro ao checar autenticação em inscricoes:', err);
  }
  return null;
}

/**
 * Exibe notificação toast profissional
 */
export function showToast(message, type = 'success') {
  let toast = document.getElementById('vhToastGlobal');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'vhToastGlobal';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.padding = '14px 24px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 12px 30px rgba(0,0,0,0.6)';
    toast.style.zIndex = '999999';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
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
 * Verifica se um usuário já está inscrito em determinado torneio
 */
export async function verificarInscricao(torneioId, userEmail) {
  if (!torneioId || !userEmail) return { inscrita: false, data: null };

  try {
    const { data, error } = await supabase
      .from('inscricoes')
      .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
      .eq('torneio_id', String(torneioId))
      .eq('user_email', userEmail)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao consultar inscrição:', error);
      return { inscrita: false, data: null, error };
    }

    return { inscrita: !!data, data };
  } catch (err) {
    console.error('Falha de conexão ao verificar inscrição:', err);
    return { inscrita: false, data: null, error: err };
  }
}

/**
 * Inscreve o usuário em um torneio
 */
export async function inscreverTorneio(torneioId, userEmail, status = 'Pendente', tipo = 'individual', idParticipante = null, lineup = null) {
  if (!torneioId || !userEmail) {
    throw new Error('ID do torneio e e-mail do usuário são obrigatórios');
  }

  // Bloqueio rigoroso de envio para torneios encerrados
  try {
    const { data: tData } = await supabase
      .from('torneios')
      .select('status, statusClass')
      .eq('id', String(torneioId))
      .maybeSingle();

    if (tData && verificarTorneioEncerrado(tData)) {
      throw new Error('As inscrições para este torneio estão encerradas.');
    }
  } catch (chkErr) {
    if (chkErr.message && chkErr.message.includes('encerradas')) {
      throw chkErr;
    }
  }

  const payload = {
    torneio_id: String(torneioId),
    user_email: userEmail,
    tipo: tipo,
    id_participante: idParticipante || userEmail,
    status: status
  };

  if (lineup) {
    payload.lineup = lineup;
  }

  const { data, error } = await supabase
    .from('inscricoes')
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Cancela a inscrição do usuário em um torneio
 */
export async function cancelarInscricao(torneioId, userEmail) {
  if (!torneioId || !userEmail) return false;

  const { error } = await supabase
    .from('inscricoes')
    .delete()
    .eq('torneio_id', String(torneioId))
    .eq('user_email', userEmail);

  if (error) throw error;

  // Limpa também do cache local se existir
  try {
    const storageKey = `vh_joinedTournaments_${userEmail}`;
    const arr = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const filtrado = (Array.isArray(arr) ? arr : []).filter(t => String(t.id) !== String(torneioId));
    try { localStorage.setItem(storageKey, JSON.stringify(filtrado)); } catch (e) {}

    const localInsc = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
    const localFiltrado = (Array.isArray(localInsc) ? localInsc : []).filter(i => !(String(i.torneio_id) === String(torneioId) && i.user_email === userEmail));
    try { localStorage.setItem('vh_inscricoes', JSON.stringify(localFiltrado)); } catch (e) {}
  } catch (e) {}

  return true;
}

export function verificarTorneioEncerrado(torneioInfo) {
  if (!torneioInfo) return false;
  const st = String(torneioInfo.status || '').toLowerCase().trim();
  const stCls = String(torneioInfo.statusClass || '').toLowerCase().trim();
  return st === 'encerrado' || stCls === 'status-encerrado' || torneioInfo.status === 'Encerrado';
}

function torneioPermiteCancelamento(torneioInfo) {
  if (verificarTorneioEncerrado(torneioInfo)) return false;
  const st = (torneioInfo?.status || 'Inscrições abertas').toLowerCase().trim();
  return st.includes('abert') || st.includes('inscri');
}

/**
 * Configura automaticamente um botão de inscrição com verificação em tempo real e cancelamento
 */
export async function configurarBotaoInscricao(btnElement, torneioInfo) {
  if (!btnElement || !torneioInfo) return;

  // Se o torneio for 'Encerrado' ou statusClass for 'status-encerrado':
  // Desative o botão de inscrição (disabled = true), altere o texto para "Inscrições Encerradas" e aplique estilo cinza desabilitado
  if (verificarTorneioEncerrado(torneioInfo)) {
    btnElement.disabled = true;
    btnElement.setAttribute('disabled', 'true');
    btnElement.textContent = 'Inscrições Encerradas';
    btnElement.className = 'btn-principal';
    btnElement.style.background = '#2c2c3b';
    btnElement.style.borderColor = '#3b3b4f';
    btnElement.style.color = '#9ca3af';
    btnElement.style.cursor = 'not-allowed';
    btnElement.style.pointerEvents = 'none';
    btnElement.style.boxShadow = 'none';
    btnElement.removeAttribute('title');
    return;
  }

  const torneioId = torneioInfo.id || torneioInfo.nome;
  let userInscrito = false;

  const aplicarEstiloBotao = (inscrito) => {
    userInscrito = inscrito;
    if (inscrito) {
      if (torneioPermiteCancelamento(torneioInfo)) {
        btnElement.disabled = false;
        btnElement.removeAttribute('disabled');
        btnElement.className = 'btn-principal btn-cancelar-inscricao';
        btnElement.innerHTML = '<i class="fa-solid fa-user-xmark" style="margin-right: 6px;"></i> Cancelar Inscrição';
        btnElement.style.background = '#dc2626';
        btnElement.style.borderColor = '#ef4444';
        btnElement.style.color = '#ffffff';
        btnElement.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.4)';
        btnElement.style.cursor = 'pointer';
      } else {
        btnElement.className = 'btn-principal';
        btnElement.textContent = 'Já inscrito';
        btnElement.disabled = true;
        btnElement.style.background = '#1f2937';
        btnElement.style.borderColor = '#374151';
        btnElement.style.color = '#9ca3af';
        btnElement.style.cursor = 'not-allowed';
        btnElement.style.boxShadow = 'none';
      }
    } else {
      btnElement.className = 'btn-principal';
      btnElement.disabled = false;
      btnElement.removeAttribute('disabled');
      btnElement.textContent = torneioInfo.tipoInscricao === 'Apenas Equipe' ? 'Inscrever Equipe' : 'Inscrever-se';
      btnElement.style.background = '#d41111';
      btnElement.style.borderColor = '#d41111';
      btnElement.style.color = '#ffffff';
      btnElement.style.cursor = 'pointer';
      btnElement.style.boxShadow = '0 0 14px rgba(212, 17, 17, 0.35)';
    }
  };

  const user = await getLoggedUser();

  // Estado visual inicial
  if (user) {
    try {
      const { inscrita } = await verificarInscricao(torneioId, user.email);
      if (inscrita) {
        aplicarEstiloBotao(true);
      } else {
        aplicarEstiloBotao(false);
      }
    } catch (e) {
      console.warn('Erro ao checar estado inicial de inscrição:', e);
      aplicarEstiloBotao(false);
    }
  } else {
    aplicarEstiloBotao(false);
  }

  btnElement.addEventListener('click', async (e) => {
    e.preventDefault();
    if (verificarTorneioEncerrado(torneioInfo) || btnElement.disabled) {
      showToast('As inscrições para este torneio estão encerradas.', 'warning');
      return;
    }
    const currentUser = await getLoggedUser();
    if (!currentUser) {
      showToast('Você precisa estar logado para se inscrever! Redirecionando...', 'warning');
      setTimeout(() => {
        window.location.href = '/login/login.html';
      }, 1500);
      return;
    }

    // Fluxo de Cancelar Inscrição
    if (userInscrito) {
      if (!torneioPermiteCancelamento(torneioInfo)) {
        showToast('As inscrições deste torneio já estão encerradas e não podem ser canceladas.', 'warning');
        return;
      }

      const confirmar = await abrirModalConfirmacaoPartida({
        titulo: 'Cancelar Inscrição',
        mensagem: 'Tem certeza de que deseja cancelar sua inscrição neste torneio?',
        subtexto: 'Você perderá sua vaga confirmada e outros participantes poderão se inscrever.',
        textoConfirmar: 'Sim, Cancelar Inscrição',
        textoCancelar: 'Manter Inscrição',
        icone: 'fa-solid fa-user-xmark'
      });
      if (!confirmar) return;

      btnElement.disabled = true;
      const textoOriginal = btnElement.innerHTML;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelando...';

      try {
        await cancelarInscricao(torneioId, currentUser.email);
        aplicarEstiloBotao(false);
        showToast('Inscrição cancelada com sucesso!');
      } catch (err) {
        console.error('Erro ao cancelar inscrição:', err);
        btnElement.disabled = false;
        btnElement.innerHTML = textoOriginal;
        showToast('Não foi possível cancelar sua inscrição. Tente novamente.', 'error');
      }
      return;
    }

    // Fluxo de Inscrever-se
    btnElement.disabled = true;
    const textoOriginal = btnElement.textContent;
    btnElement.textContent = 'Processando...';

    try {
      const { inscrita } = await verificarInscricao(torneioId, currentUser.email);
      if (inscrita) {
        aplicarEstiloBotao(true);
        showToast('Você já está inscrito neste torneio!');
        return;
      }

      const isEquipe = torneioInfo.tipoInscricao === 'Apenas Equipe' || (torneioInfo.modalidade && String(torneioInfo.modalidade).toLowerCase() === 'equipe');

      if (isEquipe) {
        // Busca a equipe liderada pelo usuário para inscrição direta
        let userTeams = [];
        try {
          const { data } = await supabase
            .from('equipes')
            .select('id, nome, tag, logo, leaderName, leaderEmail')
            .ilike('leaderEmail', currentUser.email);
          if (data && data.length > 0) userTeams = data;
        } catch (eTeam) {}

        if (userTeams.length === 0) {
          try {
            const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
            userTeams = localTeams.filter(t => !t.leaderEmail || t.leaderEmail.toLowerCase() === currentUser.email.toLowerCase());
          } catch (eLoc) {}
        }

        if (userTeams.length === 0) {
          btnElement.disabled = false;
          btnElement.textContent = textoOriginal;
          showToast('Você precisa ser capitão de uma equipe para inscrevê-la neste torneio!', 'warning');
          return;
        }

        const teamToJoin = userTeams[0];
        await inscreverTorneio(torneioId, currentUser.email, 'Pendente', 'equipe', String(teamToJoin.id));
      } else {
        await inscreverTorneio(torneioId, currentUser.email, 'Pendente', 'individual', currentUser.email);
      }

      try {
        const storageKey = `vh_joinedTournaments_${currentUser.email}`;
        const arr = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!arr.some(t => t.id === torneioId)) {
          arr.push({
            id: torneioId,
            nome: torneioInfo.nome || torneioInfo.titulo,
            jogo: torneioInfo.jogo,
            data: torneioInfo.data,
            status: torneioInfo.status,
            statusClass: torneioInfo.statusClass,
            banner: torneioInfo.banner,
            link: torneioInfo.link || `/torneio/custom.html?id=${torneioId}`
          });
          localStorage.setItem(storageKey, JSON.stringify(arr));
        }
      } catch (err) {
        console.warn('Erro ao sincronizar cache local:', err);
      }

      aplicarEstiloBotao(true);
      showToast('Inscrição confirmada! Você pode acompanhar em Gerenciar Torneios.');
    } catch (err) {
      console.error('Erro ao realizar inscrição:', err);
      btnElement.disabled = false;
      btnElement.textContent = textoOriginal;
      showToast('Não foi possível concluir sua inscrição. Tente novamente.', 'error');
    }
  });
}

function definirBotaoComoInscrito(btn) {
  btn.textContent = 'Já inscrito';
  btn.disabled = true;
  btn.style.background = '#1f2937';
  btn.style.borderColor = '#374151';
  btn.style.color = '#9ca3af';
  btn.style.cursor = 'not-allowed';
  btn.style.boxShadow = 'none';
}
