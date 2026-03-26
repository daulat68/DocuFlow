from celery import Celery
from app.config import REDIS_URL

celery = Celery(
    "doc_processor",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    worker_pool="solo",
    # Connection pooling to reduce client connections
    broker_pool_limit=1,
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
    redis_max_connections=5,
)

# Auto-discover tasks from all registered apps
celery.autodiscover_tasks(['app.workers'])