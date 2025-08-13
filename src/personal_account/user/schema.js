// Допустимые статусы заказа
const ORDER_STATUSES = [
    'Ожидает оплаты',
    'Оплачен',
    'Отправлен',
    'Доставлен',
    'Отменён'
];

// Кастомный класс ошибки валидации
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Валидация статуса заказа
 */
export function validateOrderStatus(status) {
    if (!status || typeof status !== 'string') {
        throw new ValidationError('Статус обязателен');
    }

    const trimmed = status.trim();
    if (!ORDER_STATUSES.includes(trimmed)) {
        throw new ValidationError(`Недопустимый статус. Возможные: ${ORDER_STATUSES.join(', ')}`);
    }

    return trimmed;
}

/**
 * Валидация параметров пагинации
 */
export function validatePagination(page, per_page) {
    const parsedPage = parseInt(page);
    const parsedPerPage = parseInt(per_page);

    return {
        page: isNaN(parsedPage) ? 1 : Math.max(1, Math.min(10000, parsedPage)),
        per_page: isNaN(parsedPerPage) ? 20 : Math.max(1, Math.min(50, parsedPerPage)),
    };
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