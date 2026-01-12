# backend/app/main.py

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# --- App Core Imports ---
from app.core.config import settings
from app.core.logging import get_logger, setup_logging

# --- App Routers ---
from app.src.programs.routes import router as programs_router
from app.src.reports.routes import router as reports_router
from app.src.users.routes import auth_router, user_router
from app.src.asset_types.routes import router as asset_types_router
from app.src.notifications.routes import router as notifications_router

# --- WebSocket Imports ---
import socketio
from app.src.websockets.events import setup_websocket_events
from app.src.websockets.connection_manager import ConnectionManager

# --- FastAPI-Users Imports ---
from app.src.users.auth import auth_backend
from app.src.users.manager import fastapi_users_instance
from app.src.users.schemas import UserCreate, UserRead, UserReadWithOrgs, UserUpdate

# --- Initial Setup ---
setup_logging()
logger = get_logger(__name__)

# --- FastAPI App Initialization ---
fastapi_app = FastAPI(
    title=settings.PROJECT_NAME,
    debug=settings.DEBUG,
)

# --- CORS Origins ---
origins = settings.CORS_ALLOWED_ORIGINS.split(",")

# --- Socket.IO Configuration (REDIS INTEGRATION) ---
# 1. Define the exact Redis URL (Host, Port, and DB)
redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"

# 2. Initialize the Manager.
# This manager automatically subscribes to Redis and distributes Celery messages.
socket_manager = socketio.AsyncRedisManager(redis_url)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=origins,
    client_manager=socket_manager, 
    cors_credentials=True,
    logger=False,       # Set to True to see connection logs
    engineio_logger=False
)
logger.info(f"🔌 Socket.IO server initialized with Redis: {redis_url}")

# Initialize connection manager
connection_manager = ConnectionManager(sio)
fastapi_app.state.connection_manager = connection_manager

# Register WebSocket event handlers
setup_websocket_events(sio, connection_manager)

# Create ASGI app with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app)

# --- CORS Middleware ---
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Custom Exception Handler for CORS ---
@fastapi_app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    origin = request.headers.get("origin")
    headers = {}
    if origin and origin in origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )

@fastapi_app.exception_handler(Exception)
async def custom_general_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin")
    headers = {}
    if origin and origin in origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers
    )

# --- Static Files ---
fastapi_app.mount("/media", StaticFiles(directory="media"), name="media")

# --- Request Logging Middleware ---
@fastapi_app.middleware("http")
async def log_requests(request, call_next):
    # logger.info(f"Incoming request: {request.method} {request.url}") 
    response = await call_next(request)
    return response

# --- Auth Routers ---
fastapi_app.include_router(
    fastapi_users_instance.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"]
)
fastapi_app.include_router(
    fastapi_users_instance.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
fastapi_app.include_router(auth_router, prefix="/auth")
fastapi_app.include_router(user_router, prefix="/users")
fastapi_app.include_router(
    fastapi_users_instance.get_users_router(UserReadWithOrgs, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# --- Custom App Routers ---
fastapi_app.include_router(programs_router)
fastapi_app.include_router(reports_router)
fastapi_app.include_router(asset_types_router)
fastapi_app.include_router(notifications_router)

# --- Health Checks ---
@fastapi_app.get("/health")
async def health_check():
    return {"status": "ok"}

@fastapi_app.get("/health/redis")
async def redis_health():
    """Check Redis connection asynchronously."""
    try:
        # Use the asynchronous interface of redis-py
        from redis import asyncio as aioredis
        
        # Connect using the same URL as Socket.IO
        redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
        
        client = aioredis.from_url(redis_url, socket_connect_timeout=2)
        
        # Await responses
        await client.ping()
        info = await client.info()
        
        await client.close() # Important: close the connection
        
        return {
            "status": "healthy",
            # Now 'info' is a real dictionary, not an Awaitable
            "connected_clients": info.get('connected_clients'),
            "used_memory_human": info.get('used_memory_human')
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@fastapi_app.get("/")
async def root():
    return {"message": "Welcome to the API!"}