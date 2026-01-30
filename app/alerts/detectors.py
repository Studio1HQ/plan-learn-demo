from statistics import mean
from typing import List
from app.alerts.types import Alert

def spending_spike(
    user_id: str,
    recent: List[float],
    baseline: List[float]
) -> Alert | None:
    if not recent or not baseline:
        return None

    if mean(recent) > mean(baseline) * 1.2:
        return {
            "alert_type": "spending_spike",
            "severity": "medium",
            "title": "Spending spike detected",
            "message": (
                "Your recent spending is significantly higher "
                "than your usual pattern."
            ),
            "metadata": {
                "recent_avg": mean(recent),
                "baseline_avg": mean(baseline)
            }
        }

    return None