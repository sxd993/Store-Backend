import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { checkConnection } from './database/index.js';
import { catalogRoutes } from './catalog/index.js';

// Создаем приложение
const app = express();

// Middleware для безопасности
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

// Rate limiting для защиты от DDoS
const limiter = rateLimit(config.rateLimit);
app.use('/api/', limiter);

// Парсинг JSON
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Информация об API
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NNV Store API',
    version: '1.0.0',
    endpoints: {
      catalog: 'GET /api/catalog?page=1&per_page=20',
      product: 'GET /api/catalog/:id',
      health: 'GET /health'
    }
  });
});

// Подключаем маршруты каталога
app.use('/api', catalogRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Маршрут не найден'
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
  // Проверяем подключение к БД
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    process.exit(1);
  }
  
  // Запускаем сервер
  app.listen(config.port, () => {
    console.log(`🚀 Сервер запущен на порту ${config.port}`);
    console.log(`📝 Проверка: http://localhost:${config.port}/health`);
    console.log(`🔒 Rate limit: ${config.rateLimit.max} запросов в минуту`);
    console.log(`✨ Модульная структура загружена`);
  });
}

// Запускаем
startServer();

// Обработка завершения
process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  process.exit(0);
});