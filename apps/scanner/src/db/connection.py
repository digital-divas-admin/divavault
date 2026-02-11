"""Async database connection pool and session factory."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

connect_args = {}
if settings.database_ssl:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Create a new async database session."""
    async with async_session() as session:
        yield session


async def dispose_engine():
    """Dispose the connection pool on shutdown."""
    await engine.dispose()
