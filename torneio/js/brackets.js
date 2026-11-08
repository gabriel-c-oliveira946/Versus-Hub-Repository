// /torneio/js/brackets.js
// Sistema de Chaveamento / Brackets com Controle Manual do Organizador,
// Formatos Flexíveis (MD1, MD3, MD5, Direto, Numérico), Partidas Extras e Modo Leitura.

import { supabase, enviarNotificacao } from '/supabaseClient.js';

/**
 * Escapa strings contra XSS
 */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converte valor para número de forma segura
 */
export function safeNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Exibe notificação toast elegante
 */
export function showBracketToast(message, type = 'success') {
  let toast = document.getElementById('bracketToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'bracketToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      z-index: 1000000;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    document.body.appendChild(toast);
  }

  if (type === 'error') {
    toast.style.background = '#1a1012';
    toast.style.color = '#ef4444';
    toast.style.border = '1px solid #ef4444';
    toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${escapeHtml(message)}</span>`;
  } else if (type === 'warning') {
    toast.style.background = '#1a170e';
    toast.style.color = '#fbbf24';
    toast.style.border = '1px solid #fbbf24';
    toast.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${escapeHtml(message)}</span>`;
  } else {
    toast.style.background = '#0e1c16';
    toast.style.color = '#10b981';
    toast.style.border = '1px solid #10b981';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(message)}</span>`;
  }

  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
  }, 4000);
}

/**
 * MODAL DE CONFIRMAÇÃO PERSONALIZADO EM HTML/CSS (Substitui confirm() e alert() do navegador)
 */
export function abrirModalConfirmacaoPartida({
  titulo = 'Excluir Partida',
  mensagem = 'Deseja realmente apagar esta partida?',
  subtexto = 'Esta ação não pode ser desfeita e removerá o confronto da chave.',
  textoConfirmar = 'Sim, Excluir',
  textoCancelar = 'Cancelar',
  icone = 'fa-solid fa-trash-can'
}) {
  return new Promise((resolve) => {
    const anterior = document.getElementById('modalConfirmacaoPartidaOverlay');
    if (anterior) anterior.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalConfirmacaoPartidaOverlay';
    overlay.className = 'modal-confirm-overlay';

    overlay.innerHTML = `
      <div class="modal-confirm-card" role="dialog" aria-modal="true" aria-labelledby="modalConfirmPartidaTitle">
        <button type="button" class="modal-confirm-close-btn" id="btnConfirmPartidaClose" aria-label="Fechar">&times;</button>
        <div class="modal-confirm-icon-box danger">
          <i class="${escapeHtml(icone)}"></i>
        </div>
        <h3 id="modalConfirmPartidaTitle" class="modal-confirm-title">${escapeHtml(titulo)}</h3>
        <div class="modal-confirm-message">
          <p style="margin: 0; font-size: 14px; color: #f3f4f6;">${escapeHtml(mensagem)}</p>
          ${subtexto ? `<div class="modal-confirm-subtext"><i class="fa-solid fa-circle-exclamation"></i><span>${escapeHtml(subtexto)}</span></div>` : ''}
        </div>
        <div class="modal-confirm-actions">
          <button type="button" class="btn-modal-cancel" id="btnConfirmPartidaCancel">${escapeHtml(textoCancelar)}</button>
          <button type="button" class="btn-modal-confirm-danger" id="btnConfirmPartidaOk">
            <i class="fa-solid fa-trash-can"></i> <span>${escapeHtml(textoConfirmar)}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    const btnOk = overlay.querySelector('#btnConfirmPartidaOk');
    const btnCancel = overlay.querySelector('#btnConfirmPartidaCancel');
    const btnClose = overlay.querySelector('#btnConfirmPartidaClose');

    let resolvido = false;

    function fechar(resultado) {
      if (resolvido) return;
      resolvido = true;
      overlay.classList.remove('active');
      document.removeEventListener('keydown', onKeyDown);
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(resultado);
      }, 200);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') fechar(false);
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
      if (e.target === overlay) fechar(false);
    });

    btnOk.addEventListener('click', (e) => {
      e.stopPropagation();
      fechar(true);
    });
  });
}

/**
 * Nomes e Tags das Rodadas (Persistência Local e Sincronização)
 */
