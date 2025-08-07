import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByEmail, getUserById, createUser, verifyPassword, emailExists } from './model.js';
import { validateRegister, validateLogin, handleError, ValidationError } from './schema.js';

const router = Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}


router.post('/auth/register', async (req, res) => {
  try {
    const validatedData = validateRegister(req.body);
    
    if (await emailExists(validatedData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }
    
    const user = await createUser(validatedData);
    const token = generateToken(user);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    res.status(201).json({
      success: true,
      message: 'Регистрация успешна',
      data: { 
        id: user.id, 
        email: user.email, 
        phone: user.phone, 
        isAdmin: user.is_admin 
      }
    });
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    handleError(res, error, 'Ошибка регистрации');
  }
});

// POST /auth/login - Вход
router.post('/auth/login', async (req, res) => {
  try {
    const validatedData = validateLogin(req.body);
    const user = await getUserByEmail(validatedData.email);
    
    if (!user || !(await verifyPassword(user, validatedData.password))) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }
    
    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: { 
        id: user.id, 
        email: user.email, 
        phone: user.phone, 
        isAdmin: user.is_admin 
      }
    });
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    handleError(res, error, 'Ошибка входа');
  }
});

// GET /auth/me - Получить профиль
router.get('/auth/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Токен не предоставлен' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Пользователь не найден' 
      });
    }
    
    res.json({ success: true, data: user });
    
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Неверный или истекший токен' 
    });
  }
});

// POST /auth/logout - Выход
router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ 
    success: true, 
    message: 'Выход выполнен успешно' 
  });
});

export default router;