import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByEmail, createUser, verifyPassword, emailExists } from './model.js';
import { validateRegister, validateLogin, handleError, ValidationError } from './schema.js';
import { authenticateToken } from '../middleware/auth.js'; // ЕДИНСТВЕННЫЙ новый импорт

const router = Router();

// Простая защита от брутфорса (ваш стиль - в памяти)
const failedAttempts = new Map();

function checkAndRecordAttempt(email, success) {
  if (!email) return true;
  
  const attempts = failedAttempts.get(email) || { count: 0, lastAttempt: 0 };
  const now = Date.now();
  
  // Сброс через 15 минут
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    attempts.count = 0;
  }
  
  if (!success) {
    attempts.count++;
    attempts.lastAttempt = now;
    failedAttempts.set(email, attempts);
  } else {
    failedAttempts.delete(email);
  }
  
  return attempts.count < 5;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '2h' } // Как вы хотели
  );
}

// Регистрация - БЕЗ ИЗМЕНЕНИЙ (только улучшенные cookies)
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
      sameSite: 'strict', // Добавили для безопасности
      maxAge: 2 * 60 * 60 * 1000 // 2 часа
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

// Логин с простой защитой от брутфорса
router.post('/auth/login', async (req, res) => {
  try {
    const validatedData = validateLogin(req.body);
    
    // Проверяем лимит попыток
    const attempts = failedAttempts.get(validatedData.email) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    
    if (now - attempts.lastAttempt < 15 * 60 * 1000 && attempts.count >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Слишком много попыток. Подождите 15 минут.'
      });
    }
    
    const user = await getUserByEmail(validatedData.email);
    
    if (!user || !(await verifyPassword(user, validatedData.password))) {
      checkAndRecordAttempt(validatedData.email, false);
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }
    
    checkAndRecordAttempt(validatedData.email, true);
    
    const token = generateToken(user);
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000
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

// ГЛАВНОЕ ИЗМЕНЕНИЕ: /auth/me теперь использует middleware
router.get('/auth/me', authenticateToken, async (req, res) => {
  // Пользователь уже проверен в middleware и доступен в req.user
  res.json({ success: true, data: req.user });
});

// Logout остается без изменений
router.post('/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ 
    success: true, 
    message: 'Выход выполнен успешно' 
  });
});

export default router;
