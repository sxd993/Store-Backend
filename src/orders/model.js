import { pool } from '../../database/index.js';
import {  ValidationError } from './schema.js';

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