"""Test script to verify Kanban plan board functionality."""

import requests
import json
import re

BASE_URL = "http://localhost:8000/api"
USER_ID = "test_kanban_user"


def parse_stream_response(response_text: str) -> tuple:
    """Parse the streaming response to extract text and Memori events."""
    text_parts = []
    events = []
    
    # Remove Memori event markers and collect events
    pattern = r'\[MEMORI\](.*?)\[/MEMORI\]'
    
    for match in re.finditer(pattern, response_text):
        try:
            event_data = json.loads(match.group(1))
            events.append(event_data)
        except json.JSONDecodeError:
            pass
    
    # Get text by removing Memori blocks
    text = re.sub(pattern, '', response_text)
    
    return text, events


def test_plan_creation():
    """Test that a plan is created and the Kanban board receives it."""
    print("=" * 70)
    print("TEST: Plan Creation and Kanban Board")
    print("=" * 70)
    
    # Clear existing data
    requests.delete(f"{BASE_URL}/sample-data/{USER_ID}")
    
    # Send a message asking for a plan
    print("\n[1] Sending: 'Create a study plan for learning Python'")
    
    message = "Create a study plan for learning Python"
    
    try:
        response = requests.post(
            f"{BASE_URL}/chat",
            json={
                "user_id": USER_ID,
                "message": message,
                "openai_api_key": None,
                "conversation_history": []
            },
            stream=True,
            timeout=60
        )
        response.raise_for_status()
        
        # Collect full response
        full_response = ""
        for line in response.iter_lines():
            if line:
                full_response += line.decode('utf-8')
        
        text, events = parse_stream_response(full_response)
        
        print(f"\n    Response preview: {text[:200]}...")
        print(f"    Found {len(events)} Memori events")
        
        # Look for tool_execution_complete event
        tool_events = [e for e in events if e.get('type') == 'tool_execution_complete']
        print(f"    Found {len(tool_events)} tool_execution_complete events")
        
        # Check for create_plan tool
        create_plan_found = False
        plan_data = None
        
        for event in tool_events:
            results = event.get('data', {}).get('results', [])
            for result in results:
                if result.get('tool') == 'create_plan':
                    create_plan_found = True
                    result_preview = result.get('result_preview', '')
                    print(f"\n    [OK] create_plan tool executed")
                    print(f"    Result preview (first 300 chars): {result_preview[:300]}...")
                    
                    # Try to parse the plan data
                    try:
                        plan_data = json.loads(result_preview)
                        print(f"\n    Parsed plan data structure:")
                        print(f"    - Keys: {list(plan_data.keys())}")
                        if 'plan' in plan_data:
                            print(f"    - plan.steps: {len(plan_data['plan'].get('steps', []))} steps")
                        if 'steps' in plan_data:
                            print(f"    - steps (direct): {len(plan_data['steps'])} items")
                    except json.JSONDecodeError as e:
                        print(f"    [ERROR] Failed to parse result as JSON: {e}")
                        print(f"    Raw result: {result_preview}")
        
        if not create_plan_found:
            print("\n    [ERROR] create_plan tool was not called!")
            print("\n    All events received:")
            for i, e in enumerate(events):
                print(f"    Event {i}: {e.get('type')} - {e.get('message', '')[:50]}")
            return False
        
        # Check if plan has steps
        if plan_data:
            steps = plan_data.get('plan', {}).get('steps', []) or plan_data.get('steps', [])
            if steps:
                print(f"\n    [OK] Plan has {len(steps)} steps")
                for i, step in enumerate(steps[:3]):
                    action = step.get('action', step.get('description', 'N/A'))
                    print(f"      Step {i+1}: {action[:50]}...")
                if len(steps) > 3:
                    print(f"      ... and {len(steps) - 3} more steps")
                return True
            else:
                print("\n    [ERROR] Plan data exists but has no steps!")
                return False
        
        return create_plan_found
        
    except Exception as e:
        print(f"\n    [ERROR] {e}")
        import traceback
        traceback.print_exc()
        return False


