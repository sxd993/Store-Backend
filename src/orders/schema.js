/**
 * Универсальная функция обработки ошибок
 */
export function handleError(res, error, defaultMessage = 'Произошла ошибка сервера') {
    console.error('Ошибка API:', error);

    if (error instanceof ValidationError) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
        success: false,
        message: defaultMessage
    });
}

// Кастомный класс ошибки валидации
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Валидация ID
 */
export function validateId(id) {
    const numId = parseInt(id);
    if (isNaN(numId) || numId < 1) {
        throw new ValidationError('ID должен быть положительным числом');
    }
    return numId;
}