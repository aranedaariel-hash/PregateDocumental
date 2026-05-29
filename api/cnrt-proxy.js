// api/cnrt-proxy.js
// Proxy para APIs CNRT — evita CORS
// Soporta dos bases: api.cnrt.gob.ar (equipos) y consultapme.cnrt.gob.ar (choferes/empresas)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path, base } = req.query;

  if (!path) return res.status(400).json({ error: 'Falta el parámetro ?path=' });

  // base=equipos  → api.cnrt.gob.ar/dut/v1/public  (RTO, RUTA, datos técnicos)
  // base=consulta → consultapme.cnrt.gob.ar/api     (choferes, empresas)
  const bases = {
    equipos:  'https://api.cnrt.gob.ar/dut/v1/public',
    consulta: 'https://consultapme.cnrt.gob.ar/api',
  };

  const baseUrl = bases[base] || bases.equipos;

  if (!/^\/[a-zA-Z0-9_.\/\-\?\=\&]+$/.test(path)) {
    return res.status(400).json({ error: 'Path inválido' });
  }

  const targetUrl = `${baseUrl}${path}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DocuTransporte/1.0',
      },
    });

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    if (response.ok) return res.status(200).send(text);
    if (response.status === 404) return res.status(200).json([]);
    return res.status(200).json({ error: 'Sin resultado', status: response.status });

  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar CNRT', detail: err.message });
  }
}
