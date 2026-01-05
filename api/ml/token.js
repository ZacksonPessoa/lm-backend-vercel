import { redis } from "../_lib/redis.js";

export default async function handler(req, res) {
  try {
    const adminKey = req.headers["x-admin-key"];
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const raw = await redis.get("ml:tokens:primary");
    if (!raw) return res.status(404).json({ ok: false, error: "No token saved" });

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const now = Date.now();

    return res.status(200).json({
      ok: true,
      user_id: data.user_id,
      expires_in: Math.max(0, Math.floor((data.expires_at - now) / 1000)),
      expires_at: data.expires_at,
      has_access_token: Boolean(data.access_token),
      has_refresh_token: Boolean(data.refresh_token),
      saved_at: data.created_at,
    });
  } catch (err) {
    console.error("token endpoint error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
