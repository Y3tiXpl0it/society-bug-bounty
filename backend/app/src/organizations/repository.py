# app/src/organizations/repository.py
"""
Repository layer for handling all organization-related database operations.
This class contains the direct SQLAlchemy queries.
"""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from slugify import slugify

from app.src.organizations.models import Organization
from app.src.users.models import User
from app.core.exceptions import NotFoundException

class OrganizationRepository:
    def __init__(self, session: AsyncSession):
        """
        Initializes the repository with a database session.
        """
        self.session = session

    async def get_by_id(self, org_id: uuid.UUID) -> Organization | None:
        """Retrieves a single organization by its primary key."""
        return await self.session.get(Organization, org_id)

    async def get_by_name(self, name: str) -> Organization | None:
        """Retrieves a single organization by its unique name."""
        result = await self.session.execute(
            select(Organization).where(Organization.name == name)
        )
        return result.scalar_one_or_none()
    
    async def get_by_slug(self, slug: str) -> Organization | None:
        """Retrieves a single organization by its unique slug."""
        result = await self.session.execute(
            select(Organization).where(Organization.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_by_id_with_members(self, org_id: uuid.UUID) -> Organization:
        """
        Retrieves an organization by ID, eagerly loading its member list.
        """
        result = await self.session.execute(
            select(Organization)
            .where(Organization.id == org_id)
            .options(selectinload(Organization.members))
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundException("Organization not found")
        return org

    async def create(self, name: str, logo_url: str | None = None) -> Organization:
        """
        Creates and commits a new organization to the database.
        """
        org_slug = slugify(name)
        new_org = Organization(name=name, slug=org_slug, logo_url=logo_url)
        self.session.add(new_org)
        await self.session.commit()
        await self.session.refresh(new_org)
        return new_org

    async def add_user_to_org(self, user: User, organization: Organization):
        """Adds a user to an organization's member list if not already present."""
        if user not in organization.members:
            organization.members.append(user)
            await self.session.commit()
    
    async def remove_user_from_org(self, user: User, organization: Organization):
        """Removes a user from an organization's member list if present."""
        if user in organization.members:
            organization.members.remove(user)
            await self.session.commit()