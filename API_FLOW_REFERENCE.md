# API Flow Reference

## Overview

This document details all backend REST APIs used by the frontend.

**Base URL**: `http://localhost:8000`  
**API Framework**: FastAPI  
**Documentation**: Available at `http://localhost:8000/docs` (Swagger UI)  
**Routers**: `dashboard.py`, `translation.py`, `communication.py`

---

## API Endpoints

### Dashboard APIs

#### GET `/dashboard/{student_id}`

**Purpose**: Fetch complete dashboard data for a student  
**Called By**: `lib/api.ts` → `fetchDashboardData(studentId)`  
**Frontend Pages**: Dashboard page `/parent/dashboard`  

**Response Schema**:
```json
{
  "student": {
    "full_name": "John Doe",
    "class_name": "10th Grade",
    "section": "A"
  },
  "daily_summary": {
    "assignments_pending": 3,
    "notices_today": 2
  },
  "alerts": [
    {
      "type": "warning",
      "priority": "HIGH",
      "message": "Math assignment overdue",
      "subject": "Mathematics",
      "due": "2024-05-10"
    }
  ],
  "upcoming_deadlines": [
    {
      "title": "Physics Project",
      "type": "Project",
      "due_date": "2024-05-20",
      "days_left": 7
    }
  ],
  "smart_recommendations": [
    {
      "type": "task",
      "message": "Complete pending assignments",
      "action_text": "8 assignments pending"
    }
  ],
  "notifications": [
    {
      "type": "announcement",
      "title": "School closed on Friday",
      "date": "2024-05-12",
      "link": "/parent/notices"
    }
  ],
  "performance_summary": {
    "strongest_subject": "Mathematics",
    "weakest_subject": "Physics",
    "avg_score": 78.5
  },
  "subject_performance": [
    {
      "subject": "Mathematics",
      "score": 85.0
    }
  ],
  "assignment_completion_pct": 75,
  "quiz": [
    {
      "title": "Algebra Quiz",
      "score": 18,
      "total": 20
    }
  ]
}
```

**Translation**:
- ✅ Translatable fields: `alerts[].message`, `deadlines[].title`, `recommendations[].message`, `recommendations[].action_text`
- Frontend uses `useTranslation` hook with loading spinner
- Backend returns English; frontend handles translation

**Error Handling**:
- Returns empty arrays if student not found
- Falls back to default values if calculations fail

---

#### GET `/parents/{parent_id}/children`

**Purpose**: Fetch all children of a parent  
**Called By**: `lib/api.ts` → `fetchParentChildren(parentId)`  
**Frontend Pages**: Not actively used (parent dropdown is hard-coded)  

**Response Schema**:
```json
[
  {
    "student_id": 1,
    "full_name": "Alice Smith",
    "class_name": "10th Grade",
    "section": "A"
  },
  {
    "student_id": 2,
    "full_name": "Bob Smith",
    "class_name": "8th Grade",
    "section": "B"
  }
]
```

**Note**: Currently only parent_id=1 is supported. For production, implement authentication to dynamically determine parent_id.

---

### Assignment APIs

#### GET `/assignments/history/{student_id}`

**Purpose**: Fetch all assignment submissions for a student  
**Called By**: `lib/api.ts` → `fetchAssignmentsHistory(studentId)`  
**Frontend Pages**: Assignments page `/parent/assignments`  

**Response Schema**:
```json
[
  {
    "submission_id": 1,
    "assignment_id": 101,
    "title": "Algebra Project",
    "description": "Complete 10 problems",
    "due_date": "2024-05-15",
    "submitted_at": "2024-05-14T10:30:00Z",
    "status": "Submitted",
    "grade": null,
    "feedback": null
  },
  {
    "submission_id": 2,
    "assignment_id": 102,
    "title": "Essay on Climate Change",
    "description": "Write 500 words",
    "due_date": "2024-05-12",
    "submitted_at": null,
    "status": "Pending",
    "grade": null,
    "feedback": null
  }
]
```

