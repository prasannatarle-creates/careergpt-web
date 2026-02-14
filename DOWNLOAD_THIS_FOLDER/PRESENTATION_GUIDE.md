# CareerGPT - Complete Presentation Guide

## 🎯 PROJECT OVERVIEW

**Project Name:** CareerGPT - AI-Powered Career Guidance Platform

**Tagline:** "Your AI Career Advisor - Helping students and job seekers navigate their career journey"

**Problem Statement:**
Students and job seekers often struggle with:
- Understanding which career path suits their skills
- Creating ATS-optimized resumes
- Preparing for interviews
- Finding jobs that match their profile

**Solution:**
CareerGPT is a comprehensive platform that uses multiple AI models to provide personalized career guidance, resume analysis, interview preparation, and job matching.

---

## 📊 ARCHITECTURE DIAGRAM (Draw this on whiteboard)

```
┌──────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Next.js React Frontend                   │  │
│  │  • Single Page Application (SPA)                    │  │
│  │  • Responsive Design with Tailwind CSS              │  │
│  │  • Real-time State Management with React Hooks      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼ HTTP REST API
┌──────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Next.js API Routes (Backend)                │  │
│  │  • RESTful API Endpoints                            │  │
│  │  • JWT Authentication Middleware                    │  │
│  │  • Request Validation                               │  │
│  │  • Error Handling                                   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│      DATA LAYER         │  │    EXTERNAL SERVICES    │
│  ┌───────────────────┐  │  │  ┌───────────────────┐  │
│  │     MongoDB       │  │  │  │    OpenAI API     │  │
│  │  • Users          │  │  │  │   (GPT-4 Turbo)   │  │
│  │  • Sessions       │  │  │  └───────────────────┘  │
│  │  • Resumes        │  │  │  ┌───────────────────┐  │
│  │  • Career Paths   │  │  │  │  PDF Processing   │  │
│  │  • Analytics      │  │  │  │    (pdf-parse)    │  │
│  └───────────────────┘  │  │  └───────────────────┘  │
└─────────────────────────┘  └─────────────────────────┘
```

---

## 🛠 TECHNOLOGY STACK EXPLANATION

### Frontend Technologies:

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| **Next.js** | 16.x | React Framework | Server-side rendering, file-based routing, API routes |
| **React** | 18.x | UI Library | Component-based architecture, virtual DOM |
| **Tailwind CSS** | 4.x | Styling | Utility-first CSS, rapid development |
| **shadcn/ui** | Latest | UI Components | Beautiful, accessible components |
| **Lucide React** | Latest | Icons | Modern icon library |

### Backend Technologies:

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| **Next.js API Routes** | 16.x | Backend API | Integrated with frontend, serverless |
| **MongoDB** | 6.x | Database | Flexible schema, JSON-like documents |
| **JWT** | 9.x | Authentication | Stateless, secure token-based auth |
| **bcrypt** | 5.x | Password Hashing | Industry-standard security |
| **OpenAI SDK** | 4.x | AI Integration | Official OpenAI library |

### Key Libraries:

| Library | Purpose |
|---------|---------|
| **pdf-parse** | Extract text from PDF resumes |
| **jspdf** | Generate PDF reports |
| **react-markdown** | Render AI responses with formatting |
| **uuid** | Generate unique identifiers |

---

## 🔐 AUTHENTICATION FLOW (Important for Security Questions)

```
USER REGISTRATION:
┌─────────┐   POST /api/auth/register   ┌─────────┐
│  User   │ ─────────────────────────▶ │ Server  │
│         │   {name, email, password}   │         │
└─────────┘                             └────┬────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Validate Input  │
                                    │ Check Email     │
                                    │ Hash Password   │
                                    │ (bcrypt 10)     │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  Store in DB    │
                                    │  Generate JWT   │
                                    └────────┬────────┘
                                             │
┌─────────┐   {token, user}                  │
│  User   │ ◀────────────────────────────────┘
│         │   Store token in localStorage
└─────────┘

SUBSEQUENT REQUESTS:
┌─────────┐   Authorization: Bearer <token>   ┌─────────┐
│  User   │ ─────────────────────────────────▶│ Server  │
│         │                                   │         │
└─────────┘                                   └────┬────┘
                                                   │
                                                   ▼
                                          ┌───────────────┐
                                          │ Verify JWT    │
                                          │ Extract User  │
                                          │ Process Req   │
                                          └───────────────┘
```

