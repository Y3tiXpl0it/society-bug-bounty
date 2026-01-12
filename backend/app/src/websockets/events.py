# backend/app/src/websockets/events.py
"""
WebSocket event handlers for Socket.IO.
"""

import socketio
from typing import Optional, Dict, Any
import logging

from .connection_manager import ConnectionManager

logger = logging.getLogger(__name__)

def setup_websocket_events(sio: socketio.AsyncServer, connection_manager: ConnectionManager):
    """
    Set up WebSocket event handlers on the Socket.IO instance.
    """
    
    # Definimos las funciones (Handlers)
    async def handle_connect(sid: str, environ: dict, auth: Optional[Dict[str, Any]] = None):
        """
        Handle WebSocket connection event.
        Authenticates the user using JWT token from auth.
        """
        logger.info(f"⚡ WebSocket connect request: {sid}")
        try:
            # 1. Attempt to extract token from the 'auth' payload
            token = auth.get('token') if auth else None
            
            # 2. Fallback: Check standard Authorization header
            if not token:
                auth_header = environ.get('HTTP_AUTHORIZATION')
                if auth_header:
                    token = auth_header

            # 3. Clean up 'Bearer ' prefix if present
            if token and token.startswith("Bearer "):
                token = token.split(" ")[1]

            if not token:
                logger.warning(f"Connection rejected {sid}: No token")
                raise ConnectionRefusedError('No authentication token provided')

            # 4. Authenticate using the manager
            user = await connection_manager.authenticate_connection(sid, token)

            # 5. Connect user to their room (CRITICAL STEP)
            await connection_manager.connect_user(sid, user)

        except ConnectionRefusedError as e:
            logger.warning(f"Connection refused for {sid}: {e}")
            raise e 
        except Exception as e:
            logger.error(f"Unexpected error in WS connect: {e}", exc_info=True)
            raise ConnectionRefusedError("Internal Server Error")

    async def handle_disconnect(sid: str):
        """
        Handle WebSocket disconnection event.
        """
        logger.info(f"🔌 WebSocket disconnected: {sid}")
        await connection_manager.disconnect_user(sid)
        
    async def handle_ping(sid: str):
        """
        Handle ping event.
        """
        await sio.emit('pong', room=sid)

    # Register event handlers with Socket.IO.
    sio.on('connect', handle_connect)
    sio.on('disconnect', handle_disconnect)
    sio.on('ping', handle_ping)
    
    logger.info("✅ WebSocket events registered successfully")