// api/cleanup-expired.js
// Vercel serverless — limpieza de documentos vencidos.
// Cuando un documento pasó su fecha de vencimiento, el archivo guardado ya no sirve
// (igual hay que renovarlo). Borramos el archivo + la preview del Storage y de la base,
// pero MANTENEMOS la fila con su vto para que la app siga mostrando "Venció dd/mm/aaaa".
// La cédula verde nunca vence → se excluye.
//
// Disparo: GET = cron de Vercel (header Authorization: Bearer CRON_SECRET)
//          POST = admin manual (token de usuario con rol admin)

const SUPABASE_URL = 'https://hgeevmzxfywyzvfyfsmt.supabase.co';
const BUCKET = 'docutransporte';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service key no configurada' });

  // ── Autenticación ──
  if (req.method === 'GET') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || (req.headers.authorization || '') !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }
  } else if (req.method === 'POST') {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Token inválido' });
    const caller = await userRes.json();
    const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${caller.id}&select=rol`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
    });
    const roles = await roleRes.json();
    if (!roles?.length || roles[0].rol !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  } else {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Fecha de hoy en horario AR (UTC-3). "Vencido" = vto < hoy, igual que la app.
  const hoyAR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

  // ── 1. Documentos vencidos que todavía tienen archivo (excluye cédula verde) ──
  const qs = `select=id,storage_path&storage_path=not.is.null&nombre=neq.cedverde&vto=lt.${hoyAR}`;
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/documentos?${qs}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
  });
  if (!listRes.ok) {
    return res.status(500).json({ error: 'Error al consultar vencidos', detail: await listRes.text() });
  }
  const docs = await listRes.json();
  if (!Array.isArray(docs) || !docs.length) {
    return res.status(200).json({ cleaned: 0, filesDeleted: 0, hoy: hoyAR });
  }

  // ── 2. Borrar los archivos del Storage ──
  const paths = docs.map(d => d.storage_path).filter(Boolean);
  let filesDeleted = 0;
  if (paths.length) {
    const delRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ prefixes: paths })
    });
    if (delRes.ok) {
      filesDeleted = paths.length;
    } else {
      /* Si el Storage falla, NO limpiar la DB — el cron reintentará mañana */
      const detail = await delRes.text();
      console.warn('Error borrando archivos del bucket:', detail);
      return res.status(200).json({ cleaned: 0, filesDeleted: 0, hoy: hoyAR, warning: 'storage_delete_failed', detail });
    }
  }

  // ── 3. Limpiar las columnas pesadas, manteniendo la fila y su vto ──
  const ids = docs.map(d => d.id).join(',');
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/documentos?id=in.(${ids})`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ storage_path: null, preview_url: null })
  });
  if (!patchRes.ok) {
    return res.status(500).json({ error: 'Error al limpiar filas', detail: await patchRes.text() });
  }

  return res.status(200).json({ cleaned: docs.length, filesDeleted, hoy: hoyAR });
}
