from pydantic import BaseModel
from typing import List
from decimal import Decimal

class ProductResponse(BaseModel):
    id: int
    name: str
    description: str
    price: Decimal
    stock_quantity: int

    class Config:
        from_attributes = True
    
class PaginatedResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    per_page: int
    pages: int
    has_next: bool
    has_prev: bool