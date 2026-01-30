from fastapi import APIRouter
from pydantic import BaseModel

from app.db.session import db_session_factory

router = APIRouter()

FREE_USAGE_LIMIT = 3


class UsageResponse(BaseModel):
    user_id: str
    free_uses: int
    limit: int
    needs_api_key: bool


def get_free_usage_count(user_id: str) -> int:
    """Get count of free uses (without BYO API key) for a user."""
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT COUNT(*) FROM usage_event
        WHERE user_id = %s AND byo_api_key = false
        """,
        (user_id,)
    )
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return count


@router.get("/usage/{user_id}")
async def get_usage(user_id: str) -> UsageResponse:
    """Check how many free uses a user has consumed."""
    free_uses = get_free_usage_count(user_id)

    return UsageResponse(
        user_id=user_id,
        free_uses=free_uses,
        limit=FREE_USAGE_LIMIT,
        needs_api_key=free_uses >= FREE_USAGE_LIMIT
    )
