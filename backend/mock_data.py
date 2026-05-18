import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from models import (
    ClassMaster, StudentMaster, TeacherMaster, SubjectMaster,
    ChapterMaster, AssignmentMaster, StudentSubmission, QuizMaster,
    QuizResponse, NoticeBoard, TeacherParentInteractionV2,
    ParentMaster, ParentStudentMap,
    # Legacy models below are commented out in models.py (excluded from DB creation):
    # CallRequest, AttendanceMaster, SchoolEvent, ChatThread, ChatMessage, LeaveRequest
)

def seed_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Classes & Sections
        classes_data = [
            ("10th Grade", "A"), ("10th Grade", "B"), ("9th Grade", "A"),
            ("8th Grade", "A"), ("7th Grade", "A")
        ]
        classes = []
        for cname, sec in classes_data:
            c = ClassMaster(class_name=cname, section_name=sec, academic_year="2025-26")
            db.add(c)
            classes.append(c)
        db.commit()

        # 2. Parents
        p_priya = ParentMaster(full_name="Priya Sharma", email="priya@example.com", phone="9876543210")
        p_rahul = ParentMaster(full_name="Rahul Sharma", email="rahul@example.com", phone="9988776655")
        p_amit = ParentMaster(full_name="Amit Singh", email="amit@example.com", phone="9123456789")
        db.add_all([p_priya, p_rahul, p_amit])
        db.commit()

        # 3. Students
        s_rohit = StudentMaster(full_name="Rohit Sharma", class_id=classes[0].class_id, section="A", roll_no="12")
        s_riya = StudentMaster(full_name="Riya Sharma", class_id=classes[2].class_id, section="A", roll_no="25")
        s_aryan = StudentMaster(full_name="Aryan Sharma", class_id=classes[3].class_id, section="A", roll_no="5")

        s_jane = StudentMaster(full_name="Jane Singh", class_id=classes[0].class_id, section="A", roll_no="14")
        s_bob = StudentMaster(full_name="Bob Singh", class_id=classes[1].class_id, section="B", roll_no="2")

        db.add_all([s_rohit, s_riya, s_aryan, s_jane, s_bob])
        db.commit()

        # Mappings
        # Priya (parent 1) has 3 children
        pm1 = ParentStudentMap(parent_id=p_priya.parent_id, student_id=s_rohit.student_id, relationship_type="mother")
        pm2 = ParentStudentMap(parent_id=p_priya.parent_id, student_id=s_riya.student_id, relationship_type="mother")
        pm3 = ParentStudentMap(parent_id=p_priya.parent_id, student_id=s_aryan.student_id, relationship_type="mother")
        # Rahul (parent 2) also linked to Rohit (child linked to both mother and father)
        pm4 = ParentStudentMap(parent_id=p_rahul.parent_id, student_id=s_rohit.student_id, relationship_type="father")
        # Amit (parent 3) has 2 children
        pm5 = ParentStudentMap(parent_id=p_amit.parent_id, student_id=s_jane.student_id, relationship_type="father")
        pm6 = ParentStudentMap(parent_id=p_amit.parent_id, student_id=s_bob.student_id, relationship_type="father")
        db.add_all([pm1, pm2, pm3, pm4, pm5, pm6])
        db.commit()

        # 4. Teachers
        teachers_data = ["Mrs. Anjali Verma", "Mr. Rahul Mehta", "Miss Kavita Roy", "Mr. Suresh Kumar", "Mrs. Sunita Devi"]
        teachers = []
        for tname in teachers_data:
            t = TeacherMaster(full_name=tname, email=f"{tname.split()[1].lower()}@example.com", phone=f"98765{random.randint(10000, 99999)}")
            db.add(t)
            teachers.append(t)
        db.commit()

        # 5. Subjects & Chapters
        subjects = []
        chapters = []
        for c in classes:
            sub1 = SubjectMaster(class_id=c.class_id, subject_name="Mathematics", teacher_id=teachers[0].teacher_id)
            sub2 = SubjectMaster(class_id=c.class_id, subject_name="Science", teacher_id=teachers[1].teacher_id)
            sub3 = SubjectMaster(class_id=c.class_id, subject_name="English", teacher_id=teachers[2].teacher_id)
            db.add_all([sub1, sub2, sub3])
            db.commit()
            subjects.extend([sub1, sub2, sub3])

            for sub in [sub1, sub2, sub3]:
                for i in range(1, 4):
                    ch = ChapterMaster(subject_id=sub.subject_id, chapter_name=f"{sub.subject_name} Chapter {i}", chapter_order=i)
                    db.add(ch)
                    chapters.append(ch)
            db.commit()

        # 6. Generate Massive Data
        today = datetime.now().date()
        all_students = [s_rohit, s_riya, s_aryan, s_jane, s_bob]

        # Notices (per class)
        notice_templates = [
            ("PTM Scheduled", "Parent-Teacher Meeting is scheduled for next week."),
            ("School Closed", "School will remain closed tomorrow due to heavy rain."),
            ("Fee Reminder", "Please submit the pending fees by end of this month."),
            ("Annual Day", "Annual Day celebrations will take place next month. Students interested in participation should contact their class teachers."),
            ("Exam Schedule", "Half-yearly examinations will begin from the 15th."),
            ("Sports Day", "Annual Sports Meet is scheduled. Don't forget your sports uniform."),
            ("Achievement", "Our school won the inter-school science fair!")
        ]

        for c in classes:
            for _ in range(15):
                ntitle, ncontent = random.choice(notice_templates)
                days_ago = random.randint(1, 150)
                n = NoticeBoard(notice_title=f"{ntitle} ({c.class_name})", notice_text=ncontent, applicable_class=c.class_name, notice_date=(datetime.now() - timedelta(days=days_ago)).date(), posted_by=random.choice(teachers).teacher_id)
                n.created_at = datetime.now() - timedelta(days=days_ago)
                db.add(n)
        db.commit()

        for s in all_students:
            student_class = next(c for c in classes if c.class_id == s.class_id)
            student_subjects = [sub for sub in subjects if sub.class_id == s.class_id]
            student_chapters = [ch for ch in chapters if ch.subject_id in [sub.subject_id for sub in student_subjects]]
            student_parents = db.query(ParentStudentMap).filter_by(student_id=s.student_id).all()

            # Assignments (20-30 per student)
            for _ in range(random.randint(20, 30)):
                ch = random.choice(student_chapters)
                sub = next(su for su in student_subjects if su.subject_id == ch.subject_id)
                t = next(te for te in teachers if te.teacher_id == sub.teacher_id)

                days_offset = random.randint(-120, 15) # Due dates from 4 months ago to 15 days in future
                due_date = today + timedelta(days=days_offset)

                a = AssignmentMaster(
                    chapter_id=ch.chapter_id,
                    title=f"{sub.subject_name} Assignment: {ch.chapter_name} Practice",
                    description="Complete all exercises at the end of the chapter.",
                    due_date=due_date,
                    assigned_by=t.teacher_id
                )
                db.add(a)
                db.commit()

                # Determine status
                if due_date > today:
                    status = random.choices(["pending", "completed"], weights=[0.7, 0.3])[0]
                else:
                    status = random.choices(["completed", "overdue"], weights=[0.85, 0.15])[0]

                if status == "completed":
                    subm_date = due_date - timedelta(days=random.randint(0, 3))
                    subm = StudentSubmission(
                        assignment_id=a.assignment_id,
                        student_id=s.student_id,
                        submission_text="Attached homework PDF.",
                        marks_obtained=round(random.uniform(5.0, 10.0), 1),
                        teacher_remarks=random.choice(["Excellent work!", "Good effort, but review Q3.", "Perfect submission.", ""])
                    )
                    subm.submitted_at = datetime.combine(subm_date, datetime.min.time())
                    db.add(subm)
            db.commit()

            # Quizzes (many per student)
            for _ in range(15):
                ch = random.choice(student_chapters)
                q = QuizMaster(chapter_id=ch.chapter_id, title=f"Pop Quiz on {ch.chapter_name}", total_marks=20.0, duration_minutes=30)
                db.add(q)
                db.commit()

                is_completed = random.choices([True, False], weights=[0.9, 0.1])[0]
                if is_completed:
                    score = round(random.uniform(5.0, 20.0), 1)
                    qr = QuizResponse(quiz_id=q.quiz_id, student_id=s.student_id, score=score, completed_flag=True)
                    db.add(qr)
            db.commit()

            # Remarks (15 per student)
            remark_templates = [
                ("shows good understanding in concepts. Keep practicing!", "positive"),
                ("is very active in class discussions.", "positive"),
                ("needs to focus more during mathematics lectures.", "improvement"),
                ("is missing multiple assignments. Please review the dashboard.", "warning"),
                ("has shown great improvement over the last month.", "positive"),
                ("should practice more algebra problems at home.", "improvement"),
                ("is displaying exceptional leadership skills.", "positive"),
                ("was involved in a minor disruption during class. Needs attention.", "warning")
            ]

            for _ in range(15):
                r_text, r_type = random.choice(remark_templates)
                t = random.choice(teachers)
                days_ago = random.randint(1, 150)

                tp = TeacherParentInteractionV2(
                    teacher_id=t.teacher_id,
                    student_id=s.student_id,
                    class_id=s.class_id,
                    section=s.section,
                    comments=f"{s.full_name.split()[0]} {r_text}"
                )
                tp.created_at = datetime.now() - timedelta(days=days_ago)
                db.add(tp)
            db.commit()

            # ── DISABLED: Call Requests seeding ──────────────────────────────────
            # CallRequest model commented out in models.py; table excluded from DB.
            # Restore by un-commenting models.py CallRequest class.
            # ──────────────────────────────────────────────────────────────────────

            # ── DISABLED: Attendance seeding ──────────────────────────────
            # Attendance module removed from parent portal. The attendance_master
            # table still exists but is no longer populated by the active app.
            # Uncomment to restore attendance seed data if the module is reinstated.
            #
            # for i in range(30):
            #     att_date = today - timedelta(days=i)
            #     if att_date.weekday() >= 5: continue
            #     status = random.choices(["Present", "Absent", "Late"], weights=[0.85, 0.1, 0.05])[0]
            #     db.add(AttendanceMaster(
            #         student_id=s.student_id, class_id=s.class_id,
            #         attendance_date=att_date, status=status, academic_year="2025-26"
            #     ))
            # db.commit()
            # ──────────────────────────────────────────────────────────────

            # ── DISABLED: Chat Threads & Messages seeding ─────────────────────────
            # ChatThread + ChatMessage models commented out in models.py.
            # Replaced by Communication Center (SupportTicket + TicketMessage).
            # Restore by un-commenting models.py ChatThread and ChatMessage classes.
            # ──────────────────────────────────────────────────────────────────────

        # ── DISABLED: Events seeding ──────────────────────────────────────────────
        # SchoolEvent model commented out in models.py; table excluded from DB.
        # Dashboard returns upcoming_events=[] (hardcoded empty list).
        # Restore by un-commenting models.py SchoolEvent class.
        # ──────────────────────────────────────────────────────────────────────────

        print("Large Database seeded successfully.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
