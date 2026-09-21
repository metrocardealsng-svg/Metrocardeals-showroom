window.SUPABASE_URL = 'https://axbyxdpdccbwyxncqvkg.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Ynl4ZHBkY2Nid3l4bmNxdmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTI2ODYsImV4cCI6MjEwNTQ4ODY4Nn0.zTlD54vqH7WyFmKc3pvwcy1hPolGLghH_a-HoOEf5jg';

window.metroSupabase = (function () {
  let client = null;
  return function () {
    if (!client) client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return client;
  };
})();
