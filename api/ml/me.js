import { getAccessToken } from "./_getAccessToken.js";

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();

    const resp = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, error: "ML request failed", details: data });
    }

    return res.status(200).json({ ok: true, me: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
