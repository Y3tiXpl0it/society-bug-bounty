# backend/app/src/users/google_oauth_service.py
"""
Google OAuth 2.0 service with PKCE support.

This module provides a manual implementation of Google OAuth 2.0 flow
with PKCE (Proof Key for Code Exchange) support, replacing httpx_oauth
which doesn't support PKCE natively.
"""

import hashlib
import base64
from typing import Dict, Tuple
import httpx
from urllib.parse import urlencode

from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import BadRequestException

logger = get_logger(__name__)


class GoogleOAuthService:
    """
    Google OAuth 2.0 service with PKCE support.
    
    Implements the OAuth 2.0 authorization code flow with PKCE as specified
    in RFC 7636 for enhanced security in public clients.
    """
    
    # Google OAuth 2.0 endpoints
    AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
    USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    # OAuth scopes
    SCOPES = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]
    
    def __init__(self):
        """Initialize the Google OAuth service."""
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI

        if not all([self.client_id, self.client_secret, self.redirect_uri]):
            raise ValueError("Google OAuth credentials not properly configured")
    
    def get_authorization_url(
        self,
        code_challenge: str,
        state: str,
        code_challenge_method: str = "S256"
    ) -> str:
        """
        Generate the Google OAuth authorization URL with PKCE parameters.
        
        Args:
            code_challenge: The PKCE code challenge (SHA256 hash of verifier)
            state: Random state parameter for CSRF protection
            code_challenge_method: PKCE challenge method (default: S256)
            
        Returns:
            str: Complete authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "access_type": "offline",  # Request refresh token
            "prompt": "consent"  # Force consent screen to get refresh token
        }
        
        url = f"{self.AUTHORIZATION_ENDPOINT}?{urlencode(params)}"
        return url
    
    async def exchange_code_for_token(
        self,
        code: str,
        code_verifier: str
    ) -> Dict[str, str]:
        """
        Exchange authorization code for access token using PKCE.
        
        This method validates the PKCE flow by sending the code_verifier
        to Google, which will verify it against the code_challenge that
        was sent during authorization.
        
        Args:
            code: Authorization code from Google
            code_verifier: PKCE code verifier (original random string)
            
        Returns:
            dict: Token response containing access_token, refresh_token, etc.
            
        Raises:
            BadRequestException: If token exchange fails
        """
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "code_verifier": code_verifier,  # PKCE verification
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.TOKEN_ENDPOINT,
                    data=data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )

                if response.status_code != 200:
                    error_detail = response.json() if response.text else "Unknown error"
                    raise BadRequestException(
                        f"Failed to exchange code for token: {error_detail}"
                    )

                token_data = response.json()
                return token_data
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during token exchange: {e}")
            raise BadRequestException(f"Token exchange failed: {str(e)}")
    
    async def get_user_info(self, access_token: str) -> Tuple[str, str]:
        """
        Retrieve user information from Google using the access token.
        
        Args:
            access_token: Google OAuth access token
            
        Returns:
            tuple: (user_id, email) from Google account
            
        Raises:
            BadRequestException: If user info retrieval fails
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.USERINFO_ENDPOINT,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if response.status_code != 200:
                    raise BadRequestException("Failed to retrieve user information")

                user_data = response.json()
                user_id = user_data.get("id")
                email = user_data.get("email")

                if not user_id or not email:
                    raise BadRequestException("User ID or email not provided by Google")

                return user_id, email
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during user info retrieval: {e}")
            raise BadRequestException(f"Failed to get user info: {str(e)}")
    
    @staticmethod
    def validate_pkce(code_challenge: str, code_verifier: str) -> bool:
        """
        Validate that a code_verifier matches the code_challenge.
        
        This is used for additional server-side validation, though Google
        also validates this during token exchange.
        
        According to RFC 7636:
        code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
        
        Args:
            code_challenge: The code challenge that was sent to Google
            code_verifier: The code verifier received from client
            
        Returns:
            bool: True if verifier matches challenge, False otherwise
        """
        try:
            # Calculate SHA256 hash of the verifier
            verifier_hash = hashlib.sha256(code_verifier.encode('ascii')).digest()
            
            # Encode in Base64 URL-safe format
            calculated_challenge = base64.urlsafe_b64encode(verifier_hash).decode('ascii')
            
            # Remove padding (=) as per RFC 7636
            calculated_challenge = calculated_challenge.rstrip('=')
            
            # Compare with provided challenge
            is_valid = calculated_challenge == code_challenge

            return is_valid
            
        except Exception as e:
            logger.error(f"Error during PKCE validation: {e}")
            return False
    
    @staticmethod
    def validate_code_verifier_format(code_verifier: str) -> bool:
        """
        Validate that code_verifier meets RFC 7636 requirements.
        
        Requirements:
        - Length between 43 and 128 characters
        - Only unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
        
        Args:
            code_verifier: The code verifier to validate
            
        Returns:
            bool: True if valid format, False otherwise
        """
        if not code_verifier:
            return False
        
        length = len(code_verifier)
        if length < 43 or length > 128:
            return False

        # Check for valid characters (unreserved characters per RFC 3986)
        import re
        if not re.match(r'^[A-Za-z0-9\-._~]+$', code_verifier):
            return False
        
        return True