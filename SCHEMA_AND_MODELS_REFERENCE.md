# Schema & Models Reference

## Overview

This document details all database tables, models, and their relationships in the ERP system.

**Database**: PostgreSQL  
**ORM**: SQLAlchemy  
**Models File**: `backend/models.py`  
**Database Config**: `backend/database.py`  

---

## Core Models

### ClassMaster

**Table**: `class_master`  
**Purpose**: Defines school classes/grades  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `class_id` | Integer | PK, auto-increment |
| `class_name` | String | E.g., "10th Grade", "Class V" |
| `section_name` | String | E.g., "A", "B", "C" |
| `academic_year` | String | E.g., "2024-2025" |

**Relationships**:
- 1:M with `StudentMaster` (one class → many students)
- 1:M with `SubjectMaster` (one class → many subjects)

**Used By**:
- Dashboard: Filter data by class
- Communication: Show recipient's class context
- API: `/dashboard/` aggregates by student's class

---

### StudentMaster

**Table**: `student_master`  
**Purpose**: Core student records  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `student_id` | Integer | PK, auto-increment |
| `full_name` | String | Student name |
| `class_id` | Integer | FK → `class_master` |
| `section` | String | Section within class |
| `roll_no` | String | Roll number |

**Relationships**:
- M:1 with `ClassMaster` (many students → one class)
- M:M via `ParentStudentMap` (many students ← → many parents)
- 1:M with `AssignmentSubmission` (one student → many submissions)
- 1:M with `QuizResult` (one student → many quiz attempts)
- 1:M with `Remark` (one student → many remarks)
- 1:M with `Attendance` (one student → many attendance records)

**Used By**:
- Frontend: Student dropdown in TopBar
- Dashboard: Center of all student data queries
- Frontend API: `fetchDashboardData(studentId)`

---

### ParentMaster

**Table**: `parent_master`  
**Purpose**: Parent/guardian information  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `parent_id` | Integer | PK, auto-increment |
| `full_name` | String | Parent name |
| `email` | String | Email address |
| `phone` | String | Phone number |
| `profile_image` | String | URL/path to profile pic |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

**Relationships**:
- 1:M via `ParentStudentMap` (one parent → many student mappings)

**Used By**:
- Authentication: Identify logged-in user (currently hard-coded as parent_id=1)
- Communication: Sender of messages

**Note**: Currently only parent_id=1 is used. For production, implement proper authentication.

---

### ParentStudentMap

**Table**: `parent_student_map`  
**Purpose**: Link parents to their children  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `parent_id` | Integer | FK → `parent_master` |
| `student_id` | Integer | FK → `student_master` |
| `relationship_type` | String | E.g., "Mother", "Father", "Guardian" |

**Relationships**:
- M:1 with `ParentMaster`
- M:1 with `StudentMaster`

**Used By**:
- Frontend: `ChildSelector` component (though currently overridden by dropdown)
- API: `fetchParentChildren(parentId)` retrieves all children of a parent

---

### TeacherMaster

**Table**: `teacher_master`  
**Purpose**: Teacher records  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `teacher_id` | Integer | PK, auto-increment |
| `full_name` | String | Teacher name |
| `email` | String | Email address |
| `phone` | String | Contact number |

**Relationships**:
- 1:M with `SubjectMaster` (one teacher → many subject assignments)
- 1:M with `Remark` (one teacher → many remarks)
- 1:M via `SupportTicket` (one teacher → many conversations)

**Used By**:
- Communication: Recipient lookup (`fetchConversationRecipients`)
- Remarks: Show remark author
- Dashboard: Performance analytics per teacher

---

### SubjectMaster

**Table**: `subject_master`  
**Purpose**: Subject definitions per class  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `subject_id` | Integer | PK, auto-increment |
| `class_id` | Integer | FK → `class_master` (E.g., "Math for Class 10") |
| `subject_name` | String | E.g., "Mathematics", "English" |
| `teacher_id` | Integer | FK → `teacher_master` (assigned teacher) |

