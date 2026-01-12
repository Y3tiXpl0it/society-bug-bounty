# backend/app/src/users/manager.py
import uuid
from typing import Optional, cast

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, UUIDIDMixin, schemas as fastapi_users_schemas
from fastapi_users.fastapi_users import FastAPIUsers
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.src.users.models import User, OAuthAccount, UserDetails
from app.src.users.auth import auth_backend
from app.utils.username_generator import generate_username

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """
    Custom User Manager that extends fastapi-users' BaseUserManager.
    It handles user-related logic such as creation, registration, and username generation.
    """
    # Secret keys for generating secure tokens for password resets and email verifications.
    reset_password_token_secret = settings.JWT_SECRET
    verification_token_secret = settings.JWT_SECRET

    async def _get_user_details_by_username(self, username: str) -> Optional[UserDetails]:
        """
        Asynchronously retrieves a UserDetails instance from the database by username.

        Args:
            username: The username to search for.

        Returns:
            An optional UserDetails object if found, otherwise None.
        """
        user_db = cast(SQLAlchemyUserDatabase, self.user_db)
        async with user_db.session as session:
            statement = select(UserDetails).where(UserDetails.username == username)
            result = await session.execute(statement)
            return result.scalar_one_or_none()

    async def _generate_unique_username(self) -> str:
        """
        Generates a unique username in the format: AdjectiveNounNumber (e.g., "BraveTiger123").
        It ensures the username is not already taken by checking the database.

        Returns:
            A unique username string.
        """
        while True:
            username = generate_username()
            if not await self._get_user_details_by_username(username):
                return username

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        """
        Callback executed after a user successfully registers.
        It creates a UserDetails record with a unique username for the new user
        if one doesn't already exist. This is useful for social logins or
        registration flows that don't initially provide a username.
        """
        if not user.details:
            username = await self._generate_unique_username()
            user_details = UserDetails(user_id=user.id, username=username)
            
            user_db = cast(SQLAlchemyUserDatabase, self.user_db)
            async with user_db.session as session:
                session.add(user_details)
                await session.commit()
                
    async def create(
        self,
        user_create: fastapi_users_schemas.BaseUserCreate,
        safe: bool = False,
        request: Optional[Request] = None,
    ) -> User:
        """
        Overrides the default user creation method.
        This method can be extended with custom logic before or after user creation.
        """
        # Calls the parent class's create method to handle the actual user creation.
        user = await super().create(user_create, safe, request)
        return user


# --- FastAPI Dependencies ---

async def get_user_db(session: AsyncSession = Depends(get_session)):
    """
    FastAPI dependency that provides a SQLAlchemyUserDatabase instance.
    This is used to interact with user-related database tables (User, OAuthAccount).
    """
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)

async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    """
    FastAPI dependency that provides an instance of our custom UserManager.
    """
    yield UserManager(user_db)

# Central instance to manage users and authentication.
# This object is used to create the authentication routes in the FastAPI application.
fastapi_users_instance = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)