**Statuses**:
- `Pending` — Not yet submitted
- `Submitted` — Submitted but not graded
- `Graded` — Graded by teacher
- `Overdue` — Past due date, not submitted

---

#### GET `/assignments/analytics/{student_id}`

**Purpose**: Fetch assignment summary statistics  
**Called By**: `lib/api.ts` → `fetchAssignmentAnalytics(studentId)`  
**Frontend Pages**: Assignments page (summary card)  

**Response Schema**:
```json
{
  "total": 20,
  "submitted": 15,
  "pending": 3,
  "overdue": 2,
  "graded": 10,
  "completion_pct": 75
}
```

---

#### POST `/assignments/submit`

**Purpose**: Submit an assignment  
**Called By**: `lib/api.ts` → `submitAssignment(payload)`  
**Frontend Pages**: Assignments page (modal)  

**Request**:
```json
{
  "assignment_id": 101,
  "student_id": 1,
  "submission_text": "Here's my solution to problem 1...",
  "file_path": "/uploads/assignment_101.pdf"
}
```

**Response**:
```json
{
  "submission_id": 5,
  "assignment_id": 101,
  "student_id": 1,
  "submitted_at": "2024-05-14T15:45:00Z",
  "status": "Submitted"
}
```

---

### Quiz APIs

#### GET `/quiz/history/{student_id}`

**Purpose**: Fetch all quiz attempts for a student  
**Called By**: `lib/api.ts` → `fetchQuizHistory(studentId)`  
**Frontend Pages**: Quiz page `/parent/quiz`  

**Response Schema**:
```json
[
  {
    "quiz_id": 1,
    "title": "Algebra Basics Quiz",
    "attempted_at": "2024-05-10T14:30:00Z",
    "score": 18,
    "total": 20,
    "percentage": 90.0
  },
  {
    "quiz_id": 2,
    "title": "Geometry Challenge",
    "attempted_at": "2024-05-08T10:15:00Z",
    "score": 15,
    "total": 20,
    "percentage": 75.0
  }
]
```

---

### Remarks APIs

#### GET `/remarks/history/{student_id}`

**Purpose**: Fetch all teacher remarks for a student  
**Called By**: `lib/api.ts` → `fetchRemarksHistory(studentId)`  
**Frontend Pages**: Remarks page `/parent/remarks`  

**Response Schema**:
```json
[
  {
    "remark_id": 1,
    "teacher_name": "Dr. Emily Johnson",
    "subject": "Mathematics",
    "comment": "Excellent performance in the recent test. Shows strong grasp of algebraic concepts.",
    "date": "2024-05-12"
  },
  {
    "remark_id": 2,
    "teacher_name": "Mr. Robert Smith",
    "subject": "Physics",
    "comment": "Good effort, but needs more focus in class.",
    "date": "2024-05-10"
  }
]
```

**Translation**:
- ✅ Translatable field: `comment`
- Frontend uses `useTranslation` hook
- TTS button reads translated comment in selected language
- Fallback voice used for Telugu/Odia

---

### Notices APIs

#### GET `/notices/history/{student_id}`

**Purpose**: Fetch all notices for a student's class  
**Called By**: `lib/api.ts` → `fetchNoticesHistory(studentId)`  
**Frontend Pages**: Notices page `/parent/notices`  

**Response Schema**:
```json
[
  {
    "notice_id": 1,
    "notice_title": "School Closure Announcement",
    "notice_text": "School will remain closed on Friday, May 17th for Teacher Training Day.",
    "notice_date": "2024-05-12",
    "applicable_class": "All Classes",
    "posted_by_name": "Principal Office"
  },
  {
    "notice_id": 2,
    "notice_title": "Final Exam Schedule",
    "notice_text": "Final exams will begin on June 1st. Detailed schedule attached.",
    "notice_date": "2024-05-10",
    "applicable_class": "10th Grade",
    "posted_by_name": "Academic Coordinator"
  }
]
```

**Translation**:
- ✅ Translatable fields: `notice_title`, `notice_text`
- Frontend uses `useTranslation` hook (two separate calls)
- TTS button reads: `"${title}. ${text}"` in selected language

