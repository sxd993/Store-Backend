// src/auth/routes.js - ОБНОВЛЕННАЯ ВЕРСИЯ
import { Router } from 'express';
import { getUserByPhone, createUser, verifyPassword, phoneExists } from './model.js';
import { validateRegister, validateLogin, ValidationError } from './schema.js';
import { authenticateToken } from './middleware/auth.js';
import { 
  checkRateLimit, 
  recordAttempt, 
  generateToken, 
  setCookieToken, 
  clearCookieToken 
} from './utils/utils.js';
import { verifyRecaptcha } from './utils/recaptcha.js';

const router = Router();

// Регистрация (без reCAPTCHA - будет SMS подтверждение)
router.post('/auth/register', async (req, res) => {
  try {
    const validatedData = validateRegister(req.body);
    
    if (await phoneExists(validatedData.phone)) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким номером телефона уже существует'
      });
    }
    
    const user = await createUser(validatedData);
    const token = generateToken(user);
    setCookieToken(res, token);
    
    res.status(201).json({
      success: true,
      message: 'Регистрация успешна. SMS с кодом подтверждения отправлено на ваш номер.',
      data: { 
        id: user.id, 
        phone: user.phone,
        name: user.name,
        isAdmin: user.is_admin,
        needsPhoneVerification: true // Флаг для фронтенда
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

// Логин (с обязательной reCAPTCHA)
router.post('/auth/login', async (req, res) => {
  try {
    const validatedData = validateLogin(req.body);
    const { recaptchaToken } = req.body;
    
    // Проверяем reCAPTCHA
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: 'Проверка безопасности не пройдена'
      });
    }

    const recaptchaResult = await verifyRecaptcha(recaptchaToken, req.ip);
    if (!recaptchaResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Проверка безопасности не пройдена. Попробуйте еще раз.',
        debug: process.env.NODE_ENV === 'development' ? recaptchaResult.error : undefined
      });
    }

    // Логируем низкий score для мониторинга
    if (recaptchaResult.score < 0.7) {
      console.warn(`Low reCAPTCHA score login attempt: ${recaptchaResult.score} from IP: ${req.ip}`);
    }
    
    if (!checkRateLimit(validatedData.phone)) {
      return res.status(429).json({
        success: false,
        message: 'Слишком много попыток. Подождите 15 минут.'
      });
    }
    
    const user = await getUserByPhone(validatedData.phone);
    
    if (!user || !(await verifyPassword(user, validatedData.password))) {
      recordAttempt(validatedData.phone, false);
      return res.status(401).json({
        success: false,
        message: 'Неверный номер телефона или пароль'
      });
    }
    
    recordAttempt(validatedData.phone, true);
    
    const token = generateToken(user);
    setCookieToken(res, token);
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: { 
        id: user.id, 
        phone: user.phone,
        name: user.name,
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

// Получение данных пользователя (БЕЗ ИЗМЕНЕНИЙ)
router.get('/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user });
});

// Logout (БЕЗ ИЗМЕНЕНИЙ)
router.post('/auth/logout', (req, res) => {
  clearCookieToken(res);
  res.json({ 
    success: true, 
    message: 'Выход выполнен успешно' 
  });
});

export default router;