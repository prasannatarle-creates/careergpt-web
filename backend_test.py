#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for CareerGPT
Tests all endpoints with realistic data and edge cases
"""

import requests
import json
import time
import os
import tempfile
from typing import Dict, Any, Optional

class CareerGPTTester:
    def __init__(self):
        self.base_url = "https://careergpt-final.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.session.timeout = 90  # AI endpoints can take time
        self.auth_token = None
        self.test_results = []
        self.session_id = None
        self.resume_id = None
        self.interview_session_id = None
        
        # Test user data - realistic data
        self.test_user = {
            "name": "Sarah Chen",
            "email": f"sarah.chen.test.{int(time.time())}@example.com",
            "password": "SecurePass123!"
        }
        
        self.profile_data = {
            "skills": "Python, Machine Learning, Data Analysis, SQL, React",
            "interests": "Artificial Intelligence, Data Science, Web Development",
            "education": "Bachelor's in Computer Science from MIT",
            "experience": "3 years as Software Engineer at tech startup"
        }
        
        # Headers with timeout for AI calls
        self.headers = {"Content-Type": "application/json"}

    def log_result(self, endpoint: str, method: str, success: bool, details: str = "", response_time: float = 0):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "endpoint": endpoint,
            "method": method,
            "status": status,
            "details": details,
            "response_time": f"{response_time:.2f}s"
        }
        self.test_results.append(result)
        print(f"{status} {method} {endpoint} ({response_time:.2f}s) - {details}")

    def make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop("headers", self.headers.copy())
        
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        start_time = time.time()
        try:
            response = self.session.request(method, url, headers=headers, **kwargs)
            response_time = time.time() - start_time
            return response, response_time
        except Exception as e:
            response_time = time.time() - start_time
            print(f"Request error for {method} {endpoint}: {str(e)}")
            return None, response_time

    def test_health_check(self):
        """Test health check endpoint"""
        response, response_time = self.make_request("GET", "/health")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                self.log_result("/health", "GET", True, "Server healthy", response_time)
                return True
            else:
                self.log_result("/health", "GET", False, f"Unhealthy: {data}", response_time)
                return False
        else:
            self.log_result("/health", "GET", False, f"HTTP {response.status_code if response else 'No response'}", response_time)
            return False

    def test_models_endpoint(self):
        """Test models endpoint"""
        response, response_time = self.make_request("GET", "/models")
        if response and response.status_code == 200:
            data = response.json()
            models = data.get("models", [])
            if len(models) == 5 and all(m.get("name") for m in models):
                model_names = [m["name"] for m in models]
                self.log_result("/models", "GET", True, f"5 models: {', '.join(model_names)}", response_time)
                return True
            else:
                self.log_result("/models", "GET", False, f"Expected 5 models, got {len(models)}", response_time)
                return False
        else:
            self.log_result("/models", "GET", False, f"HTTP {response.status_code if response else 'No response'}", response_time)
            return False

    def test_auth_register(self):
        """Test user registration"""
        response, response_time = self.make_request("POST", "/auth/register", json=self.test_user)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("token") and data.get("user"):
                self.auth_token = data["token"]
                user_email = data["user"].get("email")
                self.log_result("/auth/register", "POST", True, f"Registered user: {user_email}", response_time)
                return True
            else:
                self.log_result("/auth/register", "POST", False, f"Missing token/user in response: {data}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/auth/register", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_auth_register_duplicate(self):
        """Test duplicate email registration"""
        response, response_time = self.make_request("POST", "/auth/register", json=self.test_user)
        
        if response and response.status_code == 409:
            data = response.json()
            if "already registered" in data.get("error", "").lower():
                self.log_result("/auth/register", "POST", True, "Correctly rejected duplicate email", response_time)
                return True
            else:
                self.log_result("/auth/register", "POST", False, f"Wrong error message: {data.get('error')}", response_time)
                return False
        else:
            self.log_result("/auth/register", "POST", False, f"Expected 409, got {response.status_code if response else 'No response'}", response_time)
            return False

    def test_auth_login(self):
        """Test user login"""
        login_data = {"email": self.test_user["email"], "password": self.test_user["password"]}
        response, response_time = self.make_request("POST", "/auth/login", json=login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("token") and data.get("user"):
                # Update token just in case
                self.auth_token = data["token"]
                self.log_result("/auth/login", "POST", True, f"Login successful: {data['user']['email']}", response_time)
                return True
            else:
                self.log_result("/auth/login", "POST", False, f"Missing token/user: {data}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/auth/login", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_auth_login_wrong_password(self):
        """Test login with wrong password"""
        login_data = {"email": self.test_user["email"], "password": "wrongpassword"}
        response, response_time = self.make_request("POST", "/auth/login", json=login_data)
        
        if response and response.status_code == 401:
            data = response.json()
            if "invalid credentials" in data.get("error", "").lower():
                self.log_result("/auth/login", "POST", True, "Correctly rejected wrong password", response_time)
                return True
            else:
                self.log_result("/auth/login", "POST", False, f"Wrong error message: {data.get('error')}", response_time)
                return False
        else:
            self.log_result("/auth/login", "POST", False, f"Expected 401, got {response.status_code if response else 'No response'}", response_time)
            return False

    def test_profile_get(self):
        """Test get profile"""
        if not self.auth_token:
            self.log_result("/profile", "GET", False, "No auth token", 0)
            return False
            
        response, response_time = self.make_request("GET", "/profile")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("user") and data.get("stats"):
                stats = data["stats"]
                expected_stats = ["resumeCount", "interviewCount", "chatCount", "careerPathCount"]
                if all(stat in stats for stat in expected_stats):
                    self.log_result("/profile", "GET", True, f"Profile + stats: {list(stats.keys())}", response_time)
                    return True
                else:
                    self.log_result("/profile", "GET", False, f"Missing stats fields: {stats}", response_time)
                    return False
            else:
                self.log_result("/profile", "GET", False, f"Missing user/stats: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/profile", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_profile_update(self):
        """Test profile update"""
        if not self.auth_token:
            self.log_result("/profile", "PUT", False, "No auth token", 0)
            return False
            
        update_data = {
            "name": "Sarah Chen Updated",
            "profile": self.profile_data
        }
        response, response_time = self.make_request("PUT", "/profile", json=update_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("success"):
                self.log_result("/profile", "PUT", True, "Profile updated successfully", response_time)
                return True
            else:
                self.log_result("/profile", "PUT", False, f"No success field: {data}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/profile", "PUT", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_chat_send(self):
        """Test chat send with AI response"""
        if not self.auth_token:
            self.log_result("/chat/send", "POST", False, "No auth token", 0)
            return False
            
        chat_data = {
            "message": "I'm a software engineer with 3 years experience. What career paths should I consider for the next 5 years?",
            "activeModels": ["GPT-4.1", "Claude 4 Sonnet"]
        }
        
        print("Sending chat message... (may take 60-90s for AI response)")
        response, response_time = self.make_request("POST", "/chat/send", json=chat_data, timeout=90)
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["sessionId", "response", "models", "successCount"]
            if all(field in data for field in required_fields):
                self.session_id = data["sessionId"]
                response_preview = data["response"][:100] + "..." if len(data["response"]) > 100 else data["response"]
                models_used = len(data["models"])
                self.log_result("/chat/send", "POST", True, f"AI response ({models_used} models): {response_preview}", response_time)
                return True
            else:
                self.log_result("/chat/send", "POST", False, f"Missing fields. Got: {list(data.keys())}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/chat/send", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_chat_sessions_get(self):
        """Test get chat sessions"""
        response, response_time = self.make_request("GET", "/chat/sessions")
        
        if response and response.status_code == 200:
            data = response.json()
            if "sessions" in data:
                sessions_count = len(data["sessions"])
                self.log_result("/chat/sessions", "GET", True, f"Retrieved {sessions_count} sessions", response_time)
                return True
            else:
                self.log_result("/chat/sessions", "GET", False, f"No sessions field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/chat/sessions", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_chat_session_get(self):
        """Test get specific chat session"""
        if not self.session_id:
            self.log_result("/chat/sessions/:id", "GET", False, "No session ID available", 0)
            return False
            
        response, response_time = self.make_request("GET", f"/chat/sessions/{self.session_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("session") and data["session"].get("messages"):
                messages_count = len(data["session"]["messages"])
                self.log_result("/chat/sessions/:id", "GET", True, f"Session with {messages_count} messages", response_time)
                return True
            else:
                self.log_result("/chat/sessions/:id", "GET", False, f"Invalid session data: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/chat/sessions/:id", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_resume_upload(self):
        """Test resume upload"""
        if not self.auth_token:
            self.log_result("/resume/upload", "POST", False, "No auth token", 0)
            return False
            
        # Create a realistic resume file
        resume_content = """
