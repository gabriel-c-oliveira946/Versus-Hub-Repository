import sys, re

# =========================================================================
# 1. Update pagina_inicial/js/scrip.js, pagina_inicial/js/script.js, and index.js
# =========================================================================

new_notif_js_block = """// =========================================================
// SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL VIA SUPABASE
// =========================================================
let currentNotifUserEmail = '';
let notifInterval = null;
let realtimeChannel = null;

function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (isNaN(seconds) || seconds < 30) return 'agora mesmo';
  if (seconds < 60) return `há ${seconds} seg`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  const months = Math.floor(days / 30);
  return `há ${months} mes${months > 1 ? 'es' : ''}`;
}

function renderNotifBellUI() {
  if (document.getElementById('vhNotifBellWrapper')) return;
  const userIconDiv = document.querySelector('.user-icon');
  if (!userIconDiv) return;

  if (!document.getElementById('vhNotifStyles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'vhNotifStyles';
    styleEl.textContent = `
      .vh-notif-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin-right: 12px;
      }
      .vh-notif-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e5e7eb;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 15px;
        position: relative;
        transition: all 0.2s ease;
      }
      .vh-notif-btn:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.3);
      }
      .vh-notif-badge {
        position: absolute;
        top: -3px;
        right: -3px;
        background: #ef4444;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        height: 18px;
        min-width: 18px;
        padding: 0 4px;
        border-radius: 9px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid #0c0a13;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }
      .vh-notif-dropdown {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: #111118;
        border: 1px solid #2a2a38;
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
        z-index: 9999;
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      .vh-notif-dropdown.show {
        display: flex;
      }
      .vh-notif-header {
        padding: 12px 16px;
        border-bottom: 1px solid #2a2a38;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #161622;
        gap: 8px;
      }
      .vh-notif-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .vh-notif-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .vh-notif-mark-all {
        background: transparent;
        border: none;
        color: #3b82f6;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 4px;
        transition: color 0.15s;
      }
      .vh-notif-mark-all:hover {
        color: #60a5fa;
        text-decoration: underline;
      }
      .vh-notif-clear-all {
        background: transparent;
        border: none;
        color: #9ca3af;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 4px;
        transition: color 0.15s;
      }
      .vh-notif-clear-all:hover {
        color: #ef4444;
        text-decoration: underline;
      }
      .vh-notif-list {
        max-height: 360px;
        overflow-y: auto;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .vh-notif-item {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        gap: 10px;
        align-items: flex-start;
        transition: background 0.15s;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        position: relative;
      }
      .vh-notif-item:hover {
        background: rgba(255, 255, 255, 0.04);
      }
      .vh-notif-item.unread {
        background: rgba(239, 68, 68, 0.06);
      }
      .vh-notif-item.unread:hover {
        background: rgba(239, 68, 68, 0.12);
      }
      .vh-notif-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .vh-notif-icon.equipe { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
      .vh-notif-icon.torneio { background: rgba(234, 179, 8, 0.15); color: #facc15; }
      .vh-notif-icon.sucesso { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
      .vh-notif-icon.sistema { background: rgba(239, 68, 68, 0.15); color: #f87171; }
      .vh-notif-icon.default { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
      .vh-notif-content {
        flex: 1;
        min-width: 0;
      }
      .vh-notif-title {
        font-size: 13px;
        font-weight: 600;
        color: #f3f4f6;
        margin: 0 0 2px 0;
        line-height: 1.3;
      }
      .vh-notif-msg {
        font-size: 12px;
        color: #9ca3af;
        margin: 0 0 4px 0;
        line-height: 1.35;
        word-break: break-word;
      }
      .vh-notif-time {
        font-size: 11px;
        color: #6b7280;
      }
      .vh-notif-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        flex-shrink: 0;
        margin-top: 6px;
      }
      .vh-notif-delete-btn {
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        font-size: 12.5px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        margin-left: 2px;
        flex-shrink: 0;
      }
      .vh-notif-delete-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.15);
      }
      .vh-notif-empty {
        padding: 32px 16px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      }
      .vh-notif-empty i {
        font-size: 28px;
        display: block;
        margin-bottom: 8px;
        color: #4b5563;
      }

      @media (max-width: 768px) {
        .vh-notif-wrapper,
        #vhNotifBellWrapper {
          position: static !important;
        }
        .vh-notif-dropdown,
        #notifDropdown {
          position: fixed !important;
          top: 60px !important;
          left: 12px !important;
          right: 12px !important;
          width: auto !important;
          max-width: calc(100vw - 24px) !important;
          max-height: 80vh !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          border-radius: 14px !important;
          z-index: 999999 !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85) !important;
        }
        .vh-notif-header {
          padding: 10px 14px !important;
          flex-wrap: wrap !important;
        }
        .vh-notif-actions {
          gap: 6px !important;
        }
        .vh-notif-mark-all,
        .vh-notif-clear-all {
          font-size: 11px !important;
        }
        .vh-notif-list,
        #notifList {
          max-height: 60vh !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          box-sizing: border-box !important;
        }
        .vh-notif-item {
          padding: 10px 12px !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .vh-notif-content {
          min-width: 0 !important;
          flex: 1 !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
        .vh-notif-title {
          font-size: 12.5px !important;
          line-height: 1.3 !important;
        }
        .vh-notif-msg {
          font-size: 11.5px !important;
          line-height: 1.35 !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'vhNotifBellWrapper';
  wrapper.className = 'vh-notif-wrapper';
  wrapper.innerHTML = `
    <button type="button" id="notifBtn" class="vh-notif-btn" title="Notificações" aria-label="Notificações">
      <i class="fa-solid fa-bell"></i>
      <span id="notifBadge" class="vh-notif-badge">0</span>
    </button>
    <div id="notifDropdown" class="vh-notif-dropdown">
      <div class="vh-notif-header">
        <h4><i class="fa-solid fa-bell" style="color:#ef4444;"></i> Notificações</h4>
        <div class="vh-notif-actions">
          <button type="button" id="btnNotifMarkAllRead" class="vh-notif-mark-all" title="Marcar todas como lidas">Marcar lidas</button>
          <button type="button" id="btnClearNotifs" class="vh-notif-clear-all" title="Limpar todas as notificações">Limpar todas</button>
        </div>
      </div>
      <div id="notifList" class="vh-notif-list">
        <div class="vh-notif-empty">
          <i class="fa-solid fa-bell-slash"></i>
          Nenhuma notificação por enquanto
        </div>
      </div>
    </div>
  `;

  userIconDiv.parentNode.insertBefore(wrapper, userIconDiv);

  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const btnMarkAll = document.getElementById('btnNotifMarkAllRead');
  const btnClearAll = document.getElementById('btnClearNotifs');

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menuUser = document.getElementById('menuUser');
      if (menuUser) menuUser.style.display = 'none';
      notifDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        notifDropdown.classList.remove('show');
      }
    });
  }

  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await marcarTodasComoLidas();
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await limparTodasNotificacoes();
    });
  }
}

async function carregarNotificacoes(userEmail) {
  if (!userEmail) return;
  currentNotifUserEmail = userEmail.toLowerCase().trim();
  try {
    const supabase = await getSupabase();
    if (!supabase) return;
    const { data: notificacoes, error } = await supabase
      .from('notificacoes')
      .select('*')
      .ilike('user_email', currentNotifUserEmail)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[VersusHub Notificações] Erro ao carregar notificações:', error);
      return;
    }
    atualizarInterfaceNotificacoes(notificacoes || []);
  } catch (e) {
    console.error('[VersusHub Notificações] Exceção ao carregar notificações:', e);
  }
}

function atualizarInterfaceNotificacoes(notificacoes) {
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  if (!notifList) return;

  const naoLidas = (notificacoes || []).filter(n => !n.lida);
  const totalNaoLidas = naoLidas.length;

  if (notifBadge) {
    if (totalNaoLidas > 0) {
      notifBadge.textContent = totalNaoLidas > 9 ? '9+' : String(totalNaoLidas);
      notifBadge.style.display = 'flex';
    } else {
      notifBadge.style.display = 'none';
    }
  }

  if (!notificacoes || notificacoes.length === 0) {
    notifList.innerHTML = `
      <div class="vh-notif-empty">
        <i class="fa-solid fa-bell-slash"></i>
        Nenhuma notificação por enquanto
      </div>
    `;
    return;
  }

  notifList.innerHTML = notificacoes.map(n => {
    let iconClass = 'fa-solid fa-bell';
    let typeClass = 'default';
    if (n.tipo === 'equipe') {
      iconClass = 'fa-solid fa-users';
      typeClass = 'equipe';
    } else if (n.tipo === 'torneio') {
      iconClass = 'fa-solid fa-trophy';
      typeClass = 'torneio';
    } else if (n.tipo === 'sucesso') {
      iconClass = 'fa-solid fa-circle-check';
      typeClass = 'sucesso';
    } else if (n.tipo === 'sistema') {
      iconClass = 'fa-solid fa-shield-halved';
      typeClass = 'sistema';
    }

    const unreadClass = !n.lida ? 'unread' : '';
    const href = n.link || '#';

    return `
      <div class="vh-notif-item ${unreadClass}" data-id="${n.id}" data-link="${escapeHtml(href)}">
        <div class="vh-notif-icon ${typeClass}">
          <i class="${iconClass}"></i>
        </div>
        <div class="vh-notif-content">
          <div class="vh-notif-title">${escapeHtml(n.titulo || 'Notificação')}</div>
          <div class="vh-notif-msg">${escapeHtml(n.mensagem || '')}</div>
          <div class="vh-notif-time">${timeAgo(n.created_at)}</div>
        </div>
        ${!n.lida ? '<div class="vh-notif-dot" title="Não lida"></div>' : ''}
        <button type="button" class="vh-notif-delete-btn" data-id="${n.id}" title="Excluir notificação" aria-label="Excluir notificação">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');

  // Cliques nos itens para marcar lida e navegar
  notifList.querySelectorAll('.vh-notif-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.vh-notif-delete-btn')) return;

      const notifId = item.getAttribute('data-id');
      const targetLink = item.getAttribute('data-link');
      if (notifId) {
        await marcarComoLida(notifId);
      }
      if (targetLink && targetLink !== '#' && targetLink !== 'null' && targetLink !== 'undefined') {
        window.location.href = targetLink;
      }
    });
  });

  // Cliques no botão de excluir notificação individual
  notifList.querySelectorAll('.vh-notif-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const notifId = btn.getAttribute('data-id');
      if (notifId) {
        const itemEl = btn.closest('.vh-notif-item');
        if (itemEl) {
          itemEl.style.transition = 'all 0.18s ease';
          itemEl.style.opacity = '0';
          itemEl.style.transform = 'translateX(20px)';
        }
        await excluirNotificacao(notifId);
      }
    });
  });
}

async function excluirNotificacao(id) {
  if (!id) return;
  try {
    console.log('[VersusHub Notificações] Excluindo notificação ID:', id);
    const supabase = await getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[VersusHub Notificações] Erro ao excluir notificação no Supabase:', error);
      } else {
        console.log('[VersusHub Notificações] Notificação ID', id, 'excluída com sucesso.');
      }
    }
  } catch (err) {
    console.error('[VersusHub Notificações] Exceção ao excluir notificação:', err);
  }

  if (currentNotifUserEmail) {
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

async function limparTodasNotificacoes() {
  if (!currentNotifUserEmail) return;
  try {
    console.log('[VersusHub Notificações] Limpando todas as notificações do usuário:', currentNotifUserEmail);
    const supabase = await getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .ilike('user_email', currentNotifUserEmail);

      if (error) {
        console.error('[VersusHub Notificações] Erro ao limpar todas as notificações no Supabase:', error);
      } else {
        console.log('[VersusHub Notificações] Todas as notificações foram limpas com sucesso.');
      }
    }
  } catch (err) {
    console.error('[VersusHub Notificações] Exceção ao limpar notificações:', err);
  }

  atualizarInterfaceNotificacoes([]);
  if (currentNotifUserEmail) {
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

async function marcarComoLida(id) {
  if (!id) return;
  try {
    const supabase = await getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);
      if (error) {
        console.error('[VersusHub Notificações] Erro ao marcar como lida:', error);
      }
    }
  } catch (e) {
    console.error('[VersusHub Notificações] Exceção ao marcar como lida:', e);
  }
  if (currentNotifUserEmail) {
    await carregarNotificacoes(currentNotifUserEmail);
  }
}

async function marcarTodasComoLidas() {
  if (!currentNotifUserEmail) return;
  try {
    console.log('[VersusHub Notificações] Marcando todas as notificações como lidas para:', currentNotifUserEmail);
    const supabase = await getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .ilike('user_email', currentNotifUserEmail)
        .eq('lida', false);
      if (error) {
        console.error('[VersusHub Notificações] Erro ao marcar todas como lidas:', error);
      } else {
        console.log('[VersusHub Notificações] Todas as notificações marcadas como lidas.');
      }
    }
  } catch (e) {
    console.error('[VersusHub Notificações] Exceção ao marcar todas como lidas:', e);
  }
  await carregarNotificacoes(currentNotifUserEmail);
}

function iniciarEscutaNotificacoes(userEmail) {
  if (!userEmail) return;
  const emailClean = userEmail.toLowerCase().trim();
  currentNotifUserEmail = emailClean;

  renderNotifBellUI();
  carregarNotificacoes(emailClean);

  if (notifInterval) clearInterval(notifInterval);
  notifInterval = setInterval(() => {
    carregarNotificacoes(emailClean);
  }, 30000);

  getSupabase().then(supabase => {
    if (!supabase || typeof supabase.channel !== 'function') return;
    try {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      realtimeChannel = supabase
        .channel(`notif-${emailClean}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notificacoes',
            filter: `user_email=eq.${emailClean}`
          },
          () => {
            carregarNotificacoes(emailClean);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[VersusHub Notificações] Erro ao subscrever canal realtime:', e);
    }
  });
}

function desativarEscutaNotificacoes() {
  if (notifInterval) clearInterval(notifInterval);
  const bellWrapper = document.getElementById('vhNotifBellWrapper');
  if (bellWrapper) bellWrapper.remove();
}

window.excluirNotificacao = excluirNotificacao;
window.limparTodasNotificacoes = limparTodasNotificacoes;
window.marcarComoLida = marcarComoLida;
window.marcarTodasComoLidas = marcarTodasComoLidas;
window.carregarNotificacoes = carregarNotificacoes;
"""

