# backend/app/src/users/routes.py

import secrets
import hashlib
import base64
from datetime import datetime

from fastapi import APIRouter, Depends, Response, UploadFile, File, Request, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import BadRequestException, UnauthorizedException, NotFoundException, ForbiddenException
from app.core.error_codes import ErrorCode
from app.core.logging import get_logger
from app.core.config import settings
from app.core.dependencies import require_permanent_user

# --- IMPORTS ---
from app.src.users.manager import get_user_manager, UserManager, fastapi_users_instance
# Use the new GoogleOAuthService class
from app.src.users.google_oauth_service import GoogleOAuthService 
from app.src.users.auth import (
    get_jwt_strategy,
    set_refresh_cookie,
    set_csrf_cookie,
    clear_auth_cookies
)
from app.src.users.refresh_token_service import RefreshTokenService
from app.src.users.service import UserService
from app.src.users.schemas import UserDetailsReadSchema, UserDetailsUpdateSchema, LeaderboardResponse
from app.src.users.models import User

logger = get_logger(__name__)

# --- DEPENDENCIES ---

async def get_user_service(session: AsyncSession = Depends(get_session)) -> UserService:
    """Dependency to get UserService instance."""
    return UserService(session)

async def get_refresh_token_service(session: AsyncSession = Depends(get_session)) -> RefreshTokenService:
    """Dependency to get RefreshTokenService instance."""
    return RefreshTokenService(session)

# --- ROUTERS ---
auth_router = APIRouter()
user_router = APIRouter()

# --- SCHEMAS ---
class CodeRequest(BaseModel):
    """
    Request model for OAuth authorization code.
    Only accepts the code. Verifier and state are handled via HttpOnly cookies server-side.
    """
    code: str

class GuestLoginRequest(BaseModel):
    """Request model for guest account login."""
    username: str
    password: str

class GuestCreateRequest(BaseModel):
    """Request model for guest account creation (with CAPTCHA)."""
    turnstile_token: str

# --- OAUTH ENDPOINTS ---

@auth_router.get("/google/authorize", tags=["auth"])
async def get_google_auth_url(response: Response):
    """
    Generates the Google OAuth authorization URL and sets secure HttpOnly cookies.
    """
    google_service = GoogleOAuthService()

    # 1. Generate Secrets (State and PKCE)
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(32)
    
    # 2. Calculate PKCE Challenge
    code_challenge_bytes = hashlib.sha256(code_verifier.encode('ascii')).digest()
    code_challenge = base64.urlsafe_b64encode(code_challenge_bytes).decode('ascii').rstrip('=')

    # 3. Get Authorization URL
    authorization_url = google_service.get_authorization_url(
        code_challenge=code_challenge,
        state=state
    )

    print(f"🔍 CONFIG DEBUG: settings.DEBUG es {settings.DEBUG}")
    print(f"🔍 COOKIE SECURE será: {not settings.DEBUG}")

    # 4. Set HttpOnly Cookies (Secure storage)
    cookie_params = {
        "max_age": 600,  # 10 minutes
        "secure": not settings.DEBUG,
        "httponly": True,  # Critical: JS cannot read this
        "samesite": "lax"
    }

    response.set_cookie(key="oauth_state", value=state, **cookie_params)
    response.set_cookie(key="pkce_verifier", value=code_verifier, **cookie_params)

    return {"authorization_url": authorization_url}


