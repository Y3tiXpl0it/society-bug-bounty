# app/core/database.py
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# Check if the database URL is configured in the application settings.
if settings.DATABASE_URL is None:
    raise ValueError("DATABASE_URL is not configured in environment variables")

# Create the asynchronous engine for database communication.
# The string from settings.DATABASE_URL is now guaranteed to be present.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True # Enable pool pre-ping to check connections before use
)

# Create an asynchronous session factory, bound to the engine.
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Create a declarative base class that all ORM models will inherit from.
Base = declarative_base()

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for providing an asynchronous database session.

    Yields:
        AsyncSession: The database session for a single request.
    """
    async with async_session() as session:
        yield session