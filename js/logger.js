/* ── LOGGER DE ERRORES ──
   Captura errores JS no manejados y llamadas manuales a logError().
   Guarda en Supabase (tabla error_logs) para ver en el panel admin.
   Regla de oro: el logger NUNCA debe romper la app. Todo va en try/catch. */
(function(){
  var APP_VERSION = 'dt-v1';
  var _sent = {}; /* dedupe: clave → timestamp del último envío */

  function _ctx(){
    return {
      pantalla: location.pathname + (location.search || '') + (location.hash || ''),
      user_agent: navigator.userAgent
    };
  }

  async function _send(rec){
    try{
      var sb = (typeof getSB === 'function') ? getSB() : null;
      if(!sb) return;
      var sess = await sb.auth.getSession();
      var user = (sess.data && sess.data.session) ? sess.data.session.user : null;
      await sb.from('error_logs').insert({
        user_id:     user ? user.id    : null,
        user_email:  user ? user.email : null,
        message:     rec.message,
        stack:       rec.stack,
        pantalla:    rec.pantalla,
        user_agent:  rec.user_agent,
        app_version: APP_VERSION
      });
    }catch(e){ /* silencioso — el logger nunca propaga */ }
  }

  /* logError(mensaje, detalle)
     - mensaje: texto corto legible
     - detalle: un Error, un string, o un objeto (se serializa) */
  function logError(message, detail){
    try{
      var msg = String(message || 'Error desconocido').slice(0, 500);
      var key = msg.slice(0, 120);
      var now = Date.now();
      if(_sent[key] && (now - _sent[key]) < 10000) return; /* mismo error en <10s: ignorar */
      _sent[key] = now;

      var stack = '';
      if(detail){
        if(detail instanceof Error && detail.stack) stack = detail.stack;
        else if(typeof detail === 'string') stack = detail;
        else { try{ stack = JSON.stringify(detail); }catch(e){ stack = String(detail); } }
      }
      var c = _ctx();
      _send({ message: msg, stack: stack.slice(0, 3000), pantalla: c.pantalla, user_agent: c.user_agent });
    }catch(e){ /* nunca propagar */ }
  }

  window.logError = logError;

  /* Errores JS no capturados */
  window.addEventListener('error', function(e){
    var msg = e.message || (e.error && e.error.message) || 'Error de JavaScript';
    var det = e.error || (e.filename ? (e.filename + ':' + e.lineno + ':' + e.colno) : null);
    logError(msg, det);
  });

  /* Promesas rechazadas sin catch */
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason;
    var msg = (r && r.message) ? r.message : ('Promesa rechazada: ' + String(r));
    logError(msg, r);
  });
})();
