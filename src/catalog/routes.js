import { Router } from 'express';
import { getCatalog, getProductById, addProduct, updateProduct, getFilterOptions } from './model.js';
import { validatePagination, validateId, validateProduct, validateFilters, handleError, ValidationError } from './schema.js';

const router = Router();

// GET /catalog/filters - Данные для фильтров
router.get('/catalog/filters', async (req, res) => {
  try {
    const filterData = await getFilterOptions();
    res.json({ success: true, data: filterData });
  } catch (error) {
    handleError(res, error, 'Ошибка получения данных фильтров');
  }
});

// GET /catalog - Каталог товаров
router.get('/catalog', async (req, res) => {
  try {
    const { page, per_page } = validatePagination(req.query.page, req.query.per_page);
    
    const filters = validateFilters({
      category: req.query.category,
      brand: req.query.brand,
      model: req.query.model,
      color: req.query.color,
      memory: req.query.memory
    });

    const result = await getCatalog(page, per_page, filters);
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