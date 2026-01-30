from app.db.session import db_session_factory

def record_usage(
    user_id: str,
    endpoint: str,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    byo_api_key: bool
):
    conn = db_session_factory()
    cursor = conn.cursor()
    cursor.execute(
        """
        insert into usage_event (
            user_id,
            endpoint,
            provider,
            model,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            byo_api_key
        ) values (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            endpoint,
            provider,
            model,
            prompt_tokens,
            completion_tokens,
            prompt_tokens + completion_tokens,
            byo_api_key,
        )
    )
    conn.commit()
    cursor.close()
    conn.close()