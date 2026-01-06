import { redis } from "../_lib/redis.js";

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req, res) {
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // GET: Buscar notificações
  if (req.method === "GET") {
    try {
      const notifications = await redis.lrange("notifications", 0, 49); // Últimas 50 notificações
      const parsed = notifications.map((n) => {
        try {
          return typeof n === "string" ? JSON.parse(n) : n;
        } catch {
          return n;
        }
      });
      return res.status(200).json({ ok: true, notifications: parsed });
    } catch (err) {
      console.error("Error fetching notifications:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  }

  // POST: Receber notificação do Mercado Livre
  if (req.method === "POST") {
    // Mercado Livre precisa de resposta rápida
    res.status(200).json({ ok: true });

    // Armazenar notificação
    try {
      const notification = {
        id: Date.now().toString(),
        type: req.body?.type || req.query?.topic || "unknown",
        resource: req.body?.resource || req.query?.resource_id || null,
        data: req.body || req.query,
        timestamp: new Date().toISOString(),
        read: false,
      };

      await redis.lpush("notifications", JSON.stringify(notification));
      // Manter apenas as últimas 100 notificações
      await redis.ltrim("notifications", 0, 99);

      console.log("📩 ML notification stored:", notification.id);
    } catch (e) {
      console.error("Error storing notification:", e);
    }
    return;
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
