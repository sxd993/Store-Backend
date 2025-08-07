// auth/routes/auth.js
import express from 'express';
import { User } from '../models/user.js';
import { RefreshToken } from '../models/refreshToken.js';
import { generateAccessToken } from '../utils/jwt.js';
import { registerSchema, loginSchema, validateRequest } from '../validators/auth.js';
import { authenticateToken, rateLimitLogin, logAuthAttempt } from '../middleware/auth.js';

const router = express.Router();

// РЕГИСТРАЦИЯ
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  try {
    const { email, password, phone } = req.validatedData;
    
    // Проверяем, существует ли пользователь
    if (await User.emailExists(email)) {
      return res.status(400).json({ 
        error: 'User with this email already exists' 
      });
    }
    
    // Создаем пользователя (пароль автоматически хешируется в модели)
    const userId = await User.create(email, password, phone || null);
    
    // Получаем созданного пользователя
    const user = await User.findById(userId);
    
    // Генерируем токены
    const accessToken = generateAccessToken(user);
    
    // Создаем refresh token (7 дней)
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const refreshToken = await RefreshToken.create(userId, refreshTokenExpiry);
    
    // Устанавливаем безопасные cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 минут
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      path: '/api/auth/refresh' // Доступен только для refresh endpoint
    });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        isAdmin: user.is_admin
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed. Please try again.' 
    });
  }
});

// ЛОГИН
router.post('/login', 
  rateLimitLogin, 
  validateRequest(loginSchema), 
  logAuthAttempt,
  async (req, res) => {
    try {
      const { email, password } = req.validatedData;
      
      // Находим пользователя
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid email or password' 
        });
      }
      
      // Проверяем блокировку аккаунта
      if (await User.isLocked(user)) {
        const remainingTime = await User.getRemainingLockTime(user);
        return res.status(423).json({ 
          error: 'Account is temporarily locked due to multiple failed attempts',
          retryAfter: remainingTime,
          message: `Please try again in ${Math.ceil(remainingTime / 60)} minutes`
        });
      }
      
      // Проверяем пароль
      const validPassword = await User.verifyPassword(user, password);
      if (!validPassword) {
        // Записываем неудачную попытку
        await User.recordFailedAttempt(user.id);
        
        return res.status(401).json({ 
          error: 'Invalid email or password' 
        });
      }
      
      // Успешный логин - очищаем failed attempts
      await User.clearFailedAttempts(user.id);
      
      // Генерируем токены
      const accessToken = generateAccessToken(user);
      
      // Создаем refresh token
      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const refreshToken = await RefreshToken.create(user.id, refreshTokenExpiry);
      
      // Устанавливаем cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000
      });
      
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh'
      });
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          isAdmin: user.is_admin
        }
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed. Please try again.' 
      });
    }
  }
);

// ОБНОВЛЕНИЕ ACCESS TOKEN
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Refresh token required' 
      });
    }
    
    // Верифицируем refresh token
    const tokenData = await RefreshToken.verify(refreshToken);
    if (!tokenData) {
      return res.status(403).json({ 
        error: 'Invalid or expired refresh token' 
      });
    }
    
    // Получаем актуальные данные пользователя
    const user = await User.findById(tokenData.user_id);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    // Генерируем новый access token
    const newAccessToken = generateAccessToken(user);
    
    // Устанавливаем новый access token
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });
    
    res.json({
      success: true,
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed' 
    });
  }
});

// ПОЛУЧЕНИЕ ДАННЫХ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Получаем актуальные данные пользователя из БД
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      }
    });
    
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({ 
      error: 'Failed to get user data' 
    });
  }
});

// ЛОГАУТ
router.post('/logout', authenticateToken, async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      // Удаляем refresh token из БД
      if (refreshToken) {
        await RefreshToken.delete(refreshToken);
      }
      
      // Очищаем cookies
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      res.clearCookie('refreshToken', { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh' 
      });
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Даже если произошла ошибка, все равно очищаем cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      
      res.status(500).json({ 
        error: 'Logout failed, but cookies cleared' 
      });
    }
  });
  
  // ЛОГАУТ СО ВСЕХ УСТРОЙСТВ
  router.post('/logout-all', authenticateToken, async (req, res) => {
    try {
      // Удаляем все refresh токены пользователя из БД
      await RefreshToken.deleteAllForUser(req.user.id);
      
      // Очищаем cookies текущей сессии
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      res.clearCookie('refreshToken', { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh' 
      });
      
      res.json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
      
    } catch (error) {
      console.error('Logout all error:', error);
      
      // Очищаем cookies даже при ошибке
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      
      res.status(500).json({ 
        error: 'Logout from all devices failed, but current session cleared' 
      });
    }
  });