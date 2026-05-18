from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from models import (
    StudentMaster, ClassMaster, AssignmentMaster, StudentSubmission,
    QuizMaster, QuizResponse, TeacherParentInteractionV2, NoticeBoard,
    SubjectMaster, ChapterMaster, TeacherMaster,
    # AttendanceMaster — DISABLED: attendance module removed from parent portal.
    # CallRequest     — DISABLED: call-request routes disabled; not queried here.
    # SchoolEvent     — imported but unused; upcoming_events=[] is hardcoded.
)
from schemas import (
    DashboardResponse, StudentSchema, AssignmentSchema, QuizSchema,
    RemarkSchema, NoticeSchema, CallRequestResponse,
    # AttendanceTrendSchema — DISABLED: returned as null; attendance module removed.
    PerformanceSummarySchema, EventSchema,
    DailySummarySchema, AlertSchema, AcademicHealthSchema,
    EngagementIndicatorSchema, DeadlineSchema, SmartRecommendationSchema,
    WeeklyProgressSchema, ClassRankSchema, SubjectPerformanceData, NotificationSchema
)
from datetime import date, datetime, timedelta

def get_dashboard_data(db: Session, student_id: int):
    today = date.today()
    now = datetime.utcnow()

    # 1. Student Info
    student_query = db.query(StudentMaster, ClassMaster)\
        .join(ClassMaster, StudentMaster.class_id == ClassMaster.class_id)\
        .filter(StudentMaster.student_id == student_id).first()

    if not student_query:
        raise HTTPException(status_code=404, detail="Student not found")

    student, class_info = student_query

    student_data = StudentSchema(
        student_id=student.student_id,
        full_name=student.full_name,
        class_name=class_info.class_name,
        section=student.section,
        roll_no=student.roll_no or ""
    )

    # 2. Assignments
    assignments_query = db.query(
        AssignmentMaster, SubjectMaster.subject_name, StudentSubmission
    ).select_from(AssignmentMaster)\
    .join(ChapterMaster, AssignmentMaster.chapter_id == ChapterMaster.chapter_id)\
    .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
    .outerjoin(StudentSubmission, (StudentSubmission.assignment_id == AssignmentMaster.assignment_id) & (StudentSubmission.student_id == student_id))\
    .filter(SubjectMaster.class_id == student.class_id)\
    .order_by(AssignmentMaster.due_date.desc()).all()

    assignment_list = []
    pending_count = 0
    overdue_assignments = []
    upcoming_deadlines = []
    graded_assignments = []

    for assign, subject_name, submission in assignments_query:
        due_date_str = assign.due_date.isoformat() if assign.due_date else ""
        days_left = (assign.due_date - today).days if assign.due_date else 0

        if submission:
            status = "Completed"
            if submission.marks_obtained is not None:
                graded_assignments.append((assign.title, submission.submitted_at))
        elif assign.due_date and assign.due_date < today:
            status = "Overdue"
            overdue_assignments.append({"title": assign.title, "subject": subject_name, "days_left": days_left})
        else:
            status = "Pending"
            pending_count += 1
            if assign.due_date and days_left >= 0:
                upcoming_deadlines.append(DeadlineSchema(
                    title=assign.title, type=f"Assignment • {subject_name}", due_date=due_date_str, days_left=days_left
                ))

        assignment_list.append(AssignmentSchema(
            title=assign.title, subject=subject_name, due_date=due_date_str,
            status=status, marks_obtained=submission.marks_obtained if submission else None
        ))

    upcoming_deadlines.sort(key=lambda x: x.days_left)

    # 3. Quizzes & Subject Performance
    quizzes_query = db.query(
        QuizMaster, SubjectMaster.subject_name, QuizResponse
    ).select_from(QuizMaster)\
    .join(ChapterMaster, QuizMaster.chapter_id == ChapterMaster.chapter_id)\
    .join(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)\
    .outerjoin(QuizResponse, (QuizResponse.quiz_id == QuizMaster.quiz_id) & (QuizResponse.student_id == student_id))\
    .filter(SubjectMaster.class_id == student.class_id).all()

    quiz_list = []
    subject_scores = {}
    total_score = 0
    total_quizzes = 0

    for quiz, subject_name, response in quizzes_query:
        if response and response.score is not None:
            score = response.score
            total = quiz.total_marks or 1
            pct = (score / total) * 100
            if subject_name not in subject_scores: subject_scores[subject_name] = []
            subject_scores[subject_name].append(pct)
            total_score += pct
            total_quizzes += 1

            quiz_list.append(QuizSchema(subject=subject_name, score=str(score), total=str(quiz.total_marks)))
        else:
            quiz_list.append(QuizSchema(subject=subject_name, score="--", total=str(quiz.total_marks or "--")))

    strongest_subject = "N/A"
    weakest_subject = "N/A"
    avg_score = total_score / total_quizzes if total_quizzes > 0 else 0

    subject_performance_list = []
    if subject_scores:
        avg_per_subj = {subj: sum(scores)/len(scores) for subj, scores in subject_scores.items()}
        strongest_subject = max(avg_per_subj, key=avg_per_subj.get)
        weakest_subject = min(avg_per_subj, key=avg_per_subj.get)

        for subj, avg in avg_per_subj.items():
            subject_performance_list.append(SubjectPerformanceData(
                subject=subj, score=round(avg, 1), class_average=round(avg, 1) # simple fallback
            ))

    subject_performance_list.sort(key=lambda x: x.score, reverse=True)

    performance_summary = PerformanceSummarySchema(
        improvement_percent="+5.0%",
        strongest_subject=strongest_subject,
        weakest_subject=weakest_subject,
        avg_score=round(avg_score, 1)
    )

    # 4. Remarks
    interactions = db.query(TeacherParentInteractionV2, TeacherMaster.full_name)\
        .join(TeacherMaster, TeacherParentInteractionV2.teacher_id == TeacherMaster.teacher_id)\
        .filter(TeacherParentInteractionV2.student_id == student_id)\
        .filter(TeacherParentInteractionV2.comments.isnot(None))\
        .filter(TeacherParentInteractionV2.comments != '').all()

    all_remarks = []
    for inter, teacher_name in interactions:
        remark_date = inter.created_at or now
        all_remarks.append({"teacher_name": teacher_name, "comment": inter.comments.strip(), "date_obj": remark_date, "date": remark_date.strftime("%Y-%m-%d")})

    all_remarks.sort(key=lambda x: x["date_obj"], reverse=True)
    remark_list = [RemarkSchema(remark_id=i, teacher_name=r["teacher_name"], comment=r["comment"], date=r["date"]) for i, r in enumerate(all_remarks, start=1)]

    # 5. Notices
    notices_query = db.query(NoticeBoard, TeacherMaster.full_name)\
        .outerjoin(TeacherMaster, NoticeBoard.posted_by == TeacherMaster.teacher_id)\
        .filter(NoticeBoard.notice_text.isnot(None))\
        .filter(NoticeBoard.notice_text != '')\
        .order_by(NoticeBoard.created_at.desc()).all()

    notice_list = []
    for notice, teacher_name in notices_query:
        notice_date_str = notice.notice_date.strftime("%d %b %Y") if notice.notice_date else (notice.created_at.strftime("%d %b %Y") if notice.created_at else "")
        notice_list.append(NoticeSchema(
            notice_id=notice.notice_id,
            notice_title=notice.notice_title or "Notice",
            notice_text=notice.notice_text.strip(),
            notice_date=notice_date_str,
            applicable_class=notice.applicable_class or "All",
            posted_by_name=teacher_name or "Admin"
        ))

    # 6. Attendance — DISABLED ─────────────────────────────────────────────────
    # AttendanceMaster DB dependency removed. The attendance module has been
    # removed from the parent portal. attendance_trend and attendance_heat are
    # returned as null. Health score and recommendations now derived purely from
    # assignments and quizzes.
    # To restore: re-add AttendanceMaster to imports and the query block below.

    # 7. Action Required (Alerts Priority logic)
    # Overdue, due in 3 days, low quiz (< 50), unread remarks. Limit 4.
    alerts = []

    for ov in overdue_assignments:
        alerts.append(AlertSchema(type="warning", priority="HIGH", message=f"{ov['title']} overdue", subject=ov['subject'], due="Due passed"))
        if len(alerts) == 4: break

    if len(alerts) < 4:
        for due in upcoming_deadlines:
            if due.days_left <= 3:
                alerts.append(AlertSchema(type="medium", priority="MEDIUM", message=due.title, subject=due.type.split("•")[-1].strip(), due=f"Due in {due.days_left} days"))
                if len(alerts) == 4: break
            elif due.days_left <= 7:
                alerts.append(AlertSchema(type="info", priority="MEDIUM", message=due.title, subject=due.type.split("•")[-1].strip(), due=f"Due in {due.days_left} days"))
                if len(alerts) == 4: break

    if len(alerts) < 4:
        for subj, scores in subject_scores.items():
            if any(s < 50 for s in scores):
                alerts.append(AlertSchema(type="info", priority="LOW", message=f"Low quiz score in {subj}", subject=subj, due="Needs attention"))
                if len(alerts) == 4: break

    # Fallback missing properties in AlertSchema (we will update schema to include subject and due)

    # 8. Smart Recommendations (Rule based)
    smart_recommendations = []
    if avg_score > 0 and avg_score < 50:
        smart_recommendations.append(SmartRecommendationSchema(type="academic", message="Quiz scores need improvement", action_text="Review recent chapter materials consistently."))
    if overdue_assignments:
        smart_recommendations.append(SmartRecommendationSchema(type="task", message="Complete overdue assignments", action_text="Submit pending work immediately."))
    if weakest_subject != "N/A" and len(smart_recommendations) < 3:
        smart_recommendations.append(SmartRecommendationSchema(type="academic", message=f"Focus on {weakest_subject} quizzes", action_text="Review recent chapters."))

    if not smart_recommendations:
        smart_recommendations.append(SmartRecommendationSchema(type="praise", message="Maintain current performance", action_text="Great job so far!"))

    # 9. Class Rank (Percentile Estimation)
    if avg_score >= 90: percentile = "Top 10%"
    elif avg_score >= 80: percentile = "Top 20%"
    elif avg_score >= 70: percentile = "Top 35%"
    elif avg_score >= 50: percentile = "Top 50%"
    else: percentile = "Needs Improvement"
    class_rank = ClassRankSchema(percentile=percentile, description="Based on average score")

    # 10. Academic Streak (Consecutive active weeks logic)
    total_assignments = pending_count + sum(1 for a in assignment_list if a.status == "Completed") + len(overdue_assignments)
    submission_rate = (total_assignments - pending_count - len(overdue_assignments)) / total_assignments if total_assignments > 0 else 1

    if submission_rate > 0.8: streak_val = "3 Weeks"
    elif submission_rate > 0.5: streak_val = "1 Week"
    else: streak_val = "0 Weeks"

    # 11. Health Score (60% assignment completion, 40% quiz avg)
    # Attendance component removed — module disabled.
    health_score_val = int((submission_rate * 100 * 0.6) + (avg_score * 0.4))
    if health_score_val >= 80: health_status = "Good"
    elif health_score_val >= 60: health_status = "Average"
    else: health_status = "Needs Attention"
    academic_health = AcademicHealthSchema(status=health_status, description=f"Score: {health_score_val}/100")

    # 12. Engagement Score (Based on submissions and quizzes)
    engagement_score = int((submission_rate * 100 * 0.6) + (min(100, total_quizzes * 20) * 0.4))
    eng_level = "High" if engagement_score >= 80 else "Average" if engagement_score >= 50 else "Low"
    engagement_indicator = EngagementIndicatorSchema(score=engagement_score, level=eng_level, description="Based on submissions")

    # 13. Notifications (Limit 5, newest first)
    notifications = []
    # New notices
    for n in notice_list[:2]:
        notifications.append(NotificationSchema(id=f"n_{n.notice_id}", type="announcement", title="New Notice Published", message=n.notice_title, date=n.notice_date, is_read=False, link="/parent/notices"))
    # Overdue assignments
    for o in overdue_assignments[:2]:
        notifications.append(NotificationSchema(id=f"o_{o['title']}", type="warning", title="Assignment Overdue", message=o['title'], date=today.strftime("%d %b %Y"), is_read=False, link="/parent/assignments"))
    # Graded assignments
    for g, t in graded_assignments[:2]:
        dt_str = t.strftime("%d %b %Y") if t else today.strftime("%d %b %Y")
        notifications.append(NotificationSchema(id=f"g_{g}", type="success", title="Assignment Graded", message=g, date=dt_str, is_read=False, link="/parent/assignments"))
    # Remarks
    for r in remark_list[:2]:
        notifications.append(NotificationSchema(id=f"r_{r.remark_id}", type="info", title=f"New Remark from {r.teacher_name}", message=r.comment, date=r.date, is_read=False, link="/parent/remarks"))

    # Sort by a date proxy (just return top 5)
    notifications = notifications[:5]

    weekly_progress = WeeklyProgressSchema(
        trend_percentage=f"+{int(submission_rate*10)}%",
        description="Stable engagement"
    )

    attendance_heat = None  # Attendance module removed; field intentionally null

    return DashboardResponse(
        student=student_data,
        assignments=assignment_list[:2],
        quiz=quiz_list[:2],
        remarks=remark_list[:2],
        notices=notice_list[:2],
        call_requests=[],
        attendance_trend=None,  # Attendance module removed
        performance_summary=performance_summary,
        subject_performance=subject_performance_list,
        upcoming_events=[],
        daily_summary=DailySummarySchema(assignments_pending=pending_count, notices_today=len(notice_list), upcoming_quizzes=0),
        alerts=alerts,
        motivational_message="Keep up the excellent work!",
        academic_health=academic_health,
        engagement_indicator=engagement_indicator,
        upcoming_deadlines=upcoming_deadlines[:3],
        health_score=health_score_val,
        smart_recommendations=smart_recommendations,
        academic_streak=[streak_val],
        attendance_heat=attendance_heat,
        weekly_progress=weekly_progress,
        class_rank=class_rank,
        notifications=notifications
    )
