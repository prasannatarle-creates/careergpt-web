#!/usr/bin/env python3
import requests
import json
import time
import tempfile
import os
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://jobseeker-ai-lab.preview.emergentagent.com/api"

class CareerGPTTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        self.test_results = {}
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        self.test_results[test_name] = {
            "success": success,
            "details": details,
            "response_data": response_data
        }
    
    def make_request(self, method: str, endpoint: str, data: Any = None, files: Any = None, 
                    timeout: int = 30, use_auth: bool = False) -> Dict[str, Any]:
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"} if not files else {}
        
        if use_auth and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method == "GET":
                response = self.session.get(url, headers=headers, timeout=timeout)
            elif method == "POST":
                if files:
                    headers.pop("Content-Type", None)  # Let requests set it for multipart
                    response = self.session.post(url, headers=headers, files=files, timeout=timeout)
                else:
                    response = self.session.post(url, headers=headers, json=data, timeout=timeout)
            elif method == "PUT":
                response = self.session.put(url, headers=headers, json=data, timeout=timeout)
            elif method == "DELETE":
                response = self.session.delete(url, headers=headers, timeout=timeout)
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
            
            return {
                "status_code": response.status_code,
                "success": 200 <= response.status_code < 300,
                "data": response_data,
                "headers": dict(response.headers)
            }
        
        except Exception as e:
            return {
                "status_code": 500,
                "success": False,
                "data": {"error": str(e)},
                "headers": {}
            }
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        print("\n=== Testing Health Endpoint ===")
        response = self.make_request("GET", "/health")
        
        if response["success"] and response["data"].get("status") == "healthy":
            self.log_test("Health Check", True, "Health endpoint working correctly")
            return True
        else:
            self.log_test("Health Check", False, f"Health check failed: {response}")
            return False
    
    def test_models_endpoint(self):
        """Test models endpoint"""
        print("\n=== Testing Models Endpoint ===")
        response = self.make_request("GET", "/models")
        
        if response["success"]:
            models = response["data"].get("models", [])
            if len(models) == 5:
                model_names = [m.get("name") for m in models]
                self.log_test("Models API", True, f"Retrieved 5 models: {model_names}")
                return True
            else:
                self.log_test("Models API", False, f"Expected 5 models, got {len(models)}")
                return False
        else:
            self.log_test("Models API", False, f"Models endpoint failed: {response}")
            return False
    
    def test_auth_register(self):
        """Test user registration"""
        print("\n=== Testing User Registration ===")
        
        # Use realistic test data
        test_user = {
            "name": "Alex Johnson",
            "email": "alex.johnson@test.com",
            "password": "SecurePass123"
        }
        
        response = self.make_request("POST", "/auth/register", test_user)
        
        if response["success"]:
            data = response["data"]
            if "token" in data and "user" in data:
                self.auth_token = data["token"]
                self.user_data = data["user"]
                self.log_test("Auth Register", True, f"User registered successfully: {data['user']['email']}")
                return True
            else:
                self.log_test("Auth Register", False, f"Missing token or user in response: {data}")
                return False
        else:
            self.log_test("Auth Register", False, f"Registration failed: {response}")
            return False
    
    def test_auth_login(self):
        """Test user login"""
        print("\n=== Testing User Login ===")
        
        login_data = {
            "email": "alex.johnson@test.com", 
            "password": "SecurePass123"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response["success"]:
            data = response["data"]
            if "token" in data and "user" in data:
                # Verify token works
                login_token = data["token"]
                self.log_test("Auth Login", True, f"Login successful for: {data['user']['email']}")
                return True
            else:
                self.log_test("Auth Login", False, f"Missing token or user in response: {data}")
                return False
        else:
            self.log_test("Auth Login", False, f"Login failed: {response}")
            return False
    
    def test_profile_get(self):
        """Test getting user profile"""
        print("\n=== Testing Get Profile ===")
        
        response = self.make_request("GET", "/profile", use_auth=True)
        
        if response["success"]:
            data = response["data"]
            if "user" in data and "stats" in data:
                user = data["user"]
                stats = data["stats"]
                self.log_test("Profile Get", True, 
                    f"Profile retrieved for {user.get('name')} with stats: {list(stats.keys())}")
                return True
            else:
                self.log_test("Profile Get", False, f"Missing user or stats in profile: {data}")
                return False
        else:
            self.log_test("Profile Get", False, f"Get profile failed: {response}")
            return False
    
    def test_profile_update(self):
        """Test updating user profile"""
        print("\n=== Testing Update Profile ===")
        
        profile_data = {
            "profile": {
                "skills": ["Python", "React", "JavaScript", "Node.js"],
                "interests": ["AI", "Machine Learning", "Web Development"], 
                "education": "B.Tech Computer Science",
                "experience": "3 years as Software Developer"
            }
        }
        
        response = self.make_request("PUT", "/profile", profile_data, use_auth=True)
        
        if response["success"]:
            data = response["data"]
            if data.get("success"):
                self.log_test("Profile Update", True, "Profile updated successfully")
                return True
            else:
                self.log_test("Profile Update", False, f"Profile update response: {data}")
                return False
        else:
            self.log_test("Profile Update", False, f"Profile update failed: {response}")
            return False
    
    def test_chat_send(self):
        """Test sending chat message with AI models"""
        print("\n=== Testing Chat Send (AI) ===")
        
        chat_data = {
            "message": "What are the key skills needed for a Python developer role?",
            "activeModels": ["GPT-4.1"]  # Use single model for speed
        }
        
        response = self.make_request("POST", "/chat/send", chat_data, use_auth=True, timeout=90)
        
        if response["success"]:
            data = response["data"]
            if "sessionId" in data and "response" in data and "models" in data:
                session_id = data["sessionId"]
                ai_response = data["response"][:100] + "..." if len(data["response"]) > 100 else data["response"]
                self.log_test("Chat Send", True, 
                    f"AI response received from {len(data['models'])} models. Session: {session_id}")
                return True, session_id
            else:
                self.log_test("Chat Send", False, f"Missing fields in chat response: {data}")
                return False, None
        else:
            self.log_test("Chat Send", False, f"Chat send failed: {response}")
            return False, None
    
    def test_chat_sessions(self):
        """Test getting chat sessions"""
        print("\n=== Testing Get Chat Sessions ===")
        
        response = self.make_request("GET", "/chat/sessions", use_auth=True)
        
        if response["success"]:
            data = response["data"]
            if "sessions" in data:
                sessions = data["sessions"]
                self.log_test("Chat Sessions", True, f"Retrieved {len(sessions)} chat sessions")
                return True
            else:
                self.log_test("Chat Sessions", False, f"Missing sessions in response: {data}")
                return False
        else:
            self.log_test("Chat Sessions", False, f"Get sessions failed: {response}")
            return False
    
    def test_resume_upload(self):
        """Test resume file upload"""
        print("\n=== Testing Resume Upload ===")
        
        # Create test resume file
        resume_content = """
ALEX JOHNSON
Software Developer
Email: alex.johnson@test.com | Phone: (555) 123-4567

EXPERIENCE
Software Developer | TechCorp Inc. | 2021-Present
• Developed web applications using Python, Django, and React
• Built RESTful APIs handling 10k+ daily requests
• Implemented automated testing reducing bugs by 40%
• Collaborated with cross-functional teams in Agile environment

Junior Developer | StartupXYZ | 2020-2021
• Created responsive web interfaces using HTML, CSS, JavaScript
• Integrated third-party APIs and payment systems
• Participated in code reviews and maintained documentation

EDUCATION
Bachelor of Technology in Computer Science
State University | 2016-2020 | GPA: 3.8/4.0

SKILLS
• Programming: Python, JavaScript, Java, SQL
• Frontend: React, HTML5, CSS3, Bootstrap
• Backend: Django, Node.js, Express.js
• Database: PostgreSQL, MongoDB
• Tools: Git, Docker, AWS, Jenkins

PROJECTS
E-Commerce Platform (2021)
• Built full-stack web application with React and Django
• Implemented user authentication and payment processing
• Deployed on AWS with CI/CD pipeline

Task Management App (2020)  
• Developed mobile-responsive task tracker
• Used React hooks and context for state management
• Integrated with Firebase for real-time updates
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(resume_content)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('resume.txt', f, 'text/plain')}
                response = self.make_request("POST", "/resume/upload", files=files, use_auth=True)
            
            if response["success"]:
                data = response["data"]
                if "resumeId" in data and "fileName" in data:
                    resume_id = data["resumeId"]
                    self.log_test("Resume Upload", True, 
                        f"Resume uploaded successfully. ID: {resume_id}, File: {data['fileName']}")
                    return True, resume_id
                else:
                    self.log_test("Resume Upload", False, f"Missing resumeId or fileName: {data}")
                    return False, None
            else:
                self.log_test("Resume Upload", False, f"Resume upload failed: {response}")
                return False, None
        
        finally:
            os.unlink(temp_path)
    
    def test_resume_analyze(self, resume_id: str):
        """Test ATS resume analysis"""
        print("\n=== Testing Resume ATS Analysis ===")
        
        analyze_data = {
            "resumeId": resume_id,
            "targetRole": "Software Engineer"
        }
        
        response = self.make_request("POST", "/resume/analyze", analyze_data, use_auth=True, timeout=90)
        
        if response["success"]:
            data = response["data"]
            if "analysis" in data:
                analysis = data["analysis"]
                # Check for structured JSON response
                required_fields = ["atsScore", "sections", "keywords", "strengths", "weaknesses"]
                missing_fields = [field for field in required_fields if field not in analysis]
                
                if not missing_fields:
                    ats_score = analysis.get("atsScore", 0)
                    self.log_test("Resume ATS Analysis", True, 
                        f"ATS analysis complete. Score: {ats_score}/100. Structured JSON returned.")
                    return True
                else:
                    self.log_test("Resume ATS Analysis", False, 
                        f"Missing required fields in analysis: {missing_fields}")
                    return False
            else:
                self.log_test("Resume ATS Analysis", False, f"Missing analysis in response: {data}")
                return False
        else:
            self.log_test("Resume ATS Analysis", False, f"Resume analysis failed: {response}")
            return False
    
    def test_career_path_generate(self):
        """Test career path generation"""
        print("\n=== Testing Career Path Generation ===")
        
        career_data = {
            "skills": "Python,React,JavaScript,Django",
            "interests": "AI,Machine Learning,Web Development",
            "education": "B.Tech Computer Science",
            "experience": "3 years Software Developer"
        }
        
        response = self.make_request("POST", "/career-path/generate", career_data, use_auth=True, timeout=90)
        
        if response["success"]:
            data = response["data"]
            if "careerPath" in data:
                career_path = data["careerPath"]
                # Check for structured response
                required_fields = ["title", "summary", "matchScore", "timeline"]
                missing_fields = [field for field in required_fields if field not in career_path]
                
                if not missing_fields:
                    title = career_path.get("title", "")
                    match_score = career_path.get("matchScore", 0)
                    self.log_test("Career Path Generate", True, 
                        f"Career path generated: '{title}' with {match_score}% match")
                    return True
                else:
                    self.log_test("Career Path Generate", False, 
                        f"Missing required fields: {missing_fields}")
                    return False
            else:
                self.log_test("Career Path Generate", False, f"Missing careerPath in response: {data}")
                return False
        else:
            self.log_test("Career Path Generate", False, f"Career path generation failed: {response}")
            return False
    
    def test_mock_interview_start(self):
        """Test starting mock interview"""
        print("\n=== Testing Mock Interview Start ===")
        
        interview_data = {
            "role": "Software Engineer",
            "level": "mid-level", 
            "type": "behavioral"
        }
        
        response = self.make_request("POST", "/mock-interview/start", interview_data, use_auth=True, timeout=90)
        
        if response["success"]:
            data = response["data"]
            if "sessionId" in data and "question" in data:
                session_id = data["sessionId"]
                question = data["question"][:100] + "..." if len(data["question"]) > 100 else data["question"]
                self.log_test("Mock Interview Start", True, 
                    f"Interview started. Session: {session_id}")
                return True, session_id
            else:
                self.log_test("Mock Interview Start", False, f"Missing sessionId or question: {data}")
                return False, None
        else:
            self.log_test("Mock Interview Start", False, f"Interview start failed: {response}")
            return False, None
    
    def test_mock_interview_respond(self, session_id: str):
        """Test responding to mock interview"""
        print("\n=== Testing Mock Interview Response ===")
        
        response_data = {
            "sessionId": session_id,
            "answer": "I would approach this challenge by first understanding the requirements, then breaking down the problem into smaller manageable tasks. I'd collaborate with team members to gather different perspectives and create a structured plan with clear timelines and deliverables."
        }
        
        response = self.make_request("POST", "/mock-interview/respond", response_data, use_auth=True, timeout=90)
        
        if response["success"]:
            data = response["data"]
            if "feedback" in data:
                feedback = data["feedback"]
                # Check for structured feedback
                required_fields = ["score", "maxScore", "feedback", "strengths", "improvements"]
                missing_fields = [field for field in required_fields if field not in feedback]
                
                if not missing_fields:
                    score = feedback.get("score", 0)
                    max_score = feedback.get("maxScore", 10)
                    self.log_test("Mock Interview Respond", True, 
                        f"Interview feedback received. Score: {score}/{max_score}")
                    return True
                else:
                    self.log_test("Mock Interview Respond", False, 
                        f"Missing required feedback fields: {missing_fields}")
                    return False
            else:
                self.log_test("Mock Interview Respond", False, f"Missing feedback in response: {data}")
                return False
        else:
            self.log_test("Mock Interview Respond", False, f"Interview response failed: {response}")
            return False
    
    def test_job_match(self):
        """Test job matching"""
        print("\n=== Testing Job Matching ===")
        
        job_data = {
            "skills": "Python,React,JavaScript,Django",
            "interests": "AI,Machine Learning,Web Development", 
            "experience": "3 years Software Developer",
            "targetIndustry": "Technology"
        }
        
        response = self.make_request("POST", "/job-match", job_data, use_auth=True, timeout=90)
        
        if response["success"]:
            data = response["data"]
            if "matches" in data:
                matches_data = data["matches"]
                if "matches" in matches_data:
                    matches = matches_data["matches"]
                    if len(matches) > 0:
                        first_match = matches[0]
                        role = first_match.get("role", "Unknown")
                        match_score = first_match.get("matchScore", 0)
                        self.log_test("Job Matching", True, 
                            f"Found {len(matches)} job matches. Top match: {role} ({match_score}%)")
                        return True
                    else:
                        self.log_test("Job Matching", False, "No job matches found")
                        return False
                else:
                    self.log_test("Job Matching", False, f"Missing matches array in response: {matches_data}")
                    return False
            else:
                self.log_test("Job Matching", False, f"Missing matches in response: {data}")
                return False
        else:
            self.log_test("Job Matching", False, f"Job matching failed: {response}")
            return False
    
    def test_admin_analytics(self):
        """Test admin analytics"""
        print("\n=== Testing Admin Analytics ===")
        
        response = self.make_request("GET", "/admin/analytics", use_auth=True)
        
        if response["success"]:
            data = response["data"]
            if "stats" in data:
                stats = data["stats"]
                required_stats = ["totalUsers", "totalResumes", "totalInterviews", "totalChats"]
                missing_stats = [stat for stat in required_stats if stat not in stats]
                
                if not missing_stats:
                    users = stats.get("totalUsers", 0)
                    resumes = stats.get("totalResumes", 0)
                    self.log_test("Admin Analytics", True, 
                        f"Analytics retrieved: {users} users, {resumes} resumes")
                    return True
                else:
                    self.log_test("Admin Analytics", False, f"Missing stats: {missing_stats}")
                    return False
            else:
                self.log_test("Admin Analytics", False, f"Missing stats in response: {data}")
                return False
        else:
            self.log_test("Admin Analytics", False, f"Analytics failed: {response}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print(f"\n🚀 Starting CareerGPT Backend Tests")
        print(f"Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Critical flow tests
        success_count = 0
        total_tests = 0
        
        # 1. Health check
        total_tests += 1
        if self.test_health_endpoint():
            success_count += 1
        
        # 2. Models API
        total_tests += 1
        if self.test_models_endpoint():
            success_count += 1
        
        # 3. Register user (required for auth)
        total_tests += 1
        if self.test_auth_register():
            success_count += 1
        else:
            print("❌ CRITICAL: Registration failed - skipping auth-required tests")
            self.print_summary(success_count, total_tests)
            return
        
        # 4. Login user
        total_tests += 1
        if self.test_auth_login():
            success_count += 1
        
        # 5. Get profile
        total_tests += 1
        if self.test_profile_get():
            success_count += 1
        
        # 6. Update profile  
        total_tests += 1
        if self.test_profile_update():
            success_count += 1
        
        # 7. Chat with AI
        total_tests += 1
        chat_success, session_id = self.test_chat_send()
        if chat_success:
            success_count += 1
        
        # 8. Get chat sessions
        total_tests += 1
        if self.test_chat_sessions():
            success_count += 1
        
        # 9. Resume upload and analysis
        total_tests += 1
        upload_success, resume_id = self.test_resume_upload()
        if upload_success:
            success_count += 1
            
            # 10. Resume ATS analysis
            total_tests += 1
            if self.test_resume_analyze(resume_id):
                success_count += 1
        else:
            total_tests += 1  # Count the skipped analysis test
        
        # 11. Career path generation
        total_tests += 1
        if self.test_career_path_generate():
            success_count += 1
        
        # 12. Mock interview start and respond
        total_tests += 1
        interview_success, interview_session = self.test_mock_interview_start()
        if interview_success:
            success_count += 1
            
            # 13. Mock interview respond
            total_tests += 1
            if self.test_mock_interview_respond(interview_session):
                success_count += 1
        else:
            total_tests += 1  # Count the skipped respond test
        
        # 14. Job matching
        total_tests += 1
        if self.test_job_match():
            success_count += 1
        
        # 15. Admin analytics
        total_tests += 1
        if self.test_admin_analytics():
            success_count += 1
        
        self.print_summary(success_count, total_tests)
    
    def print_summary(self, success_count: int, total_tests: int):
        """Print test summary"""
        print("\n" + "=" * 60)
        print(f"🏁 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {success_count}")
        print(f"Failed: {total_tests - success_count}")
        print(f"Success Rate: {(success_count/total_tests)*100:.1f}%")
        
        if success_count == total_tests:
            print("🎉 ALL TESTS PASSED!")
        elif success_count / total_tests >= 0.8:
            print("✅ Most tests passed - system is largely functional")
        else:
            print("⚠️  Multiple failures detected - needs attention")
        
        # Print failed tests
        failed_tests = [name for name, result in self.test_results.items() if not result["success"]]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  - {test}: {self.test_results[test]['details']}")
        
        print("=" * 60)


if __name__ == "__main__":
    tester = CareerGPTTester()
    tester.run_all_tests()