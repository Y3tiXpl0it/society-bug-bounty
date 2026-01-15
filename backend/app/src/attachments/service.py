# backend/app/src/attachments/service.py
import uuid
from pathlib import Path

from fastapi import UploadFile
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
    

    async def upload_multiple_attachments(
        self,
        entity_type: EntityType,
        entity_id: uuid.UUID,
        uploader: User,
        files: list[UploadFile]
    ) -> list[Attachment]:
        """
        Uploads a list of files atomically.
        If one fails, delete the physical files that have been successfully uploaded
        before throwing the error, to avoid leaving garbage on the server.
        """
        uploaded_attachments = []
        uploaded_paths_for_rollback = []

        try:
            for file in files:
                # We reuse your individual logic
                attachment = await self.upload_attachment(entity_type, entity_id, uploader, file)

                uploaded_attachments.append(attachment)
                # We save the physical path in case we need to delete
                uploaded_paths_for_rollback.append(Path(attachment.file_path))
            
            return uploaded_attachments

        except Exception as e:
            # If file #3 fails, we delete #1 and #2 from disk
            for path in uploaded_paths_for_rollback:
                if path.exists():
                    try:
                        path.unlink()
                    except OSError:
                        pass # Log cleanup error

            # We re-raise the exception so the Router performs the DB rollback
            raise e


    async def get_attachments_by_entity(self, entity_type: EntityType, entity_id: uuid.UUID) -> list[Attachment]:
        """
        Retrieves all attachments for a specific entity.
        """
        return await self.repository.get_attachments_by_entity(entity_type, entity_id)

    async def get_attachment_by_id(self, attachment_id: uuid.UUID) -> Attachment | None:
        """
        Retrieves a single attachment by its ID.
        """
        return await self.repository.get_attachment_by_id(attachment_id)

