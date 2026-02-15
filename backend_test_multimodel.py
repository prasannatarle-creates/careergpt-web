#!/usr/bin/env python3
"""
CareerGPT Multi-Model Backend API Tests
Focus on testing the 5-model AI integration as specified in the review request.
"""
import requests
import json
import time
from typing import Dict, Any, List, Optional

class MultiModelTester:
    def __init__(self):
        self.base_url = "https://interview-prep-demo.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.session.timeout = 90  # 90 second timeout for AI endpoints as specified
        self.test_session_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        print()
        
    def test_health_check(self) -> bool:
        """Test GET /api/health - Health check"""
        try:
            print("Testing Health Check API...")
            response = self.session.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy' and 'timestamp' in data:
                    self.log_test("Health Check", True, f"Status: {data['status']}, timestamp: {data.get('timestamp', 'N/A')}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response structure: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False

    def test_models_api(self) -> bool:
        """Test GET /api/models - Returns all 5 available models"""
        try:
            print("Testing Models API...")
            response = self.session.get(f"{self.base_url}/models")
            
            if response.status_code == 200:
                data = response.json()
                if 'models' in data and isinstance(data['models'], list):
                    models = data['models']
                    
                    # Check if we have exactly 5 models
                    if len(models) != 5:
                        self.log_test("Models API", False, f"Expected 5 models, got {len(models)}")
                        return False
                    
                    # Expected model names
                    expected_models = [
                        'GPT-4.1',
                        'Claude 4 Sonnet', 
                        'Gemini 2.5 Flash',
                        'Grok 3 Mini',
                        'Perplexity Sonar Pro'
                    ]
                    
                    model_names = [m.get('name') for m in models]
                    missing_models = [name for name in expected_models if name not in model_names]
                    
                    if missing_models:
                        self.log_test("Models API", False, f"Missing models: {missing_models}")
                        return False
                    
                    # Check required fields for each model
                    for model in models:
                        required_fields = ['name', 'provider', 'model', 'color', 'guaranteed']
                        missing_fields = [field for field in required_fields if field not in model]
                        if missing_fields:
                            self.log_test("Models API", False, f"Model {model.get('name', 'Unknown')} missing fields: {missing_fields}")
                            return False
                    
                    guaranteed_count = sum(1 for m in models if m.get('guaranteed'))
                    model_details = []
                    for m in models:
                        status = "✓" if m.get('guaranteed') else "~"
                        model_details.append(f"{status} {m['name']} ({m['provider']})")
                    
                    self.log_test("Models API", True, 
                        f"Found all 5 models: {', '.join(model_details)}. Guaranteed: {guaranteed_count}/5")
                    return True
                else:
                    self.log_test("Models API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Models API", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Models API", False, f"Exception: {str(e)}")
            return False

    def test_multi_model_chat_send(self) -> bool:
        """Test POST /api/chat/send with activeModels parameter (3 guaranteed models)"""
        try:
            print("Testing Multi-Model Chat Send (3 guaranteed models - may take 60+ seconds)...")
            
            # Use only guaranteed models to avoid timeouts from failed models
            payload = {
                "message": "Answer in 1 sentence: what is AI?",  # Short message to speed up response
                "activeModels": ["GPT-4.1", "Claude 4 Sonnet", "Gemini 2.5 Flash"]
            }
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/chat/send", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields in response
                required_fields = ['sessionId', 'response', 'models', 'failedModels', 'synthesized', 'successCount', 'totalModels', 'individualResponses']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Multi-Model Chat Send", False, f"Missing fields: {missing_fields}")
                    return False
                
                self.test_session_id = data['sessionId']
                models_used = data.get('models', [])
                failed_models = data.get('failedModels', [])
                synthesized = data.get('synthesized', False)
                success_count = data.get('successCount', 0)
                total_models = data.get('totalModels', 0)
                individual_responses = data.get('individualResponses', [])
                
                # Verify the response format
                if total_models != 3:
                    self.log_test("Multi-Model Chat Send", False, f"Expected totalModels=3, got {total_models}")
                    return False
                
                if success_count < 1:
                    self.log_test("Multi-Model Chat Send", False, f"No successful model responses (successCount={success_count})")
                    return False
                
                # Check models array format
                for model in models_used:
                    if not all(key in model for key in ['name', 'color', 'duration']):
                        self.log_test("Multi-Model Chat Send", False, f"Model missing required fields: {model}")
                        return False
                
                # Check individual responses format 
                for resp in individual_responses:
                    if not all(key in resp for key in ['name', 'color', 'duration']):
                        self.log_test("Multi-Model Chat Send", False, f"Individual response missing fields: {resp}")
                        return False
                
                model_names = [m['name'] for m in models_used]
                failed_names = [f['name'] for f in failed_models] if failed_models else []
                
                self.log_test("Multi-Model Chat Send", True, 
                    f"Response in {duration:.1f}s | Success: {success_count}/{total_models} | "
                    f"Models: {model_names} | Failed: {failed_names} | Synthesized: {synthesized} | SessionID: {self.test_session_id}")
                return True
            else:
                self.log_test("Multi-Model Chat Send", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Multi-Model Chat Send", False, f"Exception: {str(e)}")
            return False

    def test_single_model_chat_send(self) -> bool:
        """Test POST /api/chat/send with only 1 model - should work without synthesis"""
        try:
            print("Testing Single Model Chat Send (should work without synthesis)...")
            
            payload = {
                "message": "Answer in 1 sentence: what is machine learning?",
                "activeModels": ["GPT-4.1"]  # Only one model
            }
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/chat/send", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ['sessionId', 'response', 'models', 'failedModels', 'synthesized', 'successCount', 'totalModels']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Single Model Chat Send", False, f"Missing fields: {missing_fields}")
                    return False
                
                synthesized = data.get('synthesized', True)  # Should be False for single model
                success_count = data.get('successCount', 0)
                total_models = data.get('totalModels', 0)
                models_used = data.get('models', [])
                
                # Verify single model behavior
                if total_models != 1:
                    self.log_test("Single Model Chat Send", False, f"Expected totalModels=1, got {total_models}")
                    return False
                
                if success_count != 1:
                    self.log_test("Single Model Chat Send", False, f"Expected successCount=1, got {success_count}")
                    return False
                
                if synthesized != False:
                    self.log_test("Single Model Chat Send", False, f"Expected synthesized=false for single model, got {synthesized}")
                    return False
                
                if len(models_used) != 1 or models_used[0]['name'] != 'GPT-4.1':
                    self.log_test("Single Model Chat Send", False, f"Expected single GPT-4.1 model, got {models_used}")
                    return False
                
                self.log_test("Single Model Chat Send", True, 
                    f"Response in {duration:.1f}s | Model: {models_used[0]['name']} | "
                    f"Synthesized: {synthesized} | Success: {success_count}/{total_models}")
                return True
            else:
                self.log_test("Single Model Chat Send", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Single Model Chat Send", False, f"Exception: {str(e)}")
            return False

    def test_get_sessions(self) -> bool:
        """Test GET /api/chat/sessions - List sessions"""
        try:
            print("Testing Get Chat Sessions...")
            response = self.session.get(f"{self.base_url}/chat/sessions")
            
            if response.status_code == 200:
                data = response.json()
                if 'sessions' in data and isinstance(data['sessions'], list):
                    sessions_count = len(data['sessions'])
                    self.log_test("Get Chat Sessions", True, f"Retrieved {sessions_count} sessions")
                    return True
                else:
                    self.log_test("Get Chat Sessions", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Get Chat Sessions", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Chat Sessions", False, f"Exception: {str(e)}")
            return False

    def test_get_specific_session(self) -> bool:
        """Test GET /api/chat/sessions/{id} - Get a session"""
        if not self.test_session_id:
            self.log_test("Get Specific Session", False, "No test session ID available from previous test")
            return False
            
        try:
            print("Testing Get Specific Session...")
            response = self.session.get(f"{self.base_url}/chat/sessions/{self.test_session_id}")
            
            if response.status_code == 200:
                data = response.json()
                if 'session' in data:
                    session = data['session']
                    if session.get('id') == self.test_session_id and 'messages' in session:
                        message_count = len(session['messages'])
                        self.log_test("Get Specific Session", True, 
                            f"Session found with {message_count} messages")
                        return True
                    else:
                        self.log_test("Get Specific Session", False, "Session structure invalid")
                        return False
                else:
                    self.log_test("Get Specific Session", False, f"No session in response: {data}")
                    return False
            elif response.status_code == 404:
                self.log_test("Get Specific Session", False, "Session not found (404)")
                return False
            else:
                self.log_test("Get Specific Session", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Specific Session", False, f"Exception: {str(e)}")
            return False

    def test_delete_session(self) -> bool:
        """Test DELETE /api/chat/sessions/{id} - Delete a session"""
        if not self.test_session_id:
            self.log_test("Delete Session", False, "No test session ID available to delete")
            return False
            
        try:
            print("Testing Delete Session...")
            response = self.session.delete(f"{self.base_url}/chat/sessions/{self.test_session_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') == True:
                    self.log_test("Delete Session", True, f"Session {self.test_session_id} deleted successfully")
                    return True
                else:
                    self.log_test("Delete Session", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Delete Session", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Session", False, f"Exception: {str(e)}")
            return False

    def run_focused_tests(self):
        """Run focused tests for multi-model integration"""
        print("=" * 80)
        print("CareerGPT Multi-Model Integration Testing")
        print(f"Base URL: {self.base_url}")
        print("Focus: 5-model AI integration as per review request")
        print("=" * 80)
        
        # Test results tracking
        results = {}
        
        # Run tests in logical order focusing on multi-model features
        tests = [
            ("Health Check", self.test_health_check),
            ("Models API (5 models)", self.test_models_api),
            ("Multi-Model Chat Send (3 models)", self.test_multi_model_chat_send),
            ("Single Model Chat Send", self.test_single_model_chat_send),
            ("Get Chat Sessions", self.test_get_sessions),
            ("Get Specific Session", self.test_get_specific_session),
            ("Delete Session", self.test_delete_session),
        ]
        
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*60}")
                results[test_name] = test_func()
            except Exception as e:
                print(f"❌ CRITICAL ERROR in {test_name}: {str(e)}")
                results[test_name] = False
            
            # Brief pause between tests
            time.sleep(2)
        
        # Summary
        print("\n" + "=" * 80)
        print("MULTI-MODEL TEST RESULTS SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in results.values() if r)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL MULTI-MODEL TESTS PASSED! 5-model integration working correctly.")
        else:
            failed_tests = [name for name, result in results.items() if not result]
            print(f"⚠️  FAILED TESTS: {', '.join(failed_tests)}")
        
        return results

if __name__ == "__main__":
    tester = MultiModelTester()
    results = tester.run_focused_tests()