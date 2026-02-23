# backend/app/src/reports/service.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.core.error_codes import ErrorCode
from app.core.config import settings
from app.src.reports.models import Report, ReportComment, ReportEvent, ReportEventType
from app.src.reports.repository import ReportRepository
from app.src.reports.schemas import ReportCreate, ReportCreateRequest, ReportCommentCreate
from app.src.reports.models import ReportStatus
from app.src.users.models import User
from typing import Optional
from app.core.logging import get_logger

logger = get_logger(__name__)
from app.src.notifications.service import NotificationService
from app.src.websockets.connection_manager import ConnectionManager
from app.src.attachments.service import AttachmentService
from app.src.attachments.models import EntityType

class ReportService:
    def __init__(self, session: AsyncSession, connection_manager: Optional[ConnectionManager] = None):
        self.repository = ReportRepository(session)
        self.notification_service = NotificationService(session, connection_manager)

    async def create_report(
        self,
        report_data: ReportCreateRequest,
        program_id: uuid.UUID,
        hacker: User
    ) -> Report:
        """
        Processes the logic for creating a new report.
        Assigns the program_id and hacker_id from the authenticated user.
        Validates and associates assets.
        """
        # Block temp users from submitting more than one report
        if hacker.is_temporary:
            existing_count = await self.repository.count_reports_by_hacker(hacker.id)
            if existing_count >= 1:
                raise ForbiddenException(detail={
                    "code": ErrorCode.GUEST_REPORT_LIMIT,
                    "message": "Guest accounts can only submit one report"
                })

        # Validate that provided asset_ids belong to the program
        if report_data.asset_ids:
            valid_assets = await self.repository.get_program_assets(program_id)
            valid_asset_ids = {asset.id for asset in valid_assets}
            invalid_ids = set(report_data.asset_ids) - valid_asset_ids
            if invalid_ids:
                raise NotFoundException(detail={
                    "code": ErrorCode.INVALID_ASSET_IDS,
                    "message": f"Invalid asset IDs: {list(invalid_ids)}",
                    "params": {"invalid_ids": list(invalid_ids)}
                })

        # Combine request data with required IDs (exclude asset_ids as it's handled separately)
        report_dict = report_data.model_dump()
        asset_ids = report_dict.pop('asset_ids', [])
        full_report_data = ReportCreate(
            program_id=program_id,
            hacker_id=hacker.id,
            **report_dict
        )

        # Call repository to save to database
        new_report = await self.repository.create(full_report_data, asset_ids)

        # Create report creation event
        await self.repository.create_event(
            report_id=new_report.id,
            event_type=ReportEventType.report_created,
            user_id=hacker.id
        )

        return new_report
    
    async def submit_report_full_flow(
        self,
        report_data: ReportCreateRequest,
        program_id: uuid.UUID,
        hacker: User,
        files: list[UploadFile] | None = None
    ) -> Report:
        """
        Orchestrates the full flow of submitting a report:
        1. Create report record
        2. Upload and link attachments
        3. Commit transaction
        4. Send notifications
        """
        # Validate file count
        if files and len(files) > settings.MAX_FILES_PER_UPLOAD:
            raise BadRequestException(detail={
                "code": ErrorCode.MAX_FILES_EXCEEDED,
                "message": f"A maximum of {settings.MAX_FILES_PER_UPLOAD} files can be uploaded per report.",
                "params": {"max": settings.MAX_FILES_PER_UPLOAD}
            })

        # 1. Create the Report (flushed, not committed)
        new_report = await self.create_report(
            report_data=report_data,
            program_id=program_id,
            hacker=hacker
        )

        # 2. Upload and attach files (if any provided)
        if files:
            attachment_service = AttachmentService(self.repository.session)
            await attachment_service.upload_multiple_attachments(
                entity_type=EntityType.REPORT,
                entity_id=new_report.id,
                uploader=hacker,
                files=files
            )

        # 3. Final Commit (only if everything succeeded)
        await self.repository.session.commit()

        # 4. Refresh to get full data (including generated IDs/timestamps)
        # We need to re-fetch to ensure we have the fresh state for notifications/response
        # Using repository.get_by_id which is cleaner than refresh() for complex relationships sometimes.
        # This fixes "MissingGreenlet" errors because get_by_id eagerly loads everything.
        new_report = await self.repository.get_by_id(new_report.id)
        if not new_report:
            raise NotFoundException(detail={"code": ErrorCode.REPORT_NOT_FOUND, "message": "Report created but not found."})
        
        # 5. Send notifications (after commit)
        try:
            await self.send_report_creation_notifications(new_report, hacker)
        except Exception as e:
            # We log but don't fail the request since the report is already saved
            from app.core.logging import get_logger
            logger = get_logger(__name__)
            logger.error(f"Report created but failed to send notification: {e}")

        return new_report
    
    async def send_report_creation_notifications(self, report: Report, hacker: User):
        """
        Sends notifications regarding report creation.
        MUST be called after the transaction is successfully committed.
        """
        program_org_id = report.program.organization_id

        await self.notification_service.create_report_created_notification(
            report_id=report.id,
            hacker=hacker,
            program_organization_id=program_org_id,
            use_celery=True
        )

    async def get_report_by_id(self, report_id: uuid.UUID) -> Report:
        """Gets a report by its ID, raising an exception if not found."""
        report = await self.repository.get_by_id(report_id)
        if not report:
            raise NotFoundException(detail={
                "code": ErrorCode.REPORT_NOT_FOUND,
                "message": "Report not found"
            })
        return report

    async def get_reports_by_program_paginated(self, program_id: uuid.UUID, skip: int, limit: int) -> tuple[list[Report], int]:
        """Gets paginated reports for a specific program."""
        return await self.repository.list_by_program_paginated(program_id, skip, limit)

    async def get_my_reports_summaries_by_hacker(self, hacker_id: uuid.UUID) -> list[dict]:
        """Gets my reports summaries for a specific hacker (minimal data for my reports)."""
        return await self.repository.list_my_reports_summaries_by_hacker(hacker_id)

    async def update_report_status(self, report_id: uuid.UUID, status: ReportStatus, user: User) -> Report:
        """Updates only the status of a report."""
        # Get current report to capture old value
        current_report = await self.get_report_by_id(report_id)
        old_status = current_report.status.value

        report = await self.repository.update(report_id, {"status": status})
        if not report:
            raise NotFoundException(detail={
                "code": ErrorCode.REPORT_NOT_FOUND,
                "message": "Report not found"
            })
            
        # Update user stats for leaderboard
        from app.src.users.service import UserService
        await UserService(self.repository.session).update_stats_for_report_change(
            user_id=report.hacker_id,
            old_status=old_status,
            new_status=status.value,
            old_severity=float(current_report.severity),
            new_severity=float(current_report.severity)  # severity hasn't changed
        )

        # Create status change event
        await self.repository.create_event(
            report_id=report_id,
            event_type=ReportEventType.status_change,
            user_id=user.id,
            old_value=old_status,
            new_value=status.value
        )

        await self.repository.session.commit()

        # Create notification for status change - notify hacker
        await self.notification_service.create_status_change_notification(
            report_id=report_id,
            old_status=old_status,
            new_status=status.value,
            hacker=report.hacker,
            use_celery=True  # Send asynchronously
        )

        # Notify organization members about status change
        await self._notify_organization_members_on_status_change(report, old_status, status.value, user, use_celery=True)

        # Deactivate guest account on terminal status
        TERMINAL_STATUSES = {ReportStatus.resolved, ReportStatus.rejected,
                             ReportStatus.duplicate, ReportStatus.out_of_scope}
        if status in TERMINAL_STATUSES and report.hacker and report.hacker.is_temporary:
            report.hacker.is_active = False
            await self.repository.session.commit()
            logger.info(f"🔒 Deactivated guest account {report.hacker.id} — report {report_id} reached terminal status '{status.value}'")

        return report

    async def update_report_severity(self, report_id: uuid.UUID, severity: float, user: User) -> Report:
        """Updates only the severity of a report."""
        # Get current report to capture old value
        current_report = await self.get_report_by_id(report_id)
        old_severity = str(current_report.severity)

        report = await self.repository.update(report_id, {"severity": severity})
        if not report:
            raise NotFoundException(detail={
                "code": ErrorCode.REPORT_NOT_FOUND,
                "message": "Report not found"
            })
            
        # Update user stats for leaderboard
        from app.src.users.service import UserService
        await UserService(self.repository.session).update_stats_for_report_change(
            user_id=report.hacker_id,
            old_status=current_report.status.value,  # status hasn't changed
            new_status=current_report.status.value,
            old_severity=float(old_severity),
            new_severity=float(severity)
        )

        # Create severity change event
        await self.repository.create_event(
            report_id=report_id,
            event_type=ReportEventType.severity_change,
            user_id=user.id,
            old_value=old_severity,
            new_value=str(severity)
        )

        await self.repository.session.commit()

        # Create notification for severity change - notify hacker
        await self.notification_service.create_severity_change_notification(
            report_id=report_id,
            old_severity=str(old_severity),
            new_severity=str(severity),
            hacker=report.hacker,
            use_celery=True  # Send asynchronously
        )

        # Notify organization members about severity change
        await self._notify_organization_members_on_severity_change(report, float(old_severity), severity, user, use_celery=True)

        return report

    async def add_comment_to_report(
        self,
        report_id: uuid.UUID,
        comment_data: ReportCommentCreate,
        author: User
    ) -> ReportComment:
        """
        Processes the logic for adding a comment to a report.
        Verifies that the report exists before adding the comment.
        """
        # First, ensure the report exists
        report = await self.get_report_by_id(report_id)

        if report.program.deleted_at:
            raise BadRequestException(detail={
                "code": ErrorCode.CANNOT_EDIT_DELETED_PROGRAM,
                "message": "Cannot add comments to a report belonging to a deleted program."
            })

        # Call repository to add the comment (Ahora el repo usa flush, no cierra la transacción)
        new_comment = await self.repository.add_comment(
            report_id=report_id,
            user_id=author.id,
            comment_data=comment_data
        )

        # Create comment event
        await self.repository.create_event(
            report_id=report_id,
            event_type=ReportEventType.comment,
            user_id=author.id,
            comment_id=new_comment.id
        )

        return new_comment

    async def create_comment_with_attachments(
        self,
        report_id: uuid.UUID,
        content: str,
        files: list[UploadFile],
        author: User
    ) -> ReportComment:
        """
        Orchestrates the creation of a comment, including file uploads and notifications.
        Handles the transaction commit.
        """
        # Validate file count
        if files and len(files) > settings.MAX_FILES_PER_UPLOAD:
            raise BadRequestException(detail={
                "code": ErrorCode.MAX_FILES_EXCEEDED,
                "message": f"A maximum of {settings.MAX_FILES_PER_UPLOAD} files can be uploaded per comment.",
                "params": {"max": settings.MAX_FILES_PER_UPLOAD}
            })

        comment_data = ReportCommentCreate(content=content)

        # 1. Create the comment
        comment = await self.add_comment_to_report(
            report_id=report_id,
            comment_data=comment_data,
            author=author
        )

        # 2. Upload attachments
        if files:
            attachment_service = AttachmentService(self.repository.session)
            await attachment_service.upload_multiple_attachments(
                entity_type=EntityType.REPORT_COMMENT,
                entity_id=comment.id,
                uploader=author,
                files=files
            )
        
        # 3. COMMIT CHANGES
        await self.repository.session.commit()
        
        # 4. SEND NOTIFICATIONS
        await self.send_comment_notifications(report_id, author)

        # 5. Refresh and return
        await self.repository.session.refresh(comment)
        return comment

    async def send_comment_notifications(
        self,
        report_id: uuid.UUID,
        author: User
    ):
        """
        Sends notifications for a newly created comment.
        Should be called ONLY after the transaction is successfully committed.
        """
        # Get the report to access its details
        report = await self.get_report_by_id(report_id)
        
        commenter_name = author.email
        if author.details and author.details.username:
            commenter_name = author.details.username

        # Create notifications for comment
        # Notify the report hacker (if they're not the commenter)
        if report.hacker_id != author.id:
            await self.notification_service.create_comment_notification(
                report_id=report_id,
                commenter_name=commenter_name,
                report_title=report.title,
                recipient=report.hacker,
                recipient_role="hacker",
                use_celery=True  # Send asynchronously
            )

        # Notify organization members who have access to this report
        await self._notify_organization_members_on_comment(report, author, use_celery=True)

    async def get_report_comments(self, report_id: uuid.UUID, user: User | None = None) -> list[ReportComment]:
        """Gets all comments for a report."""
        # If user is provided, check permissions (for backward compatibility)
        if user:
            report = await self.get_report_by_id(report_id)
            await self._check_comment_access(report, user)
        else:
            # Assume authorization is handled at route level
            await self.get_report_by_id(report_id)
        return await self.repository.list_comments_by_report(report_id)

    async def _check_comment_access(self, report: Report, user: User) -> None:
        """Checks if user has access to comments on this report."""
        # User is the hacker who submitted the report
        if report.hacker_id == user.id:
            return

        # User is a member of the organization that owns the program
        program_org_id = report.program.organization_id
        user_org_ids = {org.id for org in user.organizations}
        if program_org_id in user_org_ids:
            return

        raise ForbiddenException(detail={
            "code": ErrorCode.FORBIDDEN,
            "message": "You don't have permission to access comments on this report"
        })

    async def _notify_organization_members_on_comment(self, report: Report, commenter: User, use_celery: bool = True) -> None:
        """Notify organization members about a new comment on a report."""
        from sqlalchemy import select

        # Get all organization members using direct query
        stmt = select(User).where(
            User.organizations.any(id=report.program.organization_id)
        )
        result = await self.repository.session.execute(stmt)
        members = result.scalars().unique().all()

        commenter_name = commenter.email
        if commenter.details and commenter.details.username:
            commenter_name = commenter.details.username

        # Create notifications for each member (except the commenter)
        for member in members:
            if member.id == commenter.id:
                continue  # Don't notify the commenter

            if not member.details or not member.details.in_app_notifications_enabled:
                continue

            await self.notification_service.create_comment_notification(
                report_id=report.id,
                commenter_name=commenter_name,
                report_title=report.title,
                recipient=member,
                use_celery=True  # Send asynchronously
            )

    async def _notify_organization_members_on_status_change(self, report: Report, old_status: str, new_status: str, updater: User, use_celery: bool = True) -> None:
        """Notify organization members about a status change on a report."""
        from sqlalchemy import select

        # Get all organization members using direct query
        stmt = select(User).where(
            User.organizations.any(id=report.program.organization_id)
        )
        result = await self.repository.session.execute(stmt)
        members = result.scalars().unique().all()

        # Create notifications for each member (except the updater)
        for member in members:
            if member.id == updater.id:
                continue  # Don't notify the updater

            if not member.details or not member.details.in_app_notifications_enabled:
                continue

            await self.notification_service.create_status_change_notification_for_org_member(
                report_id=report.id,
                old_status=old_status,
                new_status=new_status,
                report_title=report.title,
                recipient=member,
                updater=updater,
                use_celery=True  # Send asynchronously
            )

    async def _notify_organization_members_on_severity_change(self, report: Report, old_severity: float, new_severity: float, updater: User, use_celery: bool = True) -> None:
        """Notify organization members about a severity change on a report."""
        from sqlalchemy import select

        # Get all organization members using direct query
        stmt = select(User).where(
            User.organizations.any(id=report.program.organization_id)
        )
        result = await self.repository.session.execute(stmt)
        members = result.scalars().unique().all()

        # Create notifications for each member (except the updater)
        for member in members:
            if member.id == updater.id:
                continue  # Don't notify the updater

            if not member.details or not member.details.in_app_notifications_enabled:
                continue

            await self.notification_service.create_severity_change_notification_for_org_member(
                report_id=report.id,
                old_severity=str(old_severity),
                new_severity=str(new_severity),
                report_title=report.title,
                recipient=member,
                updater=updater,
                use_celery=True  # Send asynchronously
            )

    async def get_report_history(self, report_id: uuid.UUID, user: User) -> list[ReportEvent]:
        """Gets the chronological history of a report (events + comments)."""
        # Check permissions
        report = await self.get_report_by_id(report_id)
        await self._check_comment_access(report, user)

        # Get all events for the report
        return await self.repository.list_events_by_report(report_id)

    async def update_comment(self, comment_id: uuid.UUID, update_data: dict, user: User) -> ReportComment:
        """Updates a comment with the provided data."""
        # Get the comment to check permissions
        comment = await self.repository.get_comment_by_id(comment_id)
        if not comment:
            raise NotFoundException(detail={
                "code": ErrorCode.COMMENT_NOT_FOUND,
                "message": "Comment not found"
            })
        
        report = await self.get_report_by_id(comment.report_id)
        if report.program.deleted_at:
             raise BadRequestException(detail={
                 "code": ErrorCode.CANNOT_EDIT_DELETED_PROGRAM,
                 "message": "Cannot edit comments on a report belonging to a deleted program."
             })

        # Check if user can update this comment (only the author can update their own comments)
        if comment.user_id != user.id:
            raise ForbiddenException(detail={
                "code": ErrorCode.NOT_YOUR_COMMENT,
                "message": "You can only update your own comments"
            })

        # Update the comment
        updated_comment = await self.repository.update_comment(comment_id, update_data)
        if not updated_comment:
            raise NotFoundException(detail={
                "code": ErrorCode.COMMENT_NOT_FOUND,
                "message": "Comment not found"
            })

        return updated_comment
