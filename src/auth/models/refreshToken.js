import { pool } from '../../database/index.js';
import crypto from 'crypto';

export class RefreshToken {
  static async create(userId, expiresAt) {
    // Генерируем случайный токен
    const token = crypto.randomBytes(32).toString('hex');
    
    // Хешируем токен перед сохранением в БД (для безопасности)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );
    
    // Возвращаем оригинальный токен (не хеш)
    return token;
  }
  
  static async verify(token) {
    // Хешируем полученный токен для поиска в БД
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const [rows] = await pool.execute(
      `SELECT rt.*, u.id as user_id, u.email, u.is_admin 
       FROM refresh_tokens rt 
       JOIN users u ON rt.user_id = u.id 
       WHERE rt.token_hash = ? AND rt.expires_at > NOW()`,
      [tokenHash]
    );
    
    return rows[0] || null;
  }
  
  static async delete(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    await pool.execute(
      'DELETE FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );
  }
  
  static async deleteAllForUser(userId) {
    await pool.execute(
      'DELETE FROM refresh_tokens WHERE user_id = ?',
      [userId]
    );
  }
  
  static async deleteExpired() {
    // Утилитарная функция для очистки просроченных токенов
    const [result] = await pool.execute(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    
    return result.affectedRows;
  }
}