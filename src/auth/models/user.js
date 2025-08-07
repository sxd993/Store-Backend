import { pool } from '../../database/index.js';
import bcrypt from 'bcrypt';

export class User {
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  }
  
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, email, phone, is_admin, created_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }
  
  static async create(email, password, phone = null) {
    // Хешируем пароль с помощью bcrypt (12 раундов для хорошей безопасности)
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [result] = await pool.execute(
      'INSERT INTO users (email, password, phone) VALUES (?, ?, ?)',
      [email, hashedPassword, phone]
    );
    
    return result.insertId;
  }
  
  static async emailExists(email) {
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    return rows.length > 0;
  }
  
  static async verifyPassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }
  
  // Простая защита от брутфорса
  static async recordFailedAttempt(userId) {
    await pool.execute(
      'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?',
      [userId]
    );
    
    // Блокируем на 15 минут после 5 попыток
    await pool.execute(
      `UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) 
       WHERE id = ? AND failed_attempts >= 5`,
      [userId]
    );
  }
  
  static async clearFailedAttempts(userId) {
    await pool.execute(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
      [userId]
    );
  }
  
  static async isLocked(user) {
    if (!user.locked_until) return false;
    return new Date(user.locked_until) > new Date();
  }
  
  static async getRemainingLockTime(user) {
    if (!user.locked_until) return 0;
    const now = new Date();
    const lockTime = new Date(user.locked_until);
    return Math.max(0, Math.ceil((lockTime - now) / 1000)); // секунды
  }
}