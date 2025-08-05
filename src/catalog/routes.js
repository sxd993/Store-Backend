import { Router } from 'express';
import { getCatalog, getProductById} from './model.js';
import { validatePagination, validateId, handleError } from './schema.js';

const router = Router();

// GET /catalog - Каталог товаров
router.get('/catalog', async (req, res) => {
  try {
    const { page, per_page } = validatePagination(req.query.page, req.query.per_page);
    const result = await getCatalog(page, per_page);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения каталога');
  }
});

// GET /catalog/:id - Товар по ID
router.get('/catalog/:id', async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const product = await getProductById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден или закончился'
      });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    if (error.message === 'Неверный ID товара') {
      return res.status(400).json({ 
        success: false, 
        message: 'ID товара должен быть положительным числом' 
      });
    }
    handleError(res, error, 'Ошибка получения товара');
  }
});

// GET /catalog/:id/availability - Проверка наличия
router.get('/catalog/:id/availability', async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const quantity = Math.max(1, parseInt(req.query.quantity) || 1);
    const availability = await checkAvailability(id, quantity);
    
    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }
    
    res.json({ success: true, data: availability });
  } catch (error) {
    if (error.message === 'Неверный ID товара') {
      return res.status(400).json({ 
        success: false, 
        message: 'ID товара должен быть положительным числом' 
      });
    }
    handleError(res, error, 'Ошибка проверки наличия');
  }
});

export default router;