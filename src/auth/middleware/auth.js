// auth/middleware/auth.js
import { verifyAccessToken } from '../utils/jwt.js';

// Проверка access token
export const authenticateToken = (req, res, next) => {
  const token = req.cookies.accessToken;
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required' 
    });
  }
  
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({ 
      error: 'Invalid or expired access token' 
    });
  }
  
  req.user = decoded;
  next();
};

// Проверка роли администратора
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Administrator access required' 
    });
  }
  next();
};

// Простой rate limiting без Redis (в памяти)
const loginAttempts = new Map();

export const rateLimitLogin = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 минут
  const maxAttempts = 5;
  
  // Очищаем старые записи каждые 5 минут
  if (Math.random() < 0.1) { // 10% вероятность очистки
    for (const [key, value] of loginAttempts.entries()) {
      if (now > value.resetTime) {
        loginAttempts.delete(key);
      }
    }
  }
  
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }
  
  const attempts = loginAttempts.get(ip);
  
  if (now > attempts.resetTime) {
    // Окно истекло, сбрасываем счетчик
    loginAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }
  
  if (attempts.count >= maxAttempts) {
    const retryAfter = Math.ceil((attempts.resetTime - now) / 1000);
    return res.status(429).json({ 
      error: 'Too many login attempts from this IP',
      retryAfter: retryAfter,
      message: `Please try again in ${Math.ceil(retryAfter / 60)} minutes`
    });
  }
  
  attempts.count++;
  next();
};

// Middleware для логирования попыток аутентификации
export const logAuthAttempt = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Логируем после отправки ответа
    const statusCode = res.statusCode;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    const email = req.validatedData?.email || req.body?.email;
    
    if (statusCode === 200) {
      console.log(`✅ Successful login: ${email} from ${ip}`);
    } else if (statusCode === 401 || statusCode === 403) {
      console.warn(`❌ Failed login attempt: ${email} from ${ip} - ${userAgent}`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};