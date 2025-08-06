import { pool } from '../database/index.js';

// Получить каталог с пагинацией
export async function getCatalog(page, per_page) {
  try {
    const validatedPage = parseInt(page);
    const validatedPerPage = parseInt(per_page);

    if (isNaN(validatedPage) || isNaN(validatedPerPage) || validatedPage < 1 || validatedPerPage < 1) {
      throw new Error('Неверные параметры пагинации');
    }

    const offset = (validatedPage - 1) * validatedPerPage;

    const safeLimit = Math.max(1, Math.min(50, parseInt(validatedPerPage)));
    const safeOffset = Math.max(0, parseInt(offset));
    
    const query = `
      SELECT id, name, price, stock_quantity, color, memory, image, description
      FROM products 
      WHERE stock_quantity > 0 
      ORDER BY id ASC 
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const [items] = await pool.execute(query, [validatedPerPage, offset]);

    const [countRows] = await pool.execute(
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
export const updateProduct = async (id, productData) => {
  try {
    const { name, price, stock_quantity, color, memory, image, description } = productData;
    const query = `
      UPDATE products 
      SET name = ?, price = ?, stock_quantity = ?, color = ?, memory = ?, image = ?, description = ?
      WHERE id = ?
    `;
    const [result] = await pool.execute(query, [
      name,
      price,
      stock_quantity,
      color,
      memory,
      image,
      description,
      id
    ]);
    if (result.affectedRows === 0) {
      throw new Error('Товар не найден или не изменен');
    }
    return {
      id,
      name,
      price: parseFloat(price),
      stock_quantity,
      color,
      memory,
      image,
      description
    };
  } catch (error) {
    console.error('Ошибка в updateProduct:', error);
    throw error;
  }
}

// Получить товар по ID
export async function getProductById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, price, stock_quantity, color, memory, image, description
       FROM products 
       WHERE id = ? AND stock_quantity > 0`,
      [id]
    );

    if (!rows[0]) return null;

    const p = rows[0];
    return {
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      stock_quantity: p.stock_quantity,
      color: p.color,
      memory: p.memory,
      image: p.image,
      description: p.description
    };
  } catch (error) {
    console.error('Ошибка в getProductById:', error);
    throw error;
  }
}

// Добавить новый товар
export async function addProduct(productData) {
  try {
    const { name, price, stock_quantity, color, memory, image, description } = productData;

    const query = `
      INSERT INTO products (name, price, stock_quantity, color, memory, image, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      name,
      price,
      stock_quantity,
      color,
      memory,
      image,
      description
    ]);

    return {
      id: result.insertId,
      name,
      price: parseFloat(price),
      stock_quantity,
      color,
      memory,
      image,
      description
    };
  } catch (error) {
    console.error('Ошибка в addProduct:', error);
    throw error;
  }
}