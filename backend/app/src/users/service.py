# backend/app/src/users/service.py

import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.src.users.models import User
from app.core.exceptions import BadRequestException
from app.utils.image_upload_service import ImageUploadService

# Directory for storing uploaded avatar files
AVATAR_DIR = Path("media/avatars")

# Maximum allowed avatar file size (5 MB)
MAX_AVATAR_SIZE = 5 * 1024 * 1024

class UserService:
    """
    Service layer for user-related database operations.
    This class abstracts the database queries for fetching users.
    """
    def __init__(self, session: AsyncSession):
        """
        Initializes the user service with an async database session.
        """
        self.session = session

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        """Fetches a single user from the database by their UUID."""
        result = await self.session.execute(
            select(User).filter_by(id=user_id)
        )
        # The .unique() call is necessary to de-duplicate results.
        # This is because the User model has a 'lazy="joined"' relationship,
        # which can return multiple rows for the same user if they have multiple OAuth accounts.
        # .scalar_one_or_none() returns a single object or None if no user is found.
        return result.unique().scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        """Fetches a single user from the database by their email address."""
        result = await self.session.execute(
            select(User).filter_by(email=email)
        )
        # Add .unique() here as well for consistency and to prevent potential issues.
        return result.unique().scalar_one_or_none()

    async def update_user_details(self, user_id: uuid.UUID, details_update: dict) -> User | None:
        """Updates the user details for a given user ID."""
        from app.src.users.models import UserDetails
        from sqlalchemy import func

        # Fetch the user with details
        result = await self.session.execute(
            select(User).filter_by(id=user_id)
        )
        user = result.unique().scalar_one_or_none()
        if not user or not user.details:
            return None

        # Check for username uniqueness (case-insensitive)
        if 'username' in details_update and details_update['username']:
            new_username_lower = details_update['username'].lower()
            # Check if another user already has this username (case-insensitive)
            existing = await self.session.execute(
                select(UserDetails).filter(
                    func.lower(UserDetails.username) == new_username_lower,
                    UserDetails.user_id != user_id
                )
            )
            if existing.scalar_one_or_none():
                raise BadRequestException("Username already exists (case-insensitive)")

        # Update the details fields
        for key, value in details_update.items():
            if hasattr(user.details, key):
                setattr(user.details, key, value)

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def upload_avatar(self, user_id: uuid.UUID, file) -> str:
        """
        Uploads an avatar image for a user and returns the file path.
        Deletes the old avatar if it exists.

        Args:
            user_id: The ID of the user uploading the avatar
            file: The uploaded file

        Returns:
            The relative path to the uploaded avatar

        Raises:
            BadRequestException: If file is invalid
        """
        # Get current user to check for existing avatar
        user = await self.get_user_by_id(user_id)
        if user and user.details and user.details.avatar_url:
            # Delete old avatar file if it exists
            # avatar_url is like "/media/avatars/filename.png", so we need to remove the leading "/"
            old_avatar_path = Path(user.details.avatar_url.lstrip("/"))
            if old_avatar_path.exists():
                try:
                    old_avatar_path.unlink()
                except OSError:
                    # Log error but don't fail the upload
                    pass

        # Use centralized image upload service
        upload_result = await ImageUploadService.validate_and_save_image(
            file=file,
            upload_dir=AVATAR_DIR,
            max_size=MAX_AVATAR_SIZE
        )

        # Return relative path for serving
        unique_filename = Path(upload_result["file_path"]).name
        return f"/media/avatars/{unique_filename}"