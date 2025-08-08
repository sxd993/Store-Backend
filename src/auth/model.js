import { pool } from '../database/index.js';
import bcrypt from 'bcrypt';

// Простой кеш пользователей в памяти (для getUserById)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Для логина - с паролем
export async function getUserByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, email, password, phone, is_admin FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

// Для проверки токена - БЕЗ пароля + кеширование
export async function getUserById(id) {
  const cacheKey = `user_${id}`;
  const cached = userCache.get(cacheKey);
  
  // Проверяем кеш
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  
  const [rows] = await pool.execute(
    'SELECT id, email, phone, is_admin, created_at FROM users WHERE id = ?',
    [id]
  );
  
  const user = rows[0] || null;
  
  // Кешируем результат (даже null)
  if (user) {
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    });
  }
  
  return user;
}

export async function createUser(userData) {
  const { email, password, phone } = userData;
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const [result] = await pool.execute(
    'INSERT INTO users (email, password, phone) VALUES (?, ?, ?)',
    [email, hashedPassword, phone]
  );
  
  return {
    id: result.insertId,
    email,
    phone,
    is_admin: false
  };
}

export async function verifyPassword(user, password) {
  return await bcrypt.compare(password, user.password);
}

export async function emailExists(email) {
  const [rows] = await pool.execute(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  return rows.length > 0;
}

// Очистка кеша пользователя (при обновлении профиля)
export function clearUserCache(userId) {
  userCache.delete(`user_${userId}`);
}

// Очистка старых записей кеша (запускать периодически)
export function cleanupCache() {
  const now = Date.now();
  for (const [key, cached] of userCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      userCache.delete(key);
    }
  }
}