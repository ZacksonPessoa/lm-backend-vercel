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

    // Buscar pedidos do dia atual
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromDate = today.toISOString().split("T")[0];

    // Buscar pedidos do vendedor do dia
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${fromDate}T00:00:00.000-00:00&limit=50`;
    
    const ordersResp = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const transactions = [];

    if (ordersResp.ok) {
      const ordersData = await ordersResp.json();
      const orders = ordersData.results || [];

      // Processar cada pedido
      for (const order of orders) {
        if (order.order_items && order.order_items.length > 0) {
          // Para cada item do pedido, criar uma transação
          for (const item of order.order_items) {
            const transactionDate = new Date(order.date_created);
            
            // Mapear status do pedido para status da transação
            let status = "Pendente";
            if (order.status === "paid" || order.status === "confirmed") {
              status = "Concluído";
            } else if (order.status === "cancelled") {
              status = "Cancelado";
            } else if (order.status === "payment_required") {
              status = "Pendente";
            }

            // Formatar data em português
            const months = [
              "janeiro", "fevereiro", "março", "abril", "maio", "junho",
              "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
            ];
            const day = transactionDate.getDate();
            const month = months[transactionDate.getMonth()];
            const year = transactionDate.getFullYear();
            const formattedDate = `${day} de ${month} de ${year}`;

            transactions.push({
              id: order.id.toString(),
              productName: item.item.title || "Produto sem nome",
              date: formattedDate,
              status: status,
              quantity: item.quantity || 1,
            });
          }
        }
      }
    }

    // Ordenar por data (mais recente primeiro) - já vem ordenado da API
    // Manter ordem original (mais recente primeiro)

    return res.status(200).json({
      ok: true,
      transactions: transactions.slice(0, 20), // Limitar a 20 transações
    });
  } catch (err) {
    console.error("Transactions API error:", err);
    // Retornar dados vazios em caso de erro
    return res.status(200).json({
      ok: true,
      transactions: [],
    });
  }
}

