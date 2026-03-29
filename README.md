# Async Document Processing System

A full-stack web application for asynchronous document processing with real-time progress tracking, editing capabilities, and export functionality.

## 🚀 Setup Instructions

### Prerequisites

- **Python 3.11+** (Backend)
- **Node.js 16+** (Frontend)
- **PostgreSQL** (Database)
- **Redis** (Message Queue & Caching)
- **Git** (Version Control)

### Local Development Setup

#### **1. Clone Repository**
```bash
git clone https://github.com//Assessement.git
cd Assessement
```

#### **2. Backend Setup**

```bash
cd Backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\Activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (if not exists)
cp .env.example .env

# Update .env with your database and Redis URLs
# DATABASE_URL=postgresql://user:password@localhost:5432/assessment
# REDIS_URL=redis://localhost:6379
```

#### **3. Frontend Setup**

```bash
cd Frontend

# Install dependencies
npm install --legacy-peer-deps

# Create .env file
echo REACT_APP_API_URL=http://localhost:8000 > .env
```

#### **4. Start Services**

**Terminal 1 - Backend API:**
```bash
cd Backend
uvicorn app.main:app --reload
# Backend runs on http://localhost:8000
```

**Terminal 2 - Celery Worker:**
```bash
cd Backend
celery -A app.core.celery_app worker --loglevel=info
```

**Terminal 3 - Frontend:**
```bash
cd Frontend
npm start
# Frontend runs on http://localhost:3000
```

---

## 🏗️ Architecture Overview

### **System Components**

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                    http://localhost:3000                     │
│  - User authentication & dashboard                           │
│  - Document upload form                                      │
│  - Real-time status polling                                  │
│  - JSON editor for document review                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API (HTTP)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   FastAPI Backend                            │
│                http://localhost:8000                         │
│  ✓ User management (register, login, JWT)                   │
│  ✓ Document upload (single/multiple)                        │
│  ✓ Document listing with filters                            │
│  ✓ Status tracking & progress updates                       │
│  ✓ Document editing (reviewed results)                      │
│  ✓ Export (JSON/CSV)                                        │
│  ✓ Error handling & retry logic                             │
└────┬─────────────────────────────┬──────────────────────────┘
     │                             │
     │ (SQL)                       │ (Redis Pub/Sub)
     │                             │
┌────▼──────────────────┐   ┌─────▼──────────────────┐
│   PostgreSQL Database │   │   Redis Cache/Queue    │
│  - Users              │   │  - Task queue          │
│  - Documents          │   │  - Progress tracking   │
│  - Processing results │   │  - Real-time updates   │
└───────────────────────┘   └────┬────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │  Celery Worker │
                         │ (Background Job)│
                         │                │
                         │ Processing:    │
                         │ 1. Parse file  │
                         │ 2. Extract data│
                         │ 3. Validate    │
                         │ 4. Store result│
                         └────────────────┘
```

### **Data Flow**

1. **User Uploads Document**
   - Frontend sends file to Backend API
   - Backend stores file metadata in PostgreSQL
   - Creates Celery task and publishes to Redis

2. **Document Processing**
   - Celery worker picks up task from Redis
   - Processes document (parsing → extraction → validation)
   - Updates progress via Redis Pub/Sub
   - Stores results in PostgreSQL

3. **Real-time Status Updates**
   - Frontend polls backend every 2 seconds
   - Backend fetches latest status from database
   - Displays status: queued → processing → completed

4. **Document Review**
   - User can edit extracted data (JSON)
   - Frontend sends updated data to backend
   - Backend stores in `reviewed_result`

5. **Export**
   - User requests export (JSON or CSV)
   - Backend retrieves from database
   - Returns file download

---

## 🔧 Run Steps

### **Development Mode (Local)**

```bash
# Terminal 1 - Start Backend
cd Backend
.\venv\Scripts\Activate
uvicorn app.main:app --reload

# Terminal 2 - Start Celery Worker
cd Backend
.\venv\Scripts\Activate
celery -A app.core.celery_app worker --loglevel=info

