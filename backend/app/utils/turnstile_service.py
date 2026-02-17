# backend/app/utils/turnstile_service.py
"""
Cloudflare Turnstile CAPTCHA verification.
Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
"""

import httpx

from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.core.error_codes import ErrorCode
from app.core.logging import get_logger

logger = get_logger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: str) -> None:
    """
    Verifies a Cloudflare Turnstile token against the siteverify API.
    Raises BadRequestException with CAPTCHA_FAILED if verification fails.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": settings.TURNSTILE_SECRET_KEY,
                    "response": token,
                },
            )
        result = response.json()

        if not result.get("success"):
            error_codes = result.get("error-codes", [])
            logger.warning(f"Turnstile verification failed: {error_codes}")
            raise BadRequestException(detail={
                "code": ErrorCode.CAPTCHA_FAILED,
                "message": "CAPTCHA verification failed",
            })

    except BadRequestException:
        raise
    except Exception as e:
        logger.error(f"Turnstile verification error: {e}")
        raise BadRequestException(detail={
            "code": ErrorCode.CAPTCHA_FAILED,
            "message": "CAPTCHA verification failed",
        })
