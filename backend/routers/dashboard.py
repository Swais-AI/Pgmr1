from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from typing import List, Dict, Any
from datetime import datetime, date, timedelta
from services.dashboard_service import get_dashboard_data
# DISABLED: analytics_service only served GET /analytics/ which has no frontend caller
# from services.analytics_service import get_analytics_data
from schemas import (
    DashboardResponse, MappedChildSchema, AssignmentSchema, QuizSchema, QuizDetailResponse,
    RemarkSchema, NoticeSchema, CallRequestCreate, CallRequestResponse,
    AssignmentSubmitRequest, AssignmentAnalyticsResponse, NotificationSchema,
    # DISABLED: AttendanceDataResponse, AttendanceOverviewSchema, AttendanceDaySchema
    #           — attendance module removed from parent portal.
    # DISABLED: LeaveRequestCreate, LeaveRequestResponse, LeaveStatusUpdate
    #           — standalone leave-request endpoints disabled; flow moved to Communication Center.
    # DISABLED: AnalyticsResponse — analytics module removed from frontend.
)
from models import (
    ParentStudentMap, StudentMaster, ClassMaster, AssignmentMaster, SubjectMaster,
    ChapterMaster, StudentSubmission, QuizMaster, QuizResponse,
    TeacherParentInteractionV2, TeacherMaster, NoticeBoard,
    # DISABLED: CallRequest   — call-request routes commented out below.
    # DISABLED: AttendanceMaster — attendance endpoints commented out below.
    # DISABLED: LeaveRequest     — leave-request endpoints commented out below.
)

router = APIRouter()

@router.get("/dashboard/{student_id}", response_model=DashboardResponse)
def get_dashboard(student_id: int, db: Session = Depends(get_db)):
    try:
        return get_dashboard_data(db, student_id)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── DISABLED: Analytics route ─────────────────────────────────────────────
# GET /analytics/{student_id} had no frontend caller after /parent/analytics
# page was removed. analytics_service.py is preserved on disk for reference.
# Restore by uncommenting this block and re-enabling the analytics_service
# import at the top of this file.
#
# @router.get("/analytics/{student_id}", response_model=AnalyticsResponse)
# def get_analytics(student_id: int, db: Session = Depends(get_db)):
#     try:
#         return get_analytics_data(db, student_id)
#     except HTTPException as e:
#         raise e
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# ──────────────────────────────────────────────────────────────────────────

# ── DISABLED: Communication timeline route ────────────────────────────────
# GET /communication/timeline/{student_id} had no frontend caller. The new
# Communication Center uses /comm/ routes instead. TimelineItemSchema also
# disabled in schemas.py. Restore together if a timeline view is re-added.
#
# from schemas import TimelineItemSchema
#
# @router.get("/communication/timeline/{student_id}", response_model=List[TimelineItemSchema])
# def get_communication_timeline(student_id: int, db: Session = Depends(get_db)):
#     try:
#         timeline = []
#         calls = db.query(CallRequest, TeacherMaster.full_name).outerjoin(...).all()
#         ... (full implementation preserved in git history)
#         return [TimelineItemSchema(**item) for item in timeline]
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# ──────────────────────────────────────────────────────────────────────────

@router.get("/parents/{parent_id}/children", response_model=List[MappedChildSchema])
def get_parent_children(parent_id: int, db: Session = Depends(get_db)):
    children_query = db.query(StudentMaster, ClassMaster)\
        .join(ParentStudentMap, ParentStudentMap.student_id == StudentMaster.student_id)\
        .join(ClassMaster, StudentMaster.class_id == ClassMaster.class_id)\
        .filter(ParentStudentMap.parent_id == parent_id).all()

    result = []
    for student, class_info in children_query:
        result.append(MappedChildSchema(
            student_id=student.student_id,
            full_name=student.full_name,
            class_name=class_info.class_name,
            section=student.section
        ))
    return result

