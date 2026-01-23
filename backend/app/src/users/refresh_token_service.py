# backend/app/src/users/refresh_token_service.py

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple


from fastapi import Request
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.src.users.models import RefreshToken, User


class RefreshTokenService:
    """Service for managing refresh tokens"""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.logger = get_logger(__name__)

    async def enforce_user_token_limit(
        self, user_id: uuid.UUID, 
        max_tokens: int = int(os.getenv('MAX_REFRESH_TOKENS', '5')),
        exclude_id: Optional[uuid.UUID] = None
    ):
        """
        Enforce the user's refresh token limit.
        Optimization: Keeps the top (max_tokens - 1) tokens and bulk deletes the rest.
        """
        # 1. 🔒 LOCK (Advisory Lock)
        # Vital to prevent race conditions during high concurrency.
        await self.session.execute(
            select(func.pg_advisory_xact_lock(func.hashtext(str(user_id))))
        )

        # 2. Define how many to KEEP.
        # We want to leave space for 1 new token, so we keep (max - 1).
        # If max_tokens is 5, we keep the top 4.
        limit_to_keep = max_tokens - 1

        if limit_to_keep < 0:
            limit_to_keep = 0

        # 3. Subquery: Get IDs of the tokens to save.
        # Criteria: Active (not revoked) first, then those expiring later (future).
        stmt_keep = (
            select(RefreshToken.id)
            .where(RefreshToken.user_id == user_id)
            .order_by(
                RefreshToken.revoked.asc(),      # False (0) before True (1) -> Active first
                RefreshToken.expires_at.desc()   # Future dates first -> Longest lasting
            )
            .limit(limit_to_keep)
        )

        # 4. Bulk DELETE
        # Delete all tokens for this user that are NOT in the 'keep' list.
        delete_stmt = (
            delete(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.id.not_in(stmt_keep))
        )

        if exclude_id:
            delete_stmt = delete_stmt.where(RefreshToken.id != exclude_id)

        result = await self.session.execute(delete_stmt)
        
        # Log only if something was deleted
        deleted_count = result.rowcount # type: ignore
        if deleted_count > 0:
            self.logger.info(f"🧹 [CLEANUP] Deleted {deleted_count} old/excess tokens for user {user_id}.")
    
    async def create_refresh_token(
        self,
        user: User,
        request: Request
    ) -> Tuple[str, str, RefreshToken]:
        """
        Create a new refresh token with its associated CSRF token.
        
        Args:
            user: The user for whom to create the token
            request: The FastAPI request object for extracting device info
        
        Returns:
            Tuple of (refresh_token, csrf_token, refresh_token_record)
        """
        # Enforce token limit before creating a new one
        await self.enforce_user_token_limit(user.id)

        # Generate tokens
        refresh_token = RefreshToken.generate_token()
        token_hash = RefreshToken.hash_token(refresh_token)
        csrf_token = secrets.token_urlsafe(32)
        
        # Extract device information
        device_info = {
            "user_agent": request.headers.get("user-agent"),
            "platform": request.headers.get("sec-ch-ua-platform"),
        }
        ip_address = request.client.host if request.client else None
        
        # Create database record
        refresh_token_record = RefreshToken(
            token_hash=token_hash,
            user_id=user.id,
            csrf_token=csrf_token,
            expires_at=datetime.now(timezone.utc) + timedelta(
                minutes=settings.JWT_REFRESH_TOKEN_EXPIRATION
            ),
            device_info=device_info,
            ip_address=ip_address
        )
        
        self.session.add(refresh_token_record)
        await self.session.commit()
        await self.session.refresh(refresh_token_record)

        return refresh_token, csrf_token, refresh_token_record
    
    async def validate_refresh_token(
        self, 
        token: str,
        csrf_token: str
    ) -> Optional[RefreshToken]:
        """
        Validate a refresh token and its associated CSRF token.
        
        Args:
            token: The refresh token to validate
            csrf_token: The CSRF token to validate
        
        Returns:
            The RefreshToken record if valid, None otherwise
        """
        token_hash = RefreshToken.hash_token(token)
        
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
        result = await self.session.execute(stmt)
        refresh_token = result.scalar_one_or_none()
        
        # Validate token exists, is not revoked, not expired, and CSRF matches
        if (refresh_token and
            refresh_token.is_valid() and
            refresh_token.csrf_token == csrf_token):

            # Update last used timestamp
            refresh_token.last_used_at = datetime.now(timezone.utc)
            await self.session.commit()

            return refresh_token

        return None
    
    
    async def rotate_refresh_token(
        self,
        user: User,
        token_record: RefreshToken,
        request: Request
    ) -> Tuple[str, str, RefreshToken]:
        """
        Rotate a refresh token by creating a new one and revoking the old.
        
        This implements automatic token rotation for enhanced security:
        - Each refresh token can only be used once
        - After use, it's immediately revoked
        - A new token is issued for the next refresh
        
        This pattern significantly reduces the window of opportunity for token theft attacks.
        If a token is stolen, it can only be used once before being invalidated.
        
        Args:
            user: The user for whom to rotate the token
            old_token_record: The current token record being used
            request: The FastAPI request object for extracting device info
        
        Returns:
            Tuple of (new_refresh_token, new_csrf_token, new_token_record)
        """
        # Revoke the old token
        token_record.revoke()

        # Enforce token limit before creating a new one
        await self.enforce_user_token_limit(user.id, exclude_id=token_record.id)

        # Generate new tokens
        new_refresh_token = RefreshToken.generate_token()
        new_token_hash = RefreshToken.hash_token(new_refresh_token)
        new_csrf_token = secrets.token_urlsafe(32)
        
        # Extract device information
        device_info = {
            "user_agent": request.headers.get("user-agent"),
            "platform": request.headers.get("sec-ch-ua-platform"),
        }
        ip_address = request.client.host if request.client else None
        
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_REFRESH_TOKEN_EXPIRATION
        )
        
        # Create new token record
        new_token_record = RefreshToken(
            user_id=user.id,
            token_hash=new_token_hash,
            csrf_token=new_csrf_token,
            expires_at=expires_at,
            device_info=device_info,
            ip_address=ip_address
        )
        
        # Add CSRF token separately to avoid logging it accidentally        
        self.session.add(new_token_record)
        await self.session.commit()
        await self.session.refresh(new_token_record)
        
        self.logger.info(
            f"Rotated refresh token for user {user.id}. "
            f"Old token revoked, new token created."
        )
        
        return new_refresh_token, new_csrf_token, new_token_record
    

    async def revoke_token(self, token: str) -> bool:
        """
        Revoke a specific refresh token.
        
        Args:
            token: The refresh token to revoke
        
        Returns:
            True if token was revoked, False if not found
        """
        token_hash = RefreshToken.hash_token(token)
        
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
        result = await self.session.execute(stmt)
        refresh_token = result.scalar_one_or_none()
        
        if refresh_token:
            refresh_token.revoke()
            await self.session.commit()
            return True

        return False
    

    async def cleanup_tokens(self, older_than: timedelta = timedelta(days=7)):
        """
        Delete revoked tokens older than the specified timedelta,
        and also expired tokens older than the specified timedelta.
        """
        cutoff_date = datetime.now(timezone.utc) - older_than

        stmt = delete(RefreshToken).where(
            ((RefreshToken.revoked == True) & (RefreshToken.revoked_at < cutoff_date)) |
            ((RefreshToken.revoked == False) & (RefreshToken.expires_at < cutoff_date))
        )

        result = await self.session.execute(stmt)
        await self.session.commit()

        return result.rowcount # type: ignore