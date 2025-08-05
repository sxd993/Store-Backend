import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

// Создаем пул соединений
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: config.db.ssl
});

// Функция проверки подключения
export async function checkConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Подключено к базе данных MySQL');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    return false;
  }
}

// Закрытие пула при завершении процесса
process.on('SIGTERM', async () => {
  await pool.end();
  console.log('База данных отключена');
});