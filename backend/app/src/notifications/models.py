# backend/app/src/notifications/models.py
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    ForeignKey,
    String,
    Text,
    func,
    DateTime
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.src.users.models import User


class NotificationRoleEnum(str, enum.Enum):
    """Possible roles for notification recipients."""
    HACKER = "hacker"
    ORG_MEMBER = "org_member"
    ADMIN = "admin"  # To include admin role if needed


class NotificationTypeEnum(str, enum.Enum):
    """Enumeration of notification types."""
    report_created = "report_created"
    status_changed = "status_changed"
    severity_changed = "severity_changed"
    comment_added = "comment_added"


class NotificationType(Base):
    """
    Model for notification types. Allows for dynamic management of notification types.
    """
    __tablename__ = "notification_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Relationships
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="notification_type")


class Notification(Base):
    """
    Model for user notifications.
    """
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    notification_type_id: Mapped[int] = mapped_column(ForeignKey("notification_types.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Track if the notification has been read
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Track the role of the recipient (hacker or org_member)
    recipient_role: Mapped[str] = mapped_column(
        String(20), 
        default=NotificationRoleEnum.HACKER.value, 
        nullable=False
    )

    # ID of the related entity (report, comment, etc.)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=func.now(), 
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
    notification_type: Mapped["NotificationType"] = relationship("NotificationType", back_populates="notifications")