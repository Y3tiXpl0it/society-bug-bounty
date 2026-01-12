# backend/app/src/attachments/service.py
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.src.attachments.models import Attachment, EntityType
from app.src.attachments.repository import AttachmentRepository
from app.src.attachments.schemas import AttachmentCreate
from app.src.users.models import User
from app.utils.image_upload_service import ImageUploadService

# Directory for storing uploaded attachment files
UPLOAD_DIR = Path("media/attachments")

# Maximum allowed file size (10 MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


class AttachmentService:
    """
    Service layer for attachment operations.

    Handles file uploads, storage, and retrieval of attachment metadata.
    """

    def __init__(self, session: AsyncSession):
        self.repository = AttachmentRepository(session)

    async def upload_attachment(
        self, entity_type: EntityType, entity_id: uuid.UUID, uploader: User, file
    ) -> Attachment:
        """
        Uploads a file and creates an attachment record.

        Saves the file to disk, computes its checksum, and stores metadata in the database.

        Args:
            entity_type: The type of entity to attach the file to (e.g., 'report', 'report_comment', 'program').
            entity_id: The ID of the entity to attach the file to.
            uploader: The user uploading the file.
            file: The uploaded file object.

        Returns:
            The created Attachment instance.
        """
        # Use centralized image upload service
        upload_result = await ImageUploadService.validate_and_save_image(
            file=file,
            upload_dir=UPLOAD_DIR,
            max_size=MAX_FILE_SIZE
        )

        attachment_data = AttachmentCreate(
            entity_type=entity_type,
            entity_id=entity_id,
            uploader_id=uploader.id,
            file_path=upload_result["file_path"],
            file_name=upload_result["file_name"],
            mime_type=upload_result["mime_type"],
            file_size=upload_result["file_size"],
            checksum=upload_result["checksum"],
        )

        return await self.repository.create(attachment_data)


    async def get_attachments_by_entity(self, entity_type: EntityType, entity_id: uuid.UUID) -> list[Attachment]:
        """
        Retrieves all attachments for a specific entity.

        Args:
            entity_type: The type of entity.
            entity_id: The ID of the entity.

        Returns:
            A list of Attachment instances.
        """
        return await self.repository.get_attachments_by_entity(entity_type, entity_id)

    async def get_attachment_by_id(self, attachment_id: uuid.UUID) -> Attachment | None:
        """
        Retrieves a single attachment by its ID.

        Args:
            attachment_id: The unique ID of the attachment.

        Returns:
            The Attachment instance if found, otherwise None.
        """
        return await self.repository.get_attachment_by_id(attachment_id)
