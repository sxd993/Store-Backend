import { Router } from 'express';
import { authenticateToken } from '../auth/middleware/auth.js';
import {
  getUserCart,
  addToUserCart,
  updateCartItem,
  removeFromUserCart,
  clearUserCart,
  syncUserCart,
  getCartItemsInfo,
  getCartItemsCount,
  isItemInUserCart,
  getUserCartItemQuantity
} from './model.js';
import {
  validateAddToCart,
  validateUpdateCartItem,
  validateSyncCart,
  validateProductIds,
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
      data: cart,
      message: cart.length > 0 ? 'Корзина загружена' : 'Корзина пуста'
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
      data: cart,
      message: 'Товар добавлен в корзину'
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
    
    if (error.message.includes('недостаточно') || error.message.includes('наличие')) {
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
      data: cart,
      message: validatedData.quantity === 0 ? 'Товар удален из корзины' : 'Количество обновлено'
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
      data: cart,
      message: 'Товар удален из корзины'
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
      data: cart,
      message: 'Корзина очищена'
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
      data: cart,
      message: validatedData.items.length > 0 ? 'Корзина синхронизирована' : 'Нет товаров для синхронизации'
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

/**
 * POST /cart/items-info - Получить актуальную информацию о товарах
 */
router.post('/cart/items-info', authenticateToken, async (req, res) => {
  try {
    const validatedData = validateProductIds(req.body);
    
    const itemsInfo = await getCartItemsInfo(validatedData.product_ids);
    
    res.json({
      success: true,
      data: itemsInfo,
      message: 'Информация о товарах получена'
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return handleCartValidationError(res, error);
    }
    
    console.error('Get cart items info error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения информации о товарах'
    });
  }
});

/**
 * GET /cart/count - Получить количество товаров в корзине
 */
router.get('/cart/count', authenticateToken, async (req, res) => {
  try {
    const count = await getCartItemsCount(req.user.id);
    
    res.json({
      success: true,
      data: { count },
      message: 'Количество товаров получено'
    });
  } catch (error) {
    console.error('Get cart count error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения количества товаров'
    });
  }
});

/**
 * GET /cart/check/:productId - Проверить есть ли товар в корзине
 */
router.get('/cart/check/:productId', authenticateToken, async (req, res) => {
  try {
    const productId = validateProductIdParam(req.params.productId);
    
    const inCart = await isItemInUserCart(req.user.id, productId);
    const quantity = inCart ? await getUserCartItemQuantity(req.user.id, productId) : 0;
    
    res.json({
      success: true,
      data: { 
        inCart,
        quantity
      },
      message: 'Статус товара в корзине получен'
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return handleCartValidationError(res, error);
    }
    
    console.error('Check cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки товара в корзине'
    });
  }
});

export default router;