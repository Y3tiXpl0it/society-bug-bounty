# backend/app/tasks/maintenance.py
import asyncio
from datetime import timedelta
import logging
from app.celery_config import celery_app
from app.core.config import settings
from app.core.database import async_session
from app.src.users.refresh_token_service import RefreshTokenService

logger = logging.getLogger(__name__)

async def _run_cleanup_logic():
    """Async helper function to handle session and service"""
    async with async_session() as session:
        service = RefreshTokenService(session)
    
        # 1. Clean up old revoked tokens (Your requirement)
        await service.cleanup_tokens(older_than=timedelta(minutes=settings.CLEANUP_REVOKED_TOKENS_RETENTION_MINUTES))

@celery_app.task(name='maintenance.cleanup_tokens')
def cleanup_tokens_task():
    """
    Scheduled Celery task to clean up tokens.
    """
    logger.info("🧹 Starting daily cleanup of revoked tokens...")

    try:
        # Execute the async function within an event loop
        loop = asyncio.get_event_loop()
        # If there's already a loop running (rare in standard workers), use run_until_complete
        if loop.is_closed():
            asyncio.run(_run_cleanup_logic())
        else:
            loop.run_until_complete(_run_cleanup_logic())

        logger.info("✅ Cleanup completed successfully.")
        return "Cleanup completed"

    except Exception as e:
        logger.error(f"❌ Error during token cleanup: {e}")
        raise e