import asyncio
import json
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db.session import db_session_factory
from app.infra.openai_client import get_openai_client

router = APIRouter()


@router.get("/alerts/{user_id}")
def get_alerts(user_id: str):
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        select
            id,
            alert_type,
            severity,
            title,
            message,
            metadata,
            created_at,
            acknowledged_at
        from alert_event
        where user_id = %s
        order by created_at desc
        """,
        (user_id,)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {
            "id": str(r[0]),
            "alert_type": r[1],
            "severity": r[2],
            "title": r[3],
            "message": r[4],
            "metadata": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "acknowledged_at": r[7].isoformat() if r[7] else None
        }
        for r in rows
    ]


@router.get("/alerts/{user_id}/stream")
async def stream_alerts(user_id: str):
    """Server-Sent Events endpoint for real-time alerts."""
    async def event_generator():
        last_check = datetime.now()
        seen_ids = set()

        # Send initial alerts
        initial_alerts = get_alerts(user_id)
        for alert in initial_alerts:
            seen_ids.add(alert["id"])

        yield f"data: {json.dumps({'type': 'connected', 'count': len(initial_alerts)})}\n\n"

        while True:
            await asyncio.sleep(5)  # Check every 5 seconds

            conn = db_session_factory()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, alert_type, severity, title, message, metadata, created_at
                FROM alert_event
                WHERE user_id = %s AND created_at > %s
                ORDER BY created_at DESC
                """,
                (user_id, last_check)
            )
            new_rows = cursor.fetchall()
            cursor.close()
            conn.close()

            for r in new_rows:
                alert_id = str(r[0])
                if alert_id not in seen_ids:
                    seen_ids.add(alert_id)
                    alert = {
                        "id": alert_id,
                        "alert_type": r[1],
                        "severity": r[2],
                        "title": r[3],
                        "message": r[4],
                        "metadata": r[5],
                        "created_at": r[6].isoformat() if r[6] else None
                    }
                    yield f"data: {json.dumps({'type': 'alert', 'alert': alert})}\n\n"

            last_check = datetime.now()

            # Send heartbeat to keep connection alive
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


class GenerateSuggestionsRequest(BaseModel):
    openai_api_key: str | None = None


@router.post("/alerts/{user_id}/generate")
async def generate_suggestions(user_id: str, request: GenerateSuggestionsRequest):
    """Use AI to extract patterns and insights from user's task history."""
    conn = db_session_factory()
    cursor = conn.cursor()

    # Get existing patterns count
    cursor.execute(
        "SELECT COUNT(*) FROM alert_event WHERE user_id = %s",
        (user_id,)
    )
    pattern_count = cursor.fetchone()[0]

    # Get usage info
    cursor.execute(
        """
        SELECT COUNT(*), COALESCE(SUM(total_tokens), 0)
        FROM usage_event
        WHERE user_id = %s
        """,
        (user_id,)
    )
    usage_row = cursor.fetchone()
    message_count = usage_row[0]

    cursor.close()

    # Use AI to extract patterns and suggestions
    client = get_openai_client(request.openai_api_key)

    prompt = f"""Based on this user's activity profile, generate 2-3 insights about their task completion patterns.

User Profile:
- Tasks discussed: {message_count}
- Patterns discovered: {pattern_count}
- Engagement level: {"New user" if message_count < 3 else "Active user" if message_count < 10 else "Power user"}

Generate insights that are:
1. Actionable and specific to improving task completion
2. Encouraging but realistic
3. Relevant to their engagement level

For new users, suggest ways to start building their pattern library.
For active users, suggest ways to leverage learned patterns.
For power users, suggest advanced learning strategies.

Return as JSON array with objects containing: alert_type, severity (info/warning/success), title, message
Example: [{{"alert_type": "suggestion", "severity": "info", "title": "Pattern Insight", "message": "Your insight here"}}]

Return ONLY the JSON array, no other text."""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "You are a helpful task planning assistant. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7
    )

    try:
        suggestions = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        # Fallback suggestions if AI response isn't valid JSON
        suggestions = [
            {
                "alert_type": "suggestion",
                "severity": "info",
                "title": "Welcome!",
                "message": "Start by completing some tasks to build your pattern library."
            }
        ]

    # Store suggestions as alerts
    cursor = conn.cursor()
    created_alerts = []

    for suggestion in suggestions:
        cursor.execute(
            """
            INSERT INTO alert_event (user_id, alert_type, severity, title, message, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, created_at
            """,
            (
                user_id,
                suggestion.get("alert_type", "suggestion"),
                suggestion.get("severity", "info"),
                suggestion.get("title", "Suggestion"),
                suggestion.get("message", ""),
                json.dumps({"ai_generated": True})
            )
        )
        result = cursor.fetchone()
        created_alerts.append({
            "id": str(result[0]),
            "alert_type": suggestion.get("alert_type", "suggestion"),
            "severity": suggestion.get("severity", "info"),
            "title": suggestion.get("title", "Suggestion"),
            "message": suggestion.get("message", ""),
            "created_at": result[1].isoformat() if result[1] else None
        })

    conn.commit()
    cursor.close()
    conn.close()

    return {
        "suggestions_created": len(created_alerts),
        "alerts": created_alerts
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Mark an alert as acknowledged."""
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE alert_event
        SET acknowledged_at = NOW()
        WHERE id = %s
        RETURNING id
        """,
        (alert_id,)
    )
    result = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    if result:
        return {"acknowledged": True, "id": str(result[0])}
    return {"acknowledged": False, "error": "Alert not found"}
