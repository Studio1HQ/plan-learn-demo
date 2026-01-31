# Building a Plan & Learn Agent with Memori

A step-by-step guide to building an AI agent that plans tasks, executes them, and learns from experience using persistent memory.

## What We're Building

The **Plan & Learn Agent** is a self-improving research assistant that:

1. **Plans** - Breaks down complex tasks into actionable steps
2. **Executes** - Works through each step methodically  
3. **Learns** - Stores successful patterns for future reuse
4. **Remembers** - Uses Memori for long-term memory across sessions

![Architecture Diagram](architecture.png)

## Architecture Overview

```
User Request
    ↓
[Memori] Recall patterns from memory
    ↓
[LLM] Create step-by-step plan
    ↓
[Tools] Execute each step
    ↓
[Memori] Store learnings
    ↓
Response to User
```

## Tech Stack

- **Backend**: FastAPI + Python
- **Memory**: Memori (PostgreSQL + pgvector)
- **LLM**: OpenAI GPT-4.1-mini
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **UI Components**: shadcn/ui

## Part 1: Backend Setup

### 1.1 Project Structure

```
app/
├── main.py              # FastAPI app entry point
├── api/
│   ├── chat.py         # Main chat endpoint with tools
│   ├── tasks.py        # Task history tracking
│   └── sample_data.py  # Demo data
├── db/
│   ├── init.py         # Database schema
│   └── session.py      # PostgreSQL connection
└── memory/
    └── memori.py       # Memori integration
```

### 1.2 Dependencies

```toml
# pyproject.toml
[project]
name = "plan-learn-agent"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn>=0.23.0",
    "memori>=3.1.5",
    "psycopg2-binary>=2.9.11",
    "openai>=1.0.0",
    "pydantic>=2.0.0",
]
```

### 1.3 Database Setup

```python
# app/db/init.py
from app.db.session import db_session_factory

def init_database():
    """Create all required database tables."""
    conn = db_session_factory()
    cursor = conn.cursor()
    
    # Task history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_event (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            date DATE NOT NULL,
            name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            outcome TEXT NOT NULL DEFAULT 'completed',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
```

### 1.4 Memori Integration

Memori adds persistent memory to your agent with just a few lines:

```python
# app/memory/memori.py
from memori import Memori
from app.db.session import db_session_factory

def get_memori(client, user_id: str):
    """Wrap OpenAI client with Memori memory."""
    mem = Memori(conn=db_session_factory).llm.register(client)
    mem.attribution(
        entity_id=user_id,
        process_id="plan_learn_agent"
    )
    return mem
```

### 1.5 Define Planning Tools

```python
# app/api/chat.py
PLAN_LEARN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_plan",
            "description": "Break down a task into structured steps",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_description": {"type": "string"},
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
                        }
                    },
                    "success_criteria": {"type": "string"}
                },
                "required": ["task_description", "steps"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_step",
            "description": "Execute a specific step and track result",
            "parameters": {
                "type": "object",
                "properties": {
                    "step_number": {"type": "integer"},
                    "action_taken": {"type": "string"},
                    "result": {"type": "string"},
                    "success": {"type": "boolean"}
                },
                "required": ["step_number", "action_taken", "result", "success"]
            }
        }
    }
]
```

### 1.6 Main Chat Endpoint

```python
# app/api/chat.py
@router.post("/chat")
async def chat(request: Request, payload: ChatRequest):
    client = get_openai_client(payload.openai_api_key)
    
    # Wrap with Memori for automatic memory
    memori = get_memori(client, payload.user_id)
    
    async def stream():
        # Build messages with conversation history
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *[
                {"role": m.role, "content": m.content}
                for m in (payload.conversation_history or [])
            ],
            {"role": "user", "content": payload.message}
        ]
        
        # Stream response with tool support
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            stream=True,
            messages=messages,
            tools=PLAN_LEARN_TOOLS,
            tool_choice="auto"
        )
        
        for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    
    return StreamingResponse(stream(), media_type="text/plain")
```

## Part 2: Frontend Setup

### 2.1 Project Structure

```
plan-learn-web/
├── app/
│   ├── page.tsx           # Main page
│   └── layout.tsx
├── components/
│   ├── chat.tsx           # Chat interface
│   ├── plan-kanban.tsx    # Kanban board
│   ├── workflow-stepper.tsx  # Pipeline visualization
│   └── memori-visualizer.tsx # Memory pipeline UI
├── lib/
│   ├── workflow-context.tsx  # State management
│   └── workflow-event-handler.ts  # Event parsing
└── components/ui/         # shadcn components
```

### 2.2 Workflow State Management

```typescript
// lib/workflow-context.tsx
type WorkflowState = {
  phase: 'idle' | 'recall' | 'plan' | 'execute' | 'learn' | 'complete'
  planSteps: PlanStep[]
  currentStepIndex: number
  recalledPatterns: Pattern[]
  learnings: string[]
}

type PlanStep = {
  step_number: number
  action: string
  reasoning: string
  expected_outcome: string
  status: 'pending' | 'active' | 'complete' | 'failed'
}
```

