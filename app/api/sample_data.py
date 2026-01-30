from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

from app.db.session import db_session_factory

router = APIRouter()

# Sample task data for demo
SAMPLE_TASKS = [
    # Research tasks
    {"name": "Research REST API best practices", "score": 8, "task_type": "research"},
    {"name": "Analyze competitor products", "score": 7, "task_type": "research"},
    {"name": "Study machine learning fundamentals", "score": 6, "task_type": "research"},
    # Planning tasks
    {"name": "Create project roadmap", "score": 9, "task_type": "planning"},
    {"name": "Design system architecture", "score": 8, "task_type": "planning"},
    {"name": "Plan sprint backlog", "score": 7, "task_type": "planning"},
    # Analysis tasks
    {"name": "Analyze user feedback", "score": 8, "task_type": "analysis"},
    {"name": "Review performance metrics", "score": 7, "task_type": "analysis"},
    {"name": "Debug authentication issue", "score": 9, "task_type": "analysis"},
    # Writing tasks
    {"name": "Write API documentation", "score": 8, "task_type": "writing"},
    {"name": "Create user guide", "score": 7, "task_type": "writing"},
    {"name": "Draft technical spec", "score": 6, "task_type": "writing"},
    # Coding tasks
    {"name": "Implement user authentication", "score": 9, "task_type": "coding"},
    {"name": "Build data pipeline", "score": 8, "task_type": "coding"},
    {"name": "Create API endpoints", "score": 8, "task_type": "coding"},
    {"name": "Refactor legacy code", "score": 7, "task_type": "coding"},
]

class SampleDataResponse(BaseModel):
    tasks_loaded: int
    message: str


@router.post("/sample-data/{user_id}")
async def load_sample_data(user_id: str) -> SampleDataResponse:
    """Load sample task data for demo purposes."""
    return SampleDataResponse(
        tasks_loaded=len(SAMPLE_TASKS),
        message=f"Sample tasks available for user {user_id}. Use 'Extract Patterns' to discover learnings."
    )


@router.get("/sample-tasks")
async def get_sample_tasks():
    """Get list of sample tasks for the demo."""
    tasks = []
    base_date = datetime.now()

    for i, task in enumerate(SAMPLE_TASKS):
        date = base_date - timedelta(days=random.randint(0, 30))
        tasks.append({
            "id": f"sample-{i}",
            "date": date.strftime("%Y-%m-%d"),
            "name": task["name"],
            "score": task["score"],
            "task_type": task["task_type"]
        })

    return sorted(tasks, key=lambda x: x["date"], reverse=True)


@router.delete("/sample-data/{user_id}")
async def clear_sample_data(user_id: str):
    """Clear all data for a user (for demo reset)."""
    conn = db_session_factory()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM alert_event WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM usage_event WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM task_event WHERE user_id = %s", (user_id,))

    conn.commit()
    cursor.close()
    conn.close()

    return {"message": f"All data cleared for user {user_id}"}
