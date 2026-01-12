# backend/app/src/asset_types/schemas.py
from pydantic import BaseModel, ConfigDict

class AssetTypeRead(BaseModel):
    """Schema for returning asset type data (e.g., 'URL', 'API')."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    description: str | None = None