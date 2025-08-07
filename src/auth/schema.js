export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRegister(userData) {
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('Данные пользователя обязательны');
  }

  const { email, password, phone } = userData;
  
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    throw new ValidationError('Email обязателен');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ValidationError('Неверный формат email');
  }
  
  // Увеличили требования к паролю с 6 до 8 символов
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('Пароль должен содержать минимум 8 символов');
  }
  
  if (phone && (typeof phone !== 'string' || phone.trim().length < 10)) {
    throw new ValidationError('Неверный формат телефона');
  }
  
  return {
    email: email.trim().toLowerCase(),
    password: password,
    phone: phone ? phone.trim() : null
  };
}

export function validateLogin(userData) {
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('Данные для входа обязательны');
  }

  const { email, password } = userData;
  
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    throw new ValidationError('Email обязателен');
  }
  
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('Пароль обязателен');
  }
  
  return {
    email: email.trim().toLowerCase(),
    password: password
  };
}

export function handleError(res, error, message = 'Внутренняя ошибка сервера') {
  console.error('Error:', error);
  res.status(500).json({ success: false, message });
}
