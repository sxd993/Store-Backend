from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.catalog.router import router as catalog_router
from config import CORS_ORIGINS

app = FastAPI(
    title="nnv Store",
    description="",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(catalog_router)

@app.get("/")
async def root():
    return {"message": "Каталог API работает!"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )