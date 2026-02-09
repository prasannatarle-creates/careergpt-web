#!/usr/bin/env python3
import requests
import json

def test_chat_api():
    base_url = "https://interview-prep-97.preview.emergentagent.com/api"
    
    try:
        print("Testing Chat Send API with simple message...")
        payload = {"message": "Hi"}
        
        # Use longer timeout and different request approach
        response = requests.post(
            f"{base_url}/chat/send", 
            json=payload,
            timeout=90,  # Longer timeout
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Session ID: {data.get('sessionId')}")
            print(f"Models: {data.get('models')}")
            print(f"Synthesized: {data.get('synthesized')}")
            return data.get('sessionId')
        else:
            print(f"Failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        return None

def test_session_operations(session_id):
    base_url = "https://interview-prep-97.preview.emergentagent.com/api"
    
    if not session_id:
        print("No session ID to test with")
        return
    
    try:
        # Test getting specific session
        print(f"\nTesting get specific session: {session_id}")
        response = requests.get(f"{base_url}/chat/sessions/{session_id}")
        print(f"Get Session Status: {response.status_code}")
        
        if response.status_code == 200:
            session_data = response.json()
            if 'session' in session_data:
                print(f"Session found with {len(session_data['session'].get('messages', []))} messages")
            
        # Test deleting session
        print(f"\nTesting delete session: {session_id}")
        response = requests.delete(f"{base_url}/chat/sessions/{session_id}")
        print(f"Delete Session Status: {response.status_code}")
        print(f"Delete Response: {response.text}")
        
    except Exception as e:
        print(f"Session operations error: {str(e)}")

if __name__ == "__main__":
    session_id = test_chat_api()
    test_session_operations(session_id)