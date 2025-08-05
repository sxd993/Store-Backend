import { pool } from '../database/index.js';

// Получить каталог с пагинацией
export async function getCatalog(page, per_page) {
  const offset = (page - 1) * per_page;
  
  const [productsResult, countResult] = await Promise.all([
    pool.execute(
      `SELECT id, name, price, stock_quantity 
       FROM products 
       WHERE stock_quantity > 0 
       ORDER BY id ASC 
       LIMIT ? OFFSET ?`,
      [per_page, offset]
    ),
    pool.execute(
      'SELECT COUNT(*) as total FROM products WHERE stock_quantity > 0'
    )
  ]);

  const products = productsResult[0].map(p => ({
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    stock_quantity: p.stock_quantity
  }));

  const total = countResult[0][0].total;
  const pages = Math.ceil(total / per_page) || 1;
  
  return {
    items: products,
    pagination: {
      total,
      page,
      per_page,
      pages,
      has_next: page < pages,
      has_prev: page > 1
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
    stock_quantity: p.stock_quantity
  };
}
