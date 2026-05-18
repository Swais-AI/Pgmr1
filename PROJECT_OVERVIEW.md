# ERP Parent Dashboard - Project Overview

## Executive Summary

This is a **School Management System (ERP) Parent Dashboard** — a multilingual, accessible web application where parents can monitor their children's academic progress, view teacher remarks, stay updated with school notices, and communicate with teachers through a centralized Communication Center.

The portal includes native speech-to-text (STT) and text-to-speech (TTS) capabilities with support for English, Hindi, Telugu, and Odia languages.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 16)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Pages: Dashboard | Remarks | Notices | Communication     │ │
│  │  Components: TopBar, Sidebar, Cards, Modals               │ │
│  │  Libraries: Tailwind CSS, Recharts, Heroicons             │ │
│  │  State: React Context (DashboardContext)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Multilingual Engine (lib/multilingual.ts)                │ │
│  │  • useTranslation: React hook for instant translation UI  │ │
│  │  • useSpeechInput: Browser webkitSpeechRecognition        │ │
│  │  • useTTS: Browser SpeechSynthesis with fallback voices   │ │
│  │  • translateCached: Module-level memory cache              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕ REST API (Axios)
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + SQLAlchemy)                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │  Routers    │  │   Services   │  │    Database    │        │
│  ├─────────────┤  ├──────────────┤  ├────────────────┤        │
│  │• dashboard  │  │• dashboard   │  │ PostgreSQL     │        │
│  │• translate  │  │• translation │  │ SQLAlchemy ORM │        │
│  │• communication │• analytics   │  │                │        │
│  └─────────────┘  └──────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Structure

### Pages (Next.js App Router)

| Path | Purpose | Status | Notes |
|------|---------|--------|-------|
| `/parent/dashboard` | Main dashboard with stats, alerts, deadlines, recommendations | **Active** | Recently added Learning Progress card (replaces Attendance) |
| `/parent/remarks` | Teacher remarks timeline with filtering by subject | **Active** | Full translation + TTS support |
| `/parent/notices` | School announcements with class filtering | **Active** | Full translation + TTS support |
| `/parent/communication` | Message threads with teachers (subjects, categories, leave requests) | **Active** | Integrated Leave Request workflow; translation on conversations & messages |
| `/parent/assignments` | Assignment history and submission tracking | **Active** | Basic view without speech features |
| `/parent/quiz` | Quiz scores and performance analysis | **Active** | Charts and analytics |
| `/parent/attendance` | **Commented Out** | **Legacy** | Redirects to dashboard; original code preserved as comments |

### Key Components

| Component | Purpose | Speech Support |
|-----------|---------|-----------------|
| `TopBar` | Dropdown student selector, language switcher | No |
| `Sidebar` | Navigation menu (Attendance removed) | No |
| `LanguageSelector` | 4-language dropdown (EN/HI/TE/OR) | N/A |
| `SpeakBtn` | Text-to-speech button with fallback indicator | **Yes** — shows amber dot when using fallback voice |
| `MicBtn` | Speech-to-text activation for form fields | **Yes** — red border when listening |
| Dashboard cards | Stats, alerts, deadlines, recommendations | Partial — dashboard content translatable, no TTS |
| Remarks/Notices cards | Content display with translation & TTS | **Full support** |

### State Management

- **DashboardContext** (`lib/DashboardContext.tsx`): Holds `studentId`, `language`, `setLanguage`
- **useTranslation** (`lib/multilingual.ts`): React hook managing translated text state + loading flag
- **Component-level state**: React `useState` for local filters, modals, form fields

### Multilingual Engine

Located in `lib/multilingual.ts`:

```typescript
export const SPEECH_LANG_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',    // Telugu
  or: 'or-IN',    // Odia
};

// useTranslation(texts[], language) → { displayed[], translating }
// useSpeechInput(language) → { activeField, startFor() }
// useTTS() → { speaking, speak(), fallbackLang }
```

**Translation Flow:**
1. User changes language
2. `useTranslation` **immediately resets** shown text to raw (prevents stale translations)
3. Sets `translating = true` (UI shows spinner)
4. Calls `translateBatch()` with module-level cache
5. Once results arrive, updates `displayed` array
6. Sets `translating = false`

