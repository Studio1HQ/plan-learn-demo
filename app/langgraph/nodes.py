from app.memory.memori import get_memori
from app.infra.openai_client import get_openai_client
import json
# ============================================
# Plan & Learn Agent Nodes
# ============================================

def recall_patterns_node(state: dict) -> dict:
    """Recall relevant patterns from Memori for this task type."""
    client = get_openai_client(None)
    memori = get_memori(client, state["user_id"])

    # Ask the LLM to identify what patterns might be relevant
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": """You are analyzing a task to identify relevant past patterns.
                Based on the task description, identify:
                1. The type of task (research, coding, analysis, writing, etc.)
                2. Key concepts that might have relevant patterns
                Return a JSON object with: {"task_type": "...", "keywords": ["..."]}"""
            },
            {
                "role": "user",
                "content": f"Task: {state.get('task', '')}"
            }
        ]
    )

    # The patterns will be automatically recalled by Memori's context injection
    state["recalled_patterns"] = []  # Memori handles this automatically

    return state


def plan_node(state: dict) -> dict:
    """Create an execution plan for the task."""
    client = get_openai_client(None)
    memori = get_memori(client, state["user_id"])

    recalled_patterns_text = ""
    if state.get("recalled_patterns"):
        recalled_patterns_text = "\n\nRelevant patterns from past successes:\n" + \
            "\n".join([f"- {p}" for p in state["recalled_patterns"]])

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": f"""You are a planning expert. Create a detailed step-by-step plan for the given task.

                Consider these proven patterns if relevant:{recalled_patterns_text}

                Return a JSON object with:
                {{
                    "steps": [
                        {{"step_number": 1, "action": "...", "reasoning": "...", "expected_outcome": "..."}}
                    ],
                    "success_criteria": "How to know when task is complete",
                    "patterns_applied": ["list of patterns from memory that you're using"]
                }}"""
            },
            {
                "role": "user",
                "content": f"Create a plan for: {state.get('task', '')}"
            }
        ]
    )

    try:
        content = response.choices[0].message.content
        # Try to extract JSON from the response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        plan_data = json.loads(content)
        state["plan"] = [
            {**step, "status": "pending", "result": None}
            for step in plan_data.get("steps", [])
        ]
        state["success_criteria"] = plan_data.get("success_criteria", "")
        state["patterns_applied"] = plan_data.get("patterns_applied", [])
    except (json.JSONDecodeError, Exception) as e:
        # Fallback: create a simple single-step plan
        state["plan"] = [{
            "step_number": 1,
            "action": "Complete the task",
            "reasoning": "Unable to create detailed plan",
            "expected_outcome": "Task completed",
            "status": "pending",
            "result": None
        }]
        state["success_criteria"] = "Task completed successfully"
        state["patterns_applied"] = []
        state["error_message"] = f"Planning error: {str(e)}"

    state["current_step"] = 0
    return state


def execute_node(state: dict) -> dict:
    """Execute each step in the plan."""
    client = get_openai_client(None)
    memori = get_memori(client, state["user_id"])

    execution_results = []
    overall_success = True

    for i, step in enumerate(state.get("plan", [])):
        step["status"] = "in_progress"
        state["current_step"] = i + 1

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are executing a step in a plan.
                    Perform the action and report the result.
                    Return a JSON object with:
                    {"success": true/false, "result": "what happened", "notes": "any observations"}"""
                },
                {
                    "role": "user",
                    "content": f"""Execute step {step['step_number']}:
                    Action: {step['action']}
                    Reasoning: {step['reasoning']}
                    Expected outcome: {step['expected_outcome']}"""
                }
            ]
        )

        try:
            content = response.choices[0].message.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            result_data = json.loads(content)
            step["status"] = "completed" if result_data.get("success", False) else "failed"
            step["result"] = result_data.get("result", "")

            execution_results.append({
                "step_number": step["step_number"],
                "success": result_data.get("success", False),
                "result": result_data.get("result", ""),
                "notes": result_data.get("notes", "")
            })

            if not result_data.get("success", False):
                overall_success = False
        except Exception as e:
            step["status"] = "failed"
            step["result"] = f"Execution error: {str(e)}"
            overall_success = False
            execution_results.append({
                "step_number": step["step_number"],
                "success": False,
                "result": f"Error: {str(e)}",
                "notes": ""
            })

    state["execution_results"] = execution_results
    state["overall_success"] = overall_success
    return state


def evaluate_node(state: dict) -> dict:
    """Evaluate the overall execution and identify learnings."""
    client = get_openai_client(None)
    memori = get_memori(client, state["user_id"])

    execution_summary = "\n".join([
        f"Step {r['step_number']}: {'SUCCESS' if r['success'] else 'FAILED'} - {r['result']}"
        for r in state.get("execution_results", [])
    ])

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": """Evaluate the task execution and identify learnings.
                Return a JSON object with:
                {
                    "success_assessment": "overall evaluation",
                    "learnings": ["key takeaways from this execution"],
                    "new_patterns": ["reusable patterns discovered"],
                    "improvements": ["what could be done better next time"]
                }"""
            },
            {
                "role": "user",
                "content": f"""Task: {state.get('task', '')}

Success Criteria: {state.get('success_criteria', '')}

Execution Results:
{execution_summary}

Overall Success: {state.get('overall_success', False)}"""
            }
        ]
    )

    try:
        content = response.choices[0].message.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        eval_data = json.loads(content)
        state["learnings"] = eval_data.get("learnings", [])
        state["new_patterns_discovered"] = eval_data.get("new_patterns", [])
    except Exception:
        state["learnings"] = []
        state["new_patterns_discovered"] = []

    return state


def learn_node(state: dict) -> dict:
    """Store successful patterns in Memori for future use."""
    client = get_openai_client(None)
    memori = get_memori(client, state["user_id"])

    # Only store learnings if the task was successful
    if state.get("overall_success", False) and state.get("new_patterns_discovered"):
        patterns_to_store = "\n".join([
            f"- Pattern: {p}" for p in state["new_patterns_discovered"]
        ])

        learnings_text = "\n".join([
            f"- {l}" for l in state.get("learnings", [])
        ])

        # This message will be processed by Memori and stored as facts
        client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are storing learned patterns for future reference.
                    Acknowledge the patterns being stored and confirm they will be available for similar future tasks."""
                },
                {
                    "role": "user",
                    "content": f"""Store these successful patterns from completing "{state.get('task', '')}":

New Patterns Discovered:
{patterns_to_store}

Key Learnings:
{learnings_text}

These should be recalled when facing similar tasks in the future."""
                }
            ]
        )

    return state