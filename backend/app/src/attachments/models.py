"""
Database models for file attachments in reports.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import TIMESTAMP

from app.core.database import Base


class EntityType(str, Enum):
    """
    Enum for entity types that can have attachments.
    """
    REPORT = "report"
    REPORT_COMMENT = "report_comment"
    PROGRAM = "program"

if TYPE_CHECKING:
    from app.src.reports.models import Report, ReportComment
    from app.src.users.models import User


class Attachment(Base):
    """
    Represents a file attachment uploaded to any entity (reports, comments, programs, etc.).
    """
    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Generic entity reference
    entity_type: Mapped[EntityType] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    uploader_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)

    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hash

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    uploader: Mapped["User"] = relationship("User", back_populates="attachments")

    # Generic relationships (back references)
    report: Mapped["Report"] = relationship(
        "Report",
        primaryjoin=f"and_(foreign(Attachment.entity_id) == Report.id, Attachment.entity_type == '{EntityType.REPORT}')",
        back_populates="attachments",
        viewonly=True
    )
    comment: Mapped["ReportComment"] = relationship(
        "ReportComment",
        primaryjoin=f"and_(foreign(Attachment.entity_id) == ReportComment.id, Attachment.entity_type == '{EntityType.REPORT_COMMENT}')",
        back_populates="attachments",
        viewonly=True
    )

    __table_args__ = (
        Index('ix_attachments_entity_type_entity_id', 'entity_type', 'entity_id'),
    )
    