### 2.3 Kanban Board Component

```typescript
// components/plan-kanban.tsx
export function PlanKanban() {
  const { state } = useWorkflow()
  const steps = state.planSteps
  
  const columns = [
    { id: 'pending', label: 'To Do' },
    { id: 'active', label: 'In Progress' },
    { id: 'complete', label: 'Done' }
  ]
  
  return (
    <div className="grid grid-cols-3 gap-3">
      {columns.map(column => (
        <div key={column.id} className="rounded-lg border p-2">
          <h4>{column.label}</h4>
          {steps
            .filter(s => s.status === column.id)
            .map(step => (
              <StepCard key={step.step_number} step={step} />
            ))}
        </div>
      ))}
    </div>
  )
}
```

### 2.4 Event Handler

Parse tool results and update workflow state:

```typescript
// lib/workflow-event-handler.ts
export function parsePlanFromResult(result: string) {
  const parsed = JSON.parse(result)
  
  if (parsed.plan?.steps) {
    return {
      steps: parsed.plan.steps.map((s, i) => ({
        step_number: s.step_number || i + 1,
        action: s.action,
        reasoning: s.reasoning,
        expected_outcome: s.expected_outcome,
        status: 'pending'
      }))
    }
  }
  return null
}

export function mapEventToActions(event: MemoriEvent) {
  if (event.type === 'tool_execution_complete') {
    for (const result of event.data?.results || []) {
      if (result.tool === 'create_plan') {
        const planData = parsePlanFromResult(result.result_preview)
        return [{ type: 'SET_PLAN', payload: planData }]
      }
    }
  }
}
```

### 2.5 Chat Component

Send messages with conversation history:

```typescript
// components/chat.tsx
async function send() {
  const conversationHistory = messages
    .slice(1) // Skip welcome message
    .filter(m => m.content.trim())
    .map(m => ({ role: m.role, content: m.content }))
  
  const res = await apiStream('/chat', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      message: input,
      conversation_history: conversationHistory
    })
  })
  
  // Handle streaming response...
}
```

## Part 3: Key Features Explained

### 3.1 Automatic Memory Injection

Memori automatically retrieves relevant memories before each LLM call:

```
User: "What's a good budget for me?"

[Memori automatically injects into system prompt:]
"Previous context:
- User earns $5,000 per month
- User mentioned saving for a house"

LLM response uses this context without user repeating it
```

### 3.2 Plan-to-Kanban Flow

1. User requests a plan
2. LLM calls `create_plan` tool
3. Backend returns structured plan
4. Frontend parses and displays in Kanban
5. Each step execution updates the board

### 3.3 Pattern Learning

When tasks complete successfully:

```python
# Store the successful approach
client.chat.completions.create(
    messages=[
        {"role": "system", "content": "Store this successful pattern"},
        {"role": "user", "content": "Strategy for REST API research: 1) Start with RFCs..."}
    ]
)

# Memori automatically extracts and stores this
# Future similar tasks will recall this pattern
```

## Part 4: Running the Project

### 4.1 Environment Setup

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Frontend
cd plan-learn-web
pnpm install
```

### 4.2 Environment Variables

```bash
# .env (backend)
DATABASE_URL=postgresql://user:pass@localhost/planlearn
OPENAI_API_KEY=your_key_here
MEMORI_API_KEY=your_key_here

# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 4.3 Database Setup

```sql
-- PostgreSQL with pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 4.4 Start Everything

```bash
# Terminal 1: Backend
cd app
uv run uvicorn app.main:app --reload

# Terminal 2: Frontend
cd plan-learn-web
pnpm dev
```

## Part 5: Customization

### Add New Tools

```python
# app/api/chat.py
PLAN_LEARN_TOOLS.append({
    "type": "function",
    "function": {
        "name": "search_web",
        "description": "Search the web for information",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"}
            }
        }
    }
})

def execute_tool(tool_name: str, args: dict, user_id: str):
    if tool_name == "search_web":
        # Implement search logic
        return json.dumps({"results": [...]})
```

### Customize System Prompt

```python
AGENT_SYSTEM_PROMPT = """You are a specialized agent for [DOMAIN].

## Your Process:
1. Always recall similar past tasks
2. Create structured plans with clear steps
3. Execute methodically
4. Store learnings for future use

## Personality:
- Be specific and actionable
- Reference previous patterns
- Explain your reasoning
"""
```

## Conclusion

The Plan & Learn Agent demonstrates how to build AI systems that:

- **Plan** complex tasks into manageable steps
- **Execute** with tool use and tracking
- **Learn** from experience automatically
- **Remember** across sessions with Memori

The key insight: Memory isn't just retrieval—it's about building systems that improve over time without retraining.

## Resources

- [Memori Documentation](https://memorilabs.ai/docs)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [FastAPI Streaming](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [Full Source Code](https://github.com/yourusername/plan-learn-agent)

---

*Built with Memori - The memory fabric for enterprise AI*
