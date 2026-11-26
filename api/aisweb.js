// Proxy Vercel para AISWEB. Credenciais ficam exclusivamente nas Environment Variables.
const ALLOWED_AREAS = new Set(['rotaer', 'met', 'notam']);
// Parâmetros ROTAER conforme documentação pública. IcaoCode/type em MET e IcaoCode
// em NOTAM permanecem sujeitos à confirmação na conta/documentação autorizada do DECEA.
const ALLOWED_PARAMS = new Set([
  'rowstart', 'rowend', 'aero', 'name', 'city', 'uf', 'type', 'jur', 'fir',
  'type_opr', 'rwy_surface', 'rwy_l_opr', 'rwy_l', 'rwy_w', 'util', 'amdt',
  'IcaoCode', 'icaoCode', 'icao', 'local', 'localidade', 'firCode', 'notam', 'data'
]);
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }
  const apiKey = process.env.AISWEB_API_KEY;
  const apiPass = process.env.AISWEB_API_PASS;
  if (!apiKey || !apiPass) {
    return res.status(503).json({ ok: false, code: 'AISWEB_ENV_MISSING', error: 'Credenciais AISWEB não configuradas na Vercel.' });
  }
  const q = req.query || {};
  const area = String(q.area || '').toLowerCase();
  if (!ALLOWED_AREAS.has(area)) {
    return res.status(400).json({ ok: false, error: 'Área AISWEB inválida.' });
  }
  const params = new URLSearchParams({ apiKey, apiPass, area });
  for (const [name, raw] of Object.entries(q)) {
    if (name === 'area' || !ALLOWED_PARAMS.has(name)) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const clean = String(value).trim();
    if (clean.length > 160) return res.status(400).json({ ok: false, error: `Parâmetro ${name} excede o limite.` });
    params.set(name, clean);
  }
  if (area === 'rotaer' && params.has('aero') && !/^[A-Z0-9]{4}(,[A-Z0-9]{4}){0,9}$/i.test(params.get('aero'))) {
    return res.status(400).json({ ok: false, error: 'Informe de 1 a 10 códigos ICAO válidos, separados por vírgula.' });
  }
  if ((area === 'met' || area === 'notam') && params.has('IcaoCode') && !/^([A-Z0-9]{4})(,[A-Z0-9]{4}){0,9}$/i.test(params.get('IcaoCode'))) {
    return res.status(400).json({ ok: false, error: 'Informe de 1 a 10 códigos ICAO válidos, separados por vírgula.' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const upstream = await fetch('https://api.decea.mil.br/aisweb/?' + params.toString(), {
      method: 'GET', headers: { Accept: 'application/xml, text/xml, */*' }, signal: controller.signal
    });
    const body = await upstream.text();
    if (!upstream.ok) {
      return res.status(502).json({ ok: false, code: 'AISWEB_UPSTREAM_ERROR', upstreamStatus: upstream.status,
        error: 'AISWEB respondeu com erro. Confira autorização, parâmetros e disponibilidade do serviço.' });
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/xml; charset=utf-8');
    return res.status(200).send(body);
  } catch (error) {
    const timeout = error && error.name === 'AbortError';
    return res.status(502).json({ ok: false, code: timeout ? 'AISWEB_TIMEOUT' : 'AISWEB_CONNECTION_ERROR',
      error: timeout ? 'Tempo limite excedido ao consultar AISWEB.' : 'Não foi possível conectar à AISWEB.' });
  } finally { clearTimeout(timer); }
};