**Key Points for Interviewer:**
- Password never stored in plain text (bcrypt with salt)
- JWT expires in 7 days for security
- Token stored client-side in localStorage
- Each API call verified via middleware

---

## 🤖 AI INTEGRATION ARCHITECTURE

### Multi-Model Approach:

```
USER QUERY
    │
    ▼
┌─────────────────────────────────────┐
│       PROMPT ENGINEERING            │
│  • Add system context               │
│  • Format user message              │
│  • Include conversation history     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│        AI MODEL CALL                │
│  • OpenAI GPT-4 Turbo               │
│  • Temperature: 0.7                 │
│  • Max Tokens: 2500                 │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│       RESPONSE PROCESSING           │
│  • Parse JSON if structured         │
│  • Format markdown                  │
│  • Handle errors gracefully         │
└─────────────────────────────────────┘
    │
    ▼
USER RESPONSE
```

### System Prompts (Know these for questions):

1. **Career Chat:** General career advice, conversational
2. **Career Path:** Returns structured JSON with timeline
3. **Resume ATS:** Analyzes and scores resume (0-100)
4. **Interview:** Asks questions, evaluates answers
5. **Job Match:** Finds matching roles with scores

---

## 📁 DATABASE SCHEMA

### Users Collection:
```javascript
{
  id: "uuid-string",           // Unique identifier
  name: "John Doe",            // Display name
  email: "john@example.com",   // Unique, lowercase
  password: "bcrypt-hash",     // Hashed password
  role: "user",                // user/admin
  profile: {
    skills: ["Python", "React"],
    interests: ["AI", "Web Dev"],
    education: "B.Tech CS",
    experience: "2 years"
  },
  createdAt: "2024-01-15T10:30:00Z"
}
```

### Sessions Collection:
```javascript
{
  id: "uuid",
  userId: "user-uuid",
  type: "career-chat" | "mock-interview",
  title: "Session Title",
  messages: [
    {
      role: "user" | "assistant",
      content: "message text",
      timestamp: "ISO date"
    }
  ],
  // For interviews:
  role: "Software Engineer",
  level: "mid-level",
  questionCount: 3,
  scores: [7, 8, 6],
  createdAt: "...",
  updatedAt: "..."
}
```

### Resumes Collection:
```javascript
{
  id: "uuid",
  userId: "user-uuid",
  fileName: "resume.pdf",
  fileSize: 102400,
  textContent: "extracted text...",
  analysis: {
    atsScore: 75,
    sections: { contact: {}, experience: {}, ... },
    keywords: { found: [], missing: [] },
    strengths: [],
    weaknesses: []
  },
  createdAt: "...",
  analyzedAt: "..."
}
```

---

## 🔄 API ENDPOINTS (Know these!)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | /api/auth/register | No | Create new user |
| POST | /api/auth/login | No | Login user |
| GET | /api/profile | Yes | Get user profile |
| PUT | /api/profile | Yes | Update profile |
| POST | /api/chat/send | Optional | Send chat message |
| GET | /api/chat/sessions | Yes | List chat sessions |
| POST | /api/resume/upload | Optional | Upload resume file |
| POST | /api/resume/analyze | No | Analyze resume |
| POST | /api/career-path/generate | Optional | Generate career path |
| POST | /api/mock-interview/start | Optional | Start interview |
| POST | /api/mock-interview/respond | No | Submit answer |
| POST | /api/job-match | Optional | Find matching jobs |
| GET | /api/admin/analytics | Yes | Get analytics |

