import jwt from 'jsonwebtoken';
import { getUserById } from '../model.js';
// Единственный middleware - проверка токена
export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Токен отсутствует'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    req.user = user; // Сохраняем пользователя для использования в роуте
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Токен истек. Войдите заново.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Неверный токен'
    });
  }
};
