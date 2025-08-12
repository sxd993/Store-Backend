export class CartValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CartValidationError';
  }
}

/**
 * Валидация для добавления товара в корзину
 */
export function validateAddToCart(data) {
  if (!data?.product_id) {
    throw new CartValidationError('ID товара обязателен');
  }

  const productId = Number(data.product_id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new CartValidationError('Некорректный ID товара');
  }

  const quantity = Number(data.quantity) || 1;
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
    throw new CartValidationError('Количество должно быть от 1 до 99');
  }

  return {
    product_id: productId,
    quantity
  };
}

/**
 * Валидация для обновления товара в корзине
 */
export function validateUpdateCartItem(data) {
  if (!data?.product_id) {
    throw new CartValidationError('ID товара обязателен');
  }

  const productId = Number(data.product_id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new CartValidationError('Некорректный ID товара');
  }

  const quantity = Number(data.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new CartValidationError('Количество должно быть от 0 до 99');
  }

  return {
    product_id: productId,
    quantity
  };
}

/**
 * Валидация для синхронизации корзины
 */
export function validateSyncCart(data) {
  const items = data?.items || [];

  if (!Array.isArray(items)) {
    throw new CartValidationError('Товары должны быть массивом');
  }

  if (items.length > 50) {
    throw new CartValidationError('Слишком много товаров для синхронизации');
  }

  const validatedItems = items
    .filter(item => {
      if (!item?.product_id) return false;
      
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      
      return Number.isInteger(productId) && productId > 0 &&
             Number.isInteger(quantity) && quantity > 0 && quantity <= 99;
    })
    .map(item => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity)
    }));

  return { items: validatedItems };
}

/**
 * Валидация ID товара из URL параметров
 */
export function validateProductIdParam(productId) {
  if (!productId) {
    throw new CartValidationError('ID товара обязателен');
  }

  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new CartValidationError('Некорректный ID товара');
  }

  return id;
}

/**
 * Обработка ошибок валидации
 */
export function handleCartValidationError(res, error) {
  return res.status(400).json({
    success: false,
    message: error.message
  });
}