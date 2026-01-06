import { getAccessToken } from "./_getAccessToken.js";

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const token = await getAccessToken();
    let userId = req.query.user_id;

    if (!userId) {
      // Buscar o user_id do token
      const meResp = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meResp.json();
      if (!meResp.ok) {
        return res.status(meResp.status).json({ ok: false, error: "Failed to get user ID" });
      }
      userId = meData.id;
    }

    // Buscar período dos parâmetros ou usar padrão (últimos 30 dias)
    let fromDate = req.query.from;
    let toDate = req.query.to;
    
    if (!fromDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = thirtyDaysAgo.toISOString().split("T")[0];
    }
    
    if (!toDate) {
      toDate = new Date().toISOString().split("T")[0];
    }

    // Buscar pedidos do vendedor no período
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${fromDate}T00:00:00.000-00:00&order.date_created.to=${toDate}T23:59:59.999-00:00&limit=100`;
    
    const ordersResp = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!ordersResp.ok) {
      const errorData = await ordersResp.json();
      console.error("Orders API error:", errorData);
      // Retornar dados vazios se não conseguir buscar
      return res.status(200).json({
        ok: true,
        stats: {
          totalSales: 0,
          todaySales: 0,
          pendingShipments: 0,
          cancelled: 0,
        },
      });
    }

    const ordersData = await ordersResp.json();
    const orders = ordersData.results || [];

    // Calcular estatísticas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSales = 0;
    let todaySales = 0;
    let pendingShipments = 0;
    let cancelled = 0;

    orders.forEach((order) => {
      const orderDate = new Date(order.date_created);
      const orderTotal = order.total_amount || 0;

      // Total de vendas
      if (order.status !== "cancelled") {
        totalSales += orderTotal;
      }

      // Vendas do dia
      if (orderDate >= today && order.status !== "cancelled") {
        todaySales++;
      }

      // Pendentes para enviar
      if (order.status === "confirmed" || order.status === "payment_required") {
        pendingShipments++;
      }

      // Cancelados
      if (order.status === "cancelled") {
        cancelled++;
      }
    });

    return res.status(200).json({
      ok: true,
      stats: {
        totalSales: Math.round(totalSales * 100) / 100, // Arredondar para 2 casas decimais
        todaySales,
        pendingShipments,
        cancelled,
      },
    });
  } catch (err) {
    console.error("Stats API error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

