export class CartValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'CartValidationError';
    }
  }
  
  /**
   * Валидация данных для добавления товара в корзину
   */
  export function validateAddToCart(data) {
    if (!data || typeof data !== 'object') {
      throw new CartValidationError('Данные товара обязательны');
    }
  
    const { product_id, quantity = 1 } = data;
  
    // Валидация product_id
    if (!product_id || !Number.isInteger(Number(product_id)) || Number(product_id) <= 0) {
      throw new CartValidationError('Некорректный ID товара');
    }
  
    // Валидация quantity
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
      throw new CartValidationError('Количество должно быть от 1 до 99');
    }
  
    return {
      product_id: Number(product_id),
      quantity: qty
    };
  }
  
  /**
   * Валидация данных для обновления товара в корзине
   */
  export function validateUpdateCartItem(data) {
    if (!data || typeof data !== 'object') {
      throw new CartValidationError('Данные для обновления обязательны');
    }
  
    const { product_id, quantity } = data;
  
    // Валидация product_id
    if (!product_id || !Number.isInteger(Number(product_id)) || Number(product_id) <= 0) {
      throw new CartValidationError('Некорректный ID товара');
    }
  
    // Валидация quantity (может быть 0 для удаления)
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || qty > 99) {
      throw new CartValidationError('Количество должно быть от 0 до 99');
    }
  
    return {
      product_id: Number(product_id),
      quantity: qty
    };
  }
  
  /**
   * Валидация данных для синхронизации корзины
   */
  export function validateSyncCart(data) {
    if (!data || typeof data !== 'object') {
      throw new CartValidationError('Данные для синхронизации обязательны');
    }
  
    const { items } = data;
  
    if (!Array.isArray(items)) {
      throw new CartValidationError('Товары должны быть массивом');
    }
  
    if (items.length > 100) {
      throw new CartValidationError('Слишком много товаров для синхронизации');
    }
  
    const validatedItems = [];
  
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue; // Пропускаем некорректные элементы
      }
  
      const { product_id, quantity } = item;
  
      // Проверяем product_id
      if (!product_id || !Number.isInteger(Number(product_id)) || Number(product_id) <= 0) {
        continue; // Пропускаем товары с некорректным ID
      }
  
      // Проверяем quantity
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
        continue; // Пропускаем товары с некорректным количеством
      }
  
      validatedItems.push({
        product_id: Number(product_id),
        quantity: qty
      });
    }
  
    return {
      items: validatedItems
    };
  }
  
  /**
   * Валидация списка ID товаров
   */
  export function validateProductIds(data) {
    if (!data || typeof data !== 'object') {
      throw new CartValidationError('Данные обязательны');
    }
  
    const { product_ids } = data;
  
    if (!Array.isArray(product_ids)) {
      throw new CartValidationError('ID товаров должны быть массивом');
    }
  
    if (product_ids.length === 0) {
      throw new CartValidationError('Список товаров не может быть пустым');
    }
  
    if (product_ids.length > 100) {
      throw new CartValidationError('Слишком много товаров в запросе');
    }
  
    const validatedIds = [];
  
    for (const id of product_ids) {
      if (Number.isInteger(Number(id)) && Number(id) > 0) {
        validatedIds.push(Number(id));
      }
    }
  
    if (validatedIds.length === 0) {
      throw new CartValidationError('Не найдено корректных ID товаров');
    }
  
    return {
      product_ids: [...new Set(validatedIds)] // Убираем дубликаты
    };
  }
  
  /**
   * Валидация ID товара из параметров URL
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
   * Общая обработка ошибок валидации
   */
  export function handleCartValidationError(res, error) {
    if (error instanceof CartValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  
    console.error('Cart validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка валидации данных корзины'
    });
  }