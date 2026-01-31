"""Database initialization - automatically creates required database tables on startup."""

from app.db.session import db_session_factory


def ensure_task_event_columns(cursor):
    """Ensure task_event table has all required columns, adding any missing ones."""
    # Check what columns currently exist
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'task_event'
    """)
    existing_columns = {row[0] for row in cursor.fetchall()}
    
    # Check if we have old schema (score column exists)
    has_score = 'score' in existing_columns
    has_outcome = 'outcome' in existing_columns
    has_notes = 'notes' in existing_columns
    
    # Add missing columns
    if not has_outcome:
        if has_score:
            # Migrate from score to outcome
            cursor.execute("""
                ALTER TABLE task_event 
                ADD COLUMN outcome TEXT DEFAULT 'completed'
            """)
            # Convert score to outcome
            cursor.execute("""
                UPDATE task_event 
                SET outcome = CASE 
                    WHEN score >= 8 THEN 'completed'
                    WHEN score >= 5 THEN 'adapted'
                    ELSE 'learned'
                END
                WHERE outcome IS NULL OR outcome = 'completed'
            """)
        else:
            # Just add the column with default
            cursor.execute("""
                ALTER TABLE task_event 
                ADD COLUMN outcome TEXT NOT NULL DEFAULT 'completed'
            """)
    
    if not has_notes:
        cursor.execute("""
            ALTER TABLE task_event 
            ADD COLUMN notes TEXT
        """)
    
    # Drop old score column if it exists
    if has_score:
        cursor.execute("""
            ALTER TABLE task_event 
            DROP COLUMN IF EXISTS score
        """)
    
    return True


def init_database():
    """Create all required database tables if they don't exist."""
    conn = db_session_factory()
    cursor = conn.cursor()

    # Create usage_event table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usage_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            prompt_tokens INTEGER NOT NULL,
            completion_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            byo_api_key BOOLEAN NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # Create alert_event table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alert_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            acknowledged_at TIMESTAMPTZ
        )
    """)

    # Check if task_event table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'task_event'
        )
    """)
    table_exists = cursor.fetchone()[0]
    
    if table_exists:
        # Migrate/ensure columns
        ensure_task_event_columns(cursor)
    else:
        # Create task table with new schema
        cursor.execute("""
            CREATE TABLE task_event (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL,
                date DATE NOT NULL,
                name TEXT NOT NULL,
                task_type TEXT NOT NULL,
                outcome TEXT NOT NULL DEFAULT 'completed',
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

    # Create indexes for common queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_event_user_id
        ON usage_event(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_alert_event_user_id
        ON alert_event(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_alert_event_created_at
        ON alert_event(created_at DESC)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_task_event_user_id
        ON task_event(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_task_event_created_at
        ON task_event(created_at DESC)
    """)

    conn.commit()
    cursor.close()
    conn.close()


def drop_tables():
    """Drop all application tables (use for full reset)."""
    conn = db_session_factory()
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS usage_event CASCADE")
    cursor.execute("DROP TABLE IF EXISTS alert_event CASCADE")
    cursor.execute("DROP TABLE IF EXISTS task_event CASCADE")

    conn.commit()
    cursor.close()
    conn.close()