**Relationships**:
- M:1 with `ClassMaster`
- M:1 with `TeacherMaster`
- 1:M with `ChapterMaster` (one subject → many chapters)

**Used By**:
- Remarks: Filter by subject
- Notices: Filter by class (implies subjects)
- Dashboard: Subject performance analytics

---

### ChapterMaster

**Table**: `chapter_master`  
**Purpose**: Chapters/units within subjects  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `chapter_id` | Integer | PK, auto-increment |
| `subject_id` | Integer | FK → `subject_master` |
| `chapter_name` | String | E.g., "Chapter 1: Algebra Basics" |
| `chapter_order` | Integer | Sequence within subject |

**Relationships**:
- M:1 with `SubjectMaster`
- 1:M with `AssignmentMaster` (one chapter → many assignments)

**Used By**:
- Assignment definitions: Organize by chapter
- Dashboard analytics: Chapter-wise assignment tracking

---

## Academic Models

### AssignmentMaster

**Table**: `assignment_master`  
**Purpose**: Assignment definitions  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `assignment_id` | Integer | PK, auto-increment |
| `chapter_id` | Integer | FK → `chapter_master` |
| `title` | String | Assignment name |
| `description` | Text | Full description/instructions |
| `due_date` | Date | Submission deadline |

**Relationships**:
- M:1 with `ChapterMaster`
- 1:M with `AssignmentSubmission` (one assignment → many student submissions)

**Used By**:
- Assignments page: List assignments by student
- Dashboard: Calculate pending/overdue counts
- API: `/assignments/history/{student_id}`, `/assignments/analytics/{student_id}`

---

### StudentSubmission

**Table**: `student_submission`  
**Purpose**: Student submission records  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `submission_id` | Integer | PK, auto-increment |
| `assignment_id` | Integer | FK → `assignment_master` |
| `student_id` | Integer | FK → `student_master` |
| `submission_text` | Text | Written submission content |
| `file_path` | String (nullable) | Path to uploaded file |
| `submitted_at` | DateTime | Submission timestamp |
| `grade` | Float (nullable) | Score given by teacher (0-100) |
| `feedback` | Text (nullable) | Teacher feedback |
| `graded_at` | DateTime (nullable) | When teacher graded |

**Relationships**:
- M:1 with `AssignmentMaster`
- M:1 with `StudentMaster`

**Used By**:
- Assignments page: Show submission history, status (pending/submitted/graded)
- Dashboard: Calculate `assignments_pending`, `completion_pct`
- API: `/assignments/history/{student_id}`, `/assignments/submit`

---

### QuizMaster

**Table**: `quiz_master`  
**Purpose**: Quiz definitions  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `quiz_id` | Integer | PK, auto-increment |
| `chapter_id` | Integer | FK → `chapter_master` |
| `title` | String | Quiz name |
| `description` | Text | Instructions |
| `total_marks` | Float | Max possible score |
| `quiz_date` | Date | When quiz was conducted |

**Relationships**:
- M:1 with `ChapterMaster`
- 1:M with `QuizResult` (one quiz → many student attempts)

**Used By**:
- Quiz page: List quizzes
- Dashboard: Calculate avg quiz score
- API: `/quiz/history/{student_id}`

---

### QuizResponse

**Table**: `quiz_response`  
**Purpose**: Student quiz scores  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `result_id` | Integer | PK, auto-increment |
| `quiz_id` | Integer | FK → `quiz_master` |
| `student_id` | Integer | FK → `student_master` |
| `score` | Float | Points earned (0 to total_marks) |
| `attempted_at` | DateTime | When student took quiz |

**Relationships**:
- M:1 with `QuizMaster`
- M:1 with `StudentMaster`

**Used By**:
- Quiz page: Show student's quiz history
- Dashboard: Calculate `avg_score`, `strongest_subject`, `weakest_subject`
- API: `/quiz/history/{student_id}`

---

## Communication Models

### SupportTicket (Communication Thread)