export function obterNomesRodadas(torneioId) {
  try {
    const raw = localStorage.getItem(`vh_round_names_${torneioId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function salvarNomeRodada(torneioId, rodadaNum, novoNome) {
  try {
    const mapa = obterNomesRodadas(torneioId);
    if (novoNome && novoNome.trim()) {
      mapa[String(rodadaNum)] = novoNome.trim();
    } else {
      delete mapa[String(rodadaNum)];
    }
    localStorage.setItem(`vh_round_names_${torneioId}`, JSON.stringify(mapa));
  } catch (e) {}
}

/**
 * Busca partidas da tabela public.partidas para um torneio_id com mesclagem de tags de rodada
 */
export async function carregarPartidasTorneio(torneioId) {
  if (!torneioId) return [];

  const roundTitles = obterNomesRodadas(torneioId);
  const cacheLocal = carregarPartidasCacheLocal(torneioId);

  const mesclarComMetaLocal = (lista) => {
    return (lista || []).map(p => {
      const matchLocal = cacheLocal.find(c => String(c.id) === String(p.id));
      const rodadaStr = String(p.rodada || 1);
      const tagSalva = p.nome_rodada || matchLocal?.nome_rodada || roundTitles[rodadaStr] || '';
      if (tagSalva && !roundTitles[rodadaStr]) {
        roundTitles[rodadaStr] = tagSalva;
      }
      return {
        ...p,
        nome_rodada: tagSalva,
        formato: p.formato || matchLocal?.formato || 'numerico',
        detalhes: p.detalhes || matchLocal?.detalhes || ''
      };
    });
  };

  try {
    const { data, error } = await supabase
      .from('partidas')
      .select('*')
      .eq('torneio_id', String(torneioId))
      .order('rodada', { ascending: true })
      .order('numero_partida', { ascending: true });

    if (error) {
      console.warn('Aviso ao consultar partidas do Supabase:', error);
      return mesclarComMetaLocal(cacheLocal);
    }

    if (Array.isArray(data)) {
      const mescladas = mesclarComMetaLocal(data);
      salvarPartidasCacheLocal(torneioId, mescladas);
      return mescladas;
    }

    return mesclarComMetaLocal(cacheLocal);
  } catch (err) {
    console.warn('Erro de rede ao buscar partidas:', err);
    return mesclarComMetaLocal(cacheLocal);
  }
}

export function salvarPartidasCacheLocal(torneioId, partidas) {
  try {
    const all = JSON.parse(localStorage.getItem('vh_partidas') || '{}');
    all[String(torneioId)] = partidas;
    localStorage.setItem('vh_partidas', JSON.stringify(all));
  } catch (e) {}
}

export function carregarPartidasCacheLocal(torneioId) {
  try {
    const all = JSON.parse(localStorage.getItem('vh_partidas') || '{}');
    return all[String(torneioId)] || [];
  } catch (e) {
    return [];
  }
}

/**
 * Remove qualquer tag entre colchetes [TAG], parênteses ou delimitadores do nome da equipe/participante,
 * retornando apenas o nome limpo.
 */
export function removerTagNome(nome) {
  if (!nome || typeof nome !== 'string') return '';
  return nome
    .replace(/\[[^\]]*\]/g, '')  // remove [TAG]
    .replace(/\([^\)]*\)/g, '')  // remove (TAG) caso exista
    .replace(/\s+/g, ' ')
    .trim();
}

if (typeof window !== 'undefined') {
  window.removerTagNome = removerTagNome;
}

/**
 * Busca participantes confirmados para o sorteio ou montagem manual (com nomes limpos sem tags)
 */
export async function buscarParticipantesConfirmados(torneioId) {
  let confirmados = [];

  try {
    const { data, error } = await supabase
      .from('inscricoes')
      .select('*')
      .eq('torneio_id', String(torneioId))
      .eq('status', 'Aceito');

    if (!error && Array.isArray(data)) {
      confirmados = data;
    }
  } catch (err) {
    console.warn('Erro ao consultar inscrições:', err);
  }

  // Mescla com cache local se houver
  try {
    const allLocal = JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
    allLocal
      .filter(i => String(i.torneio_id) === String(torneioId) && i.status === 'Aceito')
      .forEach(li => {
        if (!confirmados.some(c => (c.id && String(c.id) === String(li.id)) || (c.id_participante && String(c.id_participante) === String(li.id_participante)))) {
          confirmados.push(li);
        }
      });
  } catch (e) {}

  // Resolve nomes legíveis para cada participante (apenas nome da equipe, sem tags)
  const listaResolvida = [];
  for (const insc of confirmados) {
    const tipo = (insc.tipo || 'individual').toLowerCase();
    const idPart = insc.id_participante || insc.user_email;
    let nome = idPart || 'Participante';

    let logo = '/image/logo.png';
    let foto = '/image/boneco_logo_ofc.png';
    let resolvedTargetId = idPart;

    if (tipo === 'equipe') {
      try {
        const { data: eq } = await supabase
          .from('equipes')
          .select('id, nome, tag, logo')
          .or(`id.eq.${idPart},nome.eq.${idPart}`)
          .maybeSingle();

        if (eq && eq.nome) {
          nome = removerTagNome(eq.nome);
          if (eq.logo) logo = eq.logo;
          if (eq.id) resolvedTargetId = eq.id;
        } else {
          const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
          const cachedTeams = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
          const f = localTeams.find(t => String(t.id) === String(idPart) || String(t.nome).toLowerCase() === String(idPart).toLowerCase()) ||
                    cachedTeams.find(t => String(t.id) === String(idPart) || String(t.nome).toLowerCase() === String(idPart).toLowerCase());
          if (f && f.nome) {
            nome = removerTagNome(f.nome);
            if (f.logo) logo = f.logo;
            if (f.id) resolvedTargetId = f.id;
          }
        }
      } catch (e) {}
    } else {
      try {
        const { data: usr } = await supabase
          .from('usuarios')
          .select('id, nome, email, avatar')
          .eq('email', idPart)
          .maybeSingle();

        if (usr && usr.nome) {
          nome = usr.nome;
          if (usr.avatar) foto = usr.avatar;
          if (usr.id) resolvedTargetId = usr.id;
        } else {
          const rawLogged = localStorage.getItem('vh_loggedUser');
          if (rawLogged) {
            const lu = JSON.parse(rawLogged);
            if (lu.email === idPart && lu.nome) {
              nome = lu.nome;
              if (lu.avatar) foto = lu.avatar;
              if (lu.id) resolvedTargetId = lu.id;
            }
          }
        }
      } catch (e) {}
    }

    // Garante que qualquer tag residual seja removida do nome
    nome = removerTagNome(nome) || nome;

    // Identificador real do participante: user_email para individuais ou equipe_id para equipes
    const realId = tipo === 'equipe'
      ? String(resolvedTargetId || insc.equipe_id || idPart || insc.id || '').trim()
      : String(insc.user_email || idPart || '').trim();

    listaResolvida.push({
      id: realId,
      realId: realId,
      nome,
      tipo,
      logo: tipo === 'equipe' ? logo : foto,
      foto: tipo === 'equipe' ? logo : foto,
      lineup: insc.lineup || [],
      userEmail: insc.user_email || (tipo !== 'equipe' ? realId : ''),
      user_email: insc.user_email || (tipo !== 'equipe' ? realId : ''),
      equipe_id: tipo === 'equipe' ? realId : (insc.equipe_id || '')
    });
  }

  // Deduplicação Estrita de Participantes Confirmados por ID de Equipe e Nome
  const mapaUnicos = new Map();
  const nomesEquipesVistos = new Set();
  const idsEquipesVistos = new Set();
  const idsUsuariosVistos = new Set();

  for (const part of listaResolvida) {
    if (part.tipo === 'equipe') {
      const eqIdKey = String(part.equipe_id || part.realId || part.id || '').trim().toLowerCase();
      const eqNomeKey = removerTagNome(part.nome || '').trim().toLowerCase();

      if (eqIdKey && idsEquipesVistos.has(eqIdKey)) continue;
      if (eqNomeKey && nomesEquipesVistos.has(eqNomeKey)) continue;

      if (eqIdKey) idsEquipesVistos.add(eqIdKey);
      if (eqNomeKey) nomesEquipesVistos.add(eqNomeKey);
      mapaUnicos.set('eq_' + (eqIdKey || eqNomeKey), part);
    } else {
      const userKey = (part.userEmail || part.user_email || part.realId || part.id || '').trim().toLowerCase();
      if (userKey && idsUsuariosVistos.has(userKey)) continue;
      if (userKey) idsUsuariosVistos.add(userKey);
      mapaUnicos.set('usr_' + userKey, part);
    }
  }

  return Array.from(new Set(mapaUnicos.values()));
}

/**
 * GERA OU ESTRUTURA O CHAVEAMENTO DO TORNEIO (Manual ou Sorteio)
 * @param {string} torneioId
 * @param {Array} participantes - Lista de participantes confirmados
 * @param {Object} opcoes - { modo: 'sorteio' | 'manual', formatoPadrao: 'numerico' }
 */
export async function gerarChaveamentoTorneio(torneioId, participantes, opcoes = {}) {
  const modo = opcoes.modo || 'sorteio';
  const formatoPadrao = opcoes.formatoPadrao || 'numerico';

  const qtdParticipantes = (participantes && participantes.length) ? participantes.length : 2;
  // Próxima potência de 2
  const K = Math.pow(2, Math.ceil(Math.log2(Math.max(2, qtdParticipantes))));
  const totalRodadas = Math.log2(K);

  // Lista ordenada de participantes conforme o modo
  let listaOrdem = [];
  if (modo === 'sorteio') {
    listaOrdem = [...participantes];
    // Fisher-Yates
    for (let i = listaOrdem.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [listaOrdem[i], listaOrdem[j]] = [listaOrdem[j], listaOrdem[i]];
    }
  } else {
    // Modo manual: se informado, posiciona sequencialmente ou deixa 'A definir'
    listaOrdem = [...(participantes || [])];
  }

  // Pré-aloca a estrutura de rodadas e partidas com IDs únicos
  const rodadas = [];
  let contadorPartida = 1;

  for (let r = 1; r <= totalRodadas; r++) {
    const numPartidasNaRodada = K / Math.pow(2, r);
    const partidasDaRodada = [];

    for (let m = 0; m < numPartidasNaRodada; m++) {
      partidasDaRodada.push({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('partida_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
        rodada: r,
        numero_partida: contadorPartida++,
        indexNaRodada: m
      });
    }

    rodadas.push(partidasDaRodada);
  }

  const todasPartidas = [];

  for (let r = 0; r < totalRodadas; r++) {
    const partidasAtuais = rodadas[r];
    const partidasProximaRodada = rodadas[r + 1];

    for (let m = 0; m < partidasAtuais.length; m++) {
      const match = partidasAtuais[m];
      let proximaPartidaId = null;
      let posProx = 1;

      if (partidasProximaRodada) {
        const prox = partidasProximaRodada[Math.floor(m / 2)];
        if (prox) {
          proximaPartidaId = prox.id;
          posProx = (m % 2 === 0) ? 1 : 2;
        }
      }

      let p1_id = '';
      let p1_nome = 'A definir';
      let p2_id = '';
      let p2_nome = 'A definir';

      // Rodada 1 recebe os participantes se houver
      if (r === 0) {
        const p1 = listaOrdem[2 * m];
        const p2 = listaOrdem[2 * m + 1];

        if (p1) {
          p1_id = String(p1.id || '');
          p1_nome = String(p1.nome || 'Participante ' + (2 * m + 1));
        }

        if (p2) {
          p2_id = String(p2.id || '');
          p2_nome = String(p2.nome || 'Participante ' + (2 * m + 2));
        } else if (modo === 'sorteio' && 2 * m < K && 2 * m + 1 >= listaOrdem.length) {
          p2_nome = 'BYE (Avança)';
        }
      }

      todasPartidas.push({
        id: match.id,
        torneio_id: String(torneioId),
        rodada: r + 1,
        numero_partida: match.numero_partida,
        p1_id,
        p1_nome,
        p1_placar: 0,
        p2_id,
        p2_nome,
        p2_placar: 0,
        data_hora: '',
        link_transmissao: '',
        status: 'Pendente',
        vencedor_id: '',
        proxima_partida_id: proximaPartidaId,
        posicao_proxima_partida: posProx,
        formato: formatoPadrao,
        nome_rodada: '',
        is_extra: false
      });
    }
  }

  // 1. Remove confrontos anteriores não-extras deste torneio
  try {
    await supabase
      .from('partidas')
      .delete()
      .eq('torneio_id', String(torneioId))
      .eq('is_extra', false);
  } catch (delErr) {
    console.warn('Aviso ao limpar partidas anteriores:', delErr);
  }

  // 2. Insere todas as novas partidas
  const { data: inseridas, error: insErr } = await supabase
    .from('partidas')
    .insert(todasPartidas)
    .select();

  if (insErr) {
    console.warn('Aviso ao inserir no Supabase (tentando sem novas colunas se necessário):', insErr);
    // Se colunas novas causarem aviso de schema não recarregado, remove chaves opcionais
    const partidasFallback = todasPartidas.map(p => {
      const c = { ...p };
      delete c.formato;
      delete c.nome_rodada;
      delete c.is_extra;
      return c;
    });
    try {
      const { data: retryData } = await supabase.from('partidas').insert(partidasFallback).select();
      salvarPartidasCacheLocal(torneioId, retryData || todasPartidas);
    } catch (eRetry) {
      salvarPartidasCacheLocal(torneioId, todasPartidas);
    }
  } else {
    salvarPartidasCacheLocal(torneioId, inseridas || todasPartidas);
  }

  // 3. Marca chave_gerada = true no torneio
  try {
    await supabase
      .from('torneios')
      .update({ chave_gerada: true })
      .eq('id', String(torneioId));
  } catch (tErr) {}

  try {
    const allLocal = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
    allLocal.forEach(t => {
      if (String(t.id) === String(torneioId)) t.chave_gerada = true;
    });
    localStorage.setItem('vh_createdTournaments', JSON.stringify(allLocal));
  } catch (e) {}

  return todasPartidas;
}

/**
 * CRIA UMA PARTIDA MANUALMENTE NO TORNEIO (Pelo Organizador)
 */
export async function criarPartidaManual({
  torneioId,
  nomeRodada = '',
  p1,
  p2,
  dataHora = '',
  linkTransmissao = '',
  formato = 'md3',
  rodada: rodadaParam = null,
  detalhes = '',
  dataAgendada = ''
}) {
  if (!torneioId) throw new Error('Torneio inválido');

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : ('match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));

  // Obtém número de partidas existentes para incrementar
  const partidasAtuais = await carregarPartidasTorneio(torneioId);
  const maxNum = partidasAtuais.reduce((max, p) => Math.max(max, p.numero_partida || 0), 0);
  const numPartida = maxNum + 1;
  const tituloFinal = (nomeRodada && nomeRodada.trim()) ? nomeRodada.trim() : `Partida ${numPartida}`;

  // Mapeia rodada de acordo com o parâmetro explícito ou nome escolhido
  let rodada = 1;
  if (rodadaParam !== null && rodadaParam !== undefined && Number(rodadaParam) > 0) {
    rodada = Number(rodadaParam);
  } else {
    const nomeLower = (tituloFinal || '').toLowerCase();
    if (nomeLower.includes('3º') || nomeLower.includes('terceiro') || nomeLower.includes('extra')) {
      rodada = 99;
    } else if (nomeLower.includes('final') && !nomeLower.includes('semi') && !nomeLower.includes('quarta') && !nomeLower.includes('oitava')) {
      rodada = 4;
    } else if (nomeLower.includes('semi')) {
      rodada = 3;
    } else if (nomeLower.includes('quarta')) {
      rodada = 2;
    } else if (nomeLower.includes('oitava')) {
      rodada = 1;
    } else {
      rodada = partidasAtuais.length > 0 ? (partidasAtuais[partidasAtuais.length - 1].rodada || 1) : 1;
    }
  }

  const novaPartida = {
    id,
    torneio_id: String(torneioId),
    rodada,
    numero_partida: numPartida,
    p1_id: p1?.id || '',
    p1_nome: removerTagNome(p1?.nome) || 'Competidor 1',
    p1_placar: 0,
    p2_id: p2?.id || '',
    p2_nome: removerTagNome(p2?.nome) || 'Competidor 2',
    p2_placar: 0,
    data_hora: (dataHora || '').trim(),
    data_agendada: (dataAgendada || '').trim(),
    link_transmissao: (linkTransmissao || '').trim(),
    status: 'Pendente',
    vencedor_id: '',
    proxima_partida_id: null,
    posicao_proxima_partida: 1,
    formato: formato || 'md3',
    nome_rodada: tituloFinal,
    detalhes: (detalhes || '').trim(),
    is_extra: rodada === 99
  };

  try {
    const { error } = await supabase
      .from('partidas')
      .insert([novaPartida]);

    if (error) {
      console.warn('Aviso ao inserir partida no Supabase:', error);
      const fallback = { ...novaPartida };
      delete fallback.formato;
      delete fallback.nome_rodada;
      delete fallback.is_extra;
      delete fallback.data_agendada;
      await supabase.from('partidas').insert([fallback]);
    }
  } catch (err) {
    console.warn('Erro de rede ao salvar partida:', err);
  }

  try {
    await supabase.from('torneios').update({ chave_gerada: true }).eq('id', String(torneioId));
  } catch (e) {}

  // Atualiza cache local
  partidasAtuais.push(novaPartida);
  salvarPartidasCacheLocal(torneioId, partidasAtuais);

  await recalcularEAtualizarStatusTorneio(torneioId);

  return novaPartida;
}

export const criarPartidaManualExtra = criarPartidaManual;

/**
  * Recalcula e atualiza automaticamente o status do torneio baseado no estado das partidas
  */
export async function recalcularEAtualizarStatusTorneio(torneioId) {
  if (!torneioId) return;
  try {
    const partidas = await carregarPartidasTorneio(torneioId);
    if (!partidas || partidas.length === 0) return;

    const total = partidas.length;
    const encerradas = partidas.filter(p => p.status === 'Encerrado' || p.status === 'Encerrada');
    const temAoVivo = partidas.some(p => p.status === 'Ao Vivo' || (p.link_transmissao && p.link_transmissao.trim().startsWith('http') && !p.vencedor_id));

    let novoStatus = 'Inscrições abertas';
    let novaStatusClass = 'status-aberto';

    const partidaFinal = partidas.find(p => p.rodada === 4 || (p.nome_rodada && p.nome_rodada.toLowerCase().includes('final')));
    const temVencedorFinal = Boolean(partidaFinal && (partidaFinal.status === 'Encerrado' || partidaFinal.status === 'Encerrada') && partidaFinal.vencedor_id);

    if (encerradas.length === total && temVencedorFinal) {
      novoStatus = 'Encerrado';
      novaStatusClass = 'status-encerrado';
    } else if (temAoVivo) {
      novoStatus = 'Ao Vivo';
      novaStatusClass = 'status-andamento';
    } else if (encerradas.length > 0 || total > 0) {
      novoStatus = 'Em Andamento';
      novaStatusClass = 'status-andamento';
    }

    await supabase.from('torneios').update({
      status: novoStatus,
      statusClass: novaStatusClass
    }).eq('id', String(torneioId));

    if (novoStatus === 'Encerrado') {
      try {
        console.log('[VersusHub Notificações] RecalcularStatus detectou encerramento. Notificando participantes:', torneioId);
        const { data: inscs, error: errInscRecalc } = await supabase
          .from('inscricoes')
          .select('user_email')
          .eq('torneio_id', String(torneioId));

        if (errInscRecalc) {
          console.warn('[VersusHub Notificações] Aviso ao consultar inscrições no recalcularStatus:', errInscRecalc?.message || errInscRecalc);
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
            try {
              const { data: insData, error: insErr } = await supabase.from('notificacoes').insert(notifRecords).select();
              if (insErr) {
                console.warn('[VersusHub Notificações] Aviso ao inserir notificações de encerramento via recalcularStatus:', insErr?.message || insErr);
              }
            } catch (insEx) {
              console.warn('[VersusHub Notificações] Exceção ao inserir notificações:', insEx?.message || insEx);
            }
          }
        }
      } catch (eNotif) {
        console.warn('[VersusHub Notificações] Aviso no disparo de notificações de encerramento via recalcularStatus:', eNotif?.message || eNotif);
      }
    }
    try {
      const created = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
      created.forEach(t => {
        if (String(t.id) === String(torneioId)) {
          t.status = novoStatus;
          t.statusClass = novaStatusClass;
        }
      });
      localStorage.setItem('vh_createdTournaments', JSON.stringify(created));
    } catch (e) {}

    return { status: novoStatus, statusClass: novaStatusClass };
  } catch (err) {
    console.warn('Erro ao recalcular status do torneio:', err);
  }
}

export async function verificarTorneioEncerrado(torneioId, matchObj = null) {
  if (matchObj) {
    if (matchObj.isTorneioEncerrado || matchObj.statusTorneio === 'Encerrado' || matchObj.torneio_status === 'Encerrado' || String(matchObj.status).toLowerCase() === 'encerrado') {
      return true;
    }
  }
  if (!torneioId) return false;
  try {
    const { data } = await supabase.from('torneios').select('status').eq('id', String(torneioId)).maybeSingle();
    if (data && String(data.status).toLowerCase() === 'encerrado') return true;
  } catch (e) {}
  try {
    const created = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
    const found = created.find(t => String(t.id) === String(torneioId));
    if (found && String(found.status).toLowerCase() === 'encerrado') return true;
  } catch (e) {}
  return false;
}

/**
 * EXCLUI UMA PARTIDA E ATUALIZA CACHE LOCAL
 */
export async function excluirPartida(partidaId, torneioId) {
  const cleanId = String(partidaId || '').trim();
  if (!cleanId) {
    console.warn('excluirPartida: Nenhum ID de partida fornecido.');
    return [];
  }

  if (torneioId && (await verificarTorneioEncerrado(torneioId))) {
    showBracketToast('O torneio está encerrado e não permite excluir partidas.', 'error');
    throw new Error('Torneio encerrado (modo leitura).');
  }

  try {
    const { error } = await supabase
      .from('partidas')
      .delete()
      .eq('id', cleanId);
    if (error) {
      console.warn('Aviso ao excluir partida:', error);
    }
  } catch (e) {
    console.warn('Erro ao excluir partida:', e);
  }

  // Remove do cache local imediatamente
  if (torneioId) {
    const partidasAtuais = carregarPartidasCacheLocal(torneioId);
    const filtradas = (partidasAtuais || []).filter(p => String(p.id) !== cleanId);
    salvarPartidasCacheLocal(torneioId, filtradas);
    await recalcularEAtualizarStatusTorneio(torneioId);
    return filtradas;
  }
  return [];
}

export const excluirPartidaExtra = excluirPartida;

/**
 * DESMARCA O VENCEDOR DE UMA PARTIDA E RETORNA AO STATUS PENDENTE
 */
export async function desmarcarVencedor(partida) {
  const matchId = String(partida?.id || '').trim();
  if (!partida || !matchId) {
    console.warn('desmarcarVencedor: Partida sem ID válido.', partida);
    throw new Error('Partida sem ID válido.');
  }

  const tId = partida.torneio_id;
  const tEncerrado = await verificarTorneioEncerrado(tId, partida);
  if (tEncerrado) {
    showBracketToast('O torneio está encerrado e não permite desmarcar vencedores ou alterar partidas.', 'error');
    throw new Error('O torneio está encerrado e em modo somente leitura.');
  }

  const updateData = {
    vencedor_id: null,
    status: 'Pendente'
  };

  try {
    const { error } = await supabase
      .from('partidas')
      .update(updateData)
      .eq('id', matchId);

    if (error) {
      console.warn('Aviso ao desmarcar vencedor:', error);
    }
  } catch (e) {
    console.warn('Erro de rede ao desmarcar vencedor:', e);
  }

  partida.vencedor_id = null;
  partida.status = 'Pendente';

  if (tId) {
    const cache = carregarPartidasCacheLocal(tId);
    const item = cache.find(p => String(p.id) === matchId);
    if (item) {
      item.vencedor_id = null;
      item.status = 'Pendente';
      salvarPartidasCacheLocal(tId, cache);
    }
  }

  return partida;
}

/**
 * DECLARA O VENCEDOR DIRETO DE UMA PARTIDA E AVANÇA DE FASE
 */
export async function declararVencedor({
  partida,
  vencedorSlot // 1 ou 2
}) {
  if (!partida || !partida.id) throw new Error('Partida inválida');
  if (vencedorSlot !== 1 && vencedorSlot !== 2) throw new Error('Slot de vencedor inválido');

  const tId = partida.torneio_id;
  const tEncerrado = await verificarTorneioEncerrado(tId, partida);
  if (tEncerrado) {
    showBracketToast('O torneio está encerrado e não permite declarar vencedores ou alterar partidas.', 'error');
    throw new Error('O torneio está encerrado e em modo somente leitura.');
  }

  const p1_placar = vencedorSlot === 1 ? (partida.p1_placar || 1) : (partida.p1_placar || 0);
  const p2_placar = vencedorSlot === 2 ? (partida.p2_placar || 1) : (partida.p2_placar || 0);

  return await atualizarPlacarPartida({
    partida,
    p1_id: partida.p1_id,
    p1_nome: partida.p1_nome,
    p1_placar,
    p2_id: partida.p2_id,
    p2_nome: partida.p2_nome,
    p2_placar,
    status: 'Encerrado',
    vencedorSlot
  });
}

export async function atualizarPlacarPartida({
  partida,
  p1_id,
  p1_nome,
  p1_placar,
  p2_id,
  p2_nome,
  p2_placar,
  status,
  link_transmissao,
  data_hora,
  data_agendada,
  vencedorSlot, // 1, 2 ou null
  formato = 'numerico',
  nome_rodada = '',
  rodada = undefined,
  detalhes = undefined
}) {
  const partidaId = String(partida?.id || '').trim();
  if (!partidaId) throw new Error('ID da partida não encontrado para atualização.');

  if (partida?.status === 'Encerrado' || partida?.torneio_status === 'Encerrado' || (partida?.torneio_id && await verificarTorneioEncerrado(partida.torneio_id))) {
    showBracketToast('O torneio está encerrado e as partidas estão em modo somente leitura.', 'error');
    throw new Error('Torneio encerrado (modo leitura).');
  }

  const p1Score = parseInt(p1_placar, 10) || 0;
  const p2Score = parseInt(p2_placar, 10) || 0;
  const statusFinal = status || 'Pendente';
  const linkFinal = (link_transmissao || '').trim();

  const finalP1Nome = (p1_nome !== undefined) ? (removerTagNome(p1_nome) || p1_nome) : (removerTagNome(partida.p1_nome) || partida.p1_nome);
  const finalP1Id = (p1_id !== undefined) ? p1_id : partida.p1_id;
  const finalP2Nome = (p2_nome !== undefined) ? (removerTagNome(p2_nome) || p2_nome) : (removerTagNome(partida.p2_nome) || partida.p2_nome);
  const finalP2Id = (p2_id !== undefined) ? p2_id : partida.p2_id;

  let vencedorNome = '';
  let vencedorId = '';

  if (vencedorSlot === 1 || (statusFinal === 'Encerrado' && p1Score > p2Score)) {
    vencedorNome = finalP1Nome;
    vencedorId = finalP1Id || finalP1Nome;
  } else if (vencedorSlot === 2 || (statusFinal === 'Encerrado' && p2Score > p1Score)) {
    vencedorNome = finalP2Nome;
    vencedorId = finalP2Id || finalP2Nome;
  }

  const detalhesFinal = (detalhes !== undefined) ? (detalhes || '').trim() : (partida.detalhes || '').trim();

  const updateAtual = {
    p1_id: finalP1Id,
    p1_nome: finalP1Nome,
    p1_placar: p1Score,
    p2_id: finalP2Id,
    p2_nome: finalP2Nome,
    p2_placar: p2Score,
    status: statusFinal,
    link_transmissao: linkFinal,
    vencedor_id: vencedorId || null,
    detalhes: detalhesFinal,
    formato: formato || 'numerico'
  };

  if (rodada !== undefined && Number(rodada) > 0) {
    updateAtual.rodada = Number(rodada);
    updateAtual.is_extra = (Number(rodada) === 99);
  }

  if (data_hora !== undefined) {
    updateAtual.data_hora = (data_hora || '').trim();
  }

  if (data_agendada !== undefined) {
    updateAtual.data_agendada = (data_agendada || '').trim();
  }

  if (nome_rodada !== undefined) {
    updateAtual.nome_rodada = (nome_rodada || '').trim();
  }

  try {
    const { error: partErr } = await supabase
      .from('partidas')
      .update(updateAtual)
      .eq('id', partidaId);

    if (partErr) {
      console.warn('Aviso ao atualizar partida no Supabase:', partErr);
      // Tenta fallback sem colunas novas se der erro de schema
      const fallback = { ...updateAtual };
      delete fallback.formato;
      delete fallback.nome_rodada;
      delete fallback.data_agendada;
      await supabase.from('partidas').update(fallback).eq('id', partidaId);
    }
  } catch (e) {
    console.warn('Erro de rede ao atualizar partida:', e);
  }

  Object.assign(partida, updateAtual);

  const tId = partida.torneio_id;
  if (tId) {
    const cache = carregarPartidasCacheLocal(tId);
    if (Array.isArray(cache)) {
      const idx = cache.findIndex(p => String(p.id) === partidaId);
      if (idx !== -1) {
        cache[idx] = { ...cache[idx], ...updateAtual };
        salvarPartidasCacheLocal(tId, cache);
      }
    }
    await recalcularEAtualizarStatusTorneio(tId);
  }

  // AVANÇO AUTOMÁTICO SE HOUVER VENCEDOR E PRÓXIMA PARTIDA
  if (vencedorNome && vencedorNome !== 'A definir' && partida.proxima_partida_id) {
    const updateProxima = {};
    if (partida.posicao_proxima_partida === 1) {
      updateProxima.p1_nome = vencedorNome;
      updateProxima.p1_id = vencedorId;
    } else {
      updateProxima.p2_nome = vencedorNome;
      updateProxima.p2_id = vencedorId;
    }

    try {
      await supabase
        .from('partidas')
        .update(updateProxima)
        .eq('id', partida.proxima_partida_id);
    } catch (proxErr) {
      console.warn('Aviso ao avançar vencedor para próxima partida:', proxErr);
    }
  }

  return { vencedorNome, vencedorId };
}

/**
 * Nome legível da rodada (Sem 'Grande Final' automático forçado)
 */
export function getNomeRodada(rodadaNum, totalRodadas, nomeRodadaCustom) {
  if (nomeRodadaCustom && nomeRodadaCustom.trim()) {
    return nomeRodadaCustom.trim();
  }
  return `Rodada ${rodadaNum}`;
}

/**
 * Retorna tag e texto do formato
 */
function getFormatoBadge(formato) {
  const f = (formato || 'numerico').toLowerCase();
  if (f === 'direto') return `<span class="bracket-format-tag tag-direto">Vencedor Direto</span>`;
  if (f === 'md1') return `<span class="bracket-format-tag tag-md1">MD1</span>`;
  if (f === 'md3') return `<span class="bracket-format-tag tag-md3">MD3</span>`;
  if (f === 'md5') return `<span class="bracket-format-tag tag-md5">MD5</span>`;
  return '';
}

/**
 * Verifica se um participante é uma equipe (e não um competidor individual)
 */
export function verificarSeEhEquipe(id, nome, participantesConfirmados = [], isTorneioEquipe = false, isTorneioSolo = false) {
  if (isTorneioSolo) return false;
  if (!nome || nome.toLowerCase() === 'a definir') return false;
  return true;
}

/**
 * CALCULA CAMPEÃO E STATUS DOS PARTICIPANTES (Em Disputa, Eliminado, Campeão)
 */
export function calcularStatusParticipantes(partidas = [], participantesConfirmados = [], isTorneioEncerrado = false, formatoTorneio = 'Mata-Mata (Eliminatória)') {
  const todasPartidas = [...partidas];
  const fmtStr = String(formatoTorneio || '').toLowerCase();
  const isMataMata = !fmtStr.includes('pontos') && !fmtStr.includes('liga');

  // Coleta participantes únicos
  const mapPart = new Map();

  (participantesConfirmados || []).forEach(c => {
    const n = removerTagNome(c.nome || c.equipe_nome || c.user_email || '').trim();
    if (n && n.toLowerCase() !== 'a definir') {
      const key = (c.user_email || n).trim().toLowerCase();
      mapPart.set(key, {
        nome: n,
        email: (c.user_email || '').trim().toLowerCase(),
        wins: 0,
        totalPlacar: 0,
        placarSofrido: 0
      });
    }
  });

  todasPartidas.forEach(p => {
    const p1 = removerTagNome(p.p1_nome || '').trim();
    if (p1 && p1.toLowerCase() !== 'a definir' && !p1.toLowerCase().startsWith('competidor')) {
      const k1 = p1.toLowerCase();
      if (!mapPart.has(k1)) {
        mapPart.set(k1, { nome: p1, email: '', wins: 0, totalPlacar: 0, placarSofrido: 0 });
      }
    }
    const p2 = removerTagNome(p.p2_nome || '').trim();
    if (p2 && p2.toLowerCase() !== 'a definir' && !p2.toLowerCase().startsWith('competidor')) {
      const k2 = p2.toLowerCase();
      if (!mapPart.has(k2)) {
        mapPart.set(k2, { nome: p2, email: '', wins: 0, totalPlacar: 0, placarSofrido: 0 });
      }
    }
  });

  const perdedoresMataMata = new Set();
  let partidaFinal = null;

  todasPartidas.forEach(p => {
    const p1 = removerTagNome(p.p1_nome || '').trim();
    const p2 = removerTagNome(p.p2_nome || '').trim();
    const k1 = p1.toLowerCase();
    const k2 = p2.toLowerCase();
    const sc1 = Number(p.p1_placar) || 0;
    const sc2 = Number(p.p2_placar) || 0;

    let vNome = '';
    let pNome = '';

    if (p.vencedor_id) {
      if (p.vencedor_id === p.p1_id || p.vencedor_id === p.p1_nome) {
        vNome = p1;
        pNome = p2;
      } else if (p.vencedor_id === p.p2_id || p.vencedor_id === p.p2_nome) {
        vNome = p2;
        pNome = p1;
      } else {
        vNome = removerTagNome(p.vencedor_id);
        if (vNome.toLowerCase() === p1.toLowerCase()) pNome = p2;
        else if (vNome.toLowerCase() === p2.toLowerCase()) pNome = p1;
      }
    } else if (p.status === 'Encerrado' || p.status === 'Encerrada') {
      if (sc1 > sc2) { vNome = p1; pNome = p2; }
      else if (sc2 > sc1) { vNome = p2; pNome = p1; }
    }

    // Apenas partidas com vencedor definido computam pontuação e saldo de vitórias
    if (vNome) {
      const entry1 = mapPart.get(k1);
      const entry2 = mapPart.get(k2);
      if (entry1) { entry1.totalPlacar += sc1; entry1.placarSofrido += sc2; }
      if (entry2) { entry2.totalPlacar += sc2; entry2.placarSofrido += sc1; }

      const vKey = vNome.toLowerCase();
      let vEntry = mapPart.get(vKey);
      if (!vEntry) {
        for (const [k, val] of mapPart.entries()) {
          if (val.nome && val.nome.toLowerCase() === vKey) { vEntry = val; break; }
        }
      }
      if (vEntry) vEntry.wins += 1;

      if (pNome && pNome.toLowerCase() !== 'a definir') {
        perdedoresMataMata.add(pNome.toLowerCase());
      }
    }

    if (p.rodada === 4 || (p.nome_rodada && p.nome_rodada.toLowerCase().includes('final') && !p.nome_rodada.toLowerCase().includes('semi') && !p.nome_rodada.toLowerCase().includes('3º'))) {
      partidaFinal = p;
    }
  });

  const partArray = Array.from(mapPart.values());

  // 1. SE O TORNEIO ESTIVER OCORRENDO (NÃO ENCERRADO):
  if (!isTorneioEncerrado) {
    const listaStatus = partArray.map(p => {
      const isElim = isMataMata && perdedoresMataMata.has(p.nome.toLowerCase());
      return {
        nome: p.nome,
        status: isElim ? 'Eliminado' : 'Em Disputa',
        badgeClass: isElim ? 'eliminated' : 'dispute',
        label: isElim ? 'Eliminado' : 'Em Disputa'
      };
    });
    return { campeaoNome: null, coCampeoes: null, podium: null, listaStatus };
  }

  // 2. SE O TORNEIO ESTÁ ENCERRADO:
  // Aplica o critério oficial: 1. Total de Vitórias -> 2. Saldo de Pontos/Placar (totalPlacar - placarSofrido) -> 3. Total de pontos marcados
  partArray.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const saldoB = (b.totalPlacar || 0) - (b.placarSofrido || 0);
    const saldoA = (a.totalPlacar || 0) - (a.placarSofrido || 0);
    if (saldoB !== saldoA) return saldoB - saldoA;
    if (b.totalPlacar !== a.totalPlacar) return b.totalPlacar - a.totalPlacar;
    return a.nome.localeCompare(b.nome);
  });

  // Verifica se há empate perfeito entre os líderes (1º e 2º lugar com vitórias e saldo idênticos)
  const isEmpatePerfeito = Boolean(
    partArray.length >= 2 &&
    partArray[0].wins === partArray[1].wins &&
    ((partArray[0].totalPlacar - partArray[0].placarSofrido) === (partArray[1].totalPlacar - partArray[1].placarSofrido))
  );

  // Se houver final explícita concluída com vencedor definido e NÃO for empate perfeito
  if (partidaFinal && !isEmpatePerfeito) {
    const p1F = removerTagNome(partidaFinal.p1_nome || '');
    const p2F = removerTagNome(partidaFinal.p2_nome || '');
    let winF = '';
    if (partidaFinal.vencedor_id === partidaFinal.p1_id || partidaFinal.vencedor_id === partidaFinal.p1_nome) winF = p1F;
    else if (partidaFinal.vencedor_id === partidaFinal.p2_id || partidaFinal.vencedor_id === partidaFinal.p2_nome) winF = p2F;
    else if ((partidaFinal.p1_placar ?? 0) > (partidaFinal.p2_placar ?? 0)) winF = p1F;
    else if ((partidaFinal.p2_placar ?? 0) > (partidaFinal.p1_placar ?? 0)) winF = p2F;

    if (winF) {
      const loseF = (winF.toLowerCase() === p1F.toLowerCase()) ? p2F : p1F;
      const idxW = partArray.findIndex(p => p.nome.toLowerCase() === winF.toLowerCase());
      const idxL = partArray.findIndex(p => p.nome.toLowerCase() === loseF.toLowerCase());
      if (idxW !== -1 && idxL !== -1) {
        const itemW = partArray.splice(idxW, 1)[0];
        partArray.unshift(itemW);
        const newIdxL = partArray.findIndex(p => p.nome.toLowerCase() === loseF.toLowerCase());
        if (newIdxL > 1) {
          const itemL = partArray.splice(newIdxL, 1)[0];
          partArray.splice(1, 0, itemL);
        }
      }
    }
  }

  // Deduplicação Estrita de Participantes no Pódio/Classificação:
  // Garante que um mesmo participante (por nome normalizado ou e-mail) não apareça mais de uma vez
  const partArrayDeduplicado = [];
  const nomesVistosPodio = new Set();
  partArray.forEach(p => {
    const key = (p.email || p.nome || '').trim().toLowerCase();
    const nomeKey = (p.nome || '').trim().toLowerCase();
    if (!nomesVistosPodio.has(key) && !nomesVistosPodio.has(nomeKey)) {
      nomesVistosPodio.add(key);
      nomesVistosPodio.add(nomeKey);
      partArrayDeduplicado.push(p);
    }
  });
  partArray.length = 0;
  partArray.push(...partArrayDeduplicado);

  // Define os dados estruturados do pódio final
  let campeaoNome = null;
  let coCampeoes = null;
  const podium = {
    isEmpatePerfeito,
    coCampeao1: null,
    coCampeao2: null,
    primeiro: null,
    segundo: null,
    terceiro: null
  };

  if (isEmpatePerfeito) {
    coCampeoes = [partArray[0], partArray[1]];
    podium.coCampeao1 = partArray[0];
    // Garante que o 2º co-campeão seja distinto do 1º
    podium.coCampeao2 = partArray.find((p, idx) => idx > 0 && p.nome !== podium.coCampeao1?.nome) || partArray[1];
    // Garante que o 3º lugar seja distinto de ambos os co-campeões
    podium.terceiro = partArray.find((p, idx) => idx > 1 && p.nome !== podium.coCampeao1?.nome && p.nome !== podium.coCampeao2?.nome) || null;
  } else {
    if (partArray[0]) {
      campeaoNome = partArray[0].nome;
      podium.primeiro = partArray[0];
    }
    // Garante que o 2º lugar seja o próximo participante distinto do 1º lugar
    if (podium.primeiro) {
      podium.segundo = partArray.find(p => p.nome && p.nome.toLowerCase() !== podium.primeiro.nome.toLowerCase()) || null;
    }
    // Garante que o 3º lugar seja o próximo participante distinto do 1º e do 2º lugar
    if (podium.segundo) {
      podium.terceiro = partArray.find(p => p.nome && 
        p.nome.toLowerCase() !== podium.primeiro.nome.toLowerCase() && 
        p.nome.toLowerCase() !== podium.segundo.nome.toLowerCase()
      ) || null;
    }
  }

  const listaStatus = partArray.map((p, idx) => {
    if (isEmpatePerfeito) {
      if (idx === 0 || idx === 1) {
        return {
          nome: p.nome,
          status: 'Co-Campeão',
          badgeClass: 'champion',
          label: 'Co-Campeão (1º Lugar)'
        };
      } else if (idx === 2) {
        return {
          nome: p.nome,
          status: '3º Lugar',
          badgeClass: 'third',
          label: '3º Lugar'
        };
      } else {
        return {
          nome: p.nome,
          status: 'Eliminado',
          badgeClass: 'eliminated',
          label: 'Eliminado'
        };
      }
    } else {
      if (idx === 0) {
        return {
          nome: p.nome,
          status: 'Campeão',
          badgeClass: 'champion',
          label: 'Campeão'
        };
      } else if (idx === 1) {
        return {
          nome: p.nome,
          status: 'Vice-Campeão',
          badgeClass: 'vice',
          label: 'Vice-Campeão'
        };
      } else if (idx === 2) {
        return {
          nome: p.nome,
          status: '3º Lugar',
          badgeClass: 'third',
          label: '3º Lugar'
        };
      } else {
        return {
          nome: p.nome,
          status: 'Eliminado',
          badgeClass: 'eliminated',
          label: 'Eliminado'
        };
      }
    }
  });

  return { campeaoNome, coCampeoes, podium, listaStatus };
}

/**
 * RENDERIZAÇÃO VISUAL DO CHAVEAMENTO / BRACKETS (Com Trava de Leitura e Controles do Organizador)
 */
export function renderizarChaveamentoVisual(container, partidas, opcoes = {}) {
  if (!container) return;
  const {
    permiteEditar = false,
    onEditarPartida = null,
    onCriarPartida = null,
    onCriarPartidaExtra = null,
    onMontarManual = null,
    onAtualizado = null,
    onEncerrarTorneio = null,
    participantesConfirmados = []
  } = opcoes;

  const torneioId = opcoes.torneioId || (partidas[0] ? partidas[0].torneio_id : '');
  const tipoStr = String(opcoes.torneioTipo || '').toLowerCase();
  const isTorneioSolo = Boolean(opcoes.isTorneioSolo || tipoStr.includes('solo') || tipoStr.includes('1v1'));
  const isTorneioEquipe = !isTorneioSolo && Boolean(opcoes.isTorneioEquipe || tipoStr.includes('equipe'));
  const isEncerrado = Boolean(opcoes.isEncerrado || opcoes.statusTorneio === 'Encerrado');
  const acaoCriarPartida = onCriarPartida || onCriarPartidaExtra || (() => {
    abrirModalCriarPartidaManual(torneioId, participantesConfirmados, () => {
      if (typeof onAtualizado === 'function') onAtualizado();
      else {
        const payloadEv = { detail: { torneioId }, bubbles: true };
        document.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
        window.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
      }
    }, { isTorneioSolo, isTorneioEquipe });
  });
  const roundTitles = obterNomesRodadas(torneioId);

  // Separa partidas principais da árvore e partidas extras
  const partidasPrincipais = (partidas || []).filter(p => !p.is_extra && p.rodada !== 99);
  const partidasExtras = (partidas || []).filter(p => p.is_extra || p.rodada === 99);

  const todasPartidasComVencedor = (partidas && partidas.length > 0) && partidas.every(p => {
    return Boolean(
      (p.vencedor_id && String(p.vencedor_id).trim() !== '') ||
      ((p.status === 'Encerrado' || p.status === 'Encerrada') && ((p.p1_placar ?? 0) !== (p.p2_placar ?? 0)))
    );
  });

  // Barra de ferramentas do organizador (APENAS 1 botão principal se permiteEditar for verdadeiro)
  let toolbarHtml = '';
  if (permiteEditar) {
    toolbarHtml = `
      <div class="bracket-organizer-toolbar">
        <div class="bracket-toolbar-left">
          <span style="font-size: 13px; font-weight: 700; color: #f3f4f6; display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sliders" style="color: #6366f1;"></i> Painel de Controle da Chave
          </span>
          <span style="font-size: 11.5px; color: #9ca3af; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 6px;">
            ${partidas.length} ${partidas.length === 1 ? 'partida' : 'partidas'}
          </span>
        </div>
        <div class="bracket-toolbar-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${acaoCriarPartida && !isEncerrado ? `
            <button type="button" class="btn-bracket-criar-partida" id="btnToolbarCriarPartida" title="Criar um novo confronto manualmente">
              <i class="fa-solid fa-plus"></i> Criar Partida
            </button>
          ` : ''}
          <button type="button" id="btnToolbarEncerrarTorneio" ${isEncerrado || !todasPartidasComVencedor ? 'disabled' : ''} style="${isEncerrado ? 'background: #232331; color: #9ca3af; cursor: not-allowed; border: 1px solid #3b3b4f;' : (!todasPartidasComVencedor ? 'background: #1e293b; color: #64748b; cursor: not-allowed; border: 1px solid #334155; opacity: 0.7;' : 'background: #10b981; color: #fff; cursor: pointer; border: none;')} padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;" title="${isEncerrado ? 'Torneio encerrado' : (!todasPartidasComVencedor ? 'O botão só é liberado quando todas as partidas cadastradas tiverem um vencedor definido.' : 'Encerrar torneio e consolidar pontos')}">
            <i class="fa-solid fa-flag-checkered"></i> ${isEncerrado ? 'Torneio Encerrado' : 'Encerrar Torneio e Consolidar Pontos'}
          </button>
        </div>
      </div>
    `;
  }

  // Se não há partidas
  if (!partidas || partidas.length === 0) {
    container.innerHTML = `
      ${toolbarHtml}
      <div class="bracket-empty-box">
        <div class="bracket-empty-icon">
          <i class="fa-solid fa-sitemap"></i>
        </div>
        <h3 class="bracket-empty-title">Nenhuma partida criada</h3>
        <p class="bracket-empty-desc">
          ${permiteEditar
            ? 'Você tem controle total: crie confrontos manualmente selecionando os competidores, rodada, data e transmissão ao vivo.'
            : 'O chaveamento deste torneio ainda não possui partidas cadastradas pelo organizador. Assim que forem criadas, a tabela oficial aparecerá aqui.'}
        </p>
        ${permiteEditar ? `
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 14px;">
            ${acaoCriarPartida && !isEncerrado ? `
              <button type="button" class="btn-bracket-criar-partida" id="btnEmptyCriarPartida" style="padding: 10px 22px; font-size: 14px;">
                <i class="fa-solid fa-plus"></i> Criar Partida
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    if (permiteEditar) {
      const bCriar = container.querySelector('#btnEmptyCriarPartida') || container.querySelector('#btnToolbarCriarPartida');
      if (bCriar && acaoCriarPartida && !isEncerrado) bCriar.addEventListener('click', acaoCriarPartida);

      const bEnc = container.querySelector('#btnToolbarEncerrarTorneio');
      if (bEnc && !isEncerrado) {
        bEnc.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof onEncerrarTorneio === 'function') {
            onEncerrarTorneio();
          } else {
            abrirModalConfirmacaoEncerramentoTorneio({
              torneioId,
              onConcluido: () => {
                if (typeof onAtualizado === 'function') onAtualizado();
                else window.location.reload();
              }
            });
          }
        });
      }
    }
    return;
  }

  // Ordena todas as partidas sequencialmente em uma lista única vertical
  const todasPartidasOrdenadas = [...partidas].sort((a, b) => {
    const numA = (a.numero_partida && Number(a.numero_partida) > 0) ? Number(a.numero_partida) : ((a.rodada || 1) * 100);
    const numB = (b.numero_partida && Number(b.numero_partida) > 0) ? Number(b.numero_partida) : ((b.rodada || 1) * 100);
    return numA - numB;
  });

  const formatoTorneio = opcoes.formatoTorneio || opcoes.formato || 'Mata-Mata (Eliminatória)';

  // Calcula Campeão, Pódio Completo e Status dos Participantes
  const { campeaoNome, coCampeoes, podium, listaStatus } = calcularStatusParticipantes(todasPartidasOrdenadas, participantesConfirmados, isEncerrado, formatoTorneio);

  let htmlTree = `${toolbarHtml}<div class="bracket-vertical-list">`;

  // 1. PAINEL DE PÓDIO COMPLETO DOS VENCEDORES (Topo da Página) - Exibido quando o torneio estiver oficialmente encerrado
  if (isEncerrado && podium) {
    if (podium.isEmpatePerfeito && podium.coCampeao1 && podium.coCampeao2) {
      // Caso de Empate Perfeito (Co-Campeões)
      htmlTree += `
        <div class="podium-panel-container">
          <div class="podium-panel-header">
            <div class="podium-title-badge">
              <i class="fa-solid fa-trophy"></i> Resultado Oficial do Torneio
            </div>
            <h3 class="podium-main-title">Co-Campeões (1º Lugar Empatado): ${escapeHtml(podium.coCampeao1.nome)} e ${escapeHtml(podium.coCampeao2.nome)}</h3>
            <p class="podium-main-subtitle">Houve igualdade perfeita em vitórias e saldo de pontos entre os líderes. Bônus dividido igualmente.</p>
          </div>
          <div class="podium-columns-grid">
            <!-- Co-Campeão 1 -->
            <div class="podium-card co-first-place">
              <div class="podium-rank-tag">
                <i class="fa-solid fa-crown"></i> 1º Lugar · Co-Campeão
              </div>
              <h4 class="podium-winner-name">${escapeHtml(podium.coCampeao1.nome)}</h4>
              <div class="podium-winner-stats">
                <span>Vitórias: <strong>${podium.coCampeao1.wins || 0}</strong></span>
                <span>Saldo: <strong>${(podium.coCampeao1.totalPlacar || 0) - (podium.coCampeao1.placarSofrido || 0)}</strong></span>
                <span>Bônus: <strong>+375 pts</strong></span>
              </div>
            </div>

            <!-- Co-Campeão 2 -->
            <div class="podium-card co-first-place">
              <div class="podium-rank-tag">
                <i class="fa-solid fa-crown"></i> 1º Lugar · Co-Campeão
              </div>
              <h4 class="podium-winner-name">${escapeHtml(podium.coCampeao2.nome)}</h4>
              <div class="podium-winner-stats">
                <span>Vitórias: <strong>${podium.coCampeao2.wins || 0}</strong></span>
                <span>Saldo: <strong>${(podium.coCampeao2.totalPlacar || 0) - (podium.coCampeao2.placarSofrido || 0)}</strong></span>
                <span>Bônus: <strong>+375 pts</strong></span>
              </div>
            </div>

            ${podium.terceiro ? `
              <!-- 3º Lugar -->
              <div class="podium-card third-place">
                <div class="podium-rank-tag">
                  <i class="fa-solid fa-medal"></i> 3º Lugar
                </div>
                <h4 class="podium-winner-name">${escapeHtml(podium.terceiro.nome)}</h4>
                <div class="podium-winner-stats">
                  <span>Vitórias: <strong>${podium.terceiro.wins || 0}</strong></span>
                  <span>Saldo: <strong>${(podium.terceiro.totalPlacar || 0) - (podium.terceiro.placarSofrido || 0)}</strong></span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (podium.primeiro) {
      // Pódio Padrão com 1º, 2º e 3º Lugar
      htmlTree += `
        <div class="podium-panel-container">
          <div class="podium-panel-header">
            <div class="podium-title-badge">
              <i class="fa-solid fa-trophy"></i> Painel de Pódio Oficial
            </div>
            <h3 class="podium-main-title">Grande Campeão do Torneio: ${escapeHtml(podium.primeiro.nome)}</h3>
            <p class="podium-main-subtitle">Classificação final consolidada com pontuação computada no ranking geral.</p>
          </div>
          <div class="podium-columns-grid">
            ${podium.segundo ? `
              <!-- 2º Lugar (Vice-Campeão - Esquerda) -->
              <div class="podium-card second-place">
                <div class="podium-rank-tag">
                  <i class="fa-solid fa-award"></i> 2º Lugar · Vice-Campeão
                </div>
                <h4 class="podium-winner-name">${escapeHtml(podium.segundo.nome)}</h4>
                <div class="podium-winner-stats">
                  <span>Vitórias: <strong>${podium.segundo.wins || 0}</strong></span>
                  <span>Saldo: <strong>${(podium.segundo.totalPlacar || 0) - (podium.segundo.placarSofrido || 0)}</strong></span>
                  <span>Bônus: <strong>+250 pts</strong></span>
                </div>
              </div>
            ` : ''}
            <!-- 1º Lugar (Campeão - Centro Destaque) -->
            <div class="podium-card first-place">
              <div class="podium-rank-tag">
                <i class="fa-solid fa-crown"></i> 1º Lugar · Campeão
              </div>
              <h4 class="podium-winner-name">${escapeHtml(podium.primeiro.nome)}</h4>
              <div class="podium-winner-stats">
                <span>Vitórias: <strong>${podium.primeiro.wins || 0}</strong></span>
                <span>Saldo: <strong>${(podium.primeiro.totalPlacar || 0) - (podium.primeiro.placarSofrido || 0)}</strong></span>
                <span>Bônus: <strong>+500 pts</strong></span>
              </div>
            </div>
            ${podium.terceiro ? `
              <!-- 3º Lugar -->
              <div class="podium-card third-place">
                <div class="podium-rank-tag">
                  <i class="fa-solid fa-medal"></i> 3º Lugar
                </div>
                <h4 class="podium-winner-name">${escapeHtml(podium.terceiro.nome)}</h4>
                <div class="podium-winner-stats">
                  <span>Vitórias: <strong>${podium.terceiro.wins || 0}</strong></span>
                  <span>Saldo: <strong>${(podium.terceiro.totalPlacar || 0) - (podium.terceiro.placarSofrido || 0)}</strong></span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  }

  // 2. Área de Status dos Participantes & Classificação
  if (listaStatus && listaStatus.length > 0) {
    htmlTree += `
      <div class="bracket-participants-status-section" style="margin-bottom: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <h3 style="font-size: 14px; font-weight: 700; color: #f3f4f6; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-ranking-star" style="color: #6366f1;"></i> Status dos Participantes & Classificação
          </h3>
          <span style="font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 6px;">
            ${listaStatus.length} Competidor(es)
          </span>
        </div>
        <div class="participant-status-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
          ${listaStatus.map(p => `
            <div class="participant-status-card status-${p.badgeClass}" style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px;" title="${escapeHtml(p.nome)}">
                ${escapeHtml(p.nome)}
              </span>
              <span class="participant-badge-tag tag-${p.badgeClass}">
                ${p.label}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Renderiza todas as partidas na lista vertical empilhada
  const podeEditarCards = permiteEditar && !isEncerrado;
  todasPartidasOrdenadas.forEach((p, idx) => {
    htmlTree += renderMatchCardHtml(p, podeEditarCards, p.is_extra || p.rodada === 99, participantesConfirmados, isTorneioEquipe, isTorneioSolo, idx, isEncerrado);
  });

  htmlTree += '</div>';
  container.innerHTML = htmlTree;

  // Vincula cliques da toolbar
  if (permiteEditar) {
    const acaoCriarPartida = onCriarPartida || onCriarPartidaExtra;
    const bCriar = container.querySelector('#btnToolbarCriarPartida');
    if (bCriar && acaoCriarPartida) bCriar.addEventListener('click', acaoCriarPartida);

    const bEnc = container.querySelector('#btnToolbarEncerrarTorneio');
    if (bEnc && !isEncerrado) {
      bEnc.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof onEncerrarTorneio === 'function') {
          onEncerrarTorneio();
        } else {
          abrirModalConfirmacaoEncerramentoTorneio({
            torneioId,
            onConcluido: () => {
              if (typeof onAtualizado === 'function') onAtualizado();
              else window.location.reload();
            }
          });
        }
      });
    }
  }

  // Eventos nos cards de partidas
  container.querySelectorAll('.bracket-match-card').forEach(card => {
    const matchId = String(card.getAttribute('data-match-id') || card.getAttribute('data-id') || '').trim();
    const matchObj = partidas.find(p => String(p.id) === matchId);
    if (!matchObj || !matchId) return;

    // Clique no corpo do card abre modal de escalação do confronto / integrantes
    card.addEventListener('click', (e) => {
      // Ignora se o clique foi em um botão/link interativo
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) {
        return;
      }
      abrirModalIntegrantesPartida({
        partida: matchObj,
        torneioId,
        participantesConfirmados,
        isTorneioSolo
      });
    });

    // Botão Excluir Partida (Lixeira / Confirmação via Modal HTML/CSS)
    card.querySelectorAll('.btn-card-delete-match').forEach(btnDel => {
      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetId = String(btnDel.getAttribute('data-id') || btnDel.getAttribute('data-match-id') || matchId || '').trim();
        if (!targetId) {
          console.warn('Nenhum ID de partida encontrado para exclusão.');
          showBracketToast('ID da partida não encontrado.', 'error');
          return;
        }

        const nomeTitulo = matchObj.nome_rodada || `Partida #${matchObj.numero_partida || ''}`;
        const conf = await abrirModalConfirmacaoPartida({
          titulo: 'Excluir Partida',
          mensagem: `Deseja realmente apagar esta partida (${nomeTitulo})?`,
          subtexto: 'Esta ação não pode ser desfeita e removerá o confronto da lista oficial.',
          textoConfirmar: 'Sim, Excluir',
          textoCancelar: 'Cancelar'
        });
        if (!conf) return;

        btnDel.disabled = true;
        try {
          await excluirPartida(targetId, matchObj.torneio_id || torneioId);
          showBracketToast('Partida excluída com sucesso!');
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          card.style.transition = 'all 0.2s ease';
          setTimeout(() => {
            if (card.parentNode) card.parentNode.removeChild(card);
            if (typeof onAtualizado === 'function') onAtualizado();
            document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: targetId } }));
          }, 200);
        } catch (err) {
          console.warn('Erro ao excluir partida:', err);
          showBracketToast('Erro ao excluir partida.', 'error');
          btnDel.disabled = false;
        }
      });
    });

    // Botão Desmarcar Vencedor
    card.querySelectorAll('.btn-card-unmark-winner').forEach(btnUnmark => {
      btnUnmark.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetId = String(btnUnmark.getAttribute('data-id') || btnUnmark.getAttribute('data-match-id') || matchId || '').trim();
        if (!targetId) return;

        btnUnmark.disabled = true;
        btnUnmark.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        try {
          await desmarcarVencedor(matchObj);
          showBracketToast('Vencedor desmarcado. Partida retornada para Pendente.');
          if (typeof onAtualizado === 'function') {
            onAtualizado();
          } else {
            document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: targetId } }));
          }
        } catch (err) {
          console.warn('Erro ao desmarcar vencedor:', err);
          showBracketToast('Falha ao desmarcar vencedor.', 'error');
          btnUnmark.disabled = false;
          btnUnmark.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Desmarcar`;
        }
      });
    });

    // Botão rápido Marcar Vencedor
    card.querySelectorAll('.btn-slot-declarar-vencedor').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetId = String(btn.getAttribute('data-id') || matchId || '').trim();
        if (!targetId) return;
        const slot = parseInt(btn.getAttribute('data-slot'), 10);
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>`;
        try {
          const res = await declararVencedor({ partida: matchObj, vencedorSlot: slot });
          showBracketToast(`${res.vencedorNome} marcado como vencedor!`);
          if (typeof onAtualizado === 'function') {
            onAtualizado(res);
          } else {
            document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: targetId } }));
          }
        } catch (err) {
          console.warn('Aviso ao declarar vencedor:', err);
          showBracketToast(err?.message || 'Falha ao marcar vencedor.', 'error');
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-trophy"></i> <span>Marcar Vencedor</span>`;
        }
      });
    });

    // Botão Editar Confronto / Renomear Título
    card.querySelectorAll('.btn-card-edit-score, .btn-card-quick-rename, .match-custom-title.title-editable').forEach(btnEdit => {
      btnEdit.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isEncerrado || (await verificarTorneioEncerrado(torneioId, matchObj))) {
          showBracketToast('O torneio está encerrado e as partidas estão em modo somente leitura.', 'error');
          return;
        }
        const targetId = String(btnEdit.getAttribute('data-id') || matchId || '').trim();
        if (!targetId) {
          console.warn('Nenhum ID de partida encontrado para edição.');
          showBracketToast('ID da partida não encontrado.', 'error');
          return;
        }
        if (typeof onEditarPartida === 'function') {
          onEditarPartida(matchObj);
        } else {
          abrirModalEditarPartida(matchObj, participantesConfirmados, onAtualizado);
        }
      });
    });

    // Clique na Equipe / Ícone de Escalação
    card.querySelectorAll('.slot-team-clickable, .btn-slot-view-roster').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentSlot = trigger.closest('.slot-team-info') || trigger;
        const tId = parentSlot.getAttribute('data-team-id') || '';
        const tName = parentSlot.getAttribute('data-team-name') || '';
        if (!tName || tName.toLowerCase() === 'a definir') return;

        abrirModalIntegrantesEquipe({
          torneioId: torneioId,
          participanteId: tId,
          participanteNome: tName,
          participantesConfirmados,
          isTorneioSolo
        });
      });
    });
  });
}

