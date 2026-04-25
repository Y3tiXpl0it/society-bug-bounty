# backend/app/src/reports/repository.py
import uuid

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.src.reports.models import Report, report_assets, ReportEvent, ReportEventType
from app.src.reports.schemas import ReportCreate
from app.src.reports.models import ReportComment
from app.src.reports.schemas import ReportCommentCreate
from app.src.users.models import User
from app.src.programs.models import Program, ProgramAsset
from app.src.organizations.models import Organization

class ReportRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def count_reports_by_hacker(self, hacker_id: uuid.UUID) -> int:
        """Counts how many reports a hacker has submitted."""
        result = await self.session.execute(
            select(sa_func.count()).select_from(Report).where(Report.hacker_id == hacker_id)
        )
        return result.scalar_one()

    async def create(self, report_data: ReportCreate, asset_ids: list[uuid.UUID] | None = None) -> Report:
        """Creates a new report in the database."""
        from sqlalchemy import insert

        report_dict = report_data.model_dump()
        report_dict.pop('asset_ids', None)  # Remove asset_ids since it's not a field in Report
        new_report = Report(**report_dict)
        self.session.add(new_report)
        await self.session.flush()  # Flush to get the ID

        # Associate assets if provided by inserting into the association table
        if asset_ids:
            for asset_id in asset_ids:
                await self.session.execute(
                    insert(report_assets).values(report_id=new_report.id, program_asset_id=asset_id)
                )

        # Reload the report with all relationships
        query = (
            select(Report)
            .where(Report.id == new_report.id)
            .options(
                joinedload(Report.hacker).joinedload(User.details),
                joinedload(Report.program).joinedload(Program.organization),
                selectinload(Report.assets).joinedload(ProgramAsset.asset_type),
                 # Use selectinload for collections in async context
                selectinload(Report.attachments)
            )
        )
        result = await self.session.execute(query)
        loaded_report = result.unique().scalar_one()
        
        # Explicitly set hacker_name if needed, or rely on relationship
        if loaded_report.hacker and loaded_report.hacker.details:
             loaded_report.hacker_name = loaded_report.hacker.details.username
             
        # Force loading of attachments to avoid MissingGreenlet during Pydantic validation
        # Pydantic v2 calls .attachments which triggers the load. 
        # Since we used selectinload, it should be loaded. 
        # However, to be absolutely safe against "await_only" errors if the loop context changes:
        # We can inspect the attribute to ensure present.
        _ = loaded_report.assets
        _ = loaded_report.attachments
        
        return loaded_report

    async def get_by_id(self, report_id: uuid.UUID) -> Report | None:
        """Gets a report by its ID."""
        query = (
            select(Report)
            .where(Report.id == report_id)
            .options(
                joinedload(Report.hacker).joinedload(User.details),
                joinedload(Report.program).joinedload(Program.organization),
                selectinload(Report.assets).joinedload(ProgramAsset.asset_type),
                selectinload(Report.attachments)
            )
        )
        result = await self.session.execute(query)
        report = result.unique().scalar_one_or_none()
        if report:
            report.hacker_name = report.hacker.details.username
        return report

    async def list_by_program(self, program_id: uuid.UUID) -> list[Report]:
        """Gets a list of all reports for a specific program."""
        query = (
            select(Report)
            .join(User, Report.hacker_id == User.id)
            .where(Report.program_id == program_id)
            .options(joinedload(Report.hacker).joinedload(User.details))
        )
        result = await self.session.execute(query)
        reports = []
        for report in result.unique().scalars():
            report.hacker_name = report.hacker.details.username
            reports.append(report)
        return reports

    async def list_by_program_paginated(self, program_id: uuid.UUID, skip: int, limit: int) -> tuple[list[Report], int]:
        """Gets a paginated list of reports for a specific program."""
        # First, get the total count
        count_query = select(Report).where(Report.program_id == program_id)
        count_result = await self.session.execute(count_query)
        total_count = len(count_result.scalars().all())

        # Then, get the paginated results
        query = (
            select(Report)
            .join(User, Report.hacker_id == User.id)
            .where(Report.program_id == program_id)
            .options(joinedload(Report.hacker).joinedload(User.details))
            .order_by(Report.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        reports = []
        for report in result.unique().scalars():
            report.hacker_name = report.hacker.details.username
            reports.append(report)
        return reports, total_count

    async def list_my_reports_summaries_by_hacker(self, hacker_id: uuid.UUID) -> list[dict]:
        """Gets my reports summaries for a specific hacker (minimal data for my reports listing)."""
        query = (
            select(
                Report.id,
                Report.title,
                Report.status,
                Report.severity,
                Report.created_at,
                Report.updated_at,
                Program.name.label('program_name'),
                Organization.name.label('organization_name')
            )
            .join(Program, Report.program_id == Program.id)
            .join(Organization, Program.organization_id == Organization.id)
            .where(Report.hacker_id == hacker_id)
            .order_by(Report.created_at.desc())
        )
        result = await self.session.execute(query)
        summaries = []
        for row in result.all():
            summaries.append({
                'id': row.id,
                'title': row.title,
                'program_name': row.program_name,
                'organization_name': row.organization_name,
                'status': row.status,
                'severity': row.severity,
                'created_at': row.created_at,
                'updated_at': row.updated_at
            })
        return summaries

    async def add_comment(
        self, report_id: uuid.UUID, user_id: uuid.UUID, comment_data: ReportCommentCreate
    ) -> ReportComment:
        """Adds a new comment to a report in the database."""
        comment_dict = comment_data.model_dump()
        comment_dict.pop('attachment_ids', None)  # Remove attachment_ids since it's not a field in ReportComment
        new_comment = ReportComment(
            report_id=report_id,
            user_id=user_id,
            **comment_dict
        )
        self.session.add(new_comment)
        await self.session.flush()
        await self.session.refresh(new_comment)
        return new_comment



    async def list_comments_by_report(self, report_id: uuid.UUID) -> list[ReportComment]:
        """Gets all comments for a report, ordered by creation date."""
        query = (
            select(ReportComment)
            .where(ReportComment.report_id == report_id)
            .order_by(ReportComment.created_at.asc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())



    async def get_program_assets(self, program_id: uuid.UUID) -> list[ProgramAsset]:
        """Gets all assets for a program."""
        query = select(ProgramAsset).where(ProgramAsset.program_id == program_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_event(
        self,
        report_id: uuid.UUID,
        event_type: ReportEventType,
        user_id: uuid.UUID | None = None,
        old_value: str | None = None,
        new_value: str | None = None,
        comment_id: uuid.UUID | None = None
    ) -> ReportEvent:
        """Creates a new event in the report_events table."""
        new_event = ReportEvent(
            report_id=report_id,
            user_id=user_id,
            event_type=event_type,
            old_value=old_value,
            new_value=new_value,
            comment_id=comment_id
        )
        self.session.add(new_event)
        await self.session.flush()
        await self.session.refresh(new_event)
        return new_event

    async def list_events_by_report(self, report_id: uuid.UUID) -> list[ReportEvent]:
        """Gets all events for a report, ordered by creation date."""
        query = (
            select(ReportEvent)
            .where(ReportEvent.report_id == report_id)
            .options(
                joinedload(ReportEvent.user).joinedload(User.details),
                joinedload(ReportEvent.comment)
            )
            .order_by(ReportEvent.created_at.asc())
        )
        result = await self.session.execute(query)
        return list(result.unique().scalars().all())
