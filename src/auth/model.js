import { pool } from '../database/index.js';
import bcrypt from 'bcrypt';

export async function getUserByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, email, password, phone, is_admin FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

export async function getUserById(id) {
  const [rows] = await pool.execute(
    'SELECT id, email, phone, is_admin, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

export async function createUser(userData) {
  const { email, password, phone } = userData;
  const hashedPassword = await bcrypt.hash(password, 12); // Увеличили с 10 до 12
  
  const [result] = await pool.execute(
    'INSERT INTO users (email, password, phone) VALUES (?, ?, ?)',
    [email, hashedPassword, phone || null]
  );
  
  return {
    id: result.insertId,
    email,
    phone: phone || null,
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