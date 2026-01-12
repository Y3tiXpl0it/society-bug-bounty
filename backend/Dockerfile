# backend/Dockerfile

# Use a slim base image, which is very common.
FROM python:3.13-slim-bookworm

# Install uv in the simplest way.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install system dependencies required for python-magic and psycopg2
RUN apt-get update && apt-get install -y libmagic1 libpq-dev build-essential gosu && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 -m appuser && \
    mkdir -p /home/appuser/.cache && \
    chown -R appuser:appuser /home/appuser

# Change ownership of /app directory to appuser
RUN chown appuser:appuser /app

# Switch to non-root user to install dependencies
USER appuser

# Copy dependency files first to leverage Docker cache.
COPY --chown=appuser:appuser pyproject.toml uv.lock* ./

# Install locked dependencies.
# --no-cache is optional but good to keep the image light.
RUN uv sync --locked --no-cache

# Switch to root to copy the rest of the code
USER root

# Copy the rest of the application code.
COPY . .

# Ensure entrypoint.sh has execute permissions
RUN chmod +x entrypoint.sh

# Change ownership of the entire /app directory to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the port.
EXPOSE 8000

# Startup command. Note that it points to "app.main:app" to match your structure.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]