#!/usr/bin/env python3
"""Reset database - drops and recreates all tables."""

import sys
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()

from app.db.session import db_session_factory
from app.db.init import init_database


def reset_database():
    """Drop all tables and recreate them."""
    conn = db_session_factory()
    cursor = conn.cursor()

    print("Dropping existing tables...")

    # Drop application tables
    cursor.execute("DROP TABLE IF EXISTS usage_event CASCADE")
    cursor.execute("DROP TABLE IF EXISTS alert_event CASCADE")

    # Drop Memori tables (they follow memori_* pattern)
    cursor.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE tablename LIKE 'memori_%')
            LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
    """)

    conn.commit()
    cursor.close()
    conn.close()

    print("Creating tables...")
    init_database()

    # Recreate Memori tables
    from memori import Memori
    Memori(conn=db_session_factory).config.storage.build()

    print("Database reset complete!")


if __name__ == "__main__":
    reset_database()
