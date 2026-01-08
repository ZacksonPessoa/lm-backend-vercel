import { query } from './db.js';

// ============================================
// HELPERS PARA USUÁRIOS
// ============================================

export async function upsertUser(mlUserData) {
  const { id, nickname, email, first_name, last_name, picture } = mlUserData;
  
  const result = await query(
    `INSERT INTO users (ml_user_id, nickname, email, first_name, last_name, picture, ml_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (ml_user_id) 
     DO UPDATE SET 
       nickname = EXCLUDED.nickname,
       email = EXCLUDED.email,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       picture = EXCLUDED.picture,
       ml_data = EXCLUDED.ml_data,
       updated_at = NOW()
     RETURNING id, ml_user_id, nickname, email`,
    [id, nickname, email, first_name, last_name, picture, JSON.stringify(mlUserData)]
  );
  
  return result.rows[0];
}

export async function getUserByMlId(mlUserId) {
  const result = await query(
    'SELECT * FROM users WHERE ml_user_id = $1',
    [mlUserId]
  );
  return result.rows[0];
}

// ============================================
// HELPERS PARA PEDIDOS
// ============================================

export async function upsertOrder(userId, orderData) {
  const {
    id: ml_order_id,
    status,
    date_created,
    date_closed,
    total_amount,
    currency_id,
    buyer,
    shipping,
    payments,
  } = orderData;

  const buyer_id = buyer?.id || null;
  const buyer_nickname = buyer?.nickname || null;
  const shipping_cost = shipping?.cost || 0;
  const shipping_status = shipping?.status || null;
  const payment_status = payments?.[0]?.status || null;

  const result = await query(
    `INSERT INTO orders (
      ml_order_id, user_id, status, date_created, date_closed,
      total_amount, currency_id, buyer_id, buyer_nickname,
      shipping_cost, shipping_status, payment_status, order_data
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (ml_order_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      date_closed = EXCLUDED.date_closed,
      total_amount = EXCLUDED.total_amount,
      buyer_id = EXCLUDED.buyer_id,
      buyer_nickname = EXCLUDED.buyer_nickname,
      shipping_cost = EXCLUDED.shipping_cost,
      shipping_status = EXCLUDED.shipping_status,
      payment_status = EXCLUDED.payment_status,
      order_data = EXCLUDED.order_data,
      updated_at = NOW()
    RETURNING id`,
    [
      ml_order_id, userId, status, date_created, date_closed,
      total_amount, currency_id, buyer_id, buyer_nickname,
      shipping_cost, shipping_status, payment_status, JSON.stringify(orderData)
    ]
  );

  return result.rows[0]?.id;
}

