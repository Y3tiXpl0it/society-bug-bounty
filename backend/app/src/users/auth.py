# backend/app/src/users/auth.py

"""
Authentication configuration module for the Society Bug Bounty application.

This module sets up JWT-based authentication using FastAPI-Users, with secure
cookie transport for session management.
"""

from functools import lru_cache
from typing import Final

from fastapi import Response
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.jwt import generate_jwt, decode_jwt

from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import InternalServerException

# Logger for authentication events
logger = get_logger(__name__)

# Constants for authentication configuration
# Access token lifetime in seconds (JWT in Authorization header)
ACCESS_TOKEN_LIFETIME: Final[int] = settings.JWT_ACCESS_TOKEN_EXPIRATION * 60
# Refresh token lifetime in seconds (opaque token in HTTP-only cookie)
REFRESH_TOKEN_LIFETIME: Final[int] = settings.JWT_REFRESH_TOKEN_EXPIRATION * 60

# Bearer transport for access tokens (sent in Authorization header)
bearer_transport = BearerTransport(tokenUrl="/auth/token")

class CustomJWTStrategy(JWTStrategy):
    """Custom JWT Strategy that includes audience in tokens."""

    def __init__(self, secret: str, lifetime_seconds: int):
        super().__init__(secret=secret, lifetime_seconds=lifetime_seconds)
        # Hardcoded audience specific to fastapi-users library
        self.audience = "fastapi-users:auth"

    async def write_token(self, user) -> str:
        """Write JWT token with audience claim."""
        data = {"sub": str(user.id), "aud": self.audience}
        return generate_jwt(
            data,
            self.secret,
            self.lifetime_seconds,
            algorithm=settings.JWT_ALGORITHM,
        )


@lru_cache(maxsize=1)
def get_jwt_strategy() -> JWTStrategy:
    """
    Factory function that returns a cached CustomJWTStrategy instance.

    This strategy creates JWTs with audience claims for better security.
    Audience is hardcoded as "fastapi-users:auth" since it's specific to the library.

    Returns:
        CustomJWTStrategy: Configured JWT strategy instance with audience.

    Raises:
        ValueError: If JWT_SECRET is not configured.
    """
    if not settings.JWT_SECRET:
        logger.critical("JWT_SECRET is not configured!")
        raise InternalServerException("JWT_SECRET must be configured in settings.")
    strategy = CustomJWTStrategy(
        secret=settings.JWT_SECRET,
        lifetime_seconds=ACCESS_TOKEN_LIFETIME
    )
    return strategy

# Initializes the main authentication backend with Bearer transport
auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)


# Helper functions for managing refresh token and CSRF cookies

def set_refresh_cookie(response: Response, token: str):
    """
    Set the HTTP-only cookie for the refresh token.
    This cookie is automatically sent by the browser on requests to /auth/refresh.
    """
    response.set_cookie(
        key="SBB_refresh",
        value=token,
        max_age=REFRESH_TOKEN_LIFETIME,
        secure=not settings.DEBUG,
        httponly=True,  # Not accessible by JavaScript
        samesite="strict",
    )


def set_csrf_cookie(response: Response, csrf_token: str):
    """
    Set a readable cookie for the CSRF token.
    This MUST be readable by JavaScript so it can be sent in the X-XSRF-TOKEN header.
    """
    response.set_cookie(
        key="XSRF-TOKEN",
        value=csrf_token,
        max_age=REFRESH_TOKEN_LIFETIME,
        secure=not settings.DEBUG,
        httponly=False,  # MUST be readable by JavaScript
        samesite="strict",
    )


def clear_auth_cookies(response: Response):
    """Clear all authentication cookies on logout."""
    response.delete_cookie(
        key="SBB_refresh",
        secure=not settings.DEBUG,
        httponly=True,
        samesite="strict"
    )
    response.delete_cookie(
        key="XSRF-TOKEN",
        secure=not settings.DEBUG,
        httponly=False,
        samesite="strict"
    )