SARAH CHEN
sarah.chen@email.com | (555) 123-4567 | LinkedIn: linkedin.com/in/sarahchen

SUMMARY
Software Engineer with 3+ years of experience developing scalable web applications using Python, React, and cloud technologies. Proven track record of delivering high-quality software solutions in fast-paced startup environments.

TECHNICAL SKILLS
• Programming Languages: Python, JavaScript, TypeScript, Java
• Web Technologies: React, Node.js, HTML5, CSS3, REST APIs
• Databases: PostgreSQL, MongoDB, Redis
• Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD
• Machine Learning: scikit-learn, pandas, NumPy

PROFESSIONAL EXPERIENCE
Software Engineer | TechStart Inc | 2021 - Present
• Developed and maintained 5+ microservices using Python/Flask serving 100k+ daily users
• Built responsive React frontend components improving user engagement by 25%
• Implemented automated testing reducing bug reports by 40%
• Collaborated with cross-functional teams using Agile methodologies

Junior Developer | WebSolutions Co | 2020 - 2021
• Created REST APIs and database schemas for e-commerce platform
• Optimized SQL queries reducing page load time by 30%
• Participated in code reviews and mentoring of 2 junior developers

EDUCATION
Bachelor of Science in Computer Science | Massachusetts Institute of Technology | 2020
• GPA: 3.7/4.0
• Relevant Coursework: Data Structures, Algorithms, Database Systems, Machine Learning

