# backend/app/src/programs/service.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.src.programs.models import Program
from app.src.programs.repository import ProgramRepository
from app.src.programs.schemas import ProgramBulkUpdate, ProgramCreate
from app.core.exceptions import AlreadyExistsException, NotFoundException
from app.core.error_codes import ErrorCode
from app.src.organizations.repository import OrganizationRepository
from app.src.users.models import User

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
            raise AlreadyExistsException(detail={
                "code": ErrorCode.PROGRAM_ALREADY_EXISTS,
                "message": f"A program with the name '{program_data.name}' already exists in this organization."
            })
        
        # Business Rule: Check for duplicate asset identifiers within the request payload.
        if program_data.assets:
            identifiers = [asset.identifier for asset in program_data.assets]
            if len(identifiers) != len(set(identifiers)):
                raise AlreadyExistsException(detail={
                    "code": ErrorCode.DUPLICATE_ASSET_IDENTIFIERS,
                    "message": "The request contains duplicate asset identifiers."
                })
        
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
    
    async def get_program_with_access_check(
        self,
        organization_slug: str,
        program_slug: str,
        user: User | None = None
    ) -> Program:
        """
        Retrieves a program by slug and organization slug, verifying existence and access permissions.
        
        Rules:
        1. Org must exist.
        2. Program must exist within Org.
        3. If Program is inactive, User must be a member of the Org to view it.
        """
        org_repo = OrganizationRepository(self.repository.session)
        organization = await org_repo.get_by_slug(organization_slug)
        if not organization:
            raise NotFoundException(detail={
                "code": ErrorCode.ORGANIZATION_NOT_FOUND,
                "message": "Organization not found"
            })

        program = await self.repository.get_by_slug(program_slug, organization.id)
        if not program:
            raise NotFoundException(detail={
                "code": ErrorCode.PROGRAM_NOT_FOUND,
                "message": "Program not found"
            })

        if program.is_active:
            return program

        # If program is not active, strict checks apply
        if not user:
            raise NotFoundException(detail={
                "code": ErrorCode.PROGRAM_NOT_FOUND,
                "message": "Program not found"
            })

        user_org_ids = {org.id for org in user.organizations}
        if organization.id not in user_org_ids:
            raise NotFoundException(detail={
                "code": ErrorCode.PROGRAM_NOT_FOUND,
                "message": "Program not found"
            })

        return program