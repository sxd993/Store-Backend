import { Router } from 'express';
import { authenticateToken } from '../../auth/middleware/auth.js';
import { getUserOrders, getUserOrderDetails } from './model.js';
import { validatePagination, validateId, handleError } from './schema.js';

const router = Router();

// GET /user/orders - список заказов пользователя с пагинацией
router.get('/user/orders', authenticateToken, async (req, res) => {
  try {
    const { page, per_page } = validatePagination(req.query.page, req.query.per_page);
    const result = await getUserOrders(req.user.id, page, per_page);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения заказов пользователя');
  }
});

// GET /user/orders/:id - детальная информация о заказе пользователя
router.get('/user/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = validateId(req.params.id);
    const result = await getUserOrderDetails(req.user.id, orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения деталей заказа');
  }
});

export default router;