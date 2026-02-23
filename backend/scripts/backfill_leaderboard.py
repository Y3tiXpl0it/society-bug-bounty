import asyncio
import os
import sys

# Add backend directory to sys.path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import async_session
from app.src.reports.models import Report, ReportStatus
from app.src.users.models import UserStats
from app.src.users.service import UserService

async def backfill():
    async with async_session() as session:
        # Get all users with accepted or resolved reports
        stmt = select(Report).where(Report.status.in_([ReportStatus.accepted, ReportStatus.resolved]))
        result = await session.execute(stmt)
        reports = result.scalars().all()
        
        print(f"Found {len(reports)} valid reports to process")
        user_service = UserService(session)
        
        for report in reports:
            # We simulate a transition from a non-successful status to a successful one
            # to reuse our logic
            await user_service.update_stats_for_report_change(
                user_id=report.hacker_id,
                old_status="received", # a non-success status
                new_status=report.status.value,
                old_severity=report.severity,
                new_severity=report.severity
            )
            
        await session.commit()
        print("Backfill complete!")

if __name__ == "__main__":
    asyncio.run(backfill())
