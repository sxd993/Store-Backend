import { Router } from 'express';
import { pool } from '../database/index.js';

const router = Router();

// Простой поиск по товарам
router.get('/api/search', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.trim().length < 1) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchPattern = `%${query.trim()}%`;
    
    const [items] = await pool.query(`
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
      WHERE p.stock_quantity > 0
        AND (
          p.model LIKE ? OR 
          p.brand LIKE ? OR 
          p.category LIKE ? OR 
          p.description LIKE ? OR
          CONCAT(p.brand, ' ', p.model) LIKE ?
        )
      GROUP BY p.id
      ORDER BY 
        CASE 
          WHEN p.model LIKE ? THEN 1
          WHEN p.brand LIKE ? THEN 2
          WHEN CONCAT(p.brand, ' ', p.model) LIKE ? THEN 3
          ELSE 4
        END,
        p.id ASC
      LIMIT 50
    `, [
      searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
      searchPattern, searchPattern, searchPattern
    ]);

    const results = items.map(item => ({
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
    }));

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка поиска'
    });
  }
});

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

export default router;