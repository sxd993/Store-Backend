import { pool } from '../database/index.js';

// Получить каталог с пагинацией
export async function getCatalog(page, per_page) {
  try {
    const { page: validatedPage, per_page: validatedPerPage } = validatePagination(page, per_page);

    const safeLimit = Math.max(1, Math.min(50, validatedPerPage));
    const safeOffset = Math.max(0, (validatedPage - 1) * validatedPerPage);

    const query = `
      SELECT id, price, stock_quantity, model, color, memory, category, image, description, brand
      FROM products 
      WHERE stock_quantity > 0 
      ORDER BY id ASC 
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const [items] = await pool.query(query);

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM products WHERE stock_quantity > 0`
    );

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

// Кастомный класс для ошибок валидации
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Валидация пагинации
export function validatePagination(page, per_page) {
  const parsedPage = parseInt(page);
  const parsedPerPage = parseInt(per_page);

  return {
    page: isNaN(parsedPage) ? 1 : Math.max(1, Math.min(10000, parsedPage)),
    per_page: isNaN(parsedPerPage) ? 20 : Math.max(1, Math.min(50, parsedPerPage)),
  };
}

// Валидация ID товара
export function validateId(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || numId < 1) {
    throw new ValidationError('ID товара должен быть положительным числом');
  }
  return numId;
}

// Функция базовой санитизации строк
function basicSanitize(str) {
  if (!str) return str;
  return str.replace(/<script.*?>.*?<\/script>/gi, '')
           .replace(/javascript:/gi, '')
           .replace(/on\w+\s*=/gi, '');
}

// Валидация данных товара для добавления/обновления
export function validateProduct(productData) {
  if (!productData || typeof productData !== 'object') {
    throw new ValidationError('Данные товара обязательны');
  }

  const { price, stock_quantity, model, color, memory, category, image, description, brand } = productData;

  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    throw new ValidationError('Цена должна быть положительным числом');
  }

  if (stock_quantity === undefined || isNaN(parseInt(stock_quantity)) || parseInt(stock_quantity) < 0) {
    throw new ValidationError('Количество на складе должно быть неотрицательным числом');
  }

  if (!model || typeof model !== 'string' || model.trim().length === 0) {
    throw new ValidationError('Модель товара обязательна');
  }

  if (!color || typeof color !== 'string' || color.trim().length === 0) {
    throw new ValidationError('Цвет товара обязателен');
  }

  if (!memory || typeof memory !== 'string' || memory.trim().length === 0) {
    throw new ValidationError('Объем памяти обязателен');
  }

  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    throw new ValidationError('Категория товара обязательна');
  }

  if (!image || typeof image !== 'string' || image.trim().length === 0) {
    throw new ValidationError('Изображение товара обязательно');
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new ValidationError('Описание товара обязательно');
  }

  if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
    throw new ValidationError('Бренд товара обязателен');
  }

  return {
    price: parseFloat(price),
    stock_quantity: parseInt(stock_quantity),
    model: basicSanitize(model.trim()),
    color: basicSanitize(color.trim()),
    memory: basicSanitize(memory.trim()),
    category: basicSanitize(category.trim()),
    image: basicSanitize(image.trim()),
    description: basicSanitize(description.trim()),
    brand: basicSanitize(brand.trim())
  };
}

// Обработка ошибок
export function handleError(res, error, message = 'Внутренняя ошибка сервера') {
  console.error('Error:', error);
  res.status(500).json({ success: false, message });
}