import { Router } from 'express';
import { getOrders, createOrder, updateOrderStatus } from './model.js';
import { validatePagination, validateId, validateOrderStatus, handleError } from './schema.js';

const router = Router();


// POST /orders - создание заказа из корзины
router.post('/orders', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id обязателен'
      });
    }

    const validatedUserId = validateId(user_id);
    const result = await createOrder(validatedUserId);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка создания заказа');
  }
});

export default router;