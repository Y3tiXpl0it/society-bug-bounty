# backend/app/celery_config.py

"""
Celery configuration for asynchronous task processing.
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "society_bug_bounty",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# Configuration
celery_app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Retries and reliability
    task_acks_late=True,  # Acknowledge task after completion
    task_reject_on_worker_lost=True,  # Requeue if worker dies
    
    # Timeouts
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,

    # Results
    result_expires=settings.CELERY_RESULT_EXPIRES,
    
    # Worker settings
    worker_pool='solo',
    worker_hostname='celery_worker',
    worker_prefetch_multiplier=4,  # How many tasks to prefetch per worker
    worker_max_tasks_per_child=1000,  # Recycle worker after 1000 tasks
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    worker_enable_remote_control=True,  # Enable remote control for Flower inspection

    # Testing
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,

    # Autodiscover tasks in specified modules
    imports=[
        'app.tasks.notifications',
        'app.tasks.maintenance'
    ],
)

# Schedule periodic tasks
celery_app.conf.beat_schedule = {
    'cleanup-revoked-tokens-daily': {
        'task': 'maintenance.cleanup_tokens',
        'schedule': (
            crontab(minute='*/2') if settings.DEBUG
            else crontab(hour=settings.CLEANUP_REVOKED_TOKENS_SCHEDULE_HOUR, minute=settings.CLEANUP_REVOKED_TOKENS_SCHEDULE_MINUTE)
        ),
    },
}

# Task autodiscovery
celery_app.autodiscover_tasks(['app.tasks'])