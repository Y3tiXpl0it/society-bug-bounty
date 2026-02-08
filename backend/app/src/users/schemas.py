# backend/app/src/users/schemas.py
import uuid
import datetime
from typing import Optional

from fastapi_users import schemas
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re
from app.src.organizations.schemas import OrganizationRead
from app.core.error_codes import ErrorCode
from pydantic_core import PydanticCustomError

# --- Schemas for Reading User Data ---

class UserDetailsReadSchema(BaseModel):
    """
    Schema for reading user details. This will be nested within the main UserRead schema
    to represent the one-to-one relationship with the UserDetails model.
    """
    username: str
    profile_info: Optional[str] = None
    avatar_url: Optional[str] = None
    last_username_change: Optional[datetime.datetime] = None
    email_notifications_enabled: bool = True
    in_app_notifications_enabled: bool = True

    # This configuration allows the Pydantic model to be created from ORM model instances.
    model_config = ConfigDict(from_attributes=True)

class UserDetailsUpdateSchema(BaseModel):
    """
    Schema for updating user details. All fields are optional to allow partial updates.
    """
    username: Optional[str] = None
    profile_info: Optional[str] = None
    avatar_url: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None
    in_app_notifications_enabled: Optional[bool] = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) < 3:
                raise PydanticCustomError(
                    ErrorCode.USER_USERNAME_TOO_SHORT,
                    'Username must be at least 3 characters long',
                    {"min_length": 3}
                )
            if len(v) > 24:
                raise PydanticCustomError(
                    ErrorCode.USER_USERNAME_TOO_LONG,
                    'Username must be at most 24 characters long',
                    {"max_length": 24}
                )
            if not re.match(r'^[a-zA-Z0-9._-]+$', v):
                 raise PydanticCustomError(
                    ErrorCode.USER_USERNAME_INVALID_PATTERN,
                    'Username contains invalid characters'
                )

            # Convert to lowercase for case-insensitive comparison
            v_lower = v.lower()
            # Reserved usernames (case-insensitive)
            reserved = {'admin', 'root', 'administrator', 'support', 'info'}
            if v_lower in reserved:
                raise PydanticCustomError(
                    ErrorCode.USER_USERNAME_RESERVED,
                    'Username is reserved and cannot be used'
                )
        return v

    @field_validator('profile_info')
    @classmethod
    def validate_profile_info(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if len(stripped) > 500:
                raise PydanticCustomError(
                    ErrorCode.USER_PROFILE_INFO_TOO_LONG,
                    'Profile info must be at most 500 characters long',
                    {"max_length": 500}
                )
            return stripped
        return v

class UserRead(schemas.BaseUser[uuid.UUID]):
    """
    The main schema for returning user information in API responses.
    It inherits base fields from fastapi-users and includes the nested user details.
    """
    is_superuser: bool = False
    details: Optional[UserDetailsReadSchema] = None

class UserReadWithOrgs(UserRead):
    """
    An extended UserRead schema that also includes the list of organizations
    the user is a member of.
    """
    organizations: list[OrganizationRead] = []

# --- Schemas for Writing User Data ---

class UserCreate(schemas.BaseUserCreate):
    """
    Schema for creating a new user. It inherits fields like email and password
    from the base fastapi-users schema. No additional fields are needed here.
    """
    pass

class UserUpdate(schemas.BaseUserUpdate):
    """
    Schema for updating a user's information. It inherits from the base
    fastapi-users schema, where all fields are optional.
    """
    pass