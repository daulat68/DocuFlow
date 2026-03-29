from app.core.celery_app import celery
from app.core.redis_client import publish_progress, publish_status
import time
import os
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.document import Document
from app.models.user import User
import requests
from io import BytesIO
import cloudinary.api
import cloudinary.uploader
from app.core.cloudinary_config import get_signed_download_url


@celery.task(name="doc_processing.process_document", bind=True, max_retries=3)
def process_document(self, document_id: int):
    db: Session = SessionLocal()
    temp_file_path = None
    try:
        document = db.query(Document).filter(Document.id == document_id).first()

        if not document:
            raise FileNotFoundError(f"Document with ID {document_id} not found")

        file_url = document.file_path 
        print(f"[Task {self.request.id}] Processing started: {file_url}")

        # --- FIX 1: Robust Signed URL Generation ---
        if document.cloudinary_public_id:
            try:
                # We force "raw" because PDFs are stored in the 'raw' bucket in our upload logic
                file_url = get_signed_download_url(document.cloudinary_public_id, resource_type="raw")
                print(f"[Task {self.request.id}] Using signed URL for authenticated download")
            except Exception as e:
                print(f"[Task {self.request.id}] Warning: Could not generate signed URL: {str(e)}")

        # --- FIX 2: Better Download Handling ---
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36'
        }
        
        try:
            response = requests.get(file_url, headers=headers, timeout=30)
            # If we still get a 401/404 here, it's definitely a Cloudinary type mismatch
            response.raise_for_status() 
        except requests.exceptions.HTTPError as e:
            # Better error logging to catch exactly why Cloudinary said no
            error_msg = f"Cloudinary error: {response.status_code} for URL: {file_url[:60]}..."
            print(f"[Task Error] {error_msg}")
            raise FileNotFoundError(error_msg)

        # Save temporarily for processing
        os.makedirs("temp", exist_ok=True)
        # Using a safer filename join
        safe_filename = "".join([c for c in document.filename if c.isalnum() or c in (' ', '.', '_')]).rstrip()
        temp_file_path = os.path.join("temp", f"proc_{document_id}_{safe_filename}")
        
        with open(temp_file_path, "wb") as f:
            f.write(response.content)

        # --- FIX 3: Update metadata early ---
        file_size = len(response.content) # More accurate than os.path.getsize if write is buffered
        document.file_size = file_size
        if not document.file_type:
            document.file_type = os.path.splitext(document.filename)[1]

        # Update status to processing
        document.status = "processing"
        # ... (rest of your logic remains the same)
        document.progress = {
            "current": 0,
            "total": 3,
            "message": "Starting processing...",
            "percentage": 0
        }
        db.commit()

        # Publish initial status
        publish_status(document_id, "processing", "Starting document processing...")

        # Simulate multi-stage processing
        stages = [
            {"name": "Parsing", "duration": 2},
            {"name": "Extraction", "duration": 2},
            {"name": "Validation", "duration": 2}
        ]

        processed_data = {
            "filename": document.filename,
            "file_size": file_size,
            "file_type": document.file_type,
            "stages_completed": [],
            "extracted_content": {
                "text": f"Processed content from {document.filename}",
                "metadata": {
                    "parsed_at": datetime.utcnow().isoformat(),
                    "file_size_kb": file_size / 1024
                }
            }
        }

        for idx, stage in enumerate(stages):
            # Publish progress
            progress = {
                "current": idx + 1,
                "total": len(stages),
                "message": f"{stage['name']} in progress...",
                "percentage": round(((idx + 1) / len(stages)) * 100, 2)
            }
            document.progress = progress
            db.commit()
            publish_progress(document_id, progress)

            print(f"[Task {self.request.id}] Stage: {stage['name']}")
            time.sleep(stage['duration'])

            processed_data["stages_completed"].append({
                "name": stage['name'],
                "completed_at": datetime.utcnow().isoformat()
            })

        # Processing completed
        document.status = "completed"
        document.processed_output = processed_data
        document.reviewed_result = processed_data.copy()  # Initially same as processed output
        document.progress = {
            "current": len(stages),
            "total": len(stages),
            "message": "Processing completed!",
            "percentage": 100
        }
        document.completed_at = datetime.utcnow()
        db.commit()

        # Publish completion status
        publish_status(document_id, "completed", "Document processing completed successfully!")
        publish_progress(document_id, document.progress)

        print(f"[Task {self.request.id}] Completed successfully")

        return {
            "status": "completed",
            "document_id": document_id,
            "message": f"Successfully processed {document.filename}"
        }

    except Exception as exc:
        print(f"[Task Error] {str(exc)}")
        db.rollback()

        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "failed"
                document.error_message = str(exc)
                document.progress = {
                    "current": 0,
                    "total": 0,
                    "message": f"Failed: {str(exc)}",
                    "percentage": 0
                }
                db.commit()

                # Publish failure status
                publish_status(document_id, "failed", str(exc))
        except Exception as db_exc:
            print(f"[DB Error] Failed to update document: {str(db_exc)}")

        # Retry logic
        raise self.retry(exc=exc, countdown=5)

    finally:
        # Clean up temporary file if it was created
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                print(f"[Task {self.request.id}] Cleaned up temp file: {temp_file_path}")
            except Exception as e:
                print(f"[Task {self.request.id}] Failed to clean up temp file: {str(e)}")
        
        db.close()