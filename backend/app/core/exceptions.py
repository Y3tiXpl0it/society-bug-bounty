from fastapi import HTTPException, status



from typing import Any, Dict, Optional, Union
from app.core.error_codes import ErrorCode

class NotFoundException(HTTPException):
    """Base exception for resource not found errors."""

    def __init__(self, detail: Union[str, Dict[str, Any]] = "Resource not found"):
        if isinstance(detail, str):
            detail = {"code": ErrorCode.NOT_FOUND, "message": detail}
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class AlreadyExistsException(HTTPException):
    """Base exception for resource already exists errors."""

    def __init__(self, detail: Union[str, Dict[str, Any]] = "Resource already exists"):
        if isinstance(detail, str):
            detail = {"code": ErrorCode.BAD_REQUEST, "message": detail}
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class UnauthorizedException(HTTPException):
    """Base exception for unauthorized access errors."""

    def __init__(self, detail: Union[str, Dict[str, Any]] = "Unauthorized access"):
        if isinstance(detail, str):
             detail = {"code": ErrorCode.UNAUTHORIZED, "message": detail}
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class ForbiddenException(HTTPException):
    """Base exception for forbidden access errors."""

    def __init__(self, detail: Union[str, Dict[str, Any]] = "Access forbidden"):
        if isinstance(detail, str):
            detail = {"code": ErrorCode.FORBIDDEN, "message": detail}
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

class BadRequestException(HTTPException):
    """Exception for client-side validation errors (400 Bad Request)."""

    def __init__(self, detail: Union[str, Dict[str, Any]] = "Bad Request"):
        if isinstance(detail, str):
            detail = {"code": ErrorCode.BAD_REQUEST, "message": detail}
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class RequestEntityTooLargeException(HTTPException):
    """Exception for file size exceeded errors (413 Request Entity Too Large)."""

    def __init__(self, detail: str = "Request entity too large"):
        super().__init__(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=detail)
