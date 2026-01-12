"""
Repository layer for managing attachment data in the database.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.src.attachments.models import Attachment, EntityType
from app.src.attachments.schemas import AttachmentCreate


class AttachmentRepository:
    """
    Handles database operations for attachments.

    Provides methods to create, retrieve, and query attachment records.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, attachment_data: AttachmentCreate) -> Attachment:
        """
        Saves attachment metadata to the database.
        """
        new_attachment = Attachment(**attachment_data.model_dump())
        self.session.add(new_attachment)
        await self.session.commit()
        await self.session.refresh(new_attachment)
        return new_attachment

    async def get_attachments_by_entity(self, entity_type: EntityType, entity_id: uuid.UUID) -> list[Attachment]:
        """
        Retrieves all attachments for a specific entity.
        """
        query = select(Attachment).where(
            Attachment.entity_type == entity_type,
            Attachment.entity_id == entity_id
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_attachment_by_id(self, attachment_id: uuid.UUID) -> Attachment | None:
        """
        Retrieves a single attachment by its ID.
        """
        query = select(Attachment).where(Attachment.id == attachment_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()