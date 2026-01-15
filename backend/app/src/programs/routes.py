# backend/app/src/programs/routes.py
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

# --- Core Application Imports ---
from app.core.config import settings
from app.core.database import get_session
from app.core.logging import get_logger
from app.core.exceptions import ForbiddenException, NotFoundException, BadRequestException 

# --- Security & Business Logic Imports ---
from app.core.dependencies import (
    organization_member_only,
    get_authorized_program_from_path,
    get_current_active_user,
    get_current_user_optional,
    get_connection_manager,
)
from app.src.users.models import User
from app.src.programs.models import Program
from app.src.programs.schemas import (
    PaginatedProgramResponse,
    ProgramBulkUpdate,
    ProgramCreate,
    ProgramDetail,
    ProgramSummary,
)
from app.src.programs.service import ProgramService
from app.src.organizations.repository import OrganizationRepository
from app.src.programs.repository import ProgramRepository
from app.src.reports.schemas import ReportCreateRequest, ReportResponse, ReportSummary, PaginatedReportSummaryResponse
from app.src.reports.service import ReportService
from app.src.attachments.service import AttachmentService
from app.src.attachments.models import EntityType
from app.src.attachments.schemas import AttachmentResponse
from fastapi import UploadFile, File, Form
import json

logger = get_logger(__name__)

# Create a new router for this feature, all routes will be prefixed with /programs.
router = APIRouter(prefix="/programs", tags=["programs"])

@router.get("/", response_model=PaginatedProgramResponse)
async def get_all_programs(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 10
):
    """
    (Public) Gets a list of all active bug bounty programs.
    This is used for the main public listing page.
    """
    service = ProgramService(session)
    programs_list, total_count = await service.get_all_programs(skip=skip, limit=limit)
    programs_summary_list = [ProgramSummary.model_validate(p) for p in programs_list]
    return PaginatedProgramResponse(total=total_count, programs=programs_summary_list)


@router.get("/me", response_model=list[ProgramSummary])
async def get_my_programs(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(organization_member_only),
):
    """(Organization Member Only) Gets a list of programs for all organizations the user belongs to."""
    all_programs = []
    service = ProgramService(session)
    # Iterate over the user's organizations to fetch the programs for each one.
    for org in current_user.organizations:
        org_programs = await service.get_programs_for_organization(org.id)
        all_programs.extend(org_programs)
    return all_programs


@router.post("/", response_model=ProgramDetail, status_code=status.HTTP_201_CREATED)
async def create_program(
    program_data: ProgramCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(organization_member_only),
):
    """(Organization Member Only) Creates a new program for a specific organization."""
    # Verify that the user is a member of the organization they are trying to create a program for.
    user_org_ids = {org.id for org in current_user.organizations}

    if program_data.organization_id not in user_org_ids:
        raise ForbiddenException("You are not a member of the specified organization.")

    return await ProgramService(session).create_program(program_data)


@router.get("/{organization_slug}/{program_slug}", response_model=ProgramDetail)
async def get_program_details(
    organization_slug: str,
    program_slug: str,
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(get_current_user_optional)
):
    """Gets the full details of a specific program."""
    org_repo = OrganizationRepository(session)
    organization = await org_repo.get_by_slug(organization_slug)
    if not organization:
        raise NotFoundException("Organization not found")

    program_repo = ProgramRepository(session)
    program = await program_repo.get_by_slug(program_slug, organization.id)
    if not program:
        raise NotFoundException("Program not found")

    if program.is_active:
        return program

    if not user:
        raise NotFoundException("Program not found")

    user_org_ids = {org.id for org in user.organizations}
    if organization.id not in user_org_ids:
        raise NotFoundException("Program not found")

    return program

@router.patch("/{organization_slug}/{program_slug}", response_model=ProgramDetail)
async def bulk_update_program(
    update_data: ProgramBulkUpdate,
    program: Program = Depends(get_authorized_program_from_path),
    session: AsyncSession = Depends(get_session),
):
    """(Owner Only) Updates a program's details, rewards, and assets."""
    service = ProgramService(session)
    return await service.bulk_update_program(program.id, update_data)


@router.delete("/{organization_slug}/{program_slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    program: Program = Depends(get_authorized_program_from_path),
    session: AsyncSession = Depends(get_session),
):
    """(Owner Only) Deletes a program by its name."""
    service = ProgramService(session)
    await service.delete_program(program.id)

