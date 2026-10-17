// /torneio/js/custom.js
import { supabase, enviarNotificacao } from '/supabaseClient.js';
import {
  carregarPartidasTorneio,
  renderizarChaveamentoVisual,
  abrirModalCriarPartidaManual,
  buscarParticipantesConfirmados,
  showBracketToast,
  abrirModalGerenciarSolicitacoes,
  abrirModalConfirmacaoEncerramentoTorneio,
  removerTagNome
} from '/torneio/js/brackets.js';

// Limpeza preventiva total de torneios e equipes estáticos


// Limpa proativamente itens base64 pesados que estouram a cota de 5MB do localStorage
function expurgarImagensPesadasLocalStorage() {
  try {
    const total = localStorage.length;
    for (let i = 0; i < total; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const val = localStorage.getItem(k);
      if (!val || val.length < 20000) continue;

      if (val.includes('data:image/')) {
        try {
          const parsed = JSON.parse(val);
          const sanitizarObj = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) return obj.map(sanitizarObj);
            const novo = { ...obj };
            for (const prop of Object.keys(novo)) {
              if (typeof novo[prop] === 'string' && novo[prop].startsWith('data:image/')) {
                novo[prop] = prop.includes('avatar') || prop.includes('logo')
                  ? '/image/boneco_logo_ofc.png'
                  : '';
              } else if (typeof novo[prop] === 'object') {
                novo[prop] = sanitizarObj(novo[prop]);
              }
            }
            return novo;
          };

          const sanitizado = sanitizarObj(parsed);
          localStorage.setItem(k, JSON.stringify(sanitizado));
        } catch (eJson) {
          if (k.includes('cache') || k.includes('tournaments') || k.includes('torneios')) {
            localStorage.removeItem(k);
          }
        }
      }
    }
  } catch (e) {}
}

// Executa limpeza preventiva imediata
expurgarImagensPesadasLocalStorage();



let torneioGlobal = null;

function verificarTorneioEncerrado(t) {
  if (!t) return false;
  const st = String(t.status || '').toLowerCase().trim();
  const stCls = String(t.statusClass || '').toLowerCase().trim();
  return st === 'encerrado' || stCls === 'status-encerrado' || t.status === 'Encerrado';
}

/**
 * Resolve de forma inteligente e dinâmica o número de participantes por equipe.
 * Prioriza maxIntegrantes/max_integrantes do banco ou cache, e infere dinamicamente
 * caso o torneio seja 2v2, 3v3, 4v4, Squad, Trio, Duo ou pelo jogo específico.
 */
function obterMaxIntegrantesTorneio(t) {
  if (!t) return 5;
  if (t.maxIntegrantes && !isNaN(parseInt(t.maxIntegrantes, 10)) && parseInt(t.maxIntegrantes, 10) > 0) {
    return parseInt(t.maxIntegrantes, 10);
  }
  if (t.max_integrantes && !isNaN(parseInt(t.max_integrantes, 10)) && parseInt(t.max_integrantes, 10) > 0) {
    return parseInt(t.max_integrantes, 10);
  }

  // Tenta extrair das regras, descrição ou título do torneio (ex: "5v5", "3v3", "2v2", "Duo", "Trio", "Squad")
  const textoGeral = `${t.nome || ''} ${t.jogo || ''} ${t.regras || ''} ${t.descricao || ''}`.toLowerCase();
  const matchXvX = textoGeral.match(/\b([1-9])v\1\b/);
  if (matchXvX) return parseInt(matchXvX[1], 10);

  const matchJogadores = textoGeral.match(/(\d+)\s*(?:jogadores|integrantes|players|membros)\s*(?:por\s*equipe|por\s*time)?/i);
  if (matchJogadores && parseInt(matchJogadores[1], 10) > 0 && parseInt(matchJogadores[1], 10) <= 30) {
    return parseInt(matchJogadores[1], 10);
  }

  if (textoGeral.includes('squad') || textoGeral.includes('4v4')) return 4;
  if (textoGeral.includes('trio') || textoGeral.includes('3v3')) return 3;
  if (textoGeral.includes('duo') || textoGeral.includes('2v2')) return 2;

  // Inferência dinâmica baseada no título do jogo caso não especificado
  const jogo = (t.jogo || '').toLowerCase();
  if (jogo.includes('rocket league')) return 3;
  if (jogo.includes('free fire') || jogo.includes('pubg')) return 4;
  if (jogo.includes('apex')) return 3;
  if (jogo.includes('clash') || jogo.includes('fifa') || jogo.includes('fc 2') || jogo.includes('street') || jogo.includes('tekken') || jogo.includes('mortal')) return 1;

  return 5;
}

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

function showToast(message, type = 'info') {
  let toast = document.getElementById('customToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'customToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
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

  if (type === 'error') {
    toast.style.background = '#251217';
    toast.style.color = '#fca5a5';
    toast.style.borderLeft = '4px solid #ef4444';
  } else {
    toast.style.background = '#1e1b2e';
    toast.style.color = '#ffffff';
    toast.style.borderLeft = '4px solid #ff7300';
  }

  toast.textContent = message;
  void toast.offsetWidth;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  if (toast.hideTimer) clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 4000);
}