**Table**: `support_tickets`  
**Original Name**: Renamed from `support_tickets` (still in DB) → Used as `communication` conceptually  
**Purpose**: Parent-teacher conversation threads  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `ticket_id` | Integer | PK, auto-increment |
| `student_id` | Integer | FK → `student_master` |
| `parent_id` | Integer | FK → `parent_master` |
| `recipient_name` | String | Teacher/recipient name |
| `subject` | String | Conversation subject |
| `category` | String | Academic, Leave Request, Homework, Behavior, Exam, Transport, Fees, General Enquiry, PTM Request |
| `status` | String | OPEN, CLOSED, RESOLVED |
| `created_at` | DateTime | Thread creation time |
| `updated_at` | DateTime | Last activity time |
| `latest_message` | String | Most recent message preview |
| `latest_message_time` | DateTime | Timestamp of latest message |
| `latest_sender` | String | Who sent latest message (PARENT or TEACHER) |
| `unread_count` | Integer | Unread messages for parent |

**Relationships**:
- M:1 with `StudentMaster`
- M:1 with `ParentMaster`
- 1:M with `SupportTicketMessage` (one thread → many messages)

**Used By**:
- Communication Center: List all threads
- API: `/comm/conversations`, `/comm/conversations/{conv_id}/messages`, `/comm/conversations/create`
- Frontend: Thread filtering, message display

**Special Features**:
- Leave Request category: Includes date range in first message
- Translation: Subject, preview, and all messages translate per language
- TTS: Each message supports text-to-speech with fallback voice

---

### SupportTicketMessage (Communication Message)

**Table**: `support_ticket_message`  
**Original Name**: Renamed conceptually → Used as `communication_message`  
**Purpose**: Individual messages within threads  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `message_id` | Integer | PK, auto-increment |
| `ticket_id` | Integer | FK → `support_tickets` (conversation ID) |
| `sender_type` | String | PARENT or TEACHER |
| `sender_name` | String | Name of sender |
| `message` | Text | Message body |
| `created_at` | DateTime | Sent timestamp |
| `is_read` | Boolean | Read status |

**Relationships**:
- M:1 with `SupportTicket`

**Used By**:
- Communication Center: Show thread history
- API: `/comm/conversations/{conv_id}/messages`, `/comm/messages/send`
- Frontend: Message rendering, TTS playback

**Special Features**:
- Each message translates independently
- TTS reads translated message

---

## Feedback Models

### TeacherParentInteractionV2

**Table**: `teacher_parent_interaction_v2`  
**Purpose**: Teacher remarks/feedback on student  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | PK, auto-increment |
| `teacher_id` | Integer | FK → `teacher_master` |
| `student_id` | Integer | FK → `student_master` |
| `class_id` | Integer | FK → `class_master` |
| `section` | String | Class section |
| `comments` | Text | Remark/feedback text |
| `created_at` | TIMESTAMP | When remark was created |

**Relationships**:
- M:1 with `StudentMaster`
- M:1 with `TeacherMaster`

**Used By**:
- Remarks page: Show timeline of remarks
- Dashboard: May show recent remark summary
- API: `/remarks/history/{student_id}`

**Special Features**:
- Timeline display with color-coded teacher initials
- Subject filtering
- Translation support: Comments translate per language
- TTS: Each remark supports text-to-speech with fallback

---

## Notifications Models

### NoticeBoard

**Table**: `notice_board`  
**Purpose**: School announcements  
**Status**: ✅ Active

| Column | Type | Description |
|--------|------|-------------|
| `notice_id` | Integer | PK, auto-increment |
| `notice_title` | String(200) | Title of announcement |
| `notice_text` | Text | Full notice content |
| `notice_date` | Date | Date posted |
| `applicable_class` | String(50) | Class name it applies to |
| `posted_by` | Integer | FK → `teacher_master` |
| `created_at` | TIMESTAMP | Creation timestamp |

**Relationships**:
- M:1 with `TeacherMaster` (via `posted_by`)

**Used By**:
- Notices page: Show all notices with class filtering
- Dashboard: Count notices for today
- API: `/notices/history/{student_id}` filters by student's class

