import asyncio
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List

from app.infra.rate_limit import limiter
from app.infra.openai_client import get_openai_client
from app.memory.memori import get_memori
from app.db.session import db_session_factory

router = APIRouter()


def store_task(user_id: str, task):
    """Store a task in the database."""
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO task_event (user_id, date, name, score, task_type)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (user_id, task.date, task.name, task.score, task.task_type)
    )
    task_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return task_id


@router.get("/tasks/{user_id}")
async def get_tasks(user_id: str, limit: int = 20):
    """Get recent tasks for a user."""
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, date, name, score, task_type, created_at
        FROM task_event
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (user_id, limit)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {
            "id": str(row[0]),
            "date": row[1].isoformat() if row[1] else None,
            "name": row[2],
            "score": float(row[3]),
            "task_type": row[4],
            "created_at": row[5].isoformat() if row[5] else None
        }
        for row in rows
    ]


def _process_task(client, task):
    """Process a single task with OpenAI for learning extraction."""
    client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are processing completed task data. "
                    "Extract learnings and patterns that can help with future similar tasks."
                )
            },
            {
                "role": "user",
                "content": (
                    f"On {task.date}, the user completed a {task.task_type} task: '{task.name}' "
                    f"with a success score of {task.score}/10."
                )
            }
        ]
    )


class Task(BaseModel):
    date: str
    name: str
    score: float
    task_type: str


class TasksRequest(BaseModel):
    user_id: str
    tasks: List[Task]
    openai_api_key: str | None = None


@router.post("/tasks")
@limiter.limit("10/minute")
@limiter.limit("100/day")
async def ingest_tasks(
    request: Request,
    payload: TasksRequest
):
    try:
        client = get_openai_client(payload.openai_api_key)
        await asyncio.to_thread(get_memori, client, payload.user_id)

        # Store and process tasks
        stored_ids = []
        stored_tasks = []
        for task in payload.tasks:
            # Store in database
            task_id = await asyncio.to_thread(store_task, payload.user_id, task)
            stored_ids.append(str(task_id))
            stored_tasks.append({
                "id": str(task_id),
                "date": task.date,
                "name": task.name,
                "score": task.score,
                "task_type": task.task_type
            })
            # Process with LLM for learning extraction (background, don't block)
            asyncio.create_task(asyncio.to_thread(_process_task, client, task))

        return {
            "status": "ok",
            "ingested": len(payload.tasks),
            "task_ids": stored_ids,
            "tasks": stored_tasks
        }
    except asyncio.CancelledError:
        # Client disconnected - handle gracefully
        return {
            "status": "cancelled",
            "ingested": 0
        }
