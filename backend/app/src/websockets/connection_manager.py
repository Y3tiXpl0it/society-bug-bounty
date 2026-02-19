# backend/app/src/websockets/connection_manager.py
"""
Connection manager for WebSocket connections.

Handles user connections, room management, and broadcasting notifications.
"""

import uuid
import logging
from typing import Dict, Set, Optional

from app.src.users.models import User
from .schemas import NotificationEvent, WebSocketEventType, WebSocketMessage
from sqlalchemy import select
from fastapi_users.jwt import decode_jwt
from app.core.config import settings
from app.src.users.models import User
from app.core.database import get_session

class ConnectionManager:
    """
    Manages WebSocket connections and broadcasting.

    This class handles:
    - User authentication on connection
    - Room management (user-specific rooms)
    - Broadcasting notifications to specific users
    - Connection tracking and cleanup
    """

    def __init__(self, sio):
        self.sio = sio
        self.active_connections: Dict[str, Set[str]] = {}  # user_id -> set of session_ids
        self.logger = logging.getLogger(__name__)

    async def authenticate_connection(self, sid: str, token: str) -> User:
        """
        Authenticate WebSocket connection using the raw JWT token.
        
        Args:
            sid: Socket.IO session ID.
            token: The raw JWT string (without 'Bearer ' prefix).
            
        Returns:
            User: The authenticated user instance.
            
        Raises:
            ConnectionRefusedError: If token is invalid, expired, or user not found.
        """
        if not token:
            self.logger.warning(f"Connection rejected {sid}: No token provided")
            raise ConnectionRefusedError("Authentication token required")

        try:
            # 1. Decode the JWT using the project's secret and audience
            payload = decode_jwt(
                token, 
                settings.JWT_SECRET, 
                ["fastapi-users:auth"],
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            user_id = payload.get("sub")
            if not user_id:
                raise ConnectionRefusedError("Token invalid: no user ID found")

            # 2. Verify user exists in Database
            # We must create a new session here as we are outside the FastAPI dependency injection system
            user: Optional[User] = None

            async for session in get_session():
                try:
                    result = await session.execute(select(User).filter(User.id == uuid.UUID(user_id)))
                    user_found = result.scalars().first()
                    
                    if user_found:
                        # Hacemos esto para desvincular el objeto de la sesión antes de que se cierre
                        # (Opcional, pero previene errores si intentas acceder atributos lazy fuera)
                        user = user_found
                finally:
                    # Al salir del bloque o hacer break, get_session se encarga del cleanup
                    pass
                break 

            if not user:
                raise ConnectionRefusedError("User not found")
            
            if not user.is_active:
                raise ConnectionRefusedError("User is inactive")
            
            self.logger.debug(f"✅ WebSocket User Authenticated: {user.email}")
            
            return user

        except Exception as e:
            # Log the specific error for debugging but return a generic message to client
            self.logger.error(f"❌ WebSocket Authentication Error: {str(e)}")
            raise ConnectionRefusedError("Authentication failed")


    async def connect_user(self, sid: str, user: User) -> None:
        """
        Connect user to their personal room.

        Args:
            sid: Socket.IO session ID
            user: Authenticated user
        """
        user_id = str(user.id)
        self.logger.debug(f"🔗 Connecting user {user_id} (session {sid}) to room user_{user_id}")

        # Initialize user connections set if not exists
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        # Add session to active connections
        self.active_connections[user_id].add(sid)

        # Join user to their personal room
        await self.sio.enter_room(sid, f"user_{user_id}")
        self.logger.debug(f"✅ User {user_id} connected. Active connections: {self.active_connections}")

    async def disconnect_user(self, sid: str) -> None:
        """
        Disconnect user and clean up resources.

        Args:
            sid: Socket.IO session ID
        """
        # Get user_id from session
        session_data = await self.sio.get_session(sid)
        user_id = session_data.get('user_id')

        if user_id and user_id in self.active_connections:
            # Remove session from active connections
            self.active_connections[user_id].discard(sid)

            # If no more sessions for this user, clean up
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

            # Leave user room
            await self.sio.leave_room(sid, f"user_{user_id}")

    async def broadcast_notification(self, user_id: str, notification_data: dict) -> None:
        """
        Broadcast notification to specific user.

        Args:
            user_id: Target user ID
            notification_data: Notification data to send
        """
        try:
            self.logger.debug(f"📡 Broadcasting notification to user {user_id}, room: user_{user_id}")

            # Create notification event
            event = NotificationEvent(
                id=str(notification_data.get('id')),
                user_id=user_id,
                title=notification_data.get('title', ''),
                message=notification_data.get('message', ''),
                severity=notification_data.get('severity', 'info'),
                notification_type=notification_data.get('notification_type', ''),
                recipient_role=notification_data.get('recipient_role', 'hacker'),
                related_entity_id=notification_data.get('related_entity_id'),
                created_at=notification_data.get('created_at', '')
            )

            # Create WebSocket message
            message = WebSocketMessage(
                event_type=WebSocketEventType.NOTIFICATION_RECEIVED,
                data=event.model_dump(),
                timestamp=event.created_at
            )



            # Send to user's room (this automatically broadcasts to all user sessions)
            await self.sio.emit(
                'notification',
                message.model_dump(),
                room=f"user_{user_id}"
            )



        except Exception as e:
            self.logger.error(f"❌ Error broadcasting notification to user {user_id}: {e}")
            pass

    def get_active_connections_count(self) -> int:
        """Get total number of active connections."""
        return sum(len(sessions) for sessions in self.active_connections.values())

    def get_user_connections_count(self, user_id: str) -> int:
        """Get number of active connections for a specific user."""
        return len(self.active_connections.get(str(user_id), set()))