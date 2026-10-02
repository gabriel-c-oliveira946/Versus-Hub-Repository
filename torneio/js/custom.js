// /torneio/js/custom.js
import { supabase } from '/supabaseClient.js';

let torneioGlobal = null;

async function getLoggedUser() {
  const raw = localStorage.getItem('vh_loggedUser');
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }

  // Validação assíncrona com Supabase Auth
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
    console.warn('Aviso ao consultar sessão Supabase:', err);
  }
  return null;
}

function showToast(message) {
  let toast = document.getElementById('customToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'customToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.background = '#1e1b2e';
    toast.style.color = '#ffffff';
    toast.style.borderLeft = '4px solid #ff7300';
    toast.style.padding = '14px 22px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
    toast.style.zIndex = '99999';
    toast.style.fontFamily = 'system-ui, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  void toast.offsetWidth;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 4000);
}

function getValidExternalUrl(link) {
  if (!link || typeof link !== 'string') return null;
  const trimmed = link.trim();
  if (!trimmed) return null;

  // Ignora links internos do próprio site ou âncoras
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.includes('custom.html')) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return trimmed;
      }
    } catch {
      return null;
    }
  }

  // Domínio web comum sem protocolo explícito (ex: twitch.tv/canal ou youtube.com/live)
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
    return 'https://' + trimmed;
  }

  return null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const loaderDetalhes = document.getElementById('loaderDetalhes');
  if (loaderDetalhes) {
    loaderDetalhes.style.display = 'flex';
  }

  const hideLoader = () => {
    const loaderEl = document.getElementById('loaderDetalhes');
    if (loaderEl) {
      loaderEl.style.display = 'none';
    }
  };

  // 1) Captura o id da URL
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const torneioPage = document.getElementById('torneioPage');
  const erroTorneio = document.getElementById('erroTorneio');

  if (!id) {
    hideLoader();
    if (erroTorneio) erroTorneio.style.display = 'block';
    if (torneioPage) torneioPage.style.display = 'none';
    return;
  }

  let torneio = null;
  let preloadedInscricoes = [];
  let loggedUser = null;

  // Consulta simultânea em paralelo via Promise.all para máxima velocidade de carregamento
  try {
    const [resTorneio, resInscricoes, userAuth] = await Promise.all([
      supabase.from('torneios').select('*').eq('id', id).single(),
      supabase.from('inscricoes').select('*').eq('torneio_id', String(id)).eq('status', 'Aceito'),
      getLoggedUser()
    ]);

    loggedUser = userAuth;

    if (!resTorneio.error && resTorneio.data) {
      torneio = resTorneio.data;
      torneioGlobal = torneio;
    } else {
      console.warn('Torneio não retornado do Supabase:', resTorneio.error);
    }

    if (!resInscricoes.error && Array.isArray(resInscricoes.data)) {
      preloadedInscricoes = resInscricoes.data;
    }
  } catch (err) {
    console.warn('Aviso ao consultar dados do torneio no Supabase:', err);
  }

  if (!torneio) {
    hideLoader();
    if (erroTorneio) erroTorneio.style.display = 'block';
    if (torneioPage) torneioPage.style.display = 'none';
    return;
  }

  // Exibe o layout principal do torneio
  if (erroTorneio) erroTorneio.style.display = 'none';
  if (torneioPage) torneioPage.style.display = 'block';

  // 3) Preenchimento de todos os campos da tela
  const detBanner      = document.getElementById('detBanner');
  const detStatusBadge = document.getElementById('detStatusBadge');
  const detNome        = document.getElementById('detNome');
  const infoOrganizador= document.getElementById('infoOrganizador');
  const detMeta        = document.getElementById('detMeta');
  const detData        = document.getElementById('detData');

  const tagCategoria   = document.getElementById('tagCategoria');
  const tagPlataforma  = document.getElementById('tagPlataforma');
  const tagModalidade  = document.getElementById('tagModalidade');
  const tagLocalizacao = document.getElementById('tagLocalizacao');
  const tagTaxa        = document.getElementById('tagTaxa');

  const detDescricao   = document.getElementById('detDescricao');
  const detRegras      = document.getElementById('detRegras');
  const listaRegras    = document.getElementById('listaRegras');
  const detRequisitos  = document.getElementById('detRequisitos');

  const textoStatus    = document.getElementById('textoStatus');
  const textoPlataforma= document.getElementById('textoPlataforma');
  const infoModalidade = document.getElementById('infoModalidade');
  const infoLocal      = document.getElementById('infoLocal');
  const infoTaxa       = document.getElementById('infoTaxa');
  const textoTipoInscricao = document.getElementById('textoTipoInscricao');
  const textoMaxIntegrantes = document.getElementById('textoMaxIntegrantes');
  const liMaxIntegrantes = document.getElementById('liMaxIntegrantes');

  const tipoInscricaoTorneio = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
  const maxIntegrantesTorneio = parseInt(torneio.maxIntegrantes || torneio.max_integrantes || 5, 10) || 5;

  if (textoTipoInscricao) {
    textoTipoInscricao.textContent = tipoInscricaoTorneio;
  }

  if (liMaxIntegrantes && textoMaxIntegrantes) {
    if (tipoInscricaoTorneio === 'Apenas Solo (1v1)') {
      liMaxIntegrantes.style.display = 'none';
    } else {
      liMaxIntegrantes.style.display = 'flex';
      textoMaxIntegrantes.textContent = `Até ${maxIntegrantesTorneio} jogadores`;
    }
  }

  // Banner
  if (detBanner) {
    detBanner.src = torneio.banner || '/images/cerradocup.jpg';
    detBanner.alt = torneio.nome || 'Banner do torneio';
  }

  // Status Badge
  if (detStatusBadge) {
    detStatusBadge.textContent = torneio.status || 'Inscrições abertas';
    detStatusBadge.className = 'torneio-status-badge ' + (torneio.statusClass || 'status-aberto');
  }

  // Nome do Torneio
  if (detNome) {
    detNome.textContent = torneio.nome || 'Torneio sem nome';
  }

  // Meta e Data
  if (detMeta) {
    detMeta.textContent = torneio.jogo || '';
  }
  if (detData) {
    detData.textContent = torneio.data || (torneio.inicioIso ? `Início: ${torneio.inicioIso}` : 'Data a definir');
  }

  // 4) Segunda requisição: tabela 'usuarios' buscando pelo criadorEmail
  if (infoOrganizador) {
    infoOrganizador.style.display = 'flex';
    infoOrganizador.style.alignItems = 'center';
    infoOrganizador.style.gap = '6px';
    infoOrganizador.style.fontSize = '14px';
    infoOrganizador.style.color = '#9cb1cf';
    infoOrganizador.style.margin = '4px 0 10px 0';

    if (torneio.criadorEmail) {
      try {
        const { data: usuario, error: userError } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('email', torneio.criadorEmail)
          .single();

        if (!userError && usuario && usuario.nome) {
          infoOrganizador.innerHTML = `<i class="fa-solid fa-user-shield" style="color: #ff7300; margin-right: 6px;"></i>Organizador: <strong style="color: #ffffff; margin-left: 4px;">${usuario.nome}</strong>`;
        } else {
          infoOrganizador.innerHTML = `<i class="fa-solid fa-user-shield" style="color: #ff7300; margin-right: 6px;"></i>Organizador: <strong style="color: #ffffff; margin-left: 4px;">${torneio.criadorEmail}</strong>`;
        }
      } catch (userCatchErr) {
        console.warn('Erro ao consultar criador do torneio:', userCatchErr);
        infoOrganizador.innerHTML = `<i class="fa-solid fa-user-shield" style="color: #ff7300; margin-right: 6px;"></i>Organizador: <strong style="color: #ffffff; margin-left: 4px;">${torneio.criadorEmail}</strong>`;
      }
    } else {
      infoOrganizador.innerHTML = `<i class="fa-solid fa-shield-halved" style="color: #ff7300; margin-right: 6px;"></i>Organizador: <strong style="color: #ffffff; margin-left: 4px;">VersusHub Oficial</strong>`;
    }
  }

  // 5) Caixa de Transmissão Ao Vivo e Inscrições
  const rawLink = typeof torneio.link === 'string' ? torneio.link.trim() : '';
  const temLinkTransmissaoValido = (rawLink.startsWith('http://') || rawLink.startsWith('https://')) && !rawLink.includes('custom.html');

  const areaTransmissao = document.getElementById('areaTransmissao');
  if (areaTransmissao) {
    areaTransmissao.innerHTML = '';

    if (temLinkTransmissaoValido) {
      // 1. Botão estilizado para assistir transmissão ao vivo
      const btnTransmissao = document.createElement('a');
      btnTransmissao.href = rawLink;
      btnTransmissao.target = '_blank';
      btnTransmissao.rel = 'noopener noreferrer';
      btnTransmissao.id = 'btnAssistirTransmissao';
      btnTransmissao.className = 'btn-transmissao-aovivo';
      btnTransmissao.innerHTML = '<i class="fa-solid fa-play" style="margin-right: 8px;"></i> Assistir Transmissão Ao Vivo';

      // Estilização do botão
      btnTransmissao.style.display = 'flex';
      btnTransmissao.style.alignItems = 'center';
      btnTransmissao.style.justifyContent = 'center';
      btnTransmissao.style.gap = '8px';
      btnTransmissao.style.width = '100%';
      btnTransmissao.style.padding = '14px 18px';
      btnTransmissao.style.marginBottom = '18px';
      btnTransmissao.style.backgroundColor = '#ef4444';
      btnTransmissao.style.color = '#ffffff';
      btnTransmissao.style.fontWeight = '700';
      btnTransmissao.style.fontSize = '14px';
      btnTransmissao.style.textDecoration = 'none';
      btnTransmissao.style.borderRadius = '8px';
      btnTransmissao.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.35)';
      btnTransmissao.style.transition = 'all 0.2s ease-in-out';
      btnTransmissao.style.boxSizing = 'border-box';
      btnTransmissao.style.textAlign = 'center';

      btnTransmissao.onmouseenter = () => {
        btnTransmissao.style.backgroundColor = '#dc2626';
        btnTransmissao.style.transform = 'translateY(-2px)';
      };
      btnTransmissao.onmouseleave = () => {
        btnTransmissao.style.backgroundColor = '#ef4444';
        btnTransmissao.style.transform = 'translateY(0)';
      };

      areaTransmissao.appendChild(btnTransmissao);

      // 2. Força o status badge para "Ao Vivo" (status-andamento)
      if (detStatusBadge) {
        detStatusBadge.textContent = 'Ao Vivo';
        detStatusBadge.className = 'torneio-status-badge status-andamento';
      }
      if (textoStatus) {
        textoStatus.textContent = 'Ao Vivo';
      }

      // 3. Desativa completamente o botão de inscrição da página
      const btnInscreverEl = document.getElementById('btnInscrever');
      if (btnInscreverEl) {
        btnInscreverEl.textContent = 'Inscrições Encerradas';
        btnInscreverEl.disabled = true;
        btnInscreverEl.style.background = '#2c2c3b';
        btnInscreverEl.style.color = '#9ca3af';
        btnInscreverEl.style.border = '2px solid #3b3b4f';
        btnInscreverEl.style.cursor = 'not-allowed';
        btnInscreverEl.style.pointerEvents = 'none';
      }
    } else {
      // Caixa neutra quando não houver transmissão iniciada
      areaTransmissao.innerHTML = `
        <div class="transmissao-offline-box" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #141419; border: 1px solid #2a2a3a; color: #9ca3af; padding: 14px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 18px; text-align: center; box-sizing: border-box;">
          <i class="fa-solid fa-clock" style="color: #6b7280; font-size: 16px;"></i>
          <span>A transmissão ainda não foi iniciada</span>
        </div>
      `;
    }
  }

  // Tags
  if (tagCategoria) {
    if (torneio.categoria) {
      tagCategoria.textContent = `Categoria: ${torneio.categoria.toUpperCase()}`;
      tagCategoria.style.display = 'inline-block';
    } else {
      tagCategoria.style.display = 'none';
    }
  }

  if (tagPlataforma) {
    if (torneio.plataforma) {
      tagPlataforma.textContent = `Plataforma: ${torneio.plataforma.toUpperCase()}`;
      tagPlataforma.style.display = 'inline-block';
    } else {
      tagPlataforma.style.display = 'none';
    }
  }

  const modalidadeTexto = (torneio.modalidade === 'presencial') ? 'Presencial' : 'Online';
  if (tagModalidade) tagModalidade.textContent = `Modalidade: ${modalidadeTexto}`;
  if (infoModalidade) infoModalidade.textContent = modalidadeTexto;

  const localTexto = torneio.localizacao || 'Online';
  if (tagLocalizacao) tagLocalizacao.textContent = `Localização: ${localTexto}`;
  if (infoLocal) infoLocal.textContent = localTexto;

  // Formatação de Taxa
  let taxaFormatada = 'Gratuito';
  if (torneio.taxaTipo === 'pago') {
    taxaFormatada = 'Pago';
    if (torneio.taxaValor) {
      taxaFormatada += ' - R$ ' + Number(torneio.taxaValor).toFixed(2).replace('.', ',');
    }
  }
  if (tagTaxa) tagTaxa.textContent = `Taxa: ${taxaFormatada}`;
  if (infoTaxa) infoTaxa.textContent = taxaFormatada;

  // Status e Plataforma na barra lateral
  if (textoStatus) {
    textoStatus.textContent = temLinkTransmissaoValido ? 'Ao Vivo' : (torneio.status || 'Inscrições abertas');
  }
  if (textoPlataforma) {
    textoPlataforma.textContent = torneio.plataforma ? torneio.plataforma.toUpperCase() : (torneio.jogo || '--');
  }

  // Descrição
  if (detDescricao) {
    detDescricao.textContent = (torneio.descricao && torneio.descricao.trim())
      ? torneio.descricao
      : 'Nenhuma descrição informada.';
  }

  // Regras
  if (listaRegras) {
    listaRegras.innerHTML = '';
    if (torneio.regras && torneio.regras.trim()) {
      torneio.regras.split('\n').forEach(linha => {
        const texto = linha.trim();
        if (!texto) return;
        const li = document.createElement('li');
        li.textContent = texto;
        listaRegras.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'Nenhuma regra específica cadastrada.';
      listaRegras.appendChild(li);
    }
  } else if (detRegras) {
    detRegras.textContent = torneio.regras || 'Nenhuma regra cadastrada.';
  }

  // Requisitos
  if (detRequisitos) {
    detRequisitos.textContent = (torneio.requisitos && torneio.requisitos.trim())
      ? torneio.requisitos
      : 'Nenhum requisito especial informado.';
  }

  // Premiação
  const tipoPremio = torneio.tipoPremio || 'nenhuma';
  const textoSemPremio = document.getElementById('textoSemPremio');
  const li1 = document.getElementById('liPremio1');
  const li2 = document.getElementById('liPremio2');
  const li3 = document.getElementById('liPremio3');
  const liExtra = document.getElementById('liPremioExtra');
  const p1 = document.getElementById('premio1Texto');
  const p2 = document.getElementById('premio2Texto');
  const p3 = document.getElementById('premio3Texto');
  const pExtra = document.getElementById('premioExtraTexto');

  if (textoSemPremio) textoSemPremio.style.display = 'none';
  if (li1) li1.style.display = 'none';
  if (li2) li2.style.display = 'none';
  if (li3) li3.style.display = 'none';
  if (liExtra) liExtra.style.display = 'none';

  if (tipoPremio === 'nenhuma') {
    if (textoSemPremio) textoSemPremio.style.display = 'block';
  } else {
    let hasPrizes = false;
    if (torneio.premio1 && torneio.premio1.trim()) {
      if (li1) { li1.style.display = 'list-item'; if (p1) p1.textContent = torneio.premio1; }
      hasPrizes = true;
    }
    if (torneio.premio2 && torneio.premio2.trim()) {
      if (li2) { li2.style.display = 'list-item'; if (p2) p2.textContent = torneio.premio2; }
      hasPrizes = true;
    }
    if (torneio.premio3 && torneio.premio3.trim()) {
      if (li3) { li3.style.display = 'list-item'; if (p3) p3.textContent = torneio.premio3; }
      hasPrizes = true;
    }
    if (torneio.premiacaoExtra && torneio.premiacaoExtra.trim()) {
      if (liExtra) { liExtra.style.display = 'list-item'; if (pExtra) pExtra.textContent = torneio.premiacaoExtra; }
      hasPrizes = true;
    }
    if (!hasPrizes && textoSemPremio) {
      textoSemPremio.style.display = 'block';
    }
  }

  // 6) Carrega os Participantes Confirmados (Ação 2) utilizando os dados obtidos em paralelo
  await carregarParticipantesConfirmados(torneio.id, preloadedInscricoes);

  // Libera a tela de carregamento após a injeção completa de todos os dados no DOM
  if (document.getElementById('loaderDetalhes')) {
    document.getElementById('loaderDetalhes').style.display = 'none';
  }
  hideLoader();

  // 7) Inscrição no Torneio (Ação 1)
  const btnInscrever = document.getElementById('btnInscrever');
  if (btnInscrever) {
    if (temLinkTransmissaoValido) {
      btnInscrever.textContent = 'Inscrições Encerradas';
      btnInscrever.disabled = true;
      btnInscrever.style.background = '#2c2c3b';
      btnInscrever.style.color = '#9ca3af';
      btnInscrever.style.border = '2px solid #3b3b4f';
      btnInscrever.style.cursor = 'not-allowed';
      btnInscrever.style.pointerEvents = 'none';
    } else {
      if (!loggedUser) {
        loggedUser = await getLoggedUser();
      }
      let inscricaoAtual = null;

      if (loggedUser) {
        try {
          // 1. Busca por e-mail direto do usuário
          const { data: inscricaoDb } = await supabase
            .from('inscricoes')
            .select('*')
            .eq('torneio_id', String(torneio.id))
            .eq('user_email', loggedUser.email)
            .maybeSingle();

          if (inscricaoDb) {
            inscricaoAtual = inscricaoDb;
          } else {
            // 2. Busca se alguma equipe que o usuário lidera está inscrita
            try {
              const { data: equipesDoUser } = await supabase
                .from('equipes')
                .select('id')
                .eq('leaderEmail', loggedUser.email);

              if (equipesDoUser && equipesDoUser.length > 0) {
                const teamIds = equipesDoUser.map(e => String(e.id));
                const { data: inscEquipe } = await supabase
                  .from('inscricoes')
                  .select('*')
                  .eq('torneio_id', String(torneio.id))
                  .in('id_participante', teamIds)
                  .maybeSingle();

                if (inscEquipe) {
                  inscricaoAtual = inscEquipe;
                }
              }
            } catch (errEq) {}
          }
        } catch (chkErr) {
          console.warn('Aviso ao consultar inscrição no Supabase:', chkErr);
        }

        // Checa fallback local se não encontrou no banco
        if (!inscricaoAtual) {
          try {
            const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
            inscricaoAtual = allLocal.find(i => String(i.torneio_id) === String(torneio.id) && (i.user_email === loggedUser.email || (loggedUser.id && String(i.id_participante) === String(loggedUser.id))));
          } catch (eLocal) {}
        }
      }

      // Aplica o estado visual inicial do botão (Cancelar Inscrição se já inscrito e aberto, ou Inscrever-se)
      aplicarEstadoBotao(btnInscrever, inscricaoAtual, torneio);

      btnInscrever.addEventListener('click', async (e) => {
        e.preventDefault();
        if (btnInscrever.disabled) return;

        const user = await getLoggedUser();
        if (!user) {
          showToast('Você precisa estar logado para se inscrever! Redirecionando...');
          setTimeout(() => {
            window.location.href = '/login/login.html';
          }, 1500);
          return;
        }

        // =========================================================================
        // FLUXO DE CANCELAMENTO DE INSCRIÇÃO
        // =========================================================================
        if (inscricaoAtual) {
          if (!torneioPermiteCancelamento(torneio)) {
            showToast('As inscrições deste torneio já estão encerradas e não podem ser canceladas.');
            return;
          }

          // Confirmação com modal ou alerta
          const confirmou = await confirmarCancelamentoModal();
          if (!confirmou) return;

          btnInscrever.disabled = true;
          const textoAntigo = btnInscrever.innerHTML;
          btnInscrever.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Cancelando inscrição...';

          try {
            let removeu = false;

            if (inscricaoAtual.id) {
              const { error: errId } = await supabase
                .from('inscricoes')
                .delete()
                .eq('id', inscricaoAtual.id);
              if (!errId) removeu = true;
            }

            if (!removeu) {
              const { error: errEmail } = await supabase
                .from('inscricoes')
                .delete()
                .eq('torneio_id', String(torneio.id))
                .eq('user_email', user.email);
              if (!errEmail) removeu = true;
            }

            if (inscricaoAtual.id_participante) {
              try {
                await supabase
                  .from('inscricoes')
                  .delete()
                  .eq('torneio_id', String(torneio.id))
                  .eq('id_participante', String(inscricaoAtual.id_participante));
              } catch (eP) {}
            }

            // Fallback para variações de tabelas mencionadas no schema
            try {
              await supabase
                .from('inscricoes_torneio')
                .delete()
                .eq('torneio_id', String(torneio.id))
                .eq('user_email', user.email);
            } catch (e1) {}

            try {
              await supabase
                .from('participantes')
                .delete()
                .eq('torneio_id', String(torneio.id))
                .eq('user_email', user.email);
            } catch (e2) {}

            // Atualiza cache local
            try {
              const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
              const filtrado = allLocal.filter(i => {
                const matchTorneio = String(i.torneio_id) === String(torneio.id);
                const matchUser = i.user_email === user.email || (inscricaoAtual.id && i.id === inscricaoAtual.id) || (inscricaoAtual.id_participante && String(i.id_participante) === String(inscricaoAtual.id_participante));
                return !(matchTorneio && matchUser);
              });
              localStorage.setItem('vh_inscricoes', JSON.stringify(filtrado));

              const storageKey = `vh_joinedTournaments_${user.email}`;
              const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
              const joinedFiltrado = joined.filter(t => String(t.id) !== String(torneio.id));
              localStorage.setItem(storageKey, JSON.stringify(joinedFiltrado));
            } catch (eCache) {
              console.warn('Aviso ao sincronizar cache local após cancelamento:', eCache);
            }

            // Atualização de tela: reseta inscrição e botão imediatamente para 'Inscrever-se'
            inscricaoAtual = null;
            aplicarEstadoBotao(btnInscrever, null, torneio);
            showToast('Inscrição cancelada com sucesso!');

            // Atualiza o contador de vagas e participantes
            await carregarParticipantesConfirmados(torneio.id, null, torneio);
          } catch (errCancel) {
            console.error('Erro ao cancelar inscrição:', errCancel);
            showToast('Ocorreu um erro ao cancelar sua inscrição. Tente novamente.');
            btnInscrever.disabled = false;
            btnInscrever.innerHTML = textoAntigo;
          }
          return;
        }

        // =========================================================================
        // FLUXO DE NOVA INSCRIÇÃO
        // =========================================================================
        // Torneio Apenas Solo (1v1): Inscrição direta do usuário logado
        if (tipoInscricaoTorneio === 'Apenas Solo (1v1)') {
          await realizarInscricaoSoloDireta(torneio, user, async (novaInscricao) => {
            inscricaoAtual = novaInscricao;
            aplicarEstadoBotao(btnInscrever, novaInscricao, torneio);
            await carregarParticipantesConfirmados(torneio.id, null, torneio);
          });
          return;
        }

        // Torneio Apenas Equipe ou Solo ou Equipe: Abre modal com escalação
        abrirModalEscolhaInscricao(torneio, user, async (novaInscricao) => {
          inscricaoAtual = novaInscricao;
          aplicarEstadoBotao(btnInscrever, novaInscricao, torneio);
          await carregarParticipantesConfirmados(torneio.id, null, torneio);
        });
      });
    }
  }

  // ==============================================================================
  // 5. MODAL DE EDIÇÃO DE TORNEIO (Upload de Arquivo + Preview + Update Supabase)
  // ==============================================================================
    const modalEditarTorneio = document.getElementById('modalEditarTorneioCustom');
    const formEditarTorneio = document.getElementById('formEditarTorneioCustom');
    const btnAbrirModalEdit = document.getElementById('btnAbrirModalEditarTorneio');
    const btnFecharModalEdit = document.getElementById('btnFecharModalEditarTorneio');
    const btnCancelarModalEdit = document.getElementById('btnCancelarModalEditarTorneio');
    const areaAcoesCriador = document.getElementById('areaAcoesCriador');

    const fileInputBanner = document.getElementById('customEditBannerFile');
    const previewBannerImg = document.getElementById('customEditBannerPreviewImg');
    let customEditBannerDataUrl = '';

    // Verifica se o usuário logado é o organizador/criador do torneio
    const isCriador = loggedUser && (
      (torneio.criadorEmail && loggedUser.email === torneio.criadorEmail) ||
      (torneio.criador_email && loggedUser.email === torneio.criador_email) ||
      (torneio.user_email && loggedUser.email === torneio.user_email) ||
      loggedUser.isAdmin ||
      loggedUser.cargo === 'admin' ||
      loggedUser.email === 'admin@versushub.com'
    );

    const isCriadorLocal = (() => {
      try {
        const createdList = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
        return createdList.some(t => String(t.id) === String(torneio.id));
      } catch (e) {
        return false;
      }
    })();

    if (areaAcoesCriador && (isCriador || isCriadorLocal)) {
      areaAcoesCriador.style.display = 'block';
    }

    if (fileInputBanner) {
      fileInputBanner.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          showToast('Selecione apenas arquivos de imagem.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          customEditBannerDataUrl = ev.target.result;
          if (previewBannerImg) {
            previewBannerImg.src = customEditBannerDataUrl;
          }
        };
        reader.readAsDataURL(file);
      });
    }

    function fecharModalEdicaoTorneio() {
      if (modalEditarTorneio) modalEditarTorneio.style.display = 'none';
    }

    if (btnFecharModalEdit) btnFecharModalEdit.addEventListener('click', fecharModalEdicaoTorneio);
    if (btnCancelarModalEdit) btnCancelarModalEdit.addEventListener('click', fecharModalEdicaoTorneio);
    if (modalEditarTorneio) {
      modalEditarTorneio.addEventListener('click', (e) => {
        if (e.target === modalEditarTorneio) fecharModalEdicaoTorneio();
      });
    }

    function abrirModalEdicaoTorneio() {
      if (!modalEditarTorneio) return;

      document.getElementById('customEditId').value = torneio.id;
      document.getElementById('customEditNome').value = torneio.nome || '';
      document.getElementById('customEditJogo').value = torneio.jogo || '';
      document.getElementById('customEditData').value = torneio.data || '';
      document.getElementById('customEditStatus').value = torneio.status || 'Inscrições abertas';
      document.getElementById('customEditModalidade').value = torneio.modalidade || 'online';
      document.getElementById('customEditLocalizacao').value = torneio.localizacao || '';
      document.getElementById('customEditCategoria').value = (torneio.categoria || 'fps').toLowerCase();
      document.getElementById('customEditPlataforma').value = torneio.plataforma || 'PC';
      document.getElementById('customEditLimite').value = torneio.limite || '';
      document.getElementById('customEditLink').value = torneio.link || '';
      document.getElementById('customEditDescricao').value = torneio.descricao || '';
      document.getElementById('customEditRegras').value = torneio.regras || '';
      document.getElementById('customEditRequisitos').value = torneio.requisitos || '';

      const editTipoInscricao = document.getElementById('customEditTipoInscricao');
      const editMaxIntegrantes = document.getElementById('customEditMaxIntegrantes');
      if (editTipoInscricao) editTipoInscricao.value = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
      if (editMaxIntegrantes) editMaxIntegrantes.value = parseInt(torneio.maxIntegrantes || torneio.max_integrantes || 5, 10) || 5;

      customEditBannerDataUrl = '';
      if (fileInputBanner) fileInputBanner.value = '';
      if (previewBannerImg) {
        previewBannerImg.src = torneio.banner || '/images/cerradocup.jpg';
        previewBannerImg.onerror = () => { previewBannerImg.src = '/images/cerradocup.jpg'; };
      }

      modalEditarTorneio.style.display = 'flex';
    }

    if (btnAbrirModalEdit) {
      btnAbrirModalEdit.addEventListener('click', abrirModalEdicaoTorneio);
    }

    if (formEditarTorneio) {
      formEditarTorneio.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSave = document.getElementById('btnSalvarModalEditarTorneio');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Salvando...';
        }

        const bannerNovo = customEditBannerDataUrl || torneio.banner || '/images/cerradocup.jpg';
        const statusNovo = document.getElementById('customEditStatus').value;
        let statusClassNovo = 'status-aberto';
        if (statusNovo === 'Em andamento' || statusNovo === 'Ao Vivo') statusClassNovo = 'status-andamento';
        else if (statusNovo === 'Encerrado') statusClassNovo = 'status-encerrado';

        const editTipo = document.getElementById('customEditTipoInscricao');
        const editMax = document.getElementById('customEditMaxIntegrantes');
        const novoTipoInscricao = editTipo ? editTipo.value : (torneio.tipoInscricao || 'Solo ou Equipe');
        const novoMaxIntegrantes = editMax ? (parseInt(editMax.value, 10) || 5) : (parseInt(torneio.maxIntegrantes, 10) || 5);

        const updatePayload = {
          nome: document.getElementById('customEditNome').value.trim(),
          jogo: document.getElementById('customEditJogo').value.trim(),
          data: document.getElementById('customEditData').value.trim(),
          status: statusNovo,
          statusClass: statusClassNovo,
          modalidade: document.getElementById('customEditModalidade').value,
          localizacao: document.getElementById('customEditLocalizacao').value.trim(),
          categoria: document.getElementById('customEditCategoria').value,
          plataforma: document.getElementById('customEditPlataforma').value,
          limite: document.getElementById('customEditLimite').value.trim(),
          link: document.getElementById('customEditLink').value.trim(),
          descricao: document.getElementById('customEditDescricao').value.trim(),
          regras: document.getElementById('customEditRegras').value.trim(),
          requisitos: document.getElementById('customEditRequisitos').value.trim(),
          tipoInscricao: novoTipoInscricao,
          tipo_inscricao: novoTipoInscricao,
          maxIntegrantes: novoMaxIntegrantes,
          max_integrantes: novoMaxIntegrantes,
          banner: bannerNovo
        };

        try {
          // 1. Atualização no Supabase com fallback resiliente de colunas
          let { error } = await supabase
            .from('torneios')
            .update(updatePayload)
            .eq('id', torneio.id);

          if (error) {
            console.warn('Tentativa com payload completo falhou ao atualizar, tentando alternativas:', error);
            const payloadCamel = { ...updatePayload };
            delete payloadCamel.tipo_inscricao;
            delete payloadCamel.max_integrantes;
            const resCamel = await supabase.from('torneios').update(payloadCamel).eq('id', torneio.id);
            if (!resCamel.error) {
              error = null;
            } else {
              const payloadSnake = { ...updatePayload };
              delete payloadSnake.tipoInscricao;
              delete payloadSnake.maxIntegrantes;
              const resSnake = await supabase.from('torneios').update(payloadSnake).eq('id', torneio.id);
              if (!resSnake.error) {
                error = null;
              } else {
                const payloadBase = { ...updatePayload };
                delete payloadBase.tipoInscricao;
                delete payloadBase.tipo_inscricao;
                delete payloadBase.maxIntegrantes;
                delete payloadBase.max_integrantes;
                const resBase = await supabase.from('torneios').update(payloadBase).eq('id', torneio.id);
                error = resBase.error;
              }
            }
          }

          if (error) {
            console.error('Erro ao salvar torneio no Supabase:', error);
            showToast('Erro ao salvar alterações no banco de dados.');
            return;
          }

          // 2. Atualiza objeto em memória
          Object.assign(torneio, updatePayload);

          // 3. Atualiza cache local vh_createdTournaments
          try {
            const allCreated = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
            const idx = allCreated.findIndex(t => String(t.id) === String(torneio.id));
            if (idx !== -1) {
              allCreated[idx] = { ...allCreated[idx], ...updatePayload };
              localStorage.setItem('vh_createdTournaments', JSON.stringify(allCreated));
            }
          } catch (e) {}

          // 4. Atualiza os elementos visuais na página atual
          if (detBanner) detBanner.src = torneio.banner;
          if (detNome) detNome.textContent = torneio.nome;
          document.title = `${torneio.nome || 'Torneio'} - VersusHub`;
          if (detMeta) detMeta.textContent = torneio.jogo;
          if (detData) detData.textContent = torneio.data;

          if (detStatusBadge) {
            detStatusBadge.textContent = torneio.status;
            detStatusBadge.className = 'torneio-status-badge ' + (torneio.statusClass || 'status-aberto');
          }
          if (textoStatus) {
            textoStatus.textContent = torneio.status;
          }
          if (textoTipoInscricao) {
            textoTipoInscricao.textContent = torneio.tipoInscricao;
          }
          if (liMaxIntegrantes && textoMaxIntegrantes) {
            if (torneio.tipoInscricao === 'Apenas Solo (1v1)') {
              liMaxIntegrantes.style.display = 'none';
            } else {
              liMaxIntegrantes.style.display = 'flex';
              textoMaxIntegrantes.textContent = `Até ${torneio.maxIntegrantes} jogadores`;
            }
          }

          if (detDescricao) {
            detDescricao.textContent = torneio.descricao || 'Nenhuma descrição informada.';
          }

          if (listaRegras) {
            listaRegras.innerHTML = '';
            if (torneio.regras && torneio.regras.trim()) {
              torneio.regras.split('\n').forEach(linha => {
                const texto = linha.trim();
                if (!texto) return;
                const li = document.createElement('li');
                li.textContent = texto;
                listaRegras.appendChild(li);
              });
            } else {
              const li = document.createElement('li');
              li.textContent = 'Nenhuma regra específica cadastrada.';
              listaRegras.appendChild(li);
            }
          }

          if (detRequisitos) {
            detRequisitos.textContent = torneio.requisitos || 'Nenhum requisito especial informado.';
          }

          if (tagCategoria) {
            if (torneio.categoria) {
              tagCategoria.textContent = `Categoria: ${torneio.categoria.toUpperCase()}`;
              tagCategoria.style.display = 'inline-block';
            } else {
              tagCategoria.style.display = 'none';
            }
          }

          if (tagPlataforma) {
            if (torneio.plataforma) {
              tagPlataforma.textContent = `Plataforma: ${torneio.plataforma.toUpperCase()}`;
              tagPlataforma.style.display = 'inline-block';
            } else {
              tagPlataforma.style.display = 'none';
            }
          }

          const modTexto = (torneio.modalidade === 'presencial') ? 'Presencial' : 'Online';
          if (tagModalidade) tagModalidade.textContent = `Modalidade: ${modTexto}`;
          if (infoModalidade) infoModalidade.textContent = modTexto;

          const locTexto = torneio.localizacao || 'Online';
          if (tagLocalizacao) tagLocalizacao.textContent = `Localização: ${locTexto}`;
          if (infoLocal) infoLocal.textContent = locTexto;

          fecharModalEdicaoTorneio();
          showToast('Torneio atualizado com sucesso!');
        } catch (err) {
          console.error('Erro ao atualizar torneio:', err);
          showToast('Ocorreu um erro ao atualizar o torneio.');
        } finally {
          if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'Salvar Alterações';
          }
        }
      });
    }
});

