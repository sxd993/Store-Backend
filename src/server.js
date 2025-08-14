// src/server.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkConnection } from './database/index.js';
import { checkHCaptchaConfig } from './auth/utils/hcaptcha.js';
import { catalogRoutes } from './catalog/index.js';
import { authRoutes } from './auth/index.js';
import { cartRoutes } from './cart/index.js';
import { bestOffersRoutes } from './bestOffers/index.js';
import { searchRoutes } from './search/index.js';
import { orderRoutes } from './orders/index.js';
import { adminAccountRoutes } from './personal_account/admin/index.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Главная страница
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NNV Store API',
    version: '1.0.0',
    security: {
      hcaptcha: process.env.HCAPTCHA_SECRET_KEY ? 'enabled' : 'disabled',
      rate_limiting: 'enabled',
      jwt_auth: 'enabled'
    },
    endpoints: {
      // Каталог
      catalog: 'GET /catalog?page=1&per_page=20',
      product: 'GET /catalog/:id',

      // Аутентификация (защищена hCaptcha)
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      profile: 'GET /auth/me',
      logout: 'POST /auth/logout',

      // Корзина
      cart: 'GET /cart',
      addToCart: 'POST /cart/add',
      updateCart: 'PUT /cart/update',
      removeFromCart: 'DELETE /cart/remove/:id',
      clearCart: 'DELETE /cart/clear',
      syncCart: 'POST /cart/sync',

      // Заказы (только создание)
      createOrder: 'POST /orders',

      // Админка (список заказов и управление)
      orders: 'GET /orders?page=1&per_page=20',
      updateOrderStatus: 'PUT /orders/:id/status',

      // Поиск и предложения
      search: 'GET /search?q=query',
      bestOffers: 'GET /best-offers'
    }
  });
});

// Подключаем роуты
app.use('', catalogRoutes);
app.use('', authRoutes);
app.use('', cartRoutes);
app.use('', bestOffersRoutes);
app.use('', searchRoutes);
app.use('', orderRoutes);        // Роуты создания заказов
app.use('', adminAccountRoutes);  // Админские роуты (список заказов, управление)

// Проверка здоровья
app.get('/health', async (req, res) => {
  const dbConnected = await checkConnection();
  const hcaptchaConfigured = !!process.env.HCAPTCHA_SECRET_KEY;
  
  res.json({
    success: true,
    status: 'OK',
    database: dbConnected ? 'connected' : 'disconnected',
    hcaptcha: hcaptchaConfigured ? 'configured' : 'not configured',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Маршрут ${req.method} ${req.originalUrl} не найден`
  });
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка сервера'
  });
});

// Запуск сервера
async function startServer() {
  // Проверяем обязательные переменные
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET не установлен в .env');
    process.exit(1);
  }

  // Проверяем подключение к БД
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('❌ Не удалось подключиться к базе данных');
    process.exit(1);
  }

  // Проверяем конфигурацию hCaptcha
  try {
    checkHCaptchaConfig();
  } catch (error) {
    console.error('❌', error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`✅ Готов к работе!`);
    
    if (process.env.HCAPTCHA_SECRET_KEY) {
      console.log(`🛡️ hCaptcha защита активна`);
    } else {
      console.log(`⚠️ hCaptcha не настроена (разработка)`);
    }
  });
}

startServer();

process.on('SIGINT', () => {
  console.log('\n🛑 Завершение работы сервера...');
  process.exit(0);
});