function formatarDataAgendadaDisplay(val) {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  try {
    const parts = trimmed.split('T');
    if (parts.length === 2) {
      const [y, m, d] = parts[0].split('-');
      const [hh, mm] = parts[1].split(':');
      if (y && m && d && hh && mm) {
        return `Agendado para: ${d}/${m} às ${hh}:${mm}`;
      }
    }
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      return `Agendado para: ${d}/${m} às ${hh}:${mm}`;
    }
  } catch (e) {}
  return `Agendado para: ${trimmed}`;
}

export function extrairDataHoraAberturaIso(tObj) {
  if (!tObj) return '';
  const iso = tObj.inicioIso || tObj.inicio_iso || tObj.inicio_data_hora || '';
  if (iso && typeof iso === 'string') {
    const s = iso.trim().replace(' ', 'T');
    if (s.length >= 16) return s.slice(0, 16);
  }
  if (tObj.inicioData && tObj.inicioHora) {
    return `${tObj.inicioData}T${tObj.inicioHora}`.slice(0, 16);
  }
  if (tObj.data && typeof tObj.data === 'string') {
    const dStr = tObj.data.trim();
    if (dStr.includes('T')) {
      return dStr.slice(0, 16);
    }
    if (dStr.includes(' ')) {
      const parts = dStr.split(/\s+/);
      if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
        return `${parts[0]}T${parts[1].slice(0, 5)}`;
      }
    }
    const mIso = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) {
      const hh = tObj.hora ? String(tObj.hora).slice(0, 5) : '20:00';
      return `${mIso[0]}T${hh}`;
    }
    const mData = dStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const mHora = dStr.match(/(\d{1,2})[h:](\d{2})?/i);
    if (mData) {
      const dia = String(mData[1]).padStart(2, '0');
      const mes = String(mData[2]).padStart(2, '0');
      const ano = mData[3];
      const hh = mHora ? String(mHora[1]).padStart(2, '0') : '20';
      const mm = (mHora && mHora[2]) ? String(mHora[2]).padStart(2, '0') : '00';
      return `${ano}-${mes}-${dia}T${hh}:${mm}`;
    }
  }
  return '';
}

