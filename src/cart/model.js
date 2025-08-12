import { pool } from '../database/index.js';

// Кеш корзин пользователей
const cartCache = new Map();
const CACHE_TTL = 3 * 60 * 1000; // 3 минуты

/**
 * Получить корзину пользователя
 */
export async function getUserCart(userId) {
  const cacheKey = `cart_${userId}`;
  const cached = cartCache.get(cacheKey);
  
  // Проверяем кеш
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.cart;
  }
  
  const [rows] = await pool.execute(`
    SELECT 
      uc.product_id as id,
      uc.quantity,
      p.name,
      p.brand,
      p.model,
      p.price,
      p.category,
      p.color,
      p.memory,
      p.image,
      p.stock_quantity,
      uc.created_at as added_at
    FROM user_carts uc
    JOIN products p ON uc.product_id = p.id
    WHERE uc.user_id = ?
    ORDER BY uc.created_at DESC
  `, [userId]);
  
  // Кешируем результат
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
  try {
    // Проверяем существование товара и его наличие
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
    
    // Пытаемся добавить или обновить количество
    await pool.execute(`
      INSERT INTO user_carts (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        quantity = quantity + VALUES(quantity),
        updated_at = CURRENT_TIMESTAMP
    `, [userId, productId, quantity]);
    
    // Очищаем кеш
    clearUserCartCache(userId);
    
    return await getUserCart(userId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Товар уже в корзине');
    }
    throw error;
  }
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
  
  // Начинаем транзакцию
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
      const { product_id, quantity } = item;
      
      // Проверяем существование товара
      const [productExists] = await connection.execute(
        'SELECT id, stock_quantity FROM products WHERE id = ?',
        [product_id]
      );
      
      if (productExists.length === 0) continue; // Пропускаем несуществующие товары
      
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

/**
 * Получить информацию о товарах по их ID (для расчета актуальных цен)
 */
export async function getCartItemsInfo(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }
  
  const placeholders = productIds.map(() => '?').join(',');
  const [rows] = await pool.execute(`
    SELECT 
      id,
      name,
      brand,
      model,
      price,
      category,
      color,
      memory,
      image,
      stock_quantity,
      (stock_quantity > 0) as available
    FROM products 
    WHERE id IN (${placeholders})
  `, productIds);
  
  return rows;
}

/**
 * Получить количество товаров в корзине
 */
export async function getCartItemsCount(userId) {
  const [rows] = await pool.execute(
    'SELECT COALESCE(SUM(quantity), 0) as total_items FROM user_carts WHERE user_id = ?',
    [userId]
  );
  
  return parseInt(rows[0].total_items) || 0;
}

/**
 * Проверить есть ли товар в корзине
 */
export async function isItemInUserCart(userId, productId) {
  const [rows] = await pool.execute(
    'SELECT id FROM user_carts WHERE user_id = ? AND product_id = ?',
    [userId, productId]
  );
  
  return rows.length > 0;
}

/**
 * Получить количество конкретного товара в корзине
 */
export async function getUserCartItemQuantity(userId, productId) {
  const [rows] = await pool.execute(
    'SELECT quantity FROM user_carts WHERE user_id = ? AND product_id = ?',
    [userId, productId]
  );
  
  return rows.length > 0 ? rows[0].quantity : 0;
}

// Утилиты для кеширования
export function clearUserCartCache(userId) {
  cartCache.delete(`cart_${userId}`);
}

export function clearAllCartCache() {
  cartCache.clear();
}

// Очистка старых записей кеша
export function cleanupCartCache() {
  const now = Date.now();
  for (const [key, cached] of cartCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      cartCache.delete(key);
    }
  }
}