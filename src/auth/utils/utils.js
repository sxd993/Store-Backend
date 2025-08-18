import jwt from 'jsonwebtoken';

// Защита от брутфорса (ИЗМЕНЕНО: по телефону)
const failedAttempts = new Map();

export function checkRateLimit(phone) {
  const attempts = failedAttempts.get(phone) || { count: 0, lastAttempt: 0 };
  const now = Date.now();
  
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    attempts.count = 0;
  }
  
  return attempts.count < 15;
}

export function recordAttempt(phone, success) {
  if (!success) {
    const attempts = failedAttempts.get(phone) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    failedAttempts.set(phone, attempts);
  } else {
    failedAttempts.delete(phone);
  }
}

// JWT токены (ИЗМЕНЕНО: phone вместо email)
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, isAdmin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

export function setCookieToken(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 2 * 60 * 60 * 1000
  });
}

export function clearCookieToken(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
}