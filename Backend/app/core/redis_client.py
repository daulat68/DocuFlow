import redis
import os
from redis.exceptions import ConnectionError

# Initialize Redis client for Pub/Sub
# Use REDIS_URL (same as Celery), or fallback to host/port
REDIS_URL = os.getenv("REDIS_URL", None)

if REDIS_URL:
    # Use connection string if available (e.g., from Celery config)
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    except Exception as e:
        print(f"[Redis] Failed to connect via REDIS_URL: {e}")
        redis_client = None
else:
    # Fallback to host/port configuration
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    
    try:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=0,
            decode_responses=True
        )
        # Test connection
        redis_client.ping()
    except ConnectionError as e:
        print(f"[Redis] Failed to connect to {REDIS_HOST}:{REDIS_PORT}: {e}")
        redis_client = None

# Channel names
PROGRESS_CHANNEL = "document_progress"
STATUS_CHANNEL = "document_status"

def publish_progress(doc_id: int, progress: dict):
    """Publish progress update for a document"""
    if not redis_client:
        print(f"[Redis] Not connected, skipping progress update for doc {doc_id}")
        return
    
    try:
        message = {
            "doc_id": doc_id,
            "progress": progress
        }
        redis_client.publish(PROGRESS_CHANNEL, str(message))
    except Exception as e:
        print(f"[Redis] Failed to publish progress: {e}")

def publish_status(doc_id: int, status: str, message: str = ""):
    """Publish status update for a document"""
    if not redis_client:
        print(f"[Redis] Not connected, skipping status update for doc {doc_id}")
        return
    
    try:
        status_message = {
            "doc_id": doc_id,
            "status": status,
            "message": message
        }
        redis_client.publish(STATUS_CHANNEL, str(status_message))
    except Exception as e:
        print(f"[Redis] Failed to publish status: {e}")
