// Supabase configuration for Studio Legale Silella
window.STUDIO_SUPABASE_URL = 'https://dscinvstqizfxwrovsbb.supabase.co';
window.STUDIO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aVF8u7kXdbznCYQakC3NqQ_fJQkBZQ9';

window.getStudioSupabaseClient = function(){
  if(!window.supabase?.createClient) return null;
  if(window.__studioSupabaseClient) return window.__studioSupabaseClient;
  window.__studioSupabaseClient = window.supabase.createClient(
    window.STUDIO_SUPABASE_URL,
    window.STUDIO_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  window.STUDIO_SUPABASE_CLIENT = window.__studioSupabaseClient;
  return window.__studioSupabaseClient;
};

window.studioSupabaseReady = Promise.resolve(window.getStudioSupabaseClient());
