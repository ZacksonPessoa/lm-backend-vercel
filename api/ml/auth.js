export default function handler(req, res) {
  const clientId = process.env.ML_CLIENT_ID;
  const redirectUri = process.env.ML_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ ok: false, error: "Missing env vars" });
  }

  const state = crypto.randomUUID();

  const authUrl =
    "https://auth.mercadolivre.com.br/authorization" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  if (req.query.redirect === "1") {
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }

  return res.status(200).json({ ok: true, authUrl, state });
}
