// Cliente do Supabase compartilhado pelas páginas. Fica null enquanto js/config.js estiver vazio,
// e o site continua funcionando com o conteúdo fixo da página.
(function () {
  'use strict';
  var cfg = window.PRIME_CONFIG || {};
  var client = null;
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  window.Prime = {
    db: client,
    fotoUrl: function (caminho) {
      if (!caminho) return '';
      if (/^img\//.test(caminho)) return caminho;
      return client ? client.storage.from('fotos').getPublicUrl(caminho).data.publicUrl : '';
    },
    waDigits: function (t) {
      var d = String(t || '').replace(/\D/g, '');
      if (!d) return '';
      return d.length <= 11 ? '55' + d : d;
    }
  };
})();
