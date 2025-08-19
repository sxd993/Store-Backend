const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export async function verifyRecaptcha(token, remoteip = null) {
  if (!RECAPTCHA_SECRET_KEY) {
    console.warn('reCAPTCHA secret key not configured');
    return { success: false, error: 'reCAPTCHA not configured' };
  }

  if (!token) {
    return { success: false, error: 'No reCAPTCHA token provided' };
  }

  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token,
      ...(remoteip && { remoteip })
    });

    // Используем нативный fetch вместо node-fetch
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    const data = await response.json();

    if (!data.success) {
      console.warn('reCAPTCHA verification failed:', data['error-codes']);
      return { 
        success: false, 
        error: 'reCAPTCHA verification failed',
        errorCodes: data['error-codes']
      };
    }

    // Проверяем score (для v3)
    const score = data.score || 0;
    const action = data.action;
    
    // Порог для блокировки ботов (можно настроить)
    const SCORE_THRESHOLD = 0.5;
    
    if (score < SCORE_THRESHOLD) {
      console.warn(`Low reCAPTCHA score: ${score} for action: ${action}`);
      return { 
        success: false, 
        error: 'Suspicious activity detected',
        score,
        action
      };
    }

    return { 
      success: true, 
      score,
      action,
      hostname: data.hostname
    };

  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { 
      success: false, 
      error: 'reCAPTCHA verification failed due to network error' 
    };
  }
}