@router.post(
    "/{organization_slug}/{program_slug}/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new report for a program",
)
async def submit_report_for_program(
    organization_slug: str,
    program_slug: str,
    title: str = Form(...),
    description: str = Form(...),
    severity: float = Form(...),
    asset_ids: str = Form(...),
    files: list[UploadFile] = File(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
    connection_manager = Depends(get_connection_manager),
):
    """
    Submit a new bug report for a specific program.

    This endpoint allows authenticated users to submit reports to active bug bounty programs.
    It handles form data including title, description, severity, asset IDs, and optional file attachments.
    The operation is wrapped in a transaction to ensure data consistency.
    """
    if files and len(files) > settings.MAX_FILES_PER_UPLOAD:
        raise BadRequestException(
            f"A maximum of {settings.MAX_FILES_PER_UPLOAD} files can be uploaded per comment."
        )

    # 1. Parse and validate input data
    # Parse the asset_ids JSON string into a list, defaulting to empty list if invalid
    try:
        asset_ids_list = json.loads(asset_ids)
    except json.JSONDecodeError:
        asset_ids_list = []

    # Create the report data object from form inputs
    report_data = ReportCreateRequest(
        title=title,
        description=description,
        severity=severity,
        asset_ids=asset_ids_list
    )

    # 2. Validate organization and program existence and permissions
    # Retrieve the organization by its slug
    org_repo = OrganizationRepository(session)
    organization = await org_repo.get_by_slug(organization_slug)
    if not organization:
        raise NotFoundException("Organization not found")

    # Retrieve the program by its slug within the organization
    program_repo = ProgramRepository(session)
    program = await program_repo.get_by_slug(program_slug, organization.id)
    if not program:
        raise NotFoundException("Program not found")

    # Ensure the program is active before allowing report submission
    if not program.is_active:
        raise ForbiddenException("Reports can only be submitted to active programs.")

    # 3. Execute the report submission transaction
    try:
        # A. Create the Report
        # Note: For rollback to work properly, create_report must NOT perform session.commit()
        report_service = ReportService(session, connection_manager)
        new_report = await report_service.create_report(
            report_data=report_data,
            program_id=program.id,
            hacker=current_user
        )

        # B. Upload and attach files (if any provided)
        if files:
            attachment_service = AttachmentService(session)
            await attachment_service.upload_multiple_attachments(
                entity_type=EntityType.REPORT,
                entity_id=new_report.id,
                uploader=current_user,
                files=files
            )

        # C. Final Commit (only if everything succeeded)
        await session.commit()

        new_report = await report_service.repository.get_by_id(new_report.id)

        # D. Send notifications (after commit)
        try:
            await report_service.send_report_creation_notifications(new_report, current_user)
        except Exception as e:
            logger.error(f"Report created but failed to send notification: {e}")

        return new_report

    except Exception as e:
        # If anything failed (file validation, DB error), rollback everything.
        # This removes the report from DB memory before it becomes permanent.
        await session.rollback()

        logger.error(f"Error submitting report: {str(e)}")
        raise e


@router.get(
    "/{organization_slug}/{program_slug}/reports",
    response_model=PaginatedReportSummaryResponse,
    summary="List all reports for a program",
)
async def list_reports_for_program(
    program: Program = Depends(get_authorized_program_from_path), # Only organization members can view the reports
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 10,
):
    """
    (Organization Member Only) Lists all submitted reports for a specific program.
    """
    service = ReportService(session)
    reports_list, total_count = await service.get_reports_by_program_paginated(program_id=program.id, skip=skip, limit=limit)
    reports_summary_list = [ReportSummary.model_validate(r) for r in reports_list]
    return PaginatedReportSummaryResponse(total=total_count, reports=reports_summary_list)


@router.get("/{organization_slug}/{program_slug}/attachments", response_model=list[AttachmentResponse])
async def get_program_attachments(
    organization_slug: str,
    program_slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get all attachments for a specific program.
    Requires authentication.
    """
    # Get program
    org_repo = OrganizationRepository(session)
    organization = await org_repo.get_by_slug(organization_slug)
    if not organization:
        raise NotFoundException("Organization not found")

    program_repo = ProgramRepository(session)
    program = await program_repo.get_by_slug(program_slug, organization.id)
    if not program:
        raise NotFoundException("Program not found")

    # Get attachments
    attachment_service = AttachmentService(session)
    return await attachment_service.get_attachments_by_entity(EntityType.PROGRAM, program.id)


@router.get("/{organization_slug}/{program_slug}/attachments/{attachment_id}/download")
async def download_program_attachment(
    organization_slug: str,
    program_slug: str,
    attachment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    """
    Download a specific attachment file for a program.

    Requires authentication and that the attachment belongs to the program.
    """
    from fastapi.responses import FileResponse

    # Get program
    org_repo = OrganizationRepository(session)
    organization = await org_repo.get_by_slug(organization_slug)
    if not organization:
        raise NotFoundException("Organization not found")

    program_repo = ProgramRepository(session)
    program = await program_repo.get_by_slug(program_slug, organization.id)
    if not program:
        raise NotFoundException("Program not found")

    # Get and validate attachment
    attachment_service = AttachmentService(session)
    attachment = await attachment_service.get_attachment_by_id(attachment_id)
    if not attachment or attachment.entity_type != EntityType.PROGRAM or attachment.entity_id != program.id:
        raise NotFoundException("Attachment not found")

    return FileResponse(attachment.file_path, media_type=attachment.mime_type, filename=attachment.file_name)
