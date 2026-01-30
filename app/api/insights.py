from fastapi import APIRouter
from pydantic import BaseModel
from app.langgraph.workflow import build_plan_learn_graph

router = APIRouter()
graph = build_plan_learn_graph()

class InsightsRequest(BaseModel):
    user_id: str
    question: str

@router.post("/insights")
async def generate_insights(payload: InsightsRequest):
    """Generate insights using the Plan & Learn workflow."""
    state = {
        "user_id": payload.user_id,
        "task": payload.question,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Plan & Learn research agent. "
                    "Break down tasks, execute them, and learn from results."
                )
            },
            {
                "role": "user",
                "content": payload.question
            }
        ],
        "plan": [],
        "current_step": 0,
        "success_criteria": "",
        "execution_results": [],
        "overall_success": False,
        "learnings": [],
        "patterns_applied": [],
        "new_patterns_discovered": [],
        "recalled_patterns": [],
        "error_message": None
    }

    result = graph.invoke(state)

    return {
        "learnings": result.get("learnings", []),
        "patterns_discovered": result.get("new_patterns_discovered", []),
        "success": result.get("overall_success", False)
    }