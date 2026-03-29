from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
import os
import json
import csv
from io import StringIO
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.workers.tasks import process_document
from app.database import get_db
from app.models.document import Document
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.core.cloudinary_config import upload_to_cloudinary, delete_from_cloudinary

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = "temp"


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a single document for processing to Cloudinary"""
    try:
        # Read file content
        file_content = await file.read()
        
        # Upload to Cloudinary
        cloudinary_result = await upload_to_cloudinary(file_content, file.filename)
        
        # Store document metadata with Cloudinary URL
        document = Document(
            user_id=current_user.id,
            filename=file.filename,
            file_path=cloudinary_result["url"],  # Store Cloudinary URL instead of local path
            cloudinary_public_id=cloudinary_result["public_id"],  # Store for regenerating signed URLs
            file_size=cloudinary_result["size"],
            file_type=cloudinary_result["type"],
            status="queued"
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        # Queue processing task
        task = process_document.delay(document.id)
        document.task_id = task.id
        db.commit()

        return {
            "message": "Document uploaded to Cloudinary",
            "document_id": document.id,
            "task_id": task.id,
            "status": document.status,
            "file_url": cloudinary_result["url"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload-multiple")
async def upload_multiple_documents(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload multiple documents for batch processing to Cloudinary"""
    uploaded_docs = []
    
    for file in files:
        try:
            # Read file content
            file_content = await file.read()
            
            # Upload to Cloudinary
            cloudinary_result = await upload_to_cloudinary(file_content, file.filename)
            
            # Store document metadata with Cloudinary URL
            document = Document(
                user_id=current_user.id,
                filename=file.filename,
                file_path=cloudinary_result["url"],  # Store Cloudinary URL
                cloudinary_public_id=cloudinary_result["public_id"],  # Store for regenerating signed URLs
                file_size=cloudinary_result["size"],
                file_type=cloudinary_result["type"],
                status="queued"
            )
            
            db.add(document)
            db.commit()
            db.refresh(document)
            
            # Queue processing task
            task = process_document.delay(document.id)
            document.task_id = task.id
            db.commit()
            
            uploaded_docs.append({
                "document_id": document.id,
                "filename": document.filename,
                "task_id": task.id,
                "status": document.status,
                "file_url": cloudinary_result["url"]
            })
        except Exception as e:
            uploaded_docs.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return {
        "message": f"Processed {len(uploaded_docs)} files",
        "documents": uploaded_docs
    }


@router.get("/")
def list_documents(
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by filename"),
    sort_by: Optional[str] = Query("created_at", description="Sort field"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all documents with filtering, searching, and sorting"""
    query = db.query(Document).filter(Document.user_id == current_user.id)
    
    # Filter by status
    if status:
        query = query.filter(Document.status == status)
    
    # Search by filename
    if search:
        query = query.filter(Document.filename.ilike(f"%{search}%"))
    
    # Sorting
    sort_column = getattr(Document, sort_by, Document.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))
    
    docs = query.all()
    
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "status": d.status,
            "file_size": d.file_size,
            "file_type": d.file_type,
            "progress": d.progress,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "error_message": d.error_message
        }
        for d in docs
    ]


@router.get("/{doc_id}")
def get_document_details(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full document details including processing results"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "id": document.id,
        "filename": document.filename,
        "file_path": document.file_path,
        "file_size": document.file_size,
        "file_type": document.file_type,
        "status": document.status,
        "task_id": document.task_id,
        "progress": document.progress,
        "doc_metadata": document.doc_metadata,
        "processed_output": document.processed_output,
        "reviewed_result": document.reviewed_result,
        "final_result": document.final_result,
        "error_message": document.error_message,
        "created_at": document.created_at.isoformat() if document.created_at else None,
        "updated_at": document.updated_at.isoformat() if document.updated_at else None,
        "completed_at": document.completed_at.isoformat() if document.completed_at else None
    }


@router.get("/{doc_id}/progress")
def get_document_progress(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get real-time progress of document processing"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "document_id": doc_id,
        "status": document.status,
        "progress": document.progress or {
            "current": 0,
            "total": 0,
            "message": "Pending",
            "percentage": 0
        },
        "error_message": document.error_message
    }


@router.put("/{doc_id}/reviewed")
def update_reviewed_result(
    doc_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the reviewed/edited result of a processed document"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.status == "finalized":
        raise HTTPException(
            status_code=400,
            detail="Cannot edit a finalized document"
        )
    
    document.reviewed_result = data
    db.commit()
    
    return {
        "message": "Reviewed result updated",
        "document_id": doc_id,
        "reviewed_result": document.reviewed_result
    }


@router.post("/{doc_id}/finalize")
def finalize_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Finalize the document (lock reviewed result)"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document.status == "finalized":
        raise HTTPException(
            status_code=400,
            detail="Document is already finalized"
        )
    
    # Set final result from reviewed result
    document.final_result = document.reviewed_result or document.processed_output
    document.status = "finalized"
    db.commit()

    return {
        "message": "Document finalized successfully",
        "document_id": doc_id,
        "status": document.status,
        "final_result": document.final_result
    }


@router.post("/{doc_id}/retry")
def retry_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retry processing a failed document"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.status != "failed":
        raise HTTPException(
            status_code=400,
            detail="Can only retry failed documents"
        )

    document.status = "queued"
    document.error_message = None
    document.progress = None
    db.commit()

    task = process_document.delay(document.id)
    document.task_id = task.id
    db.commit()

    return {
        "message": "Retry requested",
        "document_id": doc_id,
        "task_id": task.id,
        "status": document.status
    }


@router.get("/{doc_id}/export-json")
def export_document_json(
    doc_id: int,
    use_final: bool = Query(True, description="Use finalized result if available"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export document results as JSON"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Choose which result to export
    if use_final and document.final_result:
        result = document.final_result
    elif document.reviewed_result:
        result = document.reviewed_result
    else:
        result = document.processed_output
    
    export_data = {
        "document_id": document.id,
        "filename": document.filename,
        "status": document.status,
        "exported_at": datetime.utcnow().isoformat(),
        "data": result
    }
    
    json_str = json.dumps(export_data, indent=2)
    
    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=document_{doc_id}.json"}
    )


@router.get("/{doc_id}/export-csv")
def export_document_csv(
    doc_id: int,
    use_final: bool = Query(True, description="Use finalized result if available"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export document results as CSV"""
    document = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Choose which result to export
    if use_final and document.final_result:
        result = document.final_result
    elif document.reviewed_result:
        result = document.reviewed_result
    else:
        result = document.processed_output
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(["Document ID", document.id])
    writer.writerow(["Filename", document.filename])
    writer.writerow(["Status", document.status])
    writer.writerow(["Exported At", datetime.utcnow().isoformat()])
    writer.writerow([])
    writer.writerow(["Data"])
    
    # Flatten and write result data
    if isinstance(result, dict):
        for key, value in result.items():
            if isinstance(value, (dict, list)):
                writer.writerow([key, json.dumps(value)])
            else:
                writer.writerow([key, value])
    
    csv_str = output.getvalue()
    
    return StreamingResponse(
        iter([csv_str]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=document_{doc_id}.csv"}
    )
