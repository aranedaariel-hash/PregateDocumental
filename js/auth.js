// ══ AUTH — Supabase email/password ══

function updateAuthUI(connected, email = '', rol = '') {
  const dot = document.getElementById('auth-dot');
  const txt = document.getElementById('auth-text');
  const roleText = document.getElementById('auth-role-text');
  const btnLabel = document.getElementById('auth-btn-label');
  const badge = document.getElementById('role-badge');
  if (connected) {
    dot.classList.add('connected');
    txt.textContent = email.split('@')[0];
    if (roleText) roleText.textContent = ' · ' + (rol === 'admin' ? 'Admin' : 'Auditor');
    if (btnLabel) btnLabel.textContent = 'Cerrar sesión';
    if (badge) {
      badge.textContent = rol === 'admin' ? 'ADMIN' : 'AUDITOR';
      badge.style.display = 'inline-block';
      badge.style.background = rol === 'admin' ? 'rgba(167,139,250,0.18)' : 'rgba(59,130,246,0.12)';
      badge.style.color = rol === 'admin' ? '#a78bfa' : 'var(--accent)';
    }
    // Mostrar botón de usuarios solo para admin
    const usersBtn = document.getElementById('btn-users');
    if (usersBtn) usersBtn.style.display = rol === 'admin' ? 'flex' : 'none';
    // Botón de cambio de contraseña para cualquier usuario logueado
    const passBtn = document.getElementById('btn-pass');
    if (passBtn) passBtn.style.display = 'flex';
  } else {
    dot.classList.remove('connected');
    txt.textContent = 'No conectado';
    if (roleText) roleText.textContent = '';
    if (btnLabel) btnLabel.textContent = 'Conectar';
    if (badge) badge.style.display = 'none';
    const usersBtn = document.getElementById('btn-users');
    if (usersBtn) usersBtn.style.display = 'none';
    const passBtn = document.getElementById('btn-pass');
    if (passBtn) passBtn.style.display = 'none';
  }
}

async function doLogin() {
  const email = (document.getElementById('l-user').value || '').trim();
  const pass  = (document.getElementById('l-pass').value  || '').trim();
  const errEl = document.getElementById('login-error');
  const card  = document.getElementById('login-card');

  if (!email || !pass) {
    errEl.textContent = 'Ingresá email y contraseña';
    return;
  }

  errEl.textContent = '';
  try {
    const { user } = await sbSignIn(email, pass);
    await onLoginSuccess(user);
  } catch (e) {
    errEl.textContent = 'Email o contraseña incorrectos';
    card.classList.remove('login-shake');
    void card.offsetWidth;
    card.classList.add('login-shake');
    document.getElementById('l-pass').value = '';
    document.getElementById('l-pass').focus();
  }
}

async function doLogout() {
  await sbSignOut();
  currentUser = null;
  db = { chofer: [], tractor: [], semi: [], transporte: [] };
  updateCounts();
  updateAuthUI(false);
  document.getElementById('l-user').value = '';
  document.getElementById('l-pass').value = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-wall').classList.remove('hidden');
  showScreen('s-home');
}

function checkSession() {
  return false; // Supabase session check is async — handled in initApp()
}

// ══ CAMBIO DE CONTRASEÑA (self-service) ══
function openChangePass() {
  const m = document.getElementById('pass-modal');
  if (!m) return;
  document.getElementById('cp-pass1').value = '';
  document.getElementById('cp-pass2').value = '';
  document.getElementById('cp-error').textContent = '';
  m.style.display = 'flex';
  setTimeout(() => document.getElementById('cp-pass1').focus(), 50);
}

function closeChangePass() {
  const m = document.getElementById('pass-modal');
  if (m) m.style.display = 'none';
}

async function submitChangePass() {
  const p1 = document.getElementById('cp-pass1').value;
  const p2 = document.getElementById('cp-pass2').value;
  const errEl = document.getElementById('cp-error');
  const btn = document.getElementById('cp-submit');
  errEl.textContent = '';

  if (p1.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres'; return; }
  if (p1 !== p2)     { errEl.textContent = 'Las contraseñas no coinciden'; return; }

  btn.disabled = true;
  const prevLabel = btn.textContent;
  btn.textContent = 'Guardando…';
  try {
    await sbUpdatePassword(p1);
    closeChangePass();
    showToast('✓ Contraseña actualizada');
  } catch (e) {
    errEl.textContent = 'No se pudo cambiar la contraseña. Volvé a iniciar sesión e intentá de nuevo.';
  } finally {
    btn.disabled = false;
    btn.textContent = prevLabel;
  }
}
