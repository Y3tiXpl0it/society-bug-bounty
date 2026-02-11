# backend/app/core/config.py
"""
This module handles the application's configuration management using Pydantic's BaseSettings.
It reads settings from environment variables and provides a centralized 'settings' object.
"""
from pydantic_settings import BaseSettings
from pydantic import model_validator, field_validator
from typing import Optional

class Settings(BaseSettings):
    """Application settings."""
    PROJECT_NAME: str = "Society Bug Bounty"
    DEBUG: bool = False

    DB_POOL_SIZE: int = 20       # Connection pool size
    DB_MAX_OVERFLOW: int = 10    # Maximum overflow connections allowed
    
    # --- Database Connection ---
    # Individual components for the database URL, read from the .env file.
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str = "db" # Docker service hostname

    # The final DATABASE_URL is constructed from the parts above.
    # It is marked as Optional initially and populated by the validator.
    DATABASE_URL: Optional[str] = None

    # This validator runs after the environment variables are loaded.
    @model_validator(mode='after')
    def assemble_db_connection(self) -> 'Settings':
        """Constructs the full DATABASE_URL if it's not already set."""
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_HOST}:5432/{self.POSTGRES_DB}"
            )
        return self

    # --- File Upload Settings ---
    MAX_FILES_PER_UPLOAD: int = 10
    MAX_AVATAR_SIZE: int = 2 * 1024 * 1024  # 2 MB
    MAX_LOGO_SIZE: int = 5 * 1024 * 1024    # 5 MB

    # Whitelist de extensiones
    ALLOWED_IMAGE_EXTENSIONS: list[str] = [".jpg", ".jpeg", ".png", ".webp"]

    # --- JWT Settings ---
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRATION: int  # in minutes
    JWT_REFRESH_TOKEN_EXPIRATION: int  # in minutes
    # JWT_AUDIENCE is hardcoded as "fastapi-users:auth" since it's specific to fastapi-users library

    # --- PKCE Settings ---
    PKCE_ENABLED: bool

    # --- Google OAuth Settings ---
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    # --- Email Settings ---
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int = 587
    MAIL_SERVER: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    
    # Delay in seconds for non-critical email notifications (e.g. comments)
    # Default to 0 if not set (no delay)
    NOTIFICATIONS_EMAIL_DELAY_SECONDS: int = 0

    # --- CORS Settings ---
    CORS_ALLOWED_ORIGINS: str = "http://localhost,http://127.0.0.1,http://localhost:8000"

    # --- Redis Settings ---
    # Atomic Redis configuration. These are used to build Celery URLs
    # and to configure the Socket.IO RedisManager in main.py.
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0  # Main DB for Broker and Socket.IO Pub/Sub
    
    # --- Celery Settings ---
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None
    CELERY_TASK_ALWAYS_EAGER: bool
    CELERY_TASK_TIME_LIMIT: int  # Hard limit in seconds
    CELERY_TASK_SOFT_TIME_LIMIT: int  # Soft limit in seconds
    CELERY_RESULT_EXPIRES: int  # Result expiration in seconds

    # --- Token Cleanup Settings ---
    CLEANUP_REVOKED_TOKENS_RETENTION_MINUTES: int  # How long to keep revoked tokens before deletion (in minutes)
    CLEANUP_REVOKED_TOKENS_SCHEDULE_HOUR: int  # Hour to run cleanup (0-23)
    CLEANUP_REVOKED_TOKENS_SCHEDULE_MINUTE: int  # Minute to run cleanup (0-59)
    
    @model_validator(mode='after')
    def assemble_celery_urls(self) -> 'Settings':
        """
        Automatically constructs Celery URLs using the atomic Redis settings.
        This ensures Celery and Socket.IO always use the same Redis instance.
        """
        # 1. The Broker uses the same DB defined for Socket.IO (REDIS_DB)
        if not self.CELERY_BROKER_URL:
            self.CELERY_BROKER_URL = (
                f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
            )
            
        # 2. The Result Backend uses a separate DB (e.g., DB 1) to isolate results
        if not self.CELERY_RESULT_BACKEND:
            self.CELERY_RESULT_BACKEND = (
                f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/1"
            )
            
        return self

    @field_validator("JWT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
    @classmethod
    def check_not_empty(cls, v: str) -> str:
        """Validates that critical configuration values are not empty or whitespace."""
        if not v or not v.strip():
            raise ValueError("Configuration value cannot be empty or whitespace only")
        return v


# Instantiate the settings object for use throughout the application.
# The type: ignore suppresses linter errors about missing environment variables,
# as they will be injected by Docker Compose at runtime.
settings = Settings() # type: ignore