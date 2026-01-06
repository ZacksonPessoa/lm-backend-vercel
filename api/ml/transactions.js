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

    // Buscar período dos parâmetros ou usar padrão (dia atual)
    let fromDate = req.query.from;
    let toDate = req.query.to;
    
    if (!fromDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      fromDate = today.toISOString().split("T")[0];
    }
    
    if (!toDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      toDate = today.toISOString().split("T")[0];
    }

    // Buscar pedidos do vendedor no período
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${fromDate}T00:00:00.000-00:00&order.date_created.to=${toDate}T23:59:59.999-00:00&limit=50`;
    
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
          // Buscar detalhes completos do pedido
          let orderDetails = null;
          try {
            const orderDetailResp = await fetch(`https://api.mercadolibre.com/orders/${order.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (orderDetailResp.ok) {
              orderDetails = await orderDetailResp.json();
            }
          } catch (e) {
            console.error(`Error fetching order ${order.id} details:`, e);
          }

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

            // Buscar informações do comprador
            let buyerName = "-";
            let buyerCpf = "-";
            let buyerAddress = "-";

            const buyerData = orderDetails?.buyer || order.buyer;
            if (buyerData) {
              buyerName = buyerData.nickname || buyerData.first_name || buyerData.name || "-";
              
              // Buscar informações de identificação se disponível
              if (buyerData.billing_info?.doc_number) {
                buyerCpf = buyerData.billing_info.doc_number;
              } else if (buyerData.identification?.number) {
                buyerCpf = buyerData.identification.number;
              }
            }

            // Buscar endereço de entrega
            const shippingData = orderDetails?.shipping || order.shipping;
            if (shippingData && shippingData.receiver_address) {
              const addr = shippingData.receiver_address;
              const addressParts = [];
              if (addr.address_line) addressParts.push(addr.address_line);
              if (addr.street_name) addressParts.push(addr.street_name);
              if (addr.street_number) addressParts.push(addr.street_number);
              if (addr.city?.name) addressParts.push(addr.city.name);
              if (addr.state?.name) addressParts.push(addr.state.name);
              if (addr.zip_code) addressParts.push(addr.zip_code);
              buyerAddress = addressParts.length > 0 ? addressParts.join(", ") : "-";
            }

            transactions.push({
              id: order.id.toString(),
              productName: item.item.title || "Produto sem nome",
              date: formattedDate,
              status: status,
              quantity: item.quantity || 1,
              price: item.unit_price || 0,
              buyer: buyerName,
              cpf: buyerCpf,
              address: buyerAddress,
            });
          }
        }
      }
    }

    // Ordenar por data (mais recente primeiro) - já vem ordenado da API
    // Manter ordem original (mais recente primeiro)

    return res.status(200).json({
      ok: true,
      transactions: transactions.slice(0, 100), // Limitar a 100 transações
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