**Special Features**:
- Class filtering
- Translation support: Title and text translate per language
- TTS: Each notice supports text-to-speech with fallback

---

## Disabled / Legacy Models

The following model class bodies are **commented out** in `models.py`. They are excluded from `Base.metadata.create_all()` — these tables will **not** be created on a fresh DB init.

### AttendanceMaster (DISABLED)

**Table**: `attendance_master`  
**Status**: ❌ Disabled — excluded from DB creation

- Attendance module fully removed from parent portal
- `attendance_trend` and `attendance_heat` return `null` from `/dashboard/`
- All attendance API endpoints commented out in `routers/dashboard.py`
- Dashboard health score is now 60% assignment completion + 40% quiz average
- `/parent/attendance` redirects to `/parent/dashboard`
- To restore: un-comment `AttendanceMaster` in `models.py` and re-enable attendance endpoints

### LeaveRequest (DISABLED)

**Table**: `leave_requests`  
**Status**: ❌ Disabled — excluded from DB creation

- Standalone leave-request endpoints removed from `routers/dashboard.py`
- Leave requests now flow through Communication Center as `category="Leave Request"` on `SupportTicket`
- To restore: un-comment `LeaveRequest` in `models.py` and re-enable attendance leave endpoints

### CallRequest (DISABLED)

**Table**: `call_requests`  
**Status**: ❌ Disabled — excluded from DB creation

- Call-request routes commented out in `routers/dashboard.py`
- No active frontend callers
- To restore: un-comment `CallRequest` in `models.py` and re-enable routes

### SchoolEvent (DISABLED)

**Table**: `school_events`  
**Status**: ❌ Disabled — excluded from DB creation

- `upcoming_events` in dashboard returns `[]` (hardcoded empty)
- To restore: un-comment `SchoolEvent` in `models.py` and wire up in `dashboard_service.py`

### ChatThread / ChatMessage (DISABLED)

**Tables**: `chat_threads`, `chat_messages`  
**Status**: ❌ Disabled — excluded from DB creation

- Old thread-based chat replaced by Communication Center (`SupportTicket` + `TicketMessage`)
- To restore: un-comment both model classes in `models.py` together

---

## Relationships Diagram

```
ClassMaster
  ├── 1:M → StudentMaster
  ├── 1:M → SubjectMaster
  └── 1:M → Notice (applicable_class)

StudentMaster
  ├── M:1 → ClassMaster
  ├── M:M → ParentMaster (via ParentStudentMap)
  ├── 1:M → StudentSubmission
  ├── 1:M → QuizResponse
  ├── 1:M → TeacherParentInteractionV2 (remarks)
  └── 1:M → SupportTicket

TeacherMaster
  ├── 1:M → SubjectMaster
  ├── 1:M → TeacherParentInteractionV2 (remarks)
  └── 1:M → SupportTicket

SubjectMaster
  ├── M:1 → ClassMaster
  ├── M:1 → TeacherMaster
  └── 1:M → ChapterMaster

ChapterMaster
  ├── M:1 → SubjectMaster
  └── 1:M → AssignmentMaster & QuizMaster

AssignmentMaster / QuizMaster
  ├── M:1 → ChapterMaster
  └── 1:M → StudentSubmission / QuizResponse

ParentMaster
  └── 1:M → ParentStudentMap, SupportTicket

SupportTicket (Communication)
  ├── M:1 → StudentMaster
  ├── M:1 → ParentMaster
  └── 1:M → TicketMessage
```

---

## Data Flow Examples

### Dashboard Load
```
Frontend: GET /dashboard/{studentId}
Backend: 
  1. Fetch StudentMaster + ClassMaster
  2. Fetch all StudentSubmission for student → calculate pending, completion%
  3. Fetch all QuizResponse for student → calculate avg_score, strongest/weakest subjects
  4. Fetch all TeacherParentInteractionV2 for student (remarks)
  5. Fetch all NoticeBoard for student's class
  6. Aggregate into response with alerts, deadlines, recommendations
     - health_score = (submission_rate * 60) + (avg_score * 0.4)
     - attendance_trend = null  (module disabled)
     - attendance_heat = null   (module disabled)
     - upcoming_events = []     (SchoolEvent table disabled)
```