/**
 * Renderiza o HTML individual de um card de partida em lista empilhada
 */
function renderMatchCardHtml(p, permiteEditar = false, isExtra = false, participantesConfirmados = [], isTorneioEquipe = false, isTorneioSolo = false, numeroIndex = 0, isTorneioEncerrado = false) {
  const isMatchEncerrado = p.status === 'Encerrado';
  const lockMatch = isMatchEncerrado || isTorneioEncerrado || Boolean(p.isTorneioEncerrado || p.torneio_status === 'Encerrado');
  if (lockMatch) {
    permiteEditar = false;
  }

  const isLive = p.status === 'Ao Vivo';
  const isEncerrado = isMatchEncerrado;

  const p1Clean = removerTagNome(p.p1_nome) || 'A definir';
  const p2Clean = removerTagNome(p.p2_nome) || 'A definir';

  const p1IsTeam = isTorneioSolo ? false : verificarSeEhEquipe(p.p1_id, p1Clean, participantesConfirmados, isTorneioEquipe, isTorneioSolo);
  const p2IsTeam = isTorneioSolo ? false : verificarSeEhEquipe(p.p2_id, p2Clean, participantesConfirmados, isTorneioEquipe, isTorneioSolo);

  const part1 = (participantesConfirmados || []).find(c =>
    (p.p1_id && (String(c.id) === String(p.p1_id) || String(c.realId) === String(p.p1_id) || String(c.equipe_id) === String(p.p1_id))) ||
    (p1Clean && p1Clean !== 'A definir' && c.nome && removerTagNome(c.nome).toLowerCase() === p1Clean.toLowerCase())
  );
  const logo1 = part1?.logo || part1?.foto || p.p1_logo || (p1IsTeam ? '/image/logo.png' : '');

  const part2 = (participantesConfirmados || []).find(c =>
    (p.p2_id && (String(c.id) === String(p.p2_id) || String(c.realId) === String(p.p2_id) || String(c.equipe_id) === String(p.p2_id))) ||
    (p2Clean && p2Clean !== 'A definir' && c.nome && removerTagNome(c.nome).toLowerCase() === p2Clean.toLowerCase())
  );
  const logo2 = part2?.logo || part2?.foto || p.p2_logo || (p2IsTeam ? '/image/logo.png' : '');

  let vencedorNome = '';
  if (isEncerrado) {
    if (p.vencedor_id) {
      if (p.vencedor_id === p.p1_id || p.vencedor_id === p.p1_nome) vencedorNome = p1Clean;
      else if (p.vencedor_id === p.p2_id || p.vencedor_id === p.p2_nome) vencedorNome = p2Clean;
      else vencedorNome = removerTagNome(p.vencedor_id);
    }
    if (!vencedorNome) {
      if ((p.p1_placar ?? 0) > (p.p2_placar ?? 0)) vencedorNome = p1Clean;
      else if ((p.p2_placar ?? 0) > (p.p1_placar ?? 0)) vencedorNome = p2Clean;
    }
  }

  const p1Venceu = isEncerrado && vencedorNome && (vencedorNome.toLowerCase() === p1Clean.toLowerCase());
  const p2Venceu = isEncerrado && vencedorNome && (vencedorNome.toLowerCase() === p2Clean.toLowerCase());

  let statusBadge = `<span class="bracket-status-tag pending"><i class="fa-regular fa-clock"></i> Pendente</span>`;
  if (isLive) {
    statusBadge = `<span class="bracket-status-tag live"><span class="bracket-live-dot"></span> AO VIVO</span>`;
  } else if (isEncerrado) {
    statusBadge = `<span class="bracket-status-tag finished"><i class="fa-solid fa-check"></i> Encerrado</span>`;
  }

  const formatoBadge = getFormatoBadge(p.formato);
  const temTransmissao = p.link_transmissao && (p.link_transmissao.startsWith('http://') || p.link_transmissao.startsWith('https://'));
  const isFormatoDireto = p.formato === 'direto';

  const numeroFixo = (p.numero_partida && Number(p.numero_partida) > 0) ? Number(p.numero_partida) : (numeroIndex + 1);
  const tituloPersonalizado = (p.nome_rodada && p.nome_rodada.trim()) ? p.nome_rodada.trim() : `Partida ${numeroFixo}`;

  return `
    <div class="bracket-match-card ${isLive ? 'match-live-pulse' : ''} ${permiteEditar ? 'clickable-match' : ''}" data-match-id="${p.id}" data-id="${p.id}">
      <!-- Cabeçalho do Card: Tag Informativa Fixa + Título Personalizável Lado a Lado -->
      <div class="bracket-match-card-header">
        <div class="match-header-left">
          <!-- 2. Tag Informativa Fixa (Numeração) -->
          <span class="match-fixed-number-badge" title="Número sequencial fixo da partida">
            <i class="fa-solid fa-hashtag"></i> Partida ${numeroFixo}
          </span>
          <!-- 1. Título Personalizável -->
          <div class="match-custom-title-wrap">
            <span class="match-custom-title ${permiteEditar ? 'title-editable' : ''}" data-id="${p.id}" title="${permiteEditar ? 'Clique para alterar o título deste confronto' : 'Título da partida'}">
              ${escapeHtml(tituloPersonalizado)}
            </span>
            ${permiteEditar ? `
              <button type="button" class="btn-card-quick-rename" data-id="${p.id}" title="Editar título da partida">
                <i class="fa-solid fa-pen"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <div class="match-header-right">
          ${p.data_agendada && p.data_agendada.trim() ? `
            <span class="match-time-badge scheduled-date-badge" style="font-size: 11px; font-weight: 600; color: #a5b4fc; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.25); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" title="${escapeHtml(formatarDataAgendadaDisplay(p.data_agendada))}">
              <i class="fa-regular fa-calendar-days" style="color: #818cf8;"></i> ${escapeHtml(formatarDataAgendadaDisplay(p.data_agendada))}
            </span>
          ` : (p.data_hora ? `
            <span class="match-time-badge" title="Data/Horário da partida">
              <i class="fa-regular fa-clock"></i> ${escapeHtml(p.data_hora)}
            </span>
          ` : '')}
          ${formatoBadge}
          ${statusBadge}
          ${permiteEditar ? `
            <button type="button" class="btn-card-delete-match" data-id="${p.id}" data-match-id="${p.id}" title="Excluir esta partida" onclick="event.stopPropagation();">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Corpo do Card / Slots dos Competidores -->
      <div class="bracket-slots-group">
        <!-- Competidor 1 -->
        <div class="bracket-slot ${p1Venceu ? 'slot-winner' : ''} ${isEncerrado && !p1Venceu && p2Venceu ? 'slot-loser' : ''}">
          <div class="slot-team-info ${p1IsTeam ? 'slot-team-clickable' : ''}" data-team-id="${escapeHtml(p.p1_id || '')}" data-team-name="${escapeHtml(p1Clean)}" data-match-id="${p.id}" data-slot="1" ${p1IsTeam ? 'title="Ver integrantes da equipe"' : ''}>
            ${(p1Clean !== 'A definir' && logo1) ? `
              <img referrerpolicy="no-referrer" src="${escapeHtml(logo1)}" alt="${escapeHtml(p1Clean)}" class="slot-team-logo" style="width: 22px; height: 22px; border-radius: 4px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15);" onerror="this.src='/image/logo.png';" />
            ` : ''}
            <span class="slot-team-name ${p1Venceu ? 'winner-text' : ''}">
              ${p1Venceu ? '<i class="fa-solid fa-trophy slot-trophy-icon" style="color: #10b981;"></i>' : ''}
              ${escapeHtml(p1Clean)}
            </span>
            ${p1Clean !== 'A definir' ? `
              <button type="button" class="btn-slot-view-roster" data-team-id="${escapeHtml(p.p1_id || '')}" data-team-name="${escapeHtml(p1Clean)}" data-match-id="${p.id}" data-slot="1" title="Ver integrantes da equipe" onclick="event.stopPropagation();">
                <i class="fa-solid fa-users"></i>
              </button>
            ` : ''}
          </div>
          <div class="slot-score-action-box">
            <span class="slot-score ${p1Venceu ? 'score-winner' : ''}">
              ${isFormatoDireto ? (p1Venceu ? 'V' : '-') : (p.p1_placar ?? 0)}
            </span>
            ${permiteEditar ? `
              <button type="button" class="btn-slot-declarar-vencedor ${p1Venceu ? 'is-winner' : ''}" data-id="${p.id}" data-slot="1" title="Declarar ${escapeHtml(p1Clean)} vencedor" onclick="event.stopPropagation();">
                <i class="fa-solid fa-trophy"></i>
                <span>${p1Venceu ? 'Venceu' : 'Marcar Vencedor'}</span>
              </button>
            ` : ''}
          </div>
        </div>

        <div class="bracket-match-divider-vs">
          <span>VS</span>
        </div>

        <!-- Competidor 2 -->
        <div class="bracket-slot ${p2Venceu ? 'slot-winner' : ''} ${isEncerrado && !p2Venceu && p1Venceu ? 'slot-loser' : ''}">
          <div class="slot-team-info ${p2IsTeam ? 'slot-team-clickable' : ''}" data-team-id="${escapeHtml(p.p2_id || '')}" data-team-name="${escapeHtml(p2Clean)}" data-match-id="${p.id}" data-slot="2" ${p2IsTeam ? 'title="Ver integrantes da equipe"' : ''}>
            ${(p2Clean !== 'A definir' && logo2) ? `
              <img referrerpolicy="no-referrer" src="${escapeHtml(logo2)}" alt="${escapeHtml(p2Clean)}" class="slot-team-logo" style="width: 22px; height: 22px; border-radius: 4px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15);" onerror="this.src='/image/logo.png';" />
            ` : ''}
            <span class="slot-team-name ${p2Venceu ? 'winner-text' : ''}">
              ${p2Venceu ? '<i class="fa-solid fa-trophy slot-trophy-icon" style="color: #10b981;"></i>' : ''}
              ${escapeHtml(p2Clean)}
            </span>
            ${p2Clean !== 'A definir' ? `
              <button type="button" class="btn-slot-view-roster" data-team-id="${escapeHtml(p.p2_id || '')}" data-team-name="${escapeHtml(p2Clean)}" data-match-id="${p.id}" data-slot="2" title="Ver integrantes da equipe" onclick="event.stopPropagation();">
                <i class="fa-solid fa-users"></i>
              </button>
            ` : ''}
          </div>
          <div class="slot-score-action-box">
            <span class="slot-score ${p2Venceu ? 'score-winner' : ''}">
              ${isFormatoDireto ? (p2Venceu ? 'V' : '-') : (p.p2_placar ?? 0)}
            </span>
            ${permiteEditar ? `
              <button type="button" class="btn-slot-declarar-vencedor ${p2Venceu ? 'is-winner' : ''}" data-id="${p.id}" data-slot="2" title="Declarar ${escapeHtml(p2Clean)} vencedor" onclick="event.stopPropagation();">
                <i class="fa-solid fa-trophy"></i>
                <span>${p2Venceu ? 'Venceu' : 'Marcar Vencedor'}</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Badge / Banner Destacado com o Vencedor -->
      ${(vencedorNome && isEncerrado) ? `
        <div class="bracket-winner-highlight-banner">
          <div class="winner-banner-left">
            <i class="fa-solid fa-crown"></i>
            <div>
              <span class="winner-banner-title">Vencedor:</span>
              <span class="winner-banner-name">${escapeHtml(vencedorNome)}</span>
            </div>
          </div>
          ${permiteEditar ? `
            <button type="button" class="btn-card-unmark-winner" data-id="${p.id}" data-match-id="${p.id}" title="Desmarcar vencedor (voltar para Pendente)" onclick="event.stopPropagation();">
              <i class="fa-solid fa-rotate-left"></i> Desmarcar
            </button>
          ` : ''}
        </div>
      ` : ''}

      <!-- Rodapé do Card: Detalhes Opcionais, Live e Ações do Organizador -->
      <div class="bracket-match-footer">
        <div class="match-footer-left">
          ${p.detalhes && p.detalhes.trim() ? `
            <div class="match-footer-details" title="Detalhes e Observações">
              <i class="fa-solid fa-circle-info"></i>
              <span>${escapeHtml(p.detalhes.trim())}</span>
            </div>
          ` : ''}
        </div>

        <div class="match-footer-right">
          ${temTransmissao ? `
            <a href="${escapeHtml(p.link_transmissao)}" target="_blank" rel="noopener noreferrer" class="bracket-live-btn" title="Assistir transmissão ao vivo" onclick="event.stopPropagation();">
              <i class="fa-solid fa-tower-broadcast"></i> <span>Assistir Transmissão Ao Vivo</span>
            </a>
          ` : ''}

          ${permiteEditar ? `
            <button type="button" class="btn-card-edit-score" data-id="${p.id}" data-match-id="${p.id}" title="Gerenciar participantes, placar ou editar título e observações" onclick="event.stopPropagation();">
              <i class="fa-solid fa-pen-to-square"></i> <span>Editar Confronto</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * MODAL DA PARTIDA: LIBERDADE AO ORGANIZADOR
 * - Selecionar participantes nos dropdowns (sem sorteio forçado)
 * - Escolher formato: Vencedor Direto, Placar Numérico, MD1, MD3, MD5
 * - Botão claro 'Declarar Vencedor' para cada participante
 * - Elimina termos confusos como 'gols/pontos' ou 'competidor 1'
 */
export async function abrirModalEditarPartida(partida, participantesConfirmados = [], onAtualizado = null) {
  if (typeof participantesConfirmados === 'function') {
    onAtualizado = participantesConfirmados;
    participantesConfirmados = [];
  }
  if (!partida) return;

  const antigo = document.getElementById('modalEditarPartidaScore');
  if (antigo) antigo.remove();

  let listaConfirmados = Array.isArray(participantesConfirmados) ? [...participantesConfirmados] : [];
  if (listaConfirmados.length === 0 && partida.torneio_id) {
    try {
      listaConfirmados = await buscarParticipantesConfirmados(partida.torneio_id);
    } catch (e) {
      listaConfirmados = [];
    }
  }

  const overlay = document.createElement('div');
  overlay.id = 'modalEditarPartidaScore';
  overlay.className = 'modal-score-overlay';

  const isLive = partida.status === 'Ao Vivo';
  const isEncerrado = partida.status === 'Encerrado' || partida.torneio_status === 'Encerrado' || partida.isTorneioEncerrado;
  const matchId = String(partida.id || '').trim();

  // Monta opções para select de participantes confirmados
  let optionsP1 = `<option value="">-- Selecione o Competidor 1 --</option>`;
  let optionsP2 = `<option value="">-- Selecione o Competidor 2 --</option>`;

  let p1Matched = false;
  let p2Matched = false;

  (listaConfirmados || []).forEach(part => {
    const realId = part.realId || part.user_email || part.userEmail || (part.tipo === 'equipe' ? (part.equipe_id || part.id) : part.id);
    const isSelected1 = (partida.p1_id && String(partida.p1_id).toLowerCase() === String(realId).toLowerCase()) ||
                        (partida.p1_nome && String(partida.p1_nome).trim().toLowerCase() === String(part.nome).trim().toLowerCase());
    const isSelected2 = (partida.p2_id && String(partida.p2_id).toLowerCase() === String(realId).toLowerCase()) ||
                        (partida.p2_nome && String(partida.p2_nome).trim().toLowerCase() === String(part.nome).trim().toLowerCase());
    if (isSelected1) p1Matched = true;
    if (isSelected2) p2Matched = true;
    optionsP1 += `<option value="${escapeHtml(realId)}" data-nome="${escapeHtml(part.nome)}" ${isSelected1 ? 'selected' : ''}>${escapeHtml(part.nome)}</option>`;
    optionsP2 += `<option value="${escapeHtml(realId)}" data-nome="${escapeHtml(part.nome)}" ${isSelected2 ? 'selected' : ''}>${escapeHtml(part.nome)}</option>`;
  });

  if (!p1Matched && partida.p1_nome && partida.p1_nome !== 'A definir' && !partida.p1_nome.startsWith('Competidor')) {
    const p1FallbackId = partida.p1_id || partida.p1_nome;
    optionsP1 += `<option value="${escapeHtml(p1FallbackId)}" data-nome="${escapeHtml(partida.p1_nome)}" selected>${escapeHtml(partida.p1_nome)}</option>`;
  }
  if (!p2Matched && partida.p2_nome && partida.p2_nome !== 'A definir' && !partida.p2_nome.startsWith('Competidor')) {
    const p2FallbackId = partida.p2_id || partida.p2_nome;
    optionsP2 += `<option value="${escapeHtml(p2FallbackId)}" data-nome="${escapeHtml(partida.p2_nome)}" selected>${escapeHtml(partida.p2_nome)}</option>`;
  }

  const numPartidaStr = partida.numero_partida ? `Partida #${partida.numero_partida}` : 'Confronto';

  overlay.innerHTML = `
    <div class="modal-score-card" role="dialog" aria-modal="true" aria-labelledby="scoreModalTitle" style="max-width: 520px; font-family: inherit;">
      <div class="modal-score-header">
        <div class="score-header-title-box">
          <i class="fa-solid fa-pen-to-square" style="color: #6366f1; font-size: 20px;"></i>
          <div>
            <h3 id="scoreModalTitle" style="font-size: 16px; font-weight: 700; color: #fff;">Editar ${numPartidaStr}</h3>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 2px;">Lance o placar, marque o vencedor e atualize as informações da partida.</p>
          </div>
        </div>
        <button type="button" class="btn-score-close" id="btnFecharModalScore" aria-label="Fechar">&times;</button>
      </div>

      <form id="formAtualizarPartidaScore" class="modal-score-form">

        <!-- NOME / FASE DA PARTIDA -->
        <div class="score-form-field">
          <label for="inputNomeRodadaPartida" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-tag" style="color: #6366f1;"></i> Nome / Fase da Partida
          </label>
          <input type="text" id="inputNomeRodadaPartida" class="score-input-text" value="${escapeHtml(partida.nome_rodada || '')}" placeholder="Ex: Grande Final, Semifinal, Partida 1...">
        </div>

        <!-- CONFRONTO: COMPETIDORES + PLACAR NUMÉRICO + VENCEDOR -->
        <div class="score-versus-container" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: start; margin-top: 14px; margin-bottom: 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px;">

          <!-- COMPETIDOR 1 -->
          <div class="score-team-card" id="cardLadoA">
            <span style="font-size: 12px; font-weight: 700; color: #f3f4f6; display: block; margin-bottom: 6px;">Competidor 1 *</span>
            <select id="selectLadoA" class="score-participant-select" required style="margin-bottom: 6px;">
              ${optionsP1}
            </select>

            <div class="score-input-wrap" id="wrapScoreA" style="margin-top: 6px;">
              <label for="inputP1Placar" style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 3px;">Placar Numérico</label>
              <input type="number" id="inputP1Placar" min="0" max="999" value="${partida.p1_placar ?? 0}" class="input-score-num">
            </div>

            <button type="button" class="btn-declarar-vencedor ${partida.vencedor_id && (partida.vencedor_id === partida.p1_id || partida.vencedor_id === partida.p1_nome) ? 'is-vencedor' : ''}" id="btnDeclararVencedorA" style="margin-top: 10px; width: 100%;">
              <i class="fa-solid fa-trophy"></i> <span>${partida.vencedor_id && (partida.vencedor_id === partida.p1_id || partida.vencedor_id === partida.p1_nome) ? 'Venceu' : 'Marcar Vencedor'}</span>
            </button>
          </div>

          <!-- DIVISOR VS -->
          <div class="score-vs-divider" style="margin-top: 32px; font-size: 12px; font-weight: 800; color: #6b7280;">
            <span class="vs-badge">VS</span>
          </div>

          <!-- COMPETIDOR 2 -->
          <div class="score-team-card" id="cardLadoB">
            <span style="font-size: 12px; font-weight: 700; color: #f3f4f6; display: block; margin-bottom: 6px;">Competidor 2 *</span>
            <select id="selectLadoB" class="score-participant-select" required style="margin-bottom: 6px;">
              ${optionsP2}
            </select>

            <div class="score-input-wrap" id="wrapScoreB" style="margin-top: 6px;">
              <label for="inputP2Placar" style="font-size: 11px; color: #9ca3af; display: block; margin-bottom: 3px;">Placar Numérico</label>
              <input type="number" id="inputP2Placar" min="0" max="999" value="${partida.p2_placar ?? 0}" class="input-score-num">
            </div>

            <button type="button" class="btn-declarar-vencedor ${partida.vencedor_id && (partida.vencedor_id === partida.p2_id || partida.vencedor_id === partida.p2_nome) ? 'is-vencedor' : ''}" id="btnDeclararVencedorB" style="margin-top: 10px; width: 100%;">
              <i class="fa-solid fa-trophy"></i> <span>${partida.vencedor_id && (partida.vencedor_id === partida.p2_id || partida.vencedor_id === partida.p2_nome) ? 'Venceu' : 'Marcar Vencedor'}</span>
            </button>
          </div>

        </div>

        <!-- DATA E HORÁRIO DO CONFRONTO -->
        <div class="score-form-field">
          <label for="inputDataAgendadaPartida" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-calendar-days" style="color: #6366f1;"></i> Data e Horário do Confronto (Opcional)
          </label>
          <input type="datetime-local" id="inputDataAgendadaPartida" class="score-input-text" value="${partida.data_agendada ? escapeHtml(String(partida.data_agendada).slice(0, 16)) : ''}">
        </div>

        <!-- LINK DA TRANSMISSÃO / LIVE -->
        <div class="score-form-field">
          <label for="inputLinkTransmissao" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-tower-broadcast" style="color: #6366f1;"></i> Link da Transmissão / Live (Opcional)
          </label>
          <input type="url" id="inputLinkTransmissao" placeholder="https://twitch.tv/... ou https://youtube.com/..." value="${escapeHtml(partida.link_transmissao || '')}" class="score-input-text">
        </div>

        <!-- OBSERVAÇÕES / HORÁRIO -->
        <div class="score-form-field">
          <label for="inputDetalhesPartida" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-circle-info" style="color: #6366f1;"></i> Observações / Horário / Detalhes (Opcional)
          </label>
          <input type="text" id="inputDetalhesPartida" class="score-input-text" maxlength="200" placeholder="Ex: Mapa: Ascent | MD3 | Horário: 20:00" value="${escapeHtml(partida.detalhes || partida.data_hora || '')}">
          <div id="detalhesCounterScore" style="font-size: 11px; color: #9ca3af; text-align: right; margin-top: 4px;">${(partida.detalhes || partida.data_hora || '').length} / 200 caracteres</div>
        </div>

        <div id="avisoCompetidoresIguaisScore" style="display: none; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
          Competidor 1 e Competidor 2 não podem ser iguais. Selecione competidores distintos.
        </div>

        <div class="modal-score-actions" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 18px;">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn-score-delete-extra" id="btnExcluirPartidaScoreModal" data-id="${matchId}">
              <i class="fa-solid fa-trash-can"></i> Excluir Partida
            </button>
            <button type="button" class="btn-desmarcar-vencedor" id="btnDesmarcarVencedorModal" data-id="${matchId}" style="${(partida.vencedor_id || partida.status === 'Encerrado') ? '' : 'display: none;'}">
              <i class="fa-solid fa-rotate-left"></i> Desmarcar Vencedor
            </button>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn-score-cancel" id="btnCancelarScore">Cancelar</button>
            <button type="submit" class="btn-score-save" id="btnSalvarScore" data-id="${matchId}">
              <i class="fa-solid fa-floppy-disk"></i> Salvar
            </button>
          </div>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const btnClose = overlay.querySelector('#btnFecharModalScore');
  const btnCancel = overlay.querySelector('#btnCancelarScore');
  const form = overlay.querySelector('#formAtualizarPartidaScore');
  const btnSalvar = overlay.querySelector('#btnSalvarScore');

  const selectLadoA = overlay.querySelector('#selectLadoA');
  const selectLadoB = overlay.querySelector('#selectLadoB');

  const btnVencedorA = overlay.querySelector('#btnDeclararVencedorA');
  const btnVencedorB = overlay.querySelector('#btnDeclararVencedorB');
  const btnExcluir = overlay.querySelector('#btnExcluirPartidaScoreModal');
  const btnDesmarcar = overlay.querySelector('#btnDesmarcarVencedorModal');

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  btnClose.addEventListener('click', fechar);
  btnCancel.addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  if (isEncerrado) {
    const lockBanner = document.createElement('div');
    lockBanner.style.cssText = 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;';
    lockBanner.innerHTML = `<i class="fa-solid fa-lock"></i> <span>Torneio Encerrado: Resultados e confrontos em modo somente leitura.</span>`;
    form.insertBefore(lockBanner, form.firstChild);

    overlay.querySelectorAll('input, select').forEach(el => { el.disabled = true; el.style.opacity = '0.7'; el.style.cursor = 'not-allowed'; });
    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.style.display = 'none'; }
    if (btnExcluir) { btnExcluir.disabled = true; btnExcluir.style.display = 'none'; }
    if (btnDesmarcar) { btnDesmarcar.disabled = true; btnDesmarcar.style.display = 'none'; }
    if (btnVencedorA) { btnVencedorA.disabled = true; btnVencedorA.style.pointerEvents = 'none'; btnVencedorA.style.opacity = '0.6'; }
    if (btnVencedorB) { btnVencedorB.disabled = true; btnVencedorB.style.pointerEvents = 'none'; btnVencedorB.style.opacity = '0.6'; }
  }

  // Valida competidores distintos
  const inputDetalhesPartida = overlay.querySelector('#inputDetalhesPartida');
  const detalhesCounterScore = overlay.querySelector('#detalhesCounterScore');
  const avisoCompScore = overlay.querySelector('#avisoCompetidoresIguaisScore');

  if (inputDetalhesPartida && detalhesCounterScore) {
    inputDetalhesPartida.addEventListener('input', () => {
      const len = inputDetalhesPartida.value.length;
      detalhesCounterScore.textContent = `${len} / 200 caracteres`;
    });
  }

  function verificarCompetidoresScore() {
    const val1 = (selectLadoA.value || '').trim().toLowerCase();
    const val2 = (selectLadoB.value || '').trim().toLowerCase();

    if (val1 && val2 && val1 === val2) {
      if (avisoCompScore) avisoCompScore.style.display = 'block';
      if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.style.opacity = '0.5';
        btnSalvar.style.cursor = 'not-allowed';
      }
    } else {
      if (avisoCompScore) avisoCompScore.style.display = 'none';
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.style.opacity = '1';
        btnSalvar.style.cursor = 'pointer';
      }
    }
  }

  selectLadoA.addEventListener('change', verificarCompetidoresScore);
  selectLadoB.addEventListener('change', verificarCompetidoresScore);

  // RESOLVER DADOS FINAIS DOS PARTICIPANTES
  function getParticipanteData(selectElem, defaultId, defaultNome, fallbackLabel = 'Competidor') {
    if (selectElem && selectElem.value) {
      const opt = selectElem.selectedOptions[0];
      const realId = selectElem.value;
      const rawNome = opt?.dataset?.nome || opt?.textContent || defaultNome || fallbackLabel;
      return {
        id: realId,
        nome: removerTagNome(rawNome) || defaultNome || fallbackLabel
      };
    }
    const cleanDefault = removerTagNome((defaultNome || '').trim());
    if (cleanDefault && cleanDefault.toLowerCase() !== 'a definir') {
      return { id: defaultId || '', nome: cleanDefault };
    }
    return { id: defaultId || '', nome: fallbackLabel };
  }

  // BOTÕES 'MARCAR VENCEDOR'
  async function executarDeclaracaoVencedor(slot) {
    const labelA = partida.numero_partida ? `Participante #${partida.numero_partida}A` : 'Competidor 1';
    const labelB = partida.numero_partida ? `Participante #${partida.numero_partida}B` : 'Competidor 2';

    const p1Data = getParticipanteData(selectLadoA, partida.p1_id, partida.p1_nome, labelA);
    const p2Data = getParticipanteData(selectLadoB, partida.p2_id, partida.p2_nome, labelB);

    if (!p1Data.id || !p2Data.id) {
      showBracketToast('Selecione ambos os competidores confirmados antes de definir o vencedor.', 'error');
      return;
    }

    if (String(p1Data.id).toLowerCase() === String(p2Data.id).toLowerCase()) {
      showBracketToast('Competidor 1 e Competidor 2 não podem ser iguais. Selecione competidores distintos.', 'error');
      return;
    }

    partida.p1_id = p1Data.id;
    partida.p1_nome = p1Data.nome;
    partida.p2_id = p2Data.id;
    partida.p2_nome = p2Data.nome;
    partida.link_transmissao = (document.getElementById('inputLinkTransmissao')?.value || '').trim();
    partida.data_agendada = (document.getElementById('inputDataAgendadaPartida')?.value || '').trim();

    const btnAlvo = slot === 1 ? btnVencedorA : btnVencedorB;
    try {
      if (btnAlvo) {
        btnAlvo.disabled = true;
        btnAlvo.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Definindo...`;
      }

      const res = await declararVencedor({
        partida,
        vencedorSlot: slot
      });

      showBracketToast(`${res.vencedorNome} marcado como vencedor!`);
      fechar();
      if (typeof onAtualizado === 'function') onAtualizado(res);
      document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: matchId } }));
    } catch (err) {
      console.warn('Aviso ao declarar vencedor:', err);
      showBracketToast(err?.message || 'Falha ao declarar vencedor.', 'error');
    } finally {
      if (btnAlvo) {
        btnAlvo.disabled = false;
        btnAlvo.innerHTML = `<i class="fa-solid fa-trophy"></i> <span>Marcar Vencedor</span>`;
      }
    }
  }

  btnVencedorA.addEventListener('click', () => executarDeclaracaoVencedor(1));
  btnVencedorB.addEventListener('click', () => executarDeclaracaoVencedor(2));

  // EXCLUIR PARTIDA NA TABELA SUPABASE
  if (btnExcluir) {
    btnExcluir.addEventListener('click', async () => {
      const targetId = String(btnExcluir.getAttribute('data-id') || matchId || '').trim();
      if (!targetId) {
        console.warn('Nenhum ID de partida encontrado para exclusão.');
        showBracketToast('ID da partida não encontrado.', 'error');
        return;
      }

      const nomeTitulo = partida.nome_rodada || `Partida #${partida.numero_partida || ''}`;
      const conf = await abrirModalConfirmacaoPartida({
        titulo: 'Excluir Partida',
        mensagem: `Deseja realmente apagar esta partida (${nomeTitulo})?`,
        subtexto: 'O confronto será permanentemente removido da tabela de partidas do torneio.',
        textoConfirmar: 'Sim, Excluir',
        textoCancelar: 'Cancelar'
      });
      if (!conf) return;

      btnExcluir.disabled = true;
      try {
        await excluirPartida(targetId, partida.torneio_id);
        showBracketToast('Partida excluída com sucesso!');
        fechar();
        if (typeof onAtualizado === 'function') onAtualizado();
        document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: targetId } }));
      } catch (err) {
        console.warn('Erro ao excluir partida:', err);
        showBracketToast('Erro ao excluir partida.', 'error');
        btnExcluir.disabled = false;
      }
    });
  }

  // DESMARCAR VENCEDOR
  if (btnDesmarcar) {
    btnDesmarcar.addEventListener('click', async () => {
      btnDesmarcar.disabled = true;
      btnDesmarcar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Desmarcando...`;
      try {
        await desmarcarVencedor(partida);
        showBracketToast('Vencedor desmarcado. Partida retornada para Pendente.');
        fechar();
        if (typeof onAtualizado === 'function') onAtualizado();
        document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: matchId } }));
      } catch (err) {
        console.warn('Erro ao desmarcar vencedor:', err);
        showBracketToast('Erro ao desmarcar vencedor.', 'error');
        btnDesmarcar.disabled = false;
        btnDesmarcar.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Desmarcar Vencedor`;
      }
    });
  }

  // SUBMIT DO FORMULÁRIO (SALVAR DEFINITIVO NO SUPABASE VIA .update())
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const partidaId = String(partida?.id || btnSalvar.getAttribute('data-id') || matchId || '').trim();
    if (!partidaId) {
      console.warn('ID da partida não encontrado para atualização.');
      showBracketToast('ID da partida não encontrado.', 'error');
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...`;

    const p1Data = getParticipanteData(selectLadoA, partida.p1_id, partida.p1_nome);
    const p2Data = getParticipanteData(selectLadoB, partida.p2_id, partida.p2_nome);

    if (!p1Data.id || !p2Data.id) {
      showBracketToast('Selecione ambos os competidores da lista de participantes confirmados.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar`;
      return;
    }

    if (String(p1Data.id).toLowerCase() === String(p2Data.id).toLowerCase()) {
      showBracketToast('Competidor 1 e Competidor 2 não podem ser o mesmo participante.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar`;
      return;
    }

    const p1_placar = Number(document.getElementById('inputP1Placar')?.value || 0);
    const p2_placar = Number(document.getElementById('inputP2Placar')?.value || 0);
    const data_agendada = (document.getElementById('inputDataAgendadaPartida')?.value || '').trim();
    const link_transmissao = (document.getElementById('inputLinkTransmissao')?.value || '').trim();
    const nome_rodada = (document.getElementById('inputNomeRodadaPartida')?.value || '').trim();
    const detalhes = (document.getElementById('inputDetalhesPartida')?.value || '').trim();

    try {
      const res = await atualizarPlacarPartida({
        partida,
        p1_id: p1Data.id,
        p1_nome: p1Data.nome,
        p1_placar,
        p2_id: p2Data.id,
        p2_nome: p2Data.nome,
        p2_placar,
        data_agendada,
        link_transmissao,
        nome_rodada,
        detalhes
      });

      showBracketToast('Confronto salvo com sucesso!');
      fechar();
      if (typeof onAtualizado === 'function') onAtualizado(res);
      document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { matchId: partidaId } }));
    } catch (err) {
      console.error('Erro ao salvar partida:', err);
      showBracketToast(err?.message || 'Erro ao salvar partida.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar`;
    }
  });
}

