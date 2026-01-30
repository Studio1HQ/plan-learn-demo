from typing import TypedDict

class Alert(TypedDict):
    alert_type: str
    severity: str
    title: str
    message: str
    metadata: dict