# ERP Parent Dashboard - Setup & Run Guide

## System Requirements

### Required Software
- **Node.js**: 18+ (check with `node --version`)
- **Python**: 3.9+ (check with `python --version`)
- **PostgreSQL**: 12+ (or Docker with PostgreSQL image)
- **npm** or **yarn**: Package manager for Node.js (included with Node)
- **pip**: Python package manager (included with Python)

### Recommended Tools
- **Git**: Version control
- **VS Code**: Code editor
- **Postman**: API testing (optional)
- **pgAdmin** or **DBeaver**: Database GUI (optional)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/sgs_swais.git
cd sgs_swais
```

### 2. Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

#### Install Dependencies

```bash
npm install
```

Or with yarn:

```bash
yarn install
```

#### Environment Variables

Create `.env.local` in the `frontend` directory:

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Note**: For production, update `NEXT_PUBLIC_API_URL` to your backend URL.

#### Run Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

#### Build for Production

```bash
npm run build
npm start
```

**Installed Dependencies**:
- `next` 16.2.4 — React framework
- `react` 19.2.4 — UI library
- `axios` 1.15.2 — HTTP client
- `tailwindcss` 4 — CSS styling
- `recharts` 3.8.1 — Data visualization
- `@heroicons/react` 2.2.0 — Icon library
- `typescript` 5 — Type safety

---

### 3. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

#### Create Python Virtual Environment

**On Windows (PowerShell)**:

```powershell
python -m venv venv
.\venv\Scripts\Activate
```

**On macOS/Linux (bash/zsh)**:

```bash
python3 -m venv venv
source venv/bin/activate
```

#### Install Dependencies

```bash
pip install -r requirements.txt
```

**Installed Dependencies**:
- `fastapi` — API framework
- `uvicorn` — ASGI server
- `sqlalchemy` — ORM
- `psycopg2-binary` — PostgreSQL adapter
- `pydantic` — Data validation
- `deep-translator` — Text translation (Google Translate backend)

#### Environment Variables

Create `.env` in the `backend` directory:

```env
# .env (create this file for environment-specific config)
# PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/sgs_swais_db

# Logging level (optional)
LOG_LEVEL=INFO

# CORS origins (restrict for production)
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

**If no `.env` file**: The app will use default `DATABASE_URL` pointing to local PostgreSQL on `localhost:5432`.

#### Configure PostgreSQL Connection

Edit `backend/database.py`:

```python
# Default configuration (change if needed)
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/sgs_swais_db"
engine = create_engine(DATABASE_URL)
```

Or override via environment variable:

```bash
export DATABASE_URL=postgresql://user:password@host:5432/dbname
```

#### Database Setup

Ensure PostgreSQL is running, then create the database:

```bash
# Using psql
psql -U postgres
CREATE DATABASE sgs_swais_db;
EXIT;
```

Or use Docker:

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
```

#### Run Migrations (if applicable)

The app auto-creates tables on startup via `Base.metadata.create_all()`. No manual migration needed (SQLAlchemy handles it).

#### Seed Initial Data (Optional)

```bash
python mock_data.py
```

This populates the database with sample students, parents, teachers, assignments, quizzes, remarks, and notices.

**Note**: Legacy tables (`attendance_master`, `leave_requests`, `call_requests`, `school_events`, `chat_threads`, `chat_messages`) are not seeded — those model class bodies are commented out and those tables are not created.

#### Run Development Server

```bash
uvicorn main:app --reload
```

The backend will be available at `http://localhost:8000`.

**Server Options**:
- `--reload` — Auto-reload on code changes (dev only)
- `--host 0.0.0.0` — Listen on all network interfaces
- `--port 8000` — Change port if 8000 is in use
- `--log-level debug` — Verbose logging

#### Run Production Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Running Both Services Together

### Option 1: Two Separate Terminals

**Terminal 1 (Frontend)**:
```bash
cd frontend
npm run dev
```

**Terminal 2 (Backend)**:
```bash
cd backend
source venv/bin/activate  # or .\venv\Scripts\Activate on Windows
uvicorn main:app --reload
```

### Option 2: Using npm Concurrently (Optional)

Install `concurrently`:

```bash
npm install -g concurrently
```

From project root:

```bash
concurrently "cd frontend && npm run dev" "cd backend && source venv/bin/activate && uvicorn main:app --reload"
```

Or create `package.json` script at root.

---

## Verification Checklist

After setup, verify both services are running:

### Frontend
- [ ] `http://localhost:3000` opens in browser
- [ ] Dashboard loads (may show mock data)
- [ ] Language switcher is visible in top-right
- [ ] Sidebar navigation is present

### Backend
- [ ] `http://localhost:8000` returns `{"message": "Parent Dashboard API is running"}`
- [ ] Check API docs at `http://localhost:8000/docs` (Swagger UI)
- [ ] Database tables exist (check with pgAdmin or psql)

### Integration
- [ ] Select a student from dropdown on dashboard
- [ ] Dashboard data loads from backend
- [ ] Language switching triggers translations
- [ ] Click on Remarks, Notices, or Communication pages
- [ ] Verify translations appear without errors

---

## Common Issues & Fixes

### Issue: "Port 3000 already in use"

**Frontend**:
```bash
npm run dev -- -p 3001
```

**Backend**:
```bash
uvicorn main:app --reload --port 8001
```

Then update `.env.local` in frontend to point to the new backend port.

---

