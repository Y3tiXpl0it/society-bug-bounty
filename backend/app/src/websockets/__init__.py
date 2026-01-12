# backend/app/src/websockets/__init__.py
"""
WebSocket module for real-time notifications.

This module provides WebSocket functionality for real-time notifications
using FastAPI-SocketIO, including authentication, connection management,
and broadcasting capabilities.
"""

from .connection_manager import ConnectionManager
from .schemas import WebSocketMessage, NotificationEvent

__all__ = ["ConnectionManager", "WebSocketMessage", "NotificationEvent"]