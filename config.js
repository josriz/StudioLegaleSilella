window.STUDIO_SUPABASE_URL = 'https://dscinvstqizfxwrovsbb.supabase.co';
window.STUDIO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aVF8u7kXdbznCYQakC3NqQ_fJQkBZ9';

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('[Studio Auth] Libreria Supabase non disponibile prima di config.js.');
} else if (!window.STUDIO_SUPABASE_CLIENT) {
  window.STUDIO_SUPABASE_CLIENT = window.supabase.createClient(
    window.STUDIO_SUPABASE_URL,
    window.STUDIO_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storageKey: 'silella-studio-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

if (!window.STUDIO_SUPABASE_CLIENT) {
  console.error('[Studio Auth] Client Supabase Studio non inizializzato.');
}
