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
                title=type_name,
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
            logger.debug(f"📡 Broadcasting to room: {room}")
            
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


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 5},
    name='notifications.process_and_send_email'
)
def process_and_send_email_task(self, user_id: str, email_data: dict, notification_id: str | None = None):
    """
    Celery task to fetch user details and send email if preferences allow.
    
    Args:
        user_id: UUID string of the recipient user
        email_data: Dictionary containing:
            - subject: str
            - template_name: str
            - template_body: dict
        notification_id: Optional UUID string of the notification to check 'read' status.
                         If provided and notification is read, email is skipped (Smart Check).
    """
    try:
        from sqlalchemy import create_engine, select
        from sqlalchemy.orm import sessionmaker, joinedload
        from app.core.config import settings
        from app.src.users.models import User
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
            # 0. Smart Check (Notification Read Status)
            if notification_id:
                notif = session.get(Notification, notification_id)
                if notif and notif.is_read:
                    logger.debug(f"📧 Smart Check: Skipping email for user {user_id} (Notification {notification_id} already read)")
                    return

            # 1. Fetch User with preferences
            stmt = (
                select(User)
                .where(User.id == user_id)
                .options(joinedload(User.details))
            )
            user = session.execute(stmt).unique().scalar_one_or_none()
            
            if not user or not user.email:
                logger.warning(f"📧 Skipping email for user {user_id}: User not found or no email")
                return

            if user.is_temporary:
                logger.debug(f"📧 Skipping email for user {user_id}: User is temporary")
                return
            
            # 2. Check Preferences
            if user.details:
                if not user.details.email_notifications_enabled:
                    logger.debug(f"📧 Skipping email for user {user_id}: Email notifications disabled")
                    return
            else:
                # Default to True if no details found
                logger.debug(f"📧 User {user_id} has no details, proceeding with email (default True)")
                
            # 3. Send Email
            import asyncio
            import json
            from app.src.notifications.email import send_email
            from app.src.notifications.i18n import translate_for_email
            
            email_to = user.email
            
            # Extract raw data from the task payload
            payload_body = email_data.get('template_body', {})
            notif_type = payload_body.get('notification_type')
            message_raw = payload_body.get('message', '')
            
            # Parse JSON params
            params = {}
            if message_raw:
                try:
                    params = json.loads(message_raw)
                except Exception:
                    # Fallback for legacy plain text or malformed JSON
                    logger.warning(f"📧 Could not parse JSON message for user {user_id}. Using raw text.")
            
            # Determine language (Global default)
            lang = settings.VITE_DEFAULT_LANGUAGE
            
            # Perform translations using the new type-derived logic
            if notif_type:
                # Resolve subject/title from type
                final_subject = translate_for_email(notif_type, 'title', params=params, lang=lang)
                final_title = final_subject
                final_message = translate_for_email(notif_type, 'message', params=params, lang=lang)
            else:
                # Legacy fallback if type is missing
                final_subject = email_data.get('subject', 'Notification')
                final_title = payload_body.get('title', final_subject)
                final_message = message_raw
            
            # Update template body with translated strings
            final_template_body = {
                "title": final_title,
                "message": final_message
            }
            
            template_name = email_data.get('template_name', 'notification.html')
            
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            loop.run_until_complete(send_email(email_to, final_subject, template_name, final_template_body))
            logger.info(f"📧 Email processed and sent to {email_to} in language {lang}")
            
        finally:
            session.close()
            engine.dispose()
            
    except Exception as e:
        logger.error(f"❌ Failed to process email for user {user_id}: {e}")
        raise e