@auth_router.post("/google/callback", tags=["auth"])
async def handle_google_callback(
    request: Request,
    body: CodeRequest,
    response: Response,
    user_manager: UserManager = Depends(get_user_manager),
    service: UserService = Depends(get_user_service),
    refresh_service: RefreshTokenService = Depends(get_refresh_token_service),
    session: AsyncSession = Depends(get_session),
):
    """
    Handles the Google OAuth callback.
    Exchanges code for tokens, creates/retrieves user, and sets session cookies.
    """
    # 1. Instantiate service
    google_service = GoogleOAuthService()

    # 2. Retrieve secrets from HttpOnly cookies
    oauth_state_cookie = request.cookies.get("oauth_state")
    pkce_verifier_cookie = request.cookies.get("pkce_verifier")

    if not oauth_state_cookie or not pkce_verifier_cookie:
        raise BadRequestException(detail={
            "code": ErrorCode.INVALID_LOGIN_SESSION,
            "message": "Invalid or expired login session. Please try again."
        })

    # 3. Process Code Exchange and User Creation/Retrieval via Service
    # (Delegates complex logic to service layer)
    user = await service.process_google_callback(
        code=body.code,
        pkce_verifier=pkce_verifier_cookie,
        user_manager=user_manager
    )

    # 6. Generate Session Tokens (App JWT)
    access_token = await get_jwt_strategy().write_token(user)
    refresh_token, csrf_token, _ = await refresh_service.create_refresh_token(user, request)

    # 7. Set Response Cookies
    set_refresh_cookie(response, refresh_token)
    set_csrf_cookie(response, csrf_token)
    
    # 8. Cleanup OAuth cookies
    response.delete_cookie("oauth_state")
    response.delete_cookie("pkce_verifier")

    # 9. Prepare Response Data
    user_with_details = await service.get_user_by_id(user.id)
    username = None
    avatar_url = None
    if user_with_details and user_with_details.details:
        username = user_with_details.details.username
        avatar_url = user_with_details.details.avatar_url

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_superuser": user.is_superuser,
            "username": username,
            "avatar_url": avatar_url
        }
    }


# --- GUEST ACCOUNT ENDPOINTS ---

@auth_router.post("/guest", tags=["auth"])
async def create_guest_account(
    body: GuestCreateRequest,
    response: Response,
    request: Request,
    service: UserService = Depends(get_user_service),
    user_manager: UserManager = Depends(get_user_manager),
    refresh_service: RefreshTokenService = Depends(get_refresh_token_service),
):
    """
    Creates a temporary guest account.
    Returns credentials (username + password) that the hacker must save.
    The account is limited to a single report and expires when the report is closed.
    """
    # 0. Verify Turnstile CAPTCHA
    from app.utils.turnstile_service import verify_turnstile_token
    await verify_turnstile_token(body.turnstile_token)

    # 1. Create guest user
    user, plain_password = await service.create_guest_user(user_manager)

    # 2. Generate Session Tokens
    access_token = await get_jwt_strategy().write_token(user)
    refresh_token, csrf_token, _ = await refresh_service.create_refresh_token(user, request)

    # 3. Set Response Cookies
    set_refresh_cookie(response, refresh_token)
    set_csrf_cookie(response, csrf_token)

    # 4. Get user details (username was auto-generated by on_after_register)
    user_with_details = await service.get_user_by_id(user.id)
    username = user_with_details.details.username if user_with_details and user_with_details.details else None

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "guest_credentials": {
            "username": username,
            "password": plain_password,
        },
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_superuser": user.is_superuser,
            "is_temporary": user.is_temporary,
            "username": username,
            "avatar_url": None,
        }
    }


@auth_router.post("/guest/login", tags=["auth"])
async def guest_login(
    body: GuestLoginRequest,
    response: Response,
    request: Request,
    service: UserService = Depends(get_user_service),
    refresh_service: RefreshTokenService = Depends(get_refresh_token_service),
):
    """
    Logs in a guest user using their username and password.
    """
    from fastapi_users.password import PasswordHelper

    # 1. Look up user by username
    user = await service.get_user_by_username(body.username)
    if not user:
        raise UnauthorizedException(detail={
            "code": ErrorCode.GUEST_LOGIN_FAILED,
            "message": "Invalid username or password"
        })

    # 2. Verify this is a temporary account
    if not user.is_temporary:
        raise UnauthorizedException(detail={
            "code": ErrorCode.GUEST_LOGIN_FAILED,
            "message": "Invalid username or password"
        })

    # 3. Check account is active
    if not user.is_active:
        raise UnauthorizedException(detail={
            "code": ErrorCode.USER_INACTIVE,
            "message": "This guest account has expired"
        })

    # 4. Verify password
    password_helper = PasswordHelper()
    verified, _ = password_helper.verify_and_update(body.password, user.hashed_password)
    if not verified:
        raise UnauthorizedException(detail={
            "code": ErrorCode.GUEST_LOGIN_FAILED,
            "message": "Invalid username or password"
        })

    # 5. Generate Session Tokens
    access_token = await get_jwt_strategy().write_token(user)
    refresh_token, csrf_token, _ = await refresh_service.create_refresh_token(user, request)

    # 6. Set Response Cookies
    set_refresh_cookie(response, refresh_token)
    set_csrf_cookie(response, csrf_token)

    # 7. Prepare Response
    user_with_details = await service.get_user_by_id(user.id)
    username = None
    avatar_url = None
    if user_with_details and user_with_details.details:
        username = user_with_details.details.username
        avatar_url = user_with_details.details.avatar_url

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_superuser": user.is_superuser,
            "is_temporary": user.is_temporary,
            "username": username,
            "avatar_url": avatar_url,
        }
    }

