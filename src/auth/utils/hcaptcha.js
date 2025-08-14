const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';

/**
 * Валидация hCaptcha токена на сервере hCaptcha
 */
export async function validateHCaptcha(token, userIP = null) {
  try {
    // В разработке можем пропустить валидацию если нет ключа
    if (IS_DEVELOPMENT && !HCAPTCHA_SECRET_KEY) {
      console.warn('⚠️ hCaptcha validation skipped in development (no secret key)');
      return { success: true, development: true };
    }

    if (!HCAPTCHA_SECRET_KEY) {
      throw new Error('HCAPTCHA_SECRET_KEY не настроен в переменных окружения');
    }

    // Подготавливаем данные для отправки
    const params = new URLSearchParams();
    params.append('secret', HCAPTCHA_SECRET_KEY);
    params.append('response', token);
    if (userIP) params.append('remoteip', userIP);

    // Отправляем запрос к hCaptcha API
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params,
      signal: AbortSignal.timeout(10000) // 10 секунд таймаут
    });

    if (!response.ok) {
      throw new Error(`hCaptcha API вернул статус: ${response.status}`);
    }

    const result = await response.json();
    
    // Логируем для отладки (только в разработке)
    if (IS_DEVELOPMENT) {
      console.log('hCaptcha validation result:', {
        success: result.success,
        hostname: result.hostname,
        challenge_ts: result.challenge_ts,
        error_codes: result['error-codes']
      });
    }

    return {
      success: result.success === true,
      hostname: result.hostname,
      challenge_ts: result.challenge_ts,
      error_codes: result['error-codes'] || []
    };

  } catch (error) {
    console.error('hCaptcha validation error:', error);
    
    // В продакшне возвращаем false при любой ошибке
    // В разработке можем быть более мягкими
    if (IS_DEVELOPMENT && error.message.includes('не настроен')) {
      console.warn('⚠️ hCaptcha validation failed, but continuing in development');
      return { success: true, development: true, error: error.message };
    }
    
    return { 
      success: false, 
      error: error.message,
      error_codes: ['network-error']
    };
  }
}

/**
 * Middleware для проверки hCaptcha
 */
export const hCaptchaMiddleware = async (req, res, next) => {
  try {
    const { hcaptcha_token } = req.body;

    if (!hcaptcha_token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Капча обязательна для заполнения' 
      });
    }

    // Получаем IP пользователя
    const userIP = req.ip || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null);

    const validation = await validateHCaptcha(hcaptcha_token, userIP);
    
    if (!validation.success) {
      const errorMessage = getHCaptchaErrorMessage(validation.error_codes);
      
      return res.status(400).json({ 
        success: false, 
        message: errorMessage
      });
    }

    // Добавляем информацию о валидации в request для дальнейшего использования
    req.hcaptcha = validation;
    next();

  } catch (error) {
    console.error('hCaptcha middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка проверки защиты от ботов'
    });
  }
};

/**
 * Получение понятного сообщения об ошибке hCaptcha
 */
function getHCaptchaErrorMessage(errorCodes = []) {
  if (!Array.isArray(errorCodes) || errorCodes.length === 0) {
    return 'Неверная капча. Попробуйте еще раз.';
  }

  const errorMessages = {
    'missing-input-secret': 'Ошибка конфигурации сервера',
    'invalid-input-secret': 'Ошибка конфигурации сервера',
    'missing-input-response': 'Капча обязательна',
    'invalid-input-response': 'Неверная капча',
    'bad-request': 'Неверный запрос капчи',
    'timeout-or-duplicate': 'Капча истекла или уже использовалась',
    'network-error': 'Ошибка сети при проверке капчи'
  };

  // Возвращаем первое найденное сообщение или общее
  for (const code of errorCodes) {
    if (errorMessages[code]) {
      return errorMessages[code];
    }
  }

  return 'Ошибка проверки капчи. Попробуйте еще раз.';
}

/**
 * Проверка конфигурации hCaptcha
 */
export function checkHCaptchaConfig() {
  if (!HCAPTCHA_SECRET_KEY) {
    if (IS_DEVELOPMENT) {
      console.warn('⚠️ HCAPTCHA_SECRET_KEY не настроен. Добавьте в .env файл.');
      return false;
    } else {
      throw new Error('HCAPTCHA_SECRET_KEY обязателен в продакшне');
    }
  }
  
  console.log('✅ hCaptcha настроена');
  return true;
}