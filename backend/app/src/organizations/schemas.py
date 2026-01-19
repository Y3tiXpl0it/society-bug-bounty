# backend/app/src/organizations/schemas.py
"""
This module contains the Pydantic schemas that define the data structures
for the organization-related API requests and responses.
"""
import uuid
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

class OrganizationRead(BaseModel):
    """Schema for returning organization data in API responses."""
    id: uuid.UUID
    name: str
    slug: str
    logo_url: str | None = None

    # Pydantic V2 configuration to allow creating the schema from ORM model attributes.
    model_config = ConfigDict(from_attributes=True)

class OrganizationCreate(BaseModel):
    """Schema for validating the request body when creating a new organization."""
    name: str = Field(max_length=120, pattern=r"^[\w\s&.,'+\-!()\/]+$")
    logo_url: str | None = None