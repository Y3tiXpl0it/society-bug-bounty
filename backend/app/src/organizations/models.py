# backend/app/src/organizations/models.py
"""
This module defines the SQLAlchemy ORM models for the 'organizations' feature,
including the main Organization table and the many-to-many membership table.
"""
import uuid
from typing import TYPE_CHECKING
from sqlalchemy import (
    ForeignKey,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

# This block enables type hinting for relationships to avoid circular import errors.
if TYPE_CHECKING:
    from app.src.users.models import User
    from app.src.programs.models import Program

# --- Association Table ---
class UserOrganizationMembership(Base):
    """
    An association table to manage the many-to-many relationship
    between Users and Organizations.
    """
    __tablename__ = "user_organization_memberships"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="cascade"), primary_key=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="cascade"), primary_key=True)

# --- Main Model ---
class Organization(Base):
    """Represents an organization in the database."""
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(255))
    
    # --- Relationships ---
    members: Mapped[list["User"]] = relationship(
        "User",
        secondary="user_organization_memberships",
        back_populates="organizations"
    )
    programs: Mapped[list["Program"]] = relationship("Program", back_populates="organization")