import { redis } from "../_lib/redis.js";

export default async function handler(req, res) {
  const code = req.query.code;

  if (!code) return res.status(400).json({ ok: false, error: "Missing code" });

  const { ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI } = process.env;
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
    return res.status(500).json({ ok: false, error: "Missing env vars" });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    code: String(code),
    redirect_uri: ML_REDIRECT_URI,
  });

  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();

  if (!resp.ok) {
    return res.status(resp.status).json({
      ok: false,
      error: "Token exchange failed",
      details: data,
    });
  }

  // ✅ salva no Redis (MVP: 1 conta principal)
  const now = Date.now();
  const payload = {
    user_id: data.user_id,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    created_at: now,
    expires_at: now + (data.expires_in * 1000),
    scope: data.scope,
    token_type: data.token_type,
  };

  await redis.set("ml:tokens:primary", JSON.stringify(payload));

  // ✅ não expõe token na tela
  return res.status(200).json({
    ok: true,
    user_id: data.user_id,
    expires_in: data.expires_in,
    saved: true,
  });
}
