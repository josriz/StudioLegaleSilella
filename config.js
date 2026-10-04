window.STUDIO_SUPABASE_URL = 'https://dscinvstqizfxwrovsbb.supabase.co';
window.STUDIO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aVF8u7kXdbznCYQakC3NqQ_fJQkBZQ9';

(function () {
  let client = null;
  let initTimer = null;
  let attempts = 0;

  function initStudioSupabase() {
    if (client) return client;

    const sdk = window.supabase || window.Supabase;
    if (!sdk || typeof sdk.createClient !== 'function') {
      attempts += 1;
      if (attempts < 50) {
        clearTimeout(initTimer);
        initTimer = setTimeout(initStudioSupabase, 100);
      } else {
        console.error('[Studio Auth] Supabase JS non disponibile dopo il caricamento.');
      }
      return null;
    }

    try {
      client = sdk.createClient(
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
      window.STUDIO_SUPABASE_CLIENT = client;
      window.getStudioSupabaseClient = function () {
        return client;
      };
      console.info('[Studio Auth] Client Supabase Studio inizializzato correttamente.');
      return client;
    } catch (error) {
      console.error('[Studio Auth] Errore durante createClient().', error);
      return null;
    }
  }

  window.getStudioSupabaseClient = initStudioSupabase;
  initStudioSupabase();
})();