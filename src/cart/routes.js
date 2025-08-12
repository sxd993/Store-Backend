import { Router } from 'express';
import { authenticateToken } from '../auth/middleware/auth.js';
import {
  getUserCart,
  addToUserCart,
  updateCartItem,
  removeFromUserCart,
  clearUserCart,
  syncUserCart
} from './model.js';
import {
  validateAddToCart,
  validateUpdateCartItem,
  validateSyncCart,
  validateProductIdParam,
  CartValidationError,
  handleCartValidationError
} from './schema.js';

const router = Router();

/**
 * GET /cart - Получить корзину пользователя
 */
router.get('/cart', authenticateToken, async (req, res) => {
  try {
    const cart = await getUserCart(req.user.id);
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения корзины'
    });
  }
});

/**
 * POST /cart/add - Добавить товар в корзину
 */
router.post('/cart/add', authenticateToken, async (req, res) => {
  try {
    const validatedData = validateAddToCart(req.body);
    
    const cart = await addToUserCart(
      req.user.id,
      validatedData.product_id,
      validatedData.quantity
    );
    
    res.status(201).json({
      success: true,
      data: cart
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return handleCartValidationError(res, error);
    }
    
    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('недостаточно')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка добавления товара в корзину'
    });
  }
});

/**
 * PUT /cart/update - Обновить количество товара в корзине
 */
router.put('/cart/update', authenticateToken, async (req, res) => {
  try {
    const validatedData = validateUpdateCartItem(req.body);
    
    const cart = await updateCartItem(
      req.user.id,
      validatedData.product_id,
      validatedData.quantity
    );
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return handleCartValidationError(res, error);
    }
    
    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('недостаточно')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления корзины'
    });
  }
});

/**
 * DELETE /cart/remove/:productId - Удалить товар из корзины
 */
router.delete('/cart/remove/:productId', authenticateToken, async (req, res) => {
  try {
    const productId = validateProductIdParam(req.params.productId);
    
    const cart = await removeFromUserCart(req.user.id, productId);
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return handleCartValidationError(res, error);
    }
    
    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка удаления товара из корзины'
    });
  }
});

/**
 * DELETE /cart/clear - Очистить всю корзину
 */
router.delete('/cart/clear', authenticateToken, async (req, res) => {
  try {
    const cart = await clearUserCart(req.user.id);
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка очистки корзины'
    });
  }
});

/**
 * POST /cart/sync - Синхронизировать корзину при авторизации
 */
router.post('/cart/sync', authenticateToken, async (req, res) => {
  try {
    const validatedData = validateSyncCart(req.body);
    
    const cart = await syncUserCart(req.user.id, validatedData.items);
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return handleCartValidationError(res, error);
    }
    
    console.error('Sync cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка синхронизации корзины'
    });
  }
});

export default router;