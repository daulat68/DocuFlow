from fastapi import FastAPI
from app.routes.documents import router as document_router

app = FastAPI()

app.include_router(document_router)

@app.get("/")
def root():
    return {"message": "Backend is running"}