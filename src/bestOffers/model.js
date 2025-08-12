import { pool } from '../database/index.js';

export async function getBestOffers() {
  const [rows] = await pool.execute(`
    SELECT 
      bo.position,
      bo.product_id as configured_id,
      p.id, p.price, p.model, p.color, p.memory, p.brand,
      GROUP_CONCAT(pi.image_url ORDER BY pi.is_primary DESC, pi.sort_order ASC) as images
    FROM best_offers bo
    LEFT JOIN products p ON bo.product_id = p.id
    LEFT JOIN product_images pi ON p.id = pi.product_id
    GROUP BY bo.position, bo.product_id, p.id
    ORDER BY bo.position ASC
  `);

  return {
    products: rows.map(row => {
      if (!row.id) return null; // Товар не найден - вернем null для красной карточки
      
      return {
        id: row.id,
        price: parseFloat(row.price),
        model: row.model,
        color: row.color,
        memory: row.memory,
        brand: row.brand,
        images: row.images ? row.images.split(',').map(url => ({ url })) : []
      };
    }),
    configuredIds: rows.map(row => row.configured_id) // ID из БД (даже несуществующие)
  };
}

export async function updateBestOffers(productIds) {
  // Обновляем позиции без всяких проверок
  for (let i = 0; i < 4; i++) {
    await pool.execute(
      'UPDATE best_offers SET product_id = ? WHERE position = ?',
      [productIds[i], i + 1]
    );
  }

  return await getBestOffers();
}