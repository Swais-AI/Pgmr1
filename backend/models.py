from sqlalchemy import Column, Integer, String, Float, Numeric, ForeignKey, TIMESTAMP, Date, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class ClassMaster(Base):
    __tablename__ = "class_master"
    
    class_id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String, index=True)
    section_name = Column(String)
    academic_year = Column(String)

class StudentMaster(Base):
    __tablename__ = "student_master"
    
    student_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    class_id = Column(Integer, ForeignKey("class_master.class_id"), index=True)
    section = Column(String)
    roll_no = Column(String)
    
    class_info = relationship("ClassMaster")

class ParentMaster(Base):
    __tablename__ = "parent_master"
    
    parent_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String, index=True)
    phone = Column(String)
    profile_image = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ParentStudentMap(Base):
    __tablename__ = "parent_student_map"
    
    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("parent_master.parent_id"), index=True)
    student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
    relationship_type = Column(String)
    
    parent_info = relationship("ParentMaster")
    student_info = relationship("StudentMaster")

class TeacherMaster(Base):
    __tablename__ = "teacher_master"
    
    teacher_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    email = Column(String)
    phone = Column(String)

class SubjectMaster(Base):
    __tablename__ = "subject_master"
    
    subject_id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("class_master.class_id"))
    subject_name = Column(String)
    teacher_id = Column(Integer, ForeignKey("teacher_master.teacher_id"))

class ChapterMaster(Base):
    __tablename__ = "chapter_master"
    
    chapter_id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subject_master.subject_id"), index=True)
    chapter_name = Column(String)
    chapter_order = Column(Integer)
    
    subject_info = relationship("SubjectMaster")

class AssignmentMaster(Base):
    __tablename__ = "assignment_master"
    
    assignment_id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapter_master.chapter_id"), index=True)
    assignment_title = Column(String)
    assignment_text = Column(Text)
    due_date = Column(Date)
    assigned_by = Column(Integer, ForeignKey("teacher_master.teacher_id"))
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    chapter_info = relationship("ChapterMaster")

class StudentSubmission(Base):
    __tablename__ = "student_submission"
    
    submission_id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignment_master.assignment_id"))
    student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
    submission_text = Column(Text)
    file_path = Column(Text)
    marks_obtained = Column(Numeric(5, 2))
    teacher_remarks = Column(Text)
    submitted_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    assignment_info = relationship("AssignmentMaster")

class QuizMaster(Base):
    __tablename__ = "quiz_master"
    
    quiz_id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapter_master.chapter_id"), index=True)
    quiz_title = Column(String)
    total_marks = Column(Integer)
    duration_minutes = Column(Integer)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    chapter_info = relationship("ChapterMaster")

class QuizResponse(Base):
    __tablename__ = "quiz_response"
    
    response_id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quiz_master.quiz_id"))
    student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
    score = Column(Numeric(5, 2))
    completed_flag = Column(Boolean, default=False)
    
    quiz_info = relationship("QuizMaster")

class NoticeBoard(Base):
    __tablename__ = "notice_board"
    
    notice_id = Column(Integer, primary_key=True, index=True)
    notice_title = Column(String(200))
    notice_text = Column(Text)
    notice_date = Column(Date)
    applicable_class = Column(String(50))
    posted_by = Column(Integer, ForeignKey("teacher_master.teacher_id"))
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    teacher_info = relationship("TeacherMaster")

class TeacherParentInteractionV2(Base):
    __tablename__ = "teacher_parent_interaction"
    
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teacher_master.teacher_id"))
    student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
    class_id = Column(Integer, ForeignKey("class_master.class_id"))
    section = Column(String)
    comments = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    teacher_info = relationship("TeacherMaster")
    student_info = relationship("StudentMaster")

# ── LEGACY MODEL: CallRequest ─────────────────────────────────────────────
# Commented out — excluded from Base.metadata.create_all().
# call_requests table will NOT be created on next DB init.
# Call-request flow replaced by Communication Center (SupportTicket category).
# Restore by un-commenting this block and re-enabling the routes.
#
# class CallRequest(Base):
#     __tablename__ = "call_requests"
#     id = Column(Integer, primary_key=True, index=True)
#     parent_id = Column(Integer, ForeignKey("parent_master.parent_id"), index=True)
#     student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
#     teacher_id = Column(Integer, ForeignKey("teacher_master.teacher_id"), nullable=True)
#     message = Column(Text)
#     status = Column(String, default="pending")
#     created_at = Column(DateTime, default=datetime.utcnow)
#     parent_info = relationship("ParentMaster")
#     student_info = relationship("StudentMaster")
#     teacher_info = relationship("TeacherMaster")
# ──────────────────────────────────────────────────────────────────────────

