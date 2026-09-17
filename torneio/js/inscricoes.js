// /torneio/js/inscricoes.js
// Sistema unificado de inscrições em torneios conectado ao Supabase

import { supabase } from '/supabaseClient.js';

/**
 * Obtém o usuário logado a partir do localStorage
 */
export function getLoggedUser() {
  const raw = localStorage.getItem('vh_loggedUser');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('Erro ao ler usuário logado:', e);
    }
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
      .select('*')
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
export async function inscreverTorneio(torneioId, userEmail, status = 'Pendente', tipo = 'individual', idParticipante = null) {
  if (!torneioId || !userEmail) {
    throw new Error('ID do torneio e e-mail do usuário são obrigatórios');
  }

  const payload = {
    torneio_id: String(torneioId),
    user_email: userEmail,
    tipo: tipo,
    id_participante: idParticipante || userEmail,
    status: status
  };

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
  return true;
}

/**
 * Configura automaticamente um botão de inscrição com verificação em tempo real
 */
export async function configurarBotaoInscricao(btnElement, torneioInfo) {
  if (!btnElement || !torneioInfo) return;

  const torneioId = torneioInfo.id || torneioInfo.nome;
  const user = getLoggedUser();

  // Estado visual padrão de carregamento discreto
  if (user) {
    try {
      const { inscrita } = await verificarInscricao(torneioId, user.email);
      if (inscrita) {
        definirBotaoComoInscrito(btnElement);
        return;
      }
    } catch (e) {
      console.warn('Erro ao checar estado inicial de inscrição:', e);
    }
  }

  btnElement.addEventListener('click', async (e) => {
    e.preventDefault();
    const currentUser = getLoggedUser();
    if (!currentUser) {
      showToast('Você precisa estar logado para se inscrever! Redirecionando...', 'warning');
      setTimeout(() => {
        window.location.href = '/login/login.html';
      }, 1500);
      return;
    }

    // Previne duplo clique
    btnElement.disabled = true;
    const textoOriginal = btnElement.textContent;
    btnElement.textContent = 'Processando...';

    try {
      // Checa duplicidade
      const { inscrita } = await verificarInscricao(torneioId, currentUser.email);
      if (inscrita) {
        definirBotaoComoInscrito(btnElement);
        showToast('Você já está inscrito neste torneio!');
        return;
      }

      // Salva no banco de dados via Supabase
      await inscreverTorneio(torneioId, currentUser.email, 'Pendente');

      // Atualiza cache local para compatibilidade
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

      definirBotaoComoInscrito(btnElement);
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