---

### Communication APIs

#### GET `/comm/conversations`

**Purpose**: Fetch all conversation threads for a student/parent  
**Called By**: `lib/api.ts` → `fetchConversations(studentId, parentId)`  
**Frontend Pages**: Communication Center `/parent/communication`  

**Response Schema**:
```json
[
  {
    "conv_id": 1,
    "subject": "Assignment Help Needed",
    "category": "Academic",
    "recipient_name": "Mrs. Sarah Brown",
    "status": "OPEN",
    "created_at": "2024-05-05T10:00:00Z",
    "updated_at": "2024-05-12T14:30:00Z",
    "latest_message": "Thank you for clarifying. I now understand the concept.",
    "latest_message_time": "2024-05-12T14:30:00Z",
    "latest_sender": "TEACHER",
    "unread_count": 0
  },
  {
    "conv_id": 2,
    "subject": "Leave Request - Medical",
    "category": "Leave Request",
    "recipient_name": "Class Teacher",
    "status": "OPEN",
    "created_at": "2024-05-10T09:15:00Z",
    "updated_at": "2024-05-10T15:45:00Z",
    "latest_message": "Approved. Ensure assignments are submitted.",
    "latest_message_time": "2024-05-10T15:45:00Z",
    "latest_sender": "TEACHER",
    "unread_count": 1
  }
]
```

**Translation**:
- ✅ Translatable fields: `subject`, `latest_message`
- Frontend builds `convTranslations` map from translated arrays
- Thread header shows translated subject

---

#### GET `/comm/conversations/{conv_id}/messages`

**Purpose**: Fetch all messages in a conversation  
**Called By**: `lib/api.ts` → `fetchConversationMessages(convId)`  
**Frontend Pages**: Communication Center (thread view)  

**Response Schema**:
```json
[
  {
    "message_id": 1,
    "conv_id": 1,
    "sender_type": "PARENT",
    "sender_name": "Priya Sharma",
    "message": "Hi, can you help explain this algebra problem?",
    "created_at": "2024-05-05T10:00:00Z",
    "is_read": true
  },
  {
    "message_id": 2,
    "conv_id": 1,
    "sender_type": "TEACHER",
    "sender_name": "Mrs. Sarah Brown",
    "message": "Of course! Let me break it down step by step...",
    "created_at": "2024-05-05T11:15:00Z",
    "is_read": true
  }
]
```

**Translation**:
- ✅ Translatable field: `message`
- Frontend uses `useTranslation` hook with loading spinner
- TTS button on each message reads translated text

---

#### POST `/comm/conversations/create`

**Purpose**: Create a new conversation (start a message with teacher)  
**Called By**: `lib/api.ts` → `createConversation(payload)`  
**Frontend Pages**: Communication Center (new conversation modal)  

**Request**:
```json
{
  "student_id": 1,
  "parent_id": 1,
  "subject": "Question about Assignment 5",
  "category": "Academic",
  "recipient_name": "Mrs. Sarah Brown",
  "first_message": "Hi, I have a question about the algebra assignment due on Friday..."
}
```

**Response** (newly created conversation object):
```json
{
  "conv_id": 10,
  "subject": "Question about Assignment 5",
  "category": "Academic",
  "recipient_name": "Mrs. Sarah Brown",
  "status": "OPEN",
  "created_at": "2024-05-14T16:20:00Z",
  "updated_at": "2024-05-14T16:20:00Z",
  "latest_message": "Hi, I have a question...",
  "latest_message_time": "2024-05-14T16:20:00Z",
  "latest_sender": "PARENT",
  "unread_count": 0
}
```

**Special Cases**:
- **Leave Request**: `category="Leave Request"` includes date range in `first_message`:
  ```
  "Leave period: 2024-05-20 to 2024-05-22.\n\nReason: Medical appointment."
  ```

---

#### POST `/comm/conversations/{conv_id}/messages`

**Purpose**: Send a message in a conversation  
**Called By**: `lib/api.ts` → `sendConversationMessage(convId, senderType, senderName, message)`  
**Frontend Pages**: Communication Center (reply box)  