### Remarks Load & Translate
```
Frontend: GET /remarks/history/{studentId}
Backend: Return all Remark records
Frontend:
  1. Extract all remark.comment texts
  2. Call useTranslation hook
  3. If language != 'en': POST /translate for each comment
  4. Display with translated text + TTS button
  5. TTS reads translated comment in selected language
```

### Communication Send
```
Frontend: POST /comm/conversations/create
Body:
  {
    student_id, parent_id, subject, category,
    recipient_name, first_message
  }
Backend:
  1. Create SupportTicket row
  2. Create initial SupportTicketMessage row
  3. Return conversation object

Frontend: For each message in thread
  1. Extract message.message text
  2. Call useTranslation hook
  3. Display with translation + TTS button
```

---

## Disabled Models Summary

| Model | Table | Status | Notes |
|-------|-------|--------|-------|
| `AttendanceMaster` | `attendance_master` | ❌ Commented out | Attendance module removed from portal |
| `LeaveRequest` | `leave_requests` | ❌ Commented out | Moved to Communication Center category |
| `CallRequest` | `call_requests` | ❌ Commented out | Routes disabled, no frontend callers |
| `SchoolEvent` | `school_events` | ❌ Commented out | `upcoming_events` returns `[]` |
| `ChatThread` | `chat_threads` | ❌ Commented out | Replaced by `SupportTicket` |
| `ChatMessage` | `chat_messages` | ❌ Commented out | Replaced by `TicketMessage` |

| Model | Status | Reason |
|-------|--------|--------|
| PTM Request | ⚠️ Partial | Conceptually part of Communication (Leave Request category) but not separate model |
| Grades/Marks | ⚠️ Partial | Only in QuizResponse; StudentSubmission has `marks_obtained` field but no aggregate grade model |

---

## Database Size Estimates (Per 1000 Students)

| Table | Rows | Storage |
|-------|------|---------|
| `student_master` | 1,000 | ~100 KB |
| `parent_master` | 2,000 | ~200 KB |
| `assignment_master` | 500 | ~50 KB |
| `student_submission` | 10,000 | ~1 MB |
| `quiz_response` | 5,000 | ~500 KB |
| `teacher_parent_interaction_v2` | 2,000 | ~200 KB |
| `notice_board` | 100 | ~50 KB |
| `support_tickets` | 5,000 | ~500 KB |
| `ticket_messages` | 20,000 | ~2 MB |
| **Total** | ~45,600 | **~5 MB** |

*Note*: `attendance_master`, `leave_requests`, `call_requests`, `school_events`, `chat_threads`, `chat_messages` are excluded from DB — no storage cost.

*Note*: Actual size varies based on text field lengths and indexing.

---

## Indexes (Performance Optimization)

All `primary_key` and `ForeignKey` columns are auto-indexed.  
Additional indexes for common queries:
- `StudentMaster.full_name` (for search)
- `AssignmentMaster.due_date` (for dashboard alerts)
- `QuizResult.attempted_at` (for sorting)
- `SupportTicket.created_at` (for thread listing)
- `Attendance.date` (for filtering by period)

---

## Production Considerations

### Backup Strategy
- Daily backups of PostgreSQL database
- Archive old SupportTicket messages (>1 year) to separate table
- Don't delete Remark or Notice records (audit trail)

### Query Optimization
- Use pagination for AssignmentSubmission / QuizResult (limit 20-50 per page)
- Cache Dashboard response (5-minute TTL)
- Add indexes on `(student_id, date)` composite columns for Attendance

### Data Retention
- Keep all academic records indefinitely
- Soft-delete old SupportTicket (add `deleted_at` column) instead of hard-delete
- Archive Notice after 1 academic year

---

**Last Updated**: May 13, 2026  
**Version**: 1.0
