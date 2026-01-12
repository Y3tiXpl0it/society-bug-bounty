# backend/app/src/notifications/repository.py
import uuid
from typing import Any, List, Optional, cast

from sqlalchemy import select, update
from sqlalchemy.engine.cursor import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.src.notifications.models import Notification


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, notification: Notification) -> Notification:
        """Create a new notification."""
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def get_by_id(self, notification_id: uuid.UUID) -> Optional[Notification]:
        """Get notification by ID."""
        stmt = select(Notification).where(Notification.id == notification_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user(self, user_id: uuid.UUID, skip: int = 0, limit: int = 20) -> List[Notification]:
        """Get notifications for a specific user."""
        stmt = (
            select(Notification)
            .options(selectinload(Notification.notification_type))
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        """Get count of unread notifications for a user."""
        from sqlalchemy import func
        
        stmt = select(func.count()).where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def mark_as_read(self, notification_id: uuid.UUID) -> bool:
        """Mark a notification as read."""
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id)
            .values(is_read=True)
        )
        result = cast(CursorResult[Any], await self.session.execute(stmt))
        await self.session.commit()
        count = result.rowcount
        return count > 0

    async def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        """Mark all notifications for a user as read."""
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .values(is_read=True)
        )
        result = cast(CursorResult[Any], await self.session.execute(stmt))
        await self.session.commit()
        count = result.rowcount
        return count


    async def get_notification_type_id(self, type_name: str) -> Optional[int]:
        """Get notification type ID by name."""
        from app.src.notifications.models import NotificationType

        stmt = select(NotificationType.id).where(NotificationType.name == type_name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_old_notifications(self, days: int = 30) -> int:
        """Delete notifications older than specified days."""
        from sqlalchemy import delete
        from datetime import datetime, timedelta, timezone

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = delete(Notification).where(Notification.created_at < cutoff_date)
        result = cast(CursorResult[Any], await self.session.execute(stmt))
        await self.session.commit()
        count = result.rowcount
        return count