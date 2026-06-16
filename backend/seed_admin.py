"""
Seed script: creates the default admin user.

Credentials:
  Email    : admin@goodpeople.agency
  Password : set CRM_ADMIN_PASSWORD in the environment

Run inside the backend container:
  docker compose exec backend python seed_admin.py
"""

import asyncio
import os

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.user import User

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://crm_user:strong_password_here@postgres:5432/crm_agency",
)

ADMIN_EMAIL = "admin@goodpeople.agency"
ADMIN_PASSWORD = os.environ.get("CRM_ADMIN_PASSWORD", "")
ADMIN_FULL_NAME = "Администратор"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    if not ADMIN_PASSWORD:
        raise RuntimeError("CRM_ADMIN_PASSWORD is required")

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        async with session.begin():
            result = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"⚠️  Пользователь {ADMIN_EMAIL} уже существует (роль: {existing.role}).")
            else:
                admin = User(
                    email=ADMIN_EMAIL,
                    full_name=ADMIN_FULL_NAME,
                    hashed_password=pwd_context.hash(ADMIN_PASSWORD),
                    role="admin",
                    is_active=True,
                )
                session.add(admin)
                print(f"✅ Создан администратор: {ADMIN_EMAIL}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
