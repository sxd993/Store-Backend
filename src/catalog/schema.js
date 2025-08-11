// Кастомный класс для ошибок валидации
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Валидация пагинации
export function validatePagination(page, per_page) {
  const parsedPage = parseInt(page);
  const parsedPerPage = parseInt(per_page);

  return {
    page: isNaN(parsedPage) ? 1 : Math.max(1, Math.min(10000, parsedPage)),
    per_page: isNaN(parsedPerPage) ? 20 : Math.max(1, Math.min(50, parsedPerPage)),
  };
}

// Валидация ID товара
export function validateId(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || numId < 1) {
    throw new ValidationError('ID товара должен быть положительным числом');
  }
  return numId;
}

function basicSanitize(str) {
  if (!str) return str;
  return str.replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// Валидация данных товара для добавления/обновления
export function validateProduct(productData) {
  if (!productData || typeof productData !== 'object') {
    throw new ValidationError('Данные товара обязательны');
  }

  const { brand, model, category, price, stock_quantity, color, memory, image, description } = productData;

  // Обязательные поля
  if (!brand || !brand.trim()) {
    throw new ValidationError('Бренд обязателен');
  }

  if (!model || !model.trim()) {
    throw new ValidationError('Модель обязательна');
  }

  if (!category || !category.trim()) {
    throw new ValidationError('Категория обязательна');
  }

  if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    throw new ValidationError('Цена должна быть положительным числом');
  }

  if (stock_quantity === undefined || isNaN(parseInt(stock_quantity)) || parseInt(stock_quantity) < 0) {
    throw new ValidationError('Количество на складе должно быть неотрицательным числом');
  }

  return {
    brand: basicSanitize(brand.trim()),
    model: basicSanitize(model.trim()),
    category: basicSanitize(category.trim()),
    price: parseFloat(price),
    stock_quantity: parseInt(stock_quantity),
    color: color ? basicSanitize(color.trim()) : null,
    memory: memory ? basicSanitize(memory.trim()) : null,
    image: image ? image.trim() : null,
    description: description ? basicSanitize(description.trim()) : null
  };
}

// Валидация фильтров
export function validateFilters(filters) {
  if (!filters || typeof filters !== 'object') {
    return {};
  }

  const validatedFilters = {};
  const stringFilters = ['category', 'brand', 'model', 'color', 'memory'];

  stringFilters.forEach(filterKey => {
    if (filters[filterKey] && typeof filters[filterKey] === 'string') {
      const trimmed = filters[filterKey].trim();
      if (trimmed.length > 0 && trimmed.length <= 100) {
        validatedFilters[filterKey] = trimmed;
      }
    }
  });

  return validatedFilters;
}

// Обработка ошибок
export function handleError(res, error, message = 'Внутренняя ошибка сервера') {
  console.error('Error:', error);
  res.status(500).json({ success: false, message });
}