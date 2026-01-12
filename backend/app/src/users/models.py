# backend/app/src/users/models.py
import uuid
import secrets
import hashlib
from typing import TYPE_CHECKING
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    ForeignKey,
    PrimaryKeyConstraint,
    String,
    DateTime,
    Integer,
    func,
    JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from fastapi_users_db_sqlalchemy import (
    SQLAlchemyBaseUserTableUUID,
    SQLAlchemyBaseOAuthAccountTable
)
from app.core.database import Base

# This block is used for type hinting and is only active during static analysis.
# It prevents circular import errors at runtime.
if TYPE_CHECKING:
    from app.src.organizations.models import Organization
    from app.src.reports.models import Report, ReportComment, ReportEvent
    from app.src.attachments.models import Attachment
    from app.src.notifications.models import Notification

# Import related models to ensure they are registered before relationships are resolved
from app.src.notifications.models import Notification  # noqa: F401
from app.core.config import settings

class OAuthAccount(SQLAlchemyBaseOAuthAccountTable[uuid.UUID], Base):
    """
    Represents an OAuth account associated with a user, extending the base model
    from fastapi-users. This table stores information from external identity providers
    like Google, GitHub, etc.
    """
    __tablename__ = "oauth_accounts"

    # We use type: ignore because we are redefining these fields with the modern 
    # SQLAlchemy 2.0 'Mapped' syntax. This causes a type conflict with the 
    # fastapi-users base class (which uses simple types), but it is necessary 
    # for the linter to correctly recognize SQL expressions elsewhere in the code.
    oauth_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False) #type: ignore
    access_token: Mapped[str] = mapped_column(String(1024), nullable=False) #type: ignore
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True) #type: ignore
    refresh_token: Mapped[str | None] = mapped_column(String(1024), nullable=True) #type: ignore
    account_id: Mapped[str] = mapped_column(String(320), index=True, nullable=False) #type: ignore
    account_email: Mapped[str] = mapped_column(String(320), nullable=False) #type: ignore

    # The user_id is explicitly defined to establish a foreign key relationship
    # with the 'users' table, ensuring that deleting a user also deletes their
    # associated OAuth accounts.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False
    )

    # Defines the relationship back to the User model.
    user: Mapped["User"] = relationship(back_populates="oauth_accounts")

    # A composite primary key is defined, as the combination of the OAuth provider's
    # name and the account ID must be unique.
    __table_args__ = (PrimaryKeyConstraint("oauth_name", "account_id"),)


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    Main User model for the application.
    It inherits standard fields (id, email, hashed_password, is_active, etc.)
    from SQLAlchemyBaseUserTableUUID provided by fastapi-users and adds custom fields.
    """
    __tablename__ = "users"

    # We use type: ignore because we are redefining these fields with the modern 
    # SQLAlchemy 2.0 'Mapped' syntax. This causes a type conflict with the 
    # fastapi-users base class (which uses simple types), but it is necessary 
    # for the linter to correctly recognize SQL expressions elsewhere in the code.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4) #type: ignore
    email: Mapped[str] = mapped_column(String(length=320), unique=True, index=True, nullable=False) #type: ignore
    hashed_password: Mapped[str] = mapped_column(String(length=1024), nullable=False) #type: ignore
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False) #type: ignore
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) #type: ignore
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) #type: ignore

    # --- Timestamps for tracking user activity ---
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Relationships to other models ---

    # One-to-many relationship with OAuth accounts. 'lazy="joined"' ensures they are loaded with the user.
    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(lazy="joined", back_populates="user")
    
    # One-to-one relationship with user details. 'cascade' ensures details are deleted with the user.
    details: Mapped["UserDetails"] = relationship(back_populates="user", cascade="all, delete-orphan", uselist=False, lazy="joined")

    # Many-to-many relationship with organizations through an association table.
    organizations: Mapped[list["Organization"]] = relationship(
        "Organization",
        secondary="user_organization_memberships",
        back_populates="members",
        lazy="joined"
    )

    # Other existing relationships
    reports: Mapped[list["Report"]] = relationship("Report", back_populates="hacker")
    comments: Mapped[list["ReportComment"]] = relationship("ReportComment", back_populates="author")
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="uploader")
    report_events: Mapped[list["ReportEvent"]] = relationship("ReportEvent", back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user")
    
    # Relationship with refresh tokens
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class UserDetails(Base):
    """
    Stores additional public or descriptive information about a user.
    This separation keeps the main 'users' table clean and focused on authentication data.
    """
    __tablename__ = "user_details"
    
    # The primary key is also a foreign key to users.id, enforcing a one-to-one relationship.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="cascade"), primary_key=True)
    
    # A unique username for the user, indexed for faster lookups.
    # Case-insensitive uniqueness is enforced in the service layer.
    username: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    
    # A text field to store profile bio.
    profile_info: Mapped[str | None] = mapped_column(String(500))

    # URL for the user's avatar image.
    avatar_url: Mapped[str | None] = mapped_column(String(255))

    # --- Notification preferences ---
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    in_app_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # --- Relationship back to the User model ---
    user: Mapped["User"] = relationship(back_populates="details")


class RefreshToken(Base):
    """
    Stores opaque refresh tokens for renewing access tokens.
    Tokens are hashed for security and can be revoked individually.
    """
    __tablename__ = "refresh_tokens"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    
    # Hash of the token (we don't store the actual token)
    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False
    )
    
    # User relationship
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False
    )
    
    # CSRF token associated with this refresh token
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    
    # Token metadata
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    
    # Revocation control
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Device/client information for auditing
    device_info: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    
    # Relationship back to User
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
    
    @staticmethod
    def generate_token() -> str:
        """Generate a random 64-character hex token"""
        return secrets.token_hex(32)
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Create a SHA256 hash of the token"""
        return hashlib.sha256(token.encode()).hexdigest()
    
    def is_valid(self) -> bool:
        """Check if the token is valid (not revoked and not expired)"""
        now = datetime.now(timezone.utc)

        # Handle timezone-aware vs naive datetime comparison
        if self.expires_at.tzinfo is None:
            now = now.replace(tzinfo=None)

        return not self.revoked and self.expires_at > now
    
    def revoke(self):
        """Revoke this token"""
        self.revoked = True
        self.revoked_at = datetime.now(timezone.utc)