**TTS Flow:**
1. User clicks SpeakBtn
2. `useTTS.speak(text, language, key)` picks best voice with fallback chain
3. For Telugu/Odia: tries `te-IN` → `te` → `hi-IN` → `hi` → `en-IN` → first available
4. Console logs voice selection for debugging
5. Plays utterance at 0.9x speed
6. Toggles off if same key clicked again

**STT Flow:**
1. User clicks MicBtn
2. `useSpeechInput.startFor(fieldKey, callback)` uses `webkitSpeechRecognition`
3. Listens in current language (e.g., `te-IN` for Telugu)
4. Returns transcript on success or error
5. Appends to field value

---

## Backend Structure

### Routers

| Router | Endpoints | Purpose |
|--------|-----------|---------|
| `dashboard.py` | `GET /dashboard/{student_id}` | Aggregates student data: alerts, deadlines, recommendations, grades, notices, quiz scores, assignment status |
| `translation.py` | `POST /translate` | Translates text using deep-translator (Google Translate backend) |
| `communication.py` | `GET/POST /comm/*` | Conversation CRUD, message threads, leave requests, recipient lookup |

### Models (SQLAlchemy)

Core entities (all created by `Base.metadata.create_all()`):

| Table | Purpose | Status |
|-------|---------|--------|
| `student_master` | Student records | **Active** |
| `parent_master` | Parent info | **Active** |
| `parent_student_map` | Parent-student relationships | **Active** |
| `class_master` | Grade/class definitions | **Active** |
| `teacher_master` | Teacher records | **Active** |
| `subject_master` | Subject assignments | **Active** |
| `chapter_master` | Chapter/unit definitions | **Active** |
| `assignment_master` | Assignment definitions | **Active** |
| `student_submission` | Student submissions | **Active** |
| `quiz_master` | Quiz definitions | **Active** |
| `quiz_response` | Student quiz scores | **Active** |
| `notice_board` | School notices | **Active** |
| `teacher_parent_interaction_v2` | Teacher remarks/feedback | **Active** |
| `support_tickets` | Communication threads (+ leave requests) | **Active** |
| `ticket_messages` | Individual messages in threads | **Active** |

Legacy tables **excluded** from DB creation (model class bodies commented out):

| Table | Reason |
|-------|--------|
| `attendance_master` | Attendance module removed from portal |
| `leave_requests` | Leave requests moved to Communication Center category |
| `call_requests` | Feature disabled; routes commented out |
| `school_events` | Upcoming events return `[]`; not actively used |
| `chat_threads` | Replaced by `support_tickets` (Communication Center) |
| `chat_messages` | Replaced by `ticket_messages` (Communication Center) |

### Services

| Service | Purpose |
|---------|---------|
| `dashboard_service.py` | Aggregates alerts, deadlines, recommendations, performance summaries |
| `analytics_service.py` | Computes performance metrics, trends, subject rankings |
| `translation_service.py` | Wraps `deep-translator` library for multi-language support |

---

## Key Workflows

### 1. Dashboard Workflow

```
Parent logs in → Selects child → Dashboard loads:
  ├─ Quick stats: Learning Progress, Pending Tasks, Notices, Quiz Avg
  ├─ Action Required (5 alerts with priorities)
  ├─ Upcoming Deadlines (with days-left countdown)
  ├─ Performance Summary (strongest/weakest subjects, avg score, subject bars)
  ├─ Recommendations (smart suggestions for improvement)
  └─ Recent Activity (notification tiles)

If language ≠ English:
  ├─ Alert messages translate asynchronously
  ├─ Deadline titles translate asynchronously
  ├─ Recommendation messages & actions translate asynchronously
  └─ UI shows "Translating content…" spinner during fetch
```

**Learning Progress Card** (replaces old Attendance):
- Sources value from `assignment_completion_pct` if available
- Falls back to `avg_quiz_score` if assignments not tracked
- Shows contextual label (Strong/Good/Needs follow-up)

### 2. Communication Center Workflow

