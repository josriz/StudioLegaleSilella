window.STUDIO_SUPABASE_URL = 'https://dscinvstqizfxwrovsbb.supabase.co';
window.STUDIO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aVF8u7kXdbznCYQakC3NqQ_fJQkBZQ9';

let __studioSupabaseClient = null;

window.getStudioSupabaseClient = function () {
  if (__studioSupabaseClient) return __studioSupabaseClient;

  const sdk = window.supabase || window.Supabase;

  if (!sdk || typeof sdk.createClient !== 'function') {
    console.error('[Studio Auth] Supabase JS non disponibile quando viene richiesto il client.', {
      hasSupabase: !!window.supabase,
      hasSupabaseUpper: !!window.Supabase
    });
    return null;
  }

  try {
    __studioSupabaseClient = sdk.createClient(
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
    window.STUDIO_SUPABASE_CLIENT = __studioSupabaseClient;
    return __studioSupabaseClient;
  } catch (error) {
    console.error('[Studio Auth] Errore durante createClient().', error);
    return null;
  }
};

// Un solo client condiviso per tutta l'Area Studio.
// Il client viene creato una sola volta, anche se un modulo lo richiede prima.
window.getStudioSupabaseClient();
