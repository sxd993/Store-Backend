import { pool } from '../../database/index.js';
import { validateId, validatePagination, ValidationError } from './schema.js';

/**
 * Получение заказов конкретного пользователя
 */
export async function getUserOrders(userId, page, per_page) {
  try {
    const validatedUserId = validateId(userId);
    const { page: validatedPage, per_page: validatedPerPage } = validatePagination(page, per_page);

    const safeLimit = Math.max(1, Math.min(50, validatedPerPage));
    const safeOffset = Math.max(0, (validatedPage - 1) * validatedPerPage);

    const [orders] = await pool.query(`
      SELECT 
        id,
        total_price,
        status,
        created_at,
        updated_at
      FROM orders 
      WHERE user_id = ?
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [validatedUserId, safeLimit, safeOffset]);

    // Получение общего количества заказов пользователя
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`,
      [validatedUserId]
    );

    const total = countRows[0].total;
    const pages = Math.ceil(total / validatedPerPage);

    return {
      items: orders.map(order => ({
        id: order.id,
        total_price: parseFloat(order.total_price),
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at
      })),
      pagination: {
        page: validatedPage,
        per_page: validatedPerPage,
        total,
        pages,
        has_next: validatedPage < pages,
        has_prev: validatedPage > 1
      }
    };
  } catch (error) {
    console.error('Ошибка в getUserOrders:', error);
    throw error;
  }
}

/**
 * Получение детальной информации о заказе пользователя
 */
export async function getUserOrderDetails(userId, orderId) {
  try {
    const validatedUserId = validateId(userId);
    const validatedOrderId = validateId(orderId);

    // Проверяем, что заказ принадлежит пользователю
    const [orderRows] = await pool.query(`
      SELECT 
        id,
        user_id,
        total_price,
        status,
        created_at,
        updated_at
      FROM orders 
      WHERE id = ? AND user_id = ?
    `, [validatedOrderId, validatedUserId]);

    if (!orderRows.length) {
      throw new ValidationError('Заказ не найден или не принадлежит пользователю');
    }

    // Получаем товары заказа
    const [orderItems] = await pool.query(`
      SELECT 
        oi.product_id,
        oi.price as order_price,
        oi.quantity,
        p.model,
        p.brand,
        p.color,
        p.memory,
        p.category,
        p.stock_quantity as current_stock,
        pi.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = 1
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `, [validatedOrderId]);

    const order = orderRows[0];
    
    return {
      id: order.id,
      total_price: parseFloat(order.total_price),
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      
      items: orderItems.map(item => ({
        product_id: item.product_id,
        name: `${item.brand || ''} ${item.model || ''}`.trim(),
        brand: item.brand,
        model: item.model,
        color: item.color,
        memory: item.memory,
        category: item.category,
        price_at_order: parseFloat(item.order_price),
        quantity: item.quantity,
        subtotal: parseFloat(item.order_price) * item.quantity,
        image: item.image_url,
        current_stock: item.current_stock,
        is_available: item.current_stock > 0
      })),
      
      stats: {
        total_items: orderItems.length,
        total_quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0)
      }
    };

  } catch (error) {
    console.error('Ошибка в getUserOrderDetails:', error);
    throw error;
  }
}