import { pool } from '../../database/index.js';
import { validateId, validatePagination, validateOrderStatus, ValidationError } from './schema.js';

/**
 * Получение списка заказов с пагинацией
 */
export async function getOrders(page, per_page) {
  try {
    const { page: validatedPage, per_page: validatedPerPage } = validatePagination(page, per_page);

    const safeLimit = Math.max(1, Math.min(50, validatedPerPage));
    const safeOffset = Math.max(0, (validatedPage - 1) * validatedPerPage);

    // Безопасный параметризованный запрос
    const [orders] = await pool.query(
      `SELECT 
        id,
        user_id,
        total_price,
        status,
        created_at,
        updated_at
       FROM orders 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [safeLimit, safeOffset]
    );

    // Получение общего количества
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM orders`);

    const total = countRows[0].total;
    const pages = Math.ceil(total / validatedPerPage);

    return {
      items: orders.map(order => ({
        id: order.id,
        user_id: order.user_id,
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
    console.error('Ошибка в getOrders:', error);
    throw error;
  }
}

/**
 * Создание заказа из корзины пользователя
 */
export async function createOrder(userId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Проверяем корзину и получаем товары одним запросом
    const [cartItems] = await connection.query(`
      SELECT 
        uc.product_id, 
        uc.quantity, 
        p.price
      FROM user_carts uc
      JOIN products p ON uc.product_id = p.id
      WHERE uc.user_id = ? AND uc.quantity > 0
    `, [userId]);

    if (!cartItems.length) {
      throw new ValidationError('Корзина пуста');
    }

    // Вычисляем общую стоимость
    const totalPrice = cartItems.reduce((sum, item) =>
      sum + (parseFloat(item.price) * item.quantity), 0
    );

    // Создаем заказ
    const [orderResult] = await connection.query(`
      INSERT INTO orders (user_id, total_price, status, created_at) 
      VALUES (?, ?, 'Ожидает оплаты', NOW())
    `, [userId, totalPrice]);

    const orderId = orderResult.insertId;

    // Добавляем товары в заказ
    const orderItemsValues = cartItems.map(item => [
      orderId,
      item.product_id,
      parseFloat(item.price),
      item.quantity
    ]);

    await connection.query(`
      INSERT INTO order_items (order_id, product_id, price, quantity) 
      VALUES ?
    `, [orderItemsValues]);

    // Очищаем корзину
    await connection.query(`DELETE FROM user_carts WHERE user_id = ?`, [userId]);

    await connection.commit();

    return {
      id: orderId,
      user_id: userId,
      total_price: totalPrice,
      status: 'Ожидает оплаты',
      created_at: new Date()
    };

  } catch (error) {
    await connection.rollback();
    console.error('Ошибка в createOrder:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Обновление статуса заказа (для админки)
 */
export async function updateOrderStatus(orderId, newStatus) {
  try {
    const validatedId = validateId(orderId);
    const validatedStatus = validateOrderStatus(newStatus);

    // Проверяем существование заказа
    const [existingOrder] = await pool.query(
      `SELECT id, status FROM orders WHERE id = ?`,
      [validatedId]
    );

    if (!existingOrder.length) {
      throw new ValidationError('Заказ не найден');
    }

    // Обновляем статус
    await pool.query(`
      UPDATE orders 
      SET status = ?, updated_at = NOW() 
      WHERE id = ?
    `, [validatedStatus, validatedId]);

    return {
      id: validatedId,
      status: validatedStatus,
      updated_at: new Date()
    };

  } catch (error) {
    console.error('Ошибка в updateOrderStatus:', error);
    throw error;
  }
}