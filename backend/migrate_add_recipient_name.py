"""
migrate_add_recipient_name.py
─────────────────────────────
One-time migration: adds the recipient_name column to the support_tickets table.

USAGE
─────
Run once, manually, in any environment where the column is missing:

    python migrate_add_recipient_name.py

Safe to re-run: checks whether the column already exists before issuing any DDL.

DO NOT import or call this from main.py or any application code.
Schema changes must not run automatically on application startup.

ENVIRONMENTS
────────────
Production (DB_TABLE_PREFIX="sgs_")  → targets sgs_support_tickets
Local dev  (DB_TABLE_PREFIX="")      → targets support_tickets

The column already exists in production (applied via the temporary ownership
workaround). Running this script there will detect that and exit cleanly
without touching the database.
"""

import os
import sys
import logging

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:1234@localhost:5432/mydb_sgs")
DB_PREFIX    = os.getenv("DB_TABLE_PREFIX", "")

TABLE_NAME  = f"{DB_PREFIX}support_tickets"
COLUMN_NAME = "recipient_name"


def column_exists(conn) -> bool:
    """
    Check information_schema.columns — requires only SELECT privilege, not ownership.
    Works with both prefixed (sgs_) and unprefixed table names.
    """
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' "
            "  AND table_name   = :table "
            "  AND column_name  = :col "
            "LIMIT 1"
        ),
        {"table": TABLE_NAME, "col": COLUMN_NAME},
    ).fetchone()
    return row is not None


def main() -> int:
    log.info("=" * 60)
    log.info("  Migration: add %s.%s", TABLE_NAME, COLUMN_NAME)
    log.info("  DB_TABLE_PREFIX : %r", DB_PREFIX or "(none — local dev)")
    log.info("=" * 60)

    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        if column_exists(conn):
            log.info("  ✓  Column '%s' already exists in '%s'.", COLUMN_NAME, TABLE_NAME)
            log.info("  Nothing to do. Exiting.")
            return 0

        log.info("  Column '%s' not found — adding it now ...", COLUMN_NAME)
        conn.execute(
            text(f"ALTER TABLE {TABLE_NAME} ADD COLUMN {COLUMN_NAME} VARCHAR")
        )
        conn.commit()
        log.info("  ✓  Column '%s' added successfully to '%s'.", COLUMN_NAME, TABLE_NAME)

    log.info("=" * 60)
    log.info("  Migration complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
