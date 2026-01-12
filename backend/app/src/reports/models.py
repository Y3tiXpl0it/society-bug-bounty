# backend/app/src/reports/models.py
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Column,
    Enum,
    Float,
    ForeignKey,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import TIMESTAMP

from app.core.database import Base

# Association table for many-to-many relationship between reports and program_assets
report_assets = Table(
    "report_assets",
    Base.metadata,
    Column("report_id", UUID(as_uuid=True), ForeignKey("reports.id"), primary_key=True),
    Column("program_asset_id", UUID(as_uuid=True), ForeignKey("program_assets.id"), primary_key=True),
)

if TYPE_CHECKING:
    from app.src.programs.models import Program, ProgramAsset
    from app.src.users.models import User
    from app.src.attachments.models import Attachment

class ReportStatus(str, enum.Enum):
    received = "received"
    in_review = "in_review"
    accepted = "accepted"
    rejected = "rejected"
    duplicate = "duplicate"
    out_of_scope = "out_of_scope"
    resolved = "resolved"


class ReportEventType(str, enum.Enum):
    report_created = "report_created"
    status_change = "status_change"
    severity_change = "severity_change"
    comment = "comment"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id"), nullable=False)
    hacker_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="report_status_enum"),
        default=ReportStatus.received,
        nullable=False,
    )
    severity: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    program: Mapped["Program"] = relationship("Program", back_populates="reports")
    hacker: Mapped["User"] = relationship("User", back_populates="reports")
    comments: Mapped[list["ReportComment"]] = relationship("ReportComment", back_populates="report")
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment",
        primaryjoin="and_(Report.id == foreign(Attachment.entity_id), Attachment.entity_type == 'report')",
        back_populates="report"
    )
    assets: Mapped[list["ProgramAsset"]] = relationship(
        "ProgramAsset",
        secondary=report_assets, back_populates="reports"
    )
    events: Mapped[list["ReportEvent"]] = relationship("ReportEvent", back_populates="report")


class ReportComment(Base):
    __tablename__ = "report_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    report: Mapped["Report"] = relationship("Report", back_populates="comments")
    author: Mapped["User"] = relationship("User", back_populates="comments")
    event: Mapped["ReportEvent"] = relationship("ReportEvent", back_populates="comment")
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment",
        primaryjoin="and_(ReportComment.id == foreign(Attachment.entity_id), Attachment.entity_type == 'report_comment')",
        back_populates="comment",
        overlaps="attachments"
    )


class ReportEvent(Base):
    __tablename__ = "report_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)

    event_type: Mapped[ReportEventType] = mapped_column(
        Enum(ReportEventType, name="report_event_type_enum"),
        nullable=False,
    )
    old_value: Mapped[str] = mapped_column(Text, nullable=True)
    new_value: Mapped[str] = mapped_column(Text, nullable=True)
    comment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_comments.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    report: Mapped["Report"] = relationship("Report", back_populates="events")
    user: Mapped["User"] = relationship("User", back_populates="report_events")
    comment: Mapped["ReportComment"] = relationship("ReportComment", back_populates="event")