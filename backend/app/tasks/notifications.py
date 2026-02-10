# backend/app/tasks/notifications.py

"""
Celery tasks for the notification system.
"""
from typing import Dict, cast, Any
import logging

# Type hint for Celery task to access apply_async method safely
from celery.app.task import Task as CeleryTask

from app.celery_config import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 5},
    name='notifications.send_email'
)
def send_email_notification_task(self, email_to: str, subject: str, template_name: str, template_body: dict):
    """
    Celery task to send an email asynchronously.
    """
    import asyncio
    from app.src.notifications.email import send_email

    try:
        # Since Celery runs in a separate thread/process, we need to run the async send_email
        # in an event loop.
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        loop.run_until_complete(send_email(email_to, subject, template_name, template_body))
        
        logger.info(f"📧 Email sent to {email_to}")
    except Exception as e:
        logger.error(f"❌ Failed to send email to {email_to}: {e}")
        raise e


@celery_app.task(
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_kwargs={'max_retries': 5, 'countdown': 2},
    retry_backoff=True,
    name='notifications.send_websocket'
)
def send_websocket_notification(self, notification_id: str):
    """
    Send notification via WebSocket to the corresponding user.

    Args:
        notification_id: UUID of the notification to send

    Retries:
        - 5 attempts (WebSocket may fail temporarily)
        - Backoff: 2s, 4s, 8s, 16s, 32s
    """
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker, joinedload
        from app.core.config import settings
        from app.src.notifications.models import Notification
        # Import necessary schemas
        from app.src.websockets.schemas import NotificationEvent, WebSocketMessage, WebSocketEventType
        import socketio

        # Create synchronous DB session
        # Type assertion: DATABASE_URL is guaranteed to be set by model_validator
        db_url = cast(str, settings.DATABASE_URL)
        
        # Ensure we use a sync driver for Celery (psycopg instead of asyncpg)
        engine = create_engine(
            db_url.replace('+asyncpg', '+psycopg'),
            pool_pre_ping=True
        )
        Session = sessionmaker(bind=engine)
        session = Session()

        try:
            # 1. Fetch the notification from the database
            # OPTIMIZATION: Use joinedload to fetch the notification_type relation in the same query
            # This prevents "lazy load" errors or extra queries when accessing .name later
            notification = (
                session.query(Notification)
                .options(joinedload(Notification.notification_type))
                .get(notification_id)
            )
            
            if not notification:
                logger.warning(f"Notification {notification_id} not found during WebSocket broadcast")
                return

            # 2. Create the event payload complying with the NEW Schema
            # We need to extract the string representation of the type, not the object itself
            type_name = "general"
            if notification.notification_type:
                type_name = notification.notification_type.name

            event = NotificationEvent(
                id=str(notification.id),
                user_id=str(notification.user_id),
                title=notification.title,
                message=notification.message,
                # Safely access severity (defaults to 'info' if column is missing)
                severity=getattr(notification, 'severity', 'info'),
                
                # FIX: Send the type name (string), not the relationship object
                notification_type=type_name,
                
                recipient_role=notification.recipient_role,
                related_entity_id=str(notification.related_entity_id) if notification.related_entity_id else None,
                created_at=notification.created_at.isoformat() if notification.created_at else ''
            )

            # 3. Create the WebSocket Message envelope
            message = WebSocketMessage(
                event_type=WebSocketEventType.NOTIFICATION_RECEIVED,
                data=event.model_dump(), # Pydantic v2 uses model_dump()
                timestamp=event.created_at
            )

            # 4. Broadcast via Redis to the Socket.IO server
            redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
            
            mgr = socketio.RedisManager(redis_url, write_only=True)
            
            room = f"user_{notification.user_id}"
            logger.info(f"📡 Broadcasting to room: {room}")
            
            mgr.emit(
                'notification',
                data=message.model_dump(),
                room=room
            )
            
        finally:
            session.close()
            engine.dispose()
            
    except Exception as e:
        logger.error(f"❌ WebSocket error for notification {notification_id}: {e}")
        # Re-raise to trigger Celery retry mechanism
        raise e


@celery_app.task(name='notifications.create_notification')
def create_notification(notification_data: Dict[str, Any]) -> str:
    """
    Create a notification in the database asynchronously and trigger WebSocket delivery.
    
    Args:
        notification_data: Dictionary containing notification fields
        
    Returns:
        str: The ID of the created notification
    """
    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.core.config import settings
        from app.src.notifications.models import Notification
        
        # Setup sync DB connection
        db_url = cast(str, settings.DATABASE_URL)
        engine = create_engine(
            db_url.replace('+asyncpg', '+psycopg'),
            pool_pre_ping=True
        )
        Session = sessionmaker(bind=engine)
        session = Session()
        
        try:
            # Create and save notification
            notification = Notification(**notification_data)
            session.add(notification)
            session.commit()
            session.refresh(notification)
            
            notification_id = str(notification.id)

            logger.info(
                f"✅ Notification created: {notification_id}",
                extra={
                    'notification_id': notification_id,
                    'user_id': str(notification.user_id),
                    'type': notification_data.get('notification_type_id')
                }
            )

            # Trigger the WebSocket task (Chained)
            # We use a small countdown to ensure the transaction is fully committed
            # and visible to the next task (avoid race conditions).
            
            # FIX: Cast function to CeleryTask to access apply_async method safely (Pylance check)
            task = cast(CeleryTask, send_websocket_notification)
            task.apply_async(
                args=[notification_id],
                countdown=1 
            )
            
            return notification_id
            
        finally:
            session.close()
            engine.dispose()
            
    except Exception as e:
        logger.error(
            f"❌ Error creating notification: {e}",
            exc_info=True,
            extra={'notification_data': notification_data}
        )
        raise e


@celery_app.task(name='notifications.test_task')
def test_celery_task(message: str) -> str:
    """
    Simple test task to verify that Celery is working.

    Usage:
        from app.tasks.notifications import test_celery_task
        result = test_celery_task.delay("Hello Celery!")
        print(result.get())
    """
    logger.info(f"🧪 Test task received: {message}")
    return f"Processed: {message}"