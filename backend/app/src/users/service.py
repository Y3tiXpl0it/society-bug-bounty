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
from app.src.users.models import User, OAuthAccount, UserDetails
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

    async def get_user_by_username(self, username: str) -> User | None:
        """Fetches a user by their username (via UserDetails join)."""
        from sqlalchemy import func
        result = await self.session.execute(
            select(User)
            .join(UserDetails, User.id == UserDetails.user_id)
            .where(func.lower(UserDetails.username) == username.lower())
        )
        return result.unique().scalar_one_or_none()

    async def create_guest_user(self, user_manager: UserManager) -> tuple[User, str]:
        """
        Creates a temporary guest user.
        Returns (user, plain_password) so the password can be shown once to the hacker.
        """
        # Generate random password
        plain_password = secrets.token_urlsafe(12)

        # Generate placeholder email that the user never sees
        placeholder_email = f"guest-{uuid.uuid4().hex[:12]}@sbb.temporary"

        try:
            # Create user via fastapi-users manager (handles hashing, on_after_register hook)
            user_create = UserCreate(email=placeholder_email, password=plain_password, is_active=True)
            created_user = await user_manager.create(user_create)

            # Re-fetch within our session (user_manager uses its own session)
            user = await self.get_user_by_id(created_user.id)
            if not user:
                raise Exception("Failed to fetch newly created guest user")

            # Mark as temporary
            user.is_temporary = True
            await self.session.commit()
            await self.session.refresh(user)

            return user, plain_password

        except BadRequestException:
            raise
        except Exception as e:
            logger.error(f"Error creating guest user: {e}")
            await self.session.rollback()
            raise BadRequestException(detail={
                "code": ErrorCode.GUEST_LOGIN_FAILED,
                "message": "Error creating guest account",
                "params": {"error": str(e)}
            })

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
            password = secrets.token_urlsafe(20)
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

    async def update_stats_for_report_change(
        self,
        user_id: uuid.UUID,
        old_status: str,
        new_status: str,
        old_severity: float,
        new_severity: float
    ) -> None:
        """
        Updates the UserStats table based on changes to a report.
        Handles both status changes and severity changes.
        """
        from app.src.users.models import UserStats
        
        # Consider successful statuses
        success_statuses = {"accepted", "resolved"}
        
        was_successful = old_status in success_statuses
        is_successful = new_status in success_statuses

        # If it wasn't successful before and it still isn't, no stats change needed.
        if not was_successful and not is_successful:
            return

        # Fetch or create UserStats
        result = await self.session.execute(
            select(UserStats).filter_by(user_id=user_id)
        )
        stats = result.scalar_one_or_none()
        
        if not stats:
            stats = UserStats(
                user_id=user_id,
                total_score=0.0,
                total_reports=0,
                critical_bugs=0,
                high_bugs=0,
                medium_bugs=0,
                low_bugs=0
            )
            self.session.add(stats)

        def determine_bucket(sev: float) -> str:
            if sev >= 9.0: return "critical_bugs"
            if sev >= 7.0: return "high_bugs"
            if sev >= 4.0: return "medium_bugs"
            return "low_bugs"

        old_bucket = determine_bucket(old_severity)
        new_bucket = determine_bucket(new_severity)

        # Case 1: Transition TO successful (Newly accepted/resolved)
        if not was_successful and is_successful:
            stats.total_score += new_severity
            stats.total_reports += 1
            current = getattr(stats, new_bucket)
            setattr(stats, new_bucket, current + 1)

        # Case 2: Transition FROM successful (Reverted to in_review/rejected)
        elif was_successful and not is_successful:
            stats.total_score -= old_severity
            stats.total_reports = max(0, stats.total_reports - 1)
            old_current = getattr(stats, old_bucket)
            setattr(stats, old_bucket, max(0, old_current - 1))

        # Case 3: Retained successful status, but severity might have changed
        elif was_successful and is_successful:
            if old_severity != new_severity:
                stats.total_score = stats.total_score - old_severity + new_severity
                
                # If the severity change moved it to a different bucket
                if old_bucket != new_bucket:
                    old_current = getattr(stats, old_bucket)
                    setattr(stats, old_bucket, max(0, old_current - 1))
                    
                    new_current = getattr(stats, new_bucket)
                    setattr(stats, new_bucket, new_current + 1)
                    
        await self.session.flush()

    async def get_leaderboard(self, page: int, size: int) -> dict:
        """
        Fetches the paginated leaderboard data joined with user details.
        """
        from app.src.users.models import UserStats, UserDetails, User
        from sqlalchemy import func

        skip = (page - 1) * size

        # Get total count (excluding temporary users)
        result_total = await self.session.execute(
            select(func.count(UserStats.user_id))
            .join(User, UserStats.user_id == User.id)
            .where(User.is_temporary == False)
        )
        total = result_total.scalar_one_or_none() or 0

        # Get paginated data joined with user details (excluding temporary users)
        stmt = (
            select(UserStats, UserDetails.username, UserDetails.avatar_url)
            .join(User, UserStats.user_id == User.id)
            .join(UserDetails, User.id == UserDetails.user_id)
            .where(User.is_temporary == False)
            .order_by(UserStats.total_score.desc(), UserStats.total_reports.desc())
            .offset(skip)
            .limit(size)
        )
        
        result = await self.session.execute(stmt)
        rows = result.all()

        items = []
        for i, row in enumerate(rows):
            stats, username, avatar_url = row
            items.append({
                "username": username,
                "avatar_url": avatar_url,
                "rank": skip + i + 1,
                "total_score": round(stats.total_score, 2),
                "total_reports": stats.total_reports,
                "bug_breakdown": {
                    "critical": stats.critical_bugs,
                    "high": stats.high_bugs,
                    "medium": stats.medium_bugs,
                    "low": stats.low_bugs
                }
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size
        }