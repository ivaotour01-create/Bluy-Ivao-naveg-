// Diagnóstico seguro: informa somente se as variáveis existem; nunca revela seus valores.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }
  const key = Boolean(process.env.AISWEB_API_KEY);
  const pass = Boolean(process.env.AISWEB_API_PASS);
  return res.status(200).json({
    service: 'IVÃO NAVEG — AISWEB/DECEA',
    credentials: { apiKeyConfigured: key, apiPassConfigured: pass, bothConfigured: key && pass },
    enabledAreas: ['rotaer', 'met', 'notam'],
    authenticationTested: false,
    note: 'A presença das variáveis não comprova autenticação. É necessária uma consulta real autorizada.'
  });
};
