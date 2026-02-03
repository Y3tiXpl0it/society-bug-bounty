# backend/app/src/users/service.py

import uuid
from datetime import datetime, timezone
from pathlib import Path
from app.core.config import settings


from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.src.users.models import User
from app.core.exceptions import BadRequestException, NotFoundException
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
        from app.src.users.models import UserDetails, UsernameBlocklist
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

            # Check blocklist
            blocked = await self.session.execute(
                select(UsernameBlocklist).filter(
                    func.lower(UsernameBlocklist.username) == new_username_lower
                )
            )
            if blocked.scalar_one_or_none():
                 raise BadRequestException("Username is not available")

            # Check 30-day restriction
            if user.details.last_username_change:
                # Use timezone-aware datetime for comparison
                now = datetime.now(timezone.utc)
                # Ensure last_username_change is timezone-aware before comparison
                last_change = user.details.last_username_change
                if last_change.tzinfo is None:
                    last_change = last_change.replace(tzinfo=timezone.utc)
                
                days_since_change = (now - last_change).days
                if days_since_change < 30:
                    remaining_days = 30 - days_since_change
                    raise BadRequestException(f"You can only change your username once every 30 days. Please wait {remaining_days} more days.")

            # Add old username to blocklist
            if user.details.username:
                old_username = user.details.username
                # Only add if it's not somehow already there (though unique constraint exists on users table, blocklist is separate)
                # We trust the flow: if it was the current username, it shouldn't be in blocklist yet unless reused.
                blocklist_entry = UsernameBlocklist(
                    username=old_username,
                    original_user_id=user.id
                )
                self.session.add(blocklist_entry)

            # Update the timestamp
            user.details.last_username_change = datetime.now(timezone.utc)

        # Update the details fields
        for key, value in details_update.items():
            if hasattr(user.details, key):
                setattr(user.details, key, value)

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def upload_avatar(self, user_id: uuid.UUID, file: UploadFile) -> str:
        """
        Upload the avatar, delete the previous one, and update the database.
        All in one place.
        """
        # 1. Get user with their details
        user = await self.get_user_by_id(user_id)
        if not user:
             raise NotFoundException("User not found")

        # 2. Delete old avatar if it exists
        if user.details and user.details.avatar_url:
            old_avatar_path = Path(str(user.details.avatar_url).lstrip("/"))
            if old_avatar_path.exists():
                try:
                    old_avatar_path.unlink()
                except OSError:
                    pass

        # 3. Upload new avatar (Using your centralized service)
        upload_result = await ImageUploadService.validate_and_save_image(
            file=file,
            upload_dir=Path("media/avatars"),
            max_size=settings.MAX_AVATAR_SIZE,
            allowed_extensions=settings.ALLOWED_IMAGE_EXTENSIONS
        )

        # 4. Build relative URL
        unique_filename = Path(upload_result["file_path"]).name
        new_avatar_url = f"/media/avatars/{unique_filename}"

        # 5. UPDATE THE DATABASE HERE (The key change)
        await self.update_user_details(user.id, {"avatar_url": new_avatar_url})

        return new_avatar_url