**Request**:
```json
{
  "sender_type": "PARENT",
  "sender_name": "Parent",
  "message": "Thank you for the explanation. It makes sense now."
}
```

**Response** (newly created message object):
```json
{
  "message_id": 15,
  "conv_id": 1,
  "sender_type": "PARENT",
  "sender_name": "Parent",
  "message": "Thank you for the explanation. It makes sense now.",
  "created_at": "2024-05-12T17:00:00Z",
  "is_read": true
}
```

---

#### GET `/comm/recipients`

**Purpose**: Fetch list of available recipients (teachers/admin)  
**Called By**: `lib/api.ts` → `fetchConversationRecipients(studentId)`  
**Frontend Pages**: Communication Center (new conversation modal → recipient selector)  

**Response Schema**:
```json
[
  {
    "teacher_id": 1,
    "name": "Mrs. Sarah Brown",
    "role": "Mathematics Teacher"
  },
  {
    "teacher_id": 2,
    "name": "Mr. Robert Smith",
    "role": "Physics Teacher"
  },
  {
    "teacher_id": null,
    "name": "Class Teacher",
    "role": "Class Teacher"
  }
]
```

---

### Translation APIs

#### POST `/translate`

**Purpose**: Translate text to target language  
**Called By**: `lib/multilingual.ts` → `translateText(text, targetLang)`  
**Frontend Pages**: All translatable pages (Dashboard, Remarks, Notices, Communication)  

**Request**:
```json
{
  "text": "Excellent performance in the recent test.",
  "target_lang": "hi"
}
```

**Response**:
```json
{
  "original_text": "Excellent performance in the recent test.",
  "translated_text": "हाल के परीक्षा में उत्कृष्ट प्रदर्शन।",
  "target_lang": "hi"
}
```

**Supported Languages**:
- `en` — English (no-op; returns original)
- `hi` — Hindi
- `te` — Telugu
- `or` — Odia

**Backend**:
- Uses `deep-translator` library (Google Translate backend)
- Caches results in module-level Map (SQLAlchemy session)
- Fallback to original text if translation fails

**Frontend**:
- Module-level cache in `lib/multilingual.ts` (survives across renders)
- `useTranslation` hook batches multiple texts with `Promise.all`
- Shows spinner while translating
- Immediately reverts to raw text on language change (prevents stale state)

**Error Handling**:
- If translation fails, returns original text
- No exception thrown; graceful degradation

---

## API Usage Flow Diagrams

### Dashboard Load Flow
```
Frontend Dashboard Page (mount)
  │
  ├─→ useDashboard() gets studentId, language
  │
  ├─→ useEffect([studentId]) triggers
  │   └─→ GET /dashboard/{studentId}
  │       └─→ Response: alerts, deadlines, recs, etc.
  │           └─→ Set state
  │
  ├─→ useEffect([data, language]) triggers
  │   └─→ Extract texts from alerts, deadlines, recs
  │   │
  │   ├─→ If language='en': no-op
  │   │
  │   └─→ If language='hi'/'te'/'or':
  │       ├─→ useTranslation hook
  │       │   ├─→ Immediately show raw texts (prevent stale)
  │       │   ├─→ Set translating=true (show spinner)
  │       │   └─→ POST /translate (batch for each set)
  │       │       └─→ Response: translated arrays
  │       │           ├─→ Set dispAlerts, dispDeadlines, dispRecs
  │       │           └─→ Set translating=false
  │       │
  │       └─→ Render with translated values (or fallback to raw)
  │
  └─→ User changes language in TopBar
      └─→ setLanguage() in DashboardContext
          └─→ All pages re-render with new language
              └─→ All useEffect dependencies re-run with fresh language
```

