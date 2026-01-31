from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

from app.db.session import db_session_factory

router = APIRouter()

# Sample task data for demo
SAMPLE_TASKS = [
    # Research tasks
    {"name": "Research REST API best practices", "task_type": "research", "outcome": "completed", "notes": "Found useful patterns for rate limiting and versioning"},
    {"name": "Analyze competitor products", "task_type": "research", "outcome": "completed", "notes": "Identified 3 key differentiators"},
    {"name": "Study machine learning fundamentals", "task_type": "research", "outcome": "learned", "notes": "Learned about gradient descent optimization"},
    # Planning tasks
    {"name": "Create project roadmap", "task_type": "planning", "outcome": "completed", "notes": "Used OKR framework for milestones"},
    {"name": "Design system architecture", "task_type": "planning", "outcome": "completed", "notes": "Applied microservices pattern"},
    {"name": "Plan sprint backlog", "task_type": "planning", "outcome": "adapted", "notes": "Adjusted approach based on team capacity"},
    # Analysis tasks
    {"name": "Analyze user feedback", "task_type": "analysis", "outcome": "completed", "notes": "Top issue: onboarding complexity"},
    {"name": "Review performance metrics", "task_type": "analysis", "outcome": "learned", "notes": "Cache hit ratio needs improvement"},
    {"name": "Debug authentication issue", "task_type": "analysis", "outcome": "completed", "notes": "Root cause: token expiry handling"},
    # Writing tasks
    {"name": "Write API documentation", "task_type": "writing", "outcome": "completed", "notes": "Used OpenAPI spec with examples"},
    {"name": "Create user guide", "task_type": "writing", "outcome": "adapted", "notes": "Added visual diagrams based on feedback"},
    {"name": "Draft technical spec", "task_type": "writing", "outcome": "completed", "notes": "Included RFC for team review"},
    # Coding tasks
    {"name": "Implement user authentication", "task_type": "coding", "outcome": "completed", "notes": "Applied JWT with refresh tokens"},
    {"name": "Build data pipeline", "task_type": "coding", "outcome": "learned", "notes": "Learned about idempotent workers"},
    {"name": "Create API endpoints", "task_type": "coding", "outcome": "completed", "notes": "Followed REST conventions"},
    {"name": "Refactor legacy code", "task_type": "coding", "outcome": "adapted", "notes": "Used strangler fig pattern"},
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
            "task_type": task["task_type"],
            "outcome": task["outcome"],
            "notes": task["notes"]
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
