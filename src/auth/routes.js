import { Router } from 'express';
import { getUserByEmail, createUser, verifyPassword, emailExists } from './model.js';
import { validateRegister, validateLogin, ValidationError } from './schema.js';
import { authenticateToken } from './middleware/auth.js';
import { 
  checkRateLimit, 
  recordAttempt, 
  generateToken, 
  setCookieToken, 
  clearCookieToken 
} from './utils/utils.js';

const router = Router();

// Регистрация
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
    setCookieToken(res, token);
    
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
    
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка регистрации' 
    });
  }
});

// Логин
router.post('/auth/login', async (req, res) => {
  try {
    const validatedData = validateLogin(req.body);
    
    if (!checkRateLimit(validatedData.email)) {
      return res.status(429).json({
        success: false,
        message: 'Слишком много попыток. Подождите 15 минут.'
      });
    }
    
    const user = await getUserByEmail(validatedData.email);
    
    if (!user || !(await verifyPassword(user, validatedData.password))) {
      recordAttempt(validatedData.email, false);
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }
    
    recordAttempt(validatedData.email, true);
    
    const token = generateToken(user);
    setCookieToken(res, token);
    
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
    
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка входа' 
    });
  }
});

// Получение данных пользователя
router.get('/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user });
});

// Logout
router.post('/auth/logout', (req, res) => {
  clearCookieToken(res);
  res.json({ 
    success: true, 
    message: 'Выход выполнен успешно' 
  });
});

export default router;