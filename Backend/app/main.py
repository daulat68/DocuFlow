from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.documents import router as document_router
from app.auth.routes import router as auth_router
from app.database import engine
from app.models.user import User
from app.models.document import Document

# if SQLAlchemy models are imported, Base metadata has all tables
from app.database import Base

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(document_router)

@app.get("/")
def root():
    return {"message": "Backend is running"}