// api/admin-users.js
// Vercel serverless — gestión de usuarios de auth (requiere service role)

const SUPABASE_URL = 'https://hgeevmzxfywyzvfyfsmt.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service key no configurada' });

  // Verificar JWT del caller
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await userRes.json();

  // Verificar que el caller es admin
  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${caller.id}&select=rol`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
  });
  const roles = await roleRes.json();
  if (!roles?.length || roles[0].rol !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { action, email, password, rol, userId } = req.body;

  if (action === 'create') {
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const created = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: created.msg || created.message || 'Error al crear usuario' });

    await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ id: created.id, email, rol: rol || 'auditor' })
    });

    return res.status(200).json({ success: true, id: created.id });
  }

  if (action === 'delete') {
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
    });

    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
    });
    if (!deleteRes.ok && deleteRes.status !== 404) {
      return res.status(400).json({ error: 'Error al eliminar de auth' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Acción no reconocida' });
}
