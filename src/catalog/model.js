import { pool } from '../database/index.js';
import { validateId, validateProduct, validatePagination } from './schema.js';

const filterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Получить данные для фильтров
export async function getFilterOptions() {
  const cached = filterCache.get('filters');
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const [categories] = await pool.query(
      'SELECT DISTINCT category FROM products WHERE stock_quantity > 0 ORDER BY category'
    );
    
    const [brands] = await pool.query(
      'SELECT DISTINCT brand FROM products WHERE stock_quantity > 0 ORDER BY brand'
    );
    
    const [models] = await pool.query(
      'SELECT DISTINCT model FROM products WHERE stock_quantity > 0 ORDER BY model'
    );
    
    const [colors] = await pool.query(
      'SELECT DISTINCT color FROM products WHERE stock_quantity > 0 ORDER BY color'
    );
    
    const [memory] = await pool.query(
      'SELECT DISTINCT memory FROM products WHERE stock_quantity > 0 ORDER BY memory'
    );

    const data = {
      category: categories.map(r => r.category),
      brand: brands.map(r => r.brand),
      model: models.map(r => r.model),
      colors: colors.map(r => r.color),
      memory: memory.map(r => r.memory)
    };

    filterCache.set('filters', { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('Ошибка в getFilterOptions:', error);
    throw error;
  }
}

// Получить каталог с пагинацией и фильтрами
export async function getCatalog(page, per_page, filters = {}) {
  try {
    const { page: validatedPage, per_page: validatedPerPage } = validatePagination(page, per_page);

    const safeLimit = Math.max(1, Math.min(50, validatedPerPage));
    const safeOffset = Math.max(0, (validatedPage - 1) * validatedPerPage);

    const { whereClause, queryParams } = buildWhereClause(filters);

    const query = `
      SELECT id, price, stock_quantity, model, color, memory, category, image, description, brand
      FROM products 
      ${whereClause}
      ORDER BY id ASC 
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const [items] = await pool.query(query, queryParams);

    const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const [countRows] = await pool.query(countQuery, queryParams);

    const total = countRows.length ? countRows[0].total : 0;
    const pages = Math.ceil(total / validatedPerPage);

    return {
      items: items.map(item => ({
        ...item,
        price: parseFloat(item.price)
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
    console.error('Ошибка в getCatalog:', error);
    throw error;
  }
}

function buildWhereClause(filters) {
  const conditions = ['stock_quantity > 0'];
  const queryParams = [];

  if (filters.category && filters.category !== 'Все категории') {
    conditions.push('category = ?');
    queryParams.push(filters.category);
  }

  if (filters.brand && filters.brand !== 'Все бренды') {
    conditions.push('brand = ?');
    queryParams.push(filters.brand);
  }

  if (filters.model && filters.model !== 'all') {
    conditions.push('model = ?');
    queryParams.push(filters.model);
  }

  if (filters.color && filters.color !== 'all') {
    conditions.push('color = ?');
    queryParams.push(filters.color);
  }

  if (filters.memory && filters.memory !== 'all') {
    conditions.push('memory = ?');
    queryParams.push(filters.memory);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, queryParams };
}

// Обновить товар
export async function updateProduct(id, productData) {
  try {
    const validatedId = validateId(id);
    const validatedData = validateProduct(productData);

    const { price, stock_quantity, model, color, memory, category, image, description, brand } = validatedData;

    const query = `
      UPDATE products 
      SET price = ?, stock_quantity = ?, model = ?, color = ?, memory = ?, category = ?, image = ?, description = ?, brand = ?
      WHERE id = ?
    `;
    const [result] = await pool.execute(query, [
      price,
      stock_quantity,
      model,
      color,
      memory,
      category,
      image,
      description,
      brand,
      validatedId
    ]);

    if (result.affectedRows === 0) {
      throw new Error('Товар не найден или не изменен');
    }

    // Очищаем кеш при изменении товаров
    filterCache.delete('filters');

    return {
      id: validatedId,
      price: parseFloat(price),
      stock_quantity,
      model,
      color,
      memory,
      category,
      image,
      description,
      brand
    };
  } catch (error) {
    console.error('Ошибка в updateProduct:', error);
    throw error;
  }
}

// Получить товар по ID
export async function getProductById(id) {
  try {
    const validatedId = validateId(id);

    const [rows] = await pool.execute(
      `SELECT id, price, stock_quantity, model, color, memory, category, image, description, brand
       FROM products 
       WHERE id = ? AND stock_quantity > 0`,
      [validatedId]
    );

    if (!rows[0]) return null;

    const p = rows[0];
    return {
      id: p.id,
      price: parseFloat(p.price),
      stock_quantity: p.stock_quantity,
      model: p.model,
      color: p.color,
      memory: p.memory,
      category: p.category,
      image: p.image,
      description: p.description,
      brand: p.brand
    };
  } catch (error) {
    console.error('Ошибка в getProductById:', error);
    throw error;
  }
}

// Добавить новый товар
export async function addProduct(productData) {
  try {
    const validatedData = validateProduct(productData);

    const { price, stock_quantity, model, color, memory, category, image, description, brand } = validatedData;

    const query = `
      INSERT INTO products (price, stock_quantity, model, color, memory, category, image, description, brand)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      price,
      stock_quantity,
      model,
      color,
      memory,
      category,
      image,
      description,
      brand
    ]);

    // Очищаем кеш при добавлении товаров
    filterCache.delete('filters');

    return {
      id: result.insertId,
      price: parseFloat(price),
      stock_quantity,
      model,
      color,
      memory,
      category,
      image,
      description,
      brand
    };
  } catch (error) {
    console.error('Ошибка в addProduct:', error);
    throw error;
  }
}