---

## 🎨 FRONTEND COMPONENTS

### Component Hierarchy:
```
App (Main Component)
├── AuthPage
│   ├── LoginForm
│   └── RegisterForm
├── Sidebar
│   ├── Logo
│   ├── Navigation
│   └── UserProfile
└── MainContent
    ├── Dashboard
    │   ├── StatsCards
    │   ├── ModuleCards
    │   └── AIModelStatus
    ├── CareerChat
    │   ├── ChatSidebar
    │   ├── ChatMessages
    │   └── ChatInput
    ├── ResumeAnalyzer
    │   ├── FileUpload
    │   ├── AnalysisResults
    │   └── ATSScoreChart
    ├── CareerPath
    │   ├── InputForm
    │   ├── TimelineView
    │   └── CertificationsCard
    ├── MockInterview
    │   ├── InterviewSetup
    │   ├── QuestionCard
    │   ├── VoiceRecorder
    │   └── FeedbackCard
    ├── JobMatching
    │   ├── InputForm
    │   └── MatchResults
    └── Analytics (Admin)
        ├── StatsOverview
        ├── UsageCharts
        └── ActivityFeed
```

### State Management:
- **useState:** Local component state
- **useEffect:** Side effects, data fetching
- **useRef:** DOM references, mutable values
- **useCallback:** Memoized callbacks

---

## 🔊 VOICE INPUT FEATURE (Web Speech API)

```javascript
// Voice Recording Implementation
const SpeechRecognition = window.SpeechRecognition || 
                          window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = true;      // Keep listening
recognition.interimResults = true;  // Show partial results

recognition.onresult = (event) => {
  // Process speech to text
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      transcript += event.results[i][0].transcript;
    }
  }
};

recognition.start();  // Begin listening
recognition.stop();   // Stop listening
```

**Key Points:**
- Browser-native API, no external service
- Works in Chrome, Edge, Safari
- Real-time transcription
- Used in Mock Interview module

---

## 📈 RESUME ATS SCORING ALGORITHM

The ATS (Applicant Tracking System) scoring evaluates:

1. **Contact Information (10%):** Name, email, phone, LinkedIn
2. **Professional Summary (15%):** Clear career objective
3. **Work Experience (30%):** Relevant roles, achievements
4. **Education (15%):** Degrees, certifications
5. **Skills Section (20%):** Technical and soft skills
6. **Additional Sections (10%):** Projects, awards

**Scoring Formula:**
```
ATS Score = Σ (Section Score × Weight) / Total Weight × 100
```

**Keywords Analysis:**
- Extracts job-relevant keywords
- Compares with industry standards
- Suggests missing keywords

---

## 💡 POTENTIAL INTERVIEW QUESTIONS & ANSWERS

### Q1: Why did you choose Next.js over other frameworks?
**Answer:** "Next.js provides an integrated full-stack solution with React frontend and API routes for backend. It offers server-side rendering for SEO, file-based routing for simplicity, and excellent developer experience. The ability to deploy both frontend and backend together simplifies our architecture."

### Q2: How do you ensure the security of user passwords?
**Answer:** "We use bcrypt with a salt factor of 10 for password hashing. Passwords are never stored in plain text. When a user logs in, we compare the input password's hash with the stored hash. We also use JWT tokens with 7-day expiration for stateless authentication."

### Q3: Explain your AI integration approach.
**Answer:** "We use the OpenAI GPT-4 Turbo model through their official SDK. Each feature has a specialized system prompt that guides the AI's behavior. For structured outputs like career paths and resume analysis, we instruct the AI to return JSON format, which we parse and display. We handle errors gracefully with fallback responses."

### Q4: How does the resume parsing work?
**Answer:** "When a user uploads a PDF, we use the pdf-parse library to extract text content. The text is then sent to our AI model with a specialized ATS analysis prompt. The AI evaluates the resume against industry standards and returns structured feedback with scores for each section."

