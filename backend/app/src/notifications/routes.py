# backend/app/src/notifications/routes.py
import uuid
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.src.notifications.schemas import NotificationRead, NotificationSummary
from app.src.notifications.service import NotificationService
from app.src.users.manager import fastapi_users_instance
from app.src.users.models import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=List[NotificationRead])
async def get_user_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(fastapi_users_instance.current_user())
):
    """
    Get notifications for the current user.

    - **skip**: Number of notifications to skip (pagination)
    - **limit**: Maximum number of notifications to return (max 200)
    """
    service = NotificationService(db)
    notifications = await service.get_user_notifications(
        current_user.id, skip, limit
    )
    return notifications


@router.get("/summary", response_model=NotificationSummary)
async def get_notification_summary(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(fastapi_users_instance.current_user())
):
    """
    Get a summary of user notifications (total count and unread count).
    """
    service = NotificationService(db)
    total = await service.get_notification_count(current_user.id)
    unread = await service.get_unread_count(current_user.id)

    return NotificationSummary(total=total, unread=unread)


@router.patch("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(fastapi_users_instance.current_user())
):
    """
    Mark a specific notification as read.
    """

    service = NotificationService(db)
    await service.mark_notification_as_read(notification_id)
    return {"message": "Notification marked as read"}


@router.patch("/mark-all-read")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(fastapi_users_instance.current_user())
):
    """
    Mark all notifications as read for the current user.
    """
    service = NotificationService(db)
    count = await service.mark_all_as_read(current_user.id)
    return {"message": f"{count} notifications marked as read", "count": count}

