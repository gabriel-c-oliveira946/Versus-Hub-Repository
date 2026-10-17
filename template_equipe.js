// /equipes/js/template_equipe.js
// Detalhes da Equipe conectados diretamente ao Supabase

import { supabase, enviarNotificacao } from '/supabaseClient.js';

// Todas as equipes e membros são carregados exclusivamente do banco de dados (Supabase)

const PREDEFINED_TEAMS = {};

document.addEventListener('DOMContentLoaded', async () => {
  const rawId = new URLSearchParams(window.location.search).get('id');
  const id = (rawId || '').trim();

  const teamNotFoundEl = document.getElementById('teamNotFound');
  const teamContentEl = document.getElementById('teamContent');

  function showNotFound() {
    if (teamNotFoundEl) teamNotFoundEl.style.display = 'block';
    if (teamContentEl) teamContentEl.style.display = 'none';
  }

  if (!id || false) {
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

    const leaderEmailNormalized = (equipe.leaderEmail || '').toLowerCase().trim();
    const aceitosSemLider = (membrosEquipe || []).filter(m => {
      const mEmail = (m.user_email || '').toLowerCase().trim();
      return !leaderEmailNormalized || mEmail !== leaderEmailNormalized;
    });

    const leaderCount = (equipe.leaderEmail || equipe.leaderName || equipe.lider) ? 1 : 0;
    const totalMembros = leaderCount + aceitosSemLider.length;
    const limiteMax = parseInt(equipe.limite, 10) > 0 ? parseInt(equipe.limite, 10) : 5;
    const isEquipeCheia = totalMembros >= limiteMax;

    // Atualiza metadado de Vagas / Integrantes no Hero
    let vagasMetaEl = document.getElementById('teamVagasMeta');
    if (!vagasMetaEl) {
      vagasMetaEl = document.createElement('p');
      vagasMetaEl.id = 'teamVagasMeta';
      vagasMetaEl.className = 'team-meta';
      const leaderText = document.getElementById('teamLeaderText');
      if (leaderText && leaderText.parentNode) {
        leaderText.parentNode.insertBefore(vagasMetaEl, leaderText.nextSibling);
      }
    }
    if (vagasMetaEl) {
      const statusBadge = isEquipeCheia 
        ? '<span style="color: #ef4444; font-weight: 700; margin-left: 8px;">(Equipe Cheia)</span>'
        : '<span style="color: #22c55e; font-weight: 700; margin-left: 8px;">(Vagas Abertas)</span>';
      vagasMetaEl.innerHTML = `Integrantes: <strong style="color: ${isEquipeCheia ? '#f87171' : '#f4f4f5'};">${totalMembros} / ${limiteMax}</strong> ${statusBadge}`;
    }

    if (membersList) {
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
      const leaderId = leaderUser?.id || (loggedUser && isLider ? loggedUser.id : (equipe.leaderEmail || equipe.leaderName || ''));
      const leaderAvatar = leaderUser?.avatar && leaderUser.avatar.trim() !== ''
        ? leaderUser.avatar
        : (equipe.leaderAvatar || '/image/boneco_logo_ofc.png');

      const leaderDiv = document.createElement('div');
      leaderDiv.className = 'member';
      const leaderHref = `/perfil/perfil-publico.html?id=${encodeURIComponent(leaderId)}`;
      leaderDiv.innerHTML = `
        <a href="${leaderHref}" class="member-link">
          <img referrerpolicy="no-referrer" src="${leaderAvatar}" alt="${leaderName}" onerror="this.src='/image/boneco_logo_ofc.png'">
          <span><strong>${leaderName}</strong> (Líder)</span>
        </a>
      `;
      membersList.appendChild(leaderDiv);

      // 4.2 Renderiza os membros Aceitos reais da equipe
      if (aceitosSemLider.length > 0) {
        aceitosSemLider.forEach(m => {
          const u = m.user_email ? usuariosMap.get(m.user_email.toLowerCase()) : null;
          const membroId = u?.id || m.user_email || m.id;
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
      } else {
        const noMembersP = document.createElement('p');
        noMembersP.style.cssText = 'color: #9ca3af; font-size: 13.5px; padding: 6px 0; font-style: italic;';
        noMembersP.textContent = 'Esta equipe ainda não possui outros integrantes.';
        membersList.appendChild(noMembersP);
      }
    }

    // 5. Botão de Ingressar / Gerenciar Solicitações com controle rigoroso de vagas
    const joinBtn = document.querySelector('.btn-join-team') || document.getElementById('btnSolicitacoes');
    if (joinBtn) {
      if (isLider) {
        // Se for líder, ação de gerenciamento
        joinBtn.innerHTML = '<i class="fa-solid fa-list-check" style="margin-right: 8px;"></i>Gerenciar Solicitações';
        joinBtn.style.background = '#4b5563';
        joinBtn.style.border = 'none';
        joinBtn.style.cursor = 'pointer';
        joinBtn.disabled = false;
        joinBtn.onclick = () => {
          window.location.href = '/equipes/gerenciar_equipes.html';
        };

        const btnEdit = document.getElementById('btnAbrirModalEditarEquipe');
        if (btnEdit) {
          btnEdit.style.display = 'inline-flex';
          btnEdit.style.alignItems = 'center';
          btnEdit.onclick = () => {
            abrirModalEdicaoTemplate();
          };
        }
      } else {
        let jaSolicitou = false;
        let isMembroAceito = false;

        if (loggedUser && loggedUser.email) {
          try {
            const { data: userReqs } = await supabase
              .from('membros_equipe')
              .select('*')
              .eq('user_email', loggedUser.email)
              .in('equipe_id', [String(equipe.id), String(equipe.nome)]);

            if (userReqs && userReqs.length > 0) {
              const req = userReqs[0];
              if (req.status === 'Aceito') {
                isMembroAceito = true;
              } else {
                jaSolicitou = true;
              }
            }
          } catch (err) {
            console.warn('Erro ao checar solicitação prévia:', err);
          }
        }

        // Renderiza estado do botão
        if (isMembroAceito) {
          joinBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket" style="margin-right: 8px;"></i>Sair da Equipe';
          joinBtn.style.background = 'rgba(239, 68, 68, 0.15)';
          joinBtn.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          joinBtn.style.color = '#ef4444';
          joinBtn.style.cursor = 'pointer';
          joinBtn.disabled = false;
        } else if (jaSolicitou) {
          joinBtn.innerHTML = '<i class="fa-solid fa-clock" style="margin-right: 8px;"></i>Pendente (Clique p/ cancelar)';
          joinBtn.style.background = '#ca8a04';
          joinBtn.style.border = 'none';
          joinBtn.style.color = '#ffffff';
          joinBtn.style.cursor = 'pointer';
          joinBtn.disabled = false;
        } else if (isEquipeCheia) {
          joinBtn.innerHTML = '<i class="fa-solid fa-ban" style="margin-right: 8px;"></i>Equipe Cheia';
          joinBtn.style.background = '#374151';
          joinBtn.style.border = '1px solid #4b5563';
          joinBtn.style.color = '#ffffff';
          joinBtn.style.cursor = 'not-allowed';
          joinBtn.disabled = true;
        } else {
          joinBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i>Pedir para entrar';
          joinBtn.style.background = '#d41111';
          joinBtn.style.border = 'none';
          joinBtn.style.color = '#ffffff';
          joinBtn.style.cursor = 'pointer';
          joinBtn.disabled = false;
        }

        joinBtn.onclick = async () => {
          if (!loggedUser || !loggedUser.email) {
            showToast('Faça login para se inscrever ou entrar em equipes.');
            return;
          }

          if (isMembroAceito) {
            const nomeSeguro = escapeHtml(equipe.nome || 'Equipe');
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

            joinBtn.disabled = true;
            joinBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 8px;"></i>Saindo...';

            try {
              const { error: delErr } = await supabase
                .from('membros_equipe')
                .delete()
                .eq('user_email', loggedUser.email)
                .in('equipe_id', [String(equipe.id), String(equipe.nome)]);

              if (delErr) throw delErr;

              showToast('Você saiu da equipe com sucesso.');
              setTimeout(() => {
                window.location.reload();
              }, 500);
            } catch (err) {
              console.error('Erro ao sair da equipe:', err);
              showToast('Não foi possível sair da equipe.');
              joinBtn.disabled = false;
              joinBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket" style="margin-right: 8px;"></i>Sair da Equipe';
            }
            return;
          }

          if (isEquipeCheia && !jaSolicitou) {
            showToast('Esta equipe já atingiu o limite de integrantes e está cheia.');
            return;
          }

          joinBtn.disabled = true;
          const originalText = joinBtn.innerHTML;
          joinBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 8px;"></i>Processando...';

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
              if (isEquipeCheia) {
                joinBtn.innerHTML = '<i class="fa-solid fa-ban" style="margin-right: 8px;"></i>Equipe Cheia';
                joinBtn.style.background = '#374151';
                joinBtn.style.cursor = 'not-allowed';
                joinBtn.disabled = true;
              } else {
                joinBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i>Pedir para entrar';
                joinBtn.style.background = '#d41111';
                joinBtn.style.cursor = 'pointer';
                joinBtn.disabled = false;
              }
              showToast('Solicitação de entrada cancelada.');
            } else {
              // Verifica se a equipe ainda tem vaga antes de enviar
              const { data: latestAccepted } = await supabase
                .from('membros_equipe')
                .select('id, user_email')
                .in('equipe_id', [String(equipe.id), String(equipe.nome)])
                .eq('status', 'Aceito');

              const latestSemLider = (latestAccepted || []).filter(m => {
                const mEmail = (m.user_email || '').toLowerCase().trim();
                return !leaderEmailNormalized || mEmail !== leaderEmailNormalized;
              });

              if (leaderCount + latestSemLider.length >= limiteMax) {
                showToast(`A equipe atingiu o limite máximo de ${limiteMax} membros.`);
                joinBtn.innerHTML = '<i class="fa-solid fa-ban" style="margin-right: 8px;"></i>Equipe Cheia';
                joinBtn.style.background = '#374151';
                joinBtn.style.cursor = 'not-allowed';
                joinBtn.disabled = true;
                return;
              }

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
              joinBtn.innerHTML = '<i class="fa-solid fa-clock" style="margin-right: 8px;"></i>Pendente (Clique p/ cancelar)';
              joinBtn.style.background = '#ca8a04';
              joinBtn.style.cursor = 'pointer';
              joinBtn.disabled = false;
              showToast('Solicitação enviada com sucesso!');
            }
          } catch (err) {
            console.error('Erro ao processar solicitação de equipe:', err);
            showToast('Não foi possível processar a solicitação.');
            joinBtn.innerHTML = originalText;
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

    // 5. Torneios que a Equipe está Participando (Consulta assíncrona na tabela inscricoes e torneios)
    const atuaisEl = document.getElementById('teamTorneiosAtuais');
    if (atuaisEl) {
      atuaisEl.setAttribute('aria-busy', 'true');
      atuaisEl.innerHTML = `
        <div class="torneio-card skeleton-card" aria-hidden="true" style="min-height: 180px; width: 260px;">
          <div class="skeleton-shimmer skeleton-card-img" style="height: 120px;"></div>
          <div class="skeleton-shimmer skeleton-card-line title" style="margin-top: 10px;"></div>
          <div class="skeleton-shimmer skeleton-card-line short"></div>
        </div>
      `;

      const teamId = String(equipe.id || '').trim();
      const teamNome = String(equipe.nome || '').trim();
      let listaTorneiosParticipando = [];

      try {
        // 5.1 Busca inscrições ativas da equipe no Supabase por equipe_nome ou id_participante
        const promessas = [];
        if (teamNome) {
          promessas.push(supabase.from('inscricoes').select('torneio_id, status, equipe_nome, id_participante, tipo').eq('equipe_nome', teamNome));
          promessas.push(supabase.from('inscricoes').select('torneio_id, status, equipe_nome, id_participante, tipo').eq('id_participante', teamNome));
        }
        if (teamId && teamId !== teamNome) {
          promessas.push(supabase.from('inscricoes').select('torneio_id, status, equipe_nome, id_participante, tipo').eq('id_participante', teamId));
          promessas.push(supabase.from('inscricoes').select('torneio_id, status, equipe_nome, id_participante, tipo').eq('equipe_nome', teamId));
        }

        const respostas = await Promise.all(promessas);
        let todasInscricoes = [];
        respostas.forEach(res => {
          if (!res.error && Array.isArray(res.data)) {
            todasInscricoes.push(...res.data);
          }
        });

        // Remove duplicatas por torneio_id
        const mapaInscricoes = new Map();
        todasInscricoes.forEach(ins => {
          if (ins.torneio_id) {
            mapaInscricoes.set(String(ins.torneio_id), ins);
          }
        });

        // Filtra apenas inscrições ativas (não canceladas e não recusadas)
        const inscricoesAtivas = Array.from(mapaInscricoes.values()).filter(ins => {
          const st = (ins.status || '').toLowerCase().trim();
          return st !== 'recusado' && st !== 'cancelado';
        });

        const torneioIds = [...new Set(inscricoesAtivas.map(ins => String(ins.torneio_id)).filter(Boolean))];

        // 5.2 Se encontrou IDs de torneios nas inscrições, busca os dados completos na tabela 'torneios'
        if (torneioIds.length > 0) {
          const { data: dbTorneios, error: tornErr } = await supabase
            .from('torneios')
            .select('*')
            .in('id', torneioIds);

          if (!tornErr && Array.isArray(dbTorneios) && dbTorneios.length > 0) {
            listaTorneiosParticipando = dbTorneios;
          }
        }
      } catch (err) {
        console.warn('Falha na consulta assíncrona de inscrições da equipe:', err);
      }

      // Fallback: caso não haja inscrições registradas no Supabase ainda, verifica dados em equipe.torneiosAtuais
      if (listaTorneiosParticipando.length === 0) {
        let atuaisFallback = equipe.torneiosAtuais;
        if (typeof atuaisFallback === 'string') {
          try {
            atuaisFallback = JSON.parse(atuaisFallback);
          } catch {
            atuaisFallback = [];
          }
        }
        if (Array.isArray(atuaisFallback) && atuaisFallback.length > 0) {
          listaTorneiosParticipando = atuaisFallback;
        }
      }

      atuaisEl.setAttribute('aria-busy', 'false');

      if (!listaTorneiosParticipando.length) {
        atuaisEl.innerHTML = '<p class="empty-msg" style="color: #9ca3af; font-size: 14px; margin: 8px 0;">A equipe ainda não está participando de nenhum torneio.</p>';
      } else {
        atuaisEl.innerHTML = '';
        listaTorneiosParticipando.forEach(torn => {
          const tId = torn.id || '';
          const tNome = torn.nome || 'Torneio';
          const tBanner = torn.banner || '/images/cerradocup.jpg';
          const tJogo = torn.jogo || torn.info || 'Competitivo';
          const tStatus = torn.status || 'Inscrições abertas';
          const link = tId ? `/torneio/custom.html?id=${encodeURIComponent(tId)}` : (torn.link || '#');

          const card = document.createElement('div');
          card.className = 'torneio-card';
          card.innerHTML = `
            <a href="${link}" style="text-decoration: none; color: inherit; display: block;">
              <img referrerpolicy="no-referrer" src="${tBanner}" alt="${tNome}" onerror="this.src='/images/cerradocup.jpg'">
              <div class="torneio-card-info">
                <h3>${tNome}</h3>
                <p style="color: #ef4444; font-weight: 600; margin-bottom: 4px;">${tJogo}</p>
                <p style="font-size: 12px; color: #9ca3af;">${tStatus}</p>
                <span style="display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 700; color: #ff7300;">Ver detalhes &rarr;</span>
              </div>
            </a>
          `;
          atuaisEl.appendChild(card);
        });
      }
    }

    // ==============================================================================
    // 6. MODAL DE EDIÇÃO DIRETA DA EQUIPE (Para Líder)
    // ==============================================================================
    const modalEditTpl = document.getElementById('modalEditarEquipeTemplate');
    const formEditTpl = document.getElementById('formEditTeamTemplate');
    const btnFecharModalTpl = document.getElementById('btnFecharModalTemplateEdit');
    const btnCancelarModalTpl = document.getElementById('btnCancelarModalTemplateEdit');
    const fileInputTpl = document.getElementById('tplEditTeamLogoFile');
    const logoImgTpl = document.getElementById('tplEditTeamLogoImg');
    let tplEditLogoDataUrl = '';

    if (fileInputTpl) {
      fileInputTpl.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          showToast('Selecione apenas arquivos de imagem.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          tplEditLogoDataUrl = ev.target.result;
          if (logoImgTpl) {
            logoImgTpl.src = tplEditLogoDataUrl;
          }
        };
        reader.readAsDataURL(file);
      });
    }

    function fecharModalEdicaoTemplate() {
      if (modalEditTpl) modalEditTpl.style.display = 'none';
    }

    if (btnFecharModalTpl) btnFecharModalTpl.addEventListener('click', fecharModalEdicaoTemplate);
    if (btnCancelarModalTpl) btnCancelarModalTpl.addEventListener('click', fecharModalEdicaoTemplate);
    if (modalEditTpl) {
      modalEditTpl.addEventListener('click', (e) => {
        if (e.target === modalEditTpl) fecharModalEdicaoTemplate();
      });
    }

    function abrirModalEdicaoTemplate() {
      if (!modalEditTpl) return;
      document.getElementById('tplEditTeamId').value = equipe.id;
      document.getElementById('tplEditTeamNome').value = equipe.nome || '';
      document.getElementById('tplEditTeamTag').value = equipe.tag || '';
      document.getElementById('tplEditTeamJogos').value = equipe.jogos || '';
      document.getElementById('tplEditTeamRegiao').value = equipe.regiao || '';
      document.getElementById('tplEditTeamSobre').value = equipe.sobre || '';

      tplEditLogoDataUrl = '';
      if (fileInputTpl) fileInputTpl.value = '';
      if (logoImgTpl) {
        logoImgTpl.src = equipe.logo || '/image/logo.png';
        logoImgTpl.onerror = () => { logoImgTpl.src = '/image/logo.png'; };
      }

      modalEditTpl.style.display = 'flex';
    }

    if (formEditTpl) {
      formEditTpl.addEventListener('submit', async (e) => {
        e.preventDefault();

        const novoNome = document.getElementById('tplEditTeamNome').value.trim();
        const novaTag = document.getElementById('tplEditTeamTag').value.trim();
        const novosJogos = document.getElementById('tplEditTeamJogos').value.trim();
        const novaRegiao = document.getElementById('tplEditTeamRegiao').value.trim() || 'Brasil';
        const novoSobre = document.getElementById('tplEditTeamSobre').value.trim();
        const novoLogo = tplEditLogoDataUrl || equipe.logo || '/image/logo.png';

        const btnSave = document.getElementById('btnSalvarModalTemplateEdit');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Salvando...';
        }

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
            .eq('id', equipe.id);

          if (error) {
            console.error('Erro ao atualizar equipe no Supabase:', error);
            showToast('Erro ao salvar no banco de dados.');
            return;
          }

          // 2. Atualiza objeto na memória
          Object.assign(equipe, updatePayload);

          // 3. Atualiza cache local vh_createdTeams e vh_cachedEquipes
          try {
            const allCreated = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
            const idx = allCreated.findIndex(t => String(t.id) === String(equipe.id));
            if (idx !== -1) {
              allCreated[idx] = { ...allCreated[idx], ...updatePayload };
              localStorage.setItem('vh_createdTeams', JSON.stringify(allCreated));
            }
          } catch (e) {}

          try {
            const cached = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
            const cIdx = cached.findIndex(t => String(t.id) === String(equipe.id));
            if (cIdx !== -1) {
              cached[cIdx] = { ...cached[cIdx], ...updatePayload };
              localStorage.setItem('vh_cachedEquipes', JSON.stringify(cached));
            }
          } catch (e) {}

          // 4. Atualiza elementos visuais na página
          if (logoEl) logoEl.src = equipe.logo;
          if (nameEl) nameEl.textContent = equipe.nome;
          document.title = `${equipe.nome || 'Equipe'} - VersusHub`;
          if (jogosMetaEl) jogosMetaEl.textContent = 'Jogos principais: ' + (equipe.jogos || '—');
          if (regiaoMetaEl) regiaoMetaEl.textContent = 'Região: ' + (equipe.regiao || '—');
          if (sobreEl) sobreEl.textContent = equipe.sobre || 'Nenhuma descrição informada.';

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

          fecharModalEdicaoTemplate();
          showToast('Equipe atualizada com sucesso!');
        } catch (err) {
          console.error('Erro geral ao atualizar equipe:', err);
          showToast('Ocorreu um erro ao atualizar a equipe.');
        } finally {
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar Alterações';
          }
        }
      });
    }

  } catch (err) {
    console.warn('Aviso ao renderizar dados da equipe:', err);
    showNotFound();
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