```
Parent initiates conversation:
  ├─ Selects recipient (teacher/admin)
  ├─ Chooses category (Academic, Leave Request, Homework, etc.)
  │  └─ If "Leave Request": date range fields appear (optional)
  ├─ Enters subject with optional STT
  ├─ Enters message/reason with optional STT
  └─ Submits

Conversation view:
  ├─ Lists all threads left panel (with translated previews)
  ├─ Clicking thread shows message history
  ├─ Each message translates independently
  ├─ Reply box has STT button
  └─ All content supports TTS (with fallback voice indicator)

Leave Request specifics:
  ├─ Subject auto-includes student name
  ├─ Date range compiled into first message
  ├─ Tracked separately from general conversations via category
```

### 3. Translation Workflow

```
Language changes to Tamil/Telugu/Odia:
  ├─ Dashboard: all alerts, deadlines, recommendations re-translate
  ├─ Remarks page: all comments re-translate
  ├─ Notices page: titles & bodies re-translate
  ├─ Communication: all conversation subjects, previews, message bodies re-translate

Cache behavior:
  ├─ First translation: API call (slow, shows spinner)
  ├─ Switching back to same language: instant (from module cache)
  └─ Switching between new languages: API call (slow again)

Error handling:
  ├─ Translation fails → keep original text (graceful degradation)
  ├─ User sees English if translation unavailable
  └─ No breaking UI changes
```

### 4. Speech-to-Text Workflow

```
Parent clicks MicBtn next to a form field:
  ├─ Browser requests microphone permission (first use only)
  ├─ Listens in current language (e.g., Hindi)
  ├─ Appends recognized text to field
  ├─ Shows red pulsing indicator while listening
  └─ Auto-stops on speech end or error

Available on:
  ├─ Communication modal: subject & message fields
  ├─ Communication reply box
  └─ Not on remarks/notices (read-only content)
```

### 5. Text-to-Speech Workflow

```
Parent clicks SpeakBtn on content (Remarks, Notices, Messages):
  ├─ Reads translated text in current language
  ├─ If Telugu/Odia: falls back to Hindi then English if native voice unavailable
  ├─ Shows blue pulsing indicator while speaking
  ├─ Amber dot indicates fallback voice in use (tooltip on hover)
  └─ Clicking again toggles off

Browser voice selection logic:
  ├─ Exact lang match (e.g., te-IN)
  ├─ Prefix match (e.g., te)
  ├─ Name hint (voice.name contains "Telugu")
  ├─ Next in fallback chain
  └─ First available voice (never silent)
```

---

## Feature Status

### Active Features ✅
- Dashboard with stats, alerts, deadlines, recommendations
- Remarks history with filtering
- Notices with class filtering
- Communication Center with Leave Requests
- English, Hindi, Telugu, Odia translations
- Speech-to-text (all form fields)
- Text-to-speech (remarks, notices, messages)
- Voice fallback for Telugu/Odia
- Translation caching (module-level)
- Responsive design (mobile, tablet, desktop)

### Recently Refactored 🔄
- **Attendance module fully removed** from sidebar, dashboard, and backend DB
  - `AttendanceMaster`, `LeaveRequest` model class bodies commented out in `models.py`
  - Those tables no longer created by `Base.metadata.create_all()`
  - Dashboard health score now 60% assignment completion + 40% quiz average
  - `attendance_trend` and `attendance_heat` return `null` from API
  - `/parent/attendance` redirects to dashboard
- **Legacy chat/call/events tables deregistered** from SQLAlchemy
  - `call_requests`, `chat_threads`, `chat_messages`, `school_events` tables excluded from DB
  - Communication Center (`SupportTicket` + `TicketMessage`) is the sole active messaging system
- **Multilingual system stabilized** with `useTranslation` hook
  - Prevents stale translation state
  - Adds loading spinners
  - Better error handling
- **TTS voice fallback chain** added
  - Telugu/Odia now audible even without native browser voices
  - Fallback priority: Target lang → Hindi → English → Any available
  - Console logging for debugging

### Partially Used / Legacy ⚠️
- **Attendance module**: Fully removed from UI and DB. `AttendanceMaster` model commented out.
  `attendance_trend` and `attendance_heat` return `null`. Original widgets kept as disabled components.
- **Call Requests**: Model and routes fully disabled; `call_requests` table excluded from DB
- **Chat system** (`ChatThread`/`ChatMessage`): Tables excluded from DB; replaced by Communication Center
- **School Events** (`SchoolEvent`): Table excluded from DB; `upcoming_events` returns `[]`
- **Leave Requests** (`LeaveRequest`): Model commented out; flows through Communication Center category instead

