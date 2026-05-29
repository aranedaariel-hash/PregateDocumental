// ══ AUTH ══
function handleAuth(){
  if(accessToken){ signOut(); return; }
  requestToken(false);
}

function requestToken(silent){
  const base = window.location.href.split('?')[0].split('#')[0];
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: base,
    response_type: 'token',
    scope: SCOPES,
    prompt: silent ? 'none' : 'select_account'
  });
  if(silent){
    // Silent refresh via hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
    iframe.onload = ()=>{
      try {
        const hash = iframe.contentWindow.location.hash;
        const p = new URLSearchParams(hash.substring(1));
        const token = p.get('access_token');
        if(token){ accessToken = token; document.body.removeChild(iframe); initDrive(); }
        else { document.body.removeChild(iframe); }
      } catch(e){ document.body.removeChild(iframe); }
    };
    document.body.appendChild(iframe);
  } else {
    // Save current state before redirect
    localStorage.setItem('dct-db', JSON.stringify(db));
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
  }
}

function signOut(){
  accessToken = null;
  rootFolderId = null;
  subFolderIds = {};
  stateFileId = null;
  localStorage.removeItem('dct-auth');
  updateAuthUI(false);
  updateCounts();
  showToast('Sesión cerrada');
}

function updateAuthUI(connected, email=''){
  const dot = document.getElementById('auth-dot');
  const txt = document.getElementById('auth-text');
  const btn = document.getElementById('auth-btn');
  if(connected){
    dot.classList.add('connected');
    txt.textContent = email ? `Conectado · ${email}` : 'Conectado a Google Drive';
    btn.textContent = 'Desconectar';
    if(email) localStorage.setItem('dct-auth', JSON.stringify({email}));
  } else {
    dot.classList.remove('connected');
    txt.textContent = 'No conectado a Google Drive';
    btn.textContent = 'Conectar';
  }
}

async function checkTokenFromUrl(){
  const hash = window.location.hash;
  if(hash){
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if(token){
      window.history.replaceState(null,'',window.location.pathname);
      accessToken = token;
      const saved = localStorage.getItem('dct-db');
      if(saved){ try{ db = JSON.parse(saved); updateCounts(); }catch(e){} }
      updateAuthUI(true);
      showToast('Conectando con Drive…');
      await initDrive();
      return;
    }
  }
  // Restore db from localStorage
  const saved = localStorage.getItem('dct-db');
  if(saved){ try{ db = JSON.parse(saved); updateCounts(); }catch(e){} }
  // Auto-reconnect silently if previously logged in
  const auth = localStorage.getItem('dct-auth');
  if(auth){
    try{
      const {email} = JSON.parse(auth);
      updateAuthUI(false);
      const txt = document.getElementById('auth-text');
      if(txt) txt.textContent = `Reconectando con Drive…`;
      // Silent reconnect via prompt=none redirect
      const base = window.location.href.split('?')[0].split('#')[0];
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: base,
        response_type: 'token',
        scope: SCOPES,
        prompt: 'none',
        login_hint: email
      });
      // Save current db before redirecting so nothing is lost
      localStorage.setItem('dct-db', JSON.stringify(db));
      window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
    }catch(e){}
  }
}

function doLogin(){
  const u = (document.getElementById('l-user').value||'').trim().toLowerCase();
  const p = (document.getElementById('l-pass').value||'').trim();
  const match = USERS.find(x=>x.user===u && x.pass===p);
  const errEl = document.getElementById('login-error');
  const card  = document.getElementById('login-card');
  if(match){
    errEl.textContent='';
    sessionStorage.setItem('dct-session', JSON.stringify({user:match.user, role:match.role}));
    document.getElementById('login-wall').classList.add('hidden');
    // Show username in home
    const authTxt = document.getElementById('auth-text');
    if(authTxt && authTxt.textContent.includes('No conectado')){
      // will be overwritten by Drive connection later — leave it
    }
    // Continue normal init
    checkTokenFromUrl();
  } else {
    errEl.textContent='Usuario o contraseña incorrectos';
    card.classList.remove('login-shake');
    void card.offsetWidth; // reflow to restart animation
    card.classList.add('login-shake');
    document.getElementById('l-pass').value='';
    document.getElementById('l-pass').focus();
  }
}

function checkSession(){
  const s = sessionStorage.getItem('dct-session');
  if(s){
    try {
      const {user} = JSON.parse(s);
      document.getElementById('login-wall').classList.add('hidden');
      return true;
    } catch(e){}
  }
  return false;
}

function doLogout(){
  sessionStorage.removeItem('dct-session');
  // Reset UI
  document.getElementById('l-user').value='';
  document.getElementById('l-pass').value='';
  document.getElementById('login-error').textContent='';
  document.getElementById('login-wall').classList.remove('hidden');
  // Sign out of Drive too
  if(accessToken) signOut();
}
