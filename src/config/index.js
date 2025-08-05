import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: join(__dirname, '../../.env') });

// Проверяем обязательные переменные
const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ Отсутствуют переменные окружения: ${missing.join(', ')}`);
  process.exit(1);
}

// Путь к SSL сертификату в корне проекта
const sslPath = process.env.DB_SSL_CA ? join(__dirname, '../../', process.env.DB_SSL_CA) : null;

if (sslPath && !fs.existsSync(sslPath)) {
  console.error(`❌ SSL сертификат не найден: ${sslPath}`);
  process.exit(1);
}

export const config = {
  // База данных
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslPath ? {
      ca: fs.readFileSync(sslPath)
    } : undefined
  },
  
  // Сервер
  port: parseInt(process.env.PORT || '8000'),
  
  // CORS
  corsOrigins: ['http://localhost:5173', 'http://localhost:3000'],
  
  // Rate Limit
  rateLimit: {
    windowMs: 60 * 1000, // 1 минута
    max: 100 // максимум запросов
  }
};