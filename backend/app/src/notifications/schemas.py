# backend/app/src/notifications/schemas.py
import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, field_validator
from app.src.notifications.models import NotificationRoleEnum


class NotificationBase(BaseModel):
    """Base schema for notifications."""
    title: str
    message: str
    related_entity_id: Optional[uuid.UUID] = None


class NotificationCreate(NotificationBase):
    """Schema for creating notifications."""
    user_id: uuid.UUID
    notification_type: str  # Will be validated against enum values
    recipient_role: NotificationRoleEnum = NotificationRoleEnum.HACKER


class NotificationRead(NotificationBase):
    """Schema for reading notifications."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    notification_type: str
    is_read: bool
    recipient_role: str
    created_at: datetime

    @field_validator('notification_type', mode='before')
    @classmethod
    def get_type_name(cls, v: Any) -> str:
        if hasattr(v, 'name'):
            return v.name
        return str(v)


class NotificationUpdate(BaseModel):
    """Schema for updating notifications."""
    pass


class NotificationPreferences(BaseModel):
    """Schema for user notification preferences."""
    email_notifications_enabled: bool = True
    in_app_notifications_enabled: bool = True


class NotificationSummary(BaseModel):
    """Summary of user notifications."""
    total: int
    unread: int