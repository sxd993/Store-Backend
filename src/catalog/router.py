from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from database import get_db
from .models import Product
from .schemas import ProductResponse, PaginatedResponse

router = APIRouter()

@router.get('/catalog', response_model=PaginatedResponse)
async def get_catalog(
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(20, ge=1, le=100, description="Товаров на странице"),
    db: AsyncSession = Depends(get_db)
):
    try:
        count_query = select(func.count()).where(Product.stock_quantity > 0)
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        offset = (page - 1) * per_page
        base_query = select(Product).where(Product.stock_quantity > 0)
        items_query = base_query.order_by(Product.id).offset(offset).limit(per_page)
        
        result = await db.execute(items_query)
        items = result.scalars().all()
        
        pages = (total + per_page - 1) // per_page if total > 0 else 1
        has_next = page < pages
        has_prev = page > 1
        
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка каталога: {str(e)}")

@router.get('/catalog/{product_id}', response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    try:
        query = select(Product).where(Product.id == product_id, Product.stock_quantity > 0)
        result = await db.execute(query)
        product = result.scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail="Товар не найден")
        
        return product
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения товара: {str(e)}")