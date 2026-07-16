from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password

from app.core.security import (
    create_access_token,
    verify_password,
)
from app.db.models import User


async def get_user_by_email(
    db: AsyncSession,
    email: str,
) -> User | None:
    """Fetch a user by email."""

    result = await db.execute(
        select(User).where(User.email == email)
    )

    return result.scalar_one_or_none()

async def count_users(db: AsyncSession) -> int:
    """Count total users in the system (used to detect first-time bootstrap)."""

    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar_one()

async def list_users(db: AsyncSession) -> list[User]:
    """Return all users, ordered by id."""

    result = await db.execute(select(User).order_by(User.id))
    return list(result.scalars().all())

async def create_user(
    db: AsyncSession,
    full_name: str,
    email: str,
    password: str,
    role: str = "user",
) -> User:
    """Create a new user."""
    existing_user = await get_user_by_email(
        db,
        email,
    )
    if existing_user:
        raise ValueError("User already exists")
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        is_active=True,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def get_user_by_id(
    db: AsyncSession,
    user_id: int,
) -> User | None:
    """Fetch a user by id."""

    return await db.get(User, user_id)

async def update_user(
    db: AsyncSession,
    user: User,
    role: str | None = None,
    is_active: bool | None = None,
) -> User:
    """Update a user's role and/or active status."""

    if role is not None:
        user.role = role

    if is_active is not None:
        user.is_active = is_active

    await db.commit()
    await db.refresh(user)
    return user

async def delete_user(
    db: AsyncSession,
    user: User,
) -> None:
    """Permanently delete a user."""

    await db.delete(user)
    await db.commit()

async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> tuple[User | None, str | None]:
    """
    Authenticate a user.
    Returns:
        (user, access_token)
    """

    user = await get_user_by_email(
        db,
        email,
    )

    if user is None:
        return None, None

    if not verify_password(
        password,
        user.password_hash,
    ):
        return None, None

    token = create_access_token(
        subject=user.email,
    )

    return user, token