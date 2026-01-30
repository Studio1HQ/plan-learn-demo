from typing import TypedDict, List, Optional

class FinanceState(TypedDict):
    """Legacy state for backwards compatibility."""
    user_id: str
    messages: List[dict]
    insights: List[str]


class PlanStep(TypedDict):
    """A single step in the execution plan."""
    step_number: int
    action: str
    reasoning: str
    expected_outcome: str
    status: str  # pending, in_progress, completed, failed
    result: Optional[str]


class PlanLearnState(TypedDict):
    """State for the Plan & Learn agent workflow."""
    user_id: str
    task: str
    messages: List[dict]

    # Planning phase
    plan: List[PlanStep]
    current_step: int
    success_criteria: str

    # Execution phase
    execution_results: List[dict]
    overall_success: bool

    # Learning phase
    learnings: List[str]
    patterns_applied: List[str]
    new_patterns_discovered: List[str]

    # Metadata
    recalled_patterns: List[dict]
    error_message: Optional[str]