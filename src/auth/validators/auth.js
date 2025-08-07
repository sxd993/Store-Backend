// auth/validators/auth.js
import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Неверный формат email')
    .max(255, 'Email слишком длинный'),
  
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(100, 'Пароль слишком длинный')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Пароль должен содержать заглавные, строчные буквы и цифры'),
  
  phone: z
    .string()
    .regex(/^\+?[\d\s\-\(\)]{10,20}$/, 'Неверный формат телефона')
    .optional()
    .or(z.literal(''))
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Неверный формат email'),
  
  password: z
    .string()
    .min(1, 'Пароль обязателен')
});

// Валидация middleware
export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
      }
      
      return res.status(500).json({
        error: 'Internal server error'
      });
    }
  };
};