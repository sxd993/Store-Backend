from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL_CA
from pathlib import Path
from urllib.parse import quote_plus
from typing import AsyncGenerator
import logging
import ssl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SSL
connect_args = {}
if DB_SSL_CA:
    ssl_context = ssl.create_default_context(cafile=str(Path(__file__).parent / DB_SSL_CA))
    connect_args["ssl"] = ssl_context
    logger.info(f"SSL enabled with CA certificate: {DB_SSL_CA}")
else:
    logger.warning("SSL not configured; proceeding without SSL")

# URL для async MySQL
DATABASE_URL = (
    f"mysql+aiomysql://{quote_plus(DB_USER)}:{quote_plus(DB_PASSWORD)}@"
    f"{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)
logger.info(f"Connecting to MySQL: Host={DB_HOST}, Port={DB_PORT}, DB={DB_NAME}, SSL={'enabled' if DB_SSL_CA else 'disabled'}")

# Асинхронный движок
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Сессии
async_session = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession
)

# Базовый класс
Base = declarative_base()

# Функция получения сессии
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            raise