export async function upsertOrderItem(orderId, itemData) {
  const {
    item: { id: ml_item_id, title, category_id },
    quantity,
    unit_price,
  } = itemData;

  const total_price = unit_price * quantity;
  const sku = itemData.item?.seller_sku || null;

  // Verificar se já existe
  const existing = await query(
    'SELECT id FROM order_items WHERE order_id = $1 AND ml_item_id = $2',
    [orderId, ml_item_id]
  );

  if (existing.rows.length > 0) {
    // Atualizar existente
    const result = await query(
      `UPDATE order_items SET
        title = $3, sku = $4, quantity = $5,
        unit_price = $6, total_price = $7, category_id = $8, item_data = $9
      WHERE order_id = $1 AND ml_item_id = $2
      RETURNING id`,
      [
        orderId, ml_item_id, title, sku, quantity,
        unit_price, total_price, category_id, JSON.stringify(itemData)
      ]
    );
    return result.rows[0]?.id;
  } else {
    // Inserir novo
    const result = await query(
      `INSERT INTO order_items (
        order_id, ml_item_id, title, sku, quantity,
        unit_price, total_price, category_id, item_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        orderId, ml_item_id, title, sku, quantity,
        unit_price, total_price, category_id, JSON.stringify(itemData)
      ]
    );
    return result.rows[0]?.id;
  }
}

// ============================================
// HELPERS PARA TRANSAÇÕES
// ============================================

export async function upsertTransaction(transactionData) {
  const {
    order_id,
    order_item_id,
    user_id,
    product_name,
    transaction_date,
    status,
    quantity,
    price,
    buyer_name,
    buyer_cpf,
    buyer_address,
  } = transactionData;

  const result = await query(
    `INSERT INTO transactions (
      order_id, order_item_id, user_id, product_name,
      transaction_date, status, quantity, price,
      buyer_name, buyer_cpf, buyer_address
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT DO NOTHING
    RETURNING id`,
    [
      order_id, order_item_id, user_id, product_name,
      transaction_date, status, quantity, price,
      buyer_name, buyer_cpf, buyer_address
    ]
  );

  return result.rows[0]?.id;
}

// ============================================
// HELPERS PARA ANÁLISE DE PRODUTOS
// ============================================

export async function upsertProductAnalysis(analysisData) {
  const {
    order_id,
    order_item_id,
    product_id,
    user_id,
    product_name,
    sku,
    sale_price,
    product_cost,
    commission,
    shipping,
    extra_fees,
    total_costs,
    profit,
    margin,
    quantity,
    problems,
    analysis_date,
  } = analysisData;

  const result = await query(
    `INSERT INTO product_analysis (
      order_id, order_item_id, product_id, user_id,
      product_name, sku, sale_price, product_cost,
      commission, shipping, extra_fees, total_costs,
      profit, margin, quantity, problems, analysis_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT DO NOTHING
    RETURNING id`,
    [
      order_id, order_item_id, product_id, user_id,
      product_name, sku, sale_price, product_cost,
      commission, shipping, extra_fees, total_costs,
      profit, margin, quantity, problems || [], analysis_date
    ]
  );

  return result.rows[0]?.id;
}

// ============================================
// HELPERS PARA DADOS FINANCEIROS
// ============================================

export async function upsertFinancialData(userId, date, financialData) {
  const {
    day_label,
    revenue,
    expenses,
    revenue_value,
    expenses_value,
    net_revenue,
    profit,
    is_highlight,
  } = financialData;

  const result = await query(
    `INSERT INTO financial_data (
      user_id, date, day_label, revenue, expenses,
      revenue_value, expenses_value, net_revenue, profit, is_highlight
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      day_label = EXCLUDED.day_label,
      revenue = EXCLUDED.revenue,
      expenses = EXCLUDED.expenses,
      revenue_value = EXCLUDED.revenue_value,
      expenses_value = EXCLUDED.expenses_value,
      net_revenue = EXCLUDED.net_revenue,
      profit = EXCLUDED.profit,
      is_highlight = EXCLUDED.is_highlight,
      updated_at = NOW()
    RETURNING id`,
    [
      userId, date, day_label, revenue, expenses,
      revenue_value, expenses_value, net_revenue, profit, is_highlight
    ]
  );

  return result.rows[0]?.id;
}

// ============================================
// HELPERS PARA ESTATÍSTICAS (CACHE)
// ============================================

export async function upsertStatsCache(userId, fromDate, toDate, stats) {
  const {
    total_sales,
    today_sales,
    pending_shipments,
    cancelled,
    total_orders,
    net_revenue,
    real_profit,
    margin,
  } = stats;

  const result = await query(
    `INSERT INTO stats_cache (
      user_id, from_date, to_date, total_sales, today_sales,
      pending_shipments, cancelled, total_orders,
      net_revenue, real_profit, margin
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (user_id, from_date, to_date)
    DO UPDATE SET
      total_sales = EXCLUDED.total_sales,
      today_sales = EXCLUDED.today_sales,
      pending_shipments = EXCLUDED.pending_shipments,
      cancelled = EXCLUDED.cancelled,
      total_orders = EXCLUDED.total_orders,
      net_revenue = EXCLUDED.net_revenue,
      real_profit = EXCLUDED.real_profit,
      margin = EXCLUDED.margin,
      calculated_at = NOW()
    RETURNING id`,
    [
      userId, fromDate, toDate, total_sales, today_sales,
      pending_shipments, cancelled, total_orders,
      net_revenue, real_profit, margin
    ]
  );

  return result.rows[0]?.id;
}

export async function getStatsCache(userId, fromDate, toDate) {
  const result = await query(
    `SELECT * FROM stats_cache
     WHERE user_id = $1 AND from_date = $2 AND to_date = $3
     ORDER BY calculated_at DESC
     LIMIT 1`,
    [userId, fromDate, toDate]
  );

  return result.rows[0];
}

// ============================================
// HELPERS PARA NOTIFICAÇÕES
// ============================================

export async function upsertNotification(userId, notificationData) {
  const {
    id: ml_notification_id,
    type,
    resource,
    data,
    timestamp,
  } = notificationData;

  const result = await query(
    `INSERT INTO notifications (
      user_id, ml_notification_id, type, resource, notification_data, timestamp
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT DO NOTHING
    RETURNING id`,
    [userId, ml_notification_id, type, resource, JSON.stringify(data), timestamp]
  );

  return result.rows[0]?.id;
}

