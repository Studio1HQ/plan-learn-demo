# Plan & Learn Agent - Testing Guide

## Quick Start

1. **Start the backend:**
   ```bash
   cd app
   uv run uvicorn app.main:app --reload
   ```

2. **Start the frontend:**
   ```bash
   cd plan-learn-web
   pnpm dev
   ```

3. **Run automated tests:**
   ```bash
   cd tests
   python3 test_kanban.py
   ```

## Test Files

| File | Purpose |
|------|---------|
| `test_memory.py` | Tests conversation memory (agent remembers context) |
| `test_kanban.py` | Tests plan creation and Kanban board functionality |
| `test_memory_manual.md` | Manual testing steps |

## What Was Fixed

### 1. Conversation Memory (Fixed)
**Problem:** Agent responded with "Hello! How can I assist you today?" after user said "Yes"

**Root Cause:** Frontend wasn't sending conversation history to backend

**Fix:**
- Backend: Added `conversation_history` field to `ChatRequest` model
- Frontend: Modified `send()` to include previous messages

### 2. Kanban Plan Board (Fixed)
**Problem:** Plans weren't showing in the Kanban board

**Root Cause:** Tool results were being truncated to 200 characters, breaking JSON parsing

**Fix:**
- Backend: Removed truncation in `tool_results_summary`
- Frontend: Added console logging and better error handling in `parsePlanFromResult`

## Manual Test: Kanban Board

1. Open browser to `http://localhost:3000`
2. Enter user ID: `testuser`
3. Send message: `Create a study plan for learning Python`
4. **Expected:** 
   - Response shows numbered plan
   - "Plan" tab gets a badge with step count
   - UI auto-switches to Plan tab (or click it)
   - Kanban board shows steps in "To Do" column
   - Progress bar shows 0%

5. Continue conversation: `Yes, help me with step 1`
6. **Expected:**
   - Agent provides details for step 1
   - Kanban board updates (step moves to "In Progress" or "Done")

## Debugging

### Check Browser Console
Open DevTools (F12) and look for:
```
[parsePlanFromResult] Parsing: {...}
[parsePlanFromResult] Found plan.steps with X steps
[mapEventToActions] Plan parsed successfully with X steps
```

### Check Backend Logs
Look for tool execution:
```
Executing tool: create_plan
Result: {"status": "plan_created", "plan": {"steps": [...]}}
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Generic greeting after "Yes" | No conversation history | Check `conversation_history` is being sent |
| Plan not in Kanban | JSON parsing failed | Check console for parse errors |
| Empty Kanban board | No `create_plan` tool called | Check agent is using the tool |

## API Testing

Test the API directly:

```bash
# Create a plan
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test",
    "message": "Create a plan for learning Go",
    "conversation_history": []
  }'
```
