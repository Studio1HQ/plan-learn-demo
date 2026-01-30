from memori import Memori
from app.db.session import db_session_factory

def get_memori(client, user_id: str):
    mem = Memori(conn=db_session_factory).llm.register(client)
    mem.attribution(
        entity_id=user_id,
        process_id="plan_learn_agent"
    )
    return mem