// ══ STATE ══
let db = { chofer: [], tractor: [], semi: [], transporte: [] };
let currentSection   = 'chofer';
let currentEntityId  = null;
let currentDoc       = null;
let capturedPages    = [];
let inputMode        = 'cam';
let currentUser      = null;   // { id, email, rol }

// ══ INIT APP ══
async function initApp() {
  getSB(); // inicializar cliente
  const session = await sbGetSession();
  if (session) {
    await onLoginSuccess(session.user);
  }
  // Sin sesión → login wall queda visible
}

async function onLoginSuccess(user) {
  const rol = await sbGetUserRole(user.id);
  currentUser = { id: user.id, email: user.email, rol };
  document.getElementById('login-wall').classList.add('hidden');
  updateAuthUI(true, user.email, rol);
  showToast('Cargando datos…');
  await loadStateFromDrive();
  showToast('✓ Listo');
}

// ══ CARGAR ESTADO (compatibilidad con llamadas existentes) ══
async function loadStateFromDrive() {
  try {
    const newDb = await loadStateFromSupabase();
    db = newDb;
    updateCounts();
    showToast('✓ Estado actualizado');
  } catch (e) {
    showToast('Error al cargar datos: ' + e.message);
    console.error(e);
  }
}

// No-op: los guardados son individuales via sbSaveEntidad / sbSaveDocumento
async function saveStateToDrive() { /* no-op */ }
