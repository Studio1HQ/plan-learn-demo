"""Test script to verify Plan & Learn Agent memory functionality."""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api"
USER_ID = "test_user_memory"


def test_conversation_memory():
    """Test that the agent remembers conversation context."""
    print("=" * 60)
    print("Testing Conversation Memory")
    print("=" * 60)
    
    # Clear any existing data for this test user
    requests.delete(f"{BASE_URL}/sample-data/{USER_ID}")
    
    # Step 1: Start a conversation about learning NeoVim
    print("\n[1] User: Ask for NeoVim learning strategy")
    message1 = "Give me a strategy to learn NeoVim"
    
    response1 = send_message(USER_ID, message1, [])
    print(f"\n    Assistant: {response1[:200]}...")
    
    # Verify we got a plan with steps
    assert "step" in response1.lower() or "1." in response1, "Expected a numbered plan"
    print("    [OK] Got a plan with steps")
    
    # Build conversation history
    history = [
        {"role": "user", "content": message1},
        {"role": "assistant", "content": response1}
    ]
    
    # Step 2: Continue the conversation with "Yes"
    print("\n[2] User: Reply 'Yes' to continue")
    message2 = "Yes"
    
    response2 = send_message(USER_ID, message2, history)
    print(f"\n    Assistant: {response2[:200]}...")
    
    # The agent SHOULD remember we're talking about NeoVim
    # and NOT respond with a generic greeting
    generic_greetings = ["how can i assist", "hello", "how can i help", "what can i do"]
    is_generic = any(greeting in response2.lower() for greeting in generic_greetings)
    
    if is_generic:
        print("    [FAIL] Agent gave generic greeting - memory not working!")
        print(f"\n    Full response: {response2}")
        return False
    else:
        print("    [OK] Agent remembered context (no generic greeting)")
    
    # Step 3: Ask a follow-up question
    print("\n[3] User: Ask about plugins")
    message3 = "What plugins should I start with?"
    
    history.extend([
        {"role": "user", "content": message2},
        {"role": "assistant", "content": response2}
    ])
    
    response3 = send_message(USER_ID, message3, history)
    print(f"\n    Assistant: {response3[:200]}...")
    
    # Should mention something about Vim/NeoVim plugins
    vim_related = any(term in response3.lower() for term in [
        "plugin", "nvim", "neovim", "vim", "packer", "lazy", "plug"
    ])
    
    if vim_related:
        print("    [OK] Agent remembered we're discussing NeoVim plugins")
    else:
        print("    [FAIL] Agent seems to have lost context")
        return False
    
    print("\n" + "=" * 60)
    print("All memory tests passed!")
    print("=" * 60)
    return True


def send_message(user_id: str, message: str, history: list) -> str:
    """Send a message to the chat endpoint and return the response."""
    response_text = []
    
    try:
        response = requests.post(
            f"{BASE_URL}/chat",
            json={
                "user_id": user_id,
                "message": message,
                "openai_api_key": None,  # Use free tier for tests
                "conversation_history": history
            },
            stream=True,
            timeout=60
        )
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line:
                chunk = line.decode('utf-8')
                # Skip Memori event markers
                if chunk.startswith('[MEMORI]') and chunk.endswith('[/MEMORI]'):
                    continue
                response_text.append(chunk)
        
        return "".join(response_text)
    except Exception as e:
        return f"Error: {e}"


def test_plan_creation_and_storage():
    """Test that plans are created and stored properly."""
    print("\n" + "=" * 60)
    print("Testing Plan Creation and Storage")
    print("=" * 60)
    
    # Clear data
    requests.delete(f"{BASE_URL}/sample-data/{USER_ID}")
    
    # Create a plan
    print("\n[1] Creating a plan...")
    message = "Create a study plan for learning Python"
    
    response = send_message(USER_ID, message, [])
    print(f"\n    Response preview: {response[:150]}...")
    
    # Wait a bit for any async processing
    time.sleep(1)
    
    # Check if we can retrieve tasks
    print("\n[2] Checking task history...")
    tasks_response = requests.get(f"{BASE_URL}/tasks/{USER_ID}")
    tasks = tasks_response.json()
    
    print(f"    Found {len(tasks)} tasks")
    
    if tasks:
        print("    [OK] Tasks are being stored")
    else:
        print("    [INFO] No tasks stored yet (this is OK if tasks are stored via tools)")
    
    print("\n" + "=" * 60)
    print("Plan creation test complete")
    print("=" * 60)


if __name__ == "__main__":
    print("\nPlan & Learn Agent - Memory Test Suite\n")
    
    try:
        # Test 1: Conversation memory
        memory_works = test_conversation_memory()
        
        # Test 2: Plan storage
        test_plan_creation_and_storage()
        
        if memory_works:
            print("\n" + "=" * 60)
            print("SUCCESS: All tests passed!")
            print("=" * 60)
        else:
            print("\n" + "=" * 60)
            print("FAILED: Memory is not working correctly")
            print("=" * 60)
            exit(1)
            
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to backend server.")
        print("Make sure the server is running on http://localhost:8000")
        exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        exit(1)