// ==============================================================================
// FUNÇÕES AUXILIARES DE INSCRIÇÃO E PARTICIPANTES (FontAwesome - Zero Emojis)
// ==============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function torneioPermiteCancelamento(torneioObj) {
  const st = (torneioObj?.status || 'Inscrições abertas').toLowerCase().trim();
  return st.includes('abert') || st.includes('inscri');
}

function aplicarEstadoBotao(btn, inscricao, torneioObj) {
  if (!btn) return;
  const tipoInscricaoTorneio = torneioObj?.tipoInscricao || torneioObj?.tipo_inscricao || 'Solo ou Equipe';

  if (inscricao) {
    if (torneioPermiteCancelamento(torneioObj)) {
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.className = 'btn-principal btn-cancelar-inscricao';
      btn.innerHTML = '<i class="fa-solid fa-user-xmark" style="margin-right: 6px;"></i> Cancelar Inscrição';
      btn.style.background = '#dc2626';
      btn.style.color = '#ffffff';
      btn.style.border = '2px solid #ef4444';
      btn.style.boxShadow = '0 4px 15px rgba(220, 38, 38, 0.4)';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
      btn.setAttribute('title', 'Clique para cancelar sua inscrição neste torneio');
    } else {
      btn.className = 'btn-principal';
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
      btn.style.pointerEvents = 'none';
      btn.removeAttribute('title');
      if (inscricao.status === 'Aceito') {
        btn.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Inscrição Confirmada';
        btn.style.background = '#065f46';
        btn.style.color = '#34d399';
        btn.style.border = '1px solid #10b981';
        btn.style.boxShadow = 'none';
      } else {
        btn.innerHTML = '<i class="fa-solid fa-clock" style="margin-right: 6px;"></i> Inscrição Pendente';
        btn.style.background = '#2c2c3b';
        btn.style.color = '#facc15';
        btn.style.border = '1px solid #854d0e';
        btn.style.boxShadow = 'none';
      }
    }
    return;
  }

  // Não está inscrito (ou cancelou a inscrição)
  btn.className = 'btn-principal';
  btn.disabled = false;
  btn.removeAttribute('disabled');
  btn.style.cursor = 'pointer';
  btn.style.pointerEvents = 'auto';
  btn.style.background = '#d41111';
  btn.style.color = '#ffffff';
  btn.style.border = '2px solid #d41111';
  btn.style.boxShadow = '0 0 14px rgba(212, 17, 17, 0.35)';
  btn.removeAttribute('title');

  if (tipoInscricaoTorneio === 'Apenas Solo (1v1)') {
    btn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 6px;"></i> Inscrever-se (Solo)';
  } else if (tipoInscricaoTorneio === 'Apenas Equipe') {
    btn.innerHTML = '<i class="fa-solid fa-shield-halved" style="margin-right: 6px;"></i> Inscrever Equipe';
  } else {
    btn.innerHTML = '<i class="fa-solid fa-trophy" style="margin-right: 6px;"></i> Inscrever-se';
  }
}