---

## Authentication & Sessions

**Current State**: No formal authentication implemented.
- Hard-coded `parent_id = 1`, `student_id` from dropdown
- **For production**: Add JWT/OAuth2 via FastAPI dependency injection
- Session stored in `DashboardContext` (client-side)

---

## External Services & APIs

| Service | Purpose | Integration |
|---------|---------|-------------|
| **Google Translate** (via deep-translator) | Text translation | Backend service, called by `/translate` endpoint |
| **Browser Speech API** (Web Audio) | STT / TTS | Client-side only, no external service calls |
| **WebSocket** (future) | Real-time messages | Not yet implemented; consider for live notifications |

---

## Database

- **Engine**: PostgreSQL (configured in `backend/database.py`)
- **ORM**: SQLAlchemy
- **Tables**: ~15 core tables (student, parent, remarks, notices, messages, quizzes, assignments, etc.)
- **Seed data**: Via `mock_data.py` on first run

---

## Known Issues & Risky Areas

### 🔴 High Priority
1. **No authentication** — Anyone can access any student's data via student_id dropdown
2. **CORS unrestricted** (`allow_origins=["*"]`) — Unsafe for production
3. **Hard-coded parent_id = 1** — Only one parent can exist

### 🟡 Medium Priority
1. **Legacy model bodies commented** in `models.py` — tables excluded from `create_all()`. If DB already exists with those tables, they will remain until manually dropped. New DB installs will not have them.
2. **Call Requests disabled** — Easy to accidentally re-enable without full feature. Keep commented.
3. **No input validation** on translation (could cause API errors)
4. **Telugu/Odia TTS relies on browser voice availability** — May fail silently on some devices (though fallback helps)

### 🟢 Low Priority
1. Dead component widgets (`AttendanceHeatWidget`, `AttendanceTrendWidget`) kept as disabled files — safe to delete
2. `analytics_service.py` is a disabled reference file — imports are now broken (models removed); safe to delete
3. Unused API functions commented in `lib/api.ts` (e.g., `fetchCallRequestsHistory`) could be removed

---

## Development Guidelines

### Adding a New Feature
1. Create page under `/src/app/parent/{feature}/page.tsx`
2. Import `useDashboard` for language/studentId context
3. For translatable content, use `useTranslation` hook
4. For speech, use `useSpeechInput` and `useTTS` hooks
5. Call backend APIs via `lib/api.ts`
6. Add navigation in `Sidebar.tsx`

### Modifying Translations
1. Edit backend translation service if needed
2. Frontend automatically re-translates on language change
3. Check module-level cache behavior (persists until refresh)

### Adding New Languages
1. Add language code to `SPEECH_LANG_MAP` in `lib/multilingual.ts`
2. Add to `LANGUAGES` array in `LanguageSelector.tsx`
3. Backend already supports arbitrary language codes via `deep-translator`
4. Update TTS fallback chain in `VOICE_FALLBACKS` if needed

---

## Testing Checklist

- [ ] Dashboard loads for all students
- [ ] Language switching works on all pages
- [ ] Translations render without flashing stale text
- [ ] STT mic button works (requires HTTPS or localhost)
- [ ] TTS plays in English, Hindi, Telugu, Odia
- [ ] TTS falls back gracefully on Telugu/Odia if native voices unavailable
- [ ] Leave Requests submit with date range
- [ ] Remarks and Notices filter correctly
- [ ] Communication threads preserve translation on message send
- [ ] Responsive design works on mobile (<640px)

---

## Deployment Notes

### Frontend
- Build with `npm run build`
- Deploy to Vercel, Netlify, or any Node.js host
- Set `NEXT_PUBLIC_API_URL` for backend endpoint if needed

### Backend
- Run with `uvicorn main:app --reload` (dev) or `--host 0.0.0.0 --port 8000` (prod)
- Set up PostgreSQL database
- Seed with `python mock_data.py` if needed
- Enable proper CORS in production
- Implement authentication before live deployment

---

**Last Updated**: May 13, 2026  
**Document Version**: 1.0  
**Maintained By**: Development Team
