import { Router } from 'express';
import { createOrder } from './model.js';
import { validateId, handleError } from './schema.js';
import { authenticateToken } from '../auth/middleware/auth.js';

const router = Router();


// POST /orders - создание заказа из корзины
router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const validatedUserId = validateId(req.user.id);
    const result = await createOrder(validatedUserId);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка создания заказа');
  }
});

export default router;