# --- EXISTING ENDPOINTS (Logout, Refresh, User) ---

@auth_router.post("/logout", tags=["auth"])
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """
    Logs out the user by revoking the refresh token and clearing cookies.
    """
    refresh_token = request.cookies.get("SBB_refresh")
    if refresh_token:
        try:
            refresh_service = RefreshTokenService(session)
            await refresh_service.revoke_token(refresh_token)
        except Exception as e:
            logger.error(f"Error revoking token during logout: {e}")

    response = Response(content='{"message": "Logged out"}', media_type="application/json")
    clear_auth_cookies(response)
    return response

@auth_router.post("/refresh", tags=["auth"])
async def refresh_access_token(
    request: Request,
    response: Response,
    refresh_service: RefreshTokenService = Depends(get_refresh_token_service),
    user_manager: UserManager = Depends(get_user_manager),
):
    """
    Refreshes the access token using the secure refresh token cookie.
    Also performs token rotation (issues a new refresh token).
    """
    refresh_token = request.cookies.get("SBB_refresh")
    csrf_token = request.headers.get("X-XSRF-TOKEN")

    if not refresh_token or not csrf_token:
        clear_auth_cookies(response)
        raise BadRequestException(detail={
            "code": ErrorCode.REFRESH_TOKEN_MISSING,
            "message": "Refresh token missing"
        })

    token_record = await refresh_service.validate_refresh_token(refresh_token, csrf_token)
    
    if not token_record:
        clear_auth_cookies(response)
        raise UnauthorizedException(detail={
            "code": ErrorCode.INVALID_TOKEN,
            "message": "Invalid or expired token"
        })

    user = await user_manager.get(token_record.user_id)
    if not user or not user.is_active:
        raise UnauthorizedException(detail={
            "code": ErrorCode.USER_INACTIVE,
            "message": "User inactive or not found"
        })

    new_refresh, new_csrf, _ = await refresh_service.rotate_refresh_token(user, token_record, request)
    access_token = await get_jwt_strategy().write_token(user)

    set_refresh_cookie(response, new_refresh)
    set_csrf_cookie(response, new_csrf)

    return {"access_token": access_token, "token_type": "bearer"}

# --- USER PROFILE ENDPOINTS ---

@user_router.patch("/me/details", response_model=UserDetailsReadSchema, tags=["users"])
async def update_user_details(
    details_update: UserDetailsUpdateSchema,
    user: User = Depends(require_permanent_user),
    service: UserService = Depends(get_user_service),
):
    """
    Update the current user's profile details.
    """
    updated_user = await service.update_user_details(user.id, details_update.model_dump(exclude_unset=True))
    return updated_user.details

@user_router.post("/me/avatar", tags=["users"])
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(require_permanent_user),
    service: UserService = Depends(get_user_service),
):
    """
    Upload an avatar image for the current user.
    """
    avatar_url = await service.upload_avatar(user.id, file)
    
    return {"avatar_url": avatar_url}

@user_router.get("/leaderboard", response_model=LeaderboardResponse, tags=["users"])
async def get_leaderboard(
    page: int = 1,
    size: int = 20,
    service: UserService = Depends(get_user_service),
):
    """
    Get the top hackers leaderboard.
    """
    if page < 1:
        page = 1
    if size < 1 or size > 100:
        size = 20
        
    return await service.get_leaderboard(page, size)