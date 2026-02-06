# backend/app/src/users/service.py

import uuid
import secrets
from datetime import datetime, timezone
from pathlib import Path
from app.core.config import settings
from app.core.error_codes import ErrorCode


from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.src.users.models import User
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.exceptions import BadRequestException, NotFoundException
from app.utils.image_upload_service import ImageUploadService
from app.src.users.manager import UserManager
from app.src.users.google_oauth_service import GoogleOAuthService
from app.src.users.schemas import UserCreate
from app.src.users.models import User, OAuthAccount
from app.core.logging import get_logger

logger = get_logger(__name__)

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

    async def update_user_details(self, user_id: uuid.UUID, details_update: dict) -> User:
        """Updates the user details for a given user ID."""
        from app.src.users.models import UserDetails, UsernameBlocklist
        from sqlalchemy import func

        # Fetch the user with details
        result = await self.session.execute(
            select(User).filter_by(id=user_id)
        )
        user = result.unique().scalar_one_or_none()
        if not user or not user.details:
            raise NotFoundException(detail={
                "code": ErrorCode.USER_NOT_FOUND,
                "message": "User details not found"
            })

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
                raise BadRequestException(detail={
                    "code": ErrorCode.USERNAME_ALREADY_EXISTS,
                    "message": "Username already exists (case-insensitive)"
                })

            # Check blocklist
            blocked = await self.session.execute(
                select(UsernameBlocklist).filter(
                    func.lower(UsernameBlocklist.username) == new_username_lower
                )
            )
            if blocked.scalar_one_or_none():
                 raise BadRequestException(detail={
                     "code": ErrorCode.USERNAME_NOT_AVAILABLE,
                     "message": "Username is not available"
                 })

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
                    raise BadRequestException(detail={
                        "code": ErrorCode.USERNAME_CHANGE_RESTRICTED,
                        "message": f"You can only change your username once every 30 days. Please wait {remaining_days} more days.",
                        "params": {"days_remaining": remaining_days}
                    })

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
            raise NotFoundException(detail={
                "code": ErrorCode.USER_NOT_FOUND,
                "message": "User not found"
            })

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

    async def process_google_callback(
        self,
        code: str,
        pkce_verifier: str,
        user_manager: UserManager
    ) -> User:
        """
        Handles the Google OAuth callback logic: exchange code, get info, create/update user.
        """
        google_service = GoogleOAuthService()

        # 1. Exchange authorization code for Google tokens
        try:
            token_data = await google_service.exchange_code_for_token(
                code=code,
                code_verifier=pkce_verifier
            )
        except Exception as e:
            logger.error(f"Error exchanging token: {e}")
            raise BadRequestException(detail={
                "code": ErrorCode.GOOGLE_LOGIN_FAILED,
                "message": "Failed to exchange token with Google",
                "params": {"error": str(e)}
            })

        # 2. Retrieve User Info from Google
        try:
            google_sub, email = await google_service.get_user_info(token_data["access_token"])
        except Exception as e:
            logger.error(f"Error fetching user info: {e}")
            raise BadRequestException(detail={
                "code": ErrorCode.GOOGLE_LOGIN_FAILED,
                "message": "Failed to fetch user info from Google",
                "params": {"error": str(e)}
            })

        # 3. Find or Create User
        user = await self.get_user_by_email(email)

        if not user:
            # --- REGISTER NEW USER ---
            password = secrets.token_urlsafe(12)
            try:
                # Create base user
                user_create = UserCreate(email=email, password=password, is_active=True)
                user = await user_manager.create(user_create)

                # Calculate expiry timestamp
                expires_at = None
                if token_data.get("expires_in"):
                    # Cast to int to avoid TypeError between int and str
                    expires_at = int(datetime.now().timestamp()) + int(token_data["expires_in"])

                # Create OAuth Account Link
                oauth_account_data = {
                    "oauth_name": "google",
                    "access_token": token_data["access_token"],
                    "expires_at": expires_at,
                    "refresh_token": token_data.get("refresh_token"),
                    "account_id": google_sub,
                    "account_email": email,
                    "user_id": user.id
                }
                self.session.add(OAuthAccount(**oauth_account_data))

                await self.session.commit()

            except Exception as e:
                logger.error(f"Error creating new user: {e}")
                await self.session.rollback()
                raise BadRequestException(detail={
                    "code": ErrorCode.LOGIN_FAILED,
                    "message": "Error creating user account",
                    "params": {"error": str(e)}
                })
        else:
            # --- EXISTING USER ---
            # Logic to update existing user tokens could go here
            pass

        return user