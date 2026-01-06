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

    // Buscar período dos parâmetros ou usar padrão (últimos 7 dias)
    let fromDate = req.query.from;
    let toDate = req.query.to;
    
    if (!fromDate) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      fromDate = sevenDaysAgo.toISOString().split("T")[0];
    }
    
    if (!toDate) {
      toDate = new Date().toISOString().split("T")[0];
    }

    // Buscar pedidos do vendedor no período
    const ordersUrl = `https://api.mercadolibre.com/orders/search?seller=${userId}&order.date_created.from=${fromDate}T00:00:00.000-00:00&order.date_created.to=${toDate}T23:59:59.999-00:00&limit=100`;
    
    const ordersResp = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Inicializar dados da semana (últimos 7 dias)
    const weekData = [];
    const days = ["D", "S", "T", "Q", "Q", "S", "S"]; // Domingo a Sábado
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      weekData.push({
        day: days[date.getDay()],
        date: date.toISOString().split("T")[0],
        renda: 0,
        despesas: 0,
      });
    }

    if (ordersResp.ok) {
      const ordersData = await ordersResp.json();
      const orders = ordersData.results || [];

      // Processar pedidos e agrupar por dia
      orders.forEach((order) => {
        const orderDate = new Date(order.date_created);
        orderDate.setHours(0, 0, 0, 0);
        const dateStr = orderDate.toISOString().split("T")[0];
        
        const dayData = weekData.find((d) => d.date === dateStr);
        if (dayData) {
          const orderTotal = order.total_amount || 0;
          
          if (order.status === "cancelled") {
            // Cancelados são despesas (perda de receita)
            dayData.despesas += orderTotal;
          } else if (order.status === "paid" || order.status === "confirmed") {
            // Pedidos pagos/confirmados são renda
            dayData.renda += orderTotal;
          }
        }
      });
    }

    // Calcular valores percentuais para o gráfico (baseado no maior valor)
    const maxValue = Math.max(
      ...weekData.flatMap((d) => [d.renda, d.despesas]),
      1 // Evitar divisão por zero
    );

    const chartData = weekData.map((day, index) => ({
      day: day.day,
      renda: Math.round((day.renda / maxValue) * 100),
      despesas: Math.round((day.despesas / maxValue) * 100),
      rendaValue: day.renda,
      despesasValue: day.despesas,
      highlight: index === 2, // Destacar o terceiro dia (terça)
    }));

    return res.status(200).json({
      ok: true,
      data: chartData,
      maxValue,
    });
  } catch (err) {
    console.error("Finance API error:", err);
    // Retornar dados vazios em caso de erro
    const days = ["D", "S", "T", "Q", "Q", "S", "S"];
    const defaultData = days.map((day, index) => ({
      day,
      renda: 0,
      despesas: 0,
      rendaValue: 0,
      despesasValue: 0,
      highlight: index === 2,
    }));
    
    return res.status(200).json({
      ok: true,
      data: defaultData,
      maxValue: 100,
    });
  }
}

