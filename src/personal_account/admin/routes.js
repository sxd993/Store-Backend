import { Router } from 'express';
import { getOrders, createOrder, updateOrderStatus } from './model.js';
import { validatePagination, validateId, validateOrderStatus, handleError } from './schema.js';

const router = Router();

// GET /orders - список заказов с пагинацией
router.get('/orders', async (req, res) => {
  try {
    const { page, per_page } = validatePagination(req.query.page, req.query.per_page);
    const result = await getOrders(page, per_page);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения списка заказов');
  }
});

// PUT /orders/:id/status - обновление статуса заказа (для админки)
router.put('/orders/:id/status', async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const newStatus = validateOrderStatus(req.body.status);

    const result = await updateOrderStatus(id, newStatus);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка обновления статуса заказа');
  }
});

export default router;