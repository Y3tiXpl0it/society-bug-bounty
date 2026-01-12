# backend/app/src/asset_types/routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.src.asset_types.schemas import AssetTypeRead
from app.src.asset_types.service import AssetTypeService

router = APIRouter(prefix="/asset_types", tags=["asset_types"])

@router.get("/", response_model=list[AssetTypeRead])
async def get_all_asset_types(
    session: AsyncSession = Depends(get_session)
):
    """
    (Public) Gets a list of all available asset types for programs.
    """
    return await AssetTypeService(session).get_all_asset_types()