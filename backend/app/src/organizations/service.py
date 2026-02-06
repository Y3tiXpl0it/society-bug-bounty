# backend/app/src/organizations/service.py
import uuid
from pydantic import HttpUrl, TypeAdapter, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify
from fastapi import UploadFile
from pathlib import Path
from app.core.config import settings

from fastapi_users.exceptions import UserNotExists
from app.src.users.manager import UserManager
from app.core.exceptions import AlreadyExistsException, NotFoundException, BadRequestException
from app.core.error_codes import ErrorCode

from app.src.organizations.repository import OrganizationRepository
from app.src.organizations.schemas import OrganizationCreate
from app.src.organizations.models import Organization
from app.utils.image_upload_service import ImageUploadService


class OrganizationService:
    """
    Service layer for orchestrating business logic related to organizations.
    It acts as an intermediary between the API layer (routes) and the data layer (repository).
    """

    def __init__(self, session: AsyncSession, user_manager: UserManager):
        """
        Initializes the service with a database session and a user manager.
        """
        self.repository = OrganizationRepository(session)
        self.user_manager = user_manager
        self.image_service = ImageUploadService()


    async def create_organization(self, name: str, logo_url: str | None) -> Organization:
        """
        Creates a new organization after validating the input and checking for duplicates.
        """
        validated_logo_url = None
        if logo_url:
            try:
                # Explicitly validate the raw string as a Pydantic HttpUrl.
                adapter = TypeAdapter(HttpUrl)
                validated_logo_url = adapter.validate_python(logo_url)
            except ValidationError:
                raise BadRequestException(detail={
                    "code": ErrorCode.INVALID_LOGO_URL,
                    "message": f"Invalid logo URL provided: {logo_url}",
                    "params": {"url": logo_url}
                })

        # Use the validated Pydantic model for internal consistency.
        org_data = OrganizationCreate(name=name, logo_url=validated_logo_url)

        # Check for existing organization with the same name.
        existing_org = await self.repository.get_by_name(org_data.name)
        if existing_org:
            raise AlreadyExistsException(detail={
                "code": ErrorCode.ORGANIZATION_ALREADY_EXISTS,
                "message": f"An organization with the name '{org_data.name}' already exists.",
                "params": {"name": org_data.name}
            })
        
        # Generate slug and check for uniqueness.
        org_slug = slugify(org_data.name)
        existing_org_by_slug = await self.repository.get_by_slug(org_slug)
        if existing_org_by_slug:
            raise AlreadyExistsException(detail={
                "code": ErrorCode.ORGANIZATION_ALREADY_EXISTS,
                "message": "An organization with a similar name already exists, resulting in a duplicate URL.",
                "params": {"name": org_data.name}
            })
        
        # Pass the plain string to the repository layer.
        logo_url_str = str(org_data.logo_url) if org_data.logo_url else None
        
        return await self.repository.create(org_data.name, logo_url_str)


    async def get_organization(self, org_id: uuid.UUID) -> Organization:
        """
        Retrieves a single organization by its unique ID, including its members.
        """
        org = await self.repository.get_by_id_with_members(org_id)
        if not org:
            raise NotFoundException(detail={
                "code": ErrorCode.ORGANIZATION_NOT_FOUND,
                "message": "Organization not found"
            })
        return org
    

    async def add_user_to_organization(self, email: str, org_slug: str):
        """
        Adds a user to an organization by their email and the organization's slug.
        """
        try:
            user = await self.user_manager.get_by_email(email)
        except UserNotExists:
            raise NotFoundException(detail={
                "code": ErrorCode.USER_NOT_FOUND,
                "message": f"User with email '{email}' not found.",
                "params": {"email": email}
            })

        org = await self.repository.get_by_slug(org_slug) # <-- Search by slug
        if not org:
            raise NotFoundException(detail={
                "code": ErrorCode.ORGANIZATION_NOT_FOUND,
                "message": f"Organization '{org_slug}' not found.",
                "params": {"slug": org_slug}
            })

        org_with_members = await self.repository.get_by_id_with_members(org.id)
        await self.repository.add_user_to_org(user, org_with_members)


    async def remove_user_from_organization(self, email: str, org_slug: str):
        """
        Removes a user from an organization by their email and the organization's slug.
        """
        try:
            user = await self.user_manager.get_by_email(email)
        except UserNotExists:
            raise NotFoundException(detail={
                "code": ErrorCode.USER_NOT_FOUND,
                "message": f"User with email '{email}' not found.",
                "params": {"email": email}
            })

        org = await self.repository.get_by_slug(org_slug) # <-- Search by slug
        if not org:
            raise NotFoundException(detail={
                "code": ErrorCode.ORGANIZATION_NOT_FOUND,
                "message": f"Organization '{org_slug}' not found.",
                "params": {"slug": org_slug}
            })

        org_with_members = await self.repository.get_by_id_with_members(org.id)
        await self.repository.remove_user_from_org(user, org_with_members)


    async def upload_logo(self, org_slug: str, file: UploadFile) -> Organization:
        """
        Process the logo upload for an existing organization.
        Handles validation, old file cleanup, saving new file, and DB update.
        """
        # 1. Find the organization
        org = await self.repository.get_by_slug(org_slug)
        if not org:
            raise NotFoundException(detail={
                "code": ErrorCode.ORGANIZATION_NOT_FOUND,
                "message": f"Organization '{org_slug}' not found.",
                "params": {"slug": org_slug}
            })

        # If a logo already exists, we try to delete the old physical file
        if org.logo_url:
            # org.logo_url is usually "/media/organizations/abc.jpg"
            # .lstrip("/") converts it to "media/organizations/abc.jpg" so that Path can find it
            old_logo_path = Path(str(org.logo_url).lstrip("/"))

            if old_logo_path.exists():
                try:
                    old_logo_path.unlink() # Deletes the file
                except OSError:
                    # Log error but do not stop the flow if deletion fails
                    pass

        # 2. Define path
        upload_dir = Path("media/organizations")

        # 3. Upload new image
        image_data = await ImageUploadService.validate_and_save_image(
            file=file,
            upload_dir=upload_dir,
            max_size=settings.MAX_LOGO_SIZE,
            allowed_extensions=settings.ALLOWED_IMAGE_EXTENSIONS
        )

        # 4. Build relative URL
        file_name = Path(image_data["file_path"]).name
        relative_url = f"/media/organizations/{file_name}"

        # 5. Update DB
        return await self.repository.update(org, {"logo_url": relative_url})