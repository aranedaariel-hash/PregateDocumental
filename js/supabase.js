// ══ SUPABASE CLIENT ══
let _sb = null;

function getSB() {
  if (!_sb) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// ══ AUTH ══
async function sbSignIn(email, password) {
  const { data, error } = await getSB().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignOut() {
  await getSB().auth.signOut();
}

// Cambio de contraseña del propio usuario logueado (self-service, no requiere admin)
async function sbUpdatePassword(newPassword) {
  const { data, error } = await getSB().auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

async function sbGetSession() {
  const { data: { session } } = await getSB().auth.getSession();
  return session;
}

async function sbGetUserRole(userId) {
  const { data } = await getSB()
    .from('usuarios')
    .select('rol')
    .eq('id', userId)
    .maybeSingle();
  return data?.rol || 'auditor';
}

// ══ CARGAR ESTADO ══
async function loadStateFromSupabase() {
  // No traemos preview_url acá: es base64 pesado y solo se usa en la vista ?ver (que
  // carga la entidad aparte con sbLoadPublicEntity). Esto aligera mucho el arranque.
  const { data, error } = await getSB()
    .from('entidades')
    .select('*, documentos(id,nombre,vto,filename,storage_path)')
    .order('label');
  if (error) throw error;

  const newDb = { chofer: [], tractor: [], semi: [], transporte: [] };
  for (const ent of (data || [])) {
    const section = ent.tipo;
    if (!newDb[section]) continue;
    const docs = {};
    for (const doc of (ent.documentos || [])) {
      docs[doc.nombre] = {
        id:           doc.id,
        vto:          doc.vto,
        file:         doc.filename || '',
        storage_path: doc.storage_path || null,
        previewUrl:   doc.preview_url || '',
        driveUrl:     doc.storage_path ? '#storage' : '',
      };
    }
    newDb[section].push({
      id:        ent.id,
      label:     ent.label,
      sub:       ent.sub || '',
      categoria: ent.categoria || '',
      pbtc:      ent.pbtc || '',
      ejes:      ent.ejes || '',
      docs,
    });
  }
  return newDb;
}

// ══ GUARDAR ENTIDAD ══
async function sbSaveEntidad(entidad, section) {
  const esVehiculo = section === 'tractor' || section === 'semi';
  const payload = {
    tipo:  section,
    label: entidad.label,
    sub:   entidad.sub || null,
    actualizado_en:  new Date().toISOString(),
    actualizado_por: currentUser?.id || null,
    ...(esVehiculo && {
      categoria: entidad.categoria || null,
      pbtc:      entidad.pbtc      || null,
      ejes:      entidad.ejes      || null,
    }),
  };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(entidad.id);
  if (isUuid) {
    const { error } = await getSB().from('entidades').update(payload).eq('id', entidad.id);
    if (error) throw error;
    return entidad.id;
  } else {
    const { data, error } = await getSB()
      .from('entidades')
      .insert({ ...payload, creado_por: currentUser?.id || null })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }
}

// ══ GUARDAR DOCUMENTO ══
async function sbSaveDocumento(entidadId, docNombre, docData) {
  const payload = {
    entidad_id:   entidadId,
    nombre:       docNombre,
    vto:          docData.vto || null,
    filename:     docData.file || null,
    preview_url:  docData.previewUrl || null,
    storage_path: docData.storage_path || null,
    subido_por:   currentUser?.id || null,
  };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(docData.id);
  if (isUuid) {
    const { error } = await getSB().from('documentos').update(payload).eq('id', docData.id);
    if (error) throw error;
    return docData.id;
  } else {
    const { data, error } = await getSB()
      .from('documentos')
      .upsert(payload, { onConflict: 'entidad_id,nombre' })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }
}

// ══ ELIMINAR ENTIDAD ══
async function sbDeleteEntidad(id) {
  const { error } = await getSB().from('entidades').delete().eq('id', id);
  if (error) throw error;
}

// ══ STORAGE ══
async function sbUploadFile(file, storagePath) {
  const { data, error } = await getSB().storage
    .from('docutransporte')
    .upload(storagePath, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return data.path;
}

async function sbGetSignedUrl(storagePath) {
  if (!storagePath) return null;
  const { data, error } = await getSB().storage
    .from('docutransporte')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function sbDeleteFile(storagePath) {
  if (!storagePath) return;
  await getSB().storage.from('docutransporte').remove([storagePath]);
}

async function sbDeleteFiles(storagePaths) {
  const paths = (storagePaths || []).filter(Boolean);
  if (!paths.length) return;
  const { error } = await getSB().storage.from('docutransporte').remove(paths);
  if (error) throw error;
}

// ══ VENCIMIENTOS ══
async function sbGetVencimientos() {
  const { data, error } = await getSB()
    .from('documentos')
    .select('*, entidades(label, tipo)')
    .in('estado', ['vencido', 'por_vencer'])
    .order('vto');
  if (error) throw error;
  return data || [];
}

// ══ USUARIOS (admin) ══
async function sbGetUsuarios() {
  const { data, error } = await getSB().from('usuarios').select('*').order('email');
  if (error) throw error;
  return data || [];
}

async function sbDeleteUsuario(id) {
  const { error } = await getSB().from('usuarios').delete().eq('id', id);
  if (error) throw error;
}

// ══ AUDIT LOG ══
async function sbWriteAuditLog({ accion, entidad_id, entidad_label, entidad_tipo, documento_nombre, filename }) {
  if (!currentUser) return;
  await getSB().from('audit_log').insert({
    usuario_id:      currentUser.id,
    usuario_email:   currentUser.email,
    accion,
    entidad_id:      entidad_id      || null,
    entidad_label:   entidad_label   || null,
    entidad_tipo:    entidad_tipo    || null,
    documento_nombre: documento_nombre || null,
    filename:        filename        || null,
  });
}

async function sbGetAuditLog(limit = 200) {
  const { data, error } = await getSB()
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ══ GESTIÓN DE USUARIOS (admin via serverless) ══
async function sbCreateUser(email, password, rol) {
  const session = await sbGetSession();
  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'create', email, password, rol })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
  return data;
}

async function sbDeleteUserAuth(userId) {
  const session = await sbGetSession();
  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'delete', userId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');
  return data;
}

// ══ LIMPIEZA DE VENCIDOS (admin manual) ══
async function sbCleanupExpired() {
  const session = await sbGetSession();
  const res = await fetch('/api/cleanup-expired', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al limpiar vencidos');
  return data;
}

// ══ VISTA PÚBLICA: cargar entidad sin auth ══
async function sbLoadPublicEntity(section, entityId) {
  const { data, error } = await getSB()
    .from('entidades')
    .select('*, documentos(*)')
    .eq('id', entityId)
    .eq('tipo', section)
    .maybeSingle();
  if (error) throw error;
  return data;
}
