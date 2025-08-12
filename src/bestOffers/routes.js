import { Router } from 'express';
import { authenticateToken } from '../auth/middleware/auth.js';
import { getBestOffers, updateBestOffers } from './model.js';

const router = Router();

router.get('/api/best-offers', async (req, res) => {
  try {
    const data = await getBestOffers();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Best offers error:', error);
    res.status(500).json({ success: false, message: 'Ошибка загрузки' });
  }
});

router.put('/api/best-offers', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ success: false, message: 'Доступ запрещен' });
    }

    const { productIds } = req.body;
    const data = await updateBestOffers(productIds);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Ошибка обновления' });
  }
});

export default router;
