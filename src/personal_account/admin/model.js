import { pool } from '../../database/index.js';
import { validateId, validatePagination, validateOrderStatus, ValidationError } from './schema.js';

/**
 * Получение списка всех заказов с пагинацией
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

/**
 * Получение детальной информации о заказе
 */
export async function getOrderDetails(orderId) {
  try {
    const validatedId = validateId(orderId);

    // Получаем основную информацию о заказе
    const [orderRows] = await pool.query(`
      SELECT 
        o.id,
        o.user_id,
        o.total_price,
        o.status,
        o.created_at,
        o.updated_at,
        u.name as user_name,
        u.phone as user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [validatedId]);

    if (!orderRows.length) {
      throw new ValidationError('Заказ не найден');
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
    `, [validatedId]);

    const order = orderRows[0];
    
    return {
      // Основная информация
      id: order.id,
      user_id: order.user_id,
      total_price: parseFloat(order.total_price),
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      
      // Информация о пользователе
      user: {
        name: order.user_name,
        phone: order.user_phone
      },
      
      // Товары в заказе
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
        current_stock: item.current_stock, // Текущее наличие
        is_available: item.current_stock > 0 // Доступен ли сейчас
      })),
      
      // Статистика
      stats: {
        total_items: orderItems.length,
        total_quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0)
      }
    };

  } catch (error) {
    console.error('Ошибка в getOrderDetails:', error);
    throw error;
  }
}

/**
 * Получение всех заказов с информацией о пользователях (для админа в профиле)
 */
export async function getAllOrdersWithUsers(page, per_page) {
  try {
    const { page: validatedPage, per_page: validatedPerPage } = validatePagination(page, per_page);

    const safeLimit = Math.max(1, Math.min(50, validatedPerPage));
    const safeOffset = Math.max(0, (validatedPage - 1) * validatedPerPage);

    // Запрос с JOIN для получения информации о пользователях
    const [orders] = await pool.query(`
      SELECT 
        o.id,
        o.user_id,
        o.total_price,
        o.status,
        o.created_at,
        o.updated_at,
        u.name as user_name,
        u.phone as user_phone,
        COUNT(oi.id) as total_items,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id, o.user_id, o.total_price, o.status, o.created_at, o.updated_at,
               u.name, u.phone
      ORDER BY o.created_at DESC 
      LIMIT ? OFFSET ?
    `, [safeLimit, safeOffset]);

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
        updated_at: order.updated_at,
        user: {
          name: order.user_name,
          phone: order.user_phone
        },
        stats: {
          total_items: parseInt(order.total_items) || 0,
          total_quantity: parseInt(order.total_quantity) || 0
        }
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
    console.error('Ошибка в getAllOrdersWithUsers:', error);
    throw error;
  }
}

/**
 * Получение детальной информации о любом заказе (для админа)
 */
export async function getAnyOrderDetails(orderId) {
  try {
    const validatedId = validateId(orderId);

    // Получаем основную информацию о заказе + пользователе
    const [orderRows] = await pool.query(`
      SELECT 
        o.id,
        o.user_id,
        o.total_price,
        o.status,
        o.created_at,
        o.updated_at,
        u.name as user_name,
        u.phone as user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [validatedId]);

    if (!orderRows.length) {
      throw new ValidationError('Заказ не найден');
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
    `, [validatedId]);

    const order = orderRows[0];
    
    return {
      // Основная информация
      id: order.id,
      user_id: order.user_id,
      total_price: parseFloat(order.total_price),
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      
      // Информация о пользователе
      user: {
        phone: order.user_phone
      },
      
      // Товары в заказе
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
      
      // Статистика
      stats: {
        total_items: orderItems.length,
        total_quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0)
      }
    };

  } catch (error) {
    console.error('Ошибка в getAnyOrderDetails:', error);
    throw error;
  }
}