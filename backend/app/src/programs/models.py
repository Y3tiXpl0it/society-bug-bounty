# backend/app/src/programs/models.py
"""
This module defines the SQLAlchemy ORM models for the 'programs' feature,
including Program, Reward, and ProgramAsset.
"""
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.sql import func
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base

# This block enables type hinting for relationships to avoid circular import errors.
# The type checker sees these imports, but they are not executed at runtime.
if TYPE_CHECKING:
    from app.src.organizations.models import Organization
    from app.src.reports.models import Report
    from app.src.asset_types.models import AssetType

# Import the association table to ensure it's registered
from app.src.reports.models import report_assets

class SeverityEnum(str, enum.Enum):
    """Enumeration for vulnerability severity levels."""
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class Program(Base):
    """Represents a bug bounty program in the database."""
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    reward_critical: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reward_high: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reward_medium: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reward_low: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # --- Relationships ---
    organization: Mapped["Organization"] = relationship("Organization", back_populates="programs")

    reports: Mapped[list["Report"]] = relationship("Report", back_populates="program")
    assets: Mapped[list["ProgramAsset"]] = relationship(
        "ProgramAsset",
        back_populates="program", cascade="all, delete-orphan"
    )

    # Ensures that a program name is unique per organization.
    __table_args__ = (
        UniqueConstraint('organization_id', 'slug', name='uq_organization_program_slug'),
    )



class ProgramAsset(Base):
    """Represents a specific asset that is in scope for a bug bounty program."""
    __tablename__ = "program_assets"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    program_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("programs.id"), nullable=False)
    asset_type_id: Mapped[int] = mapped_column(ForeignKey("asset_types.id"), nullable=False)
    
    identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    
    # --- Relationships ---
    program: Mapped["Program"] = relationship("Program", back_populates="assets")
    # Eagerly load the asset type with a JOIN to prevent lazy loading issues.
    asset_type: Mapped["AssetType"] = relationship("AssetType", back_populates="assets", lazy="joined")
    reports: Mapped[list["Report"]] = relationship(
        "Report",
        secondary=report_assets, back_populates="assets"
    )

    # Ensures that an asset identifier is unique per program.
    __table_args__ = (
        UniqueConstraint("program_id", "identifier", name="uq_program_identifier"),
    )