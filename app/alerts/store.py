from psycopg2.extras import Json
from app.db.session import db_session_factory

def store_alert(user_id: str, alert: dict):
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        insert into alert_event (
            user_id,
            alert_type,
            severity,
            title,
            message,
            metadata
        ) values (%s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            alert["alert_type"],
            alert["severity"],
            alert["title"],
            alert["message"],
            Json(alert["metadata"])
        )
    )
    conn.commit()
    cursor.close()
    conn.close()