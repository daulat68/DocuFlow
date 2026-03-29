
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")  # queued, processing, completed, failed
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(String, nullable=True)
    
    # Processing metadata
    file_size = Column(Integer, nullable=True)
    file_type = Column(String, nullable=True)
    doc_metadata = Column(JSON, nullable=True)  # Original file metadata
    
    # Processing progress
    progress = Column(JSON, nullable=True)  # {current: int, total: int, message: str, percentage: float}
    
    # Processing results
    processed_output = Column(JSON, nullable=True)  # Raw processing output
    reviewed_result = Column(JSON, nullable=True)  # User-edited/reviewed output
    final_result = Column(JSON, nullable=True)  # Finalized output (locked)
    
    # Status tracking
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", backref="documents")
