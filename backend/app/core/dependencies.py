# backend/app/core/dependencies.py

"""
This module contains reusable FastAPI dependencies used throughout the application
for tasks like authentication, authorization, and shared business logic.
"""

import uuid
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.src.users.manager import fastapi_users_instance
from app.src.users.models import User
from app.src.programs.models import Program
from app.core.exceptions import ForbiddenException, NotFoundException
from app.src.organizations.repository import OrganizationRepository
from app.src.programs.repository import ProgramRepository
from app.src.reports.repository import ReportRepository
from app.src.reports.models import Report

# Dependency to get the current authenticated and active user.
# Provided by the fastapi-users library.
get_current_active_user = fastapi_users_instance.current_user(active=True)

# Optional version that returns None if not authenticated
get_current_user_optional = fastapi_users_instance.current_user(active=True, optional=True)


def get_connection_manager(request: Request):
    """
    Dependency to get the WebSocket connection manager from app state.
    Returns None if not available (for graceful degradation).
    """
    return getattr(request.app.state, 'connection_manager', None)


async def organization_member_only(user: User = Depends(get_current_active_user)) -> User:
    """
    A dependency that ensures the current user is a member of at least one organization.
    """
    # The 'user.organizations' relationship will be an empty list if they are not a member.
    if not user.organizations:
        raise ForbiddenException("Access requires organization membership.")
    return user


async def get_authorized_program_from_path(
    organization_slug: str,
    program_slug: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_active_user),
) -> Program:
    """
    Dependency to fetch a program by organization and program names from the URL path.
    It also verifies that the current user is a member of the owning organization.
    """
    # 1. Look up the organization by its slug.
    org_repo = OrganizationRepository(session)
    organization = await org_repo.get_by_slug(organization_slug)
    if not organization:
        raise NotFoundException("Organization not found")

    # 2. Security check: Ensure the current user is a member of the organization first.
    user_org_ids = {org.id for org in user.organizations}
    if organization.id not in user_org_ids:
        # Raise 404 to avoid revealing the existence of the program to unauthorized users.
        raise ForbiddenException("You are not authorized to access programs in this organization.")

    # 3. Look up the program by its name within the specified organization.
    program_repo = ProgramRepository(session)
    program = await program_repo.get_by_slug(program_slug, organization.id) # Usar el nuevo método del repo
    if not program:
        raise NotFoundException("Program not found") 

    return program


async def get_authorized_report(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_active_user),
) -> tuple[Report, User]:
    """
    Dependency to fetch and authorize access to a report.
    Allows access if user is the hacker or a member of the program's organization.
    Returns both the report and the user for convenience.
    Builds on get_current_active_user.
    """
    repo = ReportRepository(session)
    report = await repo.get_by_id(report_id)
    if not report:
        raise NotFoundException("Report not found")

    # Check if user is the hacker
    if report.hacker_id == user.id:
        return report, user

    # Check if user is member of the organization (builds on organization membership logic)
    program_org_id = report.program.organization_id
    user_org_ids = {org.id for org in user.organizations}
    if program_org_id in user_org_ids:
        return report, user

    raise ForbiddenException("You don't have permission to access this report")


async def can_update_report_status(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_active_user),
) -> User:
    """
    Dependency to check if user can update report status.
    Only allows organization members (not hackers) to update status.
    """
    repo = ReportRepository(session)
    report = await repo.get_by_id(report_id)
    if not report:
        raise NotFoundException("Report not found")

    # Check if user is a member of the organization (NOT the hacker)
    program_org_id = report.program.organization_id
    user_org_ids = {org.id for org in user.organizations}
    if program_org_id not in user_org_ids:
        raise ForbiddenException("Only organization members can update report status")

    return user


async def can_update_own_report_details(
    report_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_active_user),
) -> User:
    """
    Dependency to check if user can update report details.
    Only allows the hacker who submitted the report to update its details.
    """
    repo = ReportRepository(session)
    report = await repo.get_by_id(report_id)
    if not report:
        raise NotFoundException("Report not found")

    if report.hacker_id != user.id:
        raise ForbiddenException("Only the hacker who submitted the report can update its details")

    return user


async def can_update_own_comment(
    report_id: uuid.UUID,
    comment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_active_user),
) -> User:
    """
    Dependency to check if user can update a comment.
    Only allows the author of the comment to update it.
    """
    from app.src.reports.repository import ReportRepository

    # First verify the report exists and user has access to it
    repo = ReportRepository(session)
    report = await repo.get_by_id(report_id)
    if not report:
        raise NotFoundException("Report not found")

    # Check if user has access to the report (hacker or org member)
    if report.hacker_id != user.id:
        program_org_id = report.program.organization_id
        user_org_ids = {org.id for org in user.organizations}
        if program_org_id not in user_org_ids:
            raise ForbiddenException("You don't have permission to access this report")

    # Check if user is the author of the comment
    comment = await repo.get_comment_by_id(comment_id)
    if not comment:
        raise NotFoundException("Comment not found")

    if comment.user_id != user.id:
        raise ForbiddenException("Only the author can update their own comments")

    return user