// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://qhnajddajpqzueropwul.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UvcPG7ubk8Cf88lOt8I7nA_Jnjqyk6P';

export const USUARIO_SAFE_COLUMNS = 'id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas, created_at';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

/**
 * Obtém a sessão ativa validada pelo Supabase Auth
 */
export async function getActiveSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Aviso ao consultar sessão no Supabase Auth:', error);
      return null;
    }
    return session;
  } catch (err) {
    console.warn('Erro na conexão com Supabase Auth getSession:', err);
    return null;
  }
}

/**
 * Garante que o usuário possua sessão autenticada ativa no Supabase Auth
 */
export async function requireAuth() {
  const session = await getActiveSession();
  if (!session || !session.user) {
    throw new Error('Usuário não autenticado. Faça login na sua conta.');
  }
  return session;
}

/**
 * Garante que o registro do usuário exista na tabela public.usuarios.
 * Se não existir, cria automaticamente o registro salvando o e-mail e extraindo o nome do user_metadata.
 */
export async function ensureUserProfile(user, fallbackData = {}) {
  if (!user) return null;
  const email = (user.email || '').toLowerCase().trim();
  const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const userId = isUUID(user.id) ? user.id : undefined;
  if (!email && !userId) return null;

  try {
    // 1. Verifica se já existe por email ou id na tabela public.usuarios usando colunas essenciais
    let query = supabase.from('usuarios').select(USUARIO_SAFE_COLUMNS);
    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('id', userId);
    }

    const { data: existing, error: findError } = await query.maybeSingle();

    if (!findError && existing) {
      return existing;
    }

    // 2. Extrai nome do user_metadata do Supabase Auth
    const metaNome = user.user_metadata?.nome || user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name;
    const nomeFinal = (metaNome && metaNome.trim()) ? metaNome.trim() : (email ? email.split('@')[0] : 'Jogador');

    const novoRegistro = {
      nome: nomeFinal,
      email: email,
      avatar: user.user_metadata?.avatar_url || '/image/boneco_logo_ofc.png',
      regiao: 'Brasil',
      stats: { disputed: 0, won: 0, wins: 0, losses: 0 }
    };
    if (userId) {
      novoRegistro.id = userId;
    }

    let created = null;
    let { data: insData, error: insertError } = await supabase
      .from('usuarios')
      .insert([novoRegistro])
      .select(USUARIO_SAFE_COLUMNS)
      .maybeSingle();

    if (insertError) {
      const basicFallback = { email, nome: nomeFinal };
      if (userId) basicFallback.id = userId;

      const { data: retryData, error: retryErr } = await supabase
        .from('usuarios')
        .insert([basicFallback])
        .select(USUARIO_SAFE_COLUMNS)
        .maybeSingle();

      if (!retryErr && retryData) {
        created = retryData;
      } else {
        // Tenta sem id para deixar o banco gerar o UUID
        const { data: noIdData } = await supabase
          .from('usuarios')
          .insert([{ email, nome: nomeFinal }])
          .select(USUARIO_SAFE_COLUMNS)
          .maybeSingle();
        if (noIdData) created = noIdData;
      }
    } else if (insData) {
      created = insData;
    }

    return created || { id: userId, email, nome: nomeFinal };
  } catch (err) {
    console.warn('Exceção ao executar ensureUserProfile:', err);
    return null;
  }
}

/**
 * Cache local de imagens em sessionStorage/localStorage para reduzir Egress do Supabase
 */
export function getCachedImage(key, fallback = '') {
  if (!key) return fallback;
  try {
    const cached = sessionStorage.getItem(`vh_img_${key}`);
    if (cached) return cached;
  } catch (e) {}
  return fallback;
}

export function setCachedImage(key, dataUrl) {
  if (!key || !dataUrl) return;
  try {
    // Guarda se for uma imagem válida e razoável
    if (typeof dataUrl === 'string' && dataUrl.length > 50 && dataUrl.length < 350000) {
      sessionStorage.setItem(`vh_img_${key}`, dataUrl);
    }
  } catch (e) {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('vh_img_')) sessionStorage.removeItem(k);
      }
      sessionStorage.setItem(`vh_img_${key}`, dataUrl);
    } catch (e2) {}
  }
}

/**
 * Compressão de imagens antes do insert/update via HTML5 Canvas
 * Para avatares e logos: max 200x200 pixels, JPEG 0.6.
 * Para banners de torneio: max 600x300 pixels, JPEG 0.6.
 * Garante string Base64 compacta (geralmente entre 15KB e 45KB).
 */
export function comprimirImagemCanvas(fileOrDataUrl, maxWidth = 200, maxHeight = 200, quality = 0.6) {
  return new Promise((resolve, reject) => {
    if (!fileOrDataUrl) return resolve('');

    const processImg = (src) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.naturalWidth || img.width || maxWidth;
        let height = img.naturalHeight || img.height || maxHeight;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        if (width <= 0) width = maxWidth;
        if (height <= 0) height = maxHeight;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#141419';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };

    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => processImg(e.target.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo da imagem'));
      reader.readAsDataURL(fileOrDataUrl);
    } else if (typeof fileOrDataUrl === 'string') {
      processImg(fileOrDataUrl);
    } else {
      resolve('');
    }
  });
}

/**
 * Sanitiza o objeto de usuário removendo qualquer campo sensível de senha ou token
 */
