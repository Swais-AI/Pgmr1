# Tech Stack Reference

## Executive Summary

This is a **modern, multilingual web application** built with:
- **Frontend**: Next.js 16 (React 19) with Tailwind CSS
- **Backend**: FastAPI with SQLAlchemy ORM
- **Database**: PostgreSQL
- **Multilingual Engine**: Custom React hooks + deep-translator
- **Speech APIs**: Browser Web Audio + SpeechSynthesis (native, no server calls)

---

## Frontend Stack

### Framework & Runtime

| Component | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.2.4 | React SSR framework with App Router |
| **React** | 19.2.4 | UI library & state management |
| **Node.js** | 18+ | Runtime (development & build) |
| **npm/yarn** | Latest | Package manager |

**Key Features Used**:
- App Router (`app/parent/[route]/page.tsx`)
- Client Components (`'use client'` directive)
- Context API (`DashboardContext`)
- Server-side props (optional, not heavily used)
- Built-in font optimization

### Styling & UI

| Component | Version | Purpose |
|-----------|---------|---------|
| **Tailwind CSS** | 4 | Utility-first CSS framework |
| **@heroicons/react** | 2.2.0 | Icon library (24px outline icons) |
| **PostCSS** | 4 | CSS processing |

**Design System**:
- Color scheme: Teal/orange accent, gray base
- Responsive: Mobile-first (`sm:`, `md:`, `lg:` breakpoints)
- Components: Cards, badges, modals, timelines, dropdowns
- Dark mode: Not implemented (light-only currently)

**Common Classes**:
- `bg-white rounded-2xl border border-gray-100 shadow-sm`
- `text-sm font-semibold text-gray-700`
- `px-4 py-2.5 rounded-xl` (standard padding)
- `animate-spin`, `animate-pulse` (for loading states)

### Data Visualization

| Component | Version | Purpose |
|-----------|---------|---------|
| **Recharts** | 3.8.1 | React charting library |

**Used For**:
- Subject performance bar charts
- Assignment completion trends (if applicable)
- Quiz score distribution

**Charts Likely in Components**:
- `BarChart` (subject scores)
- `LineChart` (performance trends over time)
- `PieChart` (assignment completion ratio)

### HTTP Client

| Component | Version | Purpose |
|-----------|---------|---------|
| **Axios** | 1.15.2 | Promise-based HTTP client |

**Configuration**:
```typescript
export const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});
```

**Usage**:
- All API calls wrapped in try-catch
- Fallback responses on error (e.g., `return []`)
- Base URL from `NEXT_PUBLIC_API_URL` env var (production)

### State Management

| Component | Purpose |
|-----------|---------|
| **React Context** | Global state (studentId, language, setLanguage) |
| **React Hooks** (`useState`) | Component-level state (forms, modals, filters) |
| **useMemo** | Memoized computations (filtered lists, translated arrays) |
| **useCallback** | Stable function references (event handlers, speech input) |
| **useRef** | Persistent references (mic/TTS active field, speech synth) |

**State Architecture**:
- **Global**: `DashboardContext` (shared across pages)
- **Page-level**: Dashboard state, Communication threads, etc.
- **Component-level**: Form inputs, modals, tooltips
- **Module-level**: Translation cache (Map), speech synthesis ref

### Type Safety

| Component | Version | Purpose |
|-----------|---------|---------|
| **TypeScript** | 5 | Static type checking |
| **ESLint** | 9 | Code linting & style enforcement |

**Type Definitions**:
- Interface for each API response type (Conversation, Message, Remark, etc.)
- Type props for all components
- `any` used minimally (e.g., SpeechRecognition due to browser API gaps)

### Multilingual Engine (Custom)

Located in `lib/multilingual.ts`:

```typescript
// 1. Translation Cache (module-level)
const _cache = new Map<string, string>();
translateCached(text, lang) → Promise<string>
translateBatch(texts[], lang) → Promise<string[]>

// 2. React Translation Hook
useTranslation(texts[], language) → { displayed[], translating }
  - Immediately shows raw text (prevent stale state)
  - Async batch translates
  - Shows loading spinner during translation
  - Gracefully handles errors

// 3. Speech-to-Text Hook
useSpeechInput(language) → { activeField, startFor() }
  - Wraps webkitSpeechRecognition
  - Language-aware (SPEECH_LANG_MAP)
  - Appends transcript to form fields

// 4. Text-to-Speech Hook
useTTS() → { speaking, speak(), fallbackLang, stop() }
  - Wraps SpeechSynthesis API
  - Voice fallback chain for Telugu/Odia
  - Console logging for debugging
  - Toggle on/off behavior
```

