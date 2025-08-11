import { pool } from '../database/index.js';
import { validateId, validateProduct, validatePagination } from './schema.js';

const filterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

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

export async function getCatalog(page, per_page, filters = {}) {
  try {
    const { page: validatedPage, per_page: validatedPerPage } = validatePagination(page, per_page);

    const safeLimit = Math.max(1, Math.min(50, validatedPerPage));
    const safeOffset = Math.max(0, (validatedPage - 1) * validatedPerPage);

    const { whereClause, queryParams } = buildWhereClause(filters);

    const query = `
      SELECT 
        p.id, p.price, p.stock_quantity, p.model, p.color, p.memory, 
        p.category, p.description, p.brand,
        GROUP_CONCAT(
          CONCAT(pi.image_url, '|', pi.is_primary, '|', pi.sort_order) 
          ORDER BY pi.is_primary DESC, pi.sort_order ASC 
          SEPARATOR ','
        ) as images_data
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.id ASC 
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const [items] = await pool.query(query, queryParams);

    const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause.replace('GROUP BY p.id', '')}`;
    const [countRows] = await pool.query(countQuery, queryParams);

    const total = countRows.length ? countRows[0].total : 0;
    const pages = Math.ceil(total / validatedPerPage);

    return {
      items: items.map(item => ({
        id: item.id,
        price: parseFloat(item.price),
        stock_quantity: item.stock_quantity,
        model: item.model,
        color: item.color,
        memory: item.memory,
        category: item.category,
        description: item.description,
        brand: item.brand,
        images: parseImagesData(item.images_data)
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

function parseImagesData(imagesData) {
  if (!imagesData) return [];

  return imagesData
    .split(',')
    .map(item => {
      const [url, is_primary, sort_order] = item.split('|');
      return {
        url,
        is_primary: is_primary === '1',
        sort_order: parseInt(sort_order) || 0
      };
    })
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return b.is_primary - a.is_primary;
      return a.sort_order - b.sort_order;
    });
}

function buildWhereClause(filters) {
  const conditions = ['p.stock_quantity > 0'];
  const queryParams = [];

  if (filters.category && filters.category !== 'Все категории') {
    conditions.push('p.category = ?');
    queryParams.push(filters.category);
  }

  if (filters.brand && filters.brand !== 'Все бренды') {
    conditions.push('p.brand = ?');
    queryParams.push(filters.brand);
  }

  if (filters.model && filters.model !== 'all') {
    conditions.push('p.model = ?');
    queryParams.push(filters.model);
  }

  if (filters.color && filters.color !== 'all') {
    conditions.push('p.color = ?');
    queryParams.push(filters.color);
  }

  if (filters.memory && filters.memory !== 'all') {
    conditions.push('p.memory = ?');
    queryParams.push(filters.memory);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, queryParams };
}

export async function getProductById(id) {
  try {
    const validatedId = validateId(id);

    const [rows] = await pool.execute(
      `SELECT id, price, stock_quantity, model, color, memory, category, description, brand
       FROM products 
       WHERE id = ? AND stock_quantity > 0`,
      [validatedId]
    );

    if (!rows[0]) return null;

    const [images] = await pool.execute(
      'SELECT image_url as url, sort_order, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC',
      [validatedId]
    );

    const product = rows[0];
    return {
      id: product.id,
      price: parseFloat(product.price),
      stock_quantity: product.stock_quantity,
      model: product.model,
      color: product.color,
      memory: product.memory,
      category: product.category,
      description: product.description,
      brand: product.brand,
      images: images.map(img => ({
        url: img.url,
        is_primary: Boolean(img.is_primary),
        sort_order: img.sort_order
      }))
    };
  } catch (error) {
    console.error('Ошибка в getProductById:', error);
    throw error;
  }
}
export async function addProduct(productData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const validatedData = validateProduct(productData);
    const { price, stock_quantity, model, color, memory, category, description, brand, images } = validatedData;

    // Вставляем сам товар
    const query = `
      INSERT INTO products (price, stock_quantity, model, color, memory, category, description, brand)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(query, [
      price,
      stock_quantity,
      model,
      color,
      memory,
      category,
      description,
      brand
    ]);

    const productId = result.insertId;

    // Вставляем изображения, если есть
    if (images && images.length > 0) {
      const imageValues = images.map((url, index) => [
        productId,
        url,
        index,
        index === 0
      ]);

      const placeholders = imageValues.map(() => '(?, ?, ?, ?)').join(', ');
      const imageInsertQuery = `
        INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
        VALUES ${placeholders}
      `;

      await connection.execute(imageInsertQuery, imageValues.flat());
    }

    await connection.commit();
    filterCache.delete('filters');

    return {
      id: productId,
      price: parseFloat(price),
      stock_quantity,
      model,
      color,
      memory,
      category,
      description,
      brand
    };
  } catch (error) {
    await connection.rollback();
    console.error('Ошибка в addProduct:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateProduct(id, productData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const validatedId = validateId(id);
    const validatedData = validateProduct(productData);
    const { price, stock_quantity, model, color, memory, category, description, brand, images } = validatedData;

    // Обновляем товар
    const query = `
      UPDATE products 
      SET price = ?, stock_quantity = ?, model = ?, color = ?, memory = ?, category = ?, description = ?, brand = ?
      WHERE id = ?
    `;

    const [result] = await connection.execute(query, [
      price,
      stock_quantity,
      model,
      color,
      memory,
      category,
      description,
      brand,
      validatedId
    ]);

    if (result.affectedRows === 0) {
      throw new Error('Товар не найден или не изменен');
    }

    // Если переданы изображения
    if (images !== undefined) {
      await connection.execute('DELETE FROM product_images WHERE product_id = ?', [validatedId]);

      if (images.length > 0) {
        const imageValues = images.map((url, index) => [
          validatedId,
          url,
          index,
          index === 0
        ]);

        const placeholders = imageValues.map(() => '(?, ?, ?, ?)').join(', ');
        const imageInsertQuery = `
          INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
          VALUES ${placeholders}
        `;

        await connection.execute(imageInsertQuery, imageValues.flat());
      }
    }

    await connection.commit();
    filterCache.delete('filters');

    return {
      id: validatedId,
      price: parseFloat(price),
      stock_quantity,
      model,
      color,
      memory,
      category,
      description,
      brand
    };
  } catch (error) {
    await connection.rollback();
    console.error('Ошибка в updateProduct:', error);
    throw error;
  } finally {
    connection.release();
  }
}
