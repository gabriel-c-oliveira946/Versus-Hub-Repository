// /torneio/js/custom.js
import { supabase } from '/supabaseClient.js';

// Lista de apoio para torneios padrão do sistema caso id seja estático
const predefinedTournaments = {
  'gamescom-latam': {
    id: 'gamescom-latam',
    nome: 'Gamescom Latam CS:GO',
    jogo: 'CS:GO • FPS • PC',
    data: 'Início: 06/12/2025 às 19h',
    status: 'Em andamento',
    statusClass: 'status-andamento',
    banner: '/images/torneio_csgo2.webp',
    descricao: 'O Time To Battle League da Gamescom Latam reúne os maiores talentos de CS:GO da América Latina. Com uma premiação recorde e as melhores equipes disputando ponto a ponto, este campeonato consagra a equipe mais resiliente e tática do continente.',
    regras: 'Times de 5x5\nEliminação dupla\nServidores locais em SP\nAnti-cheat obrigatório.',
    requisitos: 'Idade 16+, Conta da Gamers Club verificada, Sem banimentos ativos.',
    tipoPremio: 'valores',
    premio1: 'R$ 15.000 + Vaga para o Mundial',
    premio2: 'R$ 5.000',
    premio3: 'R$ 2.500',
    modalidade: 'presencial',
    localizacao: 'São Paulo Expo, SP',
    taxaTipo: 'gratis',
    criadorEmail: 'admin@versushub.com'
  },
  'parana-startups': {
    id: 'parana-startups',
    nome: 'CS-GO Startups Challenge',
    jogo: 'CS:GO • FPS • PC',
    data: 'Início: 04/11/2025 às 18h',
    status: 'Encerrado',
    statusClass: 'status-encerrado',
    banner: '/images/fileiracsgo.jpeg',
    descricao: 'O Paraná Startups Challenge une o ecossistema de tecnologia e inovação com o mundo dos e-sports. Empresas de tecnologia disputam a supremacia em partidas empolgantes de Counter-Strike.',
    regras: 'Times compostos por colaboradores ou parceiros das startups inscritas\nFormato suíço\nPartidas MD1 na fase de grupos, MD3 nas finais.',
    requisitos: 'Vínculo com startup participante, conta Steam válida.',
    tipoPremio: 'valores',
    premio1: 'Troféu Startups + R$ 5.000 em créditos de nuvem',
    premio2: 'Mentorias de negócios + Placas comemorativas',
    premio3: 'Kit de brindes dos patrocinadores',
    modalidade: 'online',
    localizacao: 'Online (Servidor SP)',
    taxaTipo: 'gratis'
  },
  'copa-ff': {
    id: 'copa-ff',
    nome: 'C.O.P.A - FREE FIRE',
    jogo: 'Free Fire • Battle Royale • Mobile',
    data: 'Início: 23/01/2026 às 18h',
    status: 'Em andamento',
    statusClass: 'status-andamento',
    banner: '/images/ffcopaff.png',
    descricao: 'A clássica Copa Free Fire traz os squads mais agressivos e estratégicos do cenário mobile. Sobrevivência, rotações precisas e combates de alta velocidade marcam essa emocionante competição oficial.',
    regras: 'Formato de pontos corridos\nQuedas em Bermuda, Purgatório e Kalahari\n6 quedas por rodada.',
    requisitos: 'Dispositivo mobile apenas (emulador proibido), nível 50+ na conta.',
    tipoPremio: 'valores',
    premio1: 'R$ 10.000 + Troféu C.O.P.A',
    premio2: 'R$ 4.000',
    premio3: 'R$ 2.000',
    modalidade: 'online',
    localizacao: 'Online (Servidor Mobile)',
    taxaTipo: 'gratis'
  },
  'contra-cup': {
    id: 'contra-cup',
    nome: 'Contra Cup Free Fire',
    jogo: 'Free Fire • Battle Royale • Mobile',
    data: 'Início: 01/03/2026 às 17h',
    status: 'Em andamento',
    statusClass: 'status-andamento',
    banner: '/images/contracup.jpeg',
    descricao: 'A Contra Cup é um torneio focado no confronto direto 4v4 contra adversários do mesmo nível, testando a frieza e precisão dos competidores sob extrema pressão.',
    regras: 'Confronto Contra Squad tradicional\nMD5 até quartas, MD7 nas fases finais\nSem armas apelativas/proibidas.',
    requisitos: 'Squad de 4 jogadores + 1 reserva.',
    tipoPremio: 'valores',
    premio1: 'R$ 3.000 + Medalhas',
    premio2: 'R$ 1.000',
    modalidade: 'online',
    localizacao: 'Online',
    taxaTipo: 'gratis'
  },
  'arena-fc25': {
    id: 'arena-fc25',
    nome: 'ARENA - FC25',
    jogo: 'FIFA • Esportes • Console',
    data: 'Início: 05/05/2026 às 19h',
    status: 'Inscrições abertas',
    statusClass: 'status-aberto',
    banner: '/pagina_inicial/image/arenafc25.jpg',
    descricao: 'Entre em campo na nova edição da Copa ARENA FC25! Teste suas novas jogadas ensaiadas, dribles e táticas no simulador de futebol mais jogado do planeta.',
    regras: 'Modo Ultimate Team (UT)\nLimite de classificação de elenco de até 88\nMD3 nas eliminatórias.',
    requisitos: 'Jogo EA Sports FC 25 original, conta ativa na PSN ou Xbox Live.',
    tipoPremio: 'valores',
    premio1: 'R$ 5.000 + 12.000 FC Points',
    premio2: 'R$ 2.000 + 5.800 FC Points',
    premio3: 'R$ 1.000 + 2.800 FC Points',
    modalidade: 'online',
    localizacao: 'Online (Crossplay)',
    taxaTipo: 'gratis'
  }
};

