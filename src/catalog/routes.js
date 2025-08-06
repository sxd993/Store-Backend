import { Router } from 'express';
import { getCatalog, getProductById, addProduct, updateProduct } from './model.js';
import { validatePagination, validateId, validateProduct, handleError, ValidationError } from './schema.js';

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

// PUT /catalog/:id - Обновить товар
router.put('/catalog/:id', async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const validatedData = validateProduct(req.body);
    const result = await updateProduct(id, validatedData);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Товар не найден'
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    handleError(res, error, 'Ошибка обновления товара');
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
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.message
      });
    }
    handleError(res, error, 'Ошибка получения товара');
  }
});

// POST /catalog - Добавить товар
router.post('/catalog', async (req, res) => {
  try {
    const validatedData = validateProduct(req.body);
    const result = await addProduct(validatedData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.message
      });
    }
    handleError(res, error, 'Ошибка добавления товара');
  }
});

export default router;