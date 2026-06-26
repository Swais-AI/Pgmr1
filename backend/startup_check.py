"""
startup_check.py — RDS Table Existence Validator
=================================================
Validates that every table the application actively queries exists in the
connected database before uvicorn starts serving traffic.

WHY THIS EXISTS
───────────────
When DB_TABLE_PREFIX="sgs_" the app targets the SGS AWS RDS instance.
Some tables that existed locally (e.g. teacher_parent_interaction) have
NO equivalent on RDS.  Rather than crashing mid-request with an obscure
psycopg2 "relation does not exist" error, this script lets the startup
sequence detect and report the problem immediately.

HOW TO USE
──────────
Option A — run before uvicorn (recommended in CI/deploy scripts):

    python startup_check.py
    # exits 0 on success, 1 on failure

Option B — import and call from main.py so the check runs automatically:

    from startup_check import run_startup_checks
    run_startup_checks()   # raises RuntimeError if a required table is missing

TABLES CHECKED
──────────────
Required tables (app will NOT start if any are absent):
    class_master, student_master, parent_master, parent_student_map,
    teacher_master, subject_master, chapter_master, assignment_master,
    student_submission, quiz_master, quiz_response, notice_board,
    support_tickets, ticket_messages

Legacy / optional tables (warning only — app continues):
    teacher_parent_interaction  — removed from SGS RDS; remarks now use
                                  ticket_messages with sender_type='TEACHER'
    attendance_master           — attendance module disabled in parent portal
    call_requests               — replaced by Communication Center
    leave_requests              — replaced by Communication Center
    school_events               — events feature not in current scope
    chat_threads, chat_messages — replaced by Communication Center
"""

import os
import sys
import logging

from sqlalchemy import text
from database import engine, DB_PREFIX

log = logging.getLogger(__name__)

# ── Table manifests ───────────────────────────────────────────────────────────

# The app will refuse to start if any of these are missing.
REQUIRED_TABLES = [
    "users_masters",        # FK root for teacher/staff — must exist before seeding
    "class_master",
    "student_master",
    "parent_master",
    "parent_student_map",
    "teacher_master",
    "subject_master",
    "chapter_master",
    "assignment_master",
    "student_submission",
    "quiz_master",
    "quiz_response",
    "notice_board",
    "support_tickets",
    "ticket_messages",
    "assessments",           # Assessments module — must exist before serving /assessments/
    "assessment_results",    # Assessments module — stores per-student results
]

# Missing legacy tables generate a WARNING but do NOT block startup.
LEGACY_TABLES = [
    "teacher_parent_interaction",   # absent on SGS RDS — remarks replaced
    "attendance_master",            # attendance module disabled
    "call_requests",                # replaced by Communication Center
    "leave_requests",               # replaced by Communication Center
    "school_events",                # events feature out of scope
    "chat_threads",                 # replaced by Communication Center
    "chat_messages",                # replaced by Communication Center
]


def _existing_tables(schema: str = "public") -> set:
    """
    Return the set of table names that currently exist in *schema*.

    Uses information_schema.tables so this works on PostgreSQL regardless
    of DB_PREFIX — we pass the bare (un-prefixed) name to information_schema
    and prefix it ourselves when querying.
    """
    sql = text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = :schema AND table_type = 'BASE TABLE'"
    )
    with engine.connect() as conn:
        rows = conn.execute(sql, {"schema": schema}).fetchall()
    return {row[0] for row in rows}


def run_startup_checks(raise_on_error: bool = True) -> bool:
    """
    Validate that all required tables exist in the connected database.

    Parameters
    ----------
    raise_on_error : bool
        If True (default) raise RuntimeError when required tables are absent.
        Set to False to get a boolean return value instead (useful for tests).

    Returns
    -------
    bool
        True  — all required tables present (startup is safe)
        False — one or more required tables missing (only when raise_on_error=False)

    Raises
    ------
    RuntimeError
        When raise_on_error=True and at least one required table is missing.
    """
    db_url_hint = os.getenv("DATABASE_URL", "local PostgreSQL")
    prefix      = DB_PREFIX or "(no prefix)"

    log.info("=" * 60)
    log.info("  Startup table check")
    log.info("  Database  : %s", db_url_hint)
    log.info("  Prefix    : %s", prefix)
    log.info("=" * 60)

    existing = _existing_tables()

    # ── Required tables ───────────────────────────────────────────────────
    missing_required = []
    for bare_name in REQUIRED_TABLES:
        physical = f"{DB_PREFIX}{bare_name}"
        if physical in existing:
            log.info("  ✓  %-40s  OK", physical)
        else:
            log.error("  ✗  %-40s  MISSING", physical)
            missing_required.append(physical)

    # ── Legacy / optional tables ─────────────────────────────────────────
    for bare_name in LEGACY_TABLES:
        physical = f"{DB_PREFIX}{bare_name}"
        if physical in existing:
            log.warning(
                "  ⚠  %-40s  present (legacy — not actively queried)",
                physical,
            )
        else:
            log.info(
                "  –  %-40s  absent  (legacy — expected on RDS)",
                physical,
            )

    log.info("=" * 60)

    if missing_required:
        msg = (
            f"Startup check FAILED — {len(missing_required)} required table(s) "
            f"not found in the database:\n  " +
            "\n  ".join(missing_required) +
            "\n\nEnsure the correct DB_TABLE_PREFIX is set and the migration "
            "scripts have been applied."
        )
        log.error(msg)
        if raise_on_error:
            raise RuntimeError(msg)
        return False

    log.info("  All required tables are present. Startup is safe.")
    return True


# ── Standalone entry point ────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
    )
    ok = run_startup_checks(raise_on_error=False)
    sys.exit(0 if ok else 1)