/**
 * Comprime imagem do banner via Canvas para no máximo 600x300px JPEG com qualidade 0.6.
 * Reduz agressivamente o consumo de Egress e payload de rede no Supabase (máx 30-50 KB).
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
    const tPage = document.getElementById('torneioPage');
    if (tPage) tPage.setAttribute('aria-busy', 'false');
    const partEl = document.getElementById('listaParticipantes');
    if (partEl) partEl.setAttribute('aria-busy', 'false');
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
  const idStr = String(id || '').trim();
  const isCustomId = idStr.toLowerCase().startsWith('custom-');

  // 1. CARREGAMENTO ISOLADO E SEGURO DO TORNEIO (Busca primária na tabela 'torneios')
  try {
    const { data: dataStr, error: errStr } = await supabase
      .from('torneios')
      .select('*')
      .eq('id', idStr)
      .maybeSingle();

    if (dataStr) {
      torneio = dataStr;
    } else if (!isCustomId && !isNaN(Number(idStr))) {
      const { data: dataNum } = await supabase
        .from('torneios')
        .select('*')
        .eq('id', Number(idStr))
        .maybeSingle();
      if (dataNum) torneio = dataNum;
    }

    // Busca secundária pelo nome do torneio APENAS se o parâmetro NÃO for formato 'custom-'
    if (!torneio && !isCustomId && idStr) {
      try {
        const decodedNome = decodeURIComponent(idStr).trim();
        if (decodedNome && !decodedNome.toLowerCase().startsWith('custom-')) {
          const { data: dataNome } = await supabase
            .from('torneios')
            .select('*')
            .ilike('nome', decodedNome)
            .maybeSingle();
          if (dataNome) torneio = dataNome;
        }
      } catch (eNome) {}
    }

    // Fallback no cache local (vh_createdTournaments / vh_cachedTorneios)
    if (!torneio) {
      try {
        const localList = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
        const cachedList = JSON.parse(localStorage.getItem('vh_cachedTorneios') || '[]');
        const allLocal = [...localList, ...cachedList];
        torneio = allLocal.find(t => t && (
          String(t.id) === idStr ||
          (t.id_torneio && String(t.id_torneio) === idStr) ||
          (!isCustomId && t.nome && String(t.nome).toLowerCase() === idStr.toLowerCase())
        ));
      } catch (eLoc) {}
    }
  } catch (errTorneio) {
    console.warn('Aviso ao consultar torneio no Supabase:', errTorneio);
  }

  // Se o torneio NÃO for encontrado, exibe erro e interrompe
  if (!torneio) {
    hideLoader();
    if (erroTorneio) erroTorneio.style.display = 'block';
    if (torneioPage) torneioPage.style.display = 'none';
    return;
  }

  // Se o torneio for retornado, exiba IMEDIATAMENTE a página do torneio
  if (erroTorneio) erroTorneio.style.display = 'none';
  if (torneioPage) {
    torneioPage.style.display = 'block';
    torneioPage.removeAttribute('hidden');
  }

  // Mescla com cache local se existirem campos adicionais
  try {
    const localList = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
    const localT = localList.find(t => t && (String(t.id) === String(torneio.id) || String(t.nome) === String(torneio.nome)));
    if (localT) {
      if (torneio.maxIntegrantes == null && localT.maxIntegrantes != null) torneio.maxIntegrantes = localT.maxIntegrantes;
      if (torneio.max_integrantes == null && localT.max_integrantes != null) torneio.max_integrantes = localT.max_integrantes;
      if (!torneio.tipoInscricao && localT.tipoInscricao) torneio.tipoInscricao = localT.tipoInscricao;
      if (torneio.maxParticipantes == null && localT.maxParticipantes != null) torneio.maxParticipantes = localT.maxParticipantes;
    }
  } catch (eLoc2) {}

  torneioGlobal = torneio;
  if (typeof window !== 'undefined') {
    window.torneioGlobal = torneio;
  }

  // 2. CARREGAMENTO ISOLADO DAS INSCRIÇÕES ACEITAS E DO USUÁRIO LOGADO
  let preloadedInscricoes = [];
  let loggedUser = null;

  try {
    loggedUser = await getLoggedUser();
  } catch (errUser) {
    console.warn('Aviso ao obter usuário logado:', errUser);
  }

  try {
    const { data: inscricoesDb, error: errInsc } = await supabase
      .from('inscricoes')
      .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
      .eq('torneio_id', String(torneio.id || id))
      .eq('status', 'Aceito');

    if (!errInsc && Array.isArray(inscricoesDb)) {
      preloadedInscricoes = inscricoesDb;
    } else if (errInsc) {
      console.warn('Aviso ao consultar inscrições aceitas:', errInsc);
    }
  } catch (errInscGeral) {
    console.warn('Aviso de rede ao buscar inscrições aceitas:', errInscGeral);
  }

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
  const listaRequisitos= document.getElementById('listaRequisitos');

  const textoStatus    = document.getElementById('textoStatus');
  const textoPlataforma= document.getElementById('textoPlataforma');
  const infoModalidade = document.getElementById('infoModalidade');
  const infoLocal      = document.getElementById('infoLocal');
  const infoTaxa       = document.getElementById('infoTaxa');
  const textoFormatoTorneio = document.getElementById('textoFormatoTorneio');
  const textoTipoInscricao = document.getElementById('textoTipoInscricao');
  const textoMaxIntegrantes = document.getElementById('textoMaxIntegrantes');
  const liMaxIntegrantes = document.getElementById('liMaxIntegrantes');

  // Substituição de Line-up e Formato Dinâmico
  const formatoTorneioVal = torneio.formato || torneio.formato_torneio || 'Mata-Mata (Eliminatória)';
  if (textoFormatoTorneio) {
    textoFormatoTorneio.textContent = formatoTorneioVal;
  }

  const tipoInscricaoTorneio = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
  const isSolo = tipoInscricaoTorneio === 'Apenas Solo (1v1)';
  const maxIntegrantesTorneio = obterMaxIntegrantesTorneio(torneio);

  if (textoTipoInscricao) {
    textoTipoInscricao.textContent = isSolo ? 'Individual (1 Jogador)' : tipoInscricaoTorneio;
  }

  if (liMaxIntegrantes && textoMaxIntegrantes) {
    if (isSolo) {
      liMaxIntegrantes.style.display = 'none';
    } else {
      liMaxIntegrantes.style.display = 'flex';
      liMaxIntegrantes.style.gap = '6px';
      const rotuloIntegrantes = liMaxIntegrantes.querySelector('span:first-child');
      if (rotuloIntegrantes) {
        rotuloIntegrantes.textContent = 'Número de participantes por equipe: ';
        rotuloIntegrantes.style.marginRight = '6px';
      }
      textoMaxIntegrantes.textContent = `Até ${maxIntegrantesTorneio} jogadores`;
    }
  }

  // Banner
  if (detBanner) {
    detBanner.src = torneio.banner || '/images/logo_versushub.png';
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

  // 5) Função Reutilizável: Resolução de Link de Live Dinâmico das Partidas
  let temLinkTransmissaoValido = false;

  function obterLinkLiveAtivo(partidasLista = []) {
    if (!Array.isArray(partidasLista) || partidasLista.length === 0) return '';
    // 1. Busca partida com status 'Ao Vivo' que tenha link válido
    const partidaAoVivo = partidasLista.find(p => {
      const link = (p.link_transmissao || '').trim();
      const st = (p.status || '').toLowerCase();
      return (st === 'ao vivo' || st === 'aovivo') && (link.startsWith('http://') || link.startsWith('https://'));
    });
    if (partidaAoVivo) return partidaAoVivo.link_transmissao.trim();

    // 2. Busca qualquer partida não-encerrada que tenha link válido (última inserida/ativa)
    const partidasComLinkNaoEncerradas = partidasLista.filter(p => {
      const link = (p.link_transmissao || '').trim();
      const st = (p.status || '').toLowerCase();
      const isEnc = st === 'encerrado' || st === 'encerrada' || Boolean(p.vencedor_id);
      return !isEnc && (link.startsWith('http://') || link.startsWith('https://'));
    });
    if (partidasComLinkNaoEncerradas.length > 0) {
      return partidasComLinkNaoEncerradas[partidasComLinkNaoEncerradas.length - 1].link_transmissao.trim();
    }

    // 3. Fallback: última partida que possua link de transmissão
    const todasComLink = partidasLista.filter(p => {
      const link = (p.link_transmissao || '').trim();
      return link.startsWith('http://') || link.startsWith('https://');
    });
    if (todasComLink.length > 0) {
      return todasComLink[todasComLink.length - 1].link_transmissao.trim();
    }

    return '';
  }

  // Renderiza Caixa de Transmissão Ao Vivo
  function atualizarPainelTransmissaoTopo(partidasLista = []) {
    const areaTransmissao = document.getElementById('areaTransmissao');
    if (!areaTransmissao) return;

    const linkAtivo = obterLinkLiveAtivo(partidasLista);
    temLinkTransmissaoValido = Boolean(linkAtivo);
    areaTransmissao.innerHTML = '';

    if (linkAtivo) {
      // 1. Botão estilizado para assistir transmissão ao vivo
      const btnTransmissao = document.createElement('a');
      btnTransmissao.href = linkAtivo;
      btnTransmissao.target = '_blank';
      btnTransmissao.rel = 'noopener noreferrer';
      btnTransmissao.id = 'btnAssistirTransmissao';
      btnTransmissao.className = 'btn-transmissao-aovivo';
      btnTransmissao.innerHTML = '<i class="fa-solid fa-play" style="margin-right: 8px;"></i> Assistir Transmissão Ao Vivo';

      btnTransmissao.style.display = 'flex';
      btnTransmissao.style.alignItems = 'center';
      btnTransmissao.style.justifyContent = 'center';
      btnTransmissao.style.gap = '10px';
      btnTransmissao.style.width = '100%';
      btnTransmissao.style.padding = '16px 20px';
      btnTransmissao.style.marginBottom = '18px';
      btnTransmissao.style.backgroundColor = '#ef4444';
      btnTransmissao.style.color = '#ffffff';
      btnTransmissao.style.fontWeight = '700';
      btnTransmissao.style.fontSize = '15px';
      btnTransmissao.style.textDecoration = 'none';
      btnTransmissao.style.borderRadius = '10px';
      btnTransmissao.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.45)';
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

      // Status badge para "Ao Vivo"
      if (detStatusBadge && torneio.status !== 'Encerrado') {
        detStatusBadge.textContent = 'Ao Vivo';
        detStatusBadge.className = 'torneio-status-badge status-andamento';
      }
      if (textoStatus && torneio.status !== 'Encerrado') {
        textoStatus.textContent = 'Ao Vivo';
      }
    } else {
      if (detStatusBadge && torneio.status !== 'Encerrado' && detStatusBadge.textContent === 'Ao Vivo') {
        detStatusBadge.textContent = torneio.status || 'Inscrições abertas';
        detStatusBadge.className = `torneio-status-badge ${torneio.status === 'Em andamento' ? 'status-andamento' : 'status-aberto'}`;
      }
      if (textoStatus && torneio.status !== 'Encerrado' && textoStatus.textContent === 'Ao Vivo') {
        textoStatus.textContent = torneio.status || 'Inscrições abertas';
      }
      // Caixa neutra quando não houver transmissão iniciada
      areaTransmissao.innerHTML = `
        <div class="transmissao-offline-box" style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #141419; border: 1px solid #2a2a3a; color: #9ca3af; padding: 14px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 18px; text-align: center; box-sizing: border-box;">
          <i class="fa-solid fa-clock" style="color: #6b7280; font-size: 16px;"></i>
          <span>A transmissão ainda não foi iniciada</span>
        </div>
      `;
    }
  }

  // Inicializa o painel de transmissão no topo (carrega partidas)
  try {
    const partidasIniciais = await carregarPartidasTorneio(torneio.id);
    atualizarPainelTransmissaoTopo(partidasIniciais);
  } catch (errPartInit) {
    atualizarPainelTransmissaoTopo([]);
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
  await carregarParticipantesConfirmados(torneio.id, preloadedInscricoes, torneio);

  // Libera a tela de carregamento após a injeção completa de todos os dados no DOM
  if (document.getElementById('loaderDetalhes')) {
    document.getElementById('loaderDetalhes').style.display = 'none';
  }
  hideLoader();

  // 7) Inscrição no Torneio (Ação 1)
  const btnInscrever = document.getElementById('btnInscrever');
  if (btnInscrever) {
    if (verificarTorneioEncerrado(torneio) || temLinkTransmissaoValido) {
      btnInscrever.textContent = 'Inscrições Encerradas';
      btnInscrever.disabled = true;
      btnInscrever.setAttribute('disabled', 'true');
      btnInscrever.className = 'btn-principal';
      btnInscrever.style.background = '#2c2c3b';
      btnInscrever.style.color = '#9ca3af';
      btnInscrever.style.border = '2px solid #3b3b4f';
      btnInscrever.style.cursor = 'not-allowed';
      btnInscrever.style.pointerEvents = 'none';
      btnInscrever.style.boxShadow = 'none';
      btnInscrever.removeAttribute('title');
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
            .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
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
                  .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
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
        if (verificarTorneioEncerrado(torneio) || btnInscrever.disabled) {
          showToast('As inscrições para este torneio estão encerradas.', 'warning');
          return;
        }

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
            const isUuidValido = (v) => typeof v === 'string' && v.length === 36 && v.includes('-');
            let removeu = false;

            if (isUuidValido(inscricaoAtual.id)) {
              try {
                const { data, error: errId } = await supabase
                  .from('inscricoes')
                  .delete()
                  .eq('id', inscricaoAtual.id)
                  .select();
                if (!errId && data && data.length > 0) removeu = true;
              } catch (e) {}
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
              const allLocal = JSON.parse(obterItemComFallback('vh_inscricoes', '[]'));
              const filtrado = (Array.isArray(allLocal) ? allLocal : []).filter(i => {
                const matchTorneio = String(i.torneio_id) === String(torneio.id);
                const matchUser = i.user_email === user.email || (inscricaoAtual.id && i.id === inscricaoAtual.id) || (inscricaoAtual.id_participante && String(i.id_participante) === String(inscricaoAtual.id_participante));
                return !(matchTorneio && matchUser);
              });
              salvarItemComFallback('vh_inscricoes', JSON.stringify(filtrado));

              const storageKey = `vh_joinedTournaments_${user.email}`;
              const joined = JSON.parse(obterItemComFallback(storageKey, '[]'));
              const joinedFiltrado = (Array.isArray(joined) ? joined : []).filter(t => String(t.id) !== String(torneio.id));
              salvarItemComFallback(storageKey, JSON.stringify(joinedFiltrado));
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
        if (torneio._vagasEsgotadas || (typeof torneioGlobal !== 'undefined' && torneioGlobal?._vagasEsgotadas)) {
          showToast('As vagas para este torneio foram esgotadas.');
          return;
        }

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

    // Verifica se o usuário logado é estritamente o criador do torneio
    const userEmailNorm = (loggedUser?.email || '').trim().toLowerCase();
    const criadorEmailNorm = (torneio.criadorEmail || torneio.criador_email || torneio.user_email || '').trim().toLowerCase();
    const userIdNorm = String(loggedUser?.id || '').trim();
    const criadorIdNorm = String(torneio.criador_id || torneio.user_id || torneio.criadorId || '').trim();

    const isCriador = Boolean(
      (userEmailNorm && criadorEmailNorm && userEmailNorm === criadorEmailNorm) ||
      (userIdNorm && criadorIdNorm && userIdNorm === criadorIdNorm)
    );

    if (areaAcoesCriador && isCriador) {
      areaAcoesCriador.style.display = 'flex';
    } else if (areaAcoesCriador) {
      areaAcoesCriador.style.display = 'none';
    }

    configurarBotaoCurtir(torneio.id);

    const btnGerenciarSolicitacoesHeader = document.getElementById('btnGerenciarSolicitacoesHeader');
    if (btnGerenciarSolicitacoesHeader) {
      if (isCriador) {
        btnGerenciarSolicitacoesHeader.style.display = 'inline-flex';
        btnGerenciarSolicitacoesHeader.onclick = () => {
          if (typeof abrirModalGerenciarSolicitacoes === 'function') {
            abrirModalGerenciarSolicitacoes(torneio.id);
          } else if (typeof window.abrirModalGerenciarSolicitacoes === 'function') {
            window.abrirModalGerenciarSolicitacoes(torneio.id);
          }
        };
      } else {
        btnGerenciarSolicitacoesHeader.style.display = 'none';
      }
    }

    const btnConvidarParticipantesTorneio = document.getElementById('btnConvidarParticipantesTorneio');
    if (btnConvidarParticipantesTorneio) {
      if (isCriador) {
        btnConvidarParticipantesTorneio.style.display = 'inline-flex';
        btnConvidarParticipantesTorneio.onclick = () => {
          abrirModalConvidarParticipantes(torneio.id, torneio.nome);
        };
      } else {
        btnConvidarParticipantesTorneio.style.display = 'none';
      }
    }

    const btnEncerrarConsolidar = document.getElementById('btnEncerrarConsolidarTorneio');
    if (btnEncerrarConsolidar) {
      if (isCriador) {
        if (torneio.status === 'Encerrado') {
          btnEncerrarConsolidar.textContent = 'Torneio Encerrado';
          btnEncerrarConsolidar.disabled = true;
          btnEncerrarConsolidar.style.background = '#232331';
          btnEncerrarConsolidar.style.color = '#9ca3af';
          btnEncerrarConsolidar.style.cursor = 'not-allowed';
          btnEncerrarConsolidar.style.border = '1px solid #3b3b4f';
        } else {
          btnEncerrarConsolidar.style.display = 'inline-flex';
          btnEncerrarConsolidar.addEventListener('click', () => {
            abrirModalConfirmacaoEncerramentoTorneio({
              torneioId: torneio.id,
              onConcluido: () => {
                window.location.reload();
              }
            });
          });
        }
      } else {
        btnEncerrarConsolidar.style.display = 'none';
      }
    }

    // ==============================================================================
    // SISTEMA DE ABAS DO TORNEIO (INFORMAÇÕES VS CHAVEAMENTO / BRACKETS)
    // ==============================================================================
    const tabBtnInfo = document.getElementById('tabBtnInfo');
    const tabBtnBrackets = document.getElementById('tabBtnBrackets');
    const paneInfo = document.getElementById('paneInfo');
    const paneBrackets = document.getElementById('paneBrackets');
    const bracketConteudo = document.getElementById('bracketConteudo');
    const btnIrGerenciarChave = document.getElementById('btnIrGerenciarChave');
    const badgeTabChave = document.getElementById('badgeTabChave');

    let bracketPartidas = [];
    let bracketInicializado = false;

    async function carregarERenderizarChaveamento() {
      if (!bracketConteudo) return;
      try {
        bracketPartidas = await carregarPartidasTorneio(torneio.id);
        bracketInicializado = true;

        if (badgeTabChave) {
          if (bracketPartidas.length > 0) {
            badgeTabChave.style.display = 'inline-block';
            badgeTabChave.textContent = `${bracketPartidas.length} partidas`;
          } else {
            badgeTabChave.style.display = 'none';
          }
        }

        if (typeof atualizarPainelTransmissaoTopo === 'function') {
          atualizarPainelTransmissaoTopo(bracketPartidas);
        }

        const confirmados = await buscarParticipantesConfirmados(torneio.id);
        const tipoInsc = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
        const isTorneioSolo = tipoInsc === 'Apenas Solo (1v1)';
        const isTorneioEquipe = tipoInsc === 'Apenas Equipe';

        const formatoTorneioVal = torneio.formato || torneio.formato_torneio || 'Mata-Mata (Eliminatória)';

        renderizarChaveamentoVisual(bracketConteudo, bracketPartidas, {
          torneioId: torneio.id,
          permiteEditar: isCriador,
          isEncerrado: torneio.status === 'Encerrado',
          statusTorneio: torneio.status,
          participantesConfirmados: confirmados,
          formatoTorneio: formatoTorneioVal,
          formato: formatoTorneioVal,
          isTorneioSolo,
          isTorneioEquipe,
          torneioTipo: tipoInsc,
          onAtualizado: () => {
            carregarERenderizarChaveamento();
          },
          onEncerrarTorneio: () => {
            abrirModalConfirmacaoEncerramentoTorneio({
              torneioId: torneio.id,
              onConcluido: () => {
                window.location.reload();
              }
            });
          },
          onCriarPartida: () => {
            abrirModalCriarPartidaManual(torneio.id, confirmados, () => {
              carregarERenderizarChaveamento();
            }, { isTorneioSolo, isTorneioEquipe });
          }
        });
      } catch (err) {
        console.error('Erro ao processar chaveamento:', err);
        bracketConteudo.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 12px; display: block;"></i>
            <span>Falha ao carregar as partidas do chaveamento.</span>
          </div>
        `;
      }
    }

    function alternarAbaTorneio(destino) {
      if (destino === 'brackets') {
        if (tabBtnInfo) {
          tabBtnInfo.classList.remove('active');
          tabBtnInfo.setAttribute('aria-selected', 'false');
        }
        if (tabBtnBrackets) {
          tabBtnBrackets.classList.add('active');
          tabBtnBrackets.setAttribute('aria-selected', 'true');
        }
        if (paneInfo) paneInfo.style.display = 'none';
        if (paneBrackets) paneBrackets.style.display = 'block';

        if (!bracketInicializado) {
          carregarERenderizarChaveamento();
        }
      } else {
        if (tabBtnBrackets) {
          tabBtnBrackets.classList.remove('active');
          tabBtnBrackets.setAttribute('aria-selected', 'false');
        }
        if (tabBtnInfo) {
          tabBtnInfo.classList.add('active');
          tabBtnInfo.setAttribute('aria-selected', 'true');
        }
        if (paneBrackets) paneBrackets.style.display = 'none';
        if (paneInfo) paneInfo.style.display = 'block';
      }
    }

    if (tabBtnInfo) {
      tabBtnInfo.addEventListener('click', () => alternarAbaTorneio('info'));
    }
    if (tabBtnBrackets) {
      tabBtnBrackets.addEventListener('click', () => alternarAbaTorneio('brackets'));
    }

    if (btnIrGerenciarChave && isCriador) {
      btnIrGerenciarChave.style.display = 'inline-flex';
      btnIrGerenciarChave.addEventListener('click', () => {
        window.location.href = `/gerenciartorneios/gerentornindex.html?chaveTorneioId=${encodeURIComponent(torneio.id)}`;
      });
    } else if (btnIrGerenciarChave) {
      btnIrGerenciarChave.style.display = 'none';
    }

    const recarregarInscricoesETorneio = () => {
      if (torneio && torneio.id) {
        carregarParticipantesConfirmados(torneio.id, null, torneio);
        carregarERenderizarChaveamento();
      }
    };

    window.addEventListener('versus:bracket-updated', recarregarInscricoesETorneio);
    window.addEventListener('versus:inscricoes-updated', recarregarInscricoesETorneio);
    document.addEventListener('versus:bracket-updated', recarregarInscricoesETorneio);
    document.addEventListener('versus:inscricoes-updated', recarregarInscricoesETorneio);

    // Inicializa verificação de aba requisitada pela URL ou hash
    const tabUrl = params.get('tab') || window.location.hash.replace('#', '');
    if (tabUrl === 'brackets' || tabUrl === 'chaveamento') {
      alternarAbaTorneio('brackets');
    } else {
      carregarPartidasTorneio(torneio.id).then(res => {
        if (res && res.length > 0 && badgeTabChave) {
          badgeTabChave.style.display = 'inline-block';
          badgeTabChave.textContent = `${res.length} partidas`;
        }
      }).catch(() => {});
    }

    if (fileInputBanner) {
      fileInputBanner.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          showToast('Selecione apenas arquivos de imagem.', 'warning');
          return;
        }

        try {
          // Compressão de imagem no banner via Canvas (máximo 1200x400px JPEG)
          customEditBannerDataUrl = await comprimirBannerCanvas(file, 1200, 400, 0.82);
          if (previewBannerImg) {
            previewBannerImg.src = customEditBannerDataUrl;
          }
        } catch (compErr) {
          console.warn('Falha na compressão do banner via Canvas, usando FileReader:', compErr);
          const reader = new FileReader();
          reader.onload = (ev) => {
            customEditBannerDataUrl = ev.target.result;
            if (previewBannerImg) {
              previewBannerImg.src = customEditBannerDataUrl;
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    function fecharModalEdicaoTorneio() {
      const modal = document.getElementById('modalEditarTorneioCustom');
      if (modal) modal.style.display = 'none';
      const erroBox = document.getElementById('customModalEditErrorBox');
      if (erroBox) erroBox.style.display = 'none';
    }

    if (btnFecharModalEdit) btnFecharModalEdit.addEventListener('click', fecharModalEdicaoTorneio);
    if (btnCancelarModalEdit) btnCancelarModalEdit.addEventListener('click', fecharModalEdicaoTorneio);
    if (modalEditarTorneio) {
      modalEditarTorneio.addEventListener('click', (e) => {
        if (e.target === modalEditarTorneio) fecharModalEdicaoTorneio();
      });
    }

    function injetarModalEdicaoDinamicoSeNecessario() {
      let modal = document.getElementById('modalEditarTorneioCustom');
      const inputNome = document.getElementById('customEditNome');
      if (modal && inputNome) return modal;

      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = 'modalEditarTorneioCustom';
      modal.className = 'modal-inscricao-overlay';
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: none; align-items: center; justify-content: center; z-index: 99999; padding: 16px; overflow-y: auto; box-sizing: border-box;';
      modal.innerHTML = `
        <div class="modal-editar-torneio-content" style="background: #181824; border: 1px solid #2e2e42; border-radius: 16px; width: 100%; max-width: 600px; max-height: 85vh; overflow-y: auto; padding: 24px; box-shadow: 0 24px 50px rgba(0,0,0,0.8); box-sizing: border-box; color: #fff;">
          <div class="modal-inscricao-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #282838; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-pen-to-square" style="color: #ff7300;"></i> Editar Informações do Torneio</h3>
            <button type="button" class="btn-close-modal" id="btnFecharModalEditarTorneio" aria-label="Fechar" style="background: transparent; border: none; color: #9ca3af; font-size: 20px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form id="formEditarTorneioCustom" style="display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" id="customEditId">
            <input type="hidden" id="customEditStatus">

            <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label for="customEditBannerFile" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Banner do Torneio</label>
              <p style="font-size: 12px; color: #9ca3af; margin: 0 0 6px;">Recomendado: imagem panorâmica ou proporção 16:9.</p>
              <input type="file" id="customEditBannerFile" accept="image/*" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 8px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              <div class="banner-preview-box" id="customEditBannerPreviewBox" style="margin-top: 8px; border-radius: 8px; overflow: hidden; max-height: 140px; border: 1px solid #282838;">
                <img id="customEditBannerPreviewImg" src="/images/logo_versushub.png" alt="Preview do Banner" style="width: 100%; height: 140px; object-fit: cover;" referrerpolicy="no-referrer">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditNome" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Nome do Torneio *</label>
                <input type="text" id="customEditNome" required style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              </div>
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditJogo" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Jogo Competitivo *</label>
                <input type="text" id="customEditJogo" required style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditData" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Data / Horário de Início *</label>
                <input type="text" id="customEditData" placeholder="Ex: Início: 15/04/2026 às 19h" required style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              </div>
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditLimite" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Máx. Vagas (Participantes/Equipes) *</label>
                <input type="number" id="customEditLimite" min="2" max="512" placeholder="Ex: 16" required style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditModalidade" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Modalidade</label>
                <select id="customEditModalidade" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                </select>
              </div>
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditLocalizacao" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Localização</label>
                <input type="text" id="customEditLocalizacao" placeholder="Ex: Online (Servidor Discord)" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditTipoInscricao" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Tipo de Inscrição</label>
                <select id="customEditTipoInscricao" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
                  <option value="Apenas Solo (1v1)">Apenas Solo (1v1)</option>
                  <option value="Apenas Equipe">Apenas Equipe</option>
                  <option value="Solo ou Equipe">Solo ou Equipe</option>
                </select>
              </div>
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditMaxIntegrantes" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Integrantes por Equipe</label>
                <input type="number" id="customEditMaxIntegrantes" min="1" max="30" value="5" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditCategoria" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Categoria</label>
                <select id="customEditCategoria" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
                  <option value="fps">FPS</option>
                  <option value="battle-royale">Battle Royale</option>
                  <option value="moba">MOBA</option>
                  <option value="esportes">Esportes</option>
                  <option value="luta">Luta</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
                <label for="customEditPlataforma" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Plataforma</label>
                <select id="customEditPlataforma" style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
                  <option value="PC">PC</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Console">Console</option>
                  <option value="Multiplataforma">Multiplataforma</option>
                </select>
              </div>
            </div>

            <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label for="customEditLink" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Link Personalizado (Opcional)</label>
              <input type="text" id="customEditLink" placeholder="/torneio/custom.html?id=..." style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;">
            </div>

            <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label for="customEditDescricao" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Descrição do Torneio</label>
              <textarea id="customEditDescricao" rows="3" placeholder="Descrição sobre o torneio..." style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;"></textarea>
            </div>

            <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label for="customEditRegras" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Regras do Torneio</label>
              <textarea id="customEditRegras" rows="4" placeholder="Regras do torneio..." style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;"></textarea>
            </div>

            <div class="modal-form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label for="customEditRequisitos" style="font-size: 13px; font-weight: 600; color: #e4e4e7;">Requisitos</label>
              <textarea id="customEditRequisitos" rows="3" placeholder="Requisitos como nível, elo..." style="background: #111116; border: 1px solid #282838; border-radius: 8px; padding: 10px; color: #e4e4e7; width: 100%; box-sizing: border-box;"></textarea>
            </div>

            <div id="customModalEditErrorBox" style="display: none; padding: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 8px; color: #fca5a5; font-size: 13px;"></div>

            <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
              <button type="button" class="btn-modal-cancel" id="btnCancelarModalEditarTorneio" style="padding: 10px 18px; border-radius: 8px; background: #232333; border: 1px solid #3b3b4f; color: #cbd5e1; cursor: pointer;">Cancelar</button>
              <button type="submit" class="btn-modal-save" id="btnSalvarModalEditarTorneio" style="padding: 10px 20px; border-radius: 8px; background: #ff7300; border: none; color: #fff; font-weight: 700; cursor: pointer;">Salvar Alterações</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      const btnFechar = modal.querySelector('#btnFecharModalEditarTorneio');
      const btnCancelar = modal.querySelector('#btnCancelarModalEditarTorneio');
      if (btnFechar) btnFechar.addEventListener('click', fecharModalEdicaoTorneio);
      if (btnCancelar) btnCancelar.addEventListener('click', fecharModalEdicaoTorneio);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) fecharModalEdicaoTorneio();
      });

      const inpFile = modal.querySelector('#customEditBannerFile');
      if (inpFile) {
        inpFile.addEventListener('change', async (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if (!file) return;
          try {
            customEditBannerDataUrl = await comprimirBannerCanvas(file, 1200, 400, 0.82);
            const prevImg = modal.querySelector('#customEditBannerPreviewImg');
            if (prevImg) prevImg.src = customEditBannerDataUrl;
          } catch (e) {
            const reader = new FileReader();
            reader.onload = (e2) => {
              customEditBannerDataUrl = e2.target.result;
              const prevImg = modal.querySelector('#customEditBannerPreviewImg');
              if (prevImg) prevImg.src = customEditBannerDataUrl;
            };
            reader.readAsDataURL(file);
          }
        });
      }

      const form = modal.querySelector('#formEditarTorneioCustom');
      if (form) {
        form.addEventListener('submit', salvarEdicaoTorneioSubmit);
      }

      return modal;
    }

    function abrirModalEdicaoTorneio() {
      const modal = injetarModalEdicaoDinamicoSeNecessario();
      if (!modal) return;

      const erroBox = document.getElementById('customModalEditErrorBox');
      if (erroBox) erroBox.style.display = 'none';

      // Helper seguro para atribuir .value verificando se o elemento existe (evita Cannot set properties of null)
      const setInputValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== undefined && val !== null) ? val : '';
      };

      setInputValue('customEditId', torneio.id);
      setInputValue('customEditNome', torneio.nome || '');
      setInputValue('customEditJogo', torneio.jogo || '');
      setInputValue('customEditData', torneio.data || '');
      setInputValue('customEditStatus', torneio.status || 'Inscrições abertas');
      setInputValue('customEditModalidade', torneio.modalidade || 'online');
      setInputValue('customEditLocalizacao', torneio.localizacao || '');
      setInputValue('customEditCategoria', (torneio.categoria || 'fps').toLowerCase());
      setInputValue('customEditPlataforma', torneio.plataforma || 'PC');
      const vagasExistentes = torneio.maxParticipantes || torneio.max_participantes || (torneio.limite ? (torneio.limite.match(/\d+/) ? torneio.limite.match(/\d+/)[0] : '') : '') || 16;
      setInputValue('customEditLimite', vagasExistentes);
      setInputValue('customEditLink', torneio.link || '');
      setInputValue('customEditDescricao', torneio.descricao || '');
      setInputValue('customEditRegras', torneio.regras || '');
      setInputValue('customEditRequisitos', torneio.requisitos || '');

      const editTipoInscricao = document.getElementById('customEditTipoInscricao');
      const editMaxIntegrantes = document.getElementById('customEditMaxIntegrantes');
      if (editTipoInscricao) {
        editTipoInscricao.value = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
      }
      if (editMaxIntegrantes) {
        editMaxIntegrantes.value = String(torneio.maxIntegrantes || torneio.max_integrantes || obterMaxIntegrantesTorneio(torneio) || 5);
        if (editTipoInscricao && editTipoInscricao.value === 'Apenas Solo (1v1)') {
          editMaxIntegrantes.value = '1';
          editMaxIntegrantes.disabled = true;
          editMaxIntegrantes.style.opacity = '0.5';
        } else {
          editMaxIntegrantes.disabled = false;
          editMaxIntegrantes.style.opacity = '1';
        }
      }

      // Adiciona interatividade para botões de preset de integrantes
      modal.querySelectorAll('.btn-preset-size').forEach(btn => {
        btn.onclick = () => {
          const sz = btn.getAttribute('data-size');
          if (sz && editMaxIntegrantes) {
            editMaxIntegrantes.value = sz;
            if (sz === '1') {
              if (editTipoInscricao && editTipoInscricao.value === 'Apenas Equipe') {
                editTipoInscricao.value = 'Solo ou Equipe';
              }
            } else {
              if (editTipoInscricao && editTipoInscricao.value === 'Apenas Solo (1v1)') {
                editTipoInscricao.value = 'Solo ou Equipe';
                editMaxIntegrantes.disabled = false;
                editMaxIntegrantes.style.opacity = '1';
              }
            }
          }
        };
      });

      if (editTipoInscricao) {
        editTipoInscricao.onchange = () => {
          if (editTipoInscricao.value === 'Apenas Solo (1v1)') {
            if (editMaxIntegrantes) {
              editMaxIntegrantes.value = '1';
              editMaxIntegrantes.disabled = true;
              editMaxIntegrantes.style.opacity = '0.5';
            }
          } else {
            if (editMaxIntegrantes) {
              editMaxIntegrantes.disabled = false;
              editMaxIntegrantes.style.opacity = '1';
              if (editMaxIntegrantes.value === '1' || !editMaxIntegrantes.value) {
                editMaxIntegrantes.value = String(obterMaxIntegrantesTorneio(torneio) || 5);
              }
            }
          }
        };
      }

      customEditBannerDataUrl = '';
      const fileInput = document.getElementById('customEditBannerFile');
      if (fileInput) fileInput.value = '';
      const previewImg = document.getElementById('customEditBannerPreviewImg');
      if (previewImg) {
        previewImg.src = torneio.banner || '/images/logo_versushub.png';
        previewImg.onerror = () => { previewImg.src = '/images/logo_versushub.png'; };
      }

      modal.style.display = 'flex';
    }

    if (btnAbrirModalEdit) {
      btnAbrirModalEdit.addEventListener('click', abrirModalEdicaoTorneio);
    }

    async function salvarEdicaoTorneioSubmit(e) {
      e.preventDefault();
      const formEl = e.target;
      const btnSave = document.getElementById('btnSalvarModalEditarTorneio');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Salvando...';
      }

      // Declaração preventiva segura de variáveis de UI para evitar ReferenceError
      let listaRequisitos = document.getElementById('listaRequisitos');
      let listaRegras = document.getElementById('listaRegras');
      let detRequisitos = document.getElementById('detRequisitos');

      const erroBoxPrev = document.getElementById('customModalEditErrorBox');
      if (erroBoxPrev) erroBoxPrev.style.display = 'none';

      let bannerNovo = torneio.banner || '/images/logo_versushub.png';
      if (customEditBannerDataUrl) {
        try {
          bannerNovo = await comprimirBannerCanvas(customEditBannerDataUrl, 1200, 400, 0.82);
        } catch (eComp) {
          bannerNovo = customEditBannerDataUrl;
        }
      }

      const getVal = (id, def = '') => {
        const el = document.getElementById(id);
        return el ? el.value : def;
      };

      const statusNovo = getVal('customEditStatus') || torneio.status || 'Inscrições abertas';
      let statusClassNovo = 'status-aberto';
      if (statusNovo === 'Em andamento' || statusNovo === 'Ao Vivo') statusClassNovo = 'status-andamento';
      else if (statusNovo === 'Encerrado') statusClassNovo = 'status-encerrado';

      const editTipo = document.getElementById('customEditTipoInscricao');
      const editMax = document.getElementById('customEditMaxIntegrantes');
      const novoTipoInscricao = editTipo ? editTipo.value : (torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe');
      const novoMaxIntegrantes = editMax ? (parseInt(editMax.value, 10) || obterMaxIntegrantesTorneio(torneio)) : obterMaxIntegrantesTorneio(torneio);
      const novoMaxVagas = parseInt(getVal('customEditLimite', '16'), 10) || 16;
      const novoLimite = `${novoMaxVagas} vagas`;

      const criadorEmailFinal = torneio.criadorEmail || torneio.criador_email || loggedUser?.email || '';

      const updatePayload = {
        nome: getVal('customEditNome').trim(),
        jogo: getVal('customEditJogo').trim(),
        data: getVal('customEditData').trim(),
        status: statusNovo,
        statusClass: statusClassNovo,
        modalidade: getVal('customEditModalidade', 'online'),
        localizacao: getVal('customEditLocalizacao').trim(),
        categoria: getVal('customEditCategoria', 'fps'),
        plataforma: getVal('customEditPlataforma', 'PC'),
        limite: novoLimite,
        maxParticipantes: novoMaxVagas,
        max_participantes: novoMaxVagas,
        link: (getVal('customEditLink') || '').trim() || (torneio.link || ''),
        descricao: getVal('customEditDescricao').trim(),
        regras: getVal('customEditRegras').trim(),
        requisitos: getVal('customEditRequisitos').trim(),
        tipoInscricao: novoTipoInscricao,
        tipo_inscricao: novoTipoInscricao,
        maxIntegrantes: novoMaxIntegrantes,
        max_integrantes: novoMaxIntegrantes,
        banner: bannerNovo,
        criadorEmail: criadorEmailFinal,
        criador_email: criadorEmailFinal
      };

      try {
        let { error } = await supabase
          .from('torneios')
          .update(updatePayload)
          .eq('id', torneio.id);

        if (error) {
          console.warn('Tentativa com payload completo falhou ao atualizar, tentando alternativas:', error.message || error);
          const payloadCamel = { ...updatePayload };
          delete payloadCamel.max_integrantes;
          delete payloadCamel.max_participantes;
          delete payloadCamel.criador_email;
          const resCamel = await supabase.from('torneios').update(payloadCamel).eq('id', torneio.id);
          if (!resCamel.error) {
            error = null;
          } else {
            const payloadSnake = { ...updatePayload };
            delete payloadSnake.maxIntegrantes;
            delete payloadSnake.maxParticipantes;
            delete payloadSnake.criadorEmail;
            const resSnake = await supabase.from('torneios').update(payloadSnake).eq('id', torneio.id);
            if (!resSnake.error) {
              error = null;
            } else {
              // Fallback seguro preservando tipoInscricao e tipo_inscricao
              const payloadBase = { ...updatePayload };
              delete payloadBase.maxIntegrantes;
              delete payloadBase.max_integrantes;
              delete payloadBase.maxParticipantes;
              delete payloadBase.max_participantes;
              delete payloadBase.criador_email;
              const resBase = await supabase.from('torneios').update(payloadBase).eq('id', torneio.id);
              if (!resBase.error) {
                error = null;
              } else {
                error = resBase.error;
              }
            }
          }
        }

        if (error) {
          const msgErro = error.message || 'Erro desconhecido retornado pelo servidor';
          console.error('Erro ao salvar torneio:', msgErro, error);
          showToast(`Erro ao salvar as alterações: ${msgErro}`, 'error');
          let erroBox = document.getElementById('customModalEditErrorBox');
          if (!erroBox) {
            erroBox = document.createElement('div');
            erroBox.id = 'customModalEditErrorBox';
            erroBox.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); padding: 12px 16px; border-radius: 8px; font-size: 13px; margin: 14px 0; display: flex; align-items: center; gap: 8px; line-height: 1.4;';
            const actionsContainer = formEl.querySelector('.modal-actions') || formEl.lastElementChild;
            formEl.insertBefore(erroBox, actionsContainer);
          }
          erroBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; flex-shrink: 0;"></i> <span><strong>Erro do Servidor:</strong> ${escapeHtml(msgErro)}</span>`;
          erroBox.style.display = 'flex';
          return;
        }

        Object.assign(torneio, updatePayload);
        try {
          const allCreated = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
          const idx = allCreated.findIndex(t => String(t.id) === String(torneio.id));
          if (idx !== -1) {
            allCreated[idx] = { ...allCreated[idx], ...updatePayload };
            localStorage.setItem('vh_createdTournaments', JSON.stringify(allCreated));
          }
        } catch (e) {}

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
            liMaxIntegrantes.style.gap = '6px';
            const rotuloIntegrantes = liMaxIntegrantes.querySelector('span:first-child');
            if (rotuloIntegrantes) {
              rotuloIntegrantes.textContent = 'Número de participantes por equipe: ';
              rotuloIntegrantes.style.marginRight = '6px';
            }
            const maxInteg = torneio.maxIntegrantes || torneio.max_integrantes || obterMaxIntegrantesTorneio(torneio);
            textoMaxIntegrantes.textContent = `Até ${maxInteg} jogadores`;
          }
        }
        if (detDescricao) {
          detDescricao.textContent = torneio.descricao || 'Nenhuma descrição informada.';
        }
        if (!listaRegras) listaRegras = document.getElementById('listaRegras');
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
            li.textContent = 'Nenhuma regra adicional especificada.';
            listaRegras.appendChild(li);
          }
        }

        if (!detRequisitos) detRequisitos = document.getElementById('detRequisitos');
        if (detRequisitos) {
          detRequisitos.textContent = (torneio.requisitos && torneio.requisitos.trim())
            ? torneio.requisitos
            : 'Nenhum requisito informado.';
        }

        if (!listaRequisitos) listaRequisitos = document.getElementById('listaRequisitos');
        if (listaRequisitos) {
          listaRequisitos.innerHTML = '';
          if (torneio.requisitos && torneio.requisitos.trim()) {
            torneio.requisitos.split('\n').forEach(linha => {
              const texto = linha.trim();
              if (!texto) return;
              const li = document.createElement('li');
              li.textContent = texto;
              listaRequisitos.appendChild(li);
            });
          } else {
            const li = document.createElement('li');
            li.textContent = 'Nenhum requisito informado.';
            listaRequisitos.appendChild(li);
          }
        }

        fecharModalEdicaoTorneio();
        showToast('Torneio atualizado com sucesso!');
      } catch (err) {
        console.error('Erro geral ao salvar:', err);
        const msgErro = err.message || 'Erro inesperado';
        showToast(`Erro ao salvar: ${msgErro}`, 'error');
        let erroBox = document.getElementById('customModalEditErrorBox');
        if (!erroBox) {
          erroBox = document.createElement('div');
          erroBox.id = 'customModalEditErrorBox';
          erroBox.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); padding: 12px 16px; border-radius: 8px; font-size: 13px; margin: 14px 0; display: flex; align-items: center; gap: 8px; line-height: 1.4;';
          const actionsContainer = formEl.querySelector('.modal-actions') || formEl.lastElementChild;
          formEl.insertBefore(erroBox, actionsContainer);
        }
        erroBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; flex-shrink: 0;"></i> <span><strong>Erro:</strong> ${escapeHtml(msgErro)}</span>`;
        erroBox.style.display = 'flex';
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Salvar Alterações';
        }
      }
    }

    if (formEditarTorneio) {
      formEditarTorneio.addEventListener('submit', salvarEdicaoTorneioSubmit);
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

  // Se status for 'Encerrado' ou statusClass for 'status-encerrado':
  // Desativa o botão de inscrição, altera o texto para 'Inscrições Encerradas' e aplica estilo cinza
  if (verificarTorneioEncerrado(torneioObj)) {
    btn.className = 'btn-principal';
    btn.disabled = true;
    btn.setAttribute('disabled', 'true');
    btn.textContent = 'Inscrições Encerradas';
    btn.style.background = '#2c2c3b';
    btn.style.color = '#9ca3af';
    btn.style.border = '2px solid #3b3b4f';
    btn.style.cursor = 'not-allowed';
    btn.style.pointerEvents = 'none';
    btn.style.boxShadow = 'none';
    btn.removeAttribute('title');
    return;
  }

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
  if (torneioObj?._vagasEsgotadas) {
    btn.className = 'btn-principal';
    btn.disabled = true;
    btn.setAttribute('disabled', 'true');
    btn.style.cursor = 'not-allowed';
    btn.style.pointerEvents = 'none';
    btn.style.background = '#2c2c3b';
    btn.style.color = '#9ca3af';
    btn.style.border = '2px solid #3b3b4f';
    btn.style.boxShadow = 'none';
    btn.textContent = 'Vagas Esgotadas';
    btn.removeAttribute('title');
    return;
  }

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

function sanitizarInscricaoParaCache(inscricao) {
  if (!inscricao) return null;
  const copia = {
    id: inscricao.id || undefined,
    torneio_id: String(inscricao.torneio_id || ''),
    user_email: String(inscricao.user_email || ''),
    tipo: inscricao.tipo || 'individual',
    id_participante: String(inscricao.id_participante || ''),
    equipe_nome: inscricao.equipe_nome ? String(inscricao.equipe_nome).slice(0, 100) : '',
    status: inscricao.status || 'Pendente',
    created_at: inscricao.created_at || new Date().toISOString()
  };

  // Se houver lineup, nunca armazena imagens base64 gigantes no cache local
  if (Array.isArray(inscricao.lineup)) {
    copia.lineup = inscricao.lineup.map(m => {
      let av = m.avatar || '/image/boneco_logo_ofc.png';
      if (typeof av === 'string' && av.startsWith('data:')) {
        av = '/image/boneco_logo_ofc.png';
      }
      return {
        email: String(m.email || '').slice(0, 100),
        nome: String(m.nome || '').slice(0, 80),
        avatar: av
      };
    });
  }

  return copia;
}

function obterItemComFallback(key, valorPadrao = '[]') {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch (e) {}
  try {
    const val = sessionStorage.getItem(key);
    if (val !== null) return val;
  } catch (e) {}
  if (typeof window !== 'undefined' && window.__vh_fallback_storage && window.__vh_fallback_storage[key] !== undefined) {
    return window.__vh_fallback_storage[key];
  }
  return valorPadrao;
}

if (typeof window !== 'undefined') {
  window.obterItemComFallback = obterItemComFallback;
}

function salvarItemComFallback(key, valorJson) {
  try {
    localStorage.setItem(key, valorJson);
    return true;
  } catch (err) {
    // 1. Remove caches temporários pesados dispensáveis
    try {
      const cachesDispensaveis = [
        'vh_torneios_cache',
        'vh_cachedTournaments',
        'vh_cachedEquipes',
        'vh_tournaments',
        'vh_torneios'
      ];
      cachesDispensaveis.forEach(k => {
        if (k !== key) {
          try { localStorage.removeItem(k); } catch (e) {}
        }
      });
    } catch (e) {}

    // 2. Remove base64 pesados em todas as outras chaves do storage
    expurgarImagensPesadasLocalStorage();

    // 3. Compactação agressiva do payload se for lista
    let valorCompactado = valorJson;
    try {
      const parsed = JSON.parse(valorJson);
      if (Array.isArray(parsed)) {
        if (key === 'vh_inscricoes') {
          // Mantém no máximo 15 inscrições com dados essenciais e sem avatares base64
          const reduzida = parsed.slice(-15).map(item => {
            const copia = { ...item };
            if (Array.isArray(copia.lineup)) {
              copia.lineup = copia.lineup.map(m => ({
                nome: String(m.nome || '').slice(0, 50),
                email: String(m.email || '').slice(0, 80),
                avatar: '/image/boneco_logo_ofc.png'
              }));
            }
            return copia;
          });
          valorCompactado = JSON.stringify(reduzida);
        } else if (key.startsWith('vh_joinedTournaments')) {
          valorCompactado = JSON.stringify(parsed.slice(0, 10).map(j => ({ ...j, banner: '' })));
        } else if (parsed.length > 20) {
          valorCompactado = JSON.stringify(parsed.slice(-15));
        }
      }
    } catch (eCompact) {}

    // 4. Tenta novamente gravar no localStorage após descompressão
    try {
      localStorage.setItem(key, valorCompactado);
      return true;
    } catch (err2) {
      // 5. Contingência segura: salva no sessionStorage e na memória global
      try {
        sessionStorage.setItem(key, valorCompactado);
      } catch (eSession) {}
      if (typeof window !== 'undefined') {
        window.__vh_fallback_storage = window.__vh_fallback_storage || {};
        window.__vh_fallback_storage[key] = valorCompactado;
      }
      return true;
    }
  }
}

if (typeof window !== 'undefined') {
  window.salvarItemComFallback = salvarItemComFallback;
}

function salvarInscricaoLocal(inscricao, torneio) {
  try {
    const inscLimpa = sanitizarInscricaoParaCache(inscricao);
    if (!inscLimpa) return;

    let list = [];
    try {
      const raw = obterItemComFallback('vh_inscricoes', '[]');
      list = JSON.parse(raw);
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }

    // Sanitiza itens legados que possam ter entrado antes
    const listSanitizada = list.map(item => sanitizarInscricaoParaCache(item) || item);

    const filtered = listSanitizada.filter(i => !(String(i.torneio_id) === String(inscLimpa.torneio_id) && String(i.id_participante) === String(inscLimpa.id_participante)));
    filtered.push(inscLimpa);

    // Mantém no máximo 25 inscrições mais recentes no cache
    const boundedList = filtered.slice(-25);
    salvarItemComFallback('vh_inscricoes', JSON.stringify(boundedList));

    // Atualiza vh_joinedTournaments do usuário
    if (inscLimpa.user_email) {
      const storageKey = `vh_joinedTournaments_${inscLimpa.user_email}`;
      let joined = [];
      try {
        const rawJoined = obterItemComFallback(storageKey, '[]');
        joined = JSON.parse(rawJoined);
        if (!Array.isArray(joined)) joined = [];
      } catch (e) {
        joined = [];
      }

      const idx = joined.findIndex(t => String(t.id) === String(torneio.id));
      let bannerLimpo = torneio.banner || '';
      if (typeof bannerLimpo === 'string' && bannerLimpo.startsWith('data:')) {
        bannerLimpo = '';
      }

      const itemJoined = {
        id: torneio.id,
        nome: String(torneio.nome || 'Torneio').slice(0, 80),
        jogo: String(torneio.jogo || '').slice(0, 50),
        data: torneio.data || '',
        status: torneio.status || '',
        statusClass: torneio.statusClass || '',
        banner: bannerLimpo,
        link: `/torneio/custom.html?id=${encodeURIComponent(torneio.id)}`,
        inscricaoStatus: inscLimpa.status || 'Pendente',
        tipo: inscLimpa.tipo,
        id_participante: inscLimpa.id_participante
      };

      if (idx !== -1) {
        joined[idx] = { ...joined[idx], ...itemJoined };
      } else {
        joined.unshift(itemJoined);
      }

      const boundedJoined = joined.slice(0, 20);
      salvarItemComFallback(storageKey, JSON.stringify(boundedJoined));
    }
  } catch (e) {
    console.warn('Aviso não-bloqueante ao salvar inscrição no cache local:', e);
  }
}

// AÇÃO 2: Exibir Participantes Confirmados e Atualizar Contador de Vagas
async function carregarParticipantesConfirmados(torneioId, preloadedInscricoes = null, torneioObj = null) {
  const listaEl = document.getElementById('listaParticipantes');
  if (!listaEl) return;

  try {
    let aceitos = [];
    if (Array.isArray(preloadedInscricoes) && preloadedInscricoes.length > 0) {
      aceitos = [...preloadedInscricoes];
    } else {
      try {
        const { data: dataStr, error: errStr } = await supabase
          .from('inscricoes')
          .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
          .eq('torneio_id', String(torneioId))
          .eq('status', 'Aceito');

        if (!errStr && Array.isArray(dataStr)) {
          aceitos = dataStr;
        }

        if (!isNaN(Number(torneioId))) {
          const { data: dataNum } = await supabase
            .from('inscricoes')
            .select('torneio_id, user_email, status, tipo, id_participante, lineup, created_at')
            .eq('torneio_id', Number(torneioId))
            .eq('status', 'Aceito');

          if (Array.isArray(dataNum)) {
            dataNum.forEach(item => {
              if (!aceitos.some(a => String(a.id_participante || a.user_email) === String(item.id_participante || item.user_email))) {
                aceitos.push(item);
              }
            });
          }
        }
      } catch (e) {
        console.warn('Aviso ao consultar inscrições aceitas:', e);
      }
    }

    // Consulta remota direta sem depender de vh_inscricoes local
    // (Apenas se o Supabase não retornou nenhum dado por falha de rede/offline é que tentamos recuperar)
    if (aceitos.length === 0) {
      try {
        const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
        allLocal
          .filter(i => String(i.torneio_id) === String(torneioId) && (i.status === 'Aceito' || i.status === 'aceito'))
          .forEach(li => {
            if (!aceitos.some(a => String(a.id_participante || a.user_email) === String(li.id_participante || li.user_email))) {
              aceitos.push(li);
            }
          });
      } catch (eLocal) {}
    }

    // 1. Deduplicação inicial estrita de inscrições brutas
    const mapaInicial = new Map();
    aceitos.forEach(p => {
      const chave = (p.id_participante || p.user_email || p.id || '').trim().toLowerCase();
      if (chave && !mapaInicial.has(chave)) {
        mapaInicial.set(chave, p);
      }
    });
    aceitos = Array.from(mapaInicial.values());

    const objTorneio = torneioObj || (typeof torneioGlobal !== 'undefined' ? torneioGlobal : null);

    let limiteNum = null;
    if (objTorneio?.maxParticipantes || objTorneio?.max_participantes) {
      limiteNum = parseInt(objTorneio.maxParticipantes || objTorneio.max_participantes, 10);
    } else if (objTorneio?.limite) {
      const match = String(objTorneio.limite).match(/\d+/);
      if (match) limiteNum = parseInt(match[0], 10);
    }
    if (!limiteNum || isNaN(limiteNum) || limiteNum <= 0) {
      limiteNum = 16;
    }

    if (aceitos.length === 0) {
      const contadorEl = document.getElementById('contadorParticipantes');
      const textoVagasEl = document.getElementById('textoVagas');
      if (contadorEl) contadorEl.textContent = `0 / ${limiteNum} confirmados`;
      if (textoVagasEl) textoVagasEl.textContent = `0 / ${limiteNum} (${limiteNum} restantes)`;

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
      let targetId = idPart;
      let lineupList = [];

      if (tipo === 'equipe') {
        try {
          let eqDb = null;
          try {
            const { data: resOr, error: errOr } = await supabase
              .from('equipes')
              .select('id, nome, tag, logo, leaderName, leaderEmail')
              .or(`id.eq.${idPart},nome.eq.${idPart}`)
              .maybeSingle();
            if (!errOr && resOr) eqDb = resOr;
          } catch (eOr) {}

          if (!eqDb) {
            try {
              const { data: resById } = await supabase
                .from('equipes')
                .select('id, nome, tag, logo, leaderName, leaderEmail')
                .eq('id', String(idPart))
                .maybeSingle();

              if (resById) {
                eqDb = resById;
              } else {
                const { data: resByNome } = await supabase
                  .from('equipes')
                  .select('id, nome, tag, logo, leaderName, leaderEmail')
                  .eq('nome', String(idPart))
                  .maybeSingle();
                if (resByNome) eqDb = resByNome;
              }
            } catch (eFb) {}
          }

          if (eqDb) {
            nome = eqDb.nome + (eqDb.tag ? ` [${eqDb.tag}]` : '');
            foto = eqDb.logo || '/image/logo.png';
            if (eqDb.id) targetId = eqDb.id;
          } else {
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
              if (found.id) targetId = found.id;
            } else {
              if (insc.equipe_nome) {
                nome = insc.equipe_nome;
              } else if (String(idPart).startsWith('team-')) {
                nome = 'Equipe ' + String(idPart).replace('team-', '');
              } else {
                nome = idPart;
              }
              foto = '/image/logo.png';
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
            .select('id, email, nome, avatar')
            .eq('email', idPart)
            .maybeSingle();

          if (uDb) {
            if (uDb.nome) nome = uDb.nome;
            if (uDb.avatar) foto = uDb.avatar;
            targetId = uDb.id || uDb.email || idPart;
          } else {
            const rawLogged = localStorage.getItem('vh_loggedUser');
            if (rawLogged) {
              const u = JSON.parse(rawLogged);
              if (u.email === idPart) {
                nome = u.nome || idPart;
                if (u.avatar) foto = u.avatar;
                targetId = u.id || u.email || idPart;
              }
            }
          }
        } catch (errU) {
          console.warn('Erro ao consultar dados do usuário:', errU);
        }
      }

      return {
        id: insc.id || idPart,
        targetId,
        userEmail: insc.user_email || (tipo === 'individual' ? idPart : null),
        tipo,
        nome,
        foto,
        subtitulo,
        lineup: lineupList
      };
    });

    const participantesDetalhadosRaw = await Promise.all(promessas);

    // DEDUPLICAÇÃO RIGOROSA POR ID E NOME DE EQUIPE (elimina de vez nomes de equipes duplicados na tela)
    const participantesDetalhados = [];
    const idsEquipesVistos = new Set();
    const nomesEquipesVistos = new Set();
    const idsJogadoresVistos = new Set();

    participantesDetalhadosRaw.forEach(p => {
      if (p.tipo === 'equipe') {
        const idKey = String(p.targetId || p.id || '').trim().toLowerCase();
        const cleanRaw = typeof removerTagNome === 'function'
          ? removerTagNome(p.nome || '')
          : (window.removerTagNome ? window.removerTagNome(p.nome || '') : String(p.nome || '').replace(/\[[^\]]*\]/g, ''));
        const nomeClean = (cleanRaw || '').trim().toLowerCase();

        if (idKey && idsEquipesVistos.has(idKey)) return;
        if (nomeClean && nomesEquipesVistos.has(nomeClean)) return;

        if (idKey) idsEquipesVistos.add(idKey);
        if (nomeClean) nomesEquipesVistos.add(nomeClean);
        participantesDetalhados.push(p);
      } else {
        const userKey = String(p.targetId || p.userEmail || p.id || '').trim().toLowerCase();
        if (userKey && idsJogadoresVistos.has(userKey)) return;
        if (userKey) idsJogadoresVistos.add(userKey);
        participantesDetalhados.push(p);
      }
    });

    // Atualiza indicadores de participantes e vagas na tela com contagem deduplicada real
    const contadorEl = document.getElementById('contadorParticipantes');
    const textoVagasEl = document.getElementById('textoVagas');
    const liVagasEl = document.getElementById('liVagas');

    const totalConfirmados = participantesDetalhados.length;
    const restantes = Math.max(0, limiteNum - totalConfirmados);

    if (contadorEl) {
      contadorEl.textContent = `${totalConfirmados} / ${limiteNum} confirmados`;
    }

    if (textoVagasEl) {
      textoVagasEl.textContent = `${totalConfirmados} / ${limiteNum} (${restantes} restante${restantes === 1 ? '' : 's'})`;
      if (liVagasEl) {
        liVagasEl.style.display = 'flex';
        liVagasEl.style.gap = '6px';
        const rotuloVagas = liVagasEl.querySelector('span:first-child');
        if (rotuloVagas) {
          rotuloVagas.textContent = 'Vagas: ';
          rotuloVagas.style.marginRight = '6px';
        }
      }
    }

    // Trava e Atualização de Status: Vagas Esgotadas
    const vagasEsgotadas = totalConfirmados >= limiteNum;
    if (objTorneio) {
      objTorneio._vagasEsgotadas = vagasEsgotadas;
      objTorneio.maxParticipantes = limiteNum;
      objTorneio.totalConfirmados = totalConfirmados;
    }
    if (typeof torneioGlobal !== 'undefined' && torneioGlobal) {
      torneioGlobal._vagasEsgotadas = vagasEsgotadas;
      torneioGlobal.maxParticipantes = limiteNum;
      torneioGlobal.totalConfirmados = totalConfirmados;
    }

    const detStatusBadge = document.getElementById('detStatusBadge');
    const textoStatus = document.getElementById('textoStatus');
    const btnInscrever = document.getElementById('btnInscrever');

    if (verificarTorneioEncerrado(objTorneio)) {
      if (detStatusBadge) {
        detStatusBadge.textContent = 'Encerrado';
        detStatusBadge.className = 'torneio-status-badge status-encerrado';
      }
      if (textoStatus) {
        textoStatus.textContent = 'Encerrado';
      }
      if (btnInscrever) {
        btnInscrever.disabled = true;
        btnInscrever.setAttribute('disabled', 'true');
        btnInscrever.textContent = 'Inscrições Encerradas';
        btnInscrever.className = 'btn-principal';
        btnInscrever.style.background = '#2c2c3b';
        btnInscrever.style.color = '#9ca3af';
        btnInscrever.style.border = '2px solid #3b3b4f';
        btnInscrever.style.cursor = 'not-allowed';
        btnInscrever.style.pointerEvents = 'none';
        btnInscrever.style.boxShadow = 'none';
        btnInscrever.removeAttribute('title');
      }
    } else if (vagasEsgotadas) {
      if (detStatusBadge && objTorneio?.status !== 'Encerrado') {
        detStatusBadge.textContent = 'Vagas Esgotadas';
        detStatusBadge.className = 'torneio-status-badge status-encerrado';
      }
      if (textoStatus && objTorneio?.status !== 'Encerrado') {
        textoStatus.textContent = 'Vagas Esgotadas';
      }
      if (btnInscrever && !btnInscrever.classList.contains('btn-cancelar-inscricao')) {
        btnInscrever.disabled = true;
        btnInscrever.setAttribute('disabled', 'true');
        btnInscrever.textContent = 'Vagas Esgotadas';
        btnInscrever.style.background = '#2c2c3b';
        btnInscrever.style.color = '#9ca3af';
        btnInscrever.style.border = '2px solid #3b3b4f';
        btnInscrever.style.cursor = 'not-allowed';
        btnInscrever.style.pointerEvents = 'none';
        btnInscrever.style.boxShadow = 'none';
      }
    } else {
      if (detStatusBadge && detStatusBadge.textContent === 'Vagas Esgotadas' && objTorneio?.status !== 'Encerrado') {
        detStatusBadge.textContent = objTorneio?.status || 'Inscrições abertas';
        detStatusBadge.className = 'torneio-status-badge ' + (objTorneio?.statusClass || 'status-aberto');
      }
      if (textoStatus && textoStatus.textContent === 'Vagas Esgotadas' && objTorneio?.status !== 'Encerrado') {
        textoStatus.textContent = objTorneio?.status || 'Inscrições abertas';
      }
    }

    listaEl.innerHTML = participantesDetalhados.map(p => {
      const perfilUrl = p.tipo === 'equipe'
        ? `/equipes/template_equipe.html?id=${encodeURIComponent(p.targetId || p.id)}`
        : `/perfil/perfil-publico.html?id=${encodeURIComponent(p.targetId || p.userEmail || p.id)}`;

      const teamNameSafe = escapeHtml(p.nome);

      return `
        <div class="participante-card" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); transition: all 0.2s ease; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; overflow: hidden;">
          <a href="${perfilUrl}" title="Ver ${p.tipo === 'equipe' ? 'equipe' : 'perfil de'} ${escapeHtml(p.nome)}" style="text-decoration: none; color: inherit; cursor: pointer; display: flex; align-items: center; gap: 12px; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;">
            <img
              src="${p.foto}"
              alt="${escapeHtml(p.nome)}"
              onerror="this.src='/image/boneco_logo_ofc.png'"
              class="participante-avatar ${p.tipo === 'equipe' ? 'avatar-equipe' : ''}"
              style="width: 44px; height: 44px; border-radius: ${p.tipo === 'equipe' ? '8px' : '50%'}; object-fit: cover; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0;"
            / referrerpolicy="no-referrer">
            <div class="participante-info" style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; max-width: 100%; overflow: hidden;">
              <strong class="participante-nome" style="font-size: 15px; font-weight: 700; color: #ffffff; word-break: break-word; overflow-wrap: anywhere; line-height: 1.3; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${escapeHtml(p.nome)}
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 11px; color: #6366f1; opacity: 0.8; flex-shrink: 0;"></i>
              </strong>
              <span class="participante-badge ${p.tipo === 'equipe' ? 'badge-equipe' : 'badge-jogador'}" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; width: fit-content; display: inline-flex; align-items: center; gap: 4px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);">
                <i class="fa-solid ${p.tipo === 'equipe' ? 'fa-shield-halved' : 'fa-user'}"></i>
                ${escapeHtml(p.subtitulo)}
              </span>
            </div>
          </a>

          ${p.tipo === 'equipe' ? `
            <div style="width: 100%; max-width: 100%; min-width: 0; margin-top: 2px; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.08); box-sizing: border-box; overflow: hidden;">
              <button
                type="button"
                class="btn-ver-lineup-publico"
                data-id="${escapeHtml(p.targetId || p.id)}"
                data-team-name="${teamNameSafe}"
                style="width: 100%; max-width: 100%; min-width: 0; background: rgba(99, 102, 241, 0.18); border: 1px solid rgba(99, 102, 241, 0.45); color: #c7d2fe; padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; box-sizing: border-box; overflow: hidden; white-space: normal; word-break: break-word;"
              >
                <i class="fa-solid fa-users" style="flex-shrink: 0;"></i> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">Ver Integrantes da Equipe</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    listaEl.querySelectorAll('.btn-ver-lineup-publico').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const teamName = btn.getAttribute('data-team-name') || 'Equipe';
        const teamId = btn.getAttribute('data-id') || '';
        if (typeof window.abrirModalLineupPublica === 'function') {
          window.abrirModalLineupPublica(teamName, teamId);
        }
      });
    });
  } catch (errGeral) {
    console.error('Erro ao renderizar participantes:', errGeral);
    listaEl.innerHTML = `
      <div style="color: #ef4444; font-size: 13px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Não foi possível carregar os participantes.
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.carregarParticipantesConfirmados = carregarParticipantesConfirmados;

  window.abrirModalLineupPublica = async function(param1, param2) {
    let teamName = 'Equipe';
    let teamId = '';
    let lineup = [];

    if (typeof param1 === 'string') {
      teamName = param1;
      if (Array.isArray(param2)) lineup = param2;
      else if (typeof param2 === 'string') teamId = param2;
    } else if (typeof param1 === 'object' && param1) {
      teamName = param1.nome || param1.name || 'Equipe';
      teamId = param1.id || param1.targetId || '';
      if (Array.isArray(param1.lineup)) lineup = param1.lineup;
    }

    const antigo = document.getElementById('modalLineupPublica');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalLineupPublica';
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';

    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 480px; width: 100%; background: #14141e; border: 1px solid #2b2b3d; border-radius: 14px; padding: 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.7); color: #f3f4f6; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #2b2b3d; padding-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: #ffffff;">
            <i class="fa-solid fa-users" style="color: #6366f1;"></i> Integrantes da Equipe: ${escapeHtml(teamName)}
          </h3>
          <button type="button" id="btnFecharModalLineupPublica" style="background: none; border: none; color: #9ca3af; font-size: 22px; cursor: pointer;">&times;</button>
        </div>
        <p style="font-size: 12.5px; color: #9ca3af; margin-top: 0; margin-bottom: 14px;">
          Membros ativos vinculados a esta equipe:
        </p>
        <div id="containerMembrosLineupModal" style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          <div style="text-align: center; color: #9ca3af; padding: 24px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 22px; color: #6366f1;"></i>
            <span style="display: block; margin-top: 8px; font-size: 13px;">Buscando integrantes vinculados...</span>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 18px;">
          <button type="button" id="btnOkModalLineupPublica" style="background: #312e81; border: 1px solid #6366f1; color: #c7d2fe; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const fechar = () => overlay.remove();
    overlay.querySelector('#btnFecharModalLineupPublica').addEventListener('click', fechar);
    overlay.querySelector('#btnOkModalLineupPublica').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    const containerMembros = overlay.querySelector('#containerMembrosLineupModal');

    // Consulta direta dos membros ativos vinculados na tabela membros_equipe
    try {
      let teamData = null;
      if (teamId) {
        const { data: td } = await supabase.from('equipes').select('id, nome, tag, logo, leaderName, leaderEmail').eq('id', teamId).maybeSingle();
        if (td) teamData = td;
      }
      if (!teamData && teamName) {
        const cleanName = teamName.replace(/\[.*?\]/g, '').trim();
        const { data: td } = await supabase.from('equipes').select('id, nome, tag, logo, leaderName, leaderEmail').ilike('nome', cleanName).maybeSingle();
        if (td) teamData = td;
      }

      const searchIds = [];
      if (teamId) searchIds.push(String(teamId));
      if (teamData?.id) searchIds.push(String(teamData.id));
      if (teamData?.nome) searchIds.push(String(teamData.nome));
      if (teamName) searchIds.push(teamName.replace(/\[.*?\]/g, '').trim());

      const emailsSet = new Set();
      const leaderEmail = (teamData?.leaderEmail || '').toLowerCase().trim();
      if (leaderEmail) emailsSet.add(leaderEmail);

      try {
        const { data: membrosAceitos } = await supabase
          .from('membros_equipe')
          .select('id, equipe_id, user_email, status')
          .in('equipe_id', searchIds)
          .eq('status', 'Aceito');

        (membrosAceitos || []).forEach(m => {
          if (m.user_email) emailsSet.add(m.user_email.toLowerCase().trim());
        });
      } catch (errMem) {
        console.warn('Aviso ao consultar membros_equipe no modal público:', errMem);
      }

      const emails = Array.from(emailsSet);
      let membrosArr = [];

      if (emails.length > 0) {
        try {
          const { data: uData } = await supabase
            .from('usuarios')
            .select('id, nome, email, avatar')
            .in('email', emails);

          const uMap = new Map((uData || []).map(u => [(u.email || '').toLowerCase().trim(), u]));

          membrosArr = emails.map(em => {
            const u = uMap.get(em) || {};
            const isLeader = leaderEmail && em === leaderEmail;
            return {
              id: u.id || em,
              nome: u.nome || (isLeader && teamData?.leaderName ? teamData.leaderName : null) || em.split('@')[0],
              email: em,
              avatar: u.avatar || (isLeader && teamData?.logo ? teamData.logo : '/image/boneco_logo_ofc.png'),
              role: isLeader ? 'Capitão / Líder' : 'Membro Ativo'
            };
          });
        } catch (uErr) {
          console.warn('Aviso ao buscar usuários:', uErr);
        }
      }

      if (membrosArr.length === 0 && Array.isArray(lineup) && lineup.length > 0) {
        membrosArr = lineup;
      }

      if (membrosArr.length === 0) {
        containerMembros.innerHTML = `
          <div style="text-align: center; color: #9ca3af; padding: 20px;">
            Nenhum integrante ativo vinculado a esta equipe no momento.
          </div>
        `;
        return;
      }

      containerMembros.innerHTML = membrosArr.map(m => {
        const profileId = m.id || m.email || m.nome;
        const profileUrl = `/perfil/perfil-publico.html?id=${encodeURIComponent(profileId)}`;
        const isLeader = m.role && (m.role.includes('Líder') || m.role.includes('Capitão'));
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #1c1c28; border: 1px solid #2b2b3d; border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: all 0.2s;" onclick="window.location.href='${profileUrl}'" onmouseenter="this.style.borderColor='#6366f1'" onmouseleave="this.style.borderColor='#2b2b3d'">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <img src="${escapeHtml(m.avatar || '/image/boneco_logo_ofc.png')}" alt="${escapeHtml(m.nome || 'Jogador')}" onerror="this.src='/image/boneco_logo_ofc.png'" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid ${isLeader ? '#ef4444' : '#6366f1'}; flex-shrink: 0;" / referrerpolicy="no-referrer">
              <div style="overflow: hidden; min-width: 0;">
                <div style="font-size: 14px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
                  ${escapeHtml(m.nome || m.email || 'Jogador')}
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; color: #6366f1; opacity: 0.7;"></i>
                </div>
                ${m.email ? `<div style="font-size: 11.5px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.email)}</div>` : ''}
              </div>
            </div>
            <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; ${isLeader ? 'background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35);' : 'background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);'} flex-shrink: 0;">
              ${escapeHtml(m.role || 'Membro Ativo')}
            </span>
          </div>
        `;
      }).join('');

    } catch (eGeral) {
      console.error('Erro ao carregar membros no modal público:', eGeral);
      containerMembros.innerHTML = `
        <div style="text-align: center; color: #ef4444; padding: 20px;">
          Não foi possível carregar os integrantes da equipe.
        </div>
      `;
    }
  };
}

// AÇÃO 1.1: Inscrição Solo Direta (quando o torneio for Apenas Solo)
async function realizarInscricaoSoloDireta(torneio, loggedUser, onSucesso) {
  if (verificarTorneioEncerrado(torneio)) {
    showToast('As inscrições para este torneio estão encerradas.', 'warning');
    return;
  }
  const btnInscrever = document.getElementById('btnInscrever');
  const textoOriginal = btnInscrever ? btnInscrever.textContent : 'Inscrever-se';
  if (btnInscrever) {
    btnInscrever.disabled = true;
    btnInscrever.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscrevendo...';
  }

  // Payload limpo sem obrigatoriedade de created_at para o Supabase
  const payloadInscricao = {
    torneio_id: String(torneio.id),
    user_email: loggedUser.email,
    tipo: 'individual',
    id_participante: loggedUser.email,
    status: 'Pendente'
  };

  const inscricaoLocal = {
    ...payloadInscricao,
    created_at: new Date().toISOString()
  };

  try {
    const { error: insErr } = await supabase
      .from('inscricoes')
      .insert([payloadInscricao]);

    if (insErr) {
      console.error('Erro ao gravar inscrição no Supabase:', insErr);
      showToast('Erro ao salvar no banco de dados remoto', 'error');
      if (btnInscrever) {
        btnInscrever.disabled = false;
        btnInscrever.textContent = textoOriginal;
      }
      return;
    }

    salvarInscricaoLocal(inscricaoLocal, torneio);
    showToast('Inscrição individual confirmada com sucesso! Aguarde a aprovação do organizador.');

    if (typeof onSucesso === 'function') {
      onSucesso(inscricaoLocal);
    }
  } catch (err) {
    console.error('Erro na inscrição solo direta:', err);
    showToast('Erro ao salvar no banco de dados remoto', 'error');
    if (btnInscrever) {
      btnInscrever.disabled = false;
      btnInscrever.textContent = textoOriginal;
    }
  }
}

// AÇÃO 1.2: Modal de Inscrição e Escalação de Line-up (Apenas Equipe ou Solo ou Equipe)
function abrirModalEscolhaInscricao(torneio, loggedUser, onSucesso) {
  if (verificarTorneioEncerrado(torneio)) {
    showToast('As inscrições para este torneio estão encerradas.', 'warning');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-inscricao-overlay';
  overlay.id = 'modalEscolhaInscricaoOverlay';

  const tipoTorneio = torneio.tipoInscricao || torneio.tipo_inscricao || 'Solo ou Equipe';
  const maxIntegrantes = obterMaxIntegrantesTorneio(torneio);
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
        / referrerpolicy="no-referrer">
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
        .select('id, nome, tag, logo, leaderName, leaderEmail, limite, jogos')
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

      const renderEquipePreview = (eq) => {
        const logo = eq.logo || '/image/logo.png';
        const tag = eq.tag ? `[${escapeHtml(eq.tag)}] ` : '';
        const leader = eq.leaderName || loggedUser.nome || 'Líder';
        return `
          <div style="background: #111118; border: 1.5px solid #28283a; border-radius: 12px; padding: 14px; display: flex; align-items: center; gap: 14px; margin-top: 10px;">
            <img src="${escapeHtml(logo)}" alt="${escapeHtml(eq.nome)}" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0;" onerror="this.src='/image/logo.png';" / referrerpolicy="no-referrer">
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 15px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${tag}${escapeHtml(eq.nome)}
              </div>
              <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">
                <i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 11px;"></i> Líder: ${escapeHtml(leader)}
              </div>
            </div>
            <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); white-space: nowrap;">
              Inscrição Direta
            </span>
          </div>
          <div style="margin-top: 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #93c5fd; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-check" style="color: #60a5fa; font-size: 14px; flex-shrink: 0;"></i>
            <span>Sua equipe será inscrita diretamente com o escudo e os integrantes ativos vinculados. Não é necessário escalar manualmente.</span>
          </div>
        `;
      };

      areaDetalhes.innerHTML = `
        <label for="selectEquipeInscricao" style="display: block; font-size: 13px; font-weight: 600; color: #e5e5ff; margin-bottom: 8px;">
          Selecione a equipe para disputar o torneio:
        </label>
        <select id="selectEquipeInscricao" style="width: 100%; background: #12121a; border: 1.5px solid #3b3b4f; color: #ffffff; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-bottom: 4px;">
          ${equipesLideradas.map(eq => `
            <option value="${escapeHtml(eq.id)}">${escapeHtml(eq.nome)} ${eq.tag ? '[' + escapeHtml(eq.tag) + ']' : ''}</option>
          `).join('')}
        </select>
        <div id="containerEquipePreview">
          ${renderEquipePreview(equipesLideradas[0])}
        </div>
      `;

      btnConfirmar.disabled = false;

      const selectEl = areaDetalhes.querySelector('#selectEquipeInscricao');
      const containerPreview = areaDetalhes.querySelector('#containerEquipePreview');

      selectEl.addEventListener('change', () => {
        equipeSelecionadaId = selectEl.value;
        const eqAtual = equipesLideradas.find(t => String(t.id) === String(selectEl.value));
        if (eqAtual && containerPreview) {
          containerPreview.innerHTML = renderEquipePreview(eqAtual);
        }
      });
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

    // Ação de confirmação direta
    btnConfirmar.addEventListener('click', async () => {
      if (verificarTorneioEncerrado(torneio)) {
        showToast('As inscrições para este torneio estão encerradas.', 'warning');
        fechar();
        return;
      }

      btnConfirmar.disabled = true;
      btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscrevendo...';

      const idParticipante = tipoSelecionado === 'equipe' ? String(equipeSelecionadaId) : loggedUser.email;
      let equipeNome = '';
      let equipeLogo = '/image/logo.png';
      let leaderEmail = loggedUser.email;

      if (tipoSelecionado === 'equipe') {
        const eq = equipesLideradas.find(t => String(t.id) === String(equipeSelecionadaId));
        if (eq) {
          equipeNome = eq.nome;
          equipeLogo = eq.logo || '/image/logo.png';
          if (eq.leaderEmail) leaderEmail = eq.leaderEmail;
        }
      }

      // Payload limpo sem exigir array individual lineup
      const payloadInscricao = {
        torneio_id: String(torneio.id),
        user_email: (tipoSelecionado === 'equipe' && leaderEmail) ? leaderEmail : loggedUser.email,
        tipo: tipoSelecionado,
        id_participante: idParticipante,
        status: 'Pendente'
      };

      const inscricaoLocal = {
        ...payloadInscricao,
        equipe_nome: equipeNome,
        equipe_id: idParticipante,
        logo: equipeLogo,
        created_at: new Date().toISOString()
      };

      try {
        // Tenta salvar na tabela inscricoes do Supabase
        const { error: insErr } = await supabase
          .from('inscricoes')
          .insert([payloadInscricao]);

        if (insErr) {
          console.error('Erro no Supabase inscricoes:', insErr);
          showToast('Erro ao salvar no banco de dados remoto', 'error');
          btnConfirmar.disabled = false;
          btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Inscrição';
          return;
        }

        // Salva localmente após confirmação remota com sucesso
        salvarInscricaoLocal(inscricaoLocal, torneio);

        fechar();
        showToast(
          tipoSelecionado === 'equipe'
            ? `Inscrição da equipe "${equipeNome || 'sua equipe'}" confirmada diretamente! Aguarde a aprovação do organizador.`
            : 'Inscrição individual enviada! Aguarde a aprovação do organizador.'
        );

        if (typeof onSucesso === 'function') {
          onSucesso(inscricaoLocal);
        }
      } catch (errFinal) {
        console.error('Erro ao registrar inscrição:', errFinal);
        showToast('Erro ao salvar no banco de dados remoto', 'error');
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Inscrição';
      }
    });
  }

// ==========================================
// MODAL DE CONVIDAR PARTICIPANTES / EQUIPES (TORNEIO)
// ==========================================
function abrirModalConvidarParticipantes(torneioId, torneioNome) {
  let modal = document.getElementById('modalConvidarParticipantes');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalConvidarParticipantes';
    modal.className = 'modal-inscricao-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background: #111118; border: 1px solid #28283a; border-radius: 18px; width: 100%; max-width: 560px; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.85); display: flex; flex-direction: column;">
      <div style="padding: 18px 24px; border-bottom: 1px solid #232332; display: flex; justify-content: space-between; align-items: center; background: #161622;">
        <h3 style="margin: 0; color: #ffffff; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-paper-plane" style="color: #3b82f6;"></i> Convidar Participantes
        </h3>
        <button type="button" id="btnFecharModalConvidarPart" style="background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; padding: 4px;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="padding: 20px 24px;">
        <p style="color: #9ca3af; font-size: 13.5px; margin-top: 0; margin-bottom: 14px; line-height: 1.5;">
          Pesquise jogadores ou equipes cadastrados no VersusHub para convidá-los para <strong style="color: #ffffff;">"${escapeHtml(torneioNome || 'este torneio')}"</strong>:
        </p>
        <div style="position: relative; margin-bottom: 14px;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 13px; color: #6b7280;"></i>
          <input
            type="text"
            id="inputBuscaPart"
            placeholder="Digite nome de jogador, equipe ou e-mail..."
            style="width: 100%; box-sizing: border-box; padding: 11px 14px 11px 40px; background: #161622; border: 1px solid #2a2a3c; border-radius: 10px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s;"
          />
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
          <button type="button" class="btn-tab-filtro active" data-filter="todos" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.2); color: #93c5fd; font-size: 12px; font-weight: 600; cursor: pointer;">Todos</button>
          <button type="button" class="btn-tab-filtro" data-filter="jogadores" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #2a2a3c; background: #161622; color: #9ca3af; font-size: 12px; font-weight: 600; cursor: pointer;">Jogadores</button>
          <button type="button" class="btn-tab-filtro" data-filter="equipes" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #2a2a3c; background: #161622; color: #9ca3af; font-size: 12px; font-weight: 600; cursor: pointer;">Equipes</button>
        </div>
        <div id="listaResultadosPart" style="max-height: 330px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px;">
          <div style="text-align: center; color: #6b7280; padding: 30px 10px; font-size: 13.5px;">
            <i class="fa-solid fa-user-group" style="font-size: 28px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
            Digite no campo acima para pesquisar jogadores e equipes.
          </div>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const btnFechar = document.getElementById('btnFecharModalConvidarPart');
  btnFechar.onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  const inputBusca = document.getElementById('inputBuscaPart');
  const listaContainer = document.getElementById('listaResultadosPart');
  const filtroBtns = modal.querySelectorAll('.btn-tab-filtro');

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
    pesquisarParticipantesSupabase(q, filtroAtual, torneioId, torneioNome, listaContainer);
  }

  inputBusca.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(executarBusca, 280);
  });

  inputBusca.focus();
}

async function pesquisarParticipantesSupabase(termo, filtro, torneioId, torneioNome, container) {
  container.innerHTML = `
    <div style="text-align: center; color: #9ca3af; padding: 25px; font-size: 14px;">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px; color: #3b82f6;"></i> Buscando...
    </div>
  `;

  try {
    let resultados = [];

    // 1. Busca jogadores na tabela 'usuarios'
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

    // 2. Busca equipes na tabela 'equipes'
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

    // 3. Consulta inscrições já existentes neste torneio
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
          <button type="button" class="btn-acao-convidar-torneio" data-tipo="${item.tipo}" data-id="${escapeHtml(item.id)}" data-nome="${escapeHtml(item.nome)}" data-email="${escapeHtml(item.email || '')}" style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); border: 1px solid #60a5fa; color: #ffffff; padding: 7px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);">
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

    container.querySelectorAll('.btn-acao-convidar-torneio').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tipo = btn.dataset.tipo;
        const idPart = btn.dataset.id;
        const nomePart = btn.dataset.nome;
        const emailPart = (btn.dataset.email || '').trim().toLowerCase();

        if (!emailPart) {
          alert('Este participante não possui e-mail para receber o convite.');
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
            console.error('Erro ao enviar notificação de convite de torneio:', notifErr);
          }

          btn.innerHTML = '<i class="fa-solid fa-check"></i> Convidado!';
          btn.style.background = 'rgba(16, 185, 129, 0.2)';
          btn.style.borderColor = '#10b981';
          btn.style.color = '#34d399';
          btn.style.cursor = 'default';

          if (typeof showCustomToast === 'function') {
            showCustomToast(`Convite enviado com sucesso para "${nomePart}"!`);
          } else {
            console.log(`Convite enviado para "${nomePart}"!`);
          }
        } catch (err) {
          console.error('Erro ao enviar convite de torneio:', err);
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

// ==========================================
// SISTEMA DE CURTIR TORNEIO (SINCRONIZADO COM SUPABASE)
// ==========================================
async function configurarBotaoCurtir(torneioId) {
  const btnCurtir = document.getElementById('btnCurtirTorneio');
  const iconCurtir = document.getElementById('iconCurtirTorneio');
  const labelCurtir = document.getElementById('labelCurtirTorneio');
  const countSpan = document.getElementById('countCurtidasTorneio');

  if (!btnCurtir || !torneioId) return;

  let currentLoggedUser = null;
  const rawUser = localStorage.getItem('vh_loggedUser');
  if (rawUser) {
    try { currentLoggedUser = JSON.parse(rawUser); } catch (e) {}
  }
  if (!currentLoggedUser || !currentLoggedUser.email) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        currentLoggedUser = { email: session.user.email };
      }
    } catch (eAuth) {}
  }

  const userEmail = currentLoggedUser?.email ? currentLoggedUser.email.trim().toLowerCase() : '';

  // 1. Carrega contagem total de curtidas
  try {
    const { count, error } = await supabase
      .from('curtidas')
      .select('*', { count: 'exact', head: true })
      .eq('torneio_id', String(torneioId));

    if (!error && count !== null && countSpan) {
      countSpan.textContent = String(count);
    }
  } catch (errCount) {
    console.error('Erro ao contar curtidas:', errCount);
  }

  // 2. Verifica se o usuário atual já curtiu
  let isLiked = false;
  if (userEmail) {
    try {
      const { data: userLike } = await supabase
        .from('curtidas')
        .select('id')
        .eq('torneio_id', String(torneioId))
        .ilike('user_email', userEmail)
        .maybeSingle();

      if (userLike) {
        isLiked = true;
        btnCurtir.classList.add('liked');
        btnCurtir.style.background = 'rgba(239, 68, 68, 0.28)';
        btnCurtir.style.borderColor = '#ef4444';
        btnCurtir.style.color = '#ffffff';
        if (iconCurtir) iconCurtir.className = 'fa-solid fa-heart';
        if (labelCurtir) labelCurtir.textContent = 'Curtido';
      }
    } catch (errUserLike) {
      console.error('Erro ao verificar curtida do usuário:', errUserLike);
    }
  }

  // 3. Evento de clique para alternar curtida
  btnCurtir.addEventListener('click', async () => {
    if (!userEmail) {
      exibirModalAuthCurtir();
      return;
    }

    btnCurtir.disabled = true;

    try {
      if (isLiked) {
        // Remover curtida
        const { error: delErr } = await supabase
          .from('curtidas')
          .delete()
          .eq('torneio_id', String(torneioId))
          .ilike('user_email', userEmail);

        if (delErr) throw delErr;

        isLiked = false;
        btnCurtir.classList.remove('liked');
        btnCurtir.style.background = 'rgba(239, 68, 68, 0.12)';
        btnCurtir.style.borderColor = 'rgba(239, 68, 68, 0.35)';
        btnCurtir.style.color = '#f87171';
        if (iconCurtir) iconCurtir.className = 'fa-regular fa-heart';
        if (labelCurtir) labelCurtir.textContent = 'Curtir';

        if (countSpan) {
          const currentCount = parseInt(countSpan.textContent || '0', 10);
          countSpan.textContent = String(Math.max(0, currentCount - 1));
        }
      } else {
        // Inserir curtida
        const { error: insErr } = await supabase
          .from('curtidas')
          .insert([{
            torneio_id: String(torneioId),
            user_email: userEmail
          }]);

        if (insErr) throw insErr;

        isLiked = true;
        btnCurtir.classList.add('liked');
        btnCurtir.style.background = 'rgba(239, 68, 68, 0.28)';
        btnCurtir.style.borderColor = '#ef4444';
        btnCurtir.style.color = '#ffffff';
        if (iconCurtir) iconCurtir.className = 'fa-solid fa-heart';
        if (labelCurtir) labelCurtir.textContent = 'Curtido';

        if (countSpan) {
          const currentCount = parseInt(countSpan.textContent || '0', 10);
          countSpan.textContent = String(currentCount + 1);
        }
      }
    } catch (errToggle) {
      console.error('Erro ao alternar curtida no Supabase:', errToggle);
      alert('Ocorreu um erro ao atualizar sua curtida. Tente novamente.');
    } finally {
      btnCurtir.disabled = false;
    }
  });
}

// ==========================================
// MODAL AMIGÁVEL PARA USUÁRIO NÃO LOGADO AO CURTIR
// ==========================================
function exibirModalAuthCurtir() {
  let modal = document.getElementById('vh-auth-curtir-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vh-auth-curtir-modal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(6px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background: #111118; border: 1px solid #28283a; border-radius: 20px; width: 100%; max-width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; text-align: center; animation: modalPop 0.25s ease;">
      <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(20, 20, 28, 0.95) 100%); padding: 32px 24px 22px; border-bottom: 1px solid #232332;">
        <div style="width: 66px; height: 66px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 2px solid #ef4444; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; box-shadow: 0 0 22px rgba(239, 68, 68, 0.45);">
          <i class="fa-solid fa-heart" style="color: #ef4444; font-size: 30px;"></i>
        </div>
        <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0 0 8px 0;">Crie sua conta para favoritar!</h2>
        <p style="color: #9ca3af; font-size: 13.5px; margin: 0; line-height: 1.5;">
          Cadastre-se ou entre no VersusHub para salvar seus torneios favoritos no perfil, acompanhar datas de partidas e receber notificações exclusivas.
        </p>
      </div>
      <div style="padding: 22px; display: flex; flex-direction: column; gap: 11px;">
        <a href="/cadastro/cadastro.html" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14.5px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);">
          <i class="fa-solid fa-user-plus"></i> Criar Conta Gratuitamente
        </a>
        <a href="/login/login.html" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid #2a2a3c; color: #ffffff; padding: 11px 18px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
          <i class="fa-solid fa-right-to-bracket"></i> Já tenho conta / Entrar
        </a>
        <button type="button" id="btnFecharAuthCurtirModal" style="background: transparent; border: none; color: #6b7280; font-size: 13px; margin-top: 4px; cursor: pointer; padding: 4px;">
          Continuar apenas navegando
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const fechar = () => { modal.style.display = 'none'; };
  document.getElementById('btnFecharAuthCurtirModal').onclick = fechar;
  modal.onclick = (e) => { if (e.target === modal) fechar(); };
}
