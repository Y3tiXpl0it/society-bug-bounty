#!/bin/sh
set -e

# --- BLOCK 1: Permissions (Root Only) ---
# If we are root, fix permissions and restart as normal user
if [ "$(id -u)" = '0' ]; then
    echo "🔧 Fixing permissions for /app/media..."
    mkdir -p /app/media
    chown -R appuser:appuser /app/media

    # Re-execute ourselves, but as 'appuser'
    # "$0" is the script, "$@" are the arguments passed to us
    exec gosu appuser "$0" "$@"
fi

# --- BLOCK 2: Execution as Normal User ---

# CASE A: If no arguments were passed, assume we are the WEB BACKEND
if [ "$#" -eq 0 ]; then
    echo "🚀 Starting Web Backend..."

    echo "🔄 Applying database migrations..."
    uv run alembic upgrade head

    echo "🔥 Starting Gunicorn..."
    exec uv run gunicorn app.main:app \
        --workers 1 \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:8000 \
        --threads 8 \
        --access-logfile - \
        --error-logfile -
fi

# CASE B: If arguments were passed, execute them (e.g.: Celery)
echo "⚙️ Executing custom command: $@"
exec "$@"