@router.get("/assignments/history/{student_id}", response_model=List[AssignmentSchema])
def get_assignments_history(student_id: int, db: Session = Depends(get_db)):
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")

    assignments_query = db.query(
        AssignmentMaster, SubjectMaster.subject_name, ChapterMaster.chapter_name,
        TeacherMaster.full_name, StudentSubmission
    ).select_from(AssignmentMaster)\
    .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
    .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
    .outerjoin(TeacherMaster, AssignmentMaster.assigned_by == TeacherMaster.teacher_id)\
    .outerjoin(StudentSubmission, (StudentSubmission.assignment_id == AssignmentMaster.assignment_id) & (StudentSubmission.student_id == student_id))\
    .filter(SubjectMaster.class_id == student.class_id)\
    .order_by(AssignmentMaster.due_date.desc()).all()

    assignment_list = []
    today = date.today()
    for assign, subject_name, chapter_name, teacher_name, submission in assignments_query:
        if submission:
            status = "Graded" if submission.marks_obtained is not None else "Submitted"
        elif assign.due_date and assign.due_date < today:
            status = "Overdue"
        elif assign.due_date and (assign.due_date - today).days <= 7:
            status = "Ongoing"
        else:
            status = "Upcoming"
        assignment_list.append(AssignmentSchema(
            assignment_id=assign.assignment_id,
            title=assign.title,
            subject=subject_name,
            chapter_name=chapter_name,
            teacher_name=teacher_name or "",
            due_date=assign.due_date.isoformat() if assign.due_date else "",
            status=status,
            marks_obtained=submission.marks_obtained if submission else None,
            submitted_at=submission.submitted_at.isoformat() if submission and submission.submitted_at else None,
            submission_text=submission.submission_text if submission else None,
            teacher_remarks=submission.teacher_remarks if submission else None,
            file_path=submission.file_path if submission else None,
        ))
    return assignment_list

@router.get("/assignments/analytics/{student_id}", response_model=AssignmentAnalyticsResponse)
def get_assignment_analytics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")

    rows = db.query(AssignmentMaster, StudentSubmission)\
        .select_from(AssignmentMaster)\
        .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
        .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
        .outerjoin(StudentSubmission, (StudentSubmission.assignment_id == AssignmentMaster.assignment_id) & (StudentSubmission.student_id == student_id))\
        .filter(SubjectMaster.class_id == student.class_id).all()

    today = date.today()
    total = len(rows)
    submitted = sum(1 for a, s in rows if s and s.marks_obtained is None)
    graded = sum(1 for a, s in rows if s and s.marks_obtained is not None)
    overdue = sum(1 for a, s in rows if not s and a.due_date and a.due_date < today)
    ongoing = sum(1 for a, s in rows if not s and a.due_date and a.due_date >= today and (a.due_date - today).days <= 7)
    upcoming = sum(1 for a, s in rows if not s and (not a.due_date or (a.due_date >= today and (a.due_date - today).days > 7)))
    completion_pct = round((submitted + graded) / total * 100, 1) if total > 0 else 0.0
    return AssignmentAnalyticsResponse(total=total, submitted=submitted, pending=ongoing, overdue=overdue, graded=graded, completion_pct=completion_pct)

