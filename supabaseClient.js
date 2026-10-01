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
    throw new Error('Usuário não autenticado. Faça login no Supabase Auth.');
  }
  return session;
}

/**
 * Obtém o perfil completo do usuário autenticado (sem expor senha)
 */
export async function getActiveUser() {
  const session = await getActiveSession();
  if (!session || !session.user) {
    localStorage.removeItem('vh_loggedUser');
    return null;
  }

  const email = session.user.email;
  try {
    const { data: profile } = await supabase
      .from('usuarios')
      .select(USUARIO_SAFE_COLUMNS)
      .eq('email', email)
      .maybeSingle();

    let userObj = null;
    if (profile) {
      userObj = {
        id: profile.id || session.user.id,
        nome: profile.nome || session.user.user_metadata?.nome || email.split('@')[0],
        email: profile.email || email,
        avatar: profile.avatar || '/image/boneco_logo_ofc.png',
        banner: profile.banner || '',
        bio: profile.bio || '',
        regiao: profile.regiao || 'Brasil',
        plataformas: profile.plataformas || [],
        jogosFavoritos: profile.jogosFavoritos || [],
        stats: profile.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
        conquistas: profile.conquistas || [],
        auth_id: session.user.id
      };
    } else {
      userObj = {
        id: session.user.id,
        nome: session.user.user_metadata?.nome || email.split('@')[0],
        email: email,
        avatar: '/image/boneco_logo_ofc.png',
        banner: '',
        bio: '',
        regiao: 'Brasil',
        plataformas: [],
        jogosFavoritos: [],
        stats: { disputed: 0, won: 0, wins: 0, losses: 0 },
        conquistas: [],
        auth_id: session.user.id
      };
    }

    localStorage.setItem('vh_loggedUser', JSON.stringify(userObj));
    return userObj;
  } catch (err) {
    console.warn('Erro ao carregar dados do usuário autenticado:', err);
    const userObj = {
      id: session.user.id,
      nome: session.user.user_metadata?.nome || email.split('@')[0],
      email: email,
      avatar: '/image/boneco_logo_ofc.png',
      auth_id: session.user.id
    };
    localStorage.setItem('vh_loggedUser', JSON.stringify(userObj));
    return userObj;
  }
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
    localStorage.removeItem('vh_loggedUser');
  }
}

export default supabase;
