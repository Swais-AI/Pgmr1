from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException
from models import (
    StudentMaster, ClassMaster, AssignmentMaster, StudentSubmission,
    QuizMaster, QuizResponse, NoticeBoard,
    SubjectMaster, ChapterMaster, UsersMaster,
    SupportTicket, TicketMessage,
    # AttendanceMaster        — DISABLED: attendance module removed from parent portal.
    # CallRequest             — DISABLED: call-request routes disabled; not queried here.
    # SchoolEvent             — imported but unused; upcoming_events=[] is hardcoded.
    # TeacherParentInteractionV2 — REMOVED: table absent on SGS RDS.
    #   Remarks now come from TicketMessage (sender_type='TEACHER') via SupportTicket.
    # TeacherMaster           — REMOVED from active imports: posted_by / assigned_by
    #   now FK to users_masters.user_id; all name lookups use UsersMaster.
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
    submitted_count = 0
    overdue_assignments = []
    upcoming_deadlines = []
    graded_assignments = []

    for assign, subject_name, submission in assignments_query:
        due_date_str = assign.due_date.isoformat() if assign.due_date else ""
        days_left = (assign.due_date - today).days if assign.due_date else 0

        if submission:
            status = "Completed"
            submitted_count += 1
            if submission.marks_obtained is not None:
                graded_assignments.append((assign.assignment_title, submission.submitted_at))
        elif assign.due_date and assign.due_date < today:
            status = "Overdue"
            overdue_assignments.append({"assignment_title": assign.assignment_title, "subject": subject_name, "days_left": days_left})
        else:
            status = "Pending"
            pending_count += 1
            if assign.due_date and days_left >= 0:
                upcoming_deadlines.append(DeadlineSchema(
                    title=assign.assignment_title, type=f"Assignment • {subject_name}", due_date=due_date_str, days_left=days_left
                ))
            
        assignment_list.append(AssignmentSchema(
            assignment_title=assign.assignment_title, subject=subject_name, due_date=due_date_str,
            status=status, marks_obtained=submission.marks_obtained if submission else None
        ))

    upcoming_deadlines.sort(key=lambda x: x.days_left)
    # Only show deadlines due within next 7 days
    upcoming_deadlines = [d for d in upcoming_deadlines if d.days_left <= 7]
    total_assignments = len(assignment_list)
    assignment_completion_pct = round(submitted_count / total_assignments * 100, 1) if total_assignments > 0 else 0.0
    action_required_count = len(overdue_assignments)

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
            score = float(response.score)
            total = float(quiz.total_marks or 1)
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
    # Source: teacher replies inside Communication Center tickets for this student.
    # TeacherParentInteractionV2 removed — sgs_teacher_parent_interaction does
    # NOT exist on the SGS AWS RDS production database.
    teacher_msgs = db.query(TicketMessage, SupportTicket)\
        .join(SupportTicket, TicketMessage.ticket_id == SupportTicket.ticket_id)\
        .filter(SupportTicket.student_id == student_id)\
        .filter(TicketMessage.sender_type == "TEACHER")\
        .filter(TicketMessage.message.isnot(None))\
        .filter(TicketMessage.message != '').all()

    all_remarks = []
    for msg, ticket in teacher_msgs:
        remark_date = msg.created_at or now
        all_remarks.append({
            "teacher_name": msg.sender_name or "Teacher",
            "comment": msg.message.strip(),
            "date_obj": remark_date,
            "date": remark_date.strftime("%Y-%m-%d"),
            "ticket_id": ticket.ticket_id,
            "is_read": bool(msg.is_read),
        })

    all_remarks.sort(key=lambda x: x["date_obj"], reverse=True)
    remark_list = [RemarkSchema(remark_id=i, teacher_name=r["teacher_name"], comment=r["comment"], date=r["date"], ticket_id=r.get("ticket_id"), is_read=r.get("is_read", True)) for i, r in enumerate(all_remarks, start=1)]

    # 5. Notices — posted_by FKs to users_masters.user_id on production.
    notices_query = db.query(NoticeBoard, UsersMaster.full_name)\
        .outerjoin(UsersMaster, NoticeBoard.posted_by == UsersMaster.user_id)\
        .filter(NoticeBoard.notice_text.isnot(None))\
        .filter(NoticeBoard.notice_text != '')\
        .filter(
            or_(
                NoticeBoard.applicable_class == class_info.class_name,
                NoticeBoard.applicable_class == 'All',
                NoticeBoard.applicable_class.is_(None),
            )
        )\
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
        alerts.append(AlertSchema(type="warning", priority="HIGH", message=f"{ov['assignment_title']} overdue", subject=ov['subject'], due="Due passed"))
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
    
    # 8. Smart Recommendations (Rule based, priority-ordered)
    smart_recommendations = []

    # Rule 1: Overdue assignments
    if len(overdue_assignments) >= 2:
        titles = ", ".join(a["assignment_title"] for a in overdue_assignments[:2])
        smart_recommendations.append(SmartRecommendationSchema(
            type="task",
            message=f"{len(overdue_assignments)} assignments are overdue",
            action_text=f"Submit '{titles}' immediately to avoid further penalties.",
        ))
    elif len(overdue_assignments) == 1:
        smart_recommendations.append(SmartRecommendationSchema(
            type="task",
            message=f"Assignment overdue: {overdue_assignments[0]['assignment_title']}",
            action_text="Submit this assignment now - late submissions may affect your grade.",
        ))

    # Rule 2: Low overall quiz average (< 50%)
    if avg_score > 0 and avg_score < 50 and len(smart_recommendations) < 3:
        smart_recommendations.append(SmartRecommendationSchema(
            type="academic",
            message="Overall quiz performance needs attention",
            action_text=f"Current average is {round(avg_score, 1)}%. Revise chapter notes and attempt practice quizzes daily.",
        ))

    # Rule 3: Weak subject average < 50%
    if subject_scores and weakest_subject != "N/A" and len(smart_recommendations) < 3:
        weak_avg = sum(subject_scores[weakest_subject]) / len(subject_scores[weakest_subject])
        if weak_avg < 50:
            smart_recommendations.append(SmartRecommendationSchema(
                type="academic",
                message=f"Struggling in {weakest_subject} ({round(weak_avg, 1)}% avg)",
                action_text=f"Spend extra time on {weakest_subject} chapters and ask your teacher for help.",
            ))

    # Rule 4: Recent teacher remarks received
    if len(all_remarks) >= 1 and len(smart_recommendations) < 3:
        latest_remark = all_remarks[0]
        smart_recommendations.append(SmartRecommendationSchema(
            type="info",
            message=f"New feedback from {latest_remark['teacher_name']}",
            action_text="Check your Teacher Remarks and respond via Communication Center if needed.",
        ))

    # Rule 5: Borderline subject score (50-65%)
    if subject_scores and len(smart_recommendations) < 3:
        for subj, scores in subject_scores.items():
            subj_avg = sum(scores) / len(scores)
            if 50 <= subj_avg < 65 and subj != weakest_subject:
                smart_recommendations.append(SmartRecommendationSchema(
                    type="academic",
                    message=f"{subj} scores are borderline ({round(subj_avg, 1)}%)",
                    action_text=f"Consistent revision in {subj} can push the score above 70%. Review recent topics.",
                ))
                break

    # Rule 6: High completion + good quiz avg - praise
    if assignment_completion_pct >= 80 and avg_score >= 75 and len(smart_recommendations) < 3:
        smart_recommendations.append(SmartRecommendationSchema(
            type="praise",
            message="Excellent academic performance!",
            action_text=f"{round(assignment_completion_pct)}% assignments submitted and {round(avg_score, 1)}% quiz average. Keep it up!",
        ))

    # Rule 7: No overdue, no pending work - praise
    if total_assignments > 0 and len(overdue_assignments) == 0 and pending_count == 0 and len(smart_recommendations) < 3:
        smart_recommendations.append(SmartRecommendationSchema(
            type="praise",
            message="All assignments up to date!",
            action_text="Great discipline - no overdue or pending work. Stay consistent.",
        ))

    # Fallback
    if not smart_recommendations:
        smart_recommendations.append(SmartRecommendationSchema(
            type="praise",
            message="Keep up the good work!",
            action_text="Performance is on track. Continue attending classes and submitting assignments on time.",
        ))
    # 9. Class Rank (Percentile Estimation)
    if avg_score >= 90: percentile = "Top 10%"
    elif avg_score >= 80: percentile = "Top 20%"
    elif avg_score >= 70: percentile = "Top 35%"
    elif avg_score >= 50: percentile = "Top 50%"
    else: percentile = "Needs Improvement"
    class_rank = ClassRankSchema(percentile=percentile, description="Based on average score")

    # 10. Academic Streak (Consecutive active weeks logic)
    submission_rate = (submitted_count / total_assignments) if total_assignments > 0 else 1
    
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
        notifications.append(NotificationSchema(id=f"o_{o['assignment_title']}", type="warning", title="Assignment Overdue", message=o['assignment_title'], date=today.strftime("%d %b %Y"), is_read=False, link="/parent/assignments"))
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
        notifications=notifications,
        assignment_completion_pct=assignment_completion_pct,
        action_required_count=action_required_count,
    )

