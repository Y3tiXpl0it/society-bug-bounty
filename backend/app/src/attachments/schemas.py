"""
Pydantic schemas for attachment data validation and serialization.
"""
import uuid
from datetime import datetime

from app.src.attachments.models import EntityType
from pydantic import BaseModel, ConfigDict, Field


class AttachmentCreate(BaseModel):
    """
    Schema for creating an attachment record in the database (internal use).

    Contains all necessary fields to store attachment metadata.
    """
    entity_type: EntityType = Field(description="Type of entity the attachment belongs to (e.g., 'report', 'report_comment', 'program')")
    entity_id: uuid.UUID = Field(description="ID of the entity the attachment belongs to")
    uploader_id: uuid.UUID
    file_path: str
    file_name: str = Field(max_length=255)
    mime_type: str
    file_size: int
    checksum: str


class AttachmentResponse(BaseModel):
    """
    Schema for API responses containing attachment information (client-facing).

    Includes fields visible to the client, excluding sensitive internal data.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    uploader_id: uuid.UUID
    file_name: str
    mime_type: str
    file_size: int
    created_at: datetime