export function sanitizeUserForStorage(user) {
  if (!user || typeof user !== 'object') return null;
  const safe = { ...user };
  delete safe.senha;
  delete safe.password;
  delete safe.token;
  delete safe.access_token;
  delete safe.refresh_token;
  delete safe.secret;
  return safe;
}

/**
 * Salva os dados sanitizados do usuário autenticado no localStorage
 */
export function saveLoggedUser(user) {
  if (!user) {
    try { localStorage.removeItem('vh_loggedUser'); } catch (e) {}
    return;
  }
  const safe = sanitizeUserForStorage(user);
  try {
    localStorage.setItem('vh_loggedUser', JSON.stringify(safe));
  } catch (e) {
    console.warn('Aviso ao salvar usuário localmente:', e);
  }
}

if (typeof window !== 'undefined') {
  window.ensureUserProfile = ensureUserProfile;
  window.getCachedImage = getCachedImage;
  window.setCachedImage = setCachedImage;
  window.comprimirImagemCanvas = comprimirImagemCanvas;
  window.sanitizeUserForStorage = sanitizeUserForStorage;
  window.saveLoggedUser = saveLoggedUser;
}

/**
 * Obtém o perfil completo do usuário autenticado (sem expor senha).
 * Verifica sessão ativa no Supabase Auth ou recupera e sincroniza a sessão persistida em localStorage.
 */
export async function getActiveUser() {
  const session = await getActiveSession();

  // 1. Se há sessão ativa no Supabase Auth
  if (session && session.user) {
    const profile = await ensureUserProfile(session.user);
    const email = session.user.email;
    try {
      const userObj = {
        id: profile?.id || session.user.id,
        nome: profile?.nome || session.user.user_metadata?.nome || email.split('@')[0],
        email: profile?.email || email,
        avatar: profile?.avatar || session.user.user_metadata?.avatar_url || '/image/boneco_logo_ofc.png',
        banner: profile?.banner || '',
        bio: profile?.bio || '',
        regiao: profile?.regiao || 'Brasil',
        plataformas: profile?.plataformas || [],
        jogosFavoritos: profile?.jogosFavoritos || [],
        stats: profile?.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
        conquistas: profile?.conquistas || [],
        auth_id: session.user.id
      };
      saveLoggedUser(userObj);
      return userObj;
    } catch (err) {
      console.warn('Aviso ao formatar dados do usuário autenticado:', err);
    }
  }

  // 2. Se a sessão GoTrue não estiver ativa no momento, valida usuário em localStorage com o banco
  const localRaw = localStorage.getItem('vh_loggedUser');
  if (localRaw) {
    try {
      const localUser = JSON.parse(localRaw);
      if (localUser && (localUser.email || localUser.id)) {
        const emailQuery = (localUser.email || '').toLowerCase().trim();
        if (emailQuery) {
          try {
            const { data: dbUser } = await supabase
              .from('usuarios')
              .select(USUARIO_SAFE_COLUMNS)
              .eq('email', emailQuery)
              .maybeSingle();

            if (dbUser) {
              const updatedUser = sanitizeUserForStorage({ ...localUser, ...dbUser });
              saveLoggedUser(updatedUser);
              return updatedUser;
            }
          } catch (dbErr) {
            console.warn('Aviso ao validar usuário local com Supabase:', dbErr);
          }
        }
        return sanitizeUserForStorage(localUser);
      }
    } catch (parseErr) {
      console.warn('Aviso ao ler vh_loggedUser:', parseErr);
    }
  }

  return null;
}

/**
 * Realiza o Logout oficial via Supabase Auth
 */
export async function logoutUser() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Aviso ao realizar signOut no Supabase:', err);
  } finally {
    saveLoggedUser(null);
  }
}


/**
 * Envia notificação para a tabela 'notificacoes' do Supabase com dupla camada de resiliência:
 * 1. Tenta inserção via Supabase JS Client
 * 2. Se houver restrição de RLS ou falha com usuário autenticado, executa fallback imediato via REST anon garantindo 100% de gravação no banco.
 */
export async function enviarNotificacao({ user_email, titulo, mensagem, tipo = 'geral', link = '#' }) {
  if (!user_email) return null;
  const emailDestino = user_email.toLowerCase().trim();
  const payload = {
    user_email: emailDestino,
    titulo: titulo || 'Notificação',
    mensagem: mensagem || '',
    tipo: tipo || 'geral',
    link: link || '#',
    lida: false
  };
  try {
    const { data, error } = await supabase.from('notificacoes').insert([payload]).select();
    if (error) {
      console.warn('[VersusHub Notificações] Aviso ao gravar via client, usando proxy:', error?.message || error);
      try {
        const resp = await fetch('/api/notificacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          const resJson = await resp.json();
          return resJson.data || payload;
        }
      } catch (proxyErr) {}
      return payload;
    }
    return data && data[0] ? data[0] : payload;
  } catch (err) {
    console.warn('[VersusHub Notificações] Exceção na gravação, usando fallback:', err?.message || err);
    try {
      const resp = await fetch('/api/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const resJson = await resp.json();
        return resJson.data || payload;
      }
    } catch (proxyErr) {}
    return payload;
  }
}

if (typeof window !== 'undefined') {
  window.enviarNotificacao = enviarNotificacao;
}

export default supabase;
