# Plan & Learn Agent Demo

A self-learning research agent that plans tasks step-by-step, executes them, and learns from successful runs. After completing a task, it stores what worked in memory and reuses those patterns for similar future tasks—no fine-tuning or retraining needed.

**Perfect use case for adding a memory layer with Memori.**

---

## How It Works: Plan → Execute → Learn

```
┌─────────────────────────────────────────────────────────────┐
│                      User Task Request                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    1. PATTERN RECALL                         │
│  • Check Memori for similar past tasks                       │
│  • Retrieve successful patterns/strategies                   │
│  • Adapt proven approaches to current task                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      2. PLANNING                             │
│  • Break task into structured steps                          │
│  • Apply learned patterns where relevant                     │
│  • Define success criteria                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     3. EXECUTION                             │
│  • Execute each step methodically                            │
│  • Use appropriate tools (search, analyze, etc.)             │
│  • Track results and adapt as needed                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      4. LEARNING                             │
│  • Evaluate what worked well                                 │
│  • Store successful patterns in Memori                       │
│  • Patterns available for future similar tasks               │
└─────────────────────────────────────────────────────────────┘
```

---

## Documentation

- **[How-to Guide](./blog.md):** A step-by-step guide to building and running this project.
- **[Troubleshooting](./troubleshooting.md):** Solutions to common setup and runtime issues.

---

## What is Memori?

**Memori** is the long-term memory layer that enables self-learning. It's a Python library that wraps your LLM client and automatically:

1. **Recalls learned patterns** from past successful tasks
2. **Stores new learnings** after task completion
3. **Builds knowledge** over time without retraining
4. **Personalizes** to each user's task history

### How Memori Enables Self-Learning

```
┌─────────────────────────────────────────────────────────────┐
│                     Memori Memory Layer                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Wrap OpenAI client: mem.llm.register(client)    │    │
│  │  2. Set user context: mem.attribution(user_id)      │    │
│  │  3. On each task:                                    │    │
│  │     - Recall relevant patterns from DB               │    │
│  │     - Inject into planning context                   │    │
│  │     - Execute with learned strategies                │    │
│  │     - Store new successful patterns                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                              │
│  - memori_entity_fact (learned patterns)                    │
│  - memori_session (task sessions)                           │
│  - memori_conversation_message (execution history)          │
└─────────────────────────────────────────────────────────────┘
```

### Code Example

```python
from memori import Memori

# On app startup - create Memori tables
Memori(conn=db_session_factory).config.storage.build()

# On each request - wrap the OpenAI client
def get_memori(client, user_id: str):
    mem = Memori(conn=db_session_factory).llm.register(client)
    mem.attribution(
        entity_id=user_id,              # Who is learning?
        process_id="plan_learn_agent"   # Which agent?
    )
    return mem
```

---

## Agent Tools

The Plan & Learn agent has 5 specialized tools:

| Tool | Description |
|------|-------------|
| `create_plan` | Break down a task into structured, actionable steps |
| `execute_step` | Execute a specific step and track the result |
| `search_knowledge` | Search web or internal knowledge for information |
| `recall_patterns` | Retrieve successful patterns from similar past tasks |
| `store_learning` | Explicitly store a learned strategy for future use |

---

## Architecture

```
plan-learn-demo/
├── app/                          # Python Backend (FastAPI)
│   ├── main.py                   # App entry, CORS, rate limiting
│   ├── api/
│   │   ├── chat.py               # Streaming chat with Plan & Learn tools
│   │   ├── alerts.py             # Pattern insights + SSE
│   │   ├── memori_state.py       # Pattern retrieval API
│   │   └── usage.py              # Free tier tracking
│   ├── memory/
│   │   └── memori.py             # Memori integration
│   ├── langgraph/
│   │   ├── workflow.py           # Plan-Execute-Learn workflow graph
│   │   ├── state.py              # PlanLearnState definition
│   │   └── nodes.py              # Workflow nodes
│   └── infra/
│       ├── openai_client.py      # API key selection
│       └── rate_limit.py         # Rate limiter config
│
├── finance-agent-web/            # Next.js Frontend
│   ├── app/page.tsx              # Main dashboard
│   ├── components/
│   │   ├── chat.tsx              # Streaming chat UI
│   │   ├── alerts-panel.tsx      # Learned patterns panel
│   │   ├── transactions.tsx      # Task history
│   │   └── memori-visualizer.tsx # Plan & Learn pipeline visualization
│   └── lib/api.ts                # API client
│
├── .env                          # Environment variables
└── pyproject.toml                # Python dependencies
```