### Q5: What databases did you consider and why MongoDB?
**Answer:** "MongoDB was chosen for its flexible schema design, which is ideal for storing varied user data, chat messages, and AI responses. Its JSON-like document structure maps naturally to our JavaScript objects, and it scales horizontally for future growth."

### Q6: How do you handle concurrent API requests?
**Answer:** "Next.js API routes are serverless functions that handle requests independently. For database connections, we use connection pooling to reuse MongoDB connections. AI calls use async/await with proper error handling to manage timeouts and failures."

### Q7: Explain the JWT authentication flow.
**Answer:** "When a user registers or logs in, we generate a JWT containing their user ID and role. This token is sent to the client and stored in localStorage. For protected routes, the client sends this token in the Authorization header. Our middleware verifies the token signature and extracts user information for each request."

---

## 🚀 RUNNING THE PROJECT LOCALLY

### Step-by-Step Instructions:

1. **Install Prerequisites:**
   ```bash
   # Install Node.js 18+ from nodejs.org
   # Install MongoDB from mongodb.com or use MongoDB Atlas
   ```

2. **Create Project:**
   ```bash
   mkdir careergpt
   cd careergpt
   npx create-next-app@latest . --typescript=no --tailwind --eslint --app --src-dir=no --import-alias="@/*"
   ```

3. **Install Dependencies:**
   ```bash
   npm install mongodb uuid openai bcryptjs jsonwebtoken pdf-parse jspdf react-markdown remark-gfm
   npm install @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-progress
   npm install lucide-react class-variance-authority clsx tailwind-merge
   ```

4. **Set Up shadcn/ui:**
   ```bash
   npx shadcn@latest init
   npx shadcn@latest add button card input badge scroll-area separator progress select
   ```

5. **Configure Environment:**
   Create `.env` file:
   ```
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=careergpt
   OPENAI_API_KEY=your_key_here
   JWT_SECRET=your_random_secret_here
   ```

6. **Copy Code Files:**
   - Copy `page.js` to `app/page.js`
   - Copy `route.js` to `app/api/[[...path]]/route.js`
   - Copy `layout.js` to `app/layout.js`
   - Create folder: `mkdir -p app/api/[[...path]]`

7. **Start MongoDB:**
   ```bash
   mongod --dbpath /path/to/data
   ```

8. **Run Application:**
   ```bash
   npm run dev
   ```

9. **Access:**
   Open http://localhost:3000

---

## 📝 DEMO SCRIPT

1. **Show Login/Register** (2 min)
   - Register a new account
   - Explain JWT authentication
   - Show error handling

2. **Dashboard Overview** (1 min)
   - Stats cards
   - Module navigation
   - AI model status

3. **Resume Analyzer Demo** (3 min)
   - Upload a sample resume (use TXT)
   - Show ATS score breakdown
   - Explain keyword analysis
   - Download PDF report

4. **Career Path Generator** (2 min)
   - Enter skills and interests
   - Show generated timeline
   - Explain certification recommendations

5. **Mock Interview** (3 min)
   - Start an interview
   - Answer using voice input
   - Show AI feedback
   - Explain scoring system

6. **AI Career Chat** (2 min)
   - Ask career questions
   - Show markdown rendering
   - Session management

7. **Job Matching** (1 min)
   - Enter profile
   - Show matching results
   - Explain match scores

8. **Code Walkthrough** (3 min)
   - Show project structure
   - Explain API routes
   - Database schema

---

## ✅ CHECKLIST BEFORE PRESENTATION

- [ ] MongoDB running locally
- [ ] OpenAI API key configured
- [ ] Test all modules work
- [ ] Sample resume file ready
- [ ] Browser dev tools open for showing network calls
- [ ] Code editor ready with files open
- [ ] This guide printed/available

Good luck with your presentation! 🎉
