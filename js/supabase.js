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
  const { data, error } = await getSB()
    .from('entidades')
    .select('*, documentos(*)')
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
  const payload = {
    tipo:      section,
    label:     entidad.label,
    sub:       entidad.sub || null,
    categoria: entidad.categoria || null,
    pbtc:      entidad.pbtc || null,
    ejes:      entidad.ejes || null,
    actualizado_en: new Date().toISOString(),
  };
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(entidad.id);
  if (isUuid) {
    const { error } = await getSB().from('entidades').update(payload).eq('id', entidad.id);
    if (error) throw error;
    return entidad.id;
  } else {
    const { data, error } = await getSB().from('entidades').insert(payload).select('id').single();
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