@router.post("/assignments/submit", response_model=AssignmentSchema)
def submit_assignment(request: AssignmentSubmitRequest, db: Session = Depends(get_db)):
    existing = db.query(StudentSubmission).filter(
        StudentSubmission.assignment_id == request.assignment_id,
        StudentSubmission.student_id == request.student_id
    ).first()
    if existing:
        existing.submission_text = request.submission_text
        existing.file_path = request.file_path
        existing.submitted_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        sub = existing
    else:
        sub = StudentSubmission(
            assignment_id=request.assignment_id,
            student_id=request.student_id,
            submission_text=request.submission_text,
            file_path=request.file_path,
            submitted_at=datetime.utcnow()
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    assign_row = db.query(AssignmentMaster, SubjectMaster.subject_name, ChapterMaster.chapter_name, TeacherMaster.full_name)\
        .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
        .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
        .outerjoin(TeacherMaster, AssignmentMaster.assigned_by == TeacherMaster.teacher_id)\
        .filter(AssignmentMaster.assignment_id == request.assignment_id).first()

    if not assign_row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assign, subject_name, chapter_name, teacher_name = assign_row
    status = "Graded" if sub.marks_obtained is not None else "Submitted"
    return AssignmentSchema(
        assignment_id=assign.assignment_id, title=assign.title, subject=subject_name,
        chapter_name=chapter_name, teacher_name=teacher_name or "",
        due_date=assign.due_date.isoformat() if assign.due_date else "",
        status=status, marks_obtained=sub.marks_obtained,
        submitted_at=sub.submitted_at.isoformat() if sub.submitted_at else None,
        submission_text=sub.submission_text, teacher_remarks=sub.teacher_remarks, file_path=sub.file_path
    )

@router.get("/quiz/history/{student_id}", response_model=List[QuizDetailResponse])
def get_quiz_history(student_id: int, db: Session = Depends(get_db)):
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")

    quizzes_query = db.query(
        QuizMaster, SubjectMaster.subject_name, QuizResponse
    ).select_from(QuizMaster)\
    .join(ChapterMaster, QuizMaster.chapter_id == ChapterMaster.chapter_id)\
    .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
    .join(QuizResponse, (QuizResponse.quiz_id == QuizMaster.quiz_id) & (QuizResponse.student_id == student_id))\
    .filter(SubjectMaster.class_id == student.class_id).all()

    quiz_list = []
    for quiz, subject_name, response in quizzes_query:
        if not response or response.score is None:
            continue

        score = float(response.score)
        total = float(quiz.total_marks or 100)
        percentage = round((score / total) * 100, 1) if total > 0 else 0

        if percentage >= 85:
            status = "Excellent"
            suggestion = "Excellent consistency."
        elif percentage >= 70:
            status = "Good"
            suggestion = "Good performance. Minor improvement possible."
        elif percentage >= 50:
            status = "Average"
            suggestion = "Needs more revision practice."
        else:
            status = "Needs Improvement"
            suggestion = "Immediate academic attention recommended."

        quiz_list.append(QuizDetailResponse(
            subject=subject_name,
            score=str(score),
            total=str(total),
            quiz_id=quiz.quiz_id,
            quiz_title=quiz.title or f"{subject_name} Quiz",
            percentage=percentage,
            teacher_name="Course Instructor",
            remarks=suggestion,
            quiz_date=quiz.created_at.isoformat() if hasattr(quiz, 'created_at') and quiz.created_at else datetime.utcnow().isoformat(),
            status=status,
            suggestion=suggestion
        ))
    return quiz_list

@router.get("/remarks/history/{student_id}", response_model=List[RemarkSchema])
def get_remarks_history(student_id: int, db: Session = Depends(get_db)):
    submissions_remarks = db.query(StudentSubmission, TeacherMaster.full_name, SubjectMaster.subject_name)\
        .join(AssignmentMaster, StudentSubmission.assignment_id == AssignmentMaster.assignment_id)\
        .join(TeacherMaster, AssignmentMaster.assigned_by == TeacherMaster.teacher_id)\
        .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
        .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
        .filter(StudentSubmission.student_id == student_id)\
        .filter(StudentSubmission.teacher_remarks.isnot(None))\
        .filter(StudentSubmission.teacher_remarks != '').all()

    interactions = db.query(TeacherParentInteractionV2, TeacherMaster.full_name)\
        .join(TeacherMaster, TeacherParentInteractionV2.teacher_id == TeacherMaster.teacher_id)\
        .filter(TeacherParentInteractionV2.student_id == student_id)\
        .filter(TeacherParentInteractionV2.comments.isnot(None))\
        .filter(TeacherParentInteractionV2.comments != '').all()

    all_remarks = []
    idx = 1
    for sub, teacher_name, subject_name in submissions_remarks:
        remark_date = sub.submitted_at or datetime.utcnow()
        all_remarks.append({
            "remark_id": idx,
            "teacher_name": teacher_name,
            "subject": subject_name,
            "comment": sub.teacher_remarks.strip(),
            "date_obj": remark_date,
            "date": remark_date.strftime("%d %b %Y")
        })
        idx += 1

    for inter, teacher_name in interactions:
        remark_date = inter.created_at or datetime.utcnow()
        all_remarks.append({
            "remark_id": idx,
            "teacher_name": teacher_name,
            "subject": "General",
            "comment": inter.comments.strip(),
            "date_obj": remark_date,
            "date": remark_date.strftime("%d %b %Y")
        })
        idx += 1

    all_remarks.sort(key=lambda x: x["date_obj"], reverse=True)
    return [RemarkSchema(**r) for r in all_remarks]

@router.get("/notices/history/{student_id}", response_model=List[NoticeSchema])
def get_notices_history(student_id: int, db: Session = Depends(get_db)):
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")

    # We optionally could match student's class name with applicable_class, but since we
    # changed the DB, let's just pull all notices and filter by something reasonable or just return all for now
    # (assuming all notices are relevant to the parent in this view).
    notices_query = db.query(NoticeBoard, TeacherMaster.full_name)\
        .outerjoin(TeacherMaster, NoticeBoard.posted_by == TeacherMaster.teacher_id)\
        .filter(NoticeBoard.notice_text.isnot(None))\
        .filter(NoticeBoard.notice_text != '')\
        .order_by(NoticeBoard.created_at.desc()).all()

    return [
        NoticeSchema(
            notice_id=n.notice_id,
            notice_title=n.notice_title or "Notice",
            notice_text=n.notice_text.strip(),
            notice_date=n.notice_date.strftime("%d %b %Y") if n.notice_date else (n.created_at.strftime("%d %b %Y") if n.created_at else ""),
            applicable_class=n.applicable_class or "All",
            posted_by_name=t or "Admin"
        ) for n, t in notices_query
    ]

# ── DISABLED: Call-request routes ────────────────────────────────────────
# GET /call-requests/history/{student_id} and POST /request-call had no
# frontend callers (api.ts exported fetchCallRequestsHistory and requestCall
# but no page imported them after the dashboard redesign). The CallRequest
# model and table remain intact. Restore if a PTM-request feature is added.
#
# @router.get("/call-requests/history/{student_id}", response_model=List[CallRequestResponse])
# def get_call_requests_history(student_id: int, db: Session = Depends(get_db)):
#     ...
#
# @router.post("/request-call", response_model=CallRequestResponse)
# def create_call_request(request: CallRequestCreate, db: Session = Depends(get_db)):
#     ...
# ──────────────────────────────────────────────────────────────────────────


# ── DISABLED: Old chat system routes ─────────────────────────────────────
# GET /chat/threads/{parent_id}/{student_id}, GET /chat/messages/{thread_id},
# POST /chat/messages — these served a thread-based Parent↔Teacher chat
# backed by ChatThread + ChatMessage tables. Replaced by the /comm/
# Communication Center (routers/communication.py). The ChatThread and
# ChatMessage DB tables remain intact (data preserved).
# ChatMessageSchema, ChatMessageCreate, ChatThreadSchema are also disabled
# in schemas.py. Restore this entire block to revive the old chat system.
#
# from models import ChatThread, ChatMessage
# from schemas import ChatThreadSchema, ChatMessageSchema, ChatMessageCreate
#
# @router.get("/chat/threads/{parent_id}/{student_id}", ...)
# @router.get("/chat/messages/{thread_id}", ...)
# @router.post("/chat/messages", ...)
# ──────────────────────────────────────────────────────────────────────────

# ── DISABLED: Old support-ticket routes ───────────────────────────────────
# GET /tickets/{parent_id}/{student_id}, POST /tickets,
# GET /tickets/{ticket_id}/messages, POST /tickets/{ticket_id}/messages —
# These were the original customer-support style ticket system. Two issues:
#   1. Route ordering caused 422 errors (FastAPI matched /{parent_id}/{student_id}
#      before /{ticket_id}/messages, failing integer parse on "messages").
#   2. Replaced wholesale by /comm/ routes (routers/communication.py) which
#      reuse the same SupportTicket + TicketMessage tables cleanly.
# SupportTicketSchema, TicketMessageSchema etc. are also disabled in schemas.py.
# The /notifications/ route below still queries SupportTicket/TicketMessage
# models directly, so those model imports remain active.
#
# from schemas import SupportTicketSchema, TicketMessageSchema, TicketCreateSchema, TicketMessageCreateSchema
#
# @router.get("/tickets/{parent_id}/{student_id}", ...)
# @router.post("/tickets", ...)
# @router.get("/tickets/{ticket_id}/messages", ...)
# @router.post("/tickets/{ticket_id}/messages", ...)
# ──────────────────────────────────────────────────────────────────────────

from models import SupportTicket, TicketMessage

@router.get("/notifications/{student_id}", response_model=List[NotificationSchema])
def get_notifications(student_id: int, db: Session = Depends(get_db)):
    notifications = []

    # 1. Unread Ticket Replies
    unread_msgs = db.query(TicketMessage, SupportTicket)\
        .join(SupportTicket, TicketMessage.ticket_id == SupportTicket.ticket_id)\
        .filter(SupportTicket.student_id == student_id, TicketMessage.sender_type != "PARENT", TicketMessage.is_read == False).all()

    for msg, ticket in unread_msgs:
        notifications.append(NotificationSchema(
            id=f"msg_{msg.message_id}", type="ticket_reply", title=f"Reply on {ticket.ticket_number}",
            message=msg.message[:50] + "...", date=msg.created_at.isoformat() if msg.created_at else "",
            is_read=False, link="/parent/communication"
        ))

    # 2. Recent Announcements (mocked unread for today)
    from datetime import date, timedelta
    today = date.today()
    student = db.query(StudentMaster).filter(StudentMaster.student_id == student_id).first()
    if student:
        # We fetch all recent notices since class_id is no longer an int relation
        notices = db.query(NoticeBoard).order_by(NoticeBoard.created_at.desc()).limit(2).all()
        for n in notices:
            if n.created_at and n.created_at.date() >= (today - timedelta(days=2)):
                notifications.append(NotificationSchema(
                    id=f"not_{n.notice_id}", type="announcement", title="New Announcement",
                    message=n.notice_title or "Notice", date=n.created_at.isoformat(),
                    is_read=False, link="/parent/notices"
                ))

    notifications.sort(key=lambda x: x.date, reverse=True)
    return notifications


# ── DISABLED: Attendance Endpoints ────────────────────────────────────────
# The Attendance module has been fully removed from the parent portal.
# These four routes (GET /attendance/{student_id},
# POST /attendance/leave-request, GET /attendance/leave-requests/{student_id},
# PATCH /attendance/leave-request/{leave_request_id}) have no frontend callers.
#
# The underlying DB tables (attendance_master, leave_requests) remain intact.
# The AttendanceMaster and LeaveRequest models in models.py are preserved.
# The schemas (AttendanceDaySchema, AttendanceOverviewSchema, AttendanceDataResponse,
# LeaveRequestCreate, LeaveRequestResponse, LeaveStatusUpdate) are disabled in
# schemas.py. The API helpers are disabled in frontend/src/lib/api.ts.
#
# Leave requests now exist ONLY as a Communication Center category/workflow
# routed through /comm/ (routers/communication.py).
#
# To restore the standalone attendance module, uncomment:
#   - These endpoints
#   - AttendanceMaster, LeaveRequest imports at the top of this file
#   - The corresponding schemas in schemas.py
#   - The API helpers in frontend/src/lib/api.ts
#   - The attendance page: frontend/src/app/parent/attendance/page.tsx
# ──────────────────────────────────────────────────────────────────────────
#
# @router.get("/attendance/{student_id}", response_model=AttendanceDataResponse)
# def get_attendance(student_id: int, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
#
# @router.post("/attendance/leave-request", response_model=LeaveRequestResponse)
# def create_leave_request(request: LeaveRequestCreate, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
#
# @router.get("/attendance/leave-requests/{student_id}", response_model=List[LeaveRequestResponse])
# def get_leave_requests(student_id: int, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
#
# @router.patch("/attendance/leave-request/{leave_request_id}", response_model=LeaveRequestResponse)
# def update_leave_status(leave_request_id: int, update: LeaveStatusUpdate, db: Session = Depends(get_db)):
#     ... (full implementation preserved in git history)
# ──────────────────────────────────────────────────────────────────────────
