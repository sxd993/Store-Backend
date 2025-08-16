import { pool } from '../database/index.js';
import { validateId, validateProduct, validatePagination } from './schema.js';

const filterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Получение динамических опций для фильтров
 * Учитывает уже примененные фильтры для обновления доступных опций
 */
export async function getFilterOptions(appliedFilters = {}) {
  // Создаем уникальный ключ кеша на основе примененных фильтров
  const cacheKey = `filters_${JSON.stringify(appliedFilters)}`;
  const cached = filterCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Базовое условие - только товары в наличии
    const baseConditions = ['p.stock_quantity > 0'];
    const baseParams = [];

    // Добавляем условия для каждого примененного фильтра
    if (appliedFilters.category) {
      baseConditions.push('p.category = ?');
      baseParams.push(appliedFilters.category);
    }
    if (appliedFilters.brand) {
      baseConditions.push('p.brand = ?');
      baseParams.push(appliedFilters.brand);
    }
    if (appliedFilters.model) {
      baseConditions.push('p.model = ?');
      baseParams.push(appliedFilters.model);
    }
    if (appliedFilters.color) {
      baseConditions.push('p.color = ?');
      baseParams.push(appliedFilters.color);
    }
    if (appliedFilters.memory) {
      baseConditions.push('p.memory = ?');
      baseParams.push(appliedFilters.memory);
    }

    const baseWhere = baseConditions.join(' AND ');

    // Получаем доступные категории
    const categoryConditions = baseConditions.filter(c => !c.includes('p.category'));
    const categoryParams = baseParams.filter((_, i) => !baseConditions[i].includes('p.category'));
    const categoryWhere = categoryConditions.length > 0 ? `WHERE ${categoryConditions.join(' AND ')}` : 'WHERE p.stock_quantity > 0';
    
    const [categories] = await pool.query(
      `SELECT DISTINCT p.category, COUNT(*) as count 
       FROM products p 
       ${categoryWhere}
       GROUP BY p.category 
       ORDER BY p.category`,
      categoryParams
    );

    // Получаем доступные бренды
    const brandConditions = baseConditions.filter(c => !c.includes('p.brand'));
    const brandParams = baseParams.filter((_, i) => !baseConditions[i].includes('p.brand'));
    const brandWhere = brandConditions.length > 0 ? `WHERE ${brandConditions.join(' AND ')}` : 'WHERE p.stock_quantity > 0';
    
    const [brands] = await pool.query(
      `SELECT DISTINCT p.brand, COUNT(*) as count 
       FROM products p 
       ${brandWhere}
       GROUP BY p.brand 
       ORDER BY p.brand`,
      brandParams
    );

    // Получаем доступные модели (с учетом всех фильтров кроме модели)
    const modelConditions = baseConditions.filter(c => !c.includes('p.model'));
    const modelParams = baseParams.filter((_, i) => !baseConditions[i].includes('p.model'));
    const modelWhere = modelConditions.length > 0 ? `WHERE ${modelConditions.join(' AND ')}` : 'WHERE p.stock_quantity > 0';
    
    const [models] = await pool.query(
      `SELECT DISTINCT p.model, COUNT(*) as count 
       FROM products p 
       ${modelWhere}
       GROUP BY p.model 
       ORDER BY p.model`,
      modelParams
    );

    // Получаем доступные цвета (с учетом всех фильтров кроме цвета)
    const colorConditions = baseConditions.filter(c => !c.includes('p.color'));
    const colorParams = baseParams.filter((_, i) => !baseConditions[i].includes('p.color'));
    const colorWhere = colorConditions.length > 0 ? `WHERE ${colorConditions.join(' AND ')}` : 'WHERE p.stock_quantity > 0';
    
    const [colors] = await pool.query(
      `SELECT DISTINCT p.color, COUNT(*) as count 
       FROM products p 
       ${colorWhere}
       AND p.color IS NOT NULL AND p.color != ''
       GROUP BY p.color 
       ORDER BY p.color`,
      colorParams
    );

    // Получаем доступную память (с учетом всех фильтров кроме памяти)
    const memoryConditions = baseConditions.filter(c => !c.includes('p.memory'));
    const memoryParams = baseParams.filter((_, i) => !baseConditions[i].includes('p.memory'));
    const memoryWhere = memoryConditions.length > 0 ? `WHERE ${memoryConditions.join(' AND ')}` : 'WHERE p.stock_quantity > 0';
    
    const [memory] = await pool.query(
      `SELECT DISTINCT p.memory, COUNT(*) as count 
       FROM products p 
       ${memoryWhere}
       AND p.memory IS NOT NULL AND p.memory != ''
       GROUP BY p.memory 
       ORDER BY CAST(p.memory AS UNSIGNED)`,
      memoryParams
    );

    const data = {
      category: categories.map(r => r.category).filter(Boolean),
      brand: brands.map(r => r.brand).filter(Boolean),
      model: models.map(r => r.model).filter(Boolean),
      colors: colors.map(r => r.color).filter(Boolean),
      memory: memory.map(r => r.memory).filter(Boolean)
    };

    // Кешируем результат
    filterCache.set(cacheKey, { data, timestamp: Date.now() });
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
      ORDER BY p.id DESC 
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const [items] = await pool.query(query, queryParams);

    const countQuery = `SELECT COUNT(DISTINCT p.id) as total FROM products p ${whereClause}`;
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

/**
 * Построение WHERE условия для SQL запроса
 */
function buildWhereClause(filters) {
  const conditions = ['p.stock_quantity > 0'];
  const queryParams = [];

  // Обрабатываем каждый фильтр
  const filterMapping = {
    category: 'p.category',
    brand: 'p.brand', 
    model: 'p.model',
    color: 'p.color',
    memory: 'p.memory'
  };

  Object.entries(filters).forEach(([key, value]) => {
    // Пропускаем пустые значения и значения по умолчанию
    if (!value || 
        value === 'all' || 
        value === 'Все категории' || 
        value === 'Все бренды' ||
        value === 'Любой' ||
        value === 'Любая') {
      return;
    }

    // Добавляем условие в WHERE
    if (filterMapping[key]) {
      conditions.push(`${filterMapping[key]} = ?`);
      queryParams.push(value);
    }
  });

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

// Функции addProduct и updateProduct остаются без изменений
export async function addProduct(productData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const validatedData = validateProduct(productData);
    const { price, stock_quantity, model, color, memory, category, description, brand, images } = validatedData;

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
    filterCache.clear();

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
    filterCache.clear();

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