for fname in ['pagina_inicial/js/scrip.js', 'pagina_inicial/js/script.js', 'index.js']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    idx = text.find('// SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL VIA SUPABASE')
    idx_top = text.rfind('// =========================================================', 0, idx)
    if idx_top != -1:
        updated_text = text[:idx_top] + new_notif_js_block
    else:
        updated_text = text[:idx] + new_notif_js_block
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(updated_text)
    print(f"Updated notifications in {fname}")

# =========================================================================
# 2. Update equipes/js/gerenciar_equipes.js and equipes/js/gerenciar_equipe.js
# =========================================================================

for fname in ['equipes/js/gerenciar_equipes.js', 'equipes/js/gerenciar_equipe.js']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()

    # Find where accept request updates status and inserts notification
    pattern = r"const targetMemberEmail = \(p\.user_email \|\| p\.email \|\| ''\)\.toLowerCase\(\)\.trim\(\);[\s\S]*?if \(updErr\)"
    replacement = """const targetMemberEmail = (p.user_email || p.email || pEmail || '').toLowerCase().trim();
              if (targetMemberEmail) {
                try {
                  console.log('[VersusHub Notificações] Disparando notificação de aceite de equipe para:', targetMemberEmail);
                  const { data: notifData, error: notifErr } = await supabase.from('notificacoes').insert([{
                    user_email: targetMemberEmail,
                    titulo: 'Solicitação de Equipe Aceita!',
                    mensagem: `Você foi aceito na equipe "${equipe.nome || 'Equipe'}"!`,
                    tipo: 'equipe',
                    lida: false,
                    link: '/equipes/template_equipe.html?id=' + encodeURIComponent(equipe.id)
                  }]).select();

                  if (notifErr) {
                    console.error('[VersusHub Notificações] Erro ao inserir notificação de aceite de equipe no Supabase:', notifErr);
                  } else {
                    console.log('[VersusHub Notificações] Notificação de aceite de equipe enviada com sucesso:', notifData);
                  }
                } catch (eNotif) {
                  console.error('[VersusHub Notificações] Exceção ao enviar notificação de aceite de equipe:', eNotif);
                }
              } else {
                console.warn('[VersusHub Notificações] E-mail do membro solicitante não encontrado para envio de notificação:', p);
              }
              if (updErr)"""

    if re.search(pattern, text):
        text = re.sub(pattern, replacement, text, count=1)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated member accept notification in {fname}")
    else:
        print(f"Pattern not found in {fname}")