**Languages Supported**:
```typescript
SPEECH_LANG_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  or: 'or-IN',
};
```

---

## Backend Stack

### Framework & Runtime

| Component | Version | Purpose |
|-----------|---------|---------|
| **FastAPI** | Latest | Modern Python REST API framework |
| **Uvicorn** | Latest | ASGI web server |
| **Python** | 3.9+ | Runtime language |
| **pip** | Latest | Package manager |

**Key Features**:
- Automatic OpenAPI/Swagger documentation (`/docs`)
- Async support for concurrent requests
- Dependency injection (future auth)
- CORS middleware (all origins in dev; restrict in prod)

### Database ORM

| Component | Version | Purpose |
|-----------|---------|---------|
| **SQLAlchemy** | Latest | Python ORM |
| **PostgreSQL** | 12+ | Relational database |
| **psycopg2-binary** | Latest | PostgreSQL adapter |

**Database Configuration** (`database.py`):
```python
DATABASE_URL = "postgresql://user:pass@localhost:5432/sgs_swais_db"
engine = create_engine(DATABASE_URL)
Base = declarative_base()
```

**Session Management**:
- Automatic session cleanup per request
- Eager loading of relationships (to avoid N+1)

### Data Validation

| Component | Version | Purpose |
|-----------|---------|---------|
| **Pydantic** | Latest | Data validation & serialization |

**Used For**:
- Request/response schemas
- Type validation at API boundaries
- Automatic JSON parsing

### Multilingual Support

| Component | Version | Purpose |
|-----------|---------|---------|
| **deep-translator** | Latest | Translation API wrapper |

**Backend Implementation**:
- `routers/translation.py` → `POST /translate` endpoint
- Service layer: `services/translation_service.py`
- Uses Google Translate backend (via deep-translator)
- Cache in memory (session-level) or Redis (future)

**Supported Languages**:
- English (en)
- Hindi (hi)
- Telugu (te)
- Odia (or)
- Extensible to any language supported by Google Translate

### API Structure

**Routers**:
- `routers/dashboard.py` — Dashboard data aggregation
- `routers/translation.py` — Text translation
- `routers/communication.py` — Messages, conversations, leave requests

**Services**:
- `services/dashboard_service.py` — Aggregates alerts, deadlines, recommendations
- `services/analytics_service.py` — Performance metrics (subject rankings, avg scores)
- `services/translation_service.py` — Translation orchestration

**Models** (`models.py`):
- SQLAlchemy ORM classes (StudentMaster, ParentMaster, etc.)
- ~15 core tables

**Schemas** (`schemas.py`):
- Pydantic models for request/response validation
- DTO (Data Transfer Object) pattern

---

## Browser APIs (Client-Side, No Server Dependency)

### Web Audio / Speech Recognition

| API | Status | Purpose |
|-----|--------|---------|
| **webkitSpeechRecognition** | ✅ Active | Speech-to-text for form fields |
| **SpeechRecognition** | ✅ Active (fallback) | Standard speech recognition API |

**Implementation**:
```typescript
const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
rec.lang = 'en-IN';  // BCP-47 code
rec.start();
rec.onresult = (e) => console.log(e.results[0][0].transcript);
```

**Requirements**:
- HTTPS (or localhost)
- Browser permissions (mic access)
- Works in Chrome, Edge, Safari (partial)

### Web Speech Synthesis

| API | Status | Purpose |
|-----|--------|---------|
| **SpeechSynthesis** | ✅ Active | Text-to-speech output |
| **SpeechSynthesisUtterance** | ✅ Active | Speech parameters (rate, pitch, voice) |

**Implementation**:
```typescript
const utt = new SpeechSynthesisUtterance(text);
utt.lang = 'te-IN';  // Telugu
utt.rate = 0.9;      // 90% speed
window.speechSynthesis.speak(utt);
```

**Voice Selection Logic**:
- Exact lang match (e.g., `te-IN`)
- Prefix match (e.g., `te`)
- Name hint (voice.name contains "Telugu")
- Fallback chain: Target → Hindi → English → Any
- Log to console for debugging

**Requirements**:
- Browser voice installation
- Fallback for Telugu/Odia (uses Hindi/English as backup)

---

## Deployment & Infrastructure

### Development Environment

