"""Database initialization - automatically creates required tables on startup."""

from app.db.session import db_session_factory


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

    # Create task table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            date DATE NOT NULL,
            name TEXT NOT NULL,
            score NUMERIC(4, 1) NOT NULL,
            task_type TEXT NOT NULL,
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