# Terminal 3 - Start Frontend
cd Frontend
npm start
```


## 📌 Assumptions

1. **User Authentication**
   - Users have unique emails
   - Passwords are hashed with bcrypt
   - JWT tokens expire (can be refreshed)
   - Sessions stored in browser localStorage

2. **Document Processing**
   - Documents are processed sequentially (one at a time)
   - Processing duration: 5-15 seconds typical
   - No document size limit enforced (can adjust middleware if needed)

3. **Database Availability**
   - PostgreSQL is always accessible
   - Tables are auto-created on first run
   - No database migrations needed

4. **External Services**
   - Redis is accessible for Celery communication
   - Internet connection assumed (for API calls)
   - No offline mode support

5. **File Uploads**
   - Files stored temporarily during processing
   - Cleaned up after processing completes
   - Max file size: configurable (default 50MB)

---

## 🔄 Tradeoffs

### **Chosen: Polling over WebSockets**
- ✅ **Simpler implementation** - no WebSocket infrastructure needed
- ❌ **Higher latency** - 2-second polling delay (not instant)
- ❌ **More server load** - repeated API calls
- **Justification**: For small user base, polling is sufficient and easier to maintain

### **Chosen: Celery + Redis over in-process jobs**
- ✅ **Scalable** - can add multiple workers easily
- ✅ **Async** - doesn't block web server
- ❌ **More complex** - requires external services
- ❌ **Operational overhead** - need to manage Celery workers
- **Justification**: Needed for true background processing without blocking API

### **Chosen: SQL Database over NoSQL**
- ✅ **Strong consistency** - ACID guarantees
- ✅ **Complex queries** - filtering, sorting works well
- ❌ **Less flexible schema** - must define upfront
- ❌ **Less scalable horizontally** - harder to shard
- **Justification**: Structured data with relationships fits SQL well

### **Chosen: JWT over Session-based Auth**
- ✅ **Stateless** - no server-side session storage needed
- ✅ **Scalable** - works across multiple servers
- ❌ **Token revocation harder** - can't immediately invalidate
- ❌ **Larger request size** - JWT is larger than session ID
- **Justification**: Stateless design fits microservices approach

### **Chosen: Frontend Polling over real-time updates**
- ✅ **Simple implementation** - no WebSocket needed
- ❌ **2-second delays** - not real-time
- ❌ **Battery drain on mobile** - if deployed as mobile
- **Justification**: Sufficient for dashboard use case

---

## ⚠️ Limitations

### **Current**

1. **Single Celery Worker**
   - Only one document processes at a time
   - Queue builds up if many users upload simultaneously
   - **Fix**: Add more Celery workers

2. **Polling Latency**
   - Status updates every 2 seconds
   - User sees delay in status changes
   - **Fix**: Implement WebSockets for real-time updates

3. **File Storage**
   - Files stored in memory temporarily
   - Large files (>100MB) may cause memory issues
   - **Fix**: Use cloud storage (S3, Azure Blob) for persistent storage

4. **Error Handling**
   - Failed documents can be retried manually
   - No automatic retry on transient failures
   - **Fix**: Implement exponential backoff retry logic

5. **Authentication**
   - No email verification
   - No forgot password functionality
   - **Fix**: Add email confirmation and password reset

6. **No Rate Limiting**
   - Users can spam upload requests
   - No protection against DoS attacks
   - **Fix**: Add request rate limiting per user

7. **No Audit Logs**
   - No tracking of who changed what and when
   - **Fix**: Add audit trail for all operations

### **Scalability Issues**

1. **Single Backend Server**
   - Can't handle more than ~100 concurrent users
   - **Fix**: Deploy multiple backend instances with load balancer

2. **Redis Single Instance**
   - Single point of failure for task queue
   - No replication or failover
   - **Fix**: Use Redis Cluster or managed Redis service

3. **PostgreSQL Connection Limits**
   - Default 100 connections, Render limit is 90
   - May exhaust under heavy load
   - **Fix**: Use connection pooling (pgbouncer)

### **Security Limitations**

1. **No API Rate Limiting**
   - Anyone can spam endpoints
   - **Fix**: Add rate limiting middleware

2. **Passwords stored directly**
   - No additional encryption layer
   - **Fix**: Use encrypted fields for sensitive data

3. **No HTTPS certificate pinning**
   - Could be vulnerable to MITM attacks
   - **Fix**: Implement certificate pinning in frontend

4. **Logs contain user data**
   - No PII masking in logs
   - **Fix**: Implement secure logging with data redaction

#### Developed using an AI-augmented workflow, where I personally defined the system architecture and ensured strict adherence to all technical requirements and project-specific constraints.
---


