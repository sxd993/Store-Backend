import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkConnection } from './database/index.js';
import { catalogRoutes } from './catalog/index.js';
import { authRoutes } from './auth/index.js';
import { cartRoutes } from './cart/index.js';
import { bestOffersRoutes } from './bestOffers/index.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Простые middleware
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
      addProduct: 'POST /catalog',
      updateProduct: 'PUT /catalog/:id',
      
      // Аутентификация
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      profile: 'GET /auth/me',
      logout: 'POST /auth/logout'
    }
  });
});

// Подключаем роуты
app.use('', catalogRoutes);
app.use('', authRoutes);
app.use('', bestOffersRoutes);

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


// Корзина
app.use('/api', cartRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Маршрут ${req.method} ${req.url} не найден`
  });
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка:', err);
  res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка сервера'
  });
});

// Запуск сервера
async function startServer() {
  // Проверяем JWT_SECRET
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
  
  // Запускаем сервер
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📝 Главная: http://localhost:${PORT}/`);
    console.log(`✅ Готов к работе!`);
  });
}

// Запускаем
startServer();

// Обработка завершения
process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  process.exit(0);
});