| Tool | Purpose |
|------|---------|
| **Docker** (optional) | PostgreSQL containerization |
| **VS Code** | Recommended editor |
| **Git** | Version control |
| **Postman** (optional) | API testing |

### Production Deployment

#### Frontend
- **Build**: `npm run build` (generates `.next/` directory)
- **Hosting**: Vercel (recommended), Netlify, or any Node.js host
- **Environment**: Set `NEXT_PUBLIC_API_URL` to production backend

#### Backend
- **Deployment**: Docker container, AWS Lambda, or traditional VM
- **Server**: Uvicorn with Gunicorn (multi-worker)
- **Database**: Managed PostgreSQL (RDS, Heroku, etc.)
- **Monitoring**: Sentry, DataDog, or ELK stack

#### HTTPS/SSL
- Required for production
- Let's Encrypt for free SSL (automated)
- Browser microphone access requires HTTPS

### Environment Variables

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend** (`.env`):
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
LOG_LEVEL=INFO
```

---

## Dependency Tree (High-Level)

```
Frontend (Next.js)
├── React 19
├── Tailwind CSS 4
├── Recharts (charts)
├── Heroicons (icons)
├── Axios (HTTP)
├── TypeScript 5
└── Custom Multilingual Engine
    ├── useTranslation hook
    ├── useSpeechInput hook (webkitSpeechRecognition)
    └── useTTS hook (SpeechSynthesis API)

Backend (FastAPI)
├── Uvicorn (ASGI)
├── SQLAlchemy (ORM)
├── PostgreSQL (database)
├── Pydantic (validation)
├── deep-translator (Google Translate)
└── CORS middleware

Browser APIs (Client)
├── webkitSpeechRecognition (STT)
└── SpeechSynthesis (TTS)

External Services
└── Google Translate (via deep-translator)
```

---

## Technology Decisions & Rationale

### Why Next.js + React?
- **Server-side rendering** optional (fast cold start)
- **API routes** (could be used; currently using separate FastAPI backend)
- **Automatic code splitting** (smaller bundles)
- **Image optimization** (built-in)
- **TypeScript support** (first-class)

### Why FastAPI?
- **Async/await** native (concurrent request handling)
- **Automatic API docs** (OpenAPI/Swagger)
- **Pydantic validation** (strong type safety)
- **Fast startup & execution** (competitive with Node.js)
- **Mature ecosystem** (deep-translator, SQLAlchemy)

### Why SQLAlchemy ORM?
- **Database agnostic** (could switch to MySQL, SQLite with minimal changes)
- **Relationship mapping** (easy joins, lazy loading)
- **Migration support** (Alembic, though not heavily used here)

### Why Tailwind CSS?
- **Utility-first** (no CSS files to manage for most components)
- **Responsive by default** (mobile-first breakpoints)
- **Dark mode** (easy to add later)
- **PurgeCSS integration** (small production bundles)

### Why Browser APIs for Speech?
- **No backend calls** for STT/TTS (instant, private)
- **No licensing cost** (native browser feature)
- **Privacy-friendly** (audio processing on client)
- **Fallback chain** for Telugu/Odia (no native voices needed for Hindi/English fallback)

### Why Custom Translation Hook?
- **Batching** via `Promise.all()` (fewer API calls)
- **Caching** at module level (instant re-translations)
- **Loading states** (show spinner during fetch)
- **Error handling** (graceful degradation)
- **Immediate reset** (prevent stale translations on language change)

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Next.js/React | ✅ | ✅ | ✅ | ✅ |
| Tailwind CSS | ✅ | ✅ | ✅ | ✅ |
| webkitSpeechRecognition | ✅ | ❌ | Partial | ✅ |
| SpeechSynthesis | ✅ | ✅ | ✅ | ✅ |
| Fetch/Axios | ✅ | ✅ | ✅ | ✅ |

**Notes**:
- Firefox uses `SpeechRecognition` (standard name) but STT support is limited
- Safari WebKit has partial speech recognition support
- All major browsers support TTS (SpeechSynthesis)

---

## Security Considerations

### Current State (Development)
- ❌ No authentication (hard-coded parent_id=1)
- ❌ CORS unrestricted (`allow_origins=["*"]`)
- ❌ No input validation on user inputs (Pydantic helps)
- ⚠️ API calls made from frontend (exposed credentials risk)

### Production Recommendations
- ✅ **Authentication**: JWT or OAuth2 via FastAPI dependencies
- ✅ **CORS**: Restrict to your domain
- ✅ **Rate Limiting**: 100 requests/minute per user
- ✅ **SQL Injection**: SQLAlchemy parameterization prevents this
- ✅ **XSS**: React escapes HTML by default
- ✅ **CSRF**: Add CSRF tokens to state-changing operations
- ✅ **HTTPS**: Mandatory for production (browser mic access requirement)
- ✅ **Secrets**: Use environment variables, never commit `.env`

---

## Performance Targets

| Metric | Target | Current Status |
|--------|--------|-----------------|
| First Contentful Paint (FCP) | < 1.5s | ✅ (Next.js optimized) |
| Time to Interactive (TTI) | < 3s | ✅ (minimal JS) |
| API Response Time | < 200ms | ⚠️ (depends on DB) |
| Translation API Time | < 500ms | ⚠️ (Google Translate latency) |

**Optimization Opportunities**:
- Implement Redis for translation caching (persistent)
- Paginate large result sets (messages, remarks)
- Use CDN for static assets (images, fonts)
- Minify/compress API responses (gzip)
- Image optimization (WebP, lazy loading)

---

## Monitoring & Observability (Future)

### Logging
- **Frontend**: Console logs + Sentry error tracking
- **Backend**: Structured logging (JSON format for aggregation)

### Metrics
- **Frontend**: PageSpeed Insights, Lighthouse scores
- **Backend**: Response time, error rate, DB query performance
- **Database**: Slow query logs, connection pool monitoring

### Tracing
- **OpenTelemetry** for distributed tracing (optional)
- Correlate frontend → backend requests

### Alerting
- **Backend Down**: Alert if `/health` check fails
- **High Error Rate**: Alert if > 5% of requests error
- **Slow API**: Alert if avg response time > 500ms

---

## Build & Deployment Pipeline (Future)

### CI/CD (GitHub Actions example)

```yaml
name: Deploy
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Frontend tests
        run: cd frontend && npm test
      - name: Backend tests
        run: cd backend && pytest
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Build frontend
          cd frontend && npm run build
          # Deploy to Vercel
          # Deploy backend to AWS
