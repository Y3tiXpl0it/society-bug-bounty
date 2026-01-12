# backend/app/src/users/routes.py

import secrets
import hashlib
import base64
from datetime import datetime

from fastapi import APIRouter, Depends, Response, UploadFile, File, Request, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import BadRequestException, UnauthorizedException, NotFoundException
from app.core.logging import get_logger
from app.core.config import settings

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
from app.src.users.schemas import UserDetailsReadSchema, UserDetailsUpdateSchema, UserCreate
from app.src.users.models import User, OAuthAccount

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
        raise BadRequestException("Invalid or expired login session. Please try again.")

    # 3. Exchange authorization code for Google tokens
    try:
        token_data = await google_service.exchange_code_for_token(
            code=body.code,
            code_verifier=pkce_verifier_cookie 
        )
    except Exception as e:
        logger.error(f"Error exchanging token: {e}")
        raise BadRequestException("Failed to exchange token with Google")

    # 4. Retrieve User Info from Google
    try:
        google_sub, email = await google_service.get_user_info(token_data["access_token"])
    except Exception as e:
        logger.error(f"Error fetching user info: {e}")
        raise BadRequestException("Failed to fetch user info from Google")

    # 5. Find or Create User
    user = await service.get_user_by_email(email)
    
    if not user:
        # --- REGISTER NEW USER ---
        password = secrets.token_urlsafe(12)
        try:
            # Create base user
            user_create = UserCreate(email=email, password=password, is_active=True)
            user = await user_manager.create(user_create)
            
            # Calculate expiry timestamp
            expires_at = None
            if token_data.get("expires_in"):
                # Cast to int to avoid TypeError between int and str
                expires_at = int(datetime.now().timestamp()) + int(token_data["expires_in"])

            # Create OAuth Account Link
            # We use dictionary unpacking (**kwargs) to avoid static linter errors
            oauth_account_data = {
                "oauth_name": "google",
                "access_token": token_data["access_token"],
                "expires_at": expires_at,
                "refresh_token": token_data.get("refresh_token"),
                "account_id": google_sub,
                "account_email": email,
                "user_id": user.id
            }
            session.add(OAuthAccount(**oauth_account_data))

            await session.commit()
            
        except Exception as e:
            logger.error(f"Error creating new user: {e}")
            await session.rollback()
            raise BadRequestException("Error creating user account")
    else:
        # --- EXISTING USER ---
        # Logic to update existing user tokens could go here
        pass

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
        raise BadRequestException("Refresh token missing")

    token_record = await refresh_service.validate_refresh_token(refresh_token, csrf_token)
    
    if not token_record:
        clear_auth_cookies(response)
        raise UnauthorizedException("Invalid or expired token")

    user = await user_manager.get(token_record.user_id)
    if not user or not user.is_active:
        raise UnauthorizedException("User inactive or not found")

    new_refresh, new_csrf, _ = await refresh_service.rotate_refresh_token(user, token_record, request)
    access_token = await get_jwt_strategy().write_token(user)

    set_refresh_cookie(response, new_refresh)
    set_csrf_cookie(response, new_csrf)

    return {"access_token": access_token, "token_type": "bearer"}

# --- USER PROFILE ENDPOINTS ---

@user_router.patch("/me/details", response_model=UserDetailsReadSchema, tags=["users"])
async def update_user_details(
    details_update: UserDetailsUpdateSchema,
    user: User = Depends(fastapi_users_instance.current_user()),
    service: UserService = Depends(get_user_service),
):
    """
    Update the current user's profile details.
    """
    updated_user = await service.update_user_details(user.id, details_update.model_dump(exclude_unset=True))
    if not updated_user:
        raise NotFoundException("User details not found")
    return updated_user.details

@user_router.post("/me/avatar", tags=["users"])
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(fastapi_users_instance.current_user()),
    service: UserService = Depends(get_user_service),
):
    """
    Upload an avatar image for the current user.
    """
    avatar_url = await service.upload_avatar(user.id, file)
    await service.update_user_details(user.id, {"avatar_url": avatar_url})
    return {"avatar_url": avatar_url}