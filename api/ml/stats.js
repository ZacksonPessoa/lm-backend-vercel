import { getAccessToken } from "./_getAccessToken.js";

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req, res) {
  // Set CORS headers PRIMEIRO, antes de qualquer outra operação
  // No Vercel, é crítico definir headers antes de qualquer resposta
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
          totalOrders: 0,
          netRevenue: 0,
          realProfit: 0,
          margin: 0,
        },
      });
    }

    const ordersData = await ordersResp.json();
    const orders = ordersData.results || [];

    // Calcular estatísticas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSales = 0; // Receita bruta
    let todaySales = 0;
    let pendingShipments = 0;
    let cancelled = 0;
    let totalOrders = 0;
    let totalCommissions = 0;
    let totalShipping = 0;
    let totalProductCosts = 0;

    orders.forEach((order) => {
      const orderDate = new Date(order.date_created);
      const orderTotal = order.total_amount || 0;

      // Total de vendas (receita bruta)
      if (order.status !== "cancelled") {
        totalSales += orderTotal;
        totalOrders++;

        // Calcular comissão (estimativa ~13% do Mercado Livre)
        const commission = orderTotal * 0.13;
        totalCommissions += commission;

        // Calcular frete
        const shipping = order.shipping?.cost || 0;
        totalShipping += shipping;

        // Calcular custo do produto (estimativa 30% do preço de venda)
        if (order.order_items && order.order_items.length > 0) {
          order.order_items.forEach((item) => {
            const itemTotal = (item.unit_price || 0) * (item.quantity || 1);
            totalProductCosts += itemTotal * 0.3; // 30% como custo do produto
          });
        }
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

    // Calcular receita líquida (bruta - comissões)
    const netRevenue = totalSales - totalCommissions;
    
    // Calcular lucro real (receita líquida - custos do produto - frete)
    const realProfit = netRevenue - totalProductCosts - totalShipping;
    
    // Calcular margem (%)
    const margin = totalSales > 0 ? (realProfit / totalSales) * 100 : 0;

    return res.status(200).json({
      ok: true,
      stats: {
        totalSales: Math.round(totalSales * 100) / 100, // Receita bruta
        todaySales,
        pendingShipments,
        cancelled,
        totalOrders, // Nº de pedidos
        netRevenue: Math.round(netRevenue * 100) / 100, // Receita líquida
        realProfit: Math.round(realProfit * 100) / 100, // Lucro real
        margin: Math.round(margin * 100) / 100, // Margem (%)
      },
    });
  } catch (err) {
    console.error("Stats API error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

