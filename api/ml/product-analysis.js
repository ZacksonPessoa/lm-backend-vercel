import { getAccessToken } from "./_getAccessToken.js";

// Headers CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req, res) {
  // Set CORS headers PRIMEIRO, antes de qualquer outra operação
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

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

    // Buscar período dos parâmetros ou usar padrão (mês atual)
    let fromDate = req.query.from;
    let toDate = req.query.to;
    
    if (!fromDate) {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    }
    
    if (!toDate) {
      toDate = new Date().toISOString().split("T")[0];
    }

    // Buscar pedidos do vendedor no período
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${fromDate}T00:00:00.000-00:00&order.date_created.to=${toDate}T23:59:59.999-00:00&limit=100`;
    
    const ordersResp = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const products = [];
    let totalProfit = 0;
    let withProfit = 0;
    let withLoss = 0;

    if (ordersResp.ok) {
      const ordersData = await ordersResp.json();
      const orders = ordersData.results || [];

      // Processar cada pedido
      for (const order of orders) {
        if (order.order_items && order.order_items.length > 0 && order.status !== "cancelled") {
          for (const item of order.order_items) {
            // Calcular custos e lucro
            const salePrice = item.unit_price || 0;
            const quantity = item.quantity || 1;
            const totalSale = salePrice * quantity;
            
            // Estimativa de custos (comissão ~13%, frete estimado, custo do produto estimado)
            const commission = totalSale * 0.13; // Comissão do Mercado Livre ~13%
            const shipping = order.shipping?.cost || 0;
            const productCost = totalSale * 0.3; // Estimativa de 30% do preço como custo do produto
            const totalCosts = commission + shipping + productCost;
            
            const profit = totalSale - totalCosts;
            const margin = totalSale > 0 ? (profit / totalSale) * 100 : 0;
            
            totalProfit += profit;
            
            if (profit > 0) {
              withProfit++;
            } else {
              withLoss++;
            }

            // Identificar problemas
            const problems = [];
            if (commission / totalSale > 0.15) {
              problems.push("Comissão alta");
            }
            if (shipping / totalSale > 0.25) {
              problems.push("Frete alto");
            }
            if (productCost / totalSale > 0.5) {
              problems.push("Custo produto alto");
            }

            products.push({
              id: `${order.id}-${item.item.id}`,
              productName: item.item.title || "Produto sem nome",
              sku: item.item.id || "N/A",
              orderId: order.id.toString(),
              salePrice: totalSale,
              productCost: productCost,
              commission: commission,
              shipping: shipping,
              totalCosts: totalCosts,
              profit: profit,
              margin: margin,
              problems: problems,
              quantity: quantity,
              date: new Date(order.date_created).toLocaleDateString("pt-BR"),
            });
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      summary: {
        total: products.length,
        withProfit,
        withLoss,
        totalProfit: Math.round(totalProfit * 100) / 100,
      },
      products: products,
    });
  } catch (err) {
    console.error("Product Analysis API error:", err);
    return res.status(200).json({
      ok: true,
      summary: {
        total: 0,
        withProfit: 0,
        withLoss: 0,
        totalProfit: 0,
      },
      products: [],
    });
  }
}

