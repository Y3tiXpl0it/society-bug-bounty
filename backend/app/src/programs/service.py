# backend/app/src/programs/service.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.src.programs.models import Program
from app.src.programs.repository import ProgramRepository
from app.src.programs.schemas import ProgramBulkUpdate, ProgramCreate
from app.core.exceptions import AlreadyExistsException, AlreadyExistsException

class ProgramService:
    """
    Service layer that orchestrates the business logic for programs.
    It uses the ProgramRepository to interact with the database.
    """

    def __init__(self, session: AsyncSession):
        """
        Initializes the service with a database session.

        Args:
            session: The SQLAlchemy AsyncSession for database communication.
        """
        self.repository = ProgramRepository(session)

    async def create_program(self, program_data: ProgramCreate) -> Program:
        """
        Orchestrates the creation of a new program. This includes business
        rules such as checking for duplicate names and asset identifiers.

        Args:
            program_data: The schema containing the program creation details.
        Returns:
            The newly created Program database object.
        """
        # Check if a program with the same name already exists.
        existing_program = await self.repository.get_by_name(
            program_data.name,
            program_data.organization_id
        )
        if existing_program:
            raise AlreadyExistsException(
                f"A program with the name '{program_data.name}' already exists in this organization."
            )
        
        # Business Rule: Check for duplicate asset identifiers within the request payload.
        if program_data.assets:
            identifiers = [asset.identifier for asset in program_data.assets]
            if len(identifiers) != len(set(identifiers)):
                raise AlreadyExistsException(
                    "The request contains duplicate asset identifiers."
                )
        
        return await self.repository.create(program_data)

    async def get_program_by_id(self, program_id: uuid.UUID) -> Program:
        """
        Retrieves a single program by its unique ID.

        Args:
            program_id: The UUID of the program to retrieve.

        Returns:
            The Program database object.
        """
        return await self.repository.get_by_id(program_id)

    async def get_all_programs(self, skip: int = 0, limit: int = 100) -> tuple[list[Program], int]:
        """
        Retrieves a paginated list of all programs.

        Args:
            skip: The number of programs to skip for pagination.
            limit: The maximum number of programs to return.

        Returns:
            A list of Program database objects.
        """
        return await self.repository.get_all(skip, limit)

    async def delete_program(self, program_id: uuid.UUID) -> None:
        """
        Deletes a program by its unique ID.

        Args:
            program_id: The UUID of the program to delete.
        """
        await self.repository.delete(program_id)

    async def get_programs_for_organization(self, organization_id: uuid.UUID) -> list[Program]:
        """
        Retrieves all programs belonging to a specific organization.

        Args:
            organization_id: The UUID of the owning organization.
        
        Returns:
            A list of Program database objects.
        """
        return await self.repository.get_by_organization_id(organization_id)
    
    async def bulk_update_program(self, program_id: uuid.UUID, update_data: ProgramBulkUpdate) -> Program:
        """
        Orchestrates the comprehensive update of a program, including its details,
        rewards, and assets.

        Args:
            program_id: The UUID of the program to update.
            update_data: A schema containing the changes.
        
        Returns:
            The fully updated Program database object.
        """
        # Note: Business logic for bulk updates (like checking for duplicate
        # assets) is handled within the repository for this specific endpoint.
        return await self.repository.bulk_update(program_id, update_data)