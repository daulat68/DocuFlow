from app.core.celery_app import celery
import time
import os


@celery.task(name="doc_processing.process_document", bind=True, max_retries=3)
def process_document(self, file_path: str):
    """
    Process document in background.
    Retries up to 3 times on failure.
    """
    try:
        print(f"[Task {self.request.id}] Processing started: {file_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Stage 1: Initial processing
        print(f"[Task {self.request.id}] Stage 1: Initial processing")
        time.sleep(2)  # Replace with actual processing
        
        # Stage 2: Parsing
        print(f"[Task {self.request.id}] Stage 2: Parsing started")
        time.sleep(2)  # Replace with actual parsing logic
        print(f"[Task {self.request.id}] Stage 2: Parsing completed")
        
        # Stage 3: Data extraction
        print(f"[Task {self.request.id}] Stage 3: Extraction started")
        time.sleep(2)  # Replace with actual extraction logic
        print(f"[Task {self.request.id}] Stage 3: Extraction completed")
        
        # Return result
        return {
            "status": "completed",
            "file_path": file_path,
            "message": f"Successfully processed {os.path.basename(file_path)}"
        }
        
    except Exception as exc:
        print(f"[Task {self.request.id}] Error: {str(exc)}")
        # Retry after 5 seconds
        raise self.retry(exc=exc, countdown=5)