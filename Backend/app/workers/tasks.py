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


@celery.task(name="doc_processing.process_document", bind=True, max_retries=3)
def process_document(self, document_id: int):
    db: Session = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()

        if not document:
            raise FileNotFoundError(f"Document with ID {document_id} not found")

        file_path = document.file_path
        print(f"[Task {self.request.id}] Processing started: {file_path}")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Get file size
        file_size = os.path.getsize(file_path)
        document.file_size = file_size
        document.file_type = os.path.splitext(file_path)[1]

        # Update status to processing
        document.status = "processing"
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
            "message": f"Successfully processed {os.path.basename(file_path)}"
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
        db.close()