# backend/app/src/asset_types/repository.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.src.asset_types.models import AssetType

class AssetTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> list[AssetType]:
        """Fetches all asset types from the database."""
        query = select(AssetType).order_by(AssetType.id)
        result = await self.session.execute(query)
        return list(result.scalars().all())