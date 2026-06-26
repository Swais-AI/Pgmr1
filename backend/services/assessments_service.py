"""
Assessments service — single JOIN, no N+1.

Data flow:
  sgs_assessment_results
      → sgs_assessments       (title, type, date, max_marks, chapter FK)
      → sgs_chapter_master    (chapter_name)
      → sgs_subject_master    (subject_name)
      → sgs_teacher_master    (teacher full_name)

Both history and analytics derive their data from _fetch_rows() so the DB
is queried exactly once per request.
"""
from sqlalchemy.orm import Session
from models import AssessmentResult, Assessment, ChapterMaster, SubjectMaster, TeacherMaster
import logging

logger = logging.getLogger(__name__)

_BADGES = [
    (85, "Excellent"),
    (70, "Good"),
    (50, "Average"),
    (0,  "Needs Improvement"),
]


def _badge(pct: float) -> str:
    for threshold, label in _BADGES:
        if pct >= threshold:
            return label
    return "Needs Improvement"


def _fmt_date(d) -> str:
    if not d:
        return "—"
    try:
        return d.strftime("%d %b %Y")
    except Exception:
        return str(d)


def _iso_date(d) -> str:
    if not d:
        return ""
    try:
        return d.strftime("%Y-%m-%d")
    except Exception:
        return ""


def _fetch_rows(db: Session, student_id: int):
    """
    Single JOIN query — returns all non-absent assessment results for the
    student, ordered newest-first.  Shared by both get_history and get_analytics.
    """
    return (
        db.query(
            AssessmentResult,
            Assessment.title,
            Assessment.assessment_type,
            Assessment.assessment_date,
            Assessment.max_marks,
            Assessment.chapter.label("denorm_chapter"),
            ChapterMaster.chapter_name,
            SubjectMaster.subject_name,
            TeacherMaster.full_name.label("teacher_name"),
        )
        .join(Assessment, AssessmentResult.assessment_id == Assessment.assessment_id)
        .outerjoin(ChapterMaster, Assessment.chapter_id == ChapterMaster.chapter_id)
        .outerjoin(SubjectMaster, ChapterMaster.subject_id == SubjectMaster.subject_id)
        .outerjoin(TeacherMaster, Assessment.teacher_id == TeacherMaster.teacher_id)
        .filter(AssessmentResult.student_id == student_id)
        .filter(AssessmentResult.is_absent.isnot(True))
        .order_by(Assessment.assessment_date.desc())
        .all()
    )


def get_history(db: Session, student_id: int) -> list:
    rows = _fetch_rows(db, student_id)
    logger.info("[assessments] history student_id=%s rows=%d", student_id, len(rows))

    out = []
    for (ar, title, a_type, a_date, max_marks,
         denorm_chapter, ch_name, subj_name, teacher_name) in rows:

        pct = float(ar.percentage) if ar.percentage is not None else 0.0
        out.append({
            "result_id":        ar.result_id,
            "assessment_id":    ar.assessment_id,
            "title":            title or "—",
            "assessment_type":  a_type or "—",
            "subject":          subj_name or "—",
            "chapter_name":     ch_name or denorm_chapter or "—",
            "teacher_name":     teacher_name or "—",
            "assessment_date":  _fmt_date(a_date),
            "date_iso":         _iso_date(a_date),
            "marks_obtained":   float(ar.marks_obtained) if ar.marks_obtained is not None else 0.0,
            "max_marks":        float(max_marks) if max_marks is not None else 0.0,
            "percentage":       round(pct, 2),
            "performance_badge": _badge(pct),
        })
    return out


def get_analytics(db: Session, student_id: int) -> dict:
    rows = _fetch_rows(db, student_id)

    if not rows:
        return {
            "total_assessments":  0,
            "average_percentage": 0.0,
            "highest_score":      0.0,
            "lowest_score":       0.0,
            "trend_data":         [],
            "subject_data":       [],
            "subjects":           [],
        }

    percentages: list = []
    trend_data:  list = []
    subject_map: dict = {}
    subjects_set: set = set()

    # Iterate oldest → newest for the trend chart (DB returns newest → oldest)
    for (ar, title, a_type, a_date, max_marks,
         denorm_chapter, ch_name, subj_name, teacher_name) in reversed(rows):

        pct = float(ar.percentage) if ar.percentage is not None else 0.0
        percentages.append(pct)

        trend_data.append({
            "date":       _fmt_date(a_date),
            "percentage": round(pct, 2),
            "label":      a_date.strftime("%d %b") if a_date else "—",
        })

        subj = subj_name or "—"
        subjects_set.add(subj)
        subject_map.setdefault(subj, []).append(pct)

    subject_data = sorted(
        [
            {"subject": s, "avg_percentage": round(sum(v) / len(v), 2)}
            for s, v in subject_map.items()
        ],
        key=lambda x: x["subject"],
    )

    return {
        "total_assessments":  len(percentages),
        "average_percentage": round(sum(percentages) / len(percentages), 2),
        "highest_score":      round(max(percentages), 2),
        "lowest_score":       round(min(percentages), 2),
        "trend_data":         trend_data,
        "subject_data":       subject_data,
        "subjects":           sorted(subjects_set),
    }
