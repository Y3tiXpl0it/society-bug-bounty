# backend/app/src/asset_types/models.py
from typing import TYPE_CHECKING
from sqlalchemy import (
    Integer,
    String,
    Text,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.src.programs.models import ProgramAsset

class AssetType(Base):
    """Represents a type of asset (e.g., 'URL', 'API'). This is a lookup table."""
    __tablename__ = "asset_types"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True) # Autoincrement by default
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    
    # Relationship to all assets of this type.
    assets: Mapped[list["ProgramAsset"]] = relationship("ProgramAsset", back_populates="asset_type")