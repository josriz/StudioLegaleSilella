// Supabase configuration for Studio Legale Silella
window.STUDIO_SUPABASE_URL = 'https://dscinvstqizfxwrovsbb.supabase.co';
window.STUDIO_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzY2ludnN0cWl6Znh3cm92c2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4Njk5MzQsImV4cCI6MjEwNjQ0NTkzNH0.sNcJG2VFGH3BLykctpo0GERWD2NQId2dSfAL7U_Vi-E';

window.getStudioSupabaseClient = function(){
  if(!window.supabase?.createClient) return null;
  if(window.__studioSupabaseClient) return window.__studioSupabaseClient;
  window.__studioSupabaseClient = window.supabase.createClient(
    window.STUDIO_SUPABASE_URL,
    window.STUDIO_SUPABASE_PUBLISHABLE_KEY,
    { auth: { ...(window.matchMedia?.('(max-width: 900px)').matches ? { storageKey: 'silella-studio-mobile-auth' } : {}), persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  window.STUDIO_SUPABASE_CLIENT = window.__studioSupabaseClient;
  return window.__studioSupabaseClient;
};

window.studioSupabaseReady = Promise.resolve(window.getStudioSupabaseClient());
