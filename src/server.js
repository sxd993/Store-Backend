import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkConnection } from './database/index.js';
import { catalogRoutes } from './catalog/index.js';
import { authRoutes } from './auth/index.js';
import { cartRoutes } from './cart/index.js';
import { bestOffersRoutes } from './bestOffers/index.js';
import { searchRoutes } from './search/index.js';
import { personalAccountRoutes } from './orders/index.js';

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
    endpoints: {
      // Каталог
      catalog: 'GET /catalog?page=1&per_page=20',
      product: 'GET /catalog/:id',

      // Аутентификация
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

      // Заказы
      orders: 'GET /orders?page=1&per_page=20&status=Оплачен',
      createOrder: 'POST /orders',
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
app.use('', personalAccountRoutes); // КРИТИЧЕСКИ ВАЖНО: подключаем роуты заказов

// Проверка здоровья
app.get('/health', async (req, res) => {
  const dbConnected = await checkConnection();
  res.json({
    success: true,
    status: 'OK',
    database: dbConnected ? 'connected' : 'disconnected',
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
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET не установлен в .env');
    process.exit(1);
  }

  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('❌ Не удалось подключиться к базе данных');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`✅ Готов к работе!`);
  });
}

startServer();

process.on('SIGINT', () => {
  console.log('\n🛑 Завершение работы сервера...');
  process.exit(0);
});