### Remarks with Translation + TTS Flow
```
Frontend Remarks Page (mount)
  │
  ├─→ GET /remarks/history/{studentId}
  │   └─→ Response: array of remarks with raw comments
  │
  ├─→ useTranslation(commentTexts, language)
  │   ├─→ Immediately show raw comments
  │   ├─→ Show "Translating..." spinner
  │   └─→ POST /translate (once per comment)
  │       └─→ Set displayedComments
  │
  ├─→ Render remarks with displayedComments
  │   └─→ Each remark shows SpeakBtn
  │
  └─→ User clicks SpeakBtn
      └─→ useTTS.speak(displayedComment, language, key)
          ├─→ Pick voice using fallback chain (te-IN → te → hi-IN → ...)
          ├─→ Log to console: [TTS] Matched voice, fallback status
          ├─→ SpeechSynthesis plays utterance at 0.9x speed
          └─→ SpeakBtn shows blue pulse, fallback indicator (amber dot)
```

### Communication Create & Translate Flow
```
Frontend Communication Modal
  │
  ├─→ User fills form (recipient, category, subject, message)
  ├─→ Optional: Click MicBtn for STT
  │   └─→ useSpeechInput.startFor('field', callback)
  │       ├─→ webkitSpeechRecognition.start()
  │       ├─→ Listen in SPEECH_LANG_MAP[language]
  │       └─→ callback(transcript) appends to field
  │
  └─→ User clicks Submit
      └─→ POST /comm/conversations/create (subject, category, first_message)
          └─→ Response: new conversation object
              │
              └─→ Frontend: setConversations([newConv, ...])
                  └─→ useTranslation triggers on conversations array
                      ├─→ Immediately show raw subject
                      ├─→ Set translatingConvs=true
                      └─→ POST /translate (subject, first_message)
                          └─→ Set dispSubjects, dispPreviews
                              └─→ Build convTranslations map
                                  └─→ Thread header shows translated subject

Frontend Thread View
  │
  ├─→ GET /comm/conversations/{conv_id}/messages
  │   └─→ Response: array of messages
  │
  ├─→ useTranslation(messageTexts, language)
  │   ├─→ Immediately show raw messages
  │   ├─→ Set translatingMsgs=true (show spinner in header)
  │   └─→ POST /translate (once per message)
  │       └─→ Set msgTranslations
  │
  ├─→ Render messages with translated text
  │   └─→ Each message shows SpeakBtn
  │
  └─→ User types reply + clicks Send
      └─→ POST /comm/conversations/{conv_id}/messages
          └─→ Response: new message object
              └─→ Frontend: setMessages([...messages, newMsg])
                  └─→ useTranslation re-runs
                      └─→ Translate new message (batch with existing)
```

---

## Error Handling

### HTTP Status Codes
- `200 OK` — Successful request
- `400 Bad Request` — Invalid input (validation error)
- `404 Not Found` — Resource doesn't exist
- `500 Internal Server Error` — Server-side issue

### Frontend Error Handling
All API calls wrapped in try-catch:
```typescript
try {
  const response = await api.get(`/assignments/history/${studentId}`);
  return response.data;
} catch {
  return []; // Fallback to empty array
}
```

### Translation Error Handling
```typescript
translateBatch(texts, language)
  .then(results => setDisplayed(results))
  .catch(() => {
    // On error, keep raw originals (already set)
    setTranslating(false);
  });
```

---

## Performance Optimization

### Caching Strategies
1. **Module-Level Cache** (translation)
   - Key: `${lang}\x00${text}`
   - Persists across page navigations
   - Cleared on browser refresh

2. **Component-Level Cache** (frontend state)
   - Dashboard data cached in state
   - Refreshes only on studentId change

3. **Server-Side Considerations** (future)
   - Add 5-minute TTL cache on `/dashboard/{student_id}`
   - Paginate large result sets (e.g., 20 messages per page)

### Batch Requests
- Translation uses `Promise.all()` for concurrent API calls
- Reduces latency vs sequential calls

### Lazy Loading
- Messages paginated on scroll
- Remarks/Notices filtered client-side (no backend filtering)

---

## Rate Limiting (Future)

For production:
- Implement rate limit: 100 requests/minute per student
- Use Redis for distributed rate limit tracking
- Return `429 Too Many Requests` on exceed

---

**Last Updated**: May 13, 2026  
**Version**: 1.0
