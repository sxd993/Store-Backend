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