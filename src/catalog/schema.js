// Валидация пагинации
export function validatePagination(page, per_page) {
  return {
    page: Math.max(1, Math.min(1000, parseInt(page) || 1)),
    per_page: Math.max(1, Math.min(100, parseInt(per_page) || 20))
  };
}

// Валидация ID товара
export function validateId(id) {
  const numId = parseInt(id);
  if (!numId || numId < 1 || numId > 999999) {
    throw new Error('Неверный ID товара');
  }
  return numId;
}

// Обработка ошибок
export function handleError(res, error, message = 'Внутренняя ошибка сервера') {
  console.error('Error:', error);
  res.status(500).json({ success: false, message });
}