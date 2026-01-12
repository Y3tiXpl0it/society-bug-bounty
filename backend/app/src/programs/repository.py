# backend/app/src/programs/repository.py

from datetime import datetime
import uuid

from sqlalchemy import and_, select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.core.exceptions import NotFoundException, AlreadyExistsException, BadRequestException
from app.core.logging import get_logger
from app.src.programs.models import Program, ProgramAsset, Reward, SeverityEnum
from app.src.programs.schemas import ProgramBulkUpdate, ProgramCreate
from slugify import slugify

logger = get_logger(__name__)


class ProgramRepository:
    """Repository for handling all program-related database operations."""

    def __init__(self, session: AsyncSession):
        """
        Initializes the repository with a database session.
        """
        self.session = session


    async def get_by_name(self, name: str, organization_id: uuid.UUID) -> Program | None:
        """
        Retrieves a single program by its name within a specific organization.
        """
        result = await self.session.execute(
            select(Program).where(
                and_(
                    func.lower(Program.name) == func.lower(name),
                    Program.organization_id == organization_id
                )
            )
        )
        return result.scalar_one_or_none()


    async def get_by_slug(self, slug: str, organization_id: uuid.UUID) -> Program | None:
        """
        Retrieves a single program by its slug within a specific organization.
        """
        query = (
            select(Program)
            .where(
                and_(
                    Program.slug == slug,
                    Program.organization_id == organization_id,
                    Program.deleted_at.is_(None)
                )
            )
            .options(
                selectinload(Program.rewards),
                selectinload(Program.assets).selectinload(ProgramAsset.asset_type),
                joinedload(Program.organization)
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()


    async def _check_duplicate_assets(self, program_id: uuid.UUID, assets_to_check: list):
        """
        Helper function to verify that a list of new assets don't already exist in a program.
        """
        if not assets_to_check:
            return

        identifiers_to_check = {asset.identifier for asset in assets_to_check}

        query = select(ProgramAsset).where(
            and_(
                ProgramAsset.program_id == program_id,
                ProgramAsset.identifier.in_(identifiers_to_check),
            )
        )
        existing_assets = await self.session.execute(query)
        existing_list = list(existing_assets.scalars().all())

        first_duplicate = existing_assets.scalars().first()
        if first_duplicate:
            raise AlreadyExistsException(
                f"Asset with identifier '{first_duplicate.identifier}' already exists in this program."
            )


    async def create(self, program_data: ProgramCreate) -> Program:
        """
        Creates a new program, its assets, and its rewards in the database.
        If rewards are not provided, default tiers are created with an amount of 0.
        """
        # Note: The check for duplicate program name is handled in the service layer.
        
        program_dict = program_data.model_dump(exclude={"rewards", "assets"})
        program_dict['slug'] = slugify(program_data.name)
        program = Program(**program_dict)
        self.session.add(program)
        
        if program_data.rewards:
            for reward_item in program_data.rewards:
                reward = Reward(**reward_item.model_dump(), program=program)
                self.session.add(reward)
        else:
            default_severities = [
                SeverityEnum.critical, SeverityEnum.high,
                SeverityEnum.medium, SeverityEnum.low,
            ]
            for severity in default_severities:
                reward = Reward(severity=severity, amount=0, program=program)
                self.session.add(reward)

        for asset_item in program_data.assets:
            asset = ProgramAsset(**asset_item.model_dump(), program=program)
            self.session.add(asset)

        # The UniqueConstraint on the model will automatically prevent duplicate assets
        # within this creation transaction upon commit.
        await self.session.commit()
        await self.session.refresh(program, attribute_names=["rewards", "assets"])
        return program


    async def get_by_id(self, program_id: uuid.UUID) -> Program:
        """
        Retrieves a single program by its ID, eagerly loading its rewards and assets.
        """
        query = (
            select(Program)
            .where(Program.id == program_id)
            .options(selectinload(Program.rewards), selectinload(Program.assets))
        )
        result = await self.session.execute(query)
        program = result.scalar_one_or_none()

        if not program:
            raise NotFoundException("Program not found")
        return program


    async def get_all(self, skip: int = 0, limit: int = 100) -> tuple[list[Program], int]:
        """
        Retrieves a paginated list of all active programs.
        """
        base_filter = and_(Program.is_active == True, Program.deleted_at.is_(None))
        
        paginated_query = (
            select(Program)
            .where(base_filter)
            .offset(skip)
            .limit(limit)
            .options(
                selectinload(Program.rewards),
                joinedload(Program.organization)
            )
        )
        paginated_result = await self.session.execute(paginated_query)
        programs = list(paginated_result.scalars().all())

        total_query = select(func.count()).select_from(Program).where(Program.is_active == True)
        total_result = await self.session.execute(total_query)
        total = total_result.scalar_one()

        return programs, total


    async def delete(self, program_id: uuid.UUID) -> None:
        """
        Deletes a program by its ID. Child resources (rewards, assets) are
        deleted automatically via cascading database rules.
        """
        program = await self.get_by_id(program_id)
        
        program.deleted_at = datetime.now()
        program.is_active = False
        
        self.session.add(program)
        await self.session.commit()


    async def get_by_organization_id(self, organization_id: uuid.UUID) -> list[Program]:
        """
        Retrieves all programs for a specific organization.
        """
        query = (
            select(Program)
            .where(
                and_(
                    Program.organization_id == organization_id,
                    Program.deleted_at.is_(None)
                ))
            .options(
                selectinload(Program.rewards), 
                selectinload(Program.assets),
                joinedload(Program.organization)
            )
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())


    async def bulk_update(self, program_id: uuid.UUID, update_data: ProgramBulkUpdate) -> Program:
        """
        Performs a comprehensive update of a program's details, rewards, and
        assets within a single transaction.
        """
        program_to_update = await self.get_by_id(program_id)

        # Update program details if provided.
        if update_data.details:
            details_data = update_data.details.model_dump(exclude_unset=True)
            for key, value in details_data.items():
                setattr(program_to_update, key, value)

        # Update reward amounts if provided.
        if update_data.rewards is not None:
            existing_rewards_map = {reward.severity: reward for reward in program_to_update.rewards}
            for reward_update in update_data.rewards:
                if reward_update.severity in existing_rewards_map:
                    existing_rewards_map[reward_update.severity].amount = reward_update.amount

        # Add or delete assets if provided.
        if update_data.assets:
            current_asset_count = len(program_to_update.assets)
            delete_count = len(update_data.assets.asset_ids_to_delete)
            add_count = len(update_data.assets.assets_to_add)
            final_asset_count = current_asset_count - delete_count + add_count

            if final_asset_count < 1:
                raise BadRequestException("A program must have at least one asset.")

            # Delete specified assets.
            if update_data.assets.asset_ids_to_delete:
                delete_stmt = (
                    delete(ProgramAsset)
                    .where(ProgramAsset.program_id == program_id)
                    .where(ProgramAsset.id.in_(update_data.assets.asset_ids_to_delete))
                )
                await self.session.execute(delete_stmt)

            # Check for duplicates after deletion
            if update_data.assets.assets_to_add:
                await self._check_duplicate_assets(program_id, update_data.assets.assets_to_add)

            # Add new assets.
            if update_data.assets.assets_to_add:
                new_assets = [
                    ProgramAsset(**asset.model_dump(), program_id=program_id)
                    for asset in update_data.assets.assets_to_add
                ]
                self.session.add_all(new_assets)

        await self.session.commit()

        # Re-fetch the entire program to return the clean, updated state.
        final_program_state = await self.get_by_id(program_id)
        
        return final_program_state