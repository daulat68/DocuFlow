# 📄 DocuFlow – Async Document Processing System

A scalable full-stack application for processing documents asynchronously using a queue-based architecture.

#### Live Link:- https://async-document-processing-system-frontend.onrender.com

---

## 🚀 Problem

Processing documents (PDFs, reports, resumes, etc.) can be time-consuming and resource-heavy. Handling this synchronously blocks the server and leads to poor user experience.

---

## 💡 Solution

DocuFlow decouples document processing from API requests using background workers.

```
Upload → Queue → Worker → Store Result → Fetch Output
```

This ensures:

* Fast API responses ⚡
* Scalable processing 📈
* Better user experience

---

## 🏗️ Architecture

```
Frontend (React)
        ↓
FastAPI Backend (Render)
        ↓
Redis Queue → Celery Worker
        ↓
PostgreSQL (Supabase)
        ↓
Cloudinary (File Storage)
```

---

## ⚙️ Tech Stack

* Frontend: React, TypeScript
* Backend: FastAPI (deployed on Render)
* Queue: Redis
* Workers: Celery
* Database: PostgreSQL (Supabase)
* Storage: Cloudinary

---

## 🔄 How It Works

1. User uploads a document
2. File stored in Cloudinary
3. Task sent to Redis queue
4. Celery worker processes document
5. Extracted data stored in Supabase (PostgreSQL)
6. User fetches processed result

---

## ✨ Features

* Async document processing
* Status tracking (polling)
* Structured data extraction
* Editable processed output
* Export as JSON/CSV
* JWT-based authentication

---

## 🚀 Deployment

* **Backend:** Deployed on Render
* **Database:** Supabase PostgreSQL (with connection pooling)
* **Worker:** Celery worker running alongside backend
* **Storage:** Cloudinary for file handling

---

## 🧠 Key Engineering Decisions

* Async Processing (Celery + Redis)
  Avoids blocking API and improves scalability

* Polling over WebSockets
  Simpler and sufficient for current scale

* Supabase (Managed PostgreSQL)
  Provides hosted DB with connection pooling and easy scaling

* Render Deployment
  Simplifies backend hosting with minimal DevOps setup

---

## ⚠️ Limitations

* Uses polling (not real-time WebSockets)
* Single worker (can scale horizontally)
* Basic error retry mechanism

---

## 🛠️ Local Setup

```bash
# Backend
cd Backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Worker
celery -A app.core.celery_app worker --loglevel=info

# Frontend
cd Frontend
npm install
npm start
```

---

## 🎯 Why This Project?

This project demonstrates how to design scalable backend systems using:

* asynchronous processing
* task queues
* distributed workers

This pattern is widely used in real-world systems like:

* file processing pipelines
* email services
* video processing platforms

---