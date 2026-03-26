from fastapi import APIRouter, UploadFile, File
import os

from app.workers.tasks import process_document
from app.core.celery_app import celery

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = "temp"


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    task = process_document.delay(file_path)

    return {
        "message": "Document uploaded",
        "filename": file.filename,
        "task_id": task.id,
        "status": "queued"
    }


@router.get("/task/{task_id}")
def get_task_status(task_id: str):
    """Get the status of a document processing task"""
    task = celery.AsyncResult(task_id)
    
    return {
        "task_id": task_id,
        "status": task.status,
        "result": task.result if task.status == "SUCCESS" else None,
        "error": str(task.info) if task.status == "FAILURE" else None
    }

@router.get("/")
def list_documents():
    return {"message": "List of documents (to be implemented)"}


@router.get("/{doc_id}")
def get_document(doc_id: int):
    return {"message": f"Details of document {doc_id}"}


@router.post("/{doc_id}/retry")
def retry_document(doc_id: int):
    return {"message": f"Retry job {doc_id}"}


@router.post("/{doc_id}/finalize")
def finalize_document(doc_id: int):
    return {"message": f"Finalize document {doc_id}"}


@router.get("/{doc_id}/export")
def export_document(doc_id: int):
    return {"message": f"Export document {doc_id}"}