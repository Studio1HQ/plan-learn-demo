from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import time

from memori import Memori
from app.infra.rate_limit import limiter
from app.infra.openai_client import get_openai_client
from app.usage.recorder import record_usage
from app.api.usage import get_free_usage_count, FREE_USAGE_LIMIT
from app.db.session import db_session_factory

router = APIRouter()


def get_memori_facts(user_id: str, query: str) -> list[dict]:
    """Query Memori to get relevant facts for a user."""
    conn = db_session_factory()
    cursor = conn.cursor()

    facts = []
    try:
        # Query entity facts for this user - join with memori_entity to match external_id
        cursor.execute("""
            SELECT f.content, f.num_times, f.date_last_time
            FROM memori_entity_fact f
            JOIN memori_entity e ON f.entity_id = e.id
            WHERE e.external_id = %s
            ORDER BY f.date_last_time DESC
            LIMIT 10
        """, (user_id,))

        rows = cursor.fetchall()
        for row in rows:
            # Safely handle row data
            try:
                if len(row) >= 3:
                    facts.append({
                        "fact": row[0] if row[0] else "",
                        "mention_count": row[1] if row[1] is not None else 1,
                        "last_mentioned": str(row[2]) if row[2] else None
                    })
            except (IndexError, TypeError) as row_error:
                print(f"Warning: Skipping malformed row in memori facts: {row}, error: {row_error}")
                continue
    except Exception as e:
        # Table might not exist yet or other error
        print(f"Error fetching memori facts: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

    return facts


def get_memori_session_info(user_id: str) -> dict:
    """Get Memori session information for a user."""
    conn = db_session_factory()
    cursor = conn.cursor()

    session_info = {"total_sessions": 0, "total_messages": 0}
    try:
        # Count sessions - use external_id to match user
        cursor.execute("""
            SELECT COUNT(DISTINCT s.id)
            FROM memori_session s
            JOIN memori_entity e ON s.entity_id = e.id
            WHERE e.external_id = %s
        """, (user_id,))
        result = cursor.fetchone()
        session_info["total_sessions"] = result[0] if result and len(result) > 0 else 0

        # Count messages
        cursor.execute("""
            SELECT COUNT(cm.id)
            FROM memori_conversation_message cm
            JOIN memori_conversation c ON cm.conversation_id = c.id
            JOIN memori_session s ON c.session_id = s.id
            JOIN memori_entity e ON s.entity_id = e.id
            WHERE e.external_id = %s
        """, (user_id,))
        result = cursor.fetchone()
        session_info["total_messages"] = result[0] if result and len(result) > 0 else 0
    except Exception as e:
        print(f"Error fetching session info: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

    return session_info

AGENT_SYSTEM_PROMPT_TEMPLATE = """You are a Plan & Learn research agent with long-term memory. You break down complex tasks into steps, execute them, and learn from successful runs. After completing tasks, you store effective patterns in memory and reuse them for similar future tasks.

## Current User
You are currently helping: **{user_id}**

## Core Methodology: Plan → Execute → Learn

### 1. PLANNING PHASE
When given a task, ALWAYS start by creating a structured plan:
- Break the task into clear, actionable steps
- Identify what information/resources you need
- Check your memories for similar past tasks and successful patterns
- Adapt proven strategies to the current situation

### 2. EXECUTION PHASE
Execute each step methodically:
- Use the appropriate tools for each step
- Track progress and results
- Handle errors gracefully and adapt your approach
- Document what works and what doesn't

### 3. LEARNING PHASE
After completing a task:
- Evaluate what worked well
- Identify patterns that could help with future tasks
- The system automatically stores successful strategies for reuse

## Your Tools:
1. **create_plan**: Break down a task into structured steps with reasoning
2. **execute_step**: Execute a specific step and track the result
3. **search_knowledge**: Search the web or internal knowledge for information
4. **recall_patterns**: Retrieve successful patterns from similar past tasks
5. **store_learning**: Explicitly store a learned strategy for future use

## Recalled Patterns
{recalled_patterns}

## Your Personality:
- Be methodical: Always plan before executing
- Be adaptive: Learn from mistakes and successes
- Be transparent: Explain your reasoning and approach
- Be efficient: Reuse proven patterns when applicable

## Important Rules:
- ALWAYS check for similar past tasks before planning from scratch
- When you find a relevant pattern, adapt it rather than starting over
- After successful completion, briefly note what made it work
- If a task fails, analyze why and try a different approach

Remember: The more tasks you complete, the smarter you become. Every success teaches you patterns for the future."""

PLAN_LEARN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_plan",
            "description": "Break down a task into structured, actionable steps. Use this at the start of any complex task to create a clear execution roadmap.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_description": {
                        "type": "string",
                        "description": "The task to break down into steps"
                    },
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "step_number": {"type": "integer"},
                                "action": {"type": "string"},
                                "reasoning": {"type": "string"},
                                "expected_outcome": {"type": "string"}
                            }
                        },
                        "description": "Array of steps to complete the task"
                    },
                    "success_criteria": {
                        "type": "string",
                        "description": "How to know when the task is successfully completed"
                    }
                },
                "required": ["task_description", "steps", "success_criteria"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_step",
            "description": "Execute a specific step from the plan and record the outcome. Use this to track progress through your plan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_number": {
                        "type": "integer",
                        "description": "Which step number you are executing"
                    },
                    "action_taken": {
                        "type": "string",
                        "description": "What action you performed"
                    },
                    "result": {
                        "type": "string",
                        "description": "The outcome of executing this step"
                    },
                    "success": {
                        "type": "boolean",
                        "description": "Whether the step completed successfully"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Any learnings or observations from this step"
                    }
                },
                "required": ["step_number", "action_taken", "result", "success"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge",
            "description": "Search for information to help complete a task. Can search web resources or internal knowledge base.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to search for"
                    },
                    "source": {
                        "type": "string",
                        "enum": ["web", "internal", "both"],
                        "description": "Where to search: web, internal knowledge, or both"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recall_patterns",
            "description": "Retrieve successful patterns from similar past tasks. Use this before planning to leverage previous learnings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_type": {
                        "type": "string",
                        "description": "The type or category of task you're trying to accomplish"
                    },
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Keywords related to the task to find relevant patterns"
                    }
                },
                "required": ["task_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "store_learning",
            "description": "Explicitly store a successful strategy or pattern for future reuse. Call this after completing a task successfully.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_type": {
                        "type": "string",
                        "description": "Category of task this pattern applies to"
                    },
                    "pattern_name": {
                        "type": "string",
                        "description": "Short descriptive name for this pattern"
                    },
                    "strategy": {
                        "type": "string",
                        "description": "The successful approach/steps that worked"
                    },
                    "when_to_use": {
                        "type": "string",
                        "description": "Conditions when this pattern should be applied"
                    },
                    "effectiveness": {
                        "type": "string",
                        "enum": ["high", "medium", "low"],
                        "description": "How effective was this strategy"
                    }
                },
                "required": ["task_type", "pattern_name", "strategy", "when_to_use"]
            }
        }
    }
]