# =========================================================================
# 3. Update gerenciartorneios/js/Script.js (Inscrição aceita)
# =========================================================================

with open('gerenciartorneios/js/Script.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace notification block in btn-aprovar-inscricao
target_old_block = """          try {
            // Atualiza Supabase
            if (idInsc) {
              await supabase.from('inscricoes').update({ status: 'Aceito' }).eq('id', idInsc);
              const targetInscEmail = (userEmail || '').toLowerCase().trim();
              if (targetInscEmail) {
                try {
                  await supabase.from('notificacoes').insert([{
                    user_email: targetInscEmail,
                    titulo: 'Inscrição Confirmada!',
                    mensagem: `Sua inscrição no torneio "${torneioNome || 'Torneio'}" foi confirmada!`,
                    tipo: 'torneio',
                    lida: false,
                    link: `/torneio/custom.html?id=${encodeURIComponent(idTorneio)}`
                  }]);
                } catch (eNotif) {}
              }
            } else {
              await supabase.from('inscricoes').update({ status: 'Aceito' }).eq('torneio_id', String(idTorneio)).eq('user_email', userEmail);
            }
          } catch (errDb) {
            console.warn('Erro ao atualizar inscrição no Supabase:', errDb);
          }"""

replacement_insc_block = """          try {
            const nomeTorneio = (torneio && torneio.nome) ? torneio.nome : 'Torneio';
            let targetInscEmail = (userEmail || '').toLowerCase().trim();
            if (!targetInscEmail && idPart && idPart.includes('@')) {
              targetInscEmail = idPart.toLowerCase().trim();
            }

            // Atualiza Supabase
            if (idInsc) {
              await supabase.from('inscricoes').update({ status: 'Aceito' }).eq('id', idInsc);
              if (!targetInscEmail) {
                try {
                  const { data: rec } = await supabase.from('inscricoes').select('user_email, id_participante').eq('id', idInsc).maybeSingle();
                  if (rec) {
                    if (rec.user_email && rec.user_email.includes('@')) targetInscEmail = rec.user_email.toLowerCase().trim();
                    else if (rec.id_participante && rec.id_participante.includes('@')) targetInscEmail = rec.id_participante.toLowerCase().trim();
                  }
                } catch (eRec) {
                  console.warn('[VersusHub Notificações] Erro ao recuperar e-mail da inscrição:', eRec);
                }
              }
            } else {
              await supabase.from('inscricoes').update({ status: 'Aceito' }).eq('torneio_id', String(idTorneio)).eq('user_email', userEmail);
            }

            // Dispara notificação com logging detalhado
            if (targetInscEmail) {
              try {
                console.log('[VersusHub Notificações] Disparando notificação de inscrição aceita para:', targetInscEmail);
                const { data: notifData, error: notifErr } = await supabase.from('notificacoes').insert([{
                  user_email: targetInscEmail,
                  titulo: 'Inscrição Confirmada!',
                  mensagem: `Sua inscrição no torneio "${nomeTorneio}" foi confirmada!`,
                  tipo: 'torneio',
                  lida: false,
                  link: `/torneio/custom.html?id=${encodeURIComponent(idTorneio)}`
                }]).select();

                if (notifErr) {
                  console.error('[VersusHub Notificações] Erro ao inserir notificação de inscrição no Supabase:', notifErr);
                } else {
                  console.log('[VersusHub Notificações] Notificação de inscrição enviada com sucesso:', notifData);
                }
              } catch (eNotif) {
                console.error('[VersusHub Notificações] Exceção ao enviar notificação de inscrição:', eNotif);
              }
            } else {
              console.warn('[VersusHub Notificações] E-mail do participante/líder não encontrado para notificação de inscrição.');
            }
          } catch (errDb) {
            console.error('[VersusHub Notificações] Erro ao atualizar inscrição no Supabase:', errDb);
          }"""

if target_old_block in text:
    text = text.replace(target_old_block, replacement_insc_block)
    with open('gerenciartorneios/js/Script.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated inscription notification in gerenciartorneios/js/Script.js")
else:
    print("Warning: target_old_block not found in gerenciartorneios/js/Script.js")

# =========================================================================
# 4. Update torneio/js/brackets.js (Tournament closure notification)
# =========================================================================

with open('torneio/js/brackets.js', 'r', encoding='utf-8') as f:
    text = f.read()

# In abrirModalConfirmacaoEncerramentoTorneio right after setting status to Encerrado:
closure_target = """      // 5. Altera status do torneio para 'Encerrado'
      await supabase.from('torneios').update({
        status: 'Encerrado',
        statusClass: 'status-encerrado'
      }).eq('id', String(torneioId));"""

closure_replacement = """      // 5. Altera status do torneio para 'Encerrado'
      await supabase.from('torneios').update({
        status: 'Encerrado',
        statusClass: 'status-encerrado'
      }).eq('id', String(torneioId));

      // 6. Notifica todos os participantes cadastrados sobre o encerramento do torneio
      try {
        console.log('[VersusHub Notificações] Iniciando disparo de notificações de encerramento para o torneio ID:', torneioId);
        let nomeDoTorneio = 'Torneio';
        try {
          const { data: tDados } = await supabase.from('torneios').select('nome').eq('id', String(torneioId)).maybeSingle();
          if (tDados && tDados.nome) nomeDoTorneio = tDados.nome;
        } catch (eTNome) {
          console.warn('[VersusHub Notificações] Aviso ao buscar nome do torneio:', eTNome);
        }

        const emailsSet = new Set();

        // Emails dos participantes confirmados
        (confirmados || []).forEach(c => {
          if (c.user_email && c.user_email.includes('@')) emailsSet.add(c.user_email.toLowerCase().trim());
          if (c.email && c.email.includes('@')) emailsSet.add(c.email.toLowerCase().trim());
          if (c.realId && c.realId.includes('@')) emailsSet.add(c.realId.toLowerCase().trim());
        });

        // Emails de todas as inscrições cadastradas no torneio
        try {
          const { data: inscricoesTorneio, error: errInsc } = await supabase
            .from('inscricoes')
            .select('user_email, id_participante')
            .eq('torneio_id', String(torneioId));

          if (errInsc) {
            console.error('[VersusHub Notificações] Erro ao buscar inscrições para notificação de encerramento:', errInsc);
          } else if (Array.isArray(inscricoesTorneio)) {
            inscricoesTorneio.forEach(i => {
              if (i.user_email && i.user_email.includes('@')) emailsSet.add(i.user_email.toLowerCase().trim());
              if (i.id_participante && i.id_participante.includes('@')) emailsSet.add(i.id_participante.toLowerCase().trim());
            });
          }
        } catch (eInscQuery) {
          console.error('[VersusHub Notificações] Exceção ao consultar tabela de inscrições:', eInscQuery);
        }

        const emailsList = Array.from(emailsSet).filter(Boolean);
        console.log(`[VersusHub Notificações] Total de participantes para envio de encerramento: ${emailsList.length}`, emailsList);

        if (emailsList.length > 0) {
          const notifPayload = emailsList.map(email => ({
            user_email: email,
            titulo: 'Torneio Encerrado!',
            mensagem: `O torneio "${nomeDoTorneio}" foi finalizado e os campeões foram consolidados!`,
            tipo: 'torneio',
            lida: false,
            link: `/torneio/custom.html?id=${encodeURIComponent(torneioId)}`
          }));

          const { data: notifData, error: notifErr } = await supabase
            .from('notificacoes')
            .insert(notifPayload)
            .select();

          if (notifErr) {
            console.error('[VersusHub Notificações] Erro ao inserir notificações de encerramento no Supabase:', notifErr);
          } else {
            console.log('[VersusHub Notificações] Notificações de encerramento enviadas com sucesso para todos os participantes:', notifData);
          }
        } else {
          console.warn('[VersusHub Notificações] Nenhum e-mail de participante encontrado para o torneio:', torneioId);
        }
      } catch (eNotifEnc) {
        console.error('[VersusHub Notificações] Exceção geral ao disparar notificações de encerramento:', eNotifEnc);
      }"""

if closure_target in text:
    text = text.replace(closure_target, closure_replacement, 1)
    with open('torneio/js/brackets.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated tournament closure notification in torneio/js/brackets.js")
else:
    print("Warning: closure_target not found in torneio/js/brackets.js")

# In recalcularStatusTorneio, also enhance error/success logging:
recalc_old = """    if (novoStatus === 'Encerrado') {
      try {
        const { data: inscs } = await supabase
          .from('inscricoes')
          .select('user_email')
          .eq('torneio_id', String(torneioId));
        if (inscs && Array.isArray(inscs) && inscs.length > 0) {
          const notifRecords = inscs
            .map(i => (i.user_email || '').toLowerCase().trim())
            .filter(Boolean)
            .map(email => ({
              user_email: email,
              titulo: 'Torneio Encerrado!',
              mensagem: 'O torneio foi finalizado e os campeões foram consolidados!',
              tipo: 'torneio',
              lida: false,
              link: `/torneio/custom.html?id=${encodeURIComponent(torneioId)}`
            }));
          if (notifRecords.length > 0) {
            await supabase.from('notificacoes').insert(notifRecords);
          }
        }
      } catch (eNotif) {}
    }"""

recalc_new = """    if (novoStatus === 'Encerrado') {
      try {
        console.log('[VersusHub Notificações] RecalcularStatus detectou encerramento. Notificando participantes:', torneioId);
        const { data: inscs, error: errInscRecalc } = await supabase
          .from('inscricoes')
          .select('user_email')
          .eq('torneio_id', String(torneioId));

        if (errInscRecalc) {
          console.error('[VersusHub Notificações] Erro ao consultar inscrições no recalcularStatus:', errInscRecalc);
        } else if (inscs && Array.isArray(inscs) && inscs.length > 0) {
          const notifRecords = [...new Set(inscs.map(i => (i.user_email || '').toLowerCase().trim()).filter(Boolean))]
            .map(email => ({
              user_email: email,
              titulo: 'Torneio Encerrado!',
              mensagem: 'O torneio foi finalizado e os campeões foram consolidados!',
              tipo: 'torneio',
              lida: false,
              link: `/torneio/custom.html?id=${encodeURIComponent(torneioId)}`
            }));

          if (notifRecords.length > 0) {
            const { data: insData, error: insErr } = await supabase.from('notificacoes').insert(notifRecords).select();
            if (insErr) {
              console.error('[VersusHub Notificações] Erro ao inserir notificações de encerramento via recalcularStatus:', insErr);
            } else {
              console.log('[VersusHub Notificações] Notificações de encerramento enviadas via recalcularStatus:', insData);
            }
          }
        }
      } catch (eNotif) {
        console.error('[VersusHub Notificações] Exceção no disparo de notificações de encerramento via recalcularStatus:', eNotif);
      }
    }"""

with open('torneio/js/brackets.js', 'r', encoding='utf-8') as f:
    text = f.read()

if recalc_old in text:
    text = text.replace(recalc_old, recalc_new, 1)
    with open('torneio/js/brackets.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated recalcularStatus notification logging in torneio/js/brackets.js")
