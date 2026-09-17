// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://qhnajddajpqzueropwul.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UvcPG7ubk8Cf88lOt8I7nA_Jnjqyk6P';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
export default supabase;