```

---

## Maintenance & Updates

### Dependency Management
- **npm outdated** — Check for upgrades
- **npm audit** — Security vulnerabilities
- **pip outdated** — Python package updates
- Update React, Next.js quarterly

### Breaking Changes
- **Next.js 17**: Check migration guide
- **React 20**: Minor breaking changes (hooks)
- **Tailwind 5**: New utilities, class name changes

### Monitoring Updates
- Subscribe to **React Conf** (annual conference)
- Follow **Next.js Blog** for releases
- GitHub **dependabot** for auto-PRs

---

## Tech Debt & Refactoring Opportunities

### Current Tech Debt
1. **No authentication** — Hard-coded parent_id=1
2. **CORS unrestricted** — Development only
3. **Attendance module** — Fully removed from UI and DB (`AttendanceMaster` model body commented out)
4. **Call Requests / Chat / SchoolEvent** — Models commented out, tables excluded from DB creation
5. **`analytics_service.py`** — Disabled reference file; imports broken (models removed); safe to delete
6. **Type safety gaps** — Some `any` types for browser APIs

### Refactoring Opportunities (Priority Order)
1. **Add authentication** (HIGH) — JWT + refresh tokens
2. **Implement pagination** (MEDIUM) — Large result sets
3. **Extract shared components** (MEDIUM) — Card, modal, button abstractions
4. **Remove dead code** (LOW) — Clean up commented sections
5. **Add E2E tests** (LOW) — Playwright or Cypress

---

## Version Control & Release Management

### Branching Strategy
- `main` — Production (protected, requires PR review)
- `develop` — Integration branch
- `feature/` — Feature branches (e.g., `feature/leave-requests`)

### Versioning
- **Semantic**: `major.minor.patch`
- Current: `1.0.0` (stable)
- Next milestone: `1.1.0` (new features) or `2.0.0` (breaking changes)

### Changelog
Maintain `CHANGELOG.md` with:
- New features
- Bug fixes
- Breaking changes
- Migration guides

---

## License & Dependencies

This project uses:
- MIT licenses (React, Next.js, Tailwind, most NPM packages)
- Apache 2.0 (FastAPI, SQLAlchemy)
- BSD (deep-translator)

No proprietary or GPL dependencies (safe for commercial use with proper attribution).

---

**Last Updated**: May 13, 2026  
**Version**: 1.0  
**Document Maintainer**: Development Team