function getLoggedUser() {
  const raw = localStorage.getItem('vh_loggedUser');
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
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

  // 2) Consulta a tabela torneios no Supabase com .single()
  try {
    const { data, error } = await supabase
      .from('torneios')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      torneio = data;
    } else {
      console.warn('Torneio não retornado do Supabase:', error);
    }
  } catch (err) {
    console.warn('Aviso ao consultar torneio no Supabase:', err);
  }

  // Fallback caso seja um torneio com chave predefinida do sistema
  if (!torneio && predefinedTournaments[id]) {
    torneio = predefinedTournaments[id];
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

  // Libera a tela de carregamento após a injeção dos dados no DOM
  if (document.getElementById('loaderDetalhes')) {
    document.getElementById('loaderDetalhes').style.display = 'none';
  }
  hideLoader();

  // 6) Carrega os Participantes Confirmados (Ação 2)
  await carregarParticipantesConfirmados(torneio.id);

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
      const loggedUser = getLoggedUser();
      let inscricaoAtual = null;

      if (loggedUser) {
        try {
          const { data: inscricaoDb } = await supabase
            .from('inscricoes')
            .select('*')
            .eq('torneio_id', String(torneio.id))
            .eq('user_email', loggedUser.email)
            .maybeSingle();

          if (inscricaoDb) {
            inscricaoAtual = inscricaoDb;
          }
        } catch (chkErr) {
          console.warn('Aviso ao consultar inscrição no Supabase:', chkErr);
        }

        // Checa fallback local se não encontrou no banco
        if (!inscricaoAtual) {
          try {
            const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
            inscricaoAtual = allLocal.find(i => String(i.torneio_id) === String(torneio.id) && i.user_email === loggedUser.email);
          } catch (eLocal) {}
        }

        if (inscricaoAtual) {
          aplicarEstadoBotaoInscrito(btnInscrever, inscricaoAtual.status);
        }
      }

      btnInscrever.addEventListener('click', async () => {
        if (btnInscrever.disabled) return;
        const user = getLoggedUser();
        if (!user) {
          showToast('Você precisa estar logado para se inscrever! Redirecionando...');
          setTimeout(() => {
            window.location.href = '/login/login.html';
          }, 1500);
          return;
        }

        // Revalida se já está inscrito antes de abrir modal
        if (inscricaoAtual) {
          showToast('Você já possui uma inscrição para este torneio.');
          return;
        }

        abrirModalEscolhaInscricao(torneio, user, (novaInscricao) => {
          inscricaoAtual = novaInscricao;
          aplicarEstadoBotaoInscrito(btnInscrever, novaInscricao.status);
          carregarParticipantesConfirmados(torneio.id);
        });
      });
    }
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

