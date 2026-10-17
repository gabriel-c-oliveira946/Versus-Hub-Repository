// /auth.js - Módulo unificado de autenticação e gerenciamento de sessões VersusHub
import {
  supabase,
  getActiveSession,
  requireAuth,
  getActiveUser,
  logoutUser,
  sanitizeUserForStorage,
  saveLoggedUser,
  ensureUserProfile
} from '/supabaseClient.js';

export {
  supabase,
  getActiveSession,
  requireAuth,
  getActiveUser,
  logoutUser,
  sanitizeUserForStorage,
  saveLoggedUser,
  ensureUserProfile
};

/**
 * Autenticação via e-mail e senha com Supabase Auth
 */
export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data?.user) {
    const profile = await ensureUserProfile(data.user);
    const userObj = {
      id: profile?.id || data.user.id,
      nome: profile?.nome || data.user.user_metadata?.nome || email.split('@')[0],
      email: email,
      avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
      regiao: profile?.regiao || 'Brasil',
      stats: profile?.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
      auth_id: data.user.id
    };
    saveLoggedUser(userObj);
    return userObj;
  }
  return null;
}

/**
 * Cadastro de novo usuário via Supabase Auth
 */
export async function signUpUser(email, password, nome) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, display_name: nome, full_name: nome }
    }
  });
  if (error) throw error;
  if (data?.user) {
    const profile = await ensureUserProfile(data.user);
    const userObj = {
      id: profile?.id || data.user.id,
      nome: profile?.nome || nome,
      email: email,
      avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
      regiao: profile?.regiao || 'Brasil',
      stats: profile?.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
      auth_id: data.user.id
    };
    saveLoggedUser(userObj);
    return userObj;
  }
  return null;
}

if (typeof window !== 'undefined') {
  window.getActiveSession = getActiveSession;
  window.requireAuth = requireAuth;
  window.getActiveUser = getActiveUser;
  window.logoutUser = logoutUser;
  window.sanitizeUserForStorage = sanitizeUserForStorage;
  window.saveLoggedUser = saveLoggedUser;
  window.signInUser = signInUser;
  window.signUpUser = signUpUser;
}
