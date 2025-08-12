// src/cart/model.js
import { pool } from '../database/index.js';

const cartCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 минуты

/**
 * Получить корзину пользователя
 */
export async function getUserCart(userId) {
  const cacheKey = `cart_${userId}`;
  const cached = cartCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.cart;
  }
  
  const [rows] = await pool.execute(`
    SELECT 
      uc.product_id as id,
      uc.quantity,
      CONCAT(p.brand, ' ', p.model) as name,
      p.brand,
      p.model,
      p.price,
      p.category,
      p.color,
      p.memory,
      p.stock_quantity,
      uc.created_at as added_at,
      pi.image_url as image
    FROM user_carts uc
    JOIN products p ON uc.product_id = p.id
    LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = 1
    WHERE uc.user_id = ?
    ORDER BY uc.created_at DESC
  `, [userId]);
  
  cartCache.set(cacheKey, {
    cart: rows,
    timestamp: Date.now()
  });
  
  return rows;
}

/**
 * Добавить товар в корзину пользователя
 */
export async function addToUserCart(userId, productId, quantity = 1) {
  // Проверяем существование товара и наличие
  const [productRows] = await pool.execute(
    'SELECT id, stock_quantity FROM products WHERE id = ?',
    [productId]
  );
  
  if (productRows.length === 0) {
    throw new Error('Товар не найден');
  }
  
  if (productRows[0].stock_quantity < quantity) {
    throw new Error('Недостаточно товара на складе');
  }
  
  // Добавляем или обновляем количество
  await pool.execute(`
    INSERT INTO user_carts (user_id, product_id, quantity)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      quantity = quantity + VALUES(quantity),
      updated_at = CURRENT_TIMESTAMP
  `, [userId, productId, quantity]);
  
  clearUserCartCache(userId);
  return await getUserCart(userId);
}

/**
 * Обновить количество товара в корзине
 */
export async function updateCartItem(userId, productId, quantity) {
  if (quantity <= 0) {
    return await removeFromUserCart(userId, productId);
  }
  
  // Проверяем наличие на складе
  const [productRows] = await pool.execute(
    'SELECT stock_quantity FROM products WHERE id = ?',
    [productId]
  );
  
  if (productRows.length === 0) {
    throw new Error('Товар не найден');
  }
  
  if (productRows[0].stock_quantity < quantity) {
    throw new Error('Недостаточно товара на складе');
  }
  
  const [result] = await pool.execute(
    'UPDATE user_carts SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
    [quantity, userId, productId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('Товар не найден в корзине');
  }
  
  clearUserCartCache(userId);
  return await getUserCart(userId);
}

/**
 * Удалить товар из корзины пользователя
 */
export async function removeFromUserCart(userId, productId) {
  const [result] = await pool.execute(
    'DELETE FROM user_carts WHERE user_id = ? AND product_id = ?',
    [userId, productId]
  );
  
  if (result.affectedRows === 0) {
    throw new Error('Товар не найден в корзине');
  }
  
  clearUserCartCache(userId);
  return await getUserCart(userId);
}

/**
 * Очистить всю корзину пользователя
 */
export async function clearUserCart(userId) {
  await pool.execute(
    'DELETE FROM user_carts WHERE user_id = ?',
    [userId]
  );
  
  clearUserCartCache(userId);
  return [];
}

/**
 * Синхронизировать корзину при авторизации
 */
export async function syncUserCart(userId, localCartItems) {
  if (!Array.isArray(localCartItems) || localCartItems.length === 0) {
    return await getUserCart(userId);
  }
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // Получаем текущую корзину пользователя
    const [currentCart] = await connection.execute(
      'SELECT product_id, quantity FROM user_carts WHERE user_id = ?',
      [userId]
    );
    
    const currentCartMap = new Map(
      currentCart.map(item => [item.product_id, item.quantity])
    );
    
    // Обрабатываем каждый товар из localStorage
    for (const item of localCartItems) {
      const { id: product_id, quantity } = item; // item.id вместо item.product_id
      
      // Проверяем существование товара
      const [productExists] = await connection.execute(
        'SELECT id, stock_quantity FROM products WHERE id = ?',
        [product_id]
      );
      
      if (productExists.length === 0) continue;
      
      const currentQuantity = currentCartMap.get(product_id) || 0;
      const newQuantity = currentQuantity + quantity;
      const maxQuantity = Math.min(newQuantity, productExists[0].stock_quantity);
      
      if (maxQuantity > 0) {
        await connection.execute(`
          INSERT INTO user_carts (user_id, product_id, quantity)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            quantity = ?,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, product_id, maxQuantity, maxQuantity]);
      }
    }
    
    await connection.commit();
    clearUserCartCache(userId);
    
    return await getUserCart(userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Утилиты кеширования
export function clearUserCartCache(userId) {
  cartCache.delete(`cart_${userId}`);
}

export function clearAllCartCache() {
  cartCache.clear();
}