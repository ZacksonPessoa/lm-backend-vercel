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

    // Buscar publicações do vendedor
    const itemsUrl = `https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=50`;
    
    const itemsResp = await fetch(itemsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let productsLaunched = 0;
    let salesOfLaunchedProducts = 0;

    if (itemsResp.ok) {
      const itemsData = await itemsResp.json();
      const itemIds = itemsData.results || [];
      productsLaunched = itemIds.length;

      // Buscar vendas dos produtos lançados
      if (itemIds.length > 0) {
        // Buscar pedidos dos últimos 30 dias
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

        const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${fromDate}T00:00:00.000-00:00&limit=100`;
        
        const ordersResp = await fetch(ordersUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (ordersResp.ok) {
          const ordersData = await ordersResp.json();
          const orders = ordersData.results || [];

          // Contar vendas de produtos lançados
          orders.forEach((order) => {
            if (order.order_items && order.status !== "cancelled") {
              order.order_items.forEach((item) => {
                if (itemIds.includes(item.item.id)) {
                  salesOfLaunchedProducts += item.quantity || 1;
                }
              });
            }
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      data: {
        productsLaunched,
        salesOfLaunchedProducts,
      },
    });
  } catch (err) {
    console.error("Products API error:", err);
    // Retornar dados vazios em caso de erro
    return res.status(200).json({
      ok: true,
      data: {
        productsLaunched: 0,
        salesOfLaunchedProducts: 0,
      },
    });
  }
}

