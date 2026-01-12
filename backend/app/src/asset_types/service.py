# backend/app/src/asset_types/service.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.src.asset_types.repository import AssetTypeRepository
from app.src.asset_types.models import AssetType

class AssetTypeService:
    def __init__(self, session: AsyncSession):
        self.repository = AssetTypeRepository(session)

    async def get_all_asset_types(self) -> list[AssetType]:
        """Retrieves all asset types."""
        return await self.repository.get_all()