from langgraph.graph import StateGraph, END
from app.alerts.detectors import spending_spike
from app.alerts.store import store_alert

def build_alert_graph():
    graph = StateGraph(dict)

    graph.add_node(
        "detect",
        lambda state: {
            **state,
            "alerts": list(
                filter(
                    None,
                    [
                        spending_spike(
                            state["user_id"],
                            state["recent_spending"],
                            state["baseline_spending"]
                        )
                    ]
                )
            )
        }
    )

    graph.add_node(
        "persist",
        lambda state: [
            store_alert(state["user_id"], alert)
            for alert in state["alerts"]
        ] or state
    )

    graph.set_entry_point("detect")
    graph.add_edge("detect", "persist")
    graph.add_edge("persist", END)

    return graph.compile()