function aplicarEstadoBotaoInscrito(btn, status) {
  if (!btn) return;
  btn.disabled = true;
  btn.style.cursor = 'not-allowed';
  if (status === 'Aceito') {
    btn.textContent = 'Inscrição Confirmada';
    btn.style.background = '#065f46';
    btn.style.color = '#34d399';
    btn.style.border = '1px solid #10b981';
  } else {
    btn.textContent = 'Inscrição Pendente';
    btn.style.background = '#2c2c3b';
    btn.style.color = '#facc15';
    btn.style.border = '1px solid #854d0e';
  }
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

// AÇÃO 2: Exibir Participantes Confirmados
async function carregarParticipantesConfirmados(torneioId) {
  const listaEl = document.getElementById('listaParticipantes');
  if (!listaEl) return;

  try {
    let aceitos = [];
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

// AÇÃO 1: Modal de Escolha do Tipo de Inscrição (Individual ou Equipe)
function abrirModalEscolhaInscricao(torneio, loggedUser, onSucesso) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-inscricao-overlay';
  overlay.id = 'modalEscolhaInscricaoOverlay';

  overlay.innerHTML = `
    <div class="modal-inscricao-content">
      <div class="modal-inscricao-header">
        <h3><i class="fa-solid fa-trophy" style="color: #ef4444;"></i> Inscrição no Torneio</h3>
        <button type="button" class="btn-close-modal" id="btnFecharModalInscricao" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <p style="font-size: 14px; color: #b1b1cf; margin-top: 0; margin-bottom: 16px;">Como deseja participar deste campeonato?</p>

      <div class="modal-inscricao-opcoes">
        <div class="opcao-card card-ind selected" id="opcaoIndividual" role="button" tabindex="0">
          <i class="fa-solid fa-user"></i>
          <strong>Individual</strong>
          <span>Inscreva-se com seu perfil individual de jogador</span>
        </div>

        <div class="opcao-card card-eq" id="opcaoEquipe" role="button" tabindex="0">
          <i class="fa-solid fa-shield-halved"></i>
          <strong>Equipe</strong>
          <span>Inscreva uma equipe na qual você é capitão / líder</span>
        </div>
      </div>

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

  let tipoSelecionado = 'individual';
  let equipeSelecionadaId = null;
  let equipesLideradas = [];

  function renderDetalhesIndividual() {
    tipoSelecionado = 'individual';
    optInd.classList.add('selected');
    optEq.classList.remove('selected');
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
        Sua inscrição será enviada ao organizador como participante individual.
      </p>
    `;
  }

  async function renderDetalhesEquipe() {
    tipoSelecionado = 'equipe';
    optEq.classList.add('selected');
    optInd.classList.remove('selected');

    areaDetalhes.innerHTML = `
      <div style="text-align: center; padding: 14px 0; color: #9ca3af;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 20px; color: #3b82f6;"></i>
        <span style="display: block; margin-top: 8px; font-size: 13px;">Buscando equipes em que você é líder...</span>
      </div>
    `;

    try {
      let teams = [];
      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .eq('leaderEmail', loggedUser.email);

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
          <div style="text-align: center; padding: 10px 0;">
            <i class="fa-solid fa-shield-halved" style="font-size: 28px; color: #f59e0b; margin-bottom: 8px; display: block;"></i>
            <strong style="color: #ffffff; font-size: 14px; display: block;">Nenhuma equipe encontrada</strong>
            <p style="font-size: 12px; color: #9ca3af; margin: 6px 0 10px 0;">
              Você ainda não é capitão ou líder de nenhuma equipe cadastrada.
            </p>
            <a href="/equipes/equipes.html" style="color: #60a5fa; text-decoration: underline; font-size: 13px; font-weight: 600;">
              <i class="fa-solid fa-plus"></i> Criar uma equipe agora
            </a>
          </div>
        `;
        return;
      }

      equipeSelecionadaId = String(equipesLideradas[0].id);
      btnConfirmar.disabled = false;

      areaDetalhes.innerHTML = `
        <label for="selectEquipeInscricao" style="display: block; font-size: 13px; font-weight: 600; color: #e5e5ff; margin-bottom: 8px;">
          Selecione a equipe para disputar o torneio:
        </label>
        <select id="selectEquipeInscricao" style="width: 100%; background: #12121a; border: 1px solid #3b3b4f; color: #ffffff; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 12px;">
          ${equipesLideradas.map(eq => `
            <option value="${escapeHtml(eq.id)}">${escapeHtml(eq.nome)} ${eq.tag ? '[' + escapeHtml(eq.tag) + ']' : ''}</option>
          `).join('')}
        </select>
        <div id="previewEquipeSelecionada" style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
          <!-- Detalhes da equipe selecionada -->
        </div>
      `;

      const selectEl = areaDetalhes.querySelector('#selectEquipeInscricao');
      const previewEl = areaDetalhes.querySelector('#previewEquipeSelecionada');

      const atualizarPreview = () => {
        const teamId = selectEl.value;
        equipeSelecionadaId = teamId;
        const eq = equipesLideradas.find(t => String(t.id) === String(teamId));
        if (eq && previewEl) {
          previewEl.innerHTML = `
            <img
              src="${eq.logo || '/equipes/image/the%20caras.png'}"
              alt="${escapeHtml(eq.nome)}"
              onerror="this.src='/equipes/image/the%20caras.png'"
              style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover; border: 1px solid #3b82f6;"
            />
            <div>
              <span style="font-size: 13px; font-weight: 600; color: #ffffff;">${escapeHtml(eq.nome)}</span>
              <span style="display: block; font-size: 11px; color: #9ca3af;">Líder: ${escapeHtml(eq.leaderName || loggedUser.nome || loggedUser.email)}</span>
            </div>
          `;
        }
      };

      selectEl.addEventListener('change', atualizarPreview);
      atualizarPreview();

    } catch (err) {
      console.error('Falha ao carregar equipes:', err);
      areaDetalhes.innerHTML = `
        <p style="font-size: 13px; color: #ef4444; margin: 0;">
          <i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar as equipes. Tente novamente.
        </p>
      `;
    }
  }

  optInd.addEventListener('click', renderDetalhesIndividual);
  optEq.addEventListener('click', renderDetalhesEquipe);

  // Inicializa com Individual
  renderDetalhesIndividual();

  // Ação de confirmação
  btnConfirmar.addEventListener('click', async () => {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscrevendo...';

    const idParticipante = tipoSelecionado === 'equipe' ? String(equipeSelecionadaId) : loggedUser.email;

    const novaInscricao = {
      torneio_id: String(torneio.id),
      user_email: loggedUser.email,
      tipo: tipoSelecionado,
      id_participante: idParticipante,
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
          console.warn('Aviso na gravação no Supabase inscricoes:', insErr);
        }
      } catch (errDb) {
        console.warn('Banco remoto inacessível, prosseguindo com cache local:', errDb);
      }

      // 2. Salva localmente com fallback garantido
      salvarInscricaoLocal(novaInscricao, torneio);

      fechar();
      showToast(
        tipoSelecionado === 'equipe'
          ? 'Inscrição da equipe enviada! Aguarde a aprovação do organizador.'
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
