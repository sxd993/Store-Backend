import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME", "nnv_store")
DB_SSL_CA = os.getenv("DB_SSL_CA", "ca.crt")

REQUIRED_ENV_VARS = [
    ("DB_USER", DB_USER),
    ("DB_PASSWORD", DB_PASSWORD),
    ("DB_NAME", DB_NAME),
]

missing_vars = [name for name, value in REQUIRED_ENV_VARS if not value]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

if DB_SSL_CA and not os.path.exists(Path(__file__).parent / DB_SSL_CA):
    raise FileNotFoundError(f"SSL certificate not found at {Path(__file__).parent / DB_SSL_CA}")

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]