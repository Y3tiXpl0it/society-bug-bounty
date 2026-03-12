# backend/app/utils/image_upload_service.py
import uuid
import aiofiles
import hashlib
import magic
import io
from pathlib import Path
from fastapi import UploadFile
from PIL import Image

from app.core.exceptions import BadRequestException, RequestEntityTooLargeException


class ImageUploadService:
    """
    Centralized service for handling image uploads with validation and storage.

    This service encapsulates common logic for uploading and validating image files,
    used by both attachment uploads (for reports) and avatar uploads (for users).
    """

    @staticmethod
    async def validate_and_save_image(
        file: UploadFile,
        upload_dir: Path,
        max_size: int,
        allowed_extensions: list[str] = ['.jpg', '.jpeg', '.png', '.webp']
    ) -> dict:
        """
        Validates and saves an uploaded image file.

        Args:
            file: The uploaded file object.
            upload_dir: Directory path where the file will be stored.
            max_size: Maximum allowed file size in bytes.
            allowed_extensions: List of allowed file extensions (lowercase).

        Returns:
            A dictionary containing file metadata:
            - file_path: Absolute path to the saved file.
            - file_name: Original sanitized filename.
            - mime_type: Detected MIME type.
            - file_size: Size in bytes.
            - checksum: SHA-256 hash.

        Raises:
            BadRequestException: If file is invalid or doesn't meet criteria.
            HTTPException: If file size exceeds limit.
        """

        if not file.filename:
            raise BadRequestException("No file name provided.")

        # Sanitize filename to prevent path traversal
        sanitized_filename = Path(file.filename).name.replace(' ', '_')
        if not sanitized_filename or len(sanitized_filename) > 255:
            raise BadRequestException("Invalid file name.")

        file_extension = Path(sanitized_filename).suffix.lower()
        if file_extension not in allowed_extensions:
            raise BadRequestException(f"Only image files are allowed ({', '.join(allowed_extensions)}).")

        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename

        try:
            content = await file.read()

            # Validate file size
            if len(content) > max_size:
                raise RequestEntityTooLargeException(
                    detail=f"File size exceeds the maximum allowed limit of {max_size // (1024 * 1024)} MB."
                )

            # Detect MIME type from content
            detected_mime_type = magic.from_buffer(content, mime=True)
            if not detected_mime_type or not detected_mime_type.startswith("image/"):
                raise BadRequestException("Only image files are allowed.")

            # Validate image content using Pillow
            try:
                img = Image.open(io.BytesIO(content))
                img.verify()  # Verify the image is valid
            except Exception:
                raise BadRequestException("Invalid image file.")

            # Ensure upload directory exists
            upload_dir.mkdir(parents=True, exist_ok=True)

            # Save the file
            async with aiofiles.open(file_path, "wb") as buffer:
                await buffer.write(content)

        finally:
            await file.close()

        file_size = len(content)
        checksum = hashlib.sha256(content).hexdigest()

        return {
            "file_path": str(file_path),
            "file_name": sanitized_filename,
            "mime_type": detected_mime_type,
            "file_size": file_size,
            "checksum": checksum,
        }