/**
 * MODAL PARA EDITAR NOME / FASE DA RODADA
 */
export function abrirModalEditarNomeRodada({
  torneioId,
  rodadaNum,
  nomeAtual = '',
  partidas = [],
  onSalvo = null
}) {
  const antigo = document.getElementById('modalEditarNomeRodada');
  if (antigo) antigo.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-score-overlay';
  overlay.id = 'modalEditarNomeRodada';

  const presets = [
    'Fase de Grupos',
    'Oitavas de Final',
    'Quartas de Final',
    'Semifinal',
    'Final',
    'Grande Final',
    'Repescagem',
    `Rodada ${rodadaNum}`
  ];

  const chipsHtml = presets.map(p => `
    <button type="button" class="round-chip ${p.toLowerCase() === (nomeAtual || '').toLowerCase() ? 'active' : ''}" data-val="${escapeHtml(p)}">
      ${escapeHtml(p)}
    </button>
  `).join('');

  overlay.innerHTML = `
    <div class="modal-score-card" style="max-width: 480px;">
      <div class="modal-score-header">
        <div>
          <h3><i class="fa-solid fa-tags" style="color: #6366f1;"></i> Nome da Rodada / Fase</h3>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 3px;">
            Personalize o rótulo de fase no topo e nas partidas da <strong>Rodada ${rodadaNum}</strong>.
          </p>
        </div>
        <button type="button" class="btn-score-close" id="btnFecharModalRodada">&times;</button>
      </div>

      <form id="formEditarNomeRodada">
        <div class="score-form-field">
          <label for="inputNovoNomeRodada"><i class="fa-solid fa-pen-to-square"></i> Título da Rodada / Fase</label>
          <input type="text" id="inputNovoNomeRodada" class="score-input-text" value="${escapeHtml(nomeAtual || `Rodada ${rodadaNum}`)}" placeholder="Ex: Semifinal, Quartas, Grande Final..." autofocus>
        </div>

        <div>
          <label style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Sugestões Rápidas:</label>
          <div class="round-preset-chips">
            ${chipsHtml}
          </div>
        </div>

        <div style="margin-top: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="chkAplicarTodasPartidas" checked style="accent-color: #6366f1; cursor: pointer; width: 16px; height: 16px;">
          <label for="chkAplicarTodasPartidas" style="font-size: 12.5px; color: #d1d5db; cursor: pointer;">
            Aplicar tag de fase em todos os confrontos desta rodada
          </label>
        </div>

        <div class="modal-score-actions">
          <button type="button" class="btn-score-cancel" id="btnCancelarNomeRodada">Cancelar</button>
          <button type="submit" class="btn-score-save" id="btnSalvarNomeRodada">
            <i class="fa-solid fa-check"></i> Salvar Nome
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const inputNome = overlay.querySelector('#inputNovoNomeRodada');
  const chkAplicar = overlay.querySelector('#chkAplicarTodasPartidas');
  const btnSalvar = overlay.querySelector('#btnSalvarNomeRodada');

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  overlay.querySelector('#btnFecharModalRodada').addEventListener('click', fechar);
  overlay.querySelector('#btnCancelarNomeRodada').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

  overlay.querySelectorAll('.round-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-val');
      inputNome.value = val;
      overlay.querySelectorAll('.round-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      inputNome.focus();
    });
  });

  overlay.querySelector('#formEditarNomeRodada').addEventListener('submit', async (e) => {
    e.preventDefault();
    const novoNome = (inputNome.value || '').trim() || `Rodada ${rodadaNum}`;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...`;

    // 1. Salva no mapa de nomes de rodadas
    salvarNomeRodada(torneioId, rodadaNum, novoNome);

    // 2. Atualiza partidas no cache local
    const partidasAtuais = carregarPartidasCacheLocal(torneioId);
    partidasAtuais.forEach(p => {
      if (String(p.rodada) === String(rodadaNum)) {
        if (chkAplicar.checked || !p.nome_rodada) {
          p.nome_rodada = novoNome;
        }
      }
    });
    salvarPartidasCacheLocal(torneioId, partidasAtuais);

    // 3. Atualiza no Supabase em segundo plano
    try {
      if (chkAplicar.checked) {
        await supabase
          .from('partidas')
          .update({ nome_rodada: novoNome })
          .eq('torneio_id', String(torneioId))
          .eq('rodada', Number(rodadaNum));
      }
    } catch (errDb) {
      console.warn('Aviso ao sincronizar nome da rodada no banco:', errDb);
    }

    showBracketToast(`Rodada ${rodadaNum} renomeada para "${novoNome}"!`);
    fechar();
    if (typeof onSalvo === 'function') {
      onSalvo(novoNome);
    }
  });
}

/**
 * MODAL PARA CRIAR NOVA PARTIDA
 * Apenas o essencial: Competidor 1, Competidor 2, Nome/Fase e Link Transmissão/Live.
 */
