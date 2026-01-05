import { redis } from "../_lib/redis.js";

async function refreshToken(refresh_token) {
  const { ML_CLIENT_ID, ML_CLIENT_SECRET } = process.env;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    refresh_token,
  });

  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error("Refresh failed: " + JSON.stringify(data));

  const now = Date.now();
  const payload = {
    user_id: data.user_id,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refresh_token,
    expires_in: data.expires_in,
    created_at: now,
    expires_at: now + data.expires_in * 1000,
    scope: data.scope,
    token_type: data.token_type,
  };

  await redis.set("ml:tokens:primary", JSON.stringify(payload));
  return payload.access_token;
}

export async function getAccessToken() {
  const raw = await redis.get("ml:tokens:primary");
  if (!raw) throw new Error("No token saved");

  const data = typeof raw === "string" ? JSON.parse(raw) : raw;

  // se ainda está válido, usa direto
  if (data.expires_at && Date.now() < data.expires_at - 30_000) {
    return data.access_token;
  }

  // expirou (ou está pra expirar), refresh
  return refreshToken(data.refresh_token);
}
