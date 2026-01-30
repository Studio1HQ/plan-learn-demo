"""API endpoints for querying Memori state and visualization data."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.db.session import db_session_factory

router = APIRouter()


class MemoriStateResponse(BaseModel):
    entity_id: str
    facts: list[dict]
    sessions: list[dict]
    recent_conversations: list[dict]
    stats: dict


@router.get("/memori/state/{user_id}")
async def get_memori_state(user_id: str) -> MemoriStateResponse:
    """Get complete Memori state for a user - facts, sessions, conversations."""
    conn = db_session_factory()
    cursor = conn.cursor()

    facts = []
    sessions = []
    conversations = []
    stats = {
        "total_facts": 0,
        "total_sessions": 0,
        "total_messages": 0
    }

    try:
        # Get entity facts - join with memori_entity to match external_id
        cursor.execute("""
            SELECT f.content, f.num_times, f.date_last_time, f.date_created
            FROM memori_entity_fact f
            JOIN memori_entity e ON f.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY f.date_last_time DESC
            LIMIT 20
        """, (user_id,))

        rows = cursor.fetchall()
        for row in rows:
            facts.append({
                "fact": row[0],
                "mention_count": row[1],
                "last_mentioned": str(row[2]) if row[2] else None,
                "created_at": str(row[3]) if row[3] else None
            })
        stats["total_facts"] = len(facts)

        # Get sessions - use external_id
        cursor.execute("""
            SELECT s.id, s.date_created
            FROM memori_session s
            JOIN memori_entity e ON s.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY s.date_created DESC
            LIMIT 10
        """, (user_id,))

        rows = cursor.fetchall()
        for row in rows:
            sessions.append({
                "session_id": str(row[0]),
                "created_at": str(row[1]) if row[1] else None
            })
        stats["total_sessions"] = len(sessions)

        # Get recent conversation messages - use external_id
        cursor.execute("""
            SELECT cm.role, cm.content, cm.date_created, s.id as session_id
            FROM memori_conversation_message cm
            JOIN memori_conversation c ON cm.conversation_id = c.id
            JOIN memori_session s ON c.session_id = s.id
            JOIN memori_entity e ON s.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY cm.date_created DESC
            LIMIT 20
        """, (user_id,))

        rows = cursor.fetchall()
        for row in rows:
            conversations.append({
                "role": row[0],
                "content": row[1][:500] if row[1] else None,  # Truncate long content
                "created_at": str(row[2]) if row[2] else None,
                "session_id": str(row[3])
            })
        stats["total_messages"] = len(conversations)

    except Exception as e:
        # Tables might not exist yet - return empty state
        print(f"Error fetching memori state: {e}")
    finally:
        cursor.close()
        conn.close()

    return MemoriStateResponse(
        entity_id=user_id,
        facts=facts,
        sessions=sessions,
        recent_conversations=conversations,
        stats=stats
    )


@router.get("/memori/facts/{user_id}")
async def get_memori_facts(user_id: str, limit: int = 10):
    """Get entity facts for a user."""
    conn = db_session_factory()
    cursor = conn.cursor()

    facts = []
    try:
        cursor.execute("""
            SELECT f.content, f.num_times, f.date_last_time, f.date_created
            FROM memori_entity_fact f
            JOIN memori_entity e ON f.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY f.date_last_time DESC
            LIMIT %s
        """, (user_id, limit))

        rows = cursor.fetchall()
        for row in rows:
            facts.append({
                "fact": row[0],
                "mention_count": row[1],
                "last_mentioned": str(row[2]) if row[2] else None,
                "created_at": str(row[3]) if row[3] else None
            })
    except Exception as e:
        print(f"Error fetching facts: {e}")
    finally:
        cursor.close()
        conn.close()

    return {"entity_id": user_id, "facts": facts, "count": len(facts)}


@router.get("/memori/knowledge-graph/{user_id}")
async def get_knowledge_graph(user_id: str, limit: int = 20):
    """Get knowledge graph triples for visualization."""
    conn = db_session_factory()
    cursor = conn.cursor()

    triples = []
    try:
        cursor.execute("""
            SELECT
                s.name as subject,
                p.content as predicate,
                o.name as object,
                kg.date_created
            FROM memori_knowledge_graph kg
            JOIN memori_subject s ON kg.subject_id = s.id
            JOIN memori_predicate p ON kg.predicate_id = p.id
            JOIN memori_object o ON kg.object_id = o.id
            JOIN memori_entity e ON kg.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY kg.date_created DESC
            LIMIT %s
        """, (user_id, limit))

        rows = cursor.fetchall()
        for row in rows:
            triples.append({
                "subject": row[0],
                "predicate": row[1],
                "object": row[2],
                "created_at": str(row[3]) if row[3] else None
            })
    except Exception as e:
        print(f"Error fetching knowledge graph: {e}")
    finally:
        cursor.close()
        conn.close()

    return {"entity_id": user_id, "triples": triples, "count": len(triples)}


@router.get("/memori/process-attributes")
async def get_process_attributes(process_id: str = "plan_learn_agent", limit: int = 10):
    """Get process attributes (what the agent typically handles)."""
    conn = db_session_factory()
    cursor = conn.cursor()

    attributes = []
    try:
        cursor.execute("""
            SELECT pa.content, pa.num_times, pa.date_last_time
            FROM memori_process_attribute pa
            JOIN memori_process p ON pa.process_id = p.id
            WHERE p.external_id = %s
            ORDER BY pa.num_times DESC
            LIMIT %s
        """, (process_id, limit))

        rows = cursor.fetchall()
        for row in rows:
            attributes.append({
                "attribute": row[0],
                "mention_count": row[1],
                "last_mentioned": str(row[2]) if row[2] else None
            })
    except Exception as e:
        print(f"Error fetching process attributes: {e}")
    finally:
        cursor.close()
        conn.close()

    return {"process_id": process_id, "attributes": attributes, "count": len(attributes)}


@router.get("/memori/patterns/{user_id}")
async def get_learned_patterns(user_id: str, task_type: Optional[str] = None, limit: int = 20):
    """
    Get learned patterns/strategies from Memori for the Plan & Learn agent.

    These are facts that contain strategy, pattern, or approach information
    that can be reused for similar future tasks.
    """
    conn = db_session_factory()
    cursor = conn.cursor()

    patterns = []
    try:
        if task_type:
            # Search for patterns related to a specific task type
            cursor.execute("""
                SELECT f.content, f.num_times, f.date_last_time, f.date_created
                FROM memori_entity_fact f
                JOIN memori_entity e ON f.entity_id = e.id
                WHERE e.external_id = %s
                AND (
                    f.content ILIKE '%strategy%'
                    OR f.content ILIKE '%pattern%'
                    OR f.content ILIKE '%approach%'
                    OR f.content ILIKE '%steps%'
                    OR f.content ILIKE '%learned%'
                )
                AND f.content ILIKE %s
                ORDER BY f.num_times DESC, f.date_last_time DESC
                LIMIT %s
            """, (user_id, f"%{task_type}%", limit))
        else:
            # Get all patterns
            cursor.execute("""
                SELECT f.content, f.num_times, f.date_last_time, f.date_created
                FROM memori_entity_fact f
                JOIN memori_entity e ON f.entity_id = e.id
                WHERE e.external_id = %s
                AND (
                    f.content ILIKE '%strategy%'
                    OR f.content ILIKE '%pattern%'
                    OR f.content ILIKE '%approach%'
                    OR f.content ILIKE '%steps%'
                    OR f.content ILIKE '%learned%'
                    OR f.content ILIKE '%successful%'
                    OR f.content ILIKE '%effective%'
                )
                ORDER BY f.num_times DESC, f.date_last_time DESC
                LIMIT %s
            """, (user_id, limit))

        rows = cursor.fetchall()
        for row in rows:
            patterns.append({
                "pattern": row[0],
                "times_used": row[1],
                "last_used": str(row[2]) if row[2] else None,
                "created_at": str(row[3]) if row[3] else None,
                "effectiveness": "high" if row[1] > 3 else "medium" if row[1] > 1 else "new"
            })
    except Exception as e:
        print(f"Error fetching learned patterns: {e}")
    finally:
        cursor.close()
        conn.close()

    return {
        "entity_id": user_id,
        "task_type": task_type,
        "patterns": patterns,
        "count": len(patterns)
    }


@router.get("/memori/task-stats/{user_id}")
async def get_task_stats(user_id: str):
    """
    Get task completion statistics for a user from Memori.

    Returns aggregated stats about the user's task completion history.
    """
    conn = db_session_factory()
    cursor = conn.cursor()

    stats = {
        "total_patterns_learned": 0,
        "total_conversations": 0,
        "most_common_task_types": [],
        "recent_activity": []
    }

    try:
        # Count patterns
        cursor.execute("""
            SELECT COUNT(*)
            FROM memori_entity_fact f
            JOIN memori_entity e ON f.entity_id = e.id
            WHERE e.external_id = %s
            AND (
                f.content ILIKE '%strategy%'
                OR f.content ILIKE '%pattern%'
                OR f.content ILIKE '%learned%'
            )
        """, (user_id,))
        result = cursor.fetchone()
        stats["total_patterns_learned"] = result[0] if result else 0

        # Count conversations
        cursor.execute("""
            SELECT COUNT(DISTINCT c.id)
            FROM memori_conversation c
            JOIN memori_session s ON c.session_id = s.id
            JOIN memori_entity e ON s.entity_id = e.id
            WHERE e.external_id = %s
        """, (user_id,))
        result = cursor.fetchone()
        stats["total_conversations"] = result[0] if result else 0

        # Get recent activity (last 5 facts)
        cursor.execute("""
            SELECT f.content, f.date_last_time
            FROM memori_entity_fact f
            JOIN memori_entity e ON f.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY f.date_last_time DESC
            LIMIT 5
        """, (user_id,))
        rows = cursor.fetchall()
        for row in rows:
            stats["recent_activity"].append({
                "fact": row[0][:100] + "..." if len(row[0]) > 100 else row[0],
                "timestamp": str(row[1]) if row[1] else None
            })

    except Exception as e:
        print(f"Error fetching task stats: {e}")
    finally:
        cursor.close()
        conn.close()

    return {"entity_id": user_id, "stats": stats}
