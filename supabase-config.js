window.SUPABASE_URL = 'REPLACE_WITH_YOUR_SUPABASE_PROJECT_URL';
window.SUPABASE_ANON_KEY = 'REPLACE_WITH_YOUR_SUPABASE_ANON_PUBLIC_KEY';

window.metroSupabase = (function () {
  let client = null;
  return function () {
    if (!client) client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return client;
  };
})();
