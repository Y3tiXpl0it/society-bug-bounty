# backend/app/celery_worker.py

"""
Entry point for Celery worker.
Run with: celery -A app.celery_worker worker --loglevel=info
"""
from app.celery_config import celery_app

# The worker will automatically import tasks from app.tasks
if __name__ == '__main__':
    celery_app.start()