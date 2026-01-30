from langgraph.graph import StateGraph, END
from app.langgraph.state import PlanLearnState
from app.langgraph.nodes import (
    # Plan & Learn nodes
    recall_patterns_node, plan_node, execute_node, evaluate_node, learn_node
)


def build_plan_learn_graph():
    """
    Plan & Learn Agent Workflow:

    1. recall_patterns: Retrieve relevant patterns from past successful tasks
    2. plan: Create a step-by-step execution plan
    3. execute: Execute each step in the plan
    4. evaluate: Assess results and identify learnings
    5. learn: Store successful patterns in Memori for future use

    Flow:
    recall_patterns → plan → execute → evaluate → learn → END
    """
    graph = StateGraph(PlanLearnState)

    # Add all nodes
    graph.add_node("recall_patterns", recall_patterns_node)
    graph.add_node("plan", plan_node)
    graph.add_node("execute", execute_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("learn", learn_node)

    # Define the workflow
    graph.set_entry_point("recall_patterns")
    graph.add_edge("recall_patterns", "plan")
    graph.add_edge("plan", "execute")
    graph.add_edge("execute", "evaluate")
    graph.add_edge("evaluate", "learn")
    graph.add_edge("learn", END)

    return graph.compile()


# Alias for the main workflow
build_graph = build_plan_learn_graph