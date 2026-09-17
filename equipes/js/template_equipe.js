// /equipes/js/template_equipe.js
// Detalhes da Equipe conectados diretamente ao Supabase

import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(window.location.search).get('id');

  const teamNotFoundEl = document.getElementById('teamNotFound');
  const teamContentEl = document.getElementById('teamContent');

  function showNotFound() {
    if (teamNotFoundEl) teamNotFoundEl.style.display = 'block';
    if (teamContentEl) teamContentEl.style.display = 'none';
  }

  if (!id) {
    console.warn('Nenhum id de equipe fornecido na URL.');
    showNotFound();
    return;
  }

  let equipe = null;

  try {
    const { data: dbEquipe, error } = await supabase
      .from('equipes')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && dbEquipe) {
      equipe = dbEquipe;
    } else {
      console.warn('Equipe não obtida via Supabase direto:', error?.message || error);
    }
  } catch (err) {
    console.warn('Aviso de rede na consulta de equipe:', err?.message || err);
  }

  // Fallback 1: vh_createdTeams do localStorage
  if (!equipe) {
    try {
      const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
      equipe = localTeams.find(t => String(t.id) === String(id));
    } catch (e) {}
  }

  // Fallback 2: vh_cachedEquipes do localStorage
  if (!equipe) {
    try {
      const cached = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
      equipe = cached.find(t => String(t.id) === String(id));
    } catch (e) {}
  }

  // Fallback 3: Tenta carregar via REST direto
  if (!equipe) {
    try {
      const resp = await fetch(`https://qhnajddajpqzueropwul.supabase.co/rest/v1/equipes?id=eq.${encodeURIComponent(id)}&select=*`, {
        headers: {
          'apikey': 'sb_publishable_UvcPG7ubk8Cf88lOt8I7nA_Jnjqyk6P',
          'Authorization': 'Bearer sb_publishable_UvcPG7ubk8Cf88lOt8I7nA_Jnjqyk6P'
        }
      });
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json) && json.length > 0) {
          equipe = json[0];
        }
      }
    } catch (e) {}
  }

  if (!equipe) {
    console.warn('Equipe não encontrada nos dados disponíveis:', id);
    showNotFound();
    return;
  }

  try {
    if (teamNotFoundEl) teamNotFoundEl.style.display = 'none';
    if (teamContentEl) teamContentEl.style.display = 'block';

    // Atualiza título da aba do navegador
    document.title = `${equipe.nome || 'Equipe'} - VersusHub`;

    // 1. Header da Equipe
    const logoEl = document.getElementById('teamLogo');
    const nameEl = document.getElementById('teamName');
    const leaderTextEl = document.getElementById('teamLeaderText');
    const jogosMetaEl = document.getElementById('teamJogosMeta');
    const platMetaEl = document.getElementById('teamPlataformaMeta');
    const regiaoMetaEl = document.getElementById('teamRegiaoMeta');
    const tagsContainer = document.getElementById('teamTags');
    const sobreEl = document.getElementById('teamSobre');

    if (logoEl) {
      logoEl.src = equipe.logo || '/image/logo.png';
      logoEl.alt = equipe.nome || 'Logo da equipe';
      logoEl.onerror = () => {
        logoEl.src = '/image/logo.png';
      };
    }

    if (nameEl) {
      nameEl.textContent = equipe.nome || 'Equipe sem nome';
    }

    const leaderName = equipe.leaderName || 'Líder não informado';
    if (leaderTextEl) {
      leaderTextEl.textContent = 'Líder: ' + leaderName;
    }

    if (jogosMetaEl) {
      jogosMetaEl.textContent = 'Jogos principais: ' + (equipe.jogos || '—');
    }

    if (platMetaEl) {
      const platTexto = equipe.plataforma ? equipe.plataforma.toUpperCase() : '—';
      platMetaEl.textContent = 'Plataforma: ' + platTexto;
    }

    if (regiaoMetaEl) {
      regiaoMetaEl.textContent = 'Região: ' + (equipe.regiao || '—');
    }

    if (sobreEl) {
      sobreEl.textContent = equipe.sobre || 'Nenhuma descrição informada.';
    }

    // 2. Tags
    if (tagsContainer) {
      tagsContainer.innerHTML = '';
      if (equipe.tag) {
        const brutas = Array.isArray(equipe.tag) ? equipe.tag : String(equipe.tag).split(',');
        brutas.forEach(t => {
          const limpo = String(t).trim();
          if (!limpo) return;
          const pill = document.createElement('span');
          pill.className = 'team-tag-pill';
          pill.textContent = limpo;
          tagsContainer.appendChild(pill);
        });
      }
    }

    // 3. Usuário logado e verificação de liderança
    let loggedUser = null;
    try {
      const rawLogged = localStorage.getItem('vh_loggedUser');
      if (rawLogged) {
        loggedUser = JSON.parse(rawLogged);
      }
    } catch (e) {
      loggedUser = null;
    }

    const isLider = Boolean(
      loggedUser &&
      loggedUser.email &&
      equipe.leaderEmail &&
      loggedUser.email.trim().toLowerCase() === equipe.leaderEmail.trim().toLowerCase()
    );

    // 4. Integrantes (Consulta no membros_equipe + cruzamento com usuarios)
    const membersList = document.getElementById('teamMembersList');
    if (membersList) {
      membersList.innerHTML = `
        <div style="color: #9cb1cf; font-size: 14px; padding: 10px 0;">
          <i class="fa-solid fa-circle-notch fa-spin" style="color: #f83838; margin-right: 8px;"></i>
          Carregando integrantes...
        </div>
      `;

      let membrosEquipe = [];
      try {
        const { data: membrosData, error: membrosErr } = await supabase
          .from('membros_equipe')
          .select('*')
          .in('equipe_id', [String(equipe.id), String(equipe.nome)])
          .eq('status', 'Aceito');

        if (!membrosErr && membrosData) {
          membrosEquipe = membrosData;
        }
      } catch (err) {
        console.warn('Erro ao consultar membros da equipe:', err);
      }

      // Prepara lista de emails para cruzamento com a tabela 'usuarios'
      const emailsParaConsultar = (membrosEquipe || []).map(m => m.user_email).filter(Boolean);
      if (equipe.leaderEmail && !emailsParaConsultar.includes(equipe.leaderEmail)) {
        emailsParaConsultar.push(equipe.leaderEmail);
      }

      const usuariosMap = new Map();
      if (emailsParaConsultar.length > 0) {
        try {
          const { data: usuariosData, error: uErr } = await supabase
            .from('usuarios')
            .select('id, nome, email, avatar')
            .in('email', emailsParaConsultar);

          if (!uErr && usuariosData) {
            usuariosData.forEach(u => {
              if (u.email) {
                usuariosMap.set(u.email.toLowerCase(), u);
              }
            });
          }
        } catch (err) {
          console.warn('Erro ao cruzar usuarios com integrantes:', err);
        }
      }

      membersList.innerHTML = '';

      // 4.1 Renderiza o Líder com link para perfil público
      const leaderUser = equipe.leaderEmail ? usuariosMap.get(equipe.leaderEmail.toLowerCase()) : null;
      const leaderId = leaderUser?.id || (loggedUser && isLider ? loggedUser.id : null);
      const leaderAvatar = leaderUser?.avatar && leaderUser.avatar.trim() !== ''
        ? leaderUser.avatar
        : (equipe.leaderAvatar || '/image/boneco_logo_ofc.png');

      const leaderDiv = document.createElement('div');
      leaderDiv.className = 'member';
      const leaderHref = leaderId ? `/perfil/perfil-publico.html?id=${encodeURIComponent(leaderId)}` : '#';
      leaderDiv.innerHTML = `
        <a href="${leaderHref}" class="member-link">
          <img referrerpolicy="no-referrer" src="${leaderAvatar}" alt="${leaderName}" onerror="this.src='/image/boneco_logo_ofc.png'">
          <span><strong>${leaderName}</strong> (Líder)</span>
        </a>
      `;
      membersList.appendChild(leaderDiv);

      // 4.2 Renderiza os membros Aceitos envolvidos na tag <a class="member-link">
      if (membrosEquipe && membrosEquipe.length > 0) {
        membrosEquipe.forEach(m => {
          if (equipe.leaderEmail && m.user_email && m.user_email.toLowerCase() === equipe.leaderEmail.toLowerCase()) {
            return;
          }

          const u = m.user_email ? usuariosMap.get(m.user_email.toLowerCase()) : null;
          const membroId = u?.id || m.id;
          const membroNome = u?.nome || (m.user_email ? m.user_email.split('@')[0] : 'Membro');
          const membroAvatar = u?.avatar && u.avatar.trim() !== '' ? u.avatar : '/image/boneco_logo_ofc.png';

          const memberDiv = document.createElement('div');
          memberDiv.className = 'member';
          memberDiv.innerHTML = `
            <a href="/perfil/perfil-publico.html?id=${encodeURIComponent(membroId)}" class="member-link">
              <img referrerpolicy="no-referrer" src="${membroAvatar}" alt="${membroNome}" onerror="this.src='/image/boneco_logo_ofc.png'">
              <span><strong>${membroNome}</strong> (Membro)</span>
            </a>
          `;
          membersList.appendChild(memberDiv);
        });
      }
    }

    // 5. Botão de Ingressar / Gerenciar Solicitações
    const joinBtn = document.querySelector('.btn-join-team') || document.getElementById('btnSolicitacoes');
    if (joinBtn) {
      if (isLider) {
        // Se for líder, ajusta texto e ação de gestão
        joinBtn.innerHTML = '<i class="fa-solid fa-list-check" style="margin-right: 8px;"></i>Gerenciar Equipe';
        joinBtn.style.background = '#4b5563'; // Tom neutro
        joinBtn.style.border = 'none';
        joinBtn.style.cursor = 'pointer';
        joinBtn.disabled = false;
        joinBtn.onclick = () => {
          window.location.href = '/equipes/gerenciar_equipes.html';
        };
      } else {
        // Se não for líder, força texto "Pedir para entrar" e mantém fluxo de inscrição
        joinBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i>Pedir para entrar';
        joinBtn.style.background = '#d41111';
        joinBtn.style.cursor = 'pointer';
        joinBtn.disabled = false;

        let jaSolicitou = false;

        if (loggedUser && loggedUser.email) {
          try {
            const { data: userReqs } = await supabase
              .from('membros_equipe')
              .select('*')
              .eq('user_email', loggedUser.email)
              .in('equipe_id', [String(equipe.id), String(equipe.nome)]);

            if (userReqs && userReqs.length > 0) {
              const req = userReqs[0];
              jaSolicitou = true;
              if (req.status === 'Aceito') {
                joinBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 8px;"></i>Integrante da Equipe';
                joinBtn.style.background = '#22c55e';
                joinBtn.disabled = true;
              } else {
                joinBtn.innerHTML = '<i class="fa-solid fa-clock" style="margin-right: 8px;"></i>Pendente de Aprovação';
                joinBtn.style.background = '#eab308';
              }
            }
          } catch (err) {
            console.warn('Erro ao checar solicitação prévia:', err);
          }
        }

        joinBtn.onclick = async () => {
          if (!loggedUser || !loggedUser.email) {
            showToast('Faça login para se inscrever ou entrar em equipes.');
            return;
          }

          joinBtn.disabled = true;

          try {
            if (jaSolicitou) {
              // Cancela solicitação pendente
              const { error: delErr } = await supabase
                .from('membros_equipe')
                .delete()
                .eq('user_email', loggedUser.email)
                .in('equipe_id', [String(equipe.id), String(equipe.nome)]);

              if (delErr) throw delErr;

              jaSolicitou = false;
              joinBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i>Pedir para entrar';
              joinBtn.style.background = '#d41111';
              showToast('Solicitação de entrada cancelada.');
            } else {
              // Envia nova solicitação
              const { error: insErr } = await supabase
                .from('membros_equipe')
                .insert([{
                  equipe_id: String(equipe.id),
                  user_email: loggedUser.email,
                  status: 'Pendente'
                }]);

              if (insErr) throw insErr;

              jaSolicitou = true;
              joinBtn.innerHTML = '<i class="fa-solid fa-clock" style="margin-right: 8px;"></i>Pendente de Aprovação';
              joinBtn.style.background = '#eab308';
              showToast('Solicitação enviada com sucesso!');
            }
          } catch (err) {
            console.error('Erro ao processar solicitação de equipe:', err);
            showToast('Não foi possível processar a solicitação.');
          } finally {
            joinBtn.disabled = false;
          }
        };
      }
    }

    // 4. Torneios Ganhos
    const ganhosEl = document.getElementById('teamTorneiosGanhos');
    if (ganhosEl) {
      let ganhos = equipe.torneiosGanhos;
      if (typeof ganhos === 'string') {
        try {
          ganhos = JSON.parse(ganhos);
        } catch {
          ganhos = [];
        }
      }
      if (!Array.isArray(ganhos)) ganhos = [];

      if (!ganhos.length) {
        ganhosEl.innerHTML = '<p class="empty-msg">Nenhum torneio cadastrado ainda.</p>';
      } else {
        ganhosEl.innerHTML = '';
        ganhos.forEach(torn => {
          const card = document.createElement('div');
          card.className = 'torneio-card';
          card.innerHTML = `
            <img referrerpolicy="no-referrer" src="${torn.banner || '/images/cerradocup.jpg'}" alt="${torn.nome || 'Torneio'}" onerror="this.src='/images/cerradocup.jpg'">
            <div class="torneio-card-info">
              <h3>${torn.nome || 'Torneio'}</h3>
              <p>${torn.info || ''}</p>
            </div>
          `;
          ganhosEl.appendChild(card);
        });
      }
    }

    // 5. Torneios Atuais
    const atuaisEl = document.getElementById('teamTorneiosAtuais');
    if (atuaisEl) {
      let atuais = equipe.torneiosAtuais;
      if (typeof atuais === 'string') {
        try {
          atuais = JSON.parse(atuais);
        } catch {
          atuais = [];
        }
      }
      if (!Array.isArray(atuais)) atuais = [];

      if (!atuais.length) {
        atuaisEl.innerHTML = '<p class="empty-msg">A equipe ainda não está participando de nenhum torneio.</p>';
      } else {
        atuaisEl.innerHTML = '';
        atuais.forEach(torn => {
          const card = document.createElement('div');
          card.className = 'torneio-card';
          card.innerHTML = `
            <img referrerpolicy="no-referrer" src="${torn.banner || '/images/cerradocup.jpg'}" alt="${torn.nome || 'Torneio'}" onerror="this.src='/images/cerradocup.jpg'">
            <div class="torneio-card-info">
              <h3>${torn.nome || 'Torneio'}</h3>
              <p>${torn.info || ''}</p>
            </div>
          `;
          atuaisEl.appendChild(card);
        });
      }
    }

  } catch (err) {
    console.warn('Aviso ao renderizar dados da equipe:', err);
    showNotFound();
  }
});

function showToast(message) {
  let toast = document.getElementById('teamToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'teamToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.padding = '14px 24px';
    toast.style.borderRadius = '10px';
    toast.style.background = '#141419';
    toast.style.color = '#ffffff';
    toast.style.border = '1px solid #ff3e3e';
    toast.style.boxShadow = '0 12px 30px rgba(0,0,0,0.7)';
    toast.style.zIndex = '999999';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.transition = 'all 0.3s ease';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: #ff3e3e; margin-right: 8px;"></i>${message}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
  }, 4000);
}