function aplicarEstadoBotaoInscrito(btn, status, torneioObj = null) {
  const tObj = torneioObj || (typeof torneioGlobal !== 'undefined' ? torneioGlobal : null);
  aplicarEstadoBotao(btn, { status }, tObj);
}

function confirmarCancelamentoModal() {
  return new Promise((resolve) => {
    const existing = document.getElementById('modalConfirmarCancelamento');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-inscricao-overlay';
    overlay.id = 'modalConfirmarCancelamento';
    overlay.style.zIndex = '9999999';

    overlay.innerHTML = `
      <div class="modal-inscricao-content" style="max-width: 440px; text-align: center; padding: 32px 24px; border: 1px solid #3b1818; box-shadow: 0 20px 50px rgba(0,0,0,0.85);">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; color: #ef4444;"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 10px;">Cancelar Inscrição</h3>
        <p style="font-size: 14.5px; color: #9ca3af; margin: 0 0 24px; line-height: 1.5;">
          Tem certeza de que deseja cancelar sua inscrição neste torneio?
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button type="button" id="btnNaoCancelarInscricao" style="flex: 1; padding: 12px 18px; border-radius: 10px; border: 1px solid #374151; background: #1f2937; color: #e5e7eb; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease;">
            Não, manter
          </button>
          <button type="button" id="btnSimCancelarInscricao" style="flex: 1; padding: 12px 18px; border-radius: 10px; border: none; background: #dc2626; color: #ffffff; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
            <i class="fa-solid fa-user-xmark" style="margin-right: 6px;"></i> Sim, cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };
    document.addEventListener('keydown', onKeyDown);

    overlay.querySelector('#btnNaoCancelarInscricao').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#btnSimCancelarInscricao').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

function salvarInscricaoLocal(inscricao, torneio) {
  try {
    const list = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
    const filtered = list.filter(i => !(String(i.torneio_id) === String(inscricao.torneio_id) && String(i.id_participante) === String(inscricao.id_participante)));
    filtered.push(inscricao);
    localStorage.setItem('vh_inscricoes', JSON.stringify(filtered));

    // Atualiza vh_joinedTournaments do usuário
    const storageKey = `vh_joinedTournaments_${inscricao.user_email}`;
    const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const idx = joined.findIndex(t => String(t.id) === String(torneio.id));
    const itemJoined = {
      id: torneio.id,
      nome: torneio.nome || 'Torneio',
      jogo: torneio.jogo || '',
      data: torneio.data || '',
      status: torneio.status || '',
      statusClass: torneio.statusClass || '',
      banner: torneio.banner || '',
      link: `/torneio/custom.html?id=${encodeURIComponent(torneio.id)}`,
      inscricaoStatus: inscricao.status || 'Pendente',
      tipo: inscricao.tipo,
      id_participante: inscricao.id_participante
    };
    if (idx !== -1) {
      joined[idx] = { ...joined[idx], ...itemJoined };
    } else {
      joined.unshift(itemJoined);
    }
    localStorage.setItem(storageKey, JSON.stringify(joined));
  } catch (e) {
    console.error('Erro ao salvar inscrição no cache local:', e);
  }
}

// AÇÃO 2: Exibir Participantes Confirmados e Atualizar Contador de Vagas
async function carregarParticipantesConfirmados(torneioId, preloadedInscricoes = null, torneioObj = null) {
  const listaEl = document.getElementById('listaParticipantes');
  if (!listaEl) return;

  try {
    let aceitos = [];
    if (Array.isArray(preloadedInscricoes)) {
      aceitos = preloadedInscricoes;
    } else {
      try {
        const { data, error } = await supabase
          .from('inscricoes')
          .select('*')
          .eq('torneio_id', String(torneioId))
          .eq('status', 'Aceito');

        if (!error && Array.isArray(data)) {
          aceitos = data;
        }
      } catch (e) {
        console.warn('Aviso ao consultar inscrições aceitas:', e);
      }
    }

    // Mescla com cache local vh_inscricoes
    try {
      const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
      allLocal
        .filter(i => String(i.torneio_id) === String(torneioId) && i.status === 'Aceito')
        .forEach(li => {
          if (!aceitos.some(a => String(a.id_participante) === String(li.id_participante))) {
            aceitos.push(li);
          }
        });
    } catch (eLocal) {}

    // Atualiza indicadores de participantes e vagas na tela
    const contadorEl = document.getElementById('contadorParticipantes');
    const textoVagasEl = document.getElementById('textoVagas');
    const liVagasEl = document.getElementById('liVagas');

    const objTorneio = torneioObj || (typeof torneioGlobal !== 'undefined' ? torneioGlobal : null);

    let limiteNum = null;
    if (objTorneio?.limite) {
      const match = String(objTorneio.limite).match(/\d+/);
      if (match) limiteNum = parseInt(match[0], 10);
    }

    const totalConfirmados = aceitos.length;

    if (contadorEl) {
      if (limiteNum) {
        contadorEl.textContent = `${totalConfirmados} / ${limiteNum} confirmados`;
      } else {
        contadorEl.textContent = `${totalConfirmados} confirmado${totalConfirmados === 1 ? '' : 's'}`;
      }
    }

    if (textoVagasEl) {
      if (limiteNum) {
        const restantes = Math.max(0, limiteNum - totalConfirmados);
        textoVagasEl.textContent = `${totalConfirmados}/${limiteNum} (${restantes} restante${restantes === 1 ? '' : 's'})`;
        if (liVagasEl) liVagasEl.style.display = 'flex';
      } else {
        textoVagasEl.textContent = `${totalConfirmados} confirmado${totalConfirmados === 1 ? '' : 's'}`;
        if (liVagasEl) liVagasEl.style.display = 'flex';
      }
    }

    if (aceitos.length === 0) {
      listaEl.innerHTML = `
        <div class="participantes-vazio">
          <i class="fa-solid fa-user-group" style="color: #6b7280; font-size: 18px;"></i>
          <span>Nenhum participante confirmado ainda. As inscrições aprovadas aparecerão aqui.</span>
        </div>
      `;
      return;
    }

    // Busca detalhes de cada participante de acordo com seu tipo
    const promessas = aceitos.map(async (insc) => {
      const tipo = (insc.tipo || 'individual').toLowerCase();
      const idPart = insc.id_participante || insc.user_email;

      let nome = idPart;
      let foto = '/image/boneco_logo_ofc.png';
      let subtitulo = tipo === 'equipe' ? 'Equipe' : 'Jogador';

      if (tipo === 'equipe') {
        try {
          const { data: eqDb } = await supabase
            .from('equipes')
            .select('nome, tag, logo')
            .eq('id', idPart)
            .maybeSingle();

          if (eqDb) {
            nome = eqDb.nome + (eqDb.tag ? ` [${eqDb.tag}]` : '');
            if (eqDb.logo) foto = eqDb.logo;
          } else {
            const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
            const cachedTeams = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
            const found = localTeams.find(t => String(t.id) === String(idPart)) || cachedTeams.find(t => String(t.id) === String(idPart));
            if (found) {
              nome = found.nome + (found.tag ? ` [${found.tag}]` : '');
              if (found.logo) foto = found.logo;
            }
          }
        } catch (errEq) {
          console.warn('Erro ao consultar dados da equipe:', errEq);
        }
      } else {
        // Individual -> busca na tabela usuarios
        try {
          const { data: uDb } = await supabase
            .from('usuarios')
            .select('nome, avatar')
            .eq('email', idPart)
            .maybeSingle();

          if (uDb) {
            if (uDb.nome) nome = uDb.nome;
            if (uDb.avatar) foto = uDb.avatar;
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
          console.warn('Erro ao consultar dados do usuário:', errU);
        }
      }

      return {
        id: insc.id || idPart,
        tipo,
        nome,
        foto,
        subtitulo
      };
    });

    const participantesDetalhados = await Promise.all(promessas);

    listaEl.innerHTML = participantesDetalhados.map(p => `
      <div class="participante-card" title="${escapeHtml(p.nome)}">
        <img
          src="${p.foto}"
          alt="${escapeHtml(p.nome)}"
          onerror="this.src='/image/boneco_logo_ofc.png'"
          class="participante-avatar ${p.tipo === 'equipe' ? 'avatar-equipe' : ''}"
        />
        <div class="participante-info">
          <strong class="participante-nome">${escapeHtml(p.nome)}</strong>
          <span class="participante-badge ${p.tipo === 'equipe' ? 'badge-equipe' : 'badge-jogador'}">
            <i class="fa-solid ${p.tipo === 'equipe' ? 'fa-shield-halved' : 'fa-user'}"></i>
            ${escapeHtml(p.subtitulo)}
          </span>
        </div>
      </div>
    `).join('');
  } catch (errGeral) {
    console.error('Erro ao renderizar participantes:', errGeral);
    listaEl.innerHTML = `
      <div style="color: #ef4444; font-size: 13px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar os participantes.
      </div>
    `;
  }
}

// AÇÃO 1.1: Inscrição Solo Direta (quando o torneio for Apenas Solo)
async function realizarInscricaoSoloDireta(torneio, loggedUser, onSucesso) {
  const btnInscrever = document.getElementById('btnInscrever');
  const textoOriginal = btnInscrever ? btnInscrever.textContent : 'Inscrever-se';
  if (btnInscrever) {
    btnInscrever.disabled = true;
    btnInscrever.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscrevendo...';
  }

  const novaInscricao = {
    torneio_id: String(torneio.id),
    user_email: loggedUser.email,
    tipo: 'individual',
    id_participante: loggedUser.email,
    status: 'Pendente',
    created_at: new Date().toISOString()
  };

  try {
    try {
      const { error: insErr } = await supabase
        .from('inscricoes')
        .insert([novaInscricao]);

      if (insErr) {
        console.warn('Aviso no Supabase inscricoes:', insErr);
      }
    } catch (errDb) {
      console.warn('Banco remoto inacessível, prosseguindo com cache local:', errDb);
    }

    salvarInscricaoLocal(novaInscricao, torneio);
    showToast('Inscrição individual confirmada com sucesso! Aguarde a aprovação do organizador.');

    if (typeof onSucesso === 'function') {
      onSucesso(novaInscricao);
    }
  } catch (err) {
    console.error('Erro na inscrição solo direta:', err);
    showToast('Ocorreu um erro ao realizar a inscrição. Tente novamente.');
    if (btnInscrever) {
      btnInscrever.disabled = false;
      btnInscrever.textContent = textoOriginal;
    }
  }
}

// AÇÃO 1.2: Modal de Inscrição e Escalação de Line-up (Apenas Equipe ou Solo ou Equipe)
function abrirModalEscolhaInscricao(torneio, loggedUser, onSucesso) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-inscricao-overlay';
  overlay.id = 'modalEscolhaInscricaoOverlay';

  const tipoTorneio = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
  const maxIntegrantes = parseInt(torneio.maxIntegrantes || torneio.max_integrantes || 5, 10) || 5;
  const apenasEquipe = tipoTorneio === 'Apenas Equipe';

  overlay.innerHTML = `
    <div class="modal-inscricao-content" style="max-width: 580px;">
      <div class="modal-inscricao-header">
        <h3>
          <i class="fa-solid ${apenasEquipe ? 'fa-shield-halved' : 'fa-trophy'}" style="color: #ef4444;"></i>
          ${apenasEquipe ? 'Inscrição de Equipe no Torneio' : 'Inscrição no Torneio'}
        </h3>
        <button type="button" class="btn-close-modal" id="btnFecharModalInscricao" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <p style="font-size: 14px; color: #b1b1cf; margin-top: 0; margin-bottom: 16px;">
        ${apenasEquipe
          ? `Este torneio é exclusivo para equipes. Escale até <strong>${maxIntegrantes}</strong> integrantes:`
          : 'Como deseja participar deste campeonato?'}
      </p>

      ${!apenasEquipe ? `
        <div class="modal-inscricao-opcoes">
          <div class="opcao-card card-ind selected" id="opcaoIndividual" role="button" tabindex="0">
            <i class="fa-solid fa-user"></i>
            <strong>Individual</strong>
            <span>Inscreva-se com seu perfil individual de jogador</span>
          </div>

          <div class="opcao-card card-eq" id="opcaoEquipe" role="button" tabindex="0">
            <i class="fa-solid fa-shield-halved"></i>
            <strong>Equipe</strong>
            <span>Inscreva e escale os membros da sua equipe</span>
          </div>
        </div>
      ` : ''}

      <div id="areaDetalhesInscricao" style="background: #181824; border: 1px solid #28283a; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <!-- Injetado dinamicamente dependendo da opção selecionada -->
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" id="btnCancelarModalInscricao" style="background: transparent; border: 1px solid #3b3b4f; color: #b1b1cf; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Cancelar
        </button>
        <button type="button" id="btnConfirmarInscricaoModal" class="btn-principal" style="width: auto; margin-top: 0; padding: 10px 22px;">
          <i class="fa-solid fa-check"></i> Confirmar Inscrição
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.querySelector('#btnFecharModalInscricao').addEventListener('click', fechar);
  overlay.querySelector('#btnCancelarModalInscricao').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  const optInd = overlay.querySelector('#opcaoIndividual');
  const optEq = overlay.querySelector('#opcaoEquipe');
  const areaDetalhes = overlay.querySelector('#areaDetalhesInscricao');
  const btnConfirmar = overlay.querySelector('#btnConfirmarInscricaoModal');

  let tipoSelecionado = apenasEquipe ? 'equipe' : 'individual';
  let equipeSelecionadaId = null;
  let equipesLideradas = [];

  function renderDetalhesIndividual() {
    tipoSelecionado = 'individual';
    if (optInd) optInd.classList.add('selected');
    if (optEq) optEq.classList.remove('selected');
    btnConfirmar.disabled = false;

    areaDetalhes.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <img
          src="${loggedUser.avatar || '/image/boneco_logo_ofc.png'}"
          alt="${escapeHtml(loggedUser.nome || 'Jogador')}"
          onerror="this.src='/image/boneco_logo_ofc.png'"
          style="width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid #ef4444;"
        />
        <div>
          <strong style="color: #ffffff; font-size: 15px; display: block;">${escapeHtml(loggedUser.nome || loggedUser.email)}</strong>
          <span style="font-size: 12px; color: #9ca3af;"><i class="fa-solid fa-envelope"></i> ${escapeHtml(loggedUser.email)}</span>
        </div>
      </div>
      <p style="font-size: 13px; color: #b1b1cf; margin: 12px 0 0 0; line-height: 1.4;">
        Sua inscrição será enviada ao organizador como participante solo individual.
      </p>
    `;
  }

  async function renderDetalhesEquipe() {
    tipoSelecionado = 'equipe';
    if (optEq) optEq.classList.add('selected');
    if (optInd) optInd.classList.remove('selected');

    areaDetalhes.innerHTML = `
      <div style="text-align: center; padding: 20px 0; color: #9ca3af;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: #ef4444;"></i>
        <span style="display: block; margin-top: 10px; font-size: 13px; font-weight: 500;">Carregando equipes e line-up...</span>
      </div>
    `;

    try {
      let teams = [];
      const userEmail = (loggedUser.email || '').trim().toLowerCase();
      const userNome = (loggedUser.nome || '').trim();
      let orFilter = `leaderEmail.ilike.${userEmail}`;
      if (userNome) {
        orFilter += `,leaderName.eq.${userNome}`;
      }

      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .or(orFilter);

      if (!error && Array.isArray(data)) {
        teams = data;
      }

      // Mescla com equipes criadas localmente (vh_createdTeams)
      try {
        const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
        localTeams.forEach(lt => {
          const ehLider = !lt.leaderEmail || lt.leaderEmail.toLowerCase() === loggedUser.email.toLowerCase();
          if (ehLider && !teams.some(t => String(t.id) === String(lt.id))) {
            teams.push(lt);
          }
        });
      } catch (eLocal) {}

      equipesLideradas = teams;

      if (equipesLideradas.length === 0) {
        btnConfirmar.disabled = true;
        areaDetalhes.innerHTML = `
          <div style="text-align: center; padding: 14px 0;">
            <i class="fa-solid fa-shield-halved" style="font-size: 32px; color: #f59e0b; margin-bottom: 10px; display: block;"></i>
            <strong style="color: #ffffff; font-size: 15px; display: block;">Nenhuma equipe liderada encontrada</strong>
            <p style="font-size: 13px; color: #9ca3af; margin: 8px 0 14px 0; line-height: 1.5;">
              Para inscrever uma equipe, você precisa ser o capitão ou líder de uma equipe cadastrada.
            </p>
            <a href="/cria_equipe/criar_equipe.html" style="display: inline-flex; align-items: center; gap: 6px; background: #ef4444; color: #ffffff; text-decoration: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;">
              <i class="fa-solid fa-plus"></i> Criar uma Equipe Agora
            </a>
          </div>
        `;
        return;
      }

      equipeSelecionadaId = String(equipesLideradas[0].id);

      areaDetalhes.innerHTML = `
        <label for="selectEquipeInscricao" style="display: block; font-size: 13px; font-weight: 600; color: #e5e5ff; margin-bottom: 8px;">
          Selecione a equipe para disputar o torneio:
        </label>
        <select id="selectEquipeInscricao" style="width: 100%; background: #12121a; border: 1.5px solid #3b3b4f; color: #ffffff; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 14px;">
          ${equipesLideradas.map(eq => `
            <option value="${escapeHtml(eq.id)}">${escapeHtml(eq.nome)} ${eq.tag ? '[' + escapeHtml(eq.tag) + ']' : ''}</option>
          `).join('')}
        </select>

        <div id="containerLineupEscalacao">
          <!-- Renderizado dinamicamente via carregarLineupEquipe -->
        </div>
      `;

      const selectEl = areaDetalhes.querySelector('#selectEquipeInscricao');

      const carregarLineupEquipe = async (teamId) => {
        const eq = equipesLideradas.find(t => String(t.id) === String(teamId));
        if (!eq) return;

        const containerLineup = areaDetalhes.querySelector('#containerLineupEscalacao');
        if (!containerLineup) return;

        containerLineup.innerHTML = `
          <div style="text-align: center; padding: 14px 0; color: #9ca3af;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 20px; color: #ef4444;"></i>
            <span style="display: block; margin-top: 8px; font-size: 12px;">Buscando integrantes com status 'Aceito'...</span>
          </div>
        `;

        btnConfirmar.disabled = true;

        try {
          // 1. Consulta membros com status = 'Aceito'
          const { data: membrosDb } = await supabase
            .from('membros_equipe')
            .select('id, equipe_id, user_email, status')
            .or(`equipe_id.eq.${eq.id},equipe_id.eq.${eq.nome}`)
            .eq('status', 'Aceito');

          const membrosAceitos = Array.isArray(membrosDb) ? membrosDb : [];

          // 2. Monta lista de participantes da equipe (Líder + Membros Aceitos)
          const leaderEmail = (eq.leaderEmail || loggedUser.email || '').toLowerCase().trim();
          const uniqueEmails = new Set();
          if (leaderEmail) uniqueEmails.add(leaderEmail);

          membrosAceitos.forEach(m => {
            const em = (m.user_email || '').toLowerCase().trim();
            if (em) uniqueEmails.add(em);
          });

          const emailsArr = Array.from(uniqueEmails);

          // 3. Busca detalhes de perfil (nome, avatar) na tabela usuarios
          let usuariosMap = new Map();
          if (emailsArr.length > 0) {
            try {
              const { data: usersDb } = await supabase
                .from('usuarios')
                .select('email, nome, avatar')
                .in('email', emailsArr);

              (usersDb || []).forEach(u => {
                usuariosMap.set((u.email || '').toLowerCase().trim(), u);
              });
            } catch (uErr) {
              console.warn('Aviso ao consultar perfis de usuários da line-up:', uErr);
            }
          }

          // 4. Constrói o roster final para exibição das checkboxes
          const roster = emailsArr.map(email => {
            const isLeader = email === leaderEmail;
            const profile = usuariosMap.get(email);
            let nome = isLeader ? (eq.leaderName || profile?.nome || loggedUser.nome || 'Líder') : (profile?.nome || email.split('@')[0]);
            let avatar = isLeader ? (eq.leaderAvatar || profile?.avatar || loggedUser.avatar || '/image/boneco_logo_ofc.png') : (profile?.avatar || '/image/boneco_logo_ofc.png');

            return {
              email,
              nome,
              avatar,
              isLeader
            };
          });

          // Renderiza o painel de Escalação de Line-up (Abordagem B)
          containerLineup.innerHTML = `
            <div style="background: #111118; border: 1px solid #28283a; border-radius: 10px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                  <strong style="color: #ffffff; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-list-check" style="color: #ef4444;"></i> Escalação da Line-up
                  </strong>
                  <span style="font-size: 12px; color: #9ca3af; display: block; margin-top: 2px;">
                    Marque quem vai jogar neste torneio (membros com status 'Aceito').
                  </span>
                </div>
                <div id="badgeLineupContador" style="background: #1c1c28; border: 1.5px solid #3b82f6; color: #93c5fd; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;">
                  Escalados: <span id="escaladosCount">0</span> / ${maxIntegrantes}
                </div>
              </div>

              <!-- TRAVA DE VAGAS: ALERTA OBRIGATÓRIO -->
              <div id="lineupWarningTrava" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 12px; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-exclamation" style="color: #ef4444; font-size: 16px;"></i>
                <span>Este torneio permite no máximo ${maxIntegrantes} integrantes por equipe.</span>
              </div>

              <div class="lineup-membros-lista" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                ${roster.map(m => `
                  <label class="item-membro-checkbox" style="display: flex; align-items: center; justify-content: space-between; background: #161622; border: 1px solid #28283a; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <input 
                        type="checkbox" 
                        class="chk-membro-lineup" 
                        value="${escapeHtml(m.email)}" 
                        data-nome="${escapeHtml(m.nome)}"
                        data-avatar="${escapeHtml(m.avatar)}"
                        style="width: 18px; height: 18px; accent-color: #ef4444; cursor: pointer;"
                      >
                      <img 
                        src="${m.avatar}" 
                        alt="${escapeHtml(m.nome)}" 
                        onerror="this.src='/image/boneco_logo_ofc.png'" 
                        style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                      >
                      <div>
                        <strong style="color: #ffffff; font-size: 13px; display: block;">${escapeHtml(m.nome)}</strong>
                        <span style="font-size: 11px; color: #9ca3af;">${escapeHtml(m.email)}</span>
                      </div>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; ${m.isLeader ? 'background: rgba(239, 68, 68, 0.2); color: #f87171;' : 'background: rgba(59, 130, 246, 0.2); color: #60a5fa;'}">
                      ${m.isLeader ? 'Capitão' : 'Aceito'}
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>
          `;

          // Configura a Trava Estrita de Vagas nas checkboxes
          const checkboxes = containerLineup.querySelectorAll('.chk-membro-lineup');
          const warningEl = containerLineup.querySelector('#lineupWarningTrava');
          const countEl = containerLineup.querySelector('#escaladosCount');

          const atualizarContadorETrava = (checkboxClicada) => {
            const marcados = Array.from(checkboxes).filter(c => c.checked);

            // TRAVA DE VAGAS: Se ultrapassar o máximo permitido pelo torneio
            if (marcados.length > maxIntegrantes) {
              if (checkboxClicada) {
                checkboxClicada.checked = false; // Bloqueia a marcação
              }
              if (warningEl) {
                warningEl.style.display = 'flex';
              }
              showToast(`Este torneio permite no máximo ${maxIntegrantes} integrantes por equipe.`);
              return;
            } else {
              if (warningEl) {
                warningEl.style.display = 'none';
              }
            }

            const totalAtuais = Array.from(checkboxes).filter(c => c.checked).length;
            if (countEl) countEl.textContent = totalAtuais;
            btnConfirmar.disabled = (totalAtuais === 0);
          };

          checkboxes.forEach(chk => {
            chk.addEventListener('change', () => atualizarContadorETrava(chk));
          });

          // Seleciona automaticamente o capitão/líder por padrão se houver vaga
          if (checkboxes.length > 0 && maxIntegrantes >= 1) {
            checkboxes[0].checked = true;
            if (countEl) countEl.textContent = '1';
            btnConfirmar.disabled = false;
          } else {
            btnConfirmar.disabled = true;
          }

        } catch (errLineup) {
          console.error('Erro ao montar escalação da equipe:', errLineup);
          containerLineup.innerHTML = `
            <p style="font-size: 13px; color: #ef4444; margin: 0;">
              <i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar integrantes da equipe.
            </p>
          `;
        }
      };

      selectEl.addEventListener('change', () => {
        equipeSelecionadaId = selectEl.value;
        carregarLineupEquipe(selectEl.value);
      });

      // Carrega a line-up da primeira equipe
      carregarLineupEquipe(equipeSelecionadaId);

    } catch (err) {
      console.error('Falha ao carregar equipes:', err);
      areaDetalhes.innerHTML = `
        <p style="font-size: 13px; color: #ef4444; margin: 0;">
          <i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar as equipes. Tente novamente.
        </p>
      `;
    }
  }

  if (optInd) optInd.addEventListener('click', renderDetalhesIndividual);
  if (optEq) optEq.addEventListener('click', renderDetalhesEquipe);

  // Inicialização condicional: se for Apenas Equipe vai direto para Equipe, senão Individual
  if (apenasEquipe) {
    renderDetalhesEquipe();
  } else {
    renderDetalhesIndividual();
  }

  // Ação de confirmação
  btnConfirmar.addEventListener('click', async () => {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscrevendo...';

    const idParticipante = tipoSelecionado === 'equipe' ? String(equipeSelecionadaId) : loggedUser.email;
    let equipeNome = '';
    let lineupEscalados = [];

    if (tipoSelecionado === 'equipe') {
      const eq = equipesLideradas.find(t => String(t.id) === String(equipeSelecionadaId));
      if (eq) equipeNome = eq.nome;

      const checkboxesMarcados = Array.from(areaDetalhes.querySelectorAll('.chk-membro-lineup:checked'));
      lineupEscalados = checkboxesMarcados.map(c => ({
        email: c.value,
        nome: c.getAttribute('data-nome') || c.value,
        avatar: c.getAttribute('data-avatar') || '/image/boneco_logo_ofc.png'
      }));

      if (lineupEscalados.length === 0) {
        showToast('Selecione pelo menos 1 integrante para a line-up da equipe.');
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Inscrição';
        return;
      }

      if (lineupEscalados.length > maxIntegrantes) {
        showToast(`Este torneio permite no máximo ${maxIntegrantes} integrantes por equipe.`);
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Inscrição';
        return;
      }
    }

    const novaInscricao = {
      torneio_id: String(torneio.id),
      user_email: loggedUser.email,
      tipo: tipoSelecionado,
      id_participante: idParticipante,
      equipe_nome: equipeNome,
      lineup: lineupEscalados,
      status: 'Pendente',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Tenta salvar na tabela inscricoes do Supabase
      try {
        const { error: insErr } = await supabase
          .from('inscricoes')
          .insert([novaInscricao]);

        if (insErr) {
          console.warn('Aviso no Supabase inscricoes, tentando payload base:', insErr);
          // Fallback caso a tabela no Supabase não tenha as colunas equipe_nome ou lineup
          const payloadBase = {
            torneio_id: String(torneio.id),
            user_email: loggedUser.email,
            tipo: tipoSelecionado,
            id_participante: idParticipante,
            status: 'Pendente',
            created_at: new Date().toISOString()
          };
          await supabase.from('inscricoes').insert([payloadBase]);
        }
      } catch (errDb) {
        console.warn('Banco remoto inacessível, prosseguindo com cache local:', errDb);
      }

      // 2. Salva localmente com fallback garantido
      salvarInscricaoLocal(novaInscricao, torneio);

      fechar();
      showToast(
        tipoSelecionado === 'equipe'
          ? `Inscrição da equipe enviada com ${lineupEscalados.length} jogador(es) escalado(s)! Aguarde a aprovação do organizador.`
          : 'Inscrição individual enviada! Aguarde a aprovação do organizador.'
      );

      if (typeof onSucesso === 'function') {
        onSucesso(novaInscricao);
      }
    } catch (errFinal) {
      console.error('Erro ao registrar inscrição:', errFinal);
      showToast('Ocorreu um erro ao processar sua inscrição. Tente novamente.');
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Inscrição';
    }
  });
}
