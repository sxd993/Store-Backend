import jwt from 'jsonwebtoken';
import { getUserById } from '../model.js';

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
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Токен истек'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Неверный токен'
    });
  }
};