# ── LEGACY MODEL: AttendanceMaster ────────────────────────────────────────
# Commented out — excluded from Base.metadata.create_all().
# attendance_master table will NOT be created on next DB init.
# Attendance module fully removed from parent portal; all /attendance/ endpoints
# are disabled in routers/dashboard.py. dashboard_service.py does not query it.
# Restore by un-commenting this block and re-enabling those endpoints/schemas.
#
# class AttendanceMaster(Base):
#     __tablename__ = "attendance_master"
#     attendance_id = Column(Integer, primary_key=True, index=True)
#     student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
#     class_id = Column(Integer, ForeignKey("class_master.class_id"), index=True)
#     attendance_date = Column(Date)
#     status = Column(String)  # Present, Absent, Late
#     academic_year = Column(String)
#     student_info = relationship("StudentMaster")
# ──────────────────────────────────────────────────────────────────────────

# ── LEGACY MODEL: SchoolEvent ─────────────────────────────────────────────
# Commented out — excluded from Base.metadata.create_all().
# school_events table will NOT be created on next DB init.
# Events/calendar feature not implemented in current parent portal scope.
# Restore by un-commenting this block and adding /events/ routes.
#
# class SchoolEvent(Base):
#     __tablename__ = "school_events"
#     event_id = Column(Integer, primary_key=True, index=True)
#     title = Column(String)
#     description = Column(Text)
#     event_date = Column(Date)
#     class_id = Column(Integer, ForeignKey("class_master.class_id"), nullable=True)
#     academic_year = Column(String)
#     event_type = Column(String)  # Exam, Holiday, PTM, Activity
# ──────────────────────────────────────────────────────────────────────────

# ── LEGACY MODEL: ChatThread ──────────────────────────────────────────────
# Commented out — excluded from Base.metadata.create_all().
# chat_threads table will NOT be created on next DB init.
# Thread-based chat replaced by Communication Center (SupportTicket + TicketMessage).
# Restore by un-commenting ChatThread + ChatMessage together.
#
# class ChatThread(Base):
#     __tablename__ = "chat_threads"
#     id = Column(Integer, primary_key=True, index=True)
#     parent_id = Column(Integer, ForeignKey("parent_master.parent_id"), index=True)
#     teacher_id = Column(Integer, ForeignKey("teacher_master.teacher_id"), index=True)
#     student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
#     created_at = Column(DateTime, default=datetime.utcnow)
#     parent_info = relationship("ParentMaster")
#     teacher_info = relationship("TeacherMaster")
#     student_info = relationship("StudentMaster")
# ──────────────────────────────────────────────────────────────────────────

# ── LEGACY MODEL: ChatMessage ─────────────────────────────────────────────
# Commented out — excluded from Base.metadata.create_all().
# chat_messages table will NOT be created on next DB init.
# Companion to ChatThread above; both disabled together.
#
# class ChatMessage(Base):
#     __tablename__ = "chat_messages"
#     id = Column(Integer, primary_key=True, index=True)
#     thread_id = Column(Integer, ForeignKey("chat_threads.id"), index=True)
#     sender_type = Column(String)  # 'parent' or 'teacher'
#     sender_id = Column(Integer)
#     message = Column(Text)
#     translated_message = Column(Text, nullable=True)
#     created_at = Column(DateTime, default=datetime.utcnow)
#     is_read = Column(Boolean, default=False)
#     thread_info = relationship("ChatThread")
# ──────────────────────────────────────────────────────────────────────────

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    ticket_id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, index=True)
    parent_id = Column(Integer, ForeignKey("parent_master.parent_id"), index=True)
    student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
    subject = Column(String)
    category = Column(String)
    priority = Column(String)
    status = Column(String, default="OPEN")
    recipient_name = Column(String, nullable=True)  # Teacher name or department
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent_info = relationship("ParentMaster")
    student_info = relationship("StudentMaster")

class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    message_id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.ticket_id"), index=True)
    sender_type = Column(String)
    sender_name = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)

    ticket_info = relationship("SupportTicket")

# ── LEGACY MODEL: LeaveRequest ────────────────────────────────────────────
# Commented out — excluded from Base.metadata.create_all().
# leave_requests table will NOT be created on next DB init.
# Standalone leave-request endpoints disabled in routers/dashboard.py.
# Leave requests now exist only as a Communication Center category in
# routers/communication.py (SupportTicket with category="Leave Request").
# Restore by un-commenting this block and re-enabling those endpoints/schemas.
#
# class LeaveRequest(Base):
#     __tablename__ = "leave_requests"
#     leave_request_id = Column(Integer, primary_key=True, index=True)
#     student_id = Column(Integer, ForeignKey("student_master.student_id"), index=True)
#     parent_id = Column(Integer, ForeignKey("parent_master.parent_id"), index=True)
#     from_date = Column(Date)
#     to_date = Column(Date)
#     reason = Column(String)
#     parent_note = Column(Text, nullable=True)
#     status = Column(String, default="Pending")  # Pending, Approved, Rejected
#     reviewed_by = Column(Integer, ForeignKey("teacher_master.teacher_id"), nullable=True)
#     created_at = Column(DateTime, default=datetime.utcnow)
#     student_info = relationship("StudentMaster")
#     parent_info = relationship("ParentMaster")
# ──────────────────────────────────────────────────────────────────────────