def get_learned_patterns(user_id: str, task_type: str = None, keywords: list = None) -> list[dict]:
    """Retrieve learned patterns from Memori for similar tasks."""
    conn = db_session_factory()
    cursor = conn.cursor()

    patterns = []
    try:
        # Search for patterns in entity facts that contain strategy information
        search_terms = [task_type] if task_type else []
        if keywords:
            search_terms.extend(keywords)

        if search_terms:
            # Search for facts containing any of the search terms
            search_query = " OR ".join([f"f.content ILIKE %s" for _ in search_terms])
            params = [f"%{term}%" for term in search_terms]
            params.append(user_id)

            cursor.execute(f"""
                SELECT f.content, f.num_times, f.date_last_time
                FROM memori_entity_fact f
                JOIN memori_entity e ON f.entity_id = e.id
                WHERE ({search_query})
                AND e.external_id = %s
                AND (f.content ILIKE '%strategy%' OR f.content ILIKE '%pattern%' OR f.content ILIKE '%approach%' OR f.content ILIKE '%steps%')
                ORDER BY f.num_times DESC, f.date_last_time DESC
                LIMIT 5
            """, tuple(params))
        else:
            # Get recent patterns for this user
            cursor.execute("""
                SELECT f.content, f.num_times, f.date_last_time
                FROM memori_entity_fact f
                JOIN memori_entity e ON f.entity_id = e.id
                WHERE e.external_id = %s
                AND (f.content ILIKE '%strategy%' OR f.content ILIKE '%pattern%' OR f.content ILIKE '%approach%' OR f.content ILIKE '%steps%')
                ORDER BY f.num_times DESC, f.date_last_time DESC
                LIMIT 5
            """, (user_id,))

        rows = cursor.fetchall()
        for row in rows:
            # Safely handle row data
            try:
                if len(row) >= 3:
                    patterns.append({
                        "pattern": row[0] if row[0] else "",
                        "times_used": row[1] if row[1] is not None else 1,
                        "last_used": str(row[2]) if row[2] else None
                    })
            except (IndexError, TypeError) as row_error:
                print(f"Warning: Skipping malformed row in learned patterns: {row}, error: {row_error}")
                continue
    except Exception as e:
        print(f"Error fetching learned patterns: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

    return patterns


def execute_tool(tool_name: str, args: dict, user_id: str) -> str:
    if tool_name == "create_plan":
        task_description = args.get("task_description", "")
        steps = args.get("steps", [])
        success_criteria = args.get("success_criteria", "")

        # Store the plan for tracking
        plan_summary = {
            "task": task_description,
            "total_steps": len(steps),
            "steps": steps,
            "success_criteria": success_criteria,
            "status": "created",
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        return json.dumps({
            "status": "plan_created",
            "message": f"Created a {len(steps)}-step plan for: {task_description}",
            "plan": plan_summary,
            "next_action": "Execute step 1 using execute_step tool"
        })

    elif tool_name == "execute_step":
        step_number = args.get("step_number", 0)
        action_taken = args.get("action_taken", "")
        result = args.get("result", "")
        success = args.get("success", False)
        notes = args.get("notes", "")

        execution_record = {
            "step_number": step_number,
            "action": action_taken,
            "result": result,
            "success": success,
            "notes": notes,
            "executed_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        response = {
            "status": "step_executed",
            "execution": execution_record
        }

        if success:
            response["message"] = f"Step {step_number} completed successfully"
            response["recommendation"] = "Continue to next step or store learning if task complete"
        else:
            response["message"] = f"Step {step_number} encountered issues"
            response["recommendation"] = "Consider revising approach or trying alternative method"

        return json.dumps(response)

    elif tool_name == "search_knowledge":
        query = args.get("query", "")
        source = args.get("source", "internal")

        results = {
            "query": query,
            "source": source,
            "findings": []
        }

        # Search internal knowledge (Memori facts)
        if source in ["internal", "both"]:
            conn = db_session_factory()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    SELECT f.content, f.num_times
                    FROM memori_entity_fact f
                    JOIN memori_entity e ON f.entity_id = e.id
                    WHERE e.external_id = %s
                    AND f.content ILIKE %s
                    ORDER BY f.num_times DESC
                    LIMIT 5
                """, (user_id, f"%{query}%"))

                rows = cursor.fetchall()
                for row in rows:
                    results["findings"].append({
                        "source": "memory",
                        "content": row[0],
                        "relevance": "high" if row[1] > 2 else "medium"
                    })
            except Exception as e:
                print(f"Error searching internal knowledge: {e}")
            finally:
                cursor.close()
                conn.close()

        # For web search, we indicate it's available but simulated
        if source in ["web", "both"]:
            results["findings"].append({
                "source": "web",
                "content": f"Web search results for '{query}' would appear here. In production, integrate with a search API.",
                "relevance": "info"
            })

        if not results["findings"]:
            results["message"] = "No relevant information found. Consider rephrasing your query."

        return json.dumps(results)

    elif tool_name == "recall_patterns":
        task_type = args.get("task_type", "")
        keywords = args.get("keywords", [])

        patterns = get_learned_patterns(user_id, task_type, keywords)

        if patterns:
            return json.dumps({
                "status": "patterns_found",
                "task_type": task_type,
                "patterns_count": len(patterns),
                "patterns": patterns,
                "recommendation": "Consider adapting these proven patterns to your current task"
            })
        else:
            return json.dumps({
                "status": "no_patterns",
                "task_type": task_type,
                "message": "No existing patterns found for this task type. This will be a learning opportunity!",
                "recommendation": "Proceed with planning and be sure to store successful strategies"
            })

    elif tool_name == "store_learning":
        task_type = args.get("task_type", "")
        pattern_name = args.get("pattern_name", "")
        strategy = args.get("strategy", "")
        when_to_use = args.get("when_to_use", "")
        effectiveness = args.get("effectiveness", "medium")

        # The learning will be automatically stored by Memori through the conversation
        # We format it in a way that makes it easy to retrieve later
        learning_record = {
            "type": "learned_pattern",
            "task_type": task_type,
            "pattern_name": pattern_name,
            "strategy": strategy,
            "when_to_use": when_to_use,
            "effectiveness": effectiveness,
            "stored_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        return json.dumps({
            "status": "learning_stored",
            "message": f"Stored pattern '{pattern_name}' for future {task_type} tasks",
            "learning": learning_record,
            "note": "This pattern will be available when you face similar tasks in the future"
        })

    return json.dumps({"error": "Unknown tool"})


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    openai_api_key: str | None = None
    conversation_history: list[ChatMessage] | None = None

@router.post("/chat")
@limiter.limit("5/minute")
@limiter.limit("20/day")
async def chat(
    request: Request,
    payload: ChatRequest
):
    if not payload.openai_api_key:
        free_uses = get_free_usage_count(payload.user_id)
        if free_uses >= FREE_USAGE_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=f"Free usage limit ({FREE_USAGE_LIMIT}) exceeded. Please provide your OpenAI API key to continue."
            )

    client = get_openai_client(payload.openai_api_key)

    memori = Memori(conn=db_session_factory).llm.register(client)
    memori.attribution(
        entity_id=payload.user_id,
        process_id="plan_learn_agent"
    )

    async def stream():
        full_response = ""
        total_prompt_tokens = 0
        total_completion_tokens = 0

        # Get learned patterns for this user to include in system prompt
        learned_patterns = get_learned_patterns(payload.user_id)
        if learned_patterns:
            patterns_text = "\n".join([
                f"- {p['pattern']} (used {p['times_used']} times)"
                for p in learned_patterns[:3]
            ])
        else:
            patterns_text = "No patterns learned yet. Complete tasks to build your knowledge base."

        system_prompt = AGENT_SYSTEM_PROMPT_TEMPLATE.format(
            user_id=payload.user_id,
            recalled_patterns=patterns_text
        )

        # === MEMORI VISUALIZATION: Emit recall status ===
        memori_event = {
            "type": "memori_recall_start",
            "status": "retrieving",
            "message": "Retrieving memories from Memori..."
        }
        yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

        # Get facts that Memori will inject
        recall_start = time.time()
        recalled_facts = get_memori_facts(payload.user_id, payload.message)
        session_info = get_memori_session_info(payload.user_id)
        recall_duration = round((time.time() - recall_start) * 1000)  # ms

        memori_event = {
            "type": "memori_recall_complete",
            "status": "complete",
            "message": f"Found {len(recalled_facts)} relevant memories",
            "data": {
                "facts": recalled_facts,
                "session_info": session_info,
                "recall_time_ms": recall_duration
            }
        }
        yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

        # Build messages with conversation history
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if provided
        if payload.conversation_history:
            for msg in payload.conversation_history:
                messages.append({"role": msg.role, "content": msg.content})
        
        # Add current message
        messages.append({"role": "user", "content": payload.message})

        # === MEMORI VISUALIZATION: LLM call with context ===
        memori_event = {
            "type": "memori_llm_start",
            "status": "processing",
            "message": "Processing with enhanced context..."
        }
        yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            stream=True,
            messages=messages,
            tools=PLAN_LEARN_TOOLS,
            tool_choice="auto",
            stream_options={"include_usage": True}
        )

        tool_calls = []
        first_usage = None

        try:
            for chunk in response:
                if hasattr(chunk, "usage") and chunk.usage:
                    first_usage = chunk.usage

                if not hasattr(chunk, "choices") or not chunk.choices:
                    continue

                choice = chunk.choices[0]
                delta = getattr(choice, "delta", None)
                if not delta:
                    continue

                content = getattr(delta, "content", None)
                if content:
                    full_response += content
                    yield content

                if hasattr(delta, "tool_calls") and delta.tool_calls:
                    for tc in delta.tool_calls:
                        if tc.index is not None:
                            while len(tool_calls) <= tc.index:
                                tool_calls.append({"id": "", "name": "", "arguments": ""})
                            if tc.id:
                                tool_calls[tc.index]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_calls[tc.index]["name"] = tc.function.name
                                if tc.function.arguments:
                                    tool_calls[tc.index]["arguments"] += tc.function.arguments

        except GeneratorExit:
            return

        if first_usage:
            total_prompt_tokens += first_usage.prompt_tokens
            total_completion_tokens += first_usage.completion_tokens

        if tool_calls and tool_calls[0]["name"]:
            # === MEMORI VISUALIZATION: Tool execution ===
            tool_names = [tc["name"] for tc in tool_calls if tc["name"]]
            memori_event = {
                "type": "tool_execution_start",
                "status": "executing",
                "message": f"Executing tools: {', '.join(tool_names)}",
                "data": {"tools": tool_names}
            }
            yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

            raw_client = get_openai_client(payload.openai_api_key)

            # Build tool messages with conversation history
            tool_messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if provided
            if payload.conversation_history:
                for msg in payload.conversation_history:
                    tool_messages.append({"role": msg.role, "content": msg.content})
            
            # Add current message and assistant tool call
            tool_messages.extend([
                {"role": "user", "content": payload.message},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["arguments"]}
                        }
                        for tc in tool_calls if tc["name"]
                    ]
                }
            ])

            tool_results_summary = []
            for tc in tool_calls:
                if not tc["name"]:
                    continue
                try:
                    args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    args = {}

                result = execute_tool(tc["name"], args, payload.user_id)
                tool_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result
                })
                # Don't truncate - send full result for proper parsing
                tool_results_summary.append({
                    "tool": tc["name"],
                    "result_preview": result
                })

            # === MEMORI VISUALIZATION: Tool execution complete ===
            memori_event = {
                "type": "tool_execution_complete",
                "status": "complete",
                "message": f"Retrieved data from {len(tool_results_summary)} tool(s)",
                "data": {"results": tool_results_summary}
            }
            yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

            final_response = raw_client.chat.completions.create(
                model="gpt-4.1-mini",
                stream=True,
                messages=tool_messages,
                stream_options={"include_usage": True}
            )

            final_usage = None
            try:
                for chunk in final_response:
                    if hasattr(chunk, "usage") and chunk.usage:
                        final_usage = chunk.usage

                    if not hasattr(chunk, "choices") or not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    delta = getattr(choice, "delta", None)
                    if delta:
                        content = getattr(delta, "content", None)
                        if content:
                            full_response += content
                            yield content
            except GeneratorExit:
                return

            if final_usage:
                total_prompt_tokens += final_usage.prompt_tokens
                total_completion_tokens += final_usage.completion_tokens

        # === MEMORI VISUALIZATION: Memory storage ===
        memori_event = {
            "type": "memori_store_start",
            "status": "storing",
            "message": "Storing new memories in Memori..."
        }
        yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

        record_usage(
            user_id=payload.user_id,
            endpoint="/api/chat",
            provider="openai",
            model="gpt-4.1-mini",
            prompt_tokens=total_prompt_tokens,
            completion_tokens=total_completion_tokens,
            byo_api_key=payload.openai_api_key is not None
        )

        # === MEMORI VISUALIZATION: Storage complete ===
        memori_event = {
            "type": "memori_store_complete",
            "status": "complete",
            "message": "Memories stored successfully"
        }
        yield f"[MEMORI]{json.dumps(memori_event)}[/MEMORI]"

    return StreamingResponse(
        stream(),
        media_type="text/plain"
    )