---

## LangGraph Workflow

The agent uses LangGraph for the Plan → Execute → Learn cycle:

```python
def build_plan_learn_graph():
    graph = StateGraph(PlanLearnState)

    # Add workflow nodes
    graph.add_node("recall_patterns", recall_patterns_node)
    graph.add_node("plan", plan_node)
    graph.add_node("execute", execute_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("learn", learn_node)

    # Define the flow
    graph.set_entry_point("recall_patterns")
    graph.add_edge("recall_patterns", "plan")
    graph.add_edge("plan", "execute")
    graph.add_edge("execute", "evaluate")
    graph.add_edge("evaluate", "learn")
    graph.add_edge("learn", END)

    return graph.compile()
```

---

## Backend Features

| Feature | Implementation |
|---------|----------------|
| **Self-Learning** | Memori stores successful patterns, recalls for future tasks |
| **Pattern Matching** | Finds similar past tasks and applies proven strategies |
| **Streaming Chat** | FastAPI StreamingResponse with chunked responses |
| **Agent Tools** | Plan, execute, search, recall, and store tools |
| **Pipeline Visualization** | Real-time events showing Plan & Learn stages |
| **Rate Limiting** | slowapi with 5/minute, 20/day limits |
| **BYO API Key** | Users can provide their own OpenAI key |

---

## Frontend Features

| Feature | Implementation |
|---------|----------------|
| **Plan & Learn Pipeline** | Visual display of recall → plan → execute → learn |
| **Pattern Display** | Shows recalled patterns and their effectiveness |
| **Streaming Responses** | Real-time token-by-token display |
| **Task History** | Track completed tasks and their scores |
| **Learning Insights** | See what patterns the agent has learned |

---

## Local Setup

For a complete guide on setting up the project locally, please see our **[How-to Guide](./blog.md)**.

---

## Demo Flow

1. **Login**: Enter any name/ID (e.g., "demo")
2. **Ask a Task**: "Research best practices for building REST APIs"
3. **Watch Planning**: Agent recalls patterns and creates a plan
4. **See Execution**: Steps execute with real-time progress
5. **Learning**: Successful patterns get stored automatically
6. **Future Tasks**: Similar tasks will use learned patterns

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Streaming chat with Plan & Learn agent |
| `/api/usage/{user_id}` | GET | Check free usage count |
| `/api/memori/patterns/{user_id}` | GET | Get learned patterns |
| `/api/memori/task-stats/{user_id}` | GET | Get task completion stats |
| `/api/memori/state/{user_id}` | GET | Full Memori state |
| `/api/alerts/{user_id}` | GET | List pattern insights |
| `/api/alerts/{user_id}/stream` | GET | SSE for real-time updates |

---

## Key Technologies

- **Memori**: Self-learning memory layer for LLM agents
- **FastAPI**: High-performance Python API framework
- **LangGraph**: Plan-Execute-Learn workflow orchestration
- **OpenAI**: GPT-4.1-mini for planning and execution
- **PostgreSQL**: Persistent storage for learned patterns
- **Next.js 16**: React framework with App Router
- **shadcn/ui**: UI component library

---

## The Self-Learning Advantage

Traditional agents start fresh every conversation. The Plan & Learn agent:

| Traditional Agent | Plan & Learn Agent |
|-------------------|-------------------|
| No memory between sessions | Remembers successful patterns |
| Solves same problems repeatedly | Applies learned strategies |
| No improvement over time | Gets smarter with use |
| Generic responses | Personalized to user's task history |

---

## License

MIT