def test_plan_parsing():
    """Test the plan parsing logic directly."""
    print("\n" + "=" * 70)
    print("TEST: Plan Parsing Logic")
    print("=" * 70)
    
    # Test case 1: Backend format (plan.steps)
    test_result_1 = json.dumps({
        "status": "plan_created",
        "message": "Created a 3-step plan",
        "plan": {
            "task": "Learn Python",
            "total_steps": 3,
            "steps": [
                {"step_number": 1, "action": "Learn basics", "reasoning": "Foundation", "expected_outcome": "Know basics"},
                {"step_number": 2, "action": "Practice", "reasoning": "Skill building", "expected_outcome": "Can code"},
                {"step_number": 3, "action": "Build project", "reasoning": "Apply knowledge", "expected_outcome": "Working app"}
            ],
            "success_criteria": "Build a working app"
        }
    })
    
    print("\n[1] Testing format: plan.steps")
    print(f"    Input: {test_result_1[:200]}...")
    
    # Simulate frontend parsing
    try:
        parsed = json.loads(test_result_1)
        if parsed.get('plan') and isinstance(parsed['plan'].get('steps'), list):
            steps = parsed['plan']['steps']
            print(f"    [OK] Parsed {len(steps)} steps successfully")
            for step in steps:
                print(f"      - {step.get('action')}")
        else:
            print("    [ERROR] Could not find plan.steps")
    except Exception as e:
        print(f"    [ERROR] {e}")
    
    # Test case 2: Truncated result (what might happen with 200 char limit)
    test_result_2 = json.dumps({
        "status": "plan_created",
        "message": "Created a 3-step plan for: Learn Python",
        "plan": {
            "task": "Learn Python",
            "total_steps": 3,
            "steps": [
                {"step_number": 1, "action": "Learn basics", "reasoning": "Foundation is important for understanding", "expected_outcome": "You understand variables and functions"}
            ]
        }
    })[:150]  # Truncate to simulate the issue
    
    print("\n[2] Testing truncated result (simulating 200 char limit)")
    print(f"    Input: {test_result_2}...")
    
    try:
        parsed = json.loads(test_result_2)
        print(f"    [OK] Parsed successfully (lucky - JSON was complete)")
    except json.JSONDecodeError as e:
        print(f"    [ERROR] JSON is incomplete due to truncation: {e}")
        print("    This is likely why the Kanban board doesn't show plans!")


def test_conversation_with_followup():
    """Test that the agent remembers context for Kanban follow-up."""
    print("\n" + "=" * 70)
    print("TEST: Conversation Memory with Plan")
    print("=" * 70)
    
    # Clear data
    requests.delete(f"{BASE_URL}/sample-data/{USER_ID}")
    
    # Step 1: Create a plan
    print("\n[1] Creating initial plan...")
    history = []
    
    message1 = "Give me a strategy to learn NeoVim"
    response1 = send_message(USER_ID, message1, history)
    print(f"    Response: {response1[:150]}...")
    
    history.extend([
        {"role": "user", "content": message1},
        {"role": "assistant", "content": response1}
    ])
    
    # Step 2: Reply "Yes" to continue
    print("\n[2] Sending 'Yes' to continue...")
    message2 = "Yes"
    response2 = send_message(USER_ID, message2, history)
    print(f"    Response: {response2[:150]}...")
    
    # Check if response is generic
    generic_phrases = ["how can i assist", "how can i help", "what can i do", "hello!"]
    is_generic = any(phrase in response2.lower() for phrase in generic_phrases)
    
    if is_generic:
        print("\n    [FAIL] Agent gave generic greeting - conversation history not working!")
        return False
    else:
        print("\n    [OK] Agent remembered the NeoVim context")
        return True


def send_message(user_id: str, message: str, history: list) -> str:
    """Send a message and return just the text response."""
    try:
        response = requests.post(
            f"{BASE_URL}/chat",
            json={
                "user_id": user_id,
                "message": message,
                "openai_api_key": None,
                "conversation_history": history
            },
            stream=True,
            timeout=60
        )
        response.raise_for_status()
        
        text_parts = []
        for line in response.iter_lines():
            if line:
                chunk = line.decode('utf-8')
                if not (chunk.startswith('[MEMORI]') and chunk.endswith('[/MEMORI]')):
                    text_parts.append(chunk)
        
        return "".join(text_parts)
    except Exception as e:
        return f"Error: {e}"


if __name__ == "__main__":
    print("\nPlan & Learn Agent - Kanban Test Suite\n")
    
    try:
        # Test 1: Plan parsing
        test_plan_parsing()
        
        # Test 2: Actual plan creation
        plan_created = test_plan_creation()
        
        # Test 3: Conversation with follow-up
        memory_works = test_conversation_with_followup()
        
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"  Plan parsing: {'PASS' if plan_created else 'FAIL'}")
        print(f"  Conversation memory: {'PASS' if memory_works else 'FAIL'}")
        
        if plan_created and memory_works:
            print("\n  All tests PASSED!")
        else:
            print("\n  Some tests FAILED - see above for details")
            exit(1)
            
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to backend server.")
        print("Make sure the server is running on http://localhost:8000")
        exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
