// auth/utils/jwt.js
import jwt from 'jsonwebtoken';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isAdmin: user.is_admin,
      type: 'access'
    },
    process.env.JWT_ACCESS_SECRET,
    { 
      expiresIn: '15m', // 15 минут
      algorithm: process.env.JWT_ALGORITHM || 'HS256',
      issuer: 'shop-auth'
    }
  );
};

export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: [process.env.JWT_ALGORITHM || 'HS256'],
      issuer: 'shop-auth'
    });
    
    // Проверяем, что это access token
    if (decoded.type !== 'access') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return null;
  }
};

export const getTokenPayload = (token) => {
  try {
    // Декодируем без верификации (только для получения payload)
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};