export async function abrirModalCriarPartidaManual(torneioId, participantesConfirmados = [], onCriada = null) {
  const antigo = document.getElementById('modalCriarPartidaExtra');
  if (antigo) antigo.remove();

  let listPart = Array.isArray(participantesConfirmados) ? [...participantesConfirmados] : [];
  if (listPart.length === 0 && torneioId) {
    try {
      listPart = await buscarParticipantesConfirmados(torneioId);
    } catch (e) {
      listPart = [];
    }
  }

  // Busca formato do torneio, data de abertura e partidas para filtrar participantes eliminados
  let formatoTorneio = 'Mata-Mata (Eliminatória)';
  let dataAberturaIso = '';
  let partidasAtuais = [];
  if (torneioId) {
    partidasAtuais = carregarPartidasCacheLocal(torneioId) || [];
    if (typeof window !== 'undefined' && window.torneioGlobal && String(window.torneioGlobal.id) === String(torneioId)) {
      formatoTorneio = window.torneioGlobal.formato || window.torneioGlobal.formato_torneio || formatoTorneio;
      dataAberturaIso = extrairDataHoraAberturaIso(window.torneioGlobal);
    }
    try {
      const { data: tData } = await supabase.from('torneios').select('*').eq('id', String(torneioId)).maybeSingle();
      if (tData) {
        formatoTorneio = tData.formato || tData.formato_torneio || formatoTorneio;
        if (!dataAberturaIso) {
          dataAberturaIso = extrairDataHoraAberturaIso(tData);
        }
      }
      if (!dataAberturaIso) {
        const created = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
        const found = created.find(t => String(t.id) === String(torneioId));
        if (found) {
          formatoTorneio = found.formato || found.formato_torneio || formatoTorneio;
          dataAberturaIso = extrairDataHoraAberturaIso(found);
        }
      }
    } catch (e) {}
  }

  // Calcula os status para ocultar eliminados no formato Mata-Mata
  const statusRes = calcularStatusParticipantes(partidasAtuais, listPart, false, formatoTorneio);
  const setEliminados = new Set(
    (statusRes.listaStatus || [])
      .filter(s => s.status === 'Eliminado')
      .map(s => s.nome.toLowerCase())
  );

  const listPartElegiveis = listPart.filter(p => {
    const nomeP = removerTagNome(p.nome || p.equipe_nome || p.user_email || '').trim().toLowerCase();
    return !setEliminados.has(nomeP);
  });

  const overlay = document.createElement('div');
  overlay.id = 'modalCriarPartidaExtra';
  overlay.className = 'modal-score-overlay';

  let optionsP1 = `<option value="">-- Selecione o Competidor 1 --</option>`;
  let optionsP2 = `<option value="">-- Selecione o Competidor 2 --</option>`;
  if (listPartElegiveis.length === 0) {
    optionsP1 = `<option value="">-- Nenhum participante com inscrição aceita --</option>`;
    optionsP2 = `<option value="">-- Nenhum participante com inscrição aceita --</option>`;
  } else {
    listPartElegiveis.forEach(p => {
      const realId = p.realId || p.user_email || p.userEmail || (p.tipo === 'equipe' ? (p.equipe_id || p.id) : p.id);
      optionsP1 += `<option value="${escapeHtml(realId)}" data-nome="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`;
      optionsP2 += `<option value="${escapeHtml(realId)}" data-nome="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`;
    });
  }

  overlay.innerHTML = `
    <div class="modal-score-card" role="dialog" aria-modal="true" style="max-width: 480px; font-family: inherit;">
      <div class="modal-score-header">
        <div class="score-header-title-box">
          <i class="fa-solid fa-plus-circle" style="color: #6366f1; font-size: 22px;"></i>
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #fff;">Criar Nova Partida</h3>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 2px;">Selecione os competidores confirmados e defina as informações do confronto.</p>
          </div>
        </div>
        <button type="button" class="btn-score-close" id="btnFecharModalExtra" aria-label="Fechar">&times;</button>
      </div>

      <form id="formCriarPartidaExtra">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
          <div>
            <label style="font-size: 12px; font-weight: 700; color: #d1d5db; display: block; margin-bottom: 6px;">Competidor 1 *</label>
            <select id="selectExtraP1" class="score-participant-select" required style="margin-bottom: 4px;">
              ${optionsP1}
            </select>
          </div>
          <div>
            <label style="font-size: 12px; font-weight: 700; color: #d1d5db; display: block; margin-bottom: 6px;">Competidor 2 *</label>
            <select id="selectExtraP2" class="score-participant-select" required style="margin-bottom: 4px;">
              ${optionsP2}
            </select>
          </div>
        </div>

        <div class="score-form-field">
          <label for="inputTituloExtra" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-tag" style="color: #6366f1;"></i> Nome / Fase da Partida
          </label>
          <input type="text" id="inputTituloExtra" class="score-input-text" placeholder="Ex: Partida 1, Semifinal, Grande Final..." value="">
        </div>

        <div class="score-form-field">
          <label for="inputDataAgendadaExtra" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-calendar-days" style="color: #6366f1;"></i> Data e Horário do Confronto (Opcional)
          </label>
          <input type="datetime-local" id="inputDataAgendadaExtra" class="score-input-text" value="${escapeHtml(dataAberturaIso)}">
        </div>

        <div class="score-form-field">
          <label for="inputLinkExtra" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-tower-broadcast" style="color: #6366f1;"></i> Link da Transmissão / Live (Opcional)
          </label>
          <input type="url" id="inputLinkExtra" class="score-input-text" placeholder="https://twitch.tv/... ou https://youtube.com/...">
        </div>

        <div class="score-form-field">
          <label for="inputDetalhesExtra" style="font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 6px; display: block;">
            <i class="fa-solid fa-circle-info" style="color: #6366f1;"></i> Detalhes / Observações (Opcional)
          </label>
          <input type="text" id="inputDetalhesExtra" class="score-input-text" maxlength="200" placeholder="Ex: MD3 | Mapa Ascent | Horário: 20:00" value="">
          <div id="detalhesCounterExtra" style="font-size: 11px; color: #9ca3af; text-align: right; margin-top: 4px;">0 / 200 caracteres</div>
        </div>

        <div id="avisoCompetidoresIguaisExtra" style="display: none; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
          Competidor 1 e Competidor 2 não podem ser iguais. Selecione competidores distintos.
        </div>

        <div class="modal-score-actions" style="margin-top: 18px;">
          <button type="button" class="btn-score-cancel" id="btnCancelarExtra">Cancelar</button>
          <button type="submit" class="btn-score-save" id="btnSalvarExtra">
            <i class="fa-solid fa-plus"></i> Criar Partida
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  overlay.querySelector('#btnFecharModalExtra').addEventListener('click', fechar);
  overlay.querySelector('#btnCancelarExtra').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

  const selP1 = overlay.querySelector('#selectExtraP1');
  const selP2 = overlay.querySelector('#selectExtraP2');
  const inputTitulo = overlay.querySelector('#inputTituloExtra');
  const inputDetalhes = overlay.querySelector('#inputDetalhesExtra');
  const counterDetalhes = overlay.querySelector('#detalhesCounterExtra');
  const avisoComp = overlay.querySelector('#avisoCompetidoresIguaisExtra');
  const btnSalvarExtra = overlay.querySelector('#btnSalvarExtra');

  if (inputDetalhes && counterDetalhes) {
    inputDetalhes.addEventListener('input', () => {
      const len = inputDetalhes.value.length;
      counterDetalhes.textContent = `${len} / 200 caracteres`;
    });
  }

  function verificarCompetidores() {
    const val1 = (selP1.value || '').trim().toLowerCase();
    const val2 = (selP2.value || '').trim().toLowerCase();

    if (val1 && val2 && val1 === val2) {
      if (avisoComp) avisoComp.style.display = 'block';
      if (btnSalvarExtra) {
        btnSalvarExtra.disabled = true;
        btnSalvarExtra.style.opacity = '0.5';
        btnSalvarExtra.style.cursor = 'not-allowed';
      }
    } else {
      if (avisoComp) avisoComp.style.display = 'none';
      if (btnSalvarExtra) {
        btnSalvarExtra.disabled = false;
        btnSalvarExtra.style.opacity = '1';
        btnSalvarExtra.style.cursor = 'pointer';
      }
    }
  }

  selP1.addEventListener('change', verificarCompetidores);
  selP2.addEventListener('change', verificarCompetidores);

  overlay.querySelector('#formCriarPartidaExtra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSalvar = overlay.querySelector('#btnSalvarExtra');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Criando...`;

    const p1Id = (selP1.value || '').trim();
    const p1Nome = removerTagNome(selP1.selectedOptions[0]?.dataset?.nome || selP1.selectedOptions[0]?.textContent || '') || 'A definir';

    const p2Id = (selP2.value || '').trim();
    const p2Nome = removerTagNome(selP2.selectedOptions[0]?.dataset?.nome || selP2.selectedOptions[0]?.textContent || '') || 'A definir';

    if (!p1Id || !p2Id) {
      showBracketToast('Selecione ambos os competidores da lista de participantes confirmados.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="fa-solid fa-plus"></i> Criar Partida`;
      return;
    }

    if (p1Id.toLowerCase() === p2Id.toLowerCase()) {
      showBracketToast('Competidor 1 e Competidor 2 não podem ser o mesmo participante.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="fa-solid fa-plus"></i> Criar Partida`;
      return;
    }

    const tituloVal = (inputTitulo?.value || '').trim();
    const dataAgendadaVal = (overlay.querySelector('#inputDataAgendadaExtra')?.value || '').trim();
    const linkVal = (overlay.querySelector('#inputLinkExtra')?.value || '').trim();
    const detalhesVal = (overlay.querySelector('#inputDetalhesExtra')?.value || '').trim();

    try {
      const nova = await criarPartidaManualExtra({
        torneioId,
        rodada: 1,
        nomeRodada: tituloVal,
        p1: { id: p1Id, nome: p1Nome },
        p2: { id: p2Id, nome: p2Nome },
        formato: 'numerico',
        linkTransmissao: linkVal,
        detalhes: detalhesVal,
        dataAgendada: dataAgendadaVal
      });

      showBracketToast('Partida criada com sucesso!');
      fechar();
      if (typeof onCriada === 'function') onCriada(nova);
      document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { torneioId } }));
    } catch (err) {
      console.error('Erro ao criar partida:', err);
      showBracketToast('Erro ao criar partida.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="fa-solid fa-plus"></i> Criar Partida`;
    }
  });
}

// Alias para manter compatibilidade com ambos os nomes de importação
export const abrirModalCriarPartidaExtra = abrirModalCriarPartidaManual;

/**
 * MODAL PARA VISUALIZAR ESCALAÇÃO DOS INTEGRANTES DA PARTIDA / CONFRONTO
 * Acessível tanto para o público (visitantes) quanto para o organizador.
 */
export async function abrirModalIntegrantesPartida({ partida, torneioId, participantesConfirmados = [], isTorneioSolo = false }) {
  if (!partida) return;
  const p1Nome = removerTagNome(partida.p1_nome) || 'Competidor 1';
  const p2Nome = removerTagNome(partida.p2_nome) || 'Competidor 2';

  if (p1Nome !== 'A definir' && p1Nome !== 'Competidor 1') {
    await abrirModalIntegrantesEquipe({
      torneioId: torneioId || partida.torneio_id,
      participanteId: partida.p1_id,
      participanteNome: p1Nome,
      participantesConfirmados,
      isTorneioSolo
    });
  } else if (p2Nome !== 'A definir' && p2Nome !== 'Competidor 2') {
    await abrirModalIntegrantesEquipe({
      torneioId: torneioId || partida.torneio_id,
      participanteId: partida.p2_id,
      participanteNome: p2Nome,
      participantesConfirmados,
      isTorneioSolo
    });
  } else {
    showBracketToast('Ainda não há equipes definidas neste confronto para exibir a escalação.', 'info');
  }
}

/**
 * MODAL PARA VISUALIZAR INTEGRANTES / ESCALAÇÃO DA EQUIPE OU COMPETIDOR
 * Acessível tanto para o organizador quanto para os visitantes da página.
 */
