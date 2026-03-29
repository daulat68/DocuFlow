# Deployment Guide - Render

## Prerequisites
- GitHub repository with this code pushed
- Render account (render.com)
- **Existing PostgreSQL database URL** (already running)
- **Existing Redis URL** (already configured)
- All tables already created in PostgreSQL

## Step 1: Prepare the Repository

**Remove these files before deploying:**
```
ASSESSMENT_IMPLEMENTATION.md
DATABASE_SETUP.md
FILE_INVENTORY.md
TESTING_GUIDE.md
setup.bat
setup.sh
.gitignore (add to keep node_modules and __pycache__ out)
```

**Keep these files:**
```
render.yaml (deployment config - create via Copilot)
README.md
SYSTEM_OVERVIEW.md
.gitignore
Backend/requirements.txt (already includes gunicorn)
Frontend/package.json
```

## Step 2: Create Required Files

### `render.yaml` ✅
Already created at root - defines:
- **Web Service**: FastAPI backend with gunicorn
- **Background Worker**: Celery worker (runs indefinitely processing tasks)
- **Redis**: Pub/Sub for real-time progress updates
- **PostgreSQL**: Database service

### Backend `requirements.txt` ✅
Already updated with `gunicorn==23.0.0`

### `.env` Configuration
Render will ask you to provide these environment variables when deploying:

**Required (paste your existing URLs):**
- `DATABASE_URL` - Your PostgreSQL connection string (from existing database)
- `REDIS_URL` - Your Redis connection string (e.g., Redis Labs URL you were using)

**Already configured:**
- `PYTHON_VERSION` - Set to `3.11` in render.yaml
- Other env vars - Optional, defaults work fine

## Step 3: Deploy on Render

### Option A: Using render.yaml (Recommended) ✅

1. Go to https://dashboard.render.com
2. Click "New" → "Blueprint"
3. Connect GitHub repo and select this repo
4. Before clicking Deploy, Render will ask for environment variables:
   - **DATABASE_URL**: Paste your existing PostgreSQL URL
   - **REDIS_URL**: Paste your existing Redis URL
5. Click "Deploy"
6. Render will automatically:
   - Deploy FastAPI backend on web service
   - Deploy Celery worker on background service  
   - Wire up your existing database and Redis

### Option B: Manual Setup (Skip if using render.yaml)

If Blueprint deployment doesn't work:

#### 1. Deploy Backend (Web Service)
- Dashboard → New → Web Service
- Connect GitHub repo
- Build command:
  ```bash
  pip install -r Backend/requirements.txt
  ```
- Start command:
  ```bash
  cd Backend && gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT
  ```
- Environment Variables:
  - `DATABASE_URL`: Your PostgreSQL URL
  - `REDIS_URL`: Your Redis URL
  - `PYTHON_VERSION`: `3.11`

#### 2. Deploy Celery Worker (Background Job)
- Dashboard → New → Background Worker
- Same repo as backend
- Build command:
  ```bash
  pip install -r Backend/requirements.txt
  ```
- Start command:
  ```bash
  cd Backend && celery -A app.core.celery_app worker --loglevel=info --concurrency=1 --prefetch-multiplier=1
  ```
- Environment Variables: (same as backend)
  - `DATABASE_URL`: Your PostgreSQL URL
  - `REDIS_URL`: Your Redis URL
  - `PYTHON_VERSION`: `3.11`

## Step 4: Verify Deployment

### Backend Health Check
```
GET https://your-backend.onrender.com/
```
Should return 200 OK

### Check Celery Worker
Go to Background Worker logs - should show:
```
[*] Ready to accept tasks
```

### Test Document Upload
1. Visit frontend URL
2. Upload a document
3. Watch status: `queued` → `processing` → `completed`
4. Check backend logs for Celery task execution

## Troubleshooting

### Celery tasks not running
- Check background worker logs in Render dashboard
- Verify `DATABASE_URL` and `REDIS_URL` match your existing services
- Restart worker from Render dashboard

### Connection to database/Redis fails
- Verify `DATABASE_URL` is correct and database is accessible from Render
- Verify `REDIS_URL` is correct and Redis is accessible from Render
- Test URLs locally: `python -c "import os; print(os.getenv('DATABASE_URL'))"`

### Backend can't start
- Check logs for SQLAlchemy errors (tables already exist, should be fine)
- Verify gunicorn installation: `pip install gunicorn`
- Check Python version matches (3.11)

### Tasks queue is full
- Reduce Celery concurrency from 1 to 0.5 if needed
- Monitor memory usage in Render dashboard

## Important Notes

⚠️ **Free Tier Limitations (Render only):**
- Backend will spin down after 15 min of inactivity
- Celery worker won't pause (runs continuously - good for processing)
- Both services restart occasionally for maintenance

✅ **What Works:**
- Document uploads and processing (your Celery worker handles it)
- Real-time status updates via polling
- Export functionality
- Full workflow end-to-end with your existing database

## Cost Optimization

Since you're using **existing PostgreSQL and Redis** (not creating new ones on Render):

1. **Backend Web Service**: Free tier or $7/month (auto-wake)
2. **Celery Worker**: $7/month (runs continuously)
3. **PostgreSQL & Redis**: Already paid elsewhere (your existing setup)

**Total: ~$7-14/month** on Render (much cheaper than provisioning new services)

### Cost Breakdown:
- ✅ No extra database costs
- ✅ No extra Redis costs  
- Only paying for Render's compute (web + worker services)

## Rollback

If deployment fails:
- Render keeps previous deployment
- Click "Rollback" to previous version
- No downtime during rollback

---

**Next Steps:**
1. Push this code to GitHub
2. Deploy via render.yaml (1 click)
3. Test the full workflow
4. Monitor logs for issues
