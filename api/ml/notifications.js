export default async function handler(req, res) {
  // Mercado Livre precisa de resposta rápida
  res.status(200).json({ ok: true });

  // Log simples (pra você ver no Vercel Logs)
  try {
    console.log("📩 ML notification:", JSON.stringify(req.body || {}));
    console.log("Query:", JSON.stringify(req.query || {}));
  } catch (e) {
    console.log("log error:", e);
  }
}
