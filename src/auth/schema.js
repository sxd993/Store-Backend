export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Только критичные проверки для защиты от атак
function validatePhone(phone, required = false) {
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    if (required) {
      throw new ValidationError('Номер телефона обязателен');
    }
    return null;
  }
  
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Защита от injection и слишком длинных значений
  if (cleaned.length < 8 || cleaned.length > 20 || !/^\+?\d+$/.test(cleaned)) {
    throw new ValidationError('Неверный формат телефона');
  }
  
  return cleaned;
}

function validateName(name) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Имя обязательно');
  }
  
  const trimmed = name.trim();
  
  // Защита от XSS и injection
  if (trimmed.length < 2 || trimmed.length > 50 || trimmed.includes('<') || trimmed.includes('>')) {
    throw new ValidationError('Имя должно содержать от 2 до 50 символов');
  }
  
  // Проверка на допустимые символы (буквы, пробелы, дефисы)
  if (!/^[а-яёa-z\s-]+$/i.test(trimmed)) {
    throw new ValidationError('Имя может содержать только буквы, пробелы и дефисы');
  }
  
  return trimmed;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Пароль обязателен');
  }
  
  // Защита от слишком коротких/длинных паролей
  if (password.length < 6 || password.length > 128) {
    throw new ValidationError('Неверная длина пароля');
  }
  
  return password;
}

// Нормализация телефона для входа
function normalizePhone(phone) {
  if (!phone) return '';
  
  // Убираем все кроме цифр и +
  const cleaned = phone.replace(/[^\d\+]/g, '');
  
  // Приводим к единому формату
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    return '+7' + cleaned.slice(1);
  }
  if (cleaned.startsWith('7') && cleaned.length === 11) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('+7') && cleaned.length === 12) {
    return cleaned;
  }
  
  return cleaned;
}

// Основные функции валидации
export function validateRegister(userData) {
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('Данные пользователя обязательны');
  }

  const { phone, password, name } = userData;
  
  return {
    phone: validatePhone(phone, true),
    name: validateName(name),
    password: validatePassword(password)
  };
}

export function validateLogin(userData) {
  if (!userData || typeof userData !== 'object') {
    throw new ValidationError('Данные для входа обязательны');
  }

  const { phone, password } = userData;
  
  if (!phone || typeof phone !== 'string') {
    throw new ValidationError('Номер телефона обязателен');
  }
  
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Пароль обязателен');
  }
  
  return {
    phone: normalizePhone(phone),
    password: password
  };
}

export function handleError(res, error, message = 'Внутренняя ошибка сервера') {
  console.error('Error:', error);
  res.status(500).json({ success: false, message });
}