### Issue: "Connection refused to localhost:8000"

**Check Backend is Running**:
```bash
# Terminal 2
uvicorn main:app --reload
# Should see: "Uvicorn running on http://127.0.0.1:8000"
```

**Check Network**:
```bash
curl http://localhost:8000/
# Should return: {"message": "Parent Dashboard API is running"}
```

**If still fails**:
- Firewall blocking port 8000? Allow it.
- Try `--host 0.0.0.0` in uvicorn command.
- Check `.env.local` `NEXT_PUBLIC_API_URL` matches backend URL.

---

### Issue: "Database connection failed" or "FATAL: Ident authentication failed"

**PostgreSQL not running or wrong credentials**:

1. Check PostgreSQL status:
   ```bash
   psql -U postgres
   # Should connect to PostgreSQL prompt
   ```

2. Create database if missing:
   ```bash
   psql -U postgres -c "CREATE DATABASE sgs_swais_db;"
   ```

3. Update `backend/database.py` with correct credentials:
   ```python
   DATABASE_URL = "postgresql://username:password@localhost:5432/sgs_swais_db"
   ```

4. Restart backend:
   ```bash
   uvicorn main:app --reload
   ```

---

### Issue: "ModuleNotFoundError: No module named 'fastapi'"

**Virtual environment not activated**:

```bash
# Windows
.\venv\Scripts\Activate

# macOS/Linux
source venv/bin/activate

# Then try again
pip install -r requirements.txt
uvicorn main:app --reload
```

---

### Issue: "Module not found: 'next' in frontend"

**Dependencies not installed**:

```bash
cd frontend
npm install
npm run dev
```

---

### Issue: "Cannot find module @heroicons/react"

**Incomplete frontend install**:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

### Issue: "SpeechRecognition not available" or no microphone access

**STT requires HTTPS (or localhost)**:
- Works on `http://localhost:3000` ✅
- Works on `https://yourdomain.com` ✅
- **Fails** on `http://production-domain.com` ❌

**Fix**: Use HTTPS in production or request microphone permission (browser popup).

---

### Issue: "No voice found for Telugu/Odia"

**Browser doesn't have Telugu/Odia voices installed**:
- This is **expected** on many systems
- **App handles it**: Falls back to Hindi, then English
- **Check browser console**: Look for `[TTS]` logs showing fallback used
- **Solution**: Install language pack on OS (not needed for fallback to work)

---

## Database Schema Quick Reference

Key tables (auto-created by `Base.metadata.create_all()` on first run):

- `class_master` — Classes/grades
- `student_master` — Students
- `parent_master` — Parents
- `parent_student_map` — Parent-student relationships
- `teacher_master` — Teachers
- `subject_master` — Subjects per class
- `chapter_master` — Chapters/units within subjects
- `assignment_master` — Assignment definitions
- `student_submission` — Student assignment submissions
- `quiz_master` — Quiz definitions
- `quiz_response` — Student quiz scores
- `notice_board` — School notices/announcements
- `teacher_parent_interaction_v2` — Teacher remarks/feedback on students
- `support_tickets` — Communication threads (includes Leave Requests as a category)
- `ticket_messages` — Individual messages within threads

**Legacy tables NOT created** (model class bodies commented out in `models.py`):
`attendance_master`, `leave_requests`, `call_requests`, `school_events`, `chat_threads`, `chat_messages`

See **SCHEMA_AND_MODELS_REFERENCE.md** for detailed schema documentation.

---

## Ports Used

| Service | Port | URL |
|---------|------|-----|
| Frontend (Next.js) | 3000 | `http://localhost:3000` |
| Backend (FastAPI) | 8000 | `http://localhost:8000` |
| PostgreSQL | 5432 | `postgresql://localhost:5432/sgs_swais_db` |

---

## Monitoring & Debugging

### View Backend Logs

```bash
# More verbose logging
uvicorn main:app --reload --log-level debug

# Watch only errors
uvicorn main:app --reload --log-level error
```

### Check Frontend Console

Press `F12` in browser → **Console** tab:
- `[TTS]` messages show speech synthesis details
- Translation errors appear as warnings
- API errors logged with `console.error()`

### API Documentation

Visit `http://localhost:8000/docs` for interactive Swagger UI of all endpoints.

---

## Production Deployment Checklist

- [ ] Set `CORS_ORIGINS` in backend `.env` to only trusted domains
- [ ] Set `DATABASE_URL` to production PostgreSQL
- [ ] Update `NEXT_PUBLIC_API_URL` in frontend `.env.production.local` to production backend
- [ ] Run `npm run build` in frontend and verify output
- [ ] Run backend with `--workers 4` (or more)
- [ ] Set up HTTPS/SSL certificate
- [ ] Configure database backups
- [ ] Set up monitoring & logging (e.g., Sentry, LogRocket)
- [ ] Review all TODO and FIXME comments in code
- [ ] Test all multilingual features in production environment
- [ ] Test STT/TTS on target devices

---

## Support & Troubleshooting

If issues persist:
1. Check backend logs: `uvicorn main:app --reload --log-level debug`
2. Check frontend console: Press `F12` in browser
3. Check PostgreSQL is running: `psql -U postgres`
4. Verify ports aren't blocked: `netstat -an | grep 3000` / `netstat -an | grep 8000`
5. Try clearing cache: `rm -rf frontend/.next` and restart

---

**Last Updated**: May 13, 2026  
**Version**: 1.0
