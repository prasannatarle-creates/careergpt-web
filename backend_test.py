#!/usr/bin/env python3
"""
CareerGPT Backend API Tests
Tests all backend endpoints with real data and comprehensive error handling.
"""
import requests
import json
import time
import os
import tempfile
from typing import Dict, Any, Optional

class CareerGPTTester:
    def __init__(self):
        self.base_url = "https://interview-prep-97.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.session.timeout = 60  # 60 second timeout for AI endpoints
        self.test_session_id = None
        self.test_resume_id = None
        self.test_interview_session_id = None
        
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
                    self.log_test("Health Check", True, f"Status: {data['status']}, DB ping successful")
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
    
    def test_chat_send(self) -> bool:
        """Test POST /api/chat/send - Send chat message"""
        try:
            print("Testing Chat Send API (AI endpoint - may take 15-30 seconds)...")
            payload = {
                "message": "What are the key skills for a software engineer?"
            }
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/chat/send", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['sessionId', 'response', 'models']
                
                if all(field in data for field in required_fields):
                    self.test_session_id = data['sessionId']  # Store for later tests
                    models_used = data.get('models', [])
                    synthesized = data.get('synthesized', False)
                    
                    self.log_test("Chat Send", True, 
                        f"Response in {duration:.1f}s, Models: {models_used}, "
                        f"Synthesized: {synthesized}, SessionID: {self.test_session_id}")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Chat Send", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_test("Chat Send", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Chat Send", False, f"Exception: {str(e)}")
            return False
    
    def test_get_sessions(self) -> bool:
        """Test GET /api/chat/sessions - List all sessions"""
        try:
            print("Testing Get Chat Sessions API...")
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
        """Test GET /api/chat/sessions/{sessionId} - Get specific session"""
        if not self.test_session_id:
            self.log_test("Get Specific Session", False, "No test session ID available from previous test")
            return False
            
        try:
            print("Testing Get Specific Session API...")
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
    
    def test_resume_upload(self) -> bool:
        """Test POST /api/resume/upload - Upload resume file"""
        try:
            print("Testing Resume Upload API...")
            # Create a sample resume file
            resume_content = """John Doe
Software Engineer

EXPERIENCE:
- 3 years at Tech Company as Senior Developer
- Built scalable web applications using Python and React
- Led team of 5 developers on cloud migration project

SKILLS:
- Programming: Python, JavaScript, Java, SQL
- Frameworks: React, Django, Flask, Node.js
- Cloud: AWS, Docker, Kubernetes
- Databases: PostgreSQL, MongoDB, Redis

EDUCATION:
- BS Computer Science, University of Technology (2018)

ACHIEVEMENTS:
- Increased system performance by 40%
- Reduced deployment time by 60% through CI/CD implementation
- Mentored 3 junior developers"""

            # Create temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(resume_content)
                temp_file_path = f.name
            
            try:
                with open(temp_file_path, 'rb') as f:
                    files = {'file': ('john_doe_resume.txt', f, 'text/plain')}
                    response = self.session.post(f"{self.base_url}/resume/upload", files=files)
                
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ['resumeId', 'fileName', 'textPreview', 'charCount']
                    
                    if all(field in data for field in required_fields):
                        self.test_resume_id = data['resumeId']  # Store for later tests
                        char_count = data['charCount']
                        file_name = data['fileName']
                        
                        self.log_test("Resume Upload", True, 
                            f"File: {file_name}, Characters: {char_count}, ResumeID: {self.test_resume_id}")
                        return True
                    else:
                        missing = [f for f in required_fields if f not in data]
                        self.log_test("Resume Upload", False, f"Missing fields: {missing}")
                        return False
                else:
                    self.log_test("Resume Upload", False, f"HTTP {response.status_code}: {response.text}")
                    return False
                    
            finally:
                # Clean up temp file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            self.log_test("Resume Upload", False, f"Exception: {str(e)}")
            return False
    
    def test_resume_analyze(self) -> bool:
        """Test POST /api/resume/analyze - Analyze resume"""
        if not self.test_resume_id:
            self.log_test("Resume Analyze", False, "No test resume ID available from upload test")
            return False
            
        try:
            print("Testing Resume Analyze API (AI endpoint - may take 15-30 seconds)...")
            payload = {"resumeId": self.test_resume_id}
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/resume/analyze", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                if 'analysis' in data and 'resumeId' in data:
                    analysis_length = len(data['analysis'])
                    self.log_test("Resume Analyze", True, 
                        f"Analysis completed in {duration:.1f}s, Length: {analysis_length} chars")
                    return True
                else:
                    self.log_test("Resume Analyze", False, f"Missing analysis or resumeId: {data}")
                    return False
            elif response.status_code == 404:
                self.log_test("Resume Analyze", False, "Resume not found (404)")
                return False
            else:
                self.log_test("Resume Analyze", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Resume Analyze", False, f"Exception: {str(e)}")
            return False
    
    def test_get_resumes(self) -> bool:
        """Test GET /api/resumes - List all resumes"""
        try:
            print("Testing Get Resumes API...")
            response = self.session.get(f"{self.base_url}/resumes")
            
            if response.status_code == 200:
                data = response.json()
                if 'resumes' in data and isinstance(data['resumes'], list):
                    resume_count = len(data['resumes'])
                    self.log_test("Get Resumes", True, f"Retrieved {resume_count} resumes")
                    return True
                else:
                    self.log_test("Get Resumes", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Get Resumes", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Resumes", False, f"Exception: {str(e)}")
            return False
    
    def test_get_specific_resume(self) -> bool:
        """Test GET /api/resume/{resumeId} - Get specific resume"""
        if not self.test_resume_id:
            self.log_test("Get Specific Resume", False, "No test resume ID available from upload test")
            return False
            
        try:
            print("Testing Get Specific Resume API...")
            response = self.session.get(f"{self.base_url}/resume/{self.test_resume_id}")
            
            if response.status_code == 200:
                data = response.json()
                if 'resume' in data:
                    resume = data['resume']
                    if resume.get('id') == self.test_resume_id and 'textContent' in resume:
                        file_name = resume.get('fileName', 'Unknown')
                        self.log_test("Get Specific Resume", True, f"Resume found: {file_name}")
                        return True
                    else:
                        self.log_test("Get Specific Resume", False, "Resume structure invalid")
                        return False
                else:
                    self.log_test("Get Specific Resume", False, f"No resume in response: {data}")
                    return False
            elif response.status_code == 404:
                self.log_test("Get Specific Resume", False, "Resume not found (404)")
                return False
            else:
                self.log_test("Get Specific Resume", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Specific Resume", False, f"Exception: {str(e)}")
            return False
    
    def test_mock_interview_start(self) -> bool:
        """Test POST /api/mock-interview/start - Start mock interview"""
        try:
            print("Testing Mock Interview Start API (AI endpoint - may take 15-30 seconds)...")
            payload = {
                "role": "Senior Software Engineer",
                "level": "senior-level", 
                "type": "technical"
            }
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/mock-interview/start", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['sessionId', 'question', 'questionNumber']
                
                if all(field in data for field in required_fields):
                    self.test_interview_session_id = data['sessionId']  # Store for later test
                    question_num = data['questionNumber']
                    question_preview = data['question'][:100] + "..." if len(data['question']) > 100 else data['question']
                    
                    self.log_test("Mock Interview Start", True, 
                        f"Started in {duration:.1f}s, Question #{question_num}, SessionID: {self.test_interview_session_id}")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Mock Interview Start", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_test("Mock Interview Start", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Mock Interview Start", False, f"Exception: {str(e)}")
            return False
    
    def test_mock_interview_respond(self) -> bool:
        """Test POST /api/mock-interview/respond - Respond to interview"""
        if not self.test_interview_session_id:
            self.log_test("Mock Interview Respond", False, "No test interview session ID available")
            return False
            
        try:
            print("Testing Mock Interview Respond API (AI endpoint - may take 15-30 seconds)...")
            payload = {
                "sessionId": self.test_interview_session_id,
                "answer": "I have 5+ years of experience in software development, specializing in backend systems using Python and distributed architectures. I've led teams of 3-5 developers and have experience with microservices, cloud platforms like AWS, and have delivered several high-impact projects that improved system performance by 40%."
            }
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/mock-interview/respond", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['sessionId', 'feedback', 'questionNumber']
                
                if all(field in data for field in required_fields):
                    question_num = data['questionNumber']
                    is_complete = data.get('isComplete', False)
                    feedback_preview = data['feedback'][:150] + "..." if len(data['feedback']) > 150 else data['feedback']
                    
                    self.log_test("Mock Interview Respond", True, 
                        f"Response processed in {duration:.1f}s, Question #{question_num}, Complete: {is_complete}")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Mock Interview Respond", False, f"Missing fields: {missing}")
                    return False
            elif response.status_code == 404:
                self.log_test("Mock Interview Respond", False, "Session not found (404)")
                return False
            else:
                self.log_test("Mock Interview Respond", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Mock Interview Respond", False, f"Exception: {str(e)}")
            return False
    
    def test_career_paths_explore(self) -> bool:
        """Test POST /api/career-paths/explore - Explore career paths"""
        try:
            print("Testing Career Paths Explore API (AI endpoint - may take 15-30 seconds)...")
            payload = {
                "interests": "Machine Learning and AI",
                "skills": "Python, TensorFlow, Data Analysis, SQL",
                "experience": "3 years in data science"
            }
            
            start_time = time.time()
            response = self.session.post(f"{self.base_url}/career-paths/explore", json=payload)
            duration = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                if 'paths' in data:
                    paths_length = len(data['paths'])
                    models_used = data.get('models', [])
                    
                    self.log_test("Career Paths Explore", True, 
                        f"Completed in {duration:.1f}s, Response length: {paths_length} chars, Models: {models_used}")
                    return True
                else:
                    self.log_test("Career Paths Explore", False, f"No paths in response: {data}")
                    return False
            else:
                self.log_test("Career Paths Explore", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Career Paths Explore", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_session(self) -> bool:
        """Test DELETE /api/chat/sessions/{sessionId} - Delete a session"""
        if not self.test_session_id:
            self.log_test("Delete Session", False, "No test session ID available to delete")
            return False
            
        try:
            print("Testing Delete Session API...")
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

    def run_all_tests(self):
        """Run all backend tests in logical order"""
        print("=" * 80)
        print("CareerGPT Backend API Testing")
        print(f"Base URL: {self.base_url}")
        print("=" * 80)
        
        # Test results tracking
        results = {}
        
        # Run tests in logical dependency order
        tests = [
            ("Health Check", self.test_health_check),
            ("Chat Send", self.test_chat_send),
            ("Get Sessions", self.test_get_sessions), 
            ("Get Specific Session", self.test_get_specific_session),
            ("Resume Upload", self.test_resume_upload),
            ("Resume Analyze", self.test_resume_analyze),
            ("Get Resumes", self.test_get_resumes),
            ("Get Specific Resume", self.test_get_specific_resume),
            ("Mock Interview Start", self.test_mock_interview_start),
            ("Mock Interview Respond", self.test_mock_interview_respond),
            ("Career Paths Explore", self.test_career_paths_explore),
            ("Delete Session", self.test_delete_session),
        ]
        
        for test_name, test_func in tests:
            try:
                results[test_name] = test_func()
            except Exception as e:
                print(f"❌ CRITICAL ERROR in {test_name}: {str(e)}")
                results[test_name] = False
            
            # Brief pause between tests
            time.sleep(1)
        
        # Summary
        print("=" * 80)
        print("TEST RESULTS SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in results.values() if r)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! CareerGPT Backend is fully functional.")
        else:
            failed_tests = [name for name, result in results.items() if not result]
            print(f"⚠️  FAILED TESTS: {', '.join(failed_tests)}")
        
        return results

if __name__ == "__main__":
    tester = CareerGPTTester()
    results = tester.run_all_tests()