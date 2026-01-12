# backend/app/src/organizations/service.py
import uuid
from pydantic import HttpUrl, TypeAdapter, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify

from fastapi_users.exceptions import UserNotExists
from app.src.users.manager import UserManager
from app.core.exceptions import AlreadyExistsException, NotFoundException, BadRequestException

from app.src.organizations.repository import OrganizationRepository
from app.src.organizations.schemas import OrganizationCreate
from app.src.organizations.models import Organization


class OrganizationService:
    """
    Service layer for orchestrating business logic related to organizations.
    It acts as an intermediary between the API layer (routes) and the data layer (repository).
    """

    def __init__(self, session: AsyncSession, user_manager: UserManager):
        """
        Initializes the service with a database session and a user manager.

        Args:
            session: The SQLAlchemy AsyncSession for database communication.
            user_manager: The application's custom UserManager for user-related operations.
        """
        self.repository = OrganizationRepository(session)
        self.user_manager = user_manager


    async def create_organization(self, name: str, logo_url: str | None) -> Organization:
        """
        Creates a new organization after validating the input and checking for duplicates.

        Args:
            name: The name for the new organization.
            logo_url: An optional URL for the organization's logo.

        Returns:
            The newly created Organization database object.

        Raises:
            BadRequestException: If the provided logo_url is not a valid URL.
            AlreadyExistsException: If an organization with the same name already exists.
        """
        validated_logo_url = None
        if logo_url:
            try:
                # Explicitly validate the raw string as a Pydantic HttpUrl.
                adapter = TypeAdapter(HttpUrl)
                validated_logo_url = adapter.validate_python(logo_url)
            except ValidationError:
                raise BadRequestException(f"Invalid logo URL provided: {logo_url}")

        # Use the validated Pydantic model for internal consistency.
        org_data = OrganizationCreate(name=name, logo_url=validated_logo_url)

        # Check for existing organization with the same name.
        existing_org = await self.repository.get_by_name(org_data.name)
        if existing_org:
            raise AlreadyExistsException(
                f"An organization with the name '{org_data.name}' already exists."
            )
        
        # Generate slug and check for uniqueness.
        org_slug = slugify(org_data.name)
        existing_org_by_slug = await self.repository.get_by_slug(org_slug)
        if existing_org_by_slug:
            raise AlreadyExistsException(
                f"An organization with a similar name already exists, resulting in a duplicate URL."
            )
        
        # Pass the plain string to the repository layer.
        logo_url_str = str(org_data.logo_url) if org_data.logo_url else None
        
        return await self.repository.create(org_data.name, logo_url_str)


    async def get_organization(self, org_id: uuid.UUID) -> Organization:
        """
        Retrieves a single organization by its unique ID, including its members.

        Args:
            org_id: The UUID of the organization to retrieve.

        Returns:
            The Organization database object with its members eagerly loaded.

        Raises:
            NotFoundException: If the organization is not found.
        """
        org = await self.repository.get_by_id_with_members(org_id)
        if not org:
            raise NotFoundException("Organization not found")
        return org
    

    async def add_user_to_organization(self, email: str, org_slug: str):
        """
        Adds a user to an organization by their email and the organization's slug.

        Args:
            email: The email of the user to add.
            org_slug: The slug of the organization to which the user will be added.
        """
        try:
            user = await self.user_manager.get_by_email(email)
        except UserNotExists:
            raise NotFoundException(f"User with email '{email}' not found.")

        org = await self.repository.get_by_slug(org_slug) # <-- Buscar por slug
        if not org:
            raise NotFoundException(f"Organization '{org_slug}' not found.")

        org_with_members = await self.repository.get_by_id_with_members(org.id)
        await self.repository.add_user_to_org(user, org_with_members)


    async def remove_user_from_organization(self, email: str, org_slug: str):
        """
        Removes a user from an organization by their email and the organization's slug.

        Args:
            email: The email of the user to remove.
            org_slug: The slug of the organization from which the user will be removed.
        """
        try:
            user = await self.user_manager.get_by_email(email)
        except UserNotExists:
            raise NotFoundException(f"User with email '{email}' not found.")

        org = await self.repository.get_by_slug(org_slug) # <-- Buscar por slug
        if not org:
            raise NotFoundException(f"Organization '{org_slug}' not found.")

        org_with_members = await self.repository.get_by_id_with_members(org.id)
        await self.repository.remove_user_from_org(user, org_with_members)