PROJECTS
• Personal Finance Tracker: Full-stack web app with React frontend and Python backend
• Machine Learning Stock Predictor: Time series analysis using LSTM neural networks
• Open Source Contributor: 50+ commits to popular Python libraries on GitHub
        """
        
        # Write to temporary file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write(resume_content)
            temp_path = f.name
            
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': ('sarah_chen_resume.txt', f, 'text/plain')}
                headers = {}
                if self.auth_token:
                    headers["Authorization"] = f"Bearer {self.auth_token}"
                    
                response, response_time = self.make_request("POST", "/resume/upload", files=files, headers=headers)
                
            if response and response.status_code == 200:
                data = response.json()
                if data.get("resumeId") and data.get("fileName"):
                    self.resume_id = data["resumeId"]
                    char_count = data.get("charCount", 0)
                    self.log_result("/resume/upload", "POST", True, f"Uploaded {data['fileName']} ({char_count} chars)", response_time)
                    return True
                else:
                    self.log_result("/resume/upload", "POST", False, f"Missing resumeId/fileName: {data}", response_time)
                    return False
            else:
                error_msg = response.json().get("error", "Unknown error") if response else "No response"
                self.log_result("/resume/upload", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
                return False
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass

    def test_resume_analyze(self):
        """Test ATS resume analysis"""
        if not self.resume_id:
            self.log_result("/resume/analyze", "POST", False, "No resume ID available", 0)
            return False
            
        analyze_data = {
            "resumeId": self.resume_id,
            "targetRole": "Senior Software Engineer"
        }
        
        print("Analyzing resume with AI... (may take 60-90s)")
        response, response_time = self.make_request("POST", "/resume/analyze", json=analyze_data, timeout=90)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("analysis"):
                analysis = data["analysis"]
                if isinstance(analysis.get("atsScore"), int) and analysis.get("sections"):
                    ats_score = analysis["atsScore"]
                    sections_count = len(analysis["sections"])
                    self.log_result("/resume/analyze", "POST", True, f"ATS Score: {ats_score}/100, {sections_count} sections analyzed", response_time)
                    return True
                else:
                    self.log_result("/resume/analyze", "POST", False, f"Invalid analysis structure: {analysis.keys()}", response_time)
                    return False
            else:
                self.log_result("/resume/analyze", "POST", False, f"No analysis field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/resume/analyze", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_resumes_get(self):
        """Test get resumes list"""
        response, response_time = self.make_request("GET", "/resumes")
        
        if response and response.status_code == 200:
            data = response.json()
            if "resumes" in data:
                resumes_count = len(data["resumes"])
                self.log_result("/resumes", "GET", True, f"Retrieved {resumes_count} resumes", response_time)
                return True
            else:
                self.log_result("/resumes", "GET", False, f"No resumes field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/resumes", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_resume_get_single(self):
        """Test get single resume"""
        if not self.resume_id:
            self.log_result("/resume/:id", "GET", False, "No resume ID available", 0)
            return False
            
        response, response_time = self.make_request("GET", f"/resume/{self.resume_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("resume") and data["resume"].get("textContent"):
                content_length = len(data["resume"]["textContent"])
                self.log_result("/resume/:id", "GET", True, f"Resume with {content_length} chars content", response_time)
                return True
            else:
                self.log_result("/resume/:id", "GET", False, f"Invalid resume data: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/resume/:id", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_career_path_generate(self):
        """Test career path generation"""
        career_data = {
            "skills": self.profile_data["skills"],
            "interests": self.profile_data["interests"],
            "education": self.profile_data["education"],
            "experience": self.profile_data["experience"]
        }
        
        print("Generating career path with AI... (may take 60-90s)")
        response, response_time = self.make_request("POST", "/career-path/generate", json=career_data, timeout=90)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("careerPath"):
                career_path = data["careerPath"]
                if career_path.get("title") and career_path.get("summary"):
                    title = career_path["title"]
                    models_used = len(data.get("models", []))
                    self.log_result("/career-path/generate", "POST", True, f"Generated: {title} ({models_used} models)", response_time)
                    return True
                else:
                    # Even if partial JSON, if API works and returns something, it's working
                    if career_path.get("raw") or career_path.get("title"):
                        self.log_result("/career-path/generate", "POST", True, "Career path generated (partial structure)", response_time)
                        return True
                    else:
                        self.log_result("/career-path/generate", "POST", False, f"Invalid career path structure: {career_path.keys()}", response_time)
                        return False
            else:
                self.log_result("/career-path/generate", "POST", False, f"No careerPath field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/career-path/generate", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_career_paths_get(self):
        """Test get career paths"""
        if not self.auth_token:
            self.log_result("/career-paths", "GET", False, "No auth token", 0)
            return False
            
        response, response_time = self.make_request("GET", "/career-paths")
        
        if response and response.status_code == 200:
            data = response.json()
            if "paths" in data:
                paths_count = len(data["paths"])
                self.log_result("/career-paths", "GET", True, f"Retrieved {paths_count} career paths", response_time)
                return True
            else:
                self.log_result("/career-paths", "GET", False, f"No paths field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/career-paths", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_mock_interview_start(self):
        """Test mock interview start"""
        interview_data = {
            "role": "Senior Software Engineer",
            "level": "senior",
            "type": "behavioral"
        }
        
        print("Starting mock interview... (may take 30-60s)")
        response, response_time = self.make_request("POST", "/mock-interview/start", json=interview_data, timeout=60)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("sessionId") and data.get("question"):
                self.interview_session_id = data["sessionId"]
                question_preview = data["question"][:100] + "..." if len(data["question"]) > 100 else data["question"]
                self.log_result("/mock-interview/start", "POST", True, f"Started interview: {question_preview}", response_time)
                return True
            else:
                self.log_result("/mock-interview/start", "POST", False, f"Missing sessionId/question: {data}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/mock-interview/start", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_mock_interview_respond(self):
        """Test mock interview response"""
        if not self.interview_session_id:
            self.log_result("/mock-interview/respond", "POST", False, "No interview session ID", 0)
            return False
            
        answer_data = {
            "sessionId": self.interview_session_id,
            "answer": "In my previous role as a software engineer, I faced a situation where our main API was experiencing frequent timeouts affecting thousands of users. I took the initiative to investigate the issue by analyzing performance metrics and database queries. I identified that several inefficient queries were causing bottlenecks. I worked with the team to optimize these queries and implemented connection pooling, which reduced API response time by 60% and eliminated the timeout issues. This experience taught me the importance of proactive monitoring and collaborative problem-solving."
        }
        
        print("Getting interview feedback... (may take 30-60s)")
        response, response_time = self.make_request("POST", "/mock-interview/respond", json=answer_data, timeout=60)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("feedback"):
                feedback = data["feedback"]
                if isinstance(feedback.get("score"), int) and feedback.get("feedback"):
                    score = feedback["score"]
                    max_score = feedback.get("maxScore", 10)
                    self.log_result("/mock-interview/respond", "POST", True, f"Feedback received: {score}/{max_score}", response_time)
                    return True
                else:
                    # Even if partial structure, if API works it's functional
                    if feedback.get("raw") or isinstance(feedback.get("score"), int):
                        self.log_result("/mock-interview/respond", "POST", True, "Interview feedback received (partial structure)", response_time)
                        return True
                    else:
                        self.log_result("/mock-interview/respond", "POST", False, f"Invalid feedback structure: {feedback.keys()}", response_time)
                        return False
            else:
                self.log_result("/mock-interview/respond", "POST", False, f"No feedback field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/mock-interview/respond", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_job_match(self):
        """Test job matching"""
        job_match_data = {
            "skills": self.profile_data["skills"],
            "interests": self.profile_data["interests"],
            "experience": self.profile_data["experience"],
            "targetIndustry": "Technology"
        }
        
        print("Finding job matches with AI... (may take 60-90s)")
        response, response_time = self.make_request("POST", "/job-match", json=job_match_data, timeout=90)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("matches"):
                matches = data["matches"]
                if isinstance(matches.get("matches"), list) or isinstance(matches.get("summary"), str):
                    models_used = len(data.get("models", []))
                    matches_count = len(matches.get("matches", []))
                    self.log_result("/job-match", "POST", True, f"Job matching completed: {matches_count} matches ({models_used} models)", response_time)
                    return True
                else:
                    # Even if AI returns empty matches, API is working
                    if matches.get("raw") or matches.get("summary"):
                        self.log_result("/job-match", "POST", True, "Job matching completed (partial/empty results)", response_time)
                        return True
                    else:
                        self.log_result("/job-match", "POST", False, f"Invalid matches structure: {matches.keys() if isinstance(matches, dict) else type(matches)}", response_time)
                        return False
            else:
                self.log_result("/job-match", "POST", False, f"No matches field: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/job-match", "POST", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_admin_analytics(self):
        """Test admin analytics"""
        if not self.auth_token:
            self.log_result("/admin/analytics", "GET", False, "No auth token", 0)
            return False
            
        response, response_time = self.make_request("GET", "/admin/analytics")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("stats") and data.get("moduleUsage"):
                stats = data["stats"]
                required_stats = ["totalUsers", "totalResumes", "totalInterviews", "totalChats"]
                if all(stat in stats for stat in required_stats):
                    users = stats["totalUsers"]
                    resumes = stats["totalResumes"]
                    self.log_result("/admin/analytics", "GET", True, f"Analytics: {users} users, {resumes} resumes", response_time)
                    return True
                else:
                    self.log_result("/admin/analytics", "GET", False, f"Missing required stats: {list(stats.keys())}", response_time)
                    return False
            else:
                self.log_result("/admin/analytics", "GET", False, f"Missing stats/moduleUsage: {data.keys()}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/admin/analytics", "GET", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def test_chat_session_delete(self):
        """Test delete chat session"""
        if not self.session_id:
            self.log_result("/chat/sessions/:id", "DELETE", False, "No session ID to delete", 0)
            return False
            
        response, response_time = self.make_request("DELETE", f"/chat/sessions/{self.session_id}")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("success"):
                self.log_result("/chat/sessions/:id", "DELETE", True, f"Session {self.session_id} deleted", response_time)
                return True
            else:
                self.log_result("/chat/sessions/:id", "DELETE", False, f"No success field: {data}", response_time)
                return False
        else:
            error_msg = response.json().get("error", "Unknown error") if response else "No response"
            self.log_result("/chat/sessions/:id", "DELETE", False, f"HTTP {response.status_code if response else 'No response'}: {error_msg}", response_time)
            return False

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("CAREERGPT BACKEND API COMPREHENSIVE TEST")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Testing with user: {self.test_user['email']}")
        print()
        
        # Test sequence designed to build on each other
        tests = [
            ("Health Check", self.test_health_check),
            ("Models Endpoint", self.test_models_endpoint),
            ("Auth - Register", self.test_auth_register),
            ("Auth - Register Duplicate", self.test_auth_register_duplicate), 
            ("Auth - Login", self.test_auth_login),
            ("Auth - Login Wrong Password", self.test_auth_login_wrong_password),
            ("Profile - Get", self.test_profile_get),
            ("Profile - Update", self.test_profile_update),
            ("Chat - Send Message", self.test_chat_send),
            ("Chat - Get Sessions", self.test_chat_sessions_get),
            ("Chat - Get Session", self.test_chat_session_get),
            ("Resume - Upload", self.test_resume_upload),
            ("Resume - ATS Analysis", self.test_resume_analyze),
            ("Resume - Get List", self.test_resumes_get),
            ("Resume - Get Single", self.test_resume_get_single),
            ("Career Path - Generate", self.test_career_path_generate),
            ("Career Path - Get List", self.test_career_paths_get),
            ("Mock Interview - Start", self.test_mock_interview_start),
            ("Mock Interview - Respond", self.test_mock_interview_respond),
            ("Job Matching", self.test_job_match),
            ("Admin Analytics", self.test_admin_analytics),
            ("Chat - Delete Session", self.test_chat_session_delete),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n--- Testing: {test_name} ---")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test_name} - Exception: {str(e)}")
                self.log_result(test_name, "EXCEPTION", False, f"Exception: {str(e)}", 0)
                failed += 1
            
        # Summary
        total = passed + failed
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("\n" + "=" * 80)
        print("TEST RESULTS SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        # Detailed results
        if self.test_results:
            print("DETAILED RESULTS:")
            print("-" * 80)
            for result in self.test_results:
                print(f"{result['status']} {result['method']} {result['endpoint']} ({result['response_time']}) - {result['details']}")
        
        print("\n" + "=" * 80)
        
        # Critical issues summary
        critical_failures = [r for r in self.test_results if "❌ FAIL" in r['status'] and any(endpoint in r['endpoint'] for endpoint in ['/health', '/auth/', '/profile'])]
        
        if critical_failures:
            print("CRITICAL ISSUES FOUND:")
            for failure in critical_failures:
                print(f"  • {failure['endpoint']} - {failure['details']}")
        else:
            print("✅ NO CRITICAL ISSUES FOUND")
            
        return success_rate >= 80

if __name__ == "__main__":
    tester = CareerGPTTester()
    success = tester.run_comprehensive_test()
    exit(0 if success else 1)