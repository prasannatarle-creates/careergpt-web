# CareerGPT — AI-Powered Career Guidance Platform

CareerGPT is a full-stack web application that helps users navigate their careers using AI. It provides resume analysis, mock interviews, career path generation, job matching, and more — all powered by large language models.

---

## Features

| Feature | Description |
|---|---|
| **AI Career Chat** | Conversational AI for career questions, with streaming responses and session history |
| **Resume Analyzer (ATS)** | Upload a resume (PDF/text) and get an ATS score, section-by-section feedback, and keyword suggestions |
| **Career Path Generator** | Generate a personalised multi-phase career roadmap based on current skills and goals |
| **Mock Interview** | Voice-enabled mock interviews with per-answer scoring, STAR framework detection, and a full PDF report |
| **Job Matching** | Match your profile against live and mock job listings; save favourites |
| **Learning Resources** | Skill-gap analysis and recommended learning paths with course tracking |
| **Analytics Dashboard** | Admin view of DAU/WAU/MAU, funnel metrics, user segmentation, and module usage |
| **Chat Export & Sharing** | Export chat history as Markdown or HTML; create shareable (optionally password-protected) links |
| **Resume A/B Testing** | Create resume variants, track engagement metrics, and get optimisation recommendations |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui (Radix UI), Recharts |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | MongoDB (with an in-memory mock fallback for local development) |
| **AI** | OpenAI GPT-4 / OpenRouter (configurable via environment variables) |
| **Auth** | JSON Web Tokens (JWT), bcrypt password hashing |
| **PDF** | `pdf-parse` for resume extraction, `jspdf` for report generation |
| **Email** | Nodemailer (email verification, password reset) |
| **Rate Limiting** | Custom in-memory rate limiter (`lib/rateLimiter.js`) |

---

## Project Structure

```
careergpt-web/
├── app/
│   ├── layout.js              # Root HTML layout + metadata
│   ├── globals.css            # Global styles
│   ├── page.js                # Single-page React app (all UI components)
│   └── api/
│       └── [[...path]]/
│           └── route.js       # Catch-all API route handler
├── components/
│   └── ui/                    # shadcn/ui component library
├── hooks/
│   ├── use-mobile.jsx         # Responsive breakpoint hook
│   └── use-toast.js           # Toast notification hook
├── lib/
│   ├── analyticsDashboard.js  # DAU/WAU/MAU, funnels, segmentation
│   ├── careerLearningResources.js  # Skill gaps, courses, learning paths
│   ├── chatExportSharing.js   # Markdown/HTML export, share links
│   ├── chatMemory.js          # Persistent chat session storage
│   ├── email.js               # Nodemailer email templates
│   ├── interviewTranscription.js   # Audio transcription + report generation
│   ├── jobAlerts.js           # Job alert subscriptions
│   ├── jobApi.js              # Job search, ranking, saved jobs
│   ├── mockdb.js              # In-memory MongoDB mock (dev only)
│   ├── pdfExport.js           # PDF generation helpers
│   ├── profilePictureLinkedIn.js   # Profile picture utilities
│   ├── rateLimiter.js         # Per-IP rate limiting middleware
│   ├── resumeABTesting.js     # Resume variant creation and metrics
│   ├── resumeParser.js        # Resume structure extraction
│   ├── streamingChat.js       # Server-sent events streaming
│   └── utils.js               # Shared utility functions
├── memory/                    # Persistent agent memory (git-tracked placeholder)
├── public/
│   ├── CareerGPT_Interview_QA.html  # Interview Q&A reference document
│   ├── CareerGPT_Interview_QA.pdf
│   └── pdf.worker.min.mjs     # PDF.js worker
├── tests/
│   └── __init__.py            # Test package placeholder
├── .gitignore
├── jsconfig.json
├── next.config.js
├── package.json
├── postcss.config.js
└── tailwind.config.js
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18 (includes npm)
- Yarn 1.x — install via `npm install -g yarn` or see [yarnpkg.com](https://yarnpkg.com/getting-started/install)
- A MongoDB instance **or** rely on the built-in mock database for local development

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Required for AI features
OPENAI_API_KEY=sk-...          # OpenAI API key
# OR
OPENROUTER_API_KEY=...         # OpenRouter key (alternative)

# Database (optional — mock DB is used when omitted)
MONGO_URL=mongodb://localhost:27017
DB_NAME=careergpt

# JWT signing secret (change in production)
JWT_SECRET=your-secret-here

# Email (optional — for verification / password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
```

### 3. Run the development server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** If `MONGO_URL` is not set, the app automatically falls back to the mock database (`lib/mockdb.js`), which stores data in `.mockdb.json` in the project root.

---

## API Routes

All routes are served from `/api/*` via `app/api/[[...path]]/route.js`.

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login and receive a JWT |
| POST | `/api/auth/guest` | Guest session (no registration required) |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/forgot-password` | Request password-reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

### Core Features

| Method | Path | Description |
|---|---|---|
| POST | `/api/chat/send` | Send a chat message |
| POST | `/api/chat/send-stream` | Streaming chat (SSE) |
| GET  | `/api/chat/sessions` | List chat sessions |
| DELETE | `/api/chat/sessions/:id` | Delete a session |
| POST | `/api/resume/upload` | Upload a resume file |
| POST | `/api/resume/analyze` | ATS analysis |
| POST | `/api/career-path/generate` | Generate a career roadmap |
| POST | `/api/mock-interview/start` | Start a mock interview |
| POST | `/api/mock-interview/respond` | Submit an interview answer |
| POST | `/api/job-match` | Match jobs to profile |
| POST | `/api/saved-jobs/save` | Save a job |
| GET  | `/api/saved-jobs` | List saved jobs |

### Extended Features

| Method | Path | Description |
|---|---|---|
| POST | `/api/resume/create-variant` | Create a resume A/B variant |
| POST | `/api/resume/track-metric` | Track variant engagement |
| POST | `/api/resume/recommendations` | Get optimisation recommendations |
| POST | `/api/interview/upload-audio` | Upload interview audio for transcription |
| POST | `/api/interview/generate-report` | Generate a full interview PDF report |
| POST | `/api/learning-path/generate` | Generate a personalised learning path |
| POST | `/api/learning-path/skill-gaps` | Identify skill gaps |
| POST | `/api/course/track-progress` | Log course progress |
| GET  | `/api/dashboard` | Analytics dashboard metrics |
| POST | `/api/chat/export-markdown` | Export chat as Markdown |
| POST | `/api/chat/export-html` | Export chat as HTML |
| POST | `/api/chat/create-share` | Create a shareable chat link |
| POST | `/api/chat/revoke-share` | Revoke a share link |
| PUT  | `/api/profile` | Update user profile |
| GET  | `/api/health` | Health check |

---

## Architecture Overview

```
Browser (React SPA)
       │
       │  HTTP / SSE
       ▼
Next.js App Router
 ├── app/page.js         ← All UI components rendered client-side
 └── app/api/[...path]/  ← Serverless API handlers
          │
          ├── Authentication (JWT + bcrypt)
          ├── OpenAI / OpenRouter (AI features)
          ├── MongoDB (or MockDB)
          └── Utility libraries (lib/)
```

State is managed with React `useState` / `useEffect` hooks. There is no global state library (Redux/Zustand); props are passed 1–2 levels deep.

---

## Building for Production

```bash
yarn build
yarn start
```

The build uses Next.js `output: 'standalone'` mode (already configured in `next.config.js`), which produces a self-contained `.next/standalone` directory suitable for Docker or serverless deployment.
