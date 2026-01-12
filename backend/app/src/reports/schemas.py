# backend/app/src/reports/schemas.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.src.reports.models import ReportStatus, ReportEventType
from app.src.programs.schemas import ProgramAssetRead, ProgramSummary
from app.src.attachments.schemas import AttachmentResponse

# Base properties that a hacker sends when creating a report
class ReportCreateRequest(BaseModel):
    title: str
    description: str
    severity: float = 0.0
    asset_ids: list[uuid.UUID] = []

    @field_validator('title')
    @classmethod
    def validate_title_length(cls, v: str) -> str:
        if len(v) < 5:
            raise ValueError('Title must be at least 5 characters long')
        if len(v) > 120:
            raise ValueError('Title must be at most 120 characters long')
        return v

    @field_validator('severity')
    @classmethod
    def validate_severity_range(cls, v: float) -> float:
        if not (0 <= v <= 10):
            raise ValueError('Severity must be between 0 and 10')
        return v

    @field_validator('severity')
    @classmethod
    def validate_severity_decimals(cls, v: float) -> float:
        if round(v, 1) != v:
            raise ValueError('Severity must have at most one decimal place')
        return v

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 100:
            raise ValueError('Description must be at least 100 characters long')
        if len(stripped) > 30000:
            raise ValueError('Description must be at most 30000 characters long')
        return v

# Schema for creating the report internally (with IDs)
class ReportCreate(ReportCreateRequest):
    program_id: uuid.UUID
    hacker_id: uuid.UUID


# Schema for updating only the report status (by organization members only)
class ReportStatusUpdate(BaseModel):
    status: ReportStatus

    @field_validator('status')
    @classmethod
    def validate_status_value(cls, v: ReportStatus) -> ReportStatus:
        # Additional validation if needed - status is already validated by enum
        return v

# Schema for updating only the report severity (by organization members only)
class ReportSeverityUpdate(BaseModel):
    severity: float

    @field_validator('severity')
    @classmethod
    def validate_severity_range(cls, v: float) -> float:
        if not (0 <= v <= 10):
            raise ValueError('Severity must be between 0 and 10')
        return v

    @field_validator('severity')
    @classmethod
    def validate_severity_decimals(cls, v: float) -> float:
        if round(v, 1) != v:
            raise ValueError('Severity must have at most one decimal place')
        return v

# Schema for the API response (what the client sees)
class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    program_id: uuid.UUID
    hacker_id: uuid.UUID
    hacker_name: str
    title: str
    description: str
    status: ReportStatus
    severity: float
    created_at: datetime
    updated_at: datetime
    program: ProgramSummary
    assets: list["ProgramAssetRead"] = []

# Schema for summary report data (used for listing reports in cards)
class ReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: ReportStatus
    severity: float
    hacker_name: str
    created_at: datetime

# Schema for my reports summary report data (minimal fields for my reports listing)
class ReportMyReportsSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    program_name: str
    organization_name: str
    status: ReportStatus
    severity: float
    created_at: datetime
    updated_at: datetime

class PaginatedReportSummaryResponse(BaseModel):
    """Schema for returning a paginated list of report summaries."""
    total: int
    reports: list[ReportSummary]

# Schema for creating a new comment
class ReportCommentCreate(BaseModel):
    content: str
    attachment_ids: list[uuid.UUID] = []

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 1:
            raise ValueError('Content cannot be empty')
        if len(stripped) > 10000:
            raise ValueError('Content must be at most 10000 characters long')
        return v

# Schema for the API response, showing a comment
class ReportCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime
    updated_at: datetime
    attachments: list["AttachmentResponse"] = []

# Schema for the API response, showing a report event
class ReportEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: ReportEventType
    old_value: str | None
    new_value: str | None
    created_at: datetime
    user_name: str | None = None
    user_avatar_url: str | None = None
    comment: ReportCommentResponse | None = None