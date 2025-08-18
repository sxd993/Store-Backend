import { Router } from 'express';
import { authenticateToken } from '../../auth/middleware/auth.js';
import { 
  getOrders, 
  updateOrderStatus, 
  getOrderDetails,        
  getAllOrdersWithUsers,   
  getAnyOrderDetails      
} from './model.js';
import { validatePagination, validateId, validateOrderStatus, handleError } from './schema.js';

const router = Router();

// Middleware для проверки прав админа
const requireAdmin = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Доступ запрещен. Требуются права администратора' 
    });
  }
  next();
};

// GET /admin/orders/all - все заказы с информацией о пользователях (для профиля админа)
router.get('/admin/orders/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page, per_page } = validatePagination(req.query.page, req.query.per_page);
    const result = await getAllOrdersWithUsers(page, per_page);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения всех заказов');
  }
});

// GET /admin/orders/:id/details - детальная информация о любом заказе (для профиля админа)
router.get('/admin/orders/:id/details', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const result = await getAnyOrderDetails(id);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения деталей заказа');
  }
});

// GET /orders - список заказов с пагинацией (базовый админский роут)
router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page, per_page } = validatePagination(req.query.page, req.query.per_page);
    const result = await getOrders(page, per_page);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения списка заказов');
  }
});

// GET /orders/:id - базовая информация о заказе
router.get('/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = validateId(req.params.id);
    const result = await getOrderDetails(id);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error, 'Ошибка получения деталей заказа');
  }
});

// PUT /orders/:id/status - обновление статуса заказа (для админки)
router.put('/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
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