# backend/app/src/programs/schemas.py
"""
This module contains the Pydantic schemas for the 'programs' feature.
These schemas define the data structures for API requests and responses.
"""
import uuid
from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.src.programs.models import SeverityEnum
from app.src.organizations.schemas import OrganizationRead


# --- REWARD SCHEMAS ---

class RewardBase(BaseModel):
    """Base schema for reward data, containing shared properties."""
    severity: SeverityEnum
    amount: Annotated[int, Field(ge=0, le=2147483647)]

class RewardCreate(RewardBase):
    """Schema used to validate the data for creating a new reward."""
    pass

class RewardUpdate(BaseModel):
    """Schema for updating an existing reward's amount, identified by its severity."""
    severity: SeverityEnum
    amount: int

class RewardRead(RewardBase):
    """Schema for serializing and returning reward data in API responses."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


# --- ASSET SCHEMAS ---

class AssetTypeRead(BaseModel):
    """Schema for returning asset type data (e.g., 'URL', 'API')."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str

class ProgramAssetBase(BaseModel):
    """Base schema with shared properties for a program's asset."""
    asset_type_id: int
    identifier: Annotated[str, Field(min_length=2, max_length=255)]
    description: str | None = None

    @field_validator('identifier')
    @classmethod
    def sanitize_identifier(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Identifier cannot be empty")
        return stripped

    @field_validator('description')
    @classmethod
    def sanitize_description(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip()
        if len(stripped) > 1000:
            raise ValueError("Description must be at most 1000 characters")
        return stripped

class ProgramAssetCreate(ProgramAssetBase):
    """Schema used to validate the data for creating a new program asset."""
    asset_type_id: int
    identifier: str
    description: str | None = None

class ProgramAssetRead(ProgramAssetBase):
    """Schema for returning a program's asset, including its nested asset type for context."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    asset_type: AssetTypeRead

class AssetsBulkUpdate(BaseModel):
    """
    Defines the structure for bulk updating assets, specifying which to add and which to delete.
    """
    assets_to_add: list[ProgramAssetCreate] = []
    asset_ids_to_delete: list[uuid.UUID] = []

# --- PROGRAM SCHEMAS ---

class ProgramBase(BaseModel):
    """Base schema with shared top-level properties for a bug bounty program."""
    name: Annotated[str, Field(min_length=2, max_length=120)]
    description: str
    is_active: bool = True

    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return v.strip()

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 100:
            raise ValueError('Description must be at least 100 characters long')
        if len(stripped) > 30000:
            raise ValueError('Description must be at most 30000 characters long')
        return v

class ProgramCreate(ProgramBase):
    """
    Schema for validating the request body when creating a new program.
    It expects a list of assets and an optional list of rewards.
    """
    organization_id: uuid.UUID
    rewards: Optional[list[RewardCreate]] = None
    assets: list[ProgramAssetCreate]

class ProgramUpdate(BaseModel):
    """
    Schema for PATCH requests to update a program's top-level attributes.
    All fields are optional. This schema does not handle nested resources.
    """
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            if len(stripped) < 100:
                raise ValueError('Description must be at least 100 characters long')
            if len(stripped) > 30000:
                raise ValueError('Description must be at most 30000 characters long')
        return v

class ProgramBulkUpdate(BaseModel):
    """
    Schema for the comprehensive bulk update endpoint, allowing changes to
    program details, rewards, and assets in a single request. All fields are optional.
    """
    details: ProgramUpdate | None = None
    rewards: list[RewardUpdate] | None = None
    assets: AssetsBulkUpdate | None = None

class ProgramSummary(ProgramBase):
    """Schema for returning a summary of a program, including its rewards and organization."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    slug: str
    organization_id: uuid.UUID
    rewards: list[RewardRead]
    organization: OrganizationRead
    deleted_at: datetime | None = None

class ProgramDetail(ProgramBase): 
    """Schema for returning detailed program information, including rewards, assets, and organization."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    slug: str
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    rewards: list[RewardRead]
    assets: list[ProgramAssetRead]
    organization: OrganizationRead

class PaginatedProgramResponse(BaseModel):
    """Schema for returning a paginated list of programs."""
    total: int
    programs: list[ProgramSummary]
