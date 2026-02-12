import uuid
import logging
from typing import List, Optional, Union, Dict, cast

from sqlalchemy.ext.asyncio import AsyncSession
from celery.app.task import Task as CeleryTask

from app.src.notifications.models import Notification, NotificationTypeEnum
from app.src.notifications.repository import NotificationRepository
from app.src.notifications.schemas import NotificationCreate
from app.src.users.models import User
from app.src.websockets.connection_manager import ConnectionManager
from app.src.notifications.models import NotificationRoleEnum
from app.core.exceptions import NotFoundException
from app.core.error_codes import ErrorCode



class NotificationService:
    def __init__(self, session: AsyncSession, connection_manager: Optional[ConnectionManager] = None):
        self.repository = session
        self.notification_repo = NotificationRepository(session)
        self.connection_manager = connection_manager

    async def create_notification(
        self,
        notification_data: NotificationCreate,
        send_email: bool = True,
        broadcast_ws: bool = True,
        use_celery: bool = True
    ) -> Union[Notification, Dict[str, str]]:
        """
        Core method to create notification.
        Handles the switch between Celery (Async) and Direct (Sync).
        """
        # 1. ASYNC MODE (Celery)
        if use_celery:
            from app.tasks.notifications import create_notification as create_notification_task

            # Convert Pydantic schema to a simple dictionary (JSON)
            data_dict = notification_data.model_dump()

            # Pre-generate ID to coordinate with Email Smart Check
            # This allows us to pass the ID to the email task so it can check if the notification was read.
            notification_id = uuid.uuid4()
            data_dict['id'] = str(notification_id)

            # Convert UUIDs to strings so JSON doesn't fail
            data_dict['user_id'] = str(data_dict['user_id'])
            if data_dict.get('related_entity_id'):
                data_dict['related_entity_id'] = str(data_dict['related_entity_id'])

            # Resolve notification type
            type_id = await self.notification_repo.get_notification_type_id(notification_data.notification_type)
            if not type_id:
                type_id = 1

            # Prepare final payload for Celery
            del data_dict['notification_type']
            data_dict['notification_type_id'] = type_id

            # Send the task
            task = cast(CeleryTask, create_notification_task)
            task.delay(data_dict)

            # --- EMAIL NOTIFICATION INTEGRATION ---
            # --- EMAIL NOTIFICATION INTEGRATION ---
            if send_email:
                # Dispatch to background task which handles fetching and checking preferences
                await self._dispatch_email_notification(
                    notification_data.user_id,
                    notification_data.title,
                    notification_data.message,
                    notification_data.notification_type,
                    notification_id=notification_id
                )

            return {"status": "queued", "message": "Notification creation queued"}

        # 2. SYNC MODE (Direct to DB)
        else:
            type_id = await self.notification_repo.get_notification_type_id(notification_data.notification_type)
            if not type_id:
                type_id = 1

            new_notification = Notification(
                user_id=notification_data.user_id,
                notification_type_id=type_id,
                title=notification_data.title,
                message=notification_data.message,
                recipient_role=notification_data.recipient_role,
                related_entity_id=notification_data.related_entity_id
            )

            created_notification = await self.notification_repo.create(new_notification)

            if broadcast_ws and self.connection_manager:
                await self._broadcast_websocket_notification(created_notification)

            return created_notification

    async def get_user_notifications(self, user_id: uuid.UUID, skip: int = 0, limit: int = 20) -> List[Notification]:
        return await self.notification_repo.get_by_user(user_id, skip, limit)

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        return await self.notification_repo.get_unread_count(user_id)
        
    async def get_notification_count(self, user_id: uuid.UUID) -> int:
        # Placeholder compatible with your previous code
        return await self.get_unread_count(user_id)

    async def mark_notification_as_read(self, notification_id: uuid.UUID) -> None:
        success = await self.notification_repo.mark_as_read(notification_id)
        if not success:
            raise NotFoundException(detail={
                "code": ErrorCode.NOT_FOUND,
                "message": "Notification not found"
            })

    async def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        return await self.notification_repo.mark_all_as_read(user_id)

    async def mark_notifications_as_read_by_entity(self, user_id: uuid.UUID, related_entity_id: uuid.UUID) -> int:
        return await self.notification_repo.mark_all_as_read_by_entity(user_id, related_entity_id)

    # =========================================================================
    #  HELPER METHODS (Business logic and recipients are defined here)
    # =========================================================================

    async def _dispatch_email_notification(
        self, 
        user_id: uuid.UUID, 
        title: str, 
        message: str, 
        type_enum: NotificationTypeEnum,
        notification_id: Optional[Union[uuid.UUID, str]] = None
    ):
        """
        Helper to enqueue email task.
        User fetching and preference checking is now handled in the background task.
        """
        from app.tasks.notifications import process_and_send_email_task
        from app.core.config import settings
        
        logger = logging.getLogger(__name__)
        
        # Dispatch the specialized task
        # We pass the user_id and the email content.
        # The task will handle fetching the user, checking preferences, and sending the email.
        
        email_data = {
            "subject": title,
            "template_name": "notification.html",
            "template_body": {
                "title": title,
                "message": message
                # "action_url": "..." 
            }
        }
        
        # Priority / Delay logic
        delay = 0
        if type_enum == NotificationTypeEnum.comment_added:
            delay = settings.NOTIFICATIONS_EMAIL_DELAY_SECONDS
            
        try:
            task = cast(CeleryTask, process_and_send_email_task)
            
            # If delayed, we log it differently
            if delay > 0:
                logger.info(f"📧 Enqueuing DELAYED email task for user {user_id} (Delay: {delay}s)")
            else:
                logger.info(f"📧 Enqueuing email processing task for user {user_id}")
                
            task.apply_async(
                args=[str(user_id), email_data],
                kwargs={"notification_id": str(notification_id) if notification_id else None},
                countdown=delay
            )
        except Exception as e:
            logger.error(f"❌ Failed to enqueue email processing task: {e}")


    async def create_comment_notification(
        self,
        report_id: uuid.UUID,
        commenter_name: str, # Receive string to avoid serializing User
        report_title: str,
        recipient: User,     # Receive User object (as reports/service.py does)
        recipient_role: Optional[Union[NotificationRoleEnum, str]] = None,
        use_celery: bool = True
    ) -> Optional[Union[Notification, Dict]]:

        # 1. Preferences Validation (Using User object before serializing)
        if not recipient.details or not recipient.details.in_app_notifications_enabled:
            return None

        # 2. Role Determination
        final_role: NotificationRoleEnum

        if recipient_role is not None:
            # If the role is explicitly passed, we respect it
            if isinstance(recipient_role, str):
                final_role = NotificationRoleEnum(recipient_role)
            else:
                final_role = recipient_role
        else:
            # Automatic Detection: Inspect the recipient user
            # We assume that if they have 'organization_id', they are an org member.
            # If not (it's None), we assume they are an external Hacker/Researcher.
            from sqlalchemy import select

            # Check if the user is associated with any organization
            stmt = select(1).where(User.id == recipient.id, User.organizations.any())
            result = await self.repository.execute(stmt)
            is_org_member = result.scalar() is not None
            
            # Note: Ensure your User model has the organization_id attribute loaded
            if is_org_member:
                final_role = NotificationRoleEnum.ORG_MEMBER
            elif getattr(recipient, "is_superuser", False):
                 # Optional: If the user is a superuser/admin
                final_role = NotificationRoleEnum.ADMIN
            else:
                final_role = NotificationRoleEnum.HACKER

        # 3. Payload Construction (HERE we define the recipient for Celery)
        title = "New Comment on Your Report"
        message = f"{commenter_name} commented on report '{report_title}'."

        data = NotificationCreate(
            user_id=recipient.id,
            title=title,
            message=message,
            notification_type=NotificationTypeEnum.comment_added.value,
            recipient_role=final_role,
            related_entity_id=report_id
        )
        
        return await self.create_notification(data, use_celery=use_celery)

    async def create_report_created_notification(
        self,
        report_id: uuid.UUID,
        hacker: User,
        program_organization_id: uuid.UUID,
        use_celery: bool = True
    ) -> None:
        """Logic to notify org members when a report is created."""
        from sqlalchemy import select

        # Get organization members
        stmt = select(User).where(User.organizations.any(id=program_organization_id))
        result = await self.repository.execute(stmt)
        members = result.scalars().unique().all()

        for member in members:
            if member.id == hacker.id:
                continue

            # Validate preferences
            if hasattr(member, 'details') and member.details and not member.details.in_app_notifications_enabled:
                continue

            # Create notification
            data = NotificationCreate(
                user_id=member.id, # <--- Recipient
                title="New Report Submitted",
                message="A new report has been submitted to your organization.",
                notification_type=NotificationTypeEnum.report_created.value,
                recipient_role=NotificationRoleEnum.ORG_MEMBER,
                related_entity_id=report_id
            )
            # We don't use await in the loop if celery to avoid blocking,
            # but here we call the method that already handles dispatch.
            await self.create_notification(data, use_celery=use_celery)

    async def create_status_change_notification(
        self,
        report_id: uuid.UUID,
        old_status: str,
        new_status: str,
        hacker: User, # Receive User
        use_celery: bool = True
    ) -> Optional[Union[Notification, Dict]]:

        if not hacker.details or not hacker.details.in_app_notifications_enabled:
            return None

        data = NotificationCreate(
            user_id=hacker.id,
            title="Report Status Updated",
            message=f"{old_status}|{new_status}",
            notification_type=NotificationTypeEnum.status_changed.value,
            recipient_role=NotificationRoleEnum.HACKER,
            related_entity_id=report_id
        )
        return await self.create_notification(data, use_celery=use_celery)

    async def create_status_change_notification_for_org_member(
        self,
        report_id: uuid.UUID,
        old_status: str,
        new_status: str,
        report_title: str,
        recipient: User, # Receive User
        updater: User,   # Receive User (only for logic, not stored)
        use_celery: bool = True
    ) -> Optional[Union[Notification, Dict]]:

        if not recipient.details or not recipient.details.in_app_notifications_enabled:
            return None

        data = NotificationCreate(
            user_id=recipient.id,
            title="Report Status Updated",
            message=f"{old_status}|{new_status}",
            notification_type=NotificationTypeEnum.status_changed.value,
            recipient_role=NotificationRoleEnum.ORG_MEMBER,
            related_entity_id=report_id
        )
        return await self.create_notification(data, use_celery=use_celery)

    async def create_severity_change_notification(
        self,
        report_id: uuid.UUID,
        old_severity: str,
        new_severity: str,
        hacker: User,
        use_celery: bool = True
    ) -> Optional[Union[Notification, Dict]]:

        if not hacker.details or not hacker.details.in_app_notifications_enabled:
            return None

        data = NotificationCreate(
            user_id=hacker.id,
            title="Report Severity Updated",
            message=f"{old_severity}|{new_severity}",
            notification_type=NotificationTypeEnum.severity_changed.value,
            recipient_role=NotificationRoleEnum.HACKER,
            related_entity_id=report_id
        )
        return await self.create_notification(data, use_celery=use_celery)

    # Alias for compatibility with calls expecting the _for_org_member method
    async def create_severity_change_notification_for_org_member(
        self,
        report_id: uuid.UUID,
        old_severity: str,
        new_severity: str,
        report_title: str,
        recipient: User,
        updater: User,
        use_celery: bool = True
    ):
        if not recipient.details or not recipient.details.in_app_notifications_enabled:
            return None
            
        data = NotificationCreate(
            user_id=recipient.id,
            title="Report Severity Updated",
            message=f"{old_severity}|{new_severity}",
            notification_type=NotificationTypeEnum.severity_changed.value,
            recipient_role=NotificationRoleEnum.ORG_MEMBER,
            related_entity_id=report_id
        )
        return await self.create_notification(data, use_celery=use_celery)

    async def _broadcast_websocket_notification(self, notification_obj: Notification) -> None:
        """Direct broadcast (only used in sync mode)."""
        if not self.connection_manager:
            return
        try:
            notification_data = {
                'id': str(notification_obj.id),
                'title': notification_obj.title,
                'message': notification_obj.message,
                'severity': getattr(notification_obj, 'severity', 'info'),
                'notification_type': notification_obj.notification_type.name if notification_obj.notification_type else 'general',
                'recipient_role': notification_obj.recipient_role,
                'related_entity_id': str(notification_obj.related_entity_id) if notification_obj.related_entity_id else None,
                'created_at': notification_obj.created_at.isoformat() + 'Z' if notification_obj.created_at else None
            }
            await self.connection_manager.broadcast_notification(str(notification_obj.user_id), notification_data)
        except Exception as e:
            print(f"Error broadcasting WS: {e}")
            pass