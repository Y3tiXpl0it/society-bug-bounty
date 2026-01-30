# backend/app/src/reports/routes.py
import uuid
from fastapi import APIRouter, Depends, Form, File, UploadFile, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes
from app.core.config import settings
from app.core.database import get_session
from app.core.dependencies import get_current_active_user, get_authorized_report, can_update_report_status, can_update_own_report_details, can_update_own_comment, get_connection_manager
from app.core.exceptions import NotFoundException, BadRequestException
from app.src.users.models import User
from app.src.reports.service import ReportService
from app.src.reports.schemas import ReportResponse, ReportCommentResponse, ReportCommentCreate, ReportStatusUpdate, ReportSeverityUpdate, ReportEventResponse
from app.src.reports.models import Report, ReportEventType
from app.src.attachments.models import EntityType
from app.src.attachments.schemas import AttachmentResponse
from app.src.attachments.service import AttachmentService
from fastapi.responses import FileResponse

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/me", response_model=list[dict])
async def get_my_reports(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """(Hacker Only) Gets a list of report summaries submitted by the current user."""
    service = ReportService(session)
    return await service.get_my_reports_summaries_by_hacker(hacker_id=current_user.id)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report_details(
    report_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """Gets the details of a specific report."""
    report, user = report_user

    # 1. Load attachments for the report
    attachment_service = AttachmentService(session)
    attachments_db = await attachment_service.get_attachments_by_entity(
        EntityType.REPORT, 
        report.id
    )

    # 2. Inyectar los adjuntos SIN activar la carga de SQLAlchemy
    # Esto le dice a SQLAlchemy: "Confía en mí, estos son los datos, no verifiques el estado anterior"
    attributes.set_committed_value(report, "attachments", attachments_db)

    # 3. Transform report model to schema
    # Ahora Pydantic leerá 'report.attachments' de memoria sin problemas
    response = ReportResponse.model_validate(report)

    return response


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report_details(
    report_id: uuid.UUID,
    update_data: dict,
    current_user: User = Depends(can_update_own_report_details),
    session: AsyncSession = Depends(get_session),
):
    """Updates report details (only the hacker who submitted the report)."""
    service = ReportService(session)
    # Update the report
    return await service.repository.update(report_id, update_data)


@router.patch("/{report_id}/status", response_model=ReportResponse)
async def update_report_status(
    report_id: uuid.UUID,
    status_data: ReportStatusUpdate,
    current_user: User = Depends(can_update_report_status),
    session: AsyncSession = Depends(get_session),
    connection_manager = Depends(get_connection_manager),
):
    """Updates the status of a report (organization members only)."""
    service = ReportService(session, connection_manager)
    return await service.update_report_status(report_id, status_data.status, current_user)


@router.get("/{report_id}/comments", response_model=list[ReportCommentResponse])
async def get_report_comments(
    report_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """Gets all comments for a report."""
    report, user = report_user
    service = ReportService(session)
    comments = await service.get_report_comments(report_id)

    # Load attachments for each comment
    attachment_service = AttachmentService(session)

    response_comments = []
    for comment in comments:
        attachments = await attachment_service.get_attachments_by_entity(EntityType.REPORT_COMMENT, comment.id)
        response_comments.append(ReportCommentResponse(
            id=comment.id,
            user_id=comment.user_id,
            content=comment.content,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            attachments=[AttachmentResponse.model_validate(att) for att in attachments]
        ))

    return response_comments


@router.post(
    "/{report_id}/comments",
    response_model=ReportCommentResponse,
)
async def add_comment_to_report(
    report_id: uuid.UUID,
    content: str = Form(...),
    files: list[UploadFile] = File(None),
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
    connection_manager = Depends(get_connection_manager),
):
    if files and len(files) > settings.MAX_FILES_PER_UPLOAD:
        raise BadRequestException(
            f"A maximum of {settings.MAX_FILES_PER_UPLOAD} files can be uploaded per comment."
        )
    
    """Adds a comment to a report's conversation."""
    report, current_user = report_user
    service = ReportService(session, connection_manager)
    
    # Import attachment service locally to avoid circular imports
    attachment_service = AttachmentService(session)

    comment_data = ReportCommentCreate(content=content)

    try:
        # 1. Create the comment
        comment = await service.add_comment_to_report(
            report_id=report_id,
            comment_data=comment_data,
            author=current_user
        )

        # 2. Upload attachments
        if files:
            await attachment_service.upload_multiple_attachments(
                entity_type=EntityType.REPORT_COMMENT,
                entity_id=comment.id,
                uploader=current_user,
                files=files
            )
        
        # 3. COMMIT CHANGES
        # If we reach here, the image is valid. Persist everything permanently.
        await session.commit()
        
        # 4. SEND NOTIFICATIONS
        # Only notify NOW that we are certain everything is saved.
        await service.send_comment_notifications(report_id, current_user)

    except Exception as e:
        # If something failed, the rollback already happened automatically in the 'async with' block.
        # Re-raise the error so the frontend receives the 400 Bad Request.
        raise e

    # 5. PREPARE RESPONSE
    # Refresh the comment and load attachments to return them to the frontend
    await session.refresh(comment)
    attachments = await attachment_service.get_attachments_by_entity(EntityType.REPORT_COMMENT, comment.id)

    return ReportCommentResponse(
        id=comment.id,
        user_id=comment.user_id,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        attachments=[AttachmentResponse.model_validate(att) for att in attachments]
    )


@router.patch("/{report_id}/comments/{comment_id}", response_model=ReportCommentResponse)
async def update_comment(
    report_id: uuid.UUID,
    comment_id: uuid.UUID,
    update_data: dict,
    current_user: User = Depends(can_update_own_comment),
    session: AsyncSession = Depends(get_session),
):
    """Updates a comment on a report (only the author can update their own comments)."""
    service = ReportService(session)
    updated_comment = await service.update_comment(comment_id, update_data, current_user)

    # Load attachments for the response
    attachment_service = AttachmentService(session)
    attachments = await attachment_service.get_attachments_by_entity(EntityType.REPORT_COMMENT, updated_comment.id)

    return ReportCommentResponse(
        id=updated_comment.id,
        user_id=updated_comment.user_id,
        content=updated_comment.content,
        created_at=updated_comment.created_at,
        updated_at=updated_comment.updated_at,
        attachments=[AttachmentResponse.model_validate(att) for att in attachments]
    )


@router.patch("/{report_id}/severity", response_model=ReportResponse)
async def update_report_severity(
    report_id: uuid.UUID,
    severity_data: ReportSeverityUpdate,
    current_user: User = Depends(can_update_report_status),
    session: AsyncSession = Depends(get_session),
    connection_manager = Depends(get_connection_manager),
):
    """Updates the severity of a report (organization members only)."""
    service = ReportService(session, connection_manager)
    return await service.update_report_severity(report_id, severity_data.severity, current_user)


@router.get("/{report_id}/attachments", response_model=list[AttachmentResponse])
async def get_report_attachments(
    report_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """
    Get all attachments for a specific report.
    Requires authentication and authorization (hacker or org member).
    """
    report, user = report_user
    service = AttachmentService(session)
    return await service.get_attachments_by_entity(EntityType.REPORT, report_id)


@router.get("/{report_id}/comments/{comment_id}/attachments", response_model=list[AttachmentResponse])
async def get_comment_attachments(
    report_id: uuid.UUID,
    comment_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """
    Get all attachments for a specific comment.
    Requires authentication and authorization (hacker or org member).
    """
    report, user = report_user
    service = AttachmentService(session)
    return await service.get_attachments_by_entity(EntityType.REPORT_COMMENT, comment_id)


@router.get("/{report_id}/attachments/{attachment_id}/download")
async def download_report_attachment(
    request: Request,
    report_id: uuid.UUID,
    attachment_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """
    Download a specific attachment file for a report.

    Requires authentication and authorization (hacker or org member), and that the attachment belongs to the report.
    """
    # Log request details for debugging
    import logging
    logger = logging.getLogger(__name__)
    auth_header = request.headers.get("authorization")
    logger.info(f"Download request for report {report_id}, attachment {attachment_id}")
    logger.info(f"Auth header present: {bool(auth_header)}")
    if auth_header:
        logger.info(f"Auth header starts with: {auth_header[:20]}...")
    else:
        logger.warning("No auth header in download request - likely direct browser fetch")

    report, user = report_user

    service = AttachmentService(session)
    attachment = await service.get_attachment_by_id(attachment_id)
    if not attachment or attachment.entity_type != EntityType.REPORT or attachment.entity_id != report_id:
        raise NotFoundException("Attachment not found")

    return FileResponse(
        attachment.file_path,
        media_type=attachment.mime_type,
        filename=attachment.file_name,
        headers={"Content-Disposition": f'attachment; filename="{attachment.file_name}"'}
    )


@router.get("/{report_id}/comments/{comment_id}/attachments/{attachment_id}/download")
async def download_comment_attachment(
    request: Request,
    report_id: uuid.UUID,
    comment_id: uuid.UUID,
    attachment_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """
    Download a specific attachment file for a comment.

    Requires authentication and authorization (hacker or org member), and that the attachment belongs to the comment.
    """
    # Log request details for debugging
    import logging
    logger = logging.getLogger(__name__)
    auth_header = request.headers.get("authorization")
    logger.info(f"Download request for report {report_id}, comment {comment_id}, attachment {attachment_id}")
    logger.info(f"Auth header present: {bool(auth_header)}")
    if auth_header:
        logger.info(f"Auth header starts with: {auth_header[:20]}...")
    else:
        logger.warning("No auth header in download request - likely direct browser fetch")

    report, user = report_user

    service = AttachmentService(session)
    attachment = await service.get_attachment_by_id(attachment_id)
    if not attachment or attachment.entity_type != EntityType.REPORT_COMMENT or attachment.entity_id != comment_id:
        raise NotFoundException("Attachment not found")

    return FileResponse(
        attachment.file_path,
        media_type=attachment.mime_type,
        filename=attachment.file_name,
        headers={"Content-Disposition": f'attachment; filename="{attachment.file_name}"'}
    )


@router.get("/{report_id}/history", response_model=list[ReportEventResponse])
async def get_report_history(
    report_id: uuid.UUID,
    report_user: tuple[Report, User] = Depends(get_authorized_report),
    session: AsyncSession = Depends(get_session),
):
    """Gets the chronological history of a report (creation, status/severity changes, comments)."""
    report, current_user = report_user
    service = ReportService(session)
    events = await service.get_report_history(report_id, current_user)
    attachment_service = AttachmentService(session)

    # Transform events to include user_name and handle comment events
    response_events = []
    for event in events:
        event_dict = {
            "id": event.id,
            "event_type": event.event_type,
            "old_value": event.old_value,
            "new_value": event.new_value,
            "created_at": event.created_at,
            "user_name": event.user.details.username if event.user else None,
            "user_avatar_url": event.user.details.avatar_url if event.user and event.user.details else None,
            "comment": None,
            "attachments": [] 
        }

        # Comment event handling
        if event.event_type == ReportEventType.comment and event.comment:
            comment_attachments = await attachment_service.get_attachments_by_entity(EntityType.REPORT_COMMENT, event.comment.id)
            
            event_dict["comment"] = ReportCommentResponse(
                id=event.comment.id,
                user_id=event.comment.user_id,
                content=event.comment.content,
                created_at=event.comment.created_at,
                updated_at=event.comment.updated_at,
                attachments=[AttachmentResponse.model_validate(att) for att in comment_attachments]
            )

        # Report creation event handling to include report attachments
        if event.event_type == ReportEventType.report_created:
            report_attachments = await attachment_service.get_attachments_by_entity(EntityType.REPORT, event.report_id)
            
            event_dict["attachments"] = [
                AttachmentResponse.model_validate(att) for att in report_attachments
            ]

        response_events.append(ReportEventResponse(**event_dict))

    return response_events
