# backend/app/src/websockets/schemas.py
"""
Pydantic schemas for WebSocket messages and events.
"""

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel


class WebSocketEventType(str, Enum):
    """Types of WebSocket events."""
    NOTIFICATION_RECEIVED = "notification_received"
    CONNECTION_ESTABLISHED = "connection_established"
    CONNECTION_ERROR = "connection_error"


class WebSocketMessage(BaseModel):
    """Base WebSocket message structure."""
    event_type: WebSocketEventType
    data: Dict[str, Any]
    timestamp: Optional[str] = None


class NotificationEvent(BaseModel):
    """Structure for notification events sent via WebSocket."""
    id: str
    user_id: str
    title: str
    message: str
    severity: str
    notification_type: str
    recipient_role: str
    related_entity_id: Optional[str] = None
    created_at: str


class ConnectionEvent(BaseModel):
    """Structure for connection-related events."""
    user_id: str
    status: str  # "connected" or "disconnected"
    timestamp: str