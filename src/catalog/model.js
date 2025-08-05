import { pool } from '../database/index.js';

// Получить каталог с пагинацией
export async function getCatalog(page, per_page) {

    const validatedPage = parseInt(page);
    const validatedPerPage = parseInt(per_page);
    if (isNaN(validatedPage) || isNaN(validatedPerPage) || validatedPage < 1) {
        throw new Error('Неверные параметры пагинации');
    }

    const offset = (validatedPage - 1) * validatedPerPage;

    const query = 
        `SELECT id, name, price, stock_quantity 
         FROM products 
         WHERE stock_quantity > 0 
         ORDER BY id ASC 
         LIMIT ${validatedPerPage} OFFSET ${offset}`;

    const [items] = await pool.execute(query);

    const [countRows] = await pool.execute(
        `SELECT COUNT(*) as total FROM products WHERE stock_quantity > 0`
    );
    const total = countRows.length ? countRows[0].total : 0;
    const pages = Math.ceil(total / validatedPerPage);

    return {
        items,
        pagination: {
            page: validatedPage,
            per_page: validatedPerPage,
            total,
            pages,
            has_next: validatedPage < pages,
            has_prev: validatedPage > 1
        }
    };
}

// Получить товар по ID
export async function getProductById(id) {
  const [rows] = await pool.execute(
    `SELECT id, name, price, stock_quantity 
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
  };
}