export async function abrirModalIntegrantesEquipe({ torneioId, participanteId, participanteNome, participantesConfirmados = [], isTorneioSolo = false }) {
  const nomeLimpo = removerTagNome(participanteNome) || 'Equipe / Participante';

  const antigo = document.getElementById('modalIntegrantesEquipeOverlay');
  if (antigo) antigo.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modalIntegrantesEquipeOverlay';
  overlay.className = 'modal-roster-overlay';

  overlay.innerHTML = `
    <div class="modal-roster-card" role="dialog" aria-modal="true" aria-labelledby="rosterModalTitle">
      <div class="modal-roster-header">
        <div class="modal-roster-header-info">
          <i class="fa-solid fa-users roster-team-icon"></i>
          <div>
            <h3 id="rosterModalTitle">${escapeHtml(nomeLimpo)}</h3>
            <p>Integrantes / Participantes escalados</p>
          </div>
        </div>
        <button type="button" class="btn-roster-close" id="btnFecharModalRoster" aria-label="Fechar">&times;</button>
      </div>

      <div class="roster-members-list" id="listaMembrosRoster">
        <div class="roster-empty-state">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Carregando escalação...</span>
        </div>
      </div>

      <div class="modal-roster-footer">
        <button type="button" class="btn-roster-close-action" id="btnFecharRosterAction">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  overlay.querySelector('#btnFecharModalRoster').addEventListener('click', fechar);
  overlay.querySelector('#btnFecharRosterAction').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  const containerLista = overlay.querySelector('#listaMembrosRoster');

  try {
    let membrosEscalados = [];

    // 1. Consulta direta na tabela equipes e membros_equipe
    try {
      let teamData = null;
      if (participanteId) {
        const { data: td } = await supabase
          .from('equipes')
          .select('id, nome, tag, logo, leaderName, leaderEmail')
          .eq('id', String(participanteId))
          .maybeSingle();
        if (td) teamData = td;
      }

      if (!teamData && nomeLimpo) {
        const { data: td } = await supabase
          .from('equipes')
          .select('id, nome, tag, logo, leaderName, leaderEmail')
          .ilike('nome', nomeLimpo)
          .maybeSingle();
        if (td) teamData = td;
      }

      const teamId = teamData?.id || participanteId;
      const leaderEmail = (teamData?.leaderEmail || '').toLowerCase().trim();
      const leaderName = teamData?.leaderName || '';

      const searchTeamIds = [];
      if (teamId) searchTeamIds.push(String(teamId));
      if (teamData?.id) searchTeamIds.push(String(teamData.id));
      if (teamData?.nome) searchTeamIds.push(String(teamData.nome));
      if (nomeLimpo) searchTeamIds.push(nomeLimpo);

        const { data: membrosDb } = await supabase
          .from('membros_equipe')
          .select('id, equipe_id, user_email, status')
          .in('equipe_id', searchTeamIds)
          .eq('status', 'Aceito');

      const emails = new Set();
      if (leaderEmail) emails.add(leaderEmail);
      (membrosDb || []).forEach(m => {
        if (m.user_email) emails.add(m.user_email.toLowerCase().trim());
      });

      if (emails.size > 0) {
        const emailsArr = Array.from(emails);
        const { data: usersData } = await supabase
          .from('usuarios')
          .select('id, email, nome, avatar')
          .in('email', emailsArr);

        const userMap = new Map();
        (usersData || []).forEach(u => {
          userMap.set((u.email || '').toLowerCase().trim(), u);
        });

        emailsArr.forEach((em) => {
          const u = userMap.get(em) || {};
          const isLider = em === leaderEmail;
          membrosEscalados.push({
            id: u.id || em,
            nome: u.nome || (isLider && leaderName ? leaderName : null) || em.split('@')[0],
            email: em,
            avatar: u.avatar || (isLider && teamData?.logo ? teamData.logo : '/image/boneco_logo_ofc.png'),
            role: isLider ? 'Capitão / Líder' : 'Membro Ativo'
          });
        });
      }
    } catch (memErr) {
      console.warn('Aviso ao consultar membros_equipe diretamente:', memErr);
    }

    // 3. Fallback: equipes salvas localmente
    if (membrosEscalados.length === 0) {
      try {
        const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
        const cachedTeams = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
        const tFound = localTeams.find(t => String(t.id) === String(participanteId) || removerTagNome(t.nome).toLowerCase() === nomeLimpo.toLowerCase()) ||
                       cachedTeams.find(t => String(t.id) === String(participanteId) || removerTagNome(t.nome).toLowerCase() === nomeLimpo.toLowerCase());
        if (tFound) {
          if (Array.isArray(tFound.membros) && tFound.membros.length > 0) {
            membrosEscalados = tFound.membros.map(m => ({
              nome: m.nome || m.user_email || m.email,
              email: m.email || m.user_email || '',
              avatar: m.avatar || '/image/boneco_logo_ofc.png',
              role: m.role || 'Integrante'
            }));
          } else if (tFound.leaderName || tFound.leaderEmail) {
            membrosEscalados.push({
              nome: tFound.leaderName || tFound.leaderEmail.split('@')[0],
              email: tFound.leaderEmail || '',
              avatar: tFound.logo || '/image/boneco_logo_ofc.png',
              role: 'Capitão / Líder'
            });
          }
        }
      } catch (e) {}
    }

    // 4. Se ainda estiver vazio, busca usuários no Supabase que tenham nome parecido ou email
    if (membrosEscalados.length === 0) {
      try {
        const { data: usuariosSemelhantes } = await supabase
          .from('usuarios')
          .select('id, nome, email, avatar')
          .ilike('nome', `%${nomeLimpo}%`)
          .limit(5);

        if (usuariosSemelhantes && usuariosSemelhantes.length > 0) {
          membrosEscalados = usuariosSemelhantes.map(u => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            avatar: u.avatar || '/image/boneco_logo_ofc.png',
            role: 'Participante'
          }));
        }
      } catch (e) {}
    }

    // 5. Fallback final: exibe o participante / equipe
    if (membrosEscalados.length === 0) {
      membrosEscalados.push({
        nome: nomeLimpo,
        email: '',
        avatar: '/image/boneco_logo_ofc.png',
        role: 'Participante Oficial'
      });
    }

    // 6. Busca avatares reais e IDs da tabela 'usuarios' no Supabase para cada membro
    try {
      const emailsList = membrosEscalados.map(m => m.email).filter(Boolean);
      const nomesList = membrosEscalados.map(m => m.nome).filter(Boolean);

      let dbUsers = [];
      const { data: allUsers } = await supabase.from('usuarios').select('id, nome, email, avatar');
      if (allUsers) dbUsers = allUsers;

      const mapDbUsers = new Map();
      dbUsers.forEach(u => {
        if (u.email) mapDbUsers.set(u.email.toLowerCase().trim(), u);
        if (u.nome) mapDbUsers.set(u.nome.toLowerCase().trim(), u);
        if (u.id) mapDbUsers.set(String(u.id), u);
      });

      membrosEscalados = membrosEscalados.map(m => {
        const found = mapDbUsers.get((m.email || '').toLowerCase().trim()) ||
                      mapDbUsers.get((m.nome || '').toLowerCase().trim()) ||
                      dbUsers.find(u => (u.nome || '').toLowerCase().includes((m.nome || '').toLowerCase()));
        let av = found?.avatar || m.avatar || '';
        if (!av) {
          av = '/image/boneco_logo_ofc.png';
        }
        return {
          ...m,
          id: found?.id || m.id || m.email || m.nome,
          email: found?.email || m.email,
          avatar: av
        };
      });
    } catch (avatarErr) {
      console.warn('Aviso ao buscar avatares dos membros no Supabase:', avatarErr);
    }

    // Renderiza a lista (clicável para o perfil público)
    let html = '';
    membrosEscalados.forEach((m) => {
      const profileId = m.id || m.email || m.nome;
      const profileUrl = `/perfil/perfil-publico.html?id=${encodeURIComponent(profileId)}`;
      html += `
        <div class="roster-member-item" onclick="window.location.href='${profileUrl}'" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 10px 14px; border-radius: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s ease;" onmouseenter="this.style.background='rgba(99,102,241,0.1)'; this.style.borderColor='rgba(99,102,241,0.3)';" onmouseleave="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.08)';">
          <div class="roster-member-left" style="display: flex; align-items: center; gap: 12px;">
            <img referrerpolicy="no-referrer" src="${escapeHtml(m.avatar || '/image/boneco_logo_ofc.png')}" alt="${escapeHtml(m.nome)}" class="roster-member-avatar" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover;" onerror="this.src='/image/boneco_logo_ofc.png'">
            <div class="roster-member-details" style="display: flex; flex-direction: column;">
              <span class="roster-member-name" style="font-size: 14px; font-weight: 700; color: #ffffff;">${escapeHtml(m.nome)}</span>
              ${m.email ? `<span class="roster-member-extra" style="font-size: 12px; color: #9ca3af;">${escapeHtml(m.email)}</span>` : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="roster-member-role-badge" style="font-size: 11.5px; font-weight: 700; color: #a5b4fc; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); padding: 4px 10px; border-radius: 999px;">${escapeHtml(m.role || 'Titular')}</span>
            <i class="fa-solid fa-chevron-right" style="font-size: 12px; color: #9ca3af;"></i>
          </div>
        </div>
      `;
    });
    containerLista.innerHTML = html;
  } catch (err) {
    console.error('Erro ao carregar roster:', err);
    containerLista.innerHTML = `
      <div class="roster-empty-state">
        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>
        <span>Erro ao carregar integrantes da equipe.</span>
      </div>
    `;
  }
}

/**
 * MODAL DE MONTAGEM MANUAL DE CONFRONTOS (Configuração Direta em Caixas de Seleção)
 */
export function abrirModalMontagemManual(torneioId, participantesConfirmados = [], onConcluido = null) {
  const antigo = document.getElementById('modalMontagemManual');
  if (antigo) antigo.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modalMontagemManual';
  overlay.className = 'modal-score-overlay';

  const N = Math.max(2, (participantesConfirmados || []).length);
  const K = Math.pow(2, Math.ceil(Math.log2(N)));
  const numPartidasR1 = K / 2;

  let optionsBase = `<option value="">-- Selecione o Participante --</option>`;
  (participantesConfirmados || []).forEach(p => {
    optionsBase += `<option value="${escapeHtml(p.id)}" data-nome="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`;
  });
  optionsBase += `<option value="__bye__">BYE (Avança Direto)</option>`;

  let htmlRows = '';
  for (let i = 1; i <= numPartidasR1; i++) {
    htmlRows += `
      <div class="manual-matchup-row" data-match-num="${i}">
        <span class="manual-matchup-label">Jogo #${i}</span>
        <select class="manual-select select-p1" data-slot="1">
          ${optionsBase}
        </select>
        <span class="manual-vs">VS</span>
        <select class="manual-select select-p2" data-slot="2">
          ${optionsBase}
        </select>
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="modal-score-card" role="dialog" aria-modal="true" style="max-width: 640px;">
      <div class="modal-score-header">
        <div class="score-header-title-box">
          <i class="fa-solid fa-handshake" style="color: #6366f1; font-size: 22px;"></i>
          <div>
            <h3>Montagem Manual de Confrontos</h3>
            <p>Selecione exatamente quem jogará contra quem na 1ª fase do chaveamento.</p>
          </div>
        </div>
        <button type="button" class="btn-score-close" id="btnFecharManual">&times;</button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); padding: 10px 14px; border-radius: 8px;">
        <span style="font-size: 12.5px; color: #c7d2fe;">
          <i class="fa-solid fa-users"></i> ${participantesConfirmados.length} participante(s) confirmados • Chave de ${K} slots
        </span>
        <button type="button" id="btnPreencherSorteioAux" style="background: transparent; border: 1px solid #4f46e5; color: #a5b4fc; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
          <i class="fa-solid fa-dice"></i> Preencher com Sorteio
        </button>
      </div>

      <div class="modal-manual-bracket-grid" id="containerManualRows">
        ${htmlRows}
      </div>

      <div class="modal-score-actions" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11.5px; color: #9ca3af;">Você também poderá alterar confrontos clicando em cada partida.</span>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn-score-cancel" id="btnCancelarManual">Cancelar</button>
          <button type="button" class="btn-score-save" id="btnSalvarChaveManual">
            <i class="fa-solid fa-check"></i> Salvar e Criar Chave
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  overlay.querySelector('#btnFecharManual').addEventListener('click', fechar);
  overlay.querySelector('#btnCancelarManual').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

  // Botão auxiliar: Preencher com Sorteio
  overlay.querySelector('#btnPreencherSorteioAux').addEventListener('click', () => {
    const embaralhados = [...participantesConfirmados];
    for (let i = embaralhados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
    }

    const rows = overlay.querySelectorAll('.manual-matchup-row');
    rows.forEach((row, idx) => {
      const s1 = row.querySelector('.select-p1');
      const s2 = row.querySelector('.select-p2');
      const p1 = embaralhados[2 * idx];
      const p2 = embaralhados[2 * idx + 1];

      if (p1 && s1) s1.value = p1.id;
      if (p2 && s2) s2.value = p2.id;
      else if (s2 && 2 * idx + 1 >= embaralhados.length) s2.value = '__bye__';
    });
    showBracketToast('Campos preenchidos com sorteio aleatório.');
  });

  // Salvar chave manual
  overlay.querySelector('#btnSalvarChaveManual').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btnSalvarChaveManual');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando Chave...`;

    // Monta lista ordenada de participantes conforme selecionado nos selects
    const listaFinal = [];
    const rows = overlay.querySelectorAll('.manual-matchup-row');
    rows.forEach(row => {
      const s1 = row.querySelector('.select-p1');
      const s2 = row.querySelector('.select-p2');

      const getP = (sel) => {
        if (!sel || !sel.value) return { id: '', nome: 'A definir' };
        if (sel.value === '__bye__') return { id: '', nome: 'BYE (Avança)' };
        const opt = sel.selectedOptions[0];
        const rawNome = opt?.dataset?.nome || opt?.textContent || 'Participante';
        return {
          id: sel.value,
          nome: removerTagNome(rawNome) || 'Participante'
        };
      };

      listaFinal.push(getP(s1));
      listaFinal.push(getP(s2));
    });

    try {
      await gerarChaveamentoTorneio(torneioId, listaFinal, { modo: 'manual' });
      showBracketToast('Chave manual montada com sucesso!');
      fechar();
      if (typeof onConcluido === 'function') onConcluido();
    } catch (err) {
      console.error('Erro ao salvar chave manual:', err);
      showBracketToast(err?.message || 'Erro ao salvar chaveamento.', 'error');
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Salvar e Criar Chave`;
    }
  });
}

/**
 * MODAL PARA GERENCIAR SOLICITAÇÕES DE INSCRIÇÃO (Aprovar / Rejeitar)
 */
export async function abrirModalGerenciarSolicitacoes(torneioId) {
  const antigo = document.getElementById('modalGerenciarSolicitacoesOverlay');
  if (antigo) antigo.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modalGerenciarSolicitacoesOverlay';
  overlay.className = 'modal-score-overlay';

  overlay.innerHTML = `
    <div class="modal-score-card" role="dialog" aria-modal="true" style="max-width: 680px; width: 90vw;">
      <div class="modal-score-header">
        <div class="score-header-title-box">
          <i class="fa-solid fa-user-check" style="color: #3b82f6; font-size: 22px;"></i>
          <div>
            <h3>Gerenciar Solicitações de Inscrição</h3>
            <p>Aprove ou rejeite participantes e equipes inscritas no torneio.</p>
          </div>
        </div>
        <button type="button" class="btn-score-close" id="btnFecharModalSolicitacoes">&times;</button>
      </div>

      <!-- Filtros de Status -->
      <div style="padding: 12px 16px 0 16px; display: flex; gap: 8px; flex-wrap: wrap;" id="solicitacoesFiltros">
        <button type="button" class="btn-solic-filter active" data-filter="todas" style="background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid rgba(59,130,246,0.4); padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Todas (<span id="cntTodas">0</span>)
        </button>
        <button type="button" class="btn-solic-filter" data-filter="pendentes" style="background: rgba(255,255,255,0.05); color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Pendentes (<span id="cntPendentes">0</span>)
        </button>
        <button type="button" class="btn-solic-filter" data-filter="aceitas" style="background: rgba(255,255,255,0.05); color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Aprovadas (<span id="cntAceitas">0</span>)
        </button>
        <button type="button" class="btn-solic-filter" data-filter="rejeitadas" style="background: rgba(255,255,255,0.05); color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Rejeitadas (<span id="cntRejeitadas">0</span>)
        </button>
      </div>

      <div class="modal-score-body" id="listaSolicitacoesBody" style="padding: 16px; max-height: 420px; overflow-y: auto;">
        <div style="text-align: center; color: #9ca3af; padding: 30px;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; color: #3b82f6;"></i>
          <p style="margin-top: 10px;">Carregando solicitações de inscrição...</p>
        </div>
      </div>
      <div class="modal-score-footer" style="padding: 12px 16px; display: flex; justify-content: flex-end;">
        <button type="button" id="btnFecharSolicitacoesAction" class="btn-modal-cancel">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
  }

  overlay.querySelector('#btnFecharModalSolicitacoes').addEventListener('click', fechar);
  overlay.querySelector('#btnFecharSolicitacoesAction').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

  const bodyEl = overlay.querySelector('#listaSolicitacoesBody');
  let currentFilter = 'todas';
  let totalInscricoes = [];

  // Helper local storage read
  function getLocalInscricoes() {
    try {
      if (typeof window.obterItemComFallback === 'function') {
        return JSON.parse(window.obterItemComFallback('vh_inscricoes', '[]') || '[]');
      }
      return JSON.parse(localStorage.getItem('vh_inscricoes') || '[]');
    } catch (e) {
      return [];
    }
  }

  // Helper local storage save
  function saveLocalInscricoes(list) {
    try {
      const jsonStr = JSON.stringify(list || []);
      if (typeof window.salvarItemComFallback === 'function') {
        window.salvarItemComFallback('vh_inscricoes', jsonStr);
      } else {
        localStorage.setItem('vh_inscricoes', jsonStr);
      }
    } catch (e) {
      console.warn('Erro ao salvar vh_inscricoes local:', e);
    }
  }

  // Carrega e mescla dados (Supabase + Local Storage)
  try {
    let remoteInscricoes = [];

    // 1. Busca do Supabase por ID string
    try {
      const { data, error } = await supabase
        .from('inscricoes')
        .select('*')
        .eq('torneio_id', String(torneioId));

      if (!error && Array.isArray(data)) {
        remoteInscricoes = data;
      }
    } catch (eDb) {
      console.warn('Aviso ao consultar inscrições por String(torneioId):', eDb);
    }

    // Fallback se torneioId for numérico no Supabase
    if (remoteInscricoes.length === 0 && !isNaN(Number(torneioId))) {
      try {
        const { data: dataNum } = await supabase
          .from('inscricoes')
          .select('*')
          .eq('torneio_id', Number(torneioId));

        if (Array.isArray(dataNum) && dataNum.length > 0) {
          remoteInscricoes = dataNum;
        }
      } catch (eNum) {}
    }

    totalInscricoes = [...remoteInscricoes];

    // 2. Mescla com local storage (vh_inscricoes)
    const localInsc = getLocalInscricoes();
    localInsc
      .filter(loc => String(loc.torneio_id) === String(torneioId))
      .forEach(locItem => {
        const jaExiste = totalInscricoes.some(rem => 
          (rem.id && locItem.id && String(rem.id) === String(locItem.id)) ||
          (rem.user_email && locItem.user_email && String(rem.user_email).toLowerCase() === String(locItem.user_email).toLowerCase() && String(rem.id_participante || rem.equipe_nome) === String(locItem.id_participante || locItem.equipe_nome))
        );
        if (!jaExiste) {
          totalInscricoes.push(locItem);
        }
      });

    // Enriquece solicitações de equipe com busca completa no Supabase e cache local
    const promessasEnriquecer = totalInscricoes.map(async (i) => {
      if (i.tipo === 'equipe') {
        const idPart = i.id_participante || i.equipe_nome;
        if (idPart) {
          try {
            let eqData = null;
            try {
              const { data: resOr, error: errOr } = await supabase
                .from('equipes')
                .select('id, nome, tag, logo, leaderName, leaderEmail')
                .or(`id.eq.${idPart},nome.eq.${idPart}`)
                .maybeSingle();
              if (!errOr && resOr) eqData = resOr;
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
              } catch (eFb) {}
            }

            if (eqData) {
              i.equipe_nome = eqData.nome + (eqData.tag ? ` [${eqData.tag}]` : '');
              i.logo = eqData.logo || '/image/logo.png';
            } else {
              const localTeams = JSON.parse(localStorage.getItem('vh_createdTeams') || '[]');
              const cachedTeams = JSON.parse(localStorage.getItem('vh_cachedEquipes') || '[]');
              const found = [...localTeams, ...cachedTeams].find(t => 
                String(t.id) === String(idPart) || 
                (t.nome && String(t.nome).toLowerCase() === String(idPart).toLowerCase())
              );
              if (found) {
                i.equipe_nome = found.nome + (found.tag ? ` [${found.tag}]` : '');
                i.logo = found.logo || '/image/logo.png';
              } else if (i.equipe_nome) {
                // mantém i.equipe_nome
              } else if (String(idPart).startsWith('team-')) {
                i.equipe_nome = 'Equipe ' + String(idPart).replace('team-', '');
              }
            }
          } catch (eEnr) {}
        }
      }
      return i;
    });

    await Promise.all(promessasEnriquecer);

    renderLista();

  } catch (err) {
    console.error('Erro ao carregar solicitações de inscrição:', err);
    bodyEl.innerHTML = `
      <div style="text-align: center; color: #ef4444; padding: 20px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; margin-bottom: 8px;"></i>
        <p>Erro ao carregar solicitações de inscrição. Tente novamente.</p>
      </div>
    `;
  }

  function renderLista() {
    // Atualiza contadores
    const pendentes = totalInscricoes.filter(i => (i.status || 'Pendente') === 'Pendente');
    const aceitas = totalInscricoes.filter(i => i.status === 'Aceito');
    const rejeitadas = totalInscricoes.filter(i => i.status === 'Rejeitado');

    overlay.querySelector('#cntTodas').textContent = totalInscricoes.length;
    overlay.querySelector('#cntPendentes').textContent = pendentes.length;
    overlay.querySelector('#cntAceitas').textContent = aceitas.length;
    overlay.querySelector('#cntRejeitadas').textContent = rejeitadas.length;

    // Filtra lista
    let listaFiltrada = totalInscricoes;
    if (currentFilter === 'pendentes') listaFiltrada = pendentes;
    else if (currentFilter === 'aceitas') listaFiltrada = aceitas;
    else if (currentFilter === 'rejeitadas') listaFiltrada = rejeitadas;

    if (listaFiltrada.length === 0) {
      bodyEl.innerHTML = `
        <div style="text-align: center; color: #9ca3af; padding: 30px;">
          <i class="fa-solid fa-inbox" style="font-size: 36px; margin-bottom: 12px; display: block; color: #4b5563;"></i>
          <span style="font-size: 14px; font-weight: 500;">Nenhuma solicitação encontrada para o filtro selecionado.</span>
        </div>
      `;
      return;
    }

    let html = '';
    listaFiltrada.forEach(i => {
      const nomePart = i.equipe_nome || i.id_participante || i.user_email || 'Participante';
      const status = i.status || 'Pendente';
      const isAceito = status === 'Aceito';
      const isRejeitado = status === 'Rejeitado';

      let statusBadge = '';
      if (isAceito) {
        statusBadge = `<span style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 11px;">Aprovado</span>`;
      } else if (isRejeitado) {
        statusBadge = `<span style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 11px;">Rejeitado</span>`;
      } else {
        statusBadge = `<span style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 11px;">Pendente</span>`;
      }

      // Detalhes de escalação (lineup) se for equipe
      let lineupHtml = '';
      if (Array.isArray(i.lineup) && i.lineup.length > 0) {
        const nomesLineup = i.lineup.map(m => escapeHtml(m.nome || m.email || 'Jogador')).join(', ');
        lineupHtml = `<div style="font-size: 11.5px; color: #a5b4fc; margin-top: 4px;"><i class="fa-solid fa-users" style="margin-right: 4px;"></i>Integrantes (${i.lineup.length}): ${nomesLineup}</div>`;
      }

      const perfilUrlModal = i.tipo === 'equipe'
        ? `/equipes/template_equipe.html?id=${encodeURIComponent(i.id_participante || i.equipe_nome || nomePart)}`
        : `/perfil/perfil-publico.html?id=${encodeURIComponent(i.user_email || i.id_participante || nomePart)}`;

      html += `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px 14px; border-radius: 8px; margin-bottom: 10px;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                <a href="${perfilUrlModal}" target="_blank" title="Ver ${i.tipo === 'equipe' ? 'equipe' : 'perfil'}" style="color: #fff; font-size: 15px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: color 0.15s;" onmouseenter="this.style.color='#ef4444';" onmouseleave="this.style.color='#fff';">${escapeHtml(nomePart)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; color: #ef4444;"></i></a>
                ${statusBadge}
                <span style="font-size: 11px; background: rgba(255,255,255,0.06); color: #d1d5db; padding: 2px 6px; border-radius: 4px;">${escapeHtml(i.tipo === 'equipe' ? 'Equipe' : 'Solo')}</span>
              </div>
              <div style="font-size: 12px; color: #9ca3af;">
                <i class="fa-regular fa-envelope" style="margin-right: 4px;"></i> ${escapeHtml(i.user_email || 'Não informado')}
              </div>
              ${lineupHtml}
            </div>

            <div style="display: flex; gap: 6px; align-items: center;">
              ${!isAceito ? `
                <button type="button" class="btn-aprovar-insc" data-id="${i.id || ''}" data-email="${escapeHtml(i.user_email || '')}" data-part="${escapeHtml(i.id_participante || i.equipe_nome || '')}" style="background: #10b981; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-check"></i> Aprovar
                </button>
              ` : ''}
              ${!isRejeitado ? `
                <button type="button" class="btn-rejeitar-insc" data-id="${i.id || ''}" data-email="${escapeHtml(i.user_email || '')}" data-part="${escapeHtml(i.id_participante || i.equipe_nome || '')}" style="background: #ef4444; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-xmark"></i> Rejeitar
                </button>
              ` : ''}
              <button type="button" class="btn-excluir-insc" data-id="${i.id || ''}" data-email="${escapeHtml(i.user_email || '')}" data-part="${escapeHtml(i.id_participante || i.equipe_nome || '')}" style="background: rgba(255,255,255,0.08); color: #9ca3af; border: none; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;" title="Excluir Inscrição">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    bodyEl.innerHTML = html;

    // Ações do Filtro
    overlay.querySelectorAll('.btn-solic-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-solic-filter').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.color = '#9ca3af';
          b.style.borderColor = 'rgba(255,255,255,0.1)';
        });
        btn.classList.add('active');
        btn.style.background = 'rgba(59,130,246,0.2)';
        btn.style.color = '#60a5fa';
        btn.style.borderColor = 'rgba(59,130,246,0.4)';

        currentFilter = btn.getAttribute('data-filter');
        renderLista();
      });
    });

    // Eventos de Aprovar
    bodyEl.querySelectorAll('.btn-aprovar-insc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const email = btn.getAttribute('data-email');
        const part = btn.getAttribute('data-part');
        btn.disabled = true;

        await atualizarStatusInscricao(torneioId, { id, email, part }, 'Aceito');
        showBracketToast('Inscrição aprovada com sucesso!');
        abrirModalGerenciarSolicitacoes(torneioId);
      });
    });

    // Eventos de Rejeitar
    bodyEl.querySelectorAll('.btn-rejeitar-insc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const email = btn.getAttribute('data-email');
        const part = btn.getAttribute('data-part');
        btn.disabled = true;

        await atualizarStatusInscricao(torneioId, { id, email, part }, 'Rejeitado');
        showBracketToast('Inscrição rejeitada.');
        abrirModalGerenciarSolicitacoes(torneioId);
      });
    });

    // Eventos de Excluir
    bodyEl.querySelectorAll('.btn-excluir-insc').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Deseja realmente remover esta solicitação de inscrição?')) return;
        const id = btn.getAttribute('data-id');
        const email = btn.getAttribute('data-email');
        const part = btn.getAttribute('data-part');
        btn.disabled = true;

        await removerInscricao(torneioId, { id, email, part });
        showBracketToast('Solicitação removida.');
        abrirModalGerenciarSolicitacoes(torneioId);
      });
    });
  }

  async function atualizarStatusInscricao(tId, { id, email, part }, novoStatus) {
    const isUuidValido = (v) => typeof v === 'string' && v.length === 36 && v.includes('-');
    let atualizou = false;

    // 1. Execução isolada e resiliente no Supabase (Update por UUID se for válido)
    if (isUuidValido(id)) {
      try {
        const { data, error } = await supabase.from('inscricoes').update({ status: novoStatus }).eq('id', id).select();
        if (!error && data && data.length > 0) atualizou = true;
      } catch (e) {}
    }

    // Fallback obrigatório por torneio_id + user_email / id_participante
    if (!atualizou) {
      try {
        if (email) {
          await supabase.from('inscricoes').update({ status: novoStatus }).eq('torneio_id', String(tId)).eq('user_email', email);
          if (!isNaN(Number(tId))) {
            await supabase.from('inscricoes').update({ status: novoStatus }).eq('torneio_id', Number(tId)).eq('user_email', email);
          }
        }
        if (part) {
          await supabase.from('inscricoes').update({ status: novoStatus }).eq('torneio_id', String(tId)).eq('id_participante', String(part));
        }
      } catch (eDb) {
        console.warn('Aviso ao atualizar Supabase:', eDb);
      }
    }

    // 2. Atualiza no Local Storage (vh_inscricoes e vh_joinedTournaments_)
    try {
      const list = getLocalInscricoes();
      let alterado = false;
      list.forEach(i => {
        if (String(i.torneio_id) === String(tId)) {
          if (
            (id && String(i.id) === String(id)) ||
            (email && String(i.user_email).toLowerCase() === String(email).toLowerCase()) ||
            (part && (String(i.id_participante) === String(part) || String(i.equipe_nome) === String(part)))
          ) {
            i.status = novoStatus;
            alterado = true;
          }
        }
      });
      if (alterado) {
        saveLocalInscricoes(list);
      }

      // Sincroniza em vh_joinedTournaments_
      const targetUserEmail = email || part || '';
      if (targetUserEmail) {
        const storageKey = `vh_joinedTournaments_${targetUserEmail}`;
        const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
        joined.forEach(j => {
          if (String(j.id) === String(tId) || String(j.torneio_id) === String(tId)) {
            j.inscricaoStatus = novoStatus;
            j.status = novoStatus;
          }
        });
        try { localStorage.setItem(storageKey, JSON.stringify(joined)); } catch (eSet) {}
      }
    } catch (eLoc) {}

    // 3. Dispara eventos para atualização na tela e recalcula contagem de participantes
    const payloadEv = { detail: { torneioId: tId }, bubbles: true };
    document.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
    document.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));
    window.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
    window.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));

    if (typeof window.carregarParticipantesConfirmados === 'function') {
      try { window.carregarParticipantesConfirmados(tId, null); } catch (e) {}
    }
    if (typeof carregarParticipantesConfirmados === 'function') {
      try { carregarParticipantesConfirmados(tId, null); } catch (e) {}
    }
  }

  async function removerInscricao(tId, { id, email, part }) {
    const isUuidValido = (v) => typeof v === 'string' && v.length === 36 && v.includes('-');
    let deletou = false;

    // 1. Supabase delete por UUID se válido
    if (isUuidValido(id)) {
      try {
        const { data, error } = await supabase.from('inscricoes').delete().eq('id', id).select();
        if (!error && data && data.length > 0) deletou = true;
      } catch (e) {}
    }

    if (!deletou) {
      try {
        if (email) {
          await supabase.from('inscricoes').delete().eq('torneio_id', String(tId)).eq('user_email', email);
        }
        if (part) {
          await supabase.from('inscricoes').delete().eq('torneio_id', String(tId)).eq('id_participante', String(part));
        }
      } catch (eDb) {}
    }

    // 2. Local Storage remove
    try {
      const list = getLocalInscricoes();
      const filtrado = list.filter(i => {
        if (String(i.torneio_id) !== String(tId)) return true;
        if (id && String(i.id) === String(id)) return false;
        if (email && String(i.user_email).toLowerCase() === String(email).toLowerCase()) return false;
        if (part && (String(i.id_participante) === String(part) || String(i.equipe_nome) === String(part))) return false;
        return true;
      });
      saveLocalInscricoes(filtrado);

      const targetUserEmail = email || part || '';
      if (targetUserEmail) {
        const storageKey = `vh_joinedTournaments_${targetUserEmail}`;
        const joined = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const joinedFiltrado = (Array.isArray(joined) ? joined : []).filter(j => String(j.id) !== String(tId) && String(j.torneio_id) !== String(tId));
        try { localStorage.setItem(storageKey, JSON.stringify(joinedFiltrado)); } catch (eSet) {}
      }
    } catch (eLoc) {}

    const payloadEv = { detail: { torneioId: tId }, bubbles: true };
    document.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
    document.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));
    window.dispatchEvent(new CustomEvent('versus:bracket-updated', payloadEv));
    window.dispatchEvent(new CustomEvent('versus:inscricoes-updated', payloadEv));

    if (typeof window.carregarParticipantesConfirmados === 'function') {
      try { window.carregarParticipantesConfirmados(tId, null); } catch (e) {}
    }
    if (typeof carregarParticipantesConfirmados === 'function') {
      try { carregarParticipantesConfirmados(tId, null); } catch (e) {}
    }
  }
}

if (typeof window !== 'undefined') {
  window.abrirModalGerenciarSolicitacoes = abrirModalGerenciarSolicitacoes;
}

/**
 * MODAL E PROCESSO DE ENCERRAMENTO OFICIAL DO TORNEIO E CONSOLIDAÇÃO DE PONTOS
 * Analisa histórico das partidas, calcula pontuações (+100/vitória, +25/participação, +500 campeão, +250 vice),
 * e atualiza o ranking oficial no Supabase de forma definitiva.
 */
export async function abrirModalConfirmacaoEncerramentoTorneio({ torneioId, onConcluido = null }) {
  if (!torneioId) {
    showBracketToast('ID do torneio não informado.', 'error');
    return;
  }

  // Validação: o torneio só pode ser encerrado quando TODAS as partidas cadastradas tiverem um vencedor definido
  try {
    const partidasCheck = await carregarPartidasTorneio(torneioId);
    if (!Array.isArray(partidasCheck) || partidasCheck.length === 0) {
      showBracketToast('Aviso: Não é possível encerrar o torneio sem partidas cadastradas.', 'error');
      alert('Aviso: Não é possível encerrar o torneio sem partidas cadastradas.');
      return;
    }

    const pendentes = partidasCheck.filter(p => {
      const temVencedor = Boolean(
        (p.vencedor_id && String(p.vencedor_id).trim() !== '') ||
        ((p.status === 'Encerrado' || p.status === 'Encerrada') && ((p.p1_placar ?? 0) !== (p.p2_placar ?? 0)))
      );
      return !temVencedor;
    });

    if (pendentes.length > 0) {
      const msg = 'Para encerrar o torneio e consolidar pontos, todas as partidas cadastradas devem ter um vencedor definido!';
      showBracketToast(msg, 'error');
      alert(msg);
      return;
    }
  } catch (errCheck) {
    console.warn('Erro ao verificar partidas do torneio:', errCheck);
  }

  const anterior = document.getElementById('modalConfirmacaoEncerramentoOverlay');
  if (anterior) anterior.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modalConfirmacaoEncerramentoOverlay';
  overlay.className = 'modal-confirm-overlay';

  overlay.innerHTML = `
    <div class="modal-confirm-card" role="dialog" aria-modal="true" aria-labelledby="modalEncerrarTitle">
      <button type="button" class="modal-confirm-close-btn" id="btnEncerramentoClose" aria-label="Fechar">&times;</button>
      <div class="modal-confirm-icon-box danger">
        <i class="fa-solid fa-flag-checkered"></i>
      </div>
      <h3 id="modalEncerrarTitle" class="modal-confirm-title">Encerrar Torneio e Consolidar Pontos</h3>
      <div class="modal-confirm-message">
        <p style="margin: 0; font-size: 14.5px; color: #f3f4f6;">Deseja realmente encerrar este torneio? Esta ação consolidará a pontuação final dos participantes e atualizará o ranking oficial do sistema.</p>
        <div class="modal-confirm-subtext warning-subtext">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>Após o encerramento, o status mudará para Encerrado e as partidas não poderão mais ser alteradas.</span>
        </div>
      </div>
      <div class="modal-confirm-actions">
        <button type="button" class="btn-modal-cancel" id="btnEncerramentoCancel">Cancelar</button>
        <button type="button" class="btn-modal-confirm-danger btn-modal-success" id="btnEncerramentoConfirmar">
          <i class="fa-solid fa-flag-checkered"></i> <span>Sim, Encerrar e Consolidar</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  function fechar() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  overlay.querySelector('#btnEncerramentoClose').addEventListener('click', fechar);
  overlay.querySelector('#btnEncerramentoCancel').addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fechar();
  });

  const btnConfirmar = overlay.querySelector('#btnEncerramentoConfirmar');
  btnConfirmar.addEventListener('click', async () => {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Consolidando Pontos...`;

    // Atualiza botões visíveis de encerramento na página
    const todosBtnsEnc = document.querySelectorAll('#btnToolbarEncerrarTorneio, #btnEncerrarConsolidarTorneio');
    todosBtnsEnc.forEach(b => {
      b.disabled = true;
      b.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Consolidando...`;
    });

    try {
      const partidasTorneio = await carregarPartidasTorneio(torneioId);
      const confirmados = await buscarParticipantesConfirmados(torneioId);

      const statsMap = new Map();

      // 1. Inicializa estatísticas dos participantes confirmados
      confirmados.forEach(c => {
        const nomeClean = removerTagNome(c.nome || c.equipe_nome || c.user_email || '');
        const realId = String(c.realId || c.user_email || c.equipe_id || c.id || '').trim();
        const email = String(c.user_email || (c.tipo !== 'equipe' ? realId : '')).trim().toLowerCase();
        const equipeId = String(c.equipe_id || (c.tipo === 'equipe' ? realId : '')).trim();

        const participantObj = {
          nome: nomeClean,
          email: email,
          realId: realId,
          equipe_id: equipeId,
          tipo: c.tipo || (equipeId ? 'equipe' : 'individual'),
          lineup: c.lineup || [],
          wins: 0,
          losses: 0,
          totalPlacar: 0,
          placarSofrido: 0,
          participations: 1, // +1 torneio disputado
          isCampeao: false,
          isVice: false
        };

        if (realId) statsMap.set(realId.toLowerCase(), participantObj);
        if (email) statsMap.set(email, participantObj);
        if (equipeId) statsMap.set(equipeId.toLowerCase(), participantObj);
        if (nomeClean) statsMap.set(nomeClean.toLowerCase(), participantObj);
      });

      // 2. Analisa partidas reais para contabilizar vitórias (+1 por partida ganha) e derrotas (+1 por partida perdida)
      let partidaFinal = null;
      partidasTorneio.forEach(p => {
        const p1Clean = removerTagNome(p.p1_nome || '');
        const p2Clean = removerTagNome(p.p2_nome || '');
        const p1Id = String(p.p1_id || '').trim().toLowerCase();
        const p2Id = String(p.p2_id || '').trim().toLowerCase();

        let entry1 = statsMap.get(p1Id) || statsMap.get(p1Clean.toLowerCase());
        if (!entry1 && p1Clean && p1Clean !== 'A definir' && !p1Clean.startsWith('Competidor')) {
          entry1 = { nome: p1Clean, email: p1Id.includes('@') ? p1Id : '', realId: p1Id, equipe_id: '', wins: 0, losses: 0, totalPlacar: 0, placarSofrido: 0, participations: 1, isCampeao: false, isVice: false };
          if (p1Id) statsMap.set(p1Id, entry1);
          statsMap.set(p1Clean.toLowerCase(), entry1);
        }

        let entry2 = statsMap.get(p2Id) || statsMap.get(p2Clean.toLowerCase());
        if (!entry2 && p2Clean && p2Clean !== 'A definir' && !p2Clean.startsWith('Competidor')) {
          entry2 = { nome: p2Clean, email: p2Id.includes('@') ? p2Id : '', realId: p2Id, equipe_id: '', wins: 0, losses: 0, totalPlacar: 0, placarSofrido: 0, participations: 1, isCampeao: false, isVice: false };
          if (p2Id) statsMap.set(p2Id, entry2);
          statsMap.set(p2Clean.toLowerCase(), entry2);
        }

        const sc1 = Number(p.p1_placar) || 0;
        const sc2 = Number(p.p2_placar) || 0;

        if (entry1) { entry1.totalPlacar += sc1; entry1.placarSofrido += sc2; }
        if (entry2) { entry2.totalPlacar += sc2; entry2.placarSofrido += sc1; }

        let winnerEntry = null;
        if (p.vencedor_id) {
          const vId = String(p.vencedor_id).trim().toLowerCase();
          winnerEntry = statsMap.get(vId) || (vId === p1Id ? entry1 : (vId === p2Id ? entry2 : null));
          if (!winnerEntry) {
            const vNome = removerTagNome(p.vencedor_id).toLowerCase();
            winnerEntry = statsMap.get(vNome);
          }
        }
        if (!winnerEntry && (p.status === 'Encerrado' || p.status === 'Encerrada')) {
          if (sc1 > sc2) winnerEntry = entry1;
          else if (sc2 > sc1) winnerEntry = entry2;
        }

        if (winnerEntry) {
          winnerEntry.wins += 1;
          const loserEntry = (winnerEntry === entry1) ? entry2 : (winnerEntry === entry2 ? entry1 : null);
          if (loserEntry) {
            loserEntry.losses += 1;
          }
        }

        if (p.rodada === 4 || (p.nome_rodada && p.nome_rodada.toLowerCase().includes('final') && !p.nome_rodada.toLowerCase().includes('semi') && !p.nome_rodada.toLowerCase().includes('3º'))) {
          partidaFinal = p;
        }
      });

      // 3. Critério Oficial de Classificação e Desempate
      const ranking = Array.from(new Set(statsMap.values()));
      ranking.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const saldoB = (b.totalPlacar || 0) - (b.placarSofrido || 0);
        const saldoA = (a.totalPlacar || 0) - (a.placarSofrido || 0);
        if (saldoB !== saldoA) return saldoB - saldoA;
        if (b.totalPlacar !== a.totalPlacar) return b.totalPlacar - a.totalPlacar;
        return a.nome.localeCompare(b.nome);
      });

      // Verifica se há empate perfeito
      const isEmpatePerfeito = Boolean(
        ranking.length >= 2 &&
        ranking[0].wins === ranking[1].wins &&
        ((ranking[0].totalPlacar - ranking[0].placarSofrido) === (ranking[1].totalPlacar - ranking[1].placarSofrido))
      );

      if (partidaFinal && !isEmpatePerfeito) {
        const p1Name = removerTagNome(partidaFinal.p1_nome || '');
        const p2Name = removerTagNome(partidaFinal.p2_nome || '');
        let winFinal = '';
        if (partidaFinal.vencedor_id === partidaFinal.p1_id || partidaFinal.vencedor_id === partidaFinal.p1_nome) winFinal = p1Name;
        else if (partidaFinal.vencedor_id === partidaFinal.p2_id || partidaFinal.vencedor_id === partidaFinal.p2_nome) winFinal = p2Name;
        else if ((partidaFinal.p1_placar ?? 0) > (partidaFinal.p2_placar ?? 0)) winFinal = p1Name;
        else if ((partidaFinal.p2_placar ?? 0) > (partidaFinal.p1_placar ?? 0)) winFinal = p2Name;

        if (winFinal) {
          const loseFinal = (winFinal.toLowerCase() === p1Name.toLowerCase()) ? p2Name : p1Name;
          const idxW = ranking.findIndex(r => r.nome.toLowerCase() === winFinal.toLowerCase());
          const idxL = ranking.findIndex(r => r.nome.toLowerCase() === loseFinal.toLowerCase());
          if (idxW !== -1 && idxL !== -1) {
            const itemW = ranking.splice(idxW, 1)[0];
            ranking.unshift(itemW);
            const newIdxL = ranking.findIndex(r => r.nome.toLowerCase() === loseFinal.toLowerCase());
            if (newIdxL > 1) {
              const itemL = ranking.splice(newIdxL, 1)[0];
              ranking.splice(1, 0, itemL);
            }
          }
        }
      }

      if (isEmpatePerfeito) {
        ranking[0].isCoCampeao = true;
        ranking[1].isCoCampeao = true;
      } else {
        if (ranking[0]) ranking[0].isCampeao = true;
        if (ranking[1]) ranking[1].isVice = true;
      }

      // 4. Verifica modalidade do Torneio (Solo vs Equipe)
      const { data: dbTorneio } = await supabase.from('torneios').select('*').eq('id', String(torneioId)).maybeSingle();
      const isTorneioEquipe = Boolean(
        (dbTorneio && (
          (dbTorneio.tipoInscricao && dbTorneio.tipoInscricao.toLowerCase().includes('equipe')) ||
          (Number(dbTorneio.maxIntegrantes) > 1)
        )) ||
        confirmados.some(c => c.tipo === 'equipe' || Boolean(c.equipe_id))
      );

      const { data: usuariosDb } = await supabase.from('usuarios').select('*');
      const userList = Array.isArray(usuariosDb) ? usuariosDb : [];

      const { data: equipesDb } = await supabase.from('equipes').select('*');
      const equipeList = Array.isArray(equipesDb) ? equipesDb : [];

      // 5. Consolidação de Estatísticas e Classificação Oficial
      for (const data of ranking) {
        if (isTorneioEquipe) {
          // --- TORNEIO DE EQUIPE: Título e Pontuação vão EXCLUSIVAMENTE para public.equipes ---
          const dbEquipe = equipeList.find(eq =>
            (data.equipe_id && String(eq.id) === String(data.equipe_id)) ||
            (data.realId && String(eq.id) === String(data.realId)) ||
            (data.nome && removerTagNome(eq.nome).toLowerCase() === data.nome.toLowerCase())
          );

          if (dbEquipe) {
            let eqStats = dbEquipe.stats || {};
            if (typeof eqStats === 'string') { try { eqStats = JSON.parse(eqStats); } catch { eqStats = {}; } }

            const curEqPts = safeNum(eqStats.points ?? eqStats.pontos ?? 0);
            const curEqWins = safeNum(eqStats.wins ?? eqStats.vitorias ?? 0);
            const curEqLosses = safeNum(eqStats.losses ?? eqStats.derrotas ?? 0);
            const curEqDisputed = safeNum(eqStats.disputed ?? eqStats.torneios_disputados ?? 0);
            const curEqWon = safeNum(eqStats.won ?? eqStats.torneios_vencidos ?? 0);

            let torneiosGanhosArr = dbEquipe.torneiosGanhos || [];
            if (typeof torneiosGanhosArr === 'string') {
              try { torneiosGanhosArr = JSON.parse(torneiosGanhosArr); } catch { torneiosGanhosArr = []; }
            }
            if (!Array.isArray(torneiosGanhosArr)) torneiosGanhosArr = [];

            let ptsAdd = 0;
            let isWon = false;
            let colocacaoStr = '';

            if (data.isCampeao || data.isCoCampeao) {
              ptsAdd = 500;
              isWon = true;
              colocacaoStr = '1º Lugar';
            } else if (data.isVice) {
              ptsAdd = 250;
              colocacaoStr = '2º Lugar';
            }

            if (colocacaoStr) {
              torneiosGanhosArr.push({
                id: dbTorneio?.id ? String(dbTorneio.id) : String(torneioId),
                nome: dbTorneio?.nome || `Torneio #${torneioId}`,
                data: dbTorneio?.data || new Date().toISOString(),
                colocacao: colocacaoStr,
                banner: dbTorneio?.banner || ''
              });
            }

            const newEqPts = curEqPts + ptsAdd;
            const newEqWins = curEqWins + data.wins;
            const newEqLosses = curEqLosses + data.losses;
            const newEqDisputed = curEqDisputed + 1; // +1 torneio disputado
            const newEqWon = curEqWon + (isWon ? 1 : 0);

            const updatedEqStats = {
              points: newEqPts,
              wins: newEqWins,
              losses: newEqLosses,
              disputed: newEqDisputed,
              won: newEqWon
            };

            // Atualiza na tabela 'equipes' (salvando torneiosGanhos e testando stats com fallback seguro)
            try {
              const { error: eqErr } = await supabase.from('equipes').update({
                torneiosGanhos: torneiosGanhosArr,
                stats: updatedEqStats
              }).eq('id', dbEquipe.id);

              if (eqErr) {
                // Caso a coluna stats não exista no schema remoto de equipes, atualiza somente torneiosGanhos
                await supabase.from('equipes').update({
                  torneiosGanhos: torneiosGanhosArr
                }).eq('id', dbEquipe.id);
              }
            } catch (eqUpErr) {
              console.warn('Aviso ao atualizar equipe no Supabase, tentando fallback simples:', eqUpErr);
              await supabase.from('equipes').update({
                torneiosGanhos: torneiosGanhosArr
              }).eq('id', dbEquipe.id);
            }

            // Jogadores das line-ups inscritas: incrementam +1 torneio disputado ('disputed') em 'stats'
            const memberEmails = new Set();
            if (dbEquipe.leaderEmail) memberEmails.add(dbEquipe.leaderEmail.toLowerCase().trim());
            if (Array.isArray(data.lineup)) {
              data.lineup.forEach(m => {
                const em = typeof m === 'string' ? m : (m.email || m.user_email);
                if (em) memberEmails.add(String(em).toLowerCase().trim());
              });
            }

            try {
              const { data: membrosDb } = await supabase.from('membros_equipe').select('user_email').eq('equipe_id', dbEquipe.id).eq('status', 'Aceito');
              (membrosDb || []).forEach(m => {
                if (m.user_email) memberEmails.add(m.user_email.toLowerCase().trim());
              });
            } catch (mErr) {}

            for (const mEmail of memberEmails) {
              const dbUser = userList.find(u => u.email && u.email.trim().toLowerCase() === mEmail);
              if (dbUser) {
                let uStats = dbUser.stats || {};
                if (typeof uStats === 'string') { try { uStats = JSON.parse(uStats); } catch { uStats = {}; } }

                const curUPts = safeNum(dbUser.pontos || uStats.points || 0);
                const curUWins = safeNum(dbUser.vitorias || uStats.wins || 0);
                const curULosses = safeNum(dbUser.derrotas || uStats.losses || 0);
                const curUDisputed = safeNum(dbUser.torneios_disputados || uStats.disputed || 0);
                const curUWon = safeNum(uStats.won || 0);

                const newUWins = curUWins + data.wins;
                const newULosses = curULosses + data.losses;
                const newUDisputed = curUDisputed + 1; // +1 torneio disputado

                const updatedUStats = {
                  ...uStats,
                  points: curUPts,
                  wins: newUWins,
                  losses: newULosses,
                  disputed: newUDisputed,
                  won: curUWon
                };

                const userCol = dbUser.id ? 'id' : 'email';
                const userVal = dbUser.id || dbUser.email;

                try {
                  await supabase.from('usuarios').update({
                    vitorias: newUWins,
                    derrotas: newULosses,
                    torneios_disputados: newUDisputed,
                    stats: updatedUStats
                  }).eq(userCol, userVal);
                } catch (uErr) {
                  console.warn('Aviso ao atualizar integrante da equipe:', uErr);
                  await supabase.from('usuarios').update({ stats: updatedUStats }).eq(userCol, userVal);
                }
              }
            }
          }
        } else {
          // --- TORNEIO SOLO: Título e Pontuação vão diretamente para public.usuarios ---
          const dbUser = userList.find(u =>
            (data.email && u.email && u.email.trim().toLowerCase() === data.email) ||
            (data.realId && u.email && u.email.trim().toLowerCase() === data.realId.toLowerCase()) ||
            (data.realId && u.id && String(u.id) === String(data.realId)) ||
            (data.nome && u.nome && u.nome.trim().toLowerCase() === data.nome.toLowerCase())
          );

          if (dbUser) {
            let uStats = dbUser.stats || {};
            if (typeof uStats === 'string') { try { uStats = JSON.parse(uStats); } catch { uStats = {}; } }

            const curUPts = safeNum(uStats.points ?? dbUser.pontos ?? 0);
            const curUWins = safeNum(uStats.wins ?? dbUser.vitorias ?? 0);
            const curULosses = safeNum(uStats.losses ?? dbUser.derrotas ?? 0);
            const curUDisputed = safeNum(uStats.disputed ?? dbUser.torneios_disputados ?? 0);
            const curUWon = safeNum(uStats.won ?? 0);

            let bonusPts = 0;
            let isWon = false;

            if (data.isCampeao || data.isCoCampeao) {
              bonusPts = 500;
              isWon = true;
            } else if (data.isVice) {
              bonusPts = 250;
            }

            const newUPts = curUPts + bonusPts;
            const newUWins = curUWins + data.wins;
            const newULosses = curULosses + data.losses;
            const newUDisputed = curUDisputed + 1; // +1 torneio disputado
            const newUWon = curUWon + (isWon ? 1 : 0);

            const updatedUStats = {
              ...uStats,
              points: newUPts,
              wins: newUWins,
              losses: newULosses,
              disputed: newUDisputed,
              won: newUWon
            };

            const userUpdatePayload = {
              pontos: newUPts,
              vitorias: newUWins,
              derrotas: newULosses,
              torneios_disputados: newUDisputed,
              stats: updatedUStats
            };

            const targetCol = dbUser.id ? 'id' : 'email';
            const targetVal = dbUser.id || dbUser.email;

            try {
              const { error: upErr } = await supabase.from('usuarios').update(userUpdatePayload).eq(targetCol, targetVal);
              if (upErr) {
                console.warn('Aviso no update de usuario solo, tentando fallback seguro de stats:', upErr);
                await supabase.from('usuarios').update({ stats: updatedUStats }).eq(targetCol, targetVal);
              }
            } catch (eUp) {
              await supabase.from('usuarios').update({ stats: updatedUStats }).eq(targetCol, targetVal);
            }
          }
        }
      }

      // 5. Altera status do torneio para 'Encerrado'
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
            console.warn('[VersusHub Notificações] Aviso ao buscar inscrições para notificação de encerramento:', errInsc?.message || errInsc);
          } else if (Array.isArray(inscricoesTorneio)) {
            inscricoesTorneio.forEach(i => {
              if (i.user_email && i.user_email.includes('@')) emailsSet.add(i.user_email.toLowerCase().trim());
              if (i.id_participante && i.id_participante.includes('@')) emailsSet.add(i.id_participante.toLowerCase().trim());
            });
          }
        } catch (eInscQuery) {
          console.warn('[VersusHub Notificações] Aviso ao consultar tabela de inscrições:', eInscQuery?.message || eInscQuery);
        }

        const emailsList = Array.from(emailsSet).filter(Boolean);
        if (emailsList.length > 0) {
          for (const email of emailsList) {
            try {
              const payload = {
                user_email: email,
                titulo: 'Torneio Encerrado!',
                mensagem: `O torneio "${nomeDoTorneio}" foi finalizado e os campeões foram consolidados!`,
                tipo: 'torneio',
                link: `/torneio/custom.html?id=${encodeURIComponent(torneioId)}`,
                lida: false
              };
              if (typeof window.enviarNotificacao === 'function') {
                await window.enviarNotificacao(payload);
              } else {
                const { error: errNotif } = await supabase.from('notificacoes').insert([payload]);
                if (errNotif) console.warn('[VersusHub Notificações] Aviso ao gravar notificação para', email, errNotif?.message || errNotif);
              }
            } catch (errNotifLoop) {
              console.warn('[VersusHub Notificações] Aviso ao gravar notificação para', email, errNotifLoop?.message || errNotifLoop);
            }
          }
        } else {
          console.warn('[VersusHub Notificações] Nenhum e-mail de participante encontrado para o torneio:', torneioId);
        }
      } catch (eNotifEnc) {
        console.warn('[VersusHub Notificações] Aviso geral ao disparar notificações de encerramento:', eNotifEnc?.message || eNotifEnc);
      }

      try {
        const created = JSON.parse(localStorage.getItem('vh_createdTournaments') || '[]');
        created.forEach(t => {
          if (String(t.id) === String(torneioId)) {
            t.status = 'Encerrado';
            t.statusClass = 'status-encerrado';
          }
        });
        localStorage.setItem('vh_createdTournaments', JSON.stringify(created));
      } catch (e) {}

      showBracketToast('Torneio encerrado e pontuação consolidada com sucesso!');
      fechar();

      document.dispatchEvent(new CustomEvent('versus:torneio-encerrado', { detail: { torneioId } }));
      document.dispatchEvent(new CustomEvent('versus:bracket-updated', { detail: { torneioId } }));

      if (typeof onConcluido === 'function') {
        onConcluido();
      } else {
        setTimeout(() => { window.location.reload(); }, 1200);
      }
    } catch (err) {
      console.error('Erro ao consolidar torneio:', err);
      showBracketToast('Erro ao consolidar pontuação do torneio.', 'error');
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> <span>Sim, Encerrar e Consolidar</span>`;
      todosBtnsEnc.forEach(b => {
        b.disabled = false;
        b.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> Encerrar Torneio e Consolidar Pontos`;
      });
    }
  });
}

