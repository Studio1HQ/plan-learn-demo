# Manual Memory Test for Plan & Learn Agent

## Test 1: Conversation Memory

### Steps:
1. Open the app in your browser
2. Enter a user ID and log in
3. Send this message:
   ```
   Give me a strategy to learn NeoVim
   ```

4. **Expected**: Agent returns a numbered plan with steps for learning NeoVim

5. Reply with:
   ```
   Yes
   ```

6. **Expected**: Agent continues with NeoVim topic (Step 1 details), NOT a generic greeting like "Hello! How can I assist you today?"

7. Ask follow-up:
   ```
   What plugins should I start with?
   ```

8. **Expected**: Agent mentions Vim/NeoVim plugins (not generic plugins)

### Success Criteria:
- [ ] Step 3 returns a plan with numbered steps
- [ ] Step 5 continues the NeoVim conversation (no generic greeting)
- [ ] Step 7 mentions NeoVim-specific plugins

## Test 2: Plan Kanban Board

### Steps:
1. Ask for a plan:
   ```
   Create a study plan for learning Python
   ```

2. **Expected**: Plan tab automatically shows with Kanban board

3. Switch to "Plan" tab

4. **Expected**: See 3 columns (To Do, In Progress, Done) with steps

### Success Criteria:
- [ ] Plan tab auto-switches when plan is created
- [ ] Kanban board shows all steps in "To Do" column
- [ ] Progress bar shows 0% initially

## Test 3: Memori Long-term Memory

### Steps:
1. Log in as user "alice"
2. Send:
   ```
   I want to learn about REST APIs
   ```
3. Continue conversation, ask questions
4. Log out
5. Log back in as "alice"
6. Send:
   ```
   What was I learning about?
   ```

### Success Criteria:
- [ ] Agent remembers previous conversation about REST APIs
- [ ] Agent references stored patterns from Memori

## Debugging Tips

If memory doesn't work:

1. **Check browser console** for errors
2. **Check backend logs** for errors
3. **Verify conversation_history is being sent** in Network tab
4. **Check that backend receives history** by adding print statement in chat.py

### Expected Request Body:
```json
{
  "user_id": "test_user",
  "message": "Yes",
  "openai_api_key": null,
  "conversation_history": [
    {"role": "user", "content": "Give me a strategy to learn NeoVim"},
    {"role": "assistant", "content": "1. Understand basics... 2. Install..."}
  ]
}
```

### Common Issues:

1. **Generic greeting on "Yes"**: Frontend not sending conversation_history
2. **Empty response**: Backend error processing history
3. **No plan in Kanban**: Tool result not being parsed correctly
