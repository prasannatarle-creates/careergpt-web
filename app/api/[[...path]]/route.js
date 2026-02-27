import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// PDF parse v1.x - compatible with serverless
import pdf from 'pdf-parse/lib/pdf-parse.js';

// Import new utilities
const { sendEmail, emailTemplates } = require('../../../lib/email.js');
const { authLimiter, registerLimiter } = require('../../../lib/rateLimiter.js');
const { parseResumeStructure, calculateExperienceYears, extractSkills, detectSeniorityLevel, detectFocusArea } = require('../../../lib/resumeParser.js');
const { searchAllJobSources, rankJobsByRelevance, getMockJobs, saveJobForUser, getSavedJobs } = require('../../../lib/jobApi.js');
const { createJobAlert, getUserJobAlerts, updateJobAlert, deleteJobAlert } = require('../../../lib/jobAlerts.js');
const { createResumeVariant, trackResumeMetric, getResumeComparison, recommendResumeOptimizations } = require('../../../lib/resumeABTesting.js');
const { handleChatSendStream } = require('../../../lib/streamingChat.js');
const { transcribeInterviewAudio, analyzeInterviewTranscription, generateInterviewReport, exportInterviewReportPDF } = require('../../../lib/interviewTranscription.js');
const { analyzeSkillGaps, getRecommendedCourses, generateLearningPath, trackCourseProgress, getLearningProgress } = require('../../../lib/careerLearningResources.js');
const { getDashboardMetrics, calculateDAU, calculateWAU, calculateMAU, analyzeFunnel, getUserSegmentation, analyzeCohorts, getModuleUsage } = require('../../../lib/analyticsDashboard.js');
const { convertToMarkdown, convertToHTML, createShareLink, getSharedChat, revokeShareLink, getUserShareLinks, exportAsMarkdown, exportAsHTML } = require('../../../lib/chatExportSharing.js');
// Mock DB fallback for local development
let MockDB;
try {
  const mockdbModule = require('../../../lib/mockdb.js');
  MockDB = mockdbModule.MockDB;
} catch (e) {
  MockDB = null;
}

// ============ CONFIG ============
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'careergpt';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || OPENROUTER_API_KEY || process.env.EMERGENT_LLM_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || (OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
const JWT_SECRET = process.env.JWT_SECRET || 'careergpt-jwt-secret-2025';

let cachedDb = null;
let usingMockDb = false;

async function getDb() {
  if (cachedDb) return cachedDb;
  
  // Validate MONGO_URL before attempting connection
  if (!MONGO_URL) {
    console.error('MONGO_URL environment variable is not set. Cannot connect to database.');
    if (!MockDB) {
      throw new Error('MONGO_URL not configured and MockDB not available. Please set MONGO_URL in .env.local or ensure local MongoDB is running.');
    }
    cachedDb = new MockDB();
    usingMockDb = true;
    console.log('✓ Using mock database for development (MONGO_URL not set)');
    return cachedDb;
  }
  
  // Try real MongoDB first
  try {
    const isLocal = MONGO_URL.includes('localhost');
    const connectOptions = isLocal
      ? { 
          serverSelectionTimeoutMS: 5000,
          retryWrites: false,
          ssl: false,
          tls: false
        }
      : {
          serverSelectionTimeoutMS: 5000,
          family: 4
        };

    const client = await MongoClient.connect(MONGO_URL, connectOptions);
    cachedDb = client.db(DB_NAME);
    usingMockDb = false;
    
    // Create indexes
    try {
      await cachedDb.collection('users').createIndex({ email: 1 }, { unique: true });
      await cachedDb.collection('sessions').createIndex({ userId: 1, updatedAt: -1 });
      await cachedDb.collection('resumes').createIndex({ userId: 1, createdAt: -1 });
      await cachedDb.collection('career_paths').createIndex({ userId: 1 });
      await cachedDb.collection('job_matches').createIndex({ userId: 1 });
      await cachedDb.collection('analytics').createIndex({ type: 1, createdAt: -1 });
    } catch (e) { /* indexes may already exist */ }
    
    console.log('✓ Connected to real MongoDB');
    return cachedDb;
  } catch (mongoError) {
    console.warn('MongoDB connection failed, using mock database for development:', mongoError.message);
    
    // Fallback to mock database
    if (!MockDB) {
      throw new Error('MongoDB not available and MockDB not loaded. Please install MongoDB or use local MongoDB.');
    }
    
    cachedDb = new MockDB();
    usingMockDb = true;
    console.log('✓ Using mock database for development');
    return cachedDb;
  }
}

// ============ LLM SETUP ============
function getOpenAIClient() {
  // Support both direct OpenAI and OpenRouter (OpenAI-compatible) API access
  const apiKey = OPENROUTER_API_KEY || OPENAI_API_KEY;
  const baseURL = LLM_BASE_URL;
  
  if (!apiKey) {
    console.warn('No API key provided. LLM features will not work.');
    return null;
  }
  
  return new OpenAI({ 
    apiKey,
    baseURL,
    defaultHeaders: OPENROUTER_API_KEY ? {
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'CareerGPT'
    } : {}
  });
}

function getModelStr(provider, model) {
  // OpenRouter uses different model naming conventions
  if (OPENROUTER_API_KEY) {
    const modelMap = {
      'gpt-4.1': 'openai/gpt-4-turbo',
      'gpt-4': 'openai/gpt-4-turbo',
      'claude-4-sonnet-20250514': 'anthropic/claude-3.5-sonnet',
      'gemini-2.5-flash': 'google/gemini-2-flash',
      'grok-3-mini': 'xai/grok-2-mini',
      'sonar-pro': 'perplexity/sonar'
    };
    return modelMap[model] || `${provider}/${model}`;
  }
  
  return `${provider}/${model}`;
}

const ALL_MODELS = [
  { provider: 'openai', model: 'gpt-4.1', name: 'GPT-4 Turbo', color: '#10a37f', guaranteed: true },
  { provider: 'anthropic', model: 'claude-4-sonnet-20250514', name: 'Claude 3.5 Sonnet', color: '#d97706', guaranteed: true },
  { provider: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.0 Flash', color: '#4285f4', guaranteed: true },
  { provider: 'xai', model: 'grok-3-mini', name: 'Grok 3 Mini', color: '#ef4444', guaranteed: false },
  { provider: 'perplexity', model: 'sonar-pro', name: 'Perplexity Sonar Pro', color: '#22d3ee', guaranteed: false },
];

async function callModel(client, modelStr, messages) {
  try {
    const response = await client.chat.completions.create({
      model: modelStr, messages, max_tokens: 1500, temperature: 0.7,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Model ${modelStr} error:`, error.message);
    return null;
  }
}

async function callMultiModel(systemPrompt, userMessage, activeModelNames = null) {
  const client = getOpenAIClient();
  let modelsToUse = activeModelNames
    ? ALL_MODELS.filter(m => activeModelNames.includes(m.name))
    : ALL_MODELS;

  // Skip unreliable models that consistently fail
  modelsToUse = modelsToUse.filter(m => !['Gemini 2.0 Flash', 'Grok 3 Mini'].includes(m.name));

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Use sequential model calls with timeouts instead of parallel Promise.all
  const results = [];
  const timeoutMs = 15000; // 15 second timeout per model
  
  for (const m of modelsToUse) {
    const start = Date.now();
    try {
      const modelStr = getModelStr(m.provider, m.model);
      
      // Add timeout wrapper
      const modelPromise = callModel(client, modelStr, messages);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model timeout')), timeoutMs)
      );
      
      const response = await Promise.race([modelPromise, timeoutPromise]);
      results.push({ name: m.name, color: m.color, response, duration: Date.now() - start, success: !!response });
    } catch (e) {
      console.warn(`Model ${m.name} failed:`, e.message);
      results.push({ name: m.name, color: m.color, response: null, duration: Date.now() - start, success: false });
    }
    
    // Return early if we have 1 successful model (faster response)
    const validCount = results.filter(r => r.success).length;
    if (validCount >= 1) {
      console.log(`Early exit: Got ${validCount} successful model(s), skipping remaining ${modelsToUse.length - results.length}`);
      break;
    }
  }

  const valid = results.filter(r => r.response);
  const failed = results.filter(r => !r.response);

  if (valid.length === 0) throw new Error('All models failed');

  let combinedResponse = valid[0].response;
  let synthesized = false;

  if (valid.length > 1) {
    const synthPrompt = `Combine these ${valid.length} expert responses into one comprehensive answer:\n\n${valid.map(r => `--- ${r.name} ---\n${r.response}`).join('\n\n')}\n\nProvide a unified markdown response with the best insights from all. Do NOT mention multiple models.`;
    const synthModel = getModelStr('openai', 'gpt-4.1');
    const synthResult = await callModel(client, synthModel, [
      { role: 'system', content: 'You synthesize multiple AI responses into one cohesive response. Output only the final response in markdown.' },
      { role: 'user', content: synthPrompt },
    ]);
    if (synthResult) { combinedResponse = synthResult; synthesized = true; }
  }

  return { combinedResponse, modelResponses: valid, failedModels: failed.map(r => ({ name: r.name })), synthesized, successCount: valid.length, totalModels: modelsToUse.length };
}

async function callSingleModel(systemPrompt, userMessage) {
  const client = getOpenAIClient();
  const modelStr = getModelStr('openai', 'gpt-4.1');
  return await callModel(client, modelStr, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);
}

// ============ AUTH HELPERS ============
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

// ============ ANALYTICS HELPER ============
async function logAnalytics(db, type, data = {}) {
  await db.collection('analytics').insertOne({
    id: uuidv4(), type, data, createdAt: new Date().toISOString(),
  });
}

// ============ SYSTEM PROMPTS ============
const CAREER_SYSTEM = `You are CareerGPT, an expert AI career guidance counselor. Help students and job seekers with career paths, skills, interviews, and job search strategies. Be specific, actionable, and encouraging. Use markdown formatting.`;

const CAREER_PATH_SYSTEM = `You are an expert career path architect. Given a user's profile, generate a STRUCTURED career path. You MUST return valid JSON (no markdown, no code fences) with this exact structure:
{
  "title": "Career Path Title",
  "summary": "2-3 sentence overview",
  "matchScore": 85,
  "timeline": [
    {"phase": "Phase 1: Foundation", "duration": "0-3 months", "goals": ["goal1","goal2"], "skills": ["skill1","skill2"], "resources": ["resource1"]}
  ],
  "certifications": [{"name": "Cert Name", "provider": "Provider", "priority": "high/medium/low"}],
  "salaryRange": {"entry": "$50k-70k", "mid": "$80k-120k", "senior": "$130k-180k"},
  "topRoles": ["Role 1", "Role 2", "Role 3"],
  "industryOutlook": "Brief outlook text"
}`;

const RESUME_ATS_SYSTEM = `You are an expert ATS (Applicant Tracking System) resume analyzer. Analyze the resume and return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "atsScore": 72,
  "sections": {
    "contact": {"score": 90, "feedback": "feedback text", "present": true},
    "summary": {"score": 70, "feedback": "feedback text", "present": true},
    "experience": {"score": 80, "feedback": "feedback text", "present": true},
    "education": {"score": 85, "feedback": "feedback text", "present": true},
    "skills": {"score": 60, "feedback": "feedback text", "present": true},
    "projects": {"score": 50, "feedback": "feedback text", "present": false}
  },
  "keywords": {
    "found": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"],
    "suggestions": ["suggestion1", "suggestion2"]
  },
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "rewrittenBullets": [
    {"original": "original text", "improved": "improved text", "reason": "why better"}
  ],
  "experienceLevel": "entry/mid/senior",
  "matchingRoles": ["Role 1", "Role 2", "Role 3"],
  "overallFeedback": "Summary feedback paragraph"
}`;

const INTERVIEW_SYSTEM = `You are an expert interviewer conducting a mock interview. Ask realistic questions one at a time. After the user answers, provide structured feedback. Be encouraging but honest. Use markdown formatting.`;

const INTERVIEW_FEEDBACK_SYSTEM = `You are an expert interview coach. Evaluate the candidate's answer and return ONLY valid JSON (no markdown, no code fences):
{
  "score": 7,
  "maxScore": 10,
  "technicalAccuracy": 8,
  "communicationScore": 7,
  "structureScore": 6,
  "confidenceScore": 7,
  "feedback": "Detailed feedback text",
  "strengths": ["strength1"],
  "improvements": ["improvement1"],
  "sampleAnswer": "A better sample answer text",
  "usedSTAR": false,
  "nextQuestion": "Next interview question text"
}`;

const JOB_MATCH_SYSTEM = `You are a job matching expert. Given a user profile, find the best matching job roles. Return ONLY valid JSON (no markdown, no code fences):
{
  "matches": [
    {
      "role": "Job Title",
      "company_type": "Startup/Enterprise/etc",
      "matchScore": 85,
      "salary": "$80k-120k",
      "skills_matched": ["skill1","skill2"],
      "skills_gap": ["skill3"],
      "why_match": "Explanation of why this matches",
      "growth_potential": "high/medium/low",
      "demand": "high/medium/low"
    }
  ],
  "summary": "Overall matching summary",
  "topSkillGaps": ["skill1","skill2"],
  "recommendations": ["recommendation1"]
}`;

// ============ ROUTE HANDLERS ============

// --- AUTH ---
async function handleRegister(body, clientIp) {
  try {
    // Rate limiting: max 3 registrations per hour per IP
    if (registerLimiter.isLimited(clientIp, '/auth/register')) {
      const remaining = registerLimiter.getRemainingTime(clientIp, '/auth/register');
      return NextResponse.json(
        { error: `Too many registration attempts. Try again in ${Math.ceil(remaining / 60)} minutes.` },
        { status: 429, headers: { 'Retry-After': remaining } }
      );
    }

    const { name, email, password } = body;
    if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    
    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);
    
    if (password.length < 8) {
      if (!hasUpperCase || !hasNumbers) {
        return NextResponse.json({
          error: 'Password should be 8+ chars with uppercase letters, numbers, and special characters for better security',
          warning: true // Allow but warn user
        }, { status: 400 });
      }
    }

    const db = await getDb();
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const verificationToken = jwt.sign({ email: email.toLowerCase(), type: 'email-verify' }, process.env.JWT_SECRET || 'careergpt-jwt-secret-2025', { expiresIn: '24h' });

    const user = {
      id: userId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      profile: { skills: [], interests: [], education: '', experience: '' },
      verified: false,
      verificationToken,
      createdAt: new Date().toISOString(),
    };

    await db.collection('users').insertOne(user);

    // Send verification email
    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    const { subject, html, text } = emailTemplates.verifyEmail(verificationLink);
    await sendEmail(email.toLowerCase(), subject, html, text);

    await logAnalytics(db, 'user_register', { userId });

    return NextResponse.json({
      message: 'Registration successful. Please check your email to verify your account.',
      email: email.toLowerCase(),
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    return NextResponse.json({ error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}

async function handleVerifyEmail(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'careergpt-jwt-secret-2025');
    if (decoded.type !== 'email-verify') {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: decoded.email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.verified) return NextResponse.json({ message: 'Email already verified' });

    await db.collection('users').updateOne(
      { email: decoded.email },
      { $set: { verified: true, verificationToken: null } }
    );

    // Send welcome email
    const { subject, html, text } = emailTemplates.welcomeEmail(user.name);
    await sendEmail(user.email, subject, html, text);

    await logAnalytics(db, 'email_verified', { userId: user.id });

    return NextResponse.json({ message: 'Email verified successfully. You can now login.', redirectUrl: '/login' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Verification link has expired. Please register again.' }, { status: 400 });
    }
    console.error('Email verification error:', error.message);
    return NextResponse.json({ error: 'Verification failed: ' + error.message }, { status: 500 });
  }
}

async function handleForgotPassword(body) {
  try {
    const { email } = body;
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    
    // Always return success for security (don't reveal if email exists)
    if (!user) {
      return NextResponse.json({ message: 'If an account exists, password reset link sent to email' });
    }

    const resetToken = jwt.sign({ email: email.toLowerCase(), type: 'password-reset' }, process.env.JWT_SECRET || 'careergpt-jwt-secret-2025', { expiresIn: '30m' });
    
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: { resetToken, resetTokenCreatedAt: new Date().toISOString() } }
    );

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const { subject, html, text } = emailTemplates.resetPassword(resetLink);
    await sendEmail(user.email, subject, html, text);

    await logAnalytics(db, 'password_reset_requested', { userId: user.id });

    return NextResponse.json({ message: 'If an account exists, password reset link sent to email' });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    return NextResponse.json({ error: 'Request failed: ' + error.message }, { status: 500 });
  }
}

async function handleResetPassword(body) {
  try {
    const { token, newPassword } = body;
    if (!token || !newPassword) return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'careergpt-jwt-secret-2025');
    if (decoded.type !== 'password-reset') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: decoded.email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: { password: hashedPassword, resetToken: null, resetTokenCreatedAt: null } }
    );

    await logAnalytics(db, 'password_reset', { userId: user.id });

    return NextResponse.json({ message: 'Password reset successful. You can now login.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
    }
    console.error('Reset password error:', error.message);
    return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status: 500 });
  }
}

async function handleLogin(body, clientIp) {
  try {
    // Rate limiting: max 5 login attempts per 15 minutes
    if (authLimiter.isLimited(clientIp, '/auth/login')) {
      const remaining = authLimiter.getRemainingTime(clientIp, '/auth/login');
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${Math.ceil(remaining / 60)} minutes.` },
        { status: 429, headers: { 'Retry-After': remaining } }
      );
    }

    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    // Check if email is verified
    if (!user.verified) {
      return NextResponse.json({
        error: 'Email not verified. Please check your email for verification link.',
        requiresVerification: true,
        email: user.email
      }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = generateToken(user);
    await logAnalytics(db, 'user_login', { userId: user.id });

    return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile } });
  } catch (error) {
    console.error('Login error:', error.message);
    return NextResponse.json({ error: 'Login failed: ' + error.message }, { status: 500 });
  }
}

// --- PROFILE ---
async function handleGetProfile(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const user = await db.collection('users').findOne({ id: auth.id });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Get stats
  const resumeCount = await db.collection('resumes').countDocuments({ userId: auth.id });
  const interviewCount = await db.collection('sessions').countDocuments({ userId: auth.id, type: 'mock-interview' });
  const chatCount = await db.collection('sessions').countDocuments({ userId: auth.id, type: 'career-chat' });
  const careerPathCount = await db.collection('career_paths').countDocuments({ userId: auth.id });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile, createdAt: user.createdAt },
    stats: { resumeCount, interviewCount, chatCount, careerPathCount },
  });
}

async function handleUpdateProfile(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, profile } = body;
  const db = await getDb();

  const update = {};
  if (name) update.name = name;
  if (profile) update.profile = profile;

  await db.collection('users').updateOne({ id: auth.id }, { $set: update });
  return NextResponse.json({ success: true });
}

// --- CAREER CHAT ---
async function handleChatSend(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { sessionId, message, activeModels } = body;
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  const db = await getDb();
  const userId = auth?.id || 'anonymous';
  let sid = sessionId || uuidv4();

  let session = sessionId ? await db.collection('sessions').findOne({ id: sessionId }) : null;
  if (!session) {
    session = {
      id: sid, userId, title: message.substring(0, 60) + (message.length > 60 ? '...' : ''),
      type: 'career-chat', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await db.collection('sessions').insertOne(session);
  }

  const recentMsgs = (session.messages || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
  const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };

  try {
    const fullMessages = [{ role: 'system', content: CAREER_SYSTEM }, ...recentMsgs, { role: 'user', content: message }];
    const client = getOpenAIClient();
    const modelsToUse = activeModels ? ALL_MODELS.filter(m => activeModels.includes(m.name)) : ALL_MODELS;

    const results = await Promise.all(modelsToUse.map(async (m) => {
      const start = Date.now();
      const modelStr = getModelStr(m.provider, m.model);
      const response = await callModel(client, modelStr, fullMessages);
      return { name: m.name, color: m.color, response, duration: Date.now() - start, success: !!response };
    }));

    const valid = results.filter(r => r.response);
    const failed = results.filter(r => !r.response);
    if (valid.length === 0) throw new Error('All models failed');

    let combinedResponse = valid[0].response;
    let synthesized = false;

    if (valid.length > 1) {
      const synthPrompt = `Combine these expert career advice responses:\n\n${valid.map(r => `--- ${r.name} ---\n${r.response}`).join('\n\n')}\n\nProvide one unified markdown response.`;
      const synthResult = await callModel(client, getModelStr('openai', 'gpt-4.1'), [
        { role: 'system', content: 'Synthesize multiple AI responses into one cohesive career advice response.' },
        { role: 'user', content: synthPrompt },
      ]);
      if (synthResult) { combinedResponse = synthResult; synthesized = true; }
    }

    const assistantMsg = {
      role: 'assistant', content: combinedResponse, timestamp: new Date().toISOString(),
      models: valid.map(r => r.name), synthesized,
    };

    await db.collection('sessions').updateOne({ id: sid }, {
      $push: { messages: { $each: [userMsg, assistantMsg] } },
      $set: { updatedAt: new Date().toISOString() },
    });

    await logAnalytics(db, 'chat_message', { userId, models: valid.map(r => r.name) });

    return NextResponse.json({
      sessionId: sid, response: combinedResponse, synthesized,
      models: valid.map(r => ({ name: r.name, color: r.color, duration: r.duration })),
      failedModels: failed.map(r => ({ name: r.name })),
      successCount: valid.length, totalModels: modelsToUse.length,
      individualResponses: valid.map(r => ({ name: r.name, color: r.color, preview: r.response?.substring(0, 200) + '...', duration: r.duration })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'AI error: ' + error.message }, { status: 500 });
  }
}

async function handleGetSessions(request) {
  const auth = verifyToken(request);
  const db = await getDb();
  const filter = auth ? { userId: auth.id } : {};
  const sessions = await db.collection('sessions').find(filter, { projection: { messages: 0 } }).sort({ updatedAt: -1 }).limit(50).toArray();
  return NextResponse.json({ sessions });
}

async function handleGetSession(request, sessionId) {
  const db = await getDb();
  const session = await db.collection('sessions').findOne({ id: sessionId });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ session });
}

async function handleDeleteSession(sessionId) {
  const db = await getDb();
  await db.collection('sessions').deleteOne({ id: sessionId });
  return NextResponse.json({ success: true });
}

async function handleRenameSession(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { sessionId, title } = body;
  if (!sessionId || !title) return NextResponse.json({ error: 'Session ID and title required' }, { status: 400 });
  const db = await getDb();
  await db.collection('sessions').updateOne({ id: sessionId }, { $set: { title: title.trim().substring(0, 100), updatedAt: new Date().toISOString() } });
  return NextResponse.json({ success: true });
}

// --- STRUCTURED CAREER PATH ---
async function handleGenerateCareerPath(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { skills, interests, education, experience } = body;

  const prompt = `Generate a structured career path for this profile:
Skills: ${skills || 'Not specified'}
Interests: ${interests || 'Not specified'}
Education: ${education || 'Not specified'}
Experience: ${experience || 'Not specified'}

Return a detailed JSON career roadmap with timeline phases, certifications, salary ranges, and top roles.`;

  try {
    const result = await callMultiModel(CAREER_PATH_SYSTEM, prompt, ['GPT-4 Turbo', 'Claude 3.5 Sonnet', 'Perplexity Sonar Pro']);
    
    if (!result || !result.combinedResponse) {
      return NextResponse.json({ error: 'Failed to generate career path: LLM did not return a valid response' }, { status: 500 });
    }
    
    let parsed;
    try {
      const jsonStr = result.combinedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { title: 'Career Path', summary: result.combinedResponse, raw: true };
    }

    const db = await getDb();
    const careerPath = {
      id: uuidv4(), userId: auth?.id || 'anonymous', input: { skills, interests, education, experience },
      result: parsed, models: result.modelResponses.map(r => r.name), synthesized: result.synthesized,
      createdAt: new Date().toISOString(),
    };
    await db.collection('career_paths').insertOne(careerPath);
    await logAnalytics(db, 'career_path_generated', { userId: auth?.id });

    return NextResponse.json({ careerPath: parsed, id: careerPath.id, models: result.modelResponses.map(r => r.name), synthesized: result.synthesized });
  } catch (error) {
    console.error('Career path generation error:', error.message);
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
  }
}

async function handleGetCareerPaths(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const paths = await db.collection('career_paths').find({ userId: auth.id }).sort({ createdAt: -1 }).limit(20).toArray();
  return NextResponse.json({ paths });
}

// --- RESUME UPLOAD & ATS ANALYSIS ---
async function handleResumeUpload(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let textContent = '';
    
    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        // Use pdf-parse v1.x - simple function call with buffer
        const pdfData = await pdf(buffer);
        textContent = pdfData.text || '';
        console.log(`PDF parsed successfully: ${pdfData.numpages} pages, ${textContent.length} chars extracted`);
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError.message);
        // Try to extract any readable text from the buffer as fallback
        const rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ');
        if (rawText.length > 100) {
          textContent = rawText;
        } else {
          return NextResponse.json({ error: 'Failed to parse PDF. Please try a different file or use TXT format.' }, { status: 400 });
        }
      }
    } else {
      textContent = buffer.toString('utf-8');
    }

    // Clean up text content
    textContent = textContent.replace(/\s+/g, ' ').trim();

    if (!textContent || textContent.length < 20) {
      return NextResponse.json({ error: 'Could not extract enough text from the file. Please ensure the file contains readable text.' }, { status: 400 });
    }

    const auth = verifyToken(request);
    const resumeId = uuidv4();
    const db = await getDb();
    await db.collection('resumes').insertOne({
      id: resumeId, userId: auth?.id || 'anonymous', fileName: file.name, fileSize: file.size,
      textContent: textContent.substring(0, 15000), analysis: null, createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ resumeId, fileName: file.name, textPreview: textContent.substring(0, 300), charCount: textContent.length });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 });
  }
}

async function handleResumeAnalyze(request) {
  try {
    const body = await request.json();
    const { resumeId, targetRole } = body;
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

    const db = await getDb();
    const resume = await db.collection('resumes').findOne({ id: resumeId });
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    // Parse resume structure
    let structured = null;
    try {
      structured = await parseResumeStructure(resume.textContent, callSingleModel);
    } catch (parseError) {
      console.warn('Resume parsing warning:', parseError.message);
    }

    // Get ATS analysis
    const roleContext = targetRole ? `\nTarget Role: ${targetRole}\nEvaluate keywords and fit for this specific role.` : '';
    const response = await callSingleModel(RESUME_ATS_SYSTEM, `Analyze this resume:${roleContext}\n\n${resume.textContent}`);

    if (!response) {
      return NextResponse.json({ error: 'Failed to analyze resume: LLM did not return a response' }, { status: 500 });
    }

    let analysis;
    try {
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { atsScore: 0, overallFeedback: response, raw: true };
    }

    // Enhance analysis with parsed data
    if (structured) {
      const experience = calculateExperienceYears(structured.experience);
      const skills = extractSkills(structured);
      const seniority = detectSeniorityLevel(experience);
      const focusArea = detectFocusArea(skills);

      analysis.structuredData = {
        contact: structured.contact,
        experience: structured.experience,
        education: structured.education,
        skills: skills,
        totalExperienceYears: experience,
        seniority: seniority,
        focusArea: focusArea,
        certifications: structured.certifications,
        metadata: structured.metadata
      };
    }

    await db.collection('resumes').updateOne(
      { id: resumeId },
      {
        $set: {
          analysis,
          structured,
          analyzedAt: new Date().toISOString(),
          targetRole,
        }
      }
    );

    await logAnalytics(db, 'resume_analyzed', { resumeId, atsScore: analysis.atsScore });

    return NextResponse.json({ resumeId, analysis });
  } catch (error) {
    console.error('Resume analysis error:', error.message);
    return NextResponse.json({ error: 'Analysis failed: ' + error.message }, { status: 500 });
  }
}

async function handleGetResumes(request) {
  const auth = verifyToken(request);
  const db = await getDb();
  const filter = auth ? { userId: auth.id } : {};
  const resumes = await db.collection('resumes').find(filter, { projection: { textContent: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
  return NextResponse.json({ resumes });
}

async function handleGetResume(resumeId) {
  const db = await getDb();
  const resume = await db.collection('resumes').findOne({ id: resumeId });
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ resume });
}

// --- MOCK INTERVIEW ---
async function handleInterviewStart(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { role, level, type } = body;

  const prompt = `Start a mock ${type || 'behavioral'} interview for a ${level || 'mid-level'} ${role || 'Software Engineer'} position. Ask the FIRST question only. Be professional.`;

  try {
    const response = await callSingleModel(INTERVIEW_SYSTEM, prompt);
    if (!response) {
      return NextResponse.json({ error: 'Failed to start interview: LLM did not return a response' }, { status: 500 });
    }
    
    const db = await getDb();
    const sessionId = uuidv4();

    await db.collection('sessions').insertOne({
      id: sessionId, userId: auth?.id || 'anonymous',
      title: `Interview: ${role || 'Software Engineer'}`,
      type: 'mock-interview', role: role || 'Software Engineer', level: level || 'mid-level',
      interviewType: type || 'behavioral', questionCount: 1, scores: [],
      messages: [
        { role: 'system', content: prompt, hidden: true },
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    await logAnalytics(db, 'interview_started', { userId: auth?.id, role, level, type });
    return NextResponse.json({ sessionId, question: response, questionNumber: 1 });
  } catch (error) {
    console.error('Interview start error:', error.message);
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
  }
}

async function handleInterviewRespond(request) {
  const body = await request.json();
  const { sessionId, answer } = body;
  if (!sessionId || !answer) return NextResponse.json({ error: 'sessionId and answer required' }, { status: 400 });

  const db = await getDb();
  const session = await db.collection('sessions').findOne({ id: sessionId });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newCount = (session.questionCount || 1) + 1;
  const isLast = newCount > 5;

  const evalPrompt = `The candidate is interviewing for ${session.role} (${session.level}).
Question was the previous message. Their answer: "${answer}"

${isLast ? 'This is the FINAL question. Provide overall interview assessment.' : `This is question ${newCount-1} of 5.`}

Evaluate and return structured JSON feedback with score, technical accuracy, communication, structure, confidence scores, strengths, improvements, a sample better answer, and ${isLast ? 'final assessment' : 'the next question'}.`;

  try {
    const recentMsgs = session.messages.filter(m => !m.hidden).slice(-6).map(m => ({ role: m.role, content: m.content }));
    const client = getOpenAIClient();
    const response = await callModel(client, getModelStr('openai', 'gpt-4.1'), [
      { role: 'system', content: INTERVIEW_FEEDBACK_SYSTEM },
      ...recentMsgs,
      { role: 'user', content: evalPrompt },
    ]);

    if (!response) {
      return NextResponse.json({ error: 'Failed to evaluate answer: LLM did not return a response' }, { status: 500 });
    }

    let feedback;
    try {
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      feedback = JSON.parse(jsonStr);
    } catch {
      feedback = { score: 5, maxScore: 10, feedback: response, raw: true };
    }

    await db.collection('sessions').updateOne({ id: sessionId }, {
      $push: {
        messages: { $each: [
          { role: 'user', content: answer, timestamp: new Date().toISOString() },
          { role: 'assistant', content: JSON.stringify(feedback), timestamp: new Date().toISOString(), structured: true },
        ]},
        scores: feedback.score || 5,
      },
      $set: { questionCount: newCount, updatedAt: new Date().toISOString() },
    });

    await logAnalytics(db, 'interview_answer', { sessionId, score: feedback.score });
    return NextResponse.json({ sessionId, feedback, questionNumber: newCount, isComplete: isLast });
  } catch (error) {
    console.error('Interview respond error:', error.message);
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
  }
}

// --- JOB MATCHING ---
async function handleJobMatch(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { skills, interests, experience, targetIndustry, location, minSalary } = body;

  try {
    const db = await getDb();
    const userId = auth?.id || 'anonymous';

    // Try to fetch REAL jobs from job APIs
    let realJobs = [];
    try {
      const keywords = Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(s => s);
      realJobs = await searchAllJobSources(keywords, {
        location: location || 'Remote',
        minSalary: minSalary || 50000,
        limit: 15
      });
      console.log(`✓ Found ${realJobs.length} real job matches`);
    } catch (apiError) {
      console.warn('Real job search failed:', apiError.message, '- Falling back to LLM generation');
    }

    let finalMatches = [];

    // If real jobs found, rank them by relevance using LLM
    if (realJobs && realJobs.length > 0) {
      try {
        const ranked = await rankJobsByRelevance(realJobs, { skills, interests, experience, location }, callSingleModel);
        finalMatches = ranked.slice(0, 10); // Top 10 matches
      } catch (rankError) {
        console.warn('Job ranking failed:', rankError.message);
        finalMatches = realJobs.slice(0, 10);
      }
    } else {
      // Fallback: Use LLM to generate job matches
      console.log('Using LLM-based job generation (no real job APIs available)');

      const prompt = `Find the best matching job roles for this profile:
Skills: ${skills ? (Array.isArray(skills) ? skills.join(', ') : skills) : 'Not specified'}
Interests: ${interests || 'Not specified'}
Experience: ${experience || 'Not specified'}
Target Industry: ${targetIndustry || 'Any'}
Location: ${location || 'Any'}
Minimum Salary: ${minSalary ? `$${minSalary}` : 'Any'}

Return 7-10 matching roles with match scores (0-100), suggested salary ranges, required skills, skill gaps, growth potential, and demand level.`;

      const result = await callMultiModel(JOB_MATCH_SYSTEM, prompt, ['GPT-4 Turbo', 'Claude 3.5 Sonnet', 'Gemini 2.0 Flash']);

      let llmSummary = '';
      let topSkillGaps = [];
      let recommendations = [];

      if (result && result.combinedResponse) {
        let parsed;
        try {
          const jsonStr = result.combinedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          parsed = JSON.parse(jsonStr);
          finalMatches = parsed.matches || [];
          llmSummary = parsed.summary || '';
          topSkillGaps = parsed.topSkillGaps || [];
          recommendations = parsed.recommendations || [];
        } catch {
          console.warn('Failed to parse LLM response as JSON, returning raw');
          llmSummary = result.combinedResponse;
          finalMatches = [];
        }
      } else {
        // Fallback to mock jobs
        finalMatches = getMockJobs(skills || 'Software Engineer', { location: location || 'Remote' });
      }

      // Build response with LLM extras
      var responseSummary = llmSummary;
      var responseTopSkillGaps = topSkillGaps;
      var responseRecommendations = recommendations;
      var responseRaw = finalMatches.length === 0 && llmSummary;
    }

    // Normalize real job fields to match display schema
    finalMatches = finalMatches.map(m => ({
      role: m.role || m.jobTitle || 'Unknown Role',
      company_type: m.company_type || m.company || 'Company',
      matchScore: m.matchScore || 0,
      salary: m.salary || 'Not specified',
      skills_matched: m.skills_matched || m.keyReasons || [],
      skills_gap: m.skills_gap || m.skillGaps || [],
      why_match: m.why_match || (m.keyReasons ? m.keyReasons.join('. ') : `Matches your ${skills ? 'skills' : 'profile'}`),
      growth_potential: m.growth_potential || 'medium',
      demand: m.demand || 'medium',
      jobUrl: m.jobUrl || null,
      postedDate: m.postedDate || null,
      employmentType: m.employmentType || 'FULLTIME',
      source: m.source || 'ai',
      location: m.location || location || 'Remote'
    }));

    const dataSource = realJobs.length > 0 ? 'real_jobs_ranked_by_ai' : 'ai_generated';

    // Store results for analytics and user history
    const searchId = uuidv4();
    await db.collection('job_matches').insertOne({
      id: searchId,
      userId,
      input: { skills, interests, experience, targetIndustry, location, minSalary },
      matches: finalMatches,
      totalMatches: finalMatches.length,
      dataSource: realJobs.length > 0 ? 'REAL_JOBS' : 'LLM_GENERATED',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await logAnalytics(db, 'job_match', { userId, matchCount: finalMatches.length, source: realJobs.length > 0 ? 'real_api' : 'llm' });

    return NextResponse.json({
      searchId,
      matches: finalMatches,
      totalMatches: finalMatches.length,
      summary: responseSummary || '',
      topSkillGaps: responseTopSkillGaps || [],
      recommendations: responseRecommendations || [],
      raw: responseRaw || false,
      dataSource,
      message: realJobs.length > 0 ? 'Top job matches from real job boards, ranked using AI' : 'Job matches generated using AI'
    });
  } catch (error) {
    console.error('Job match error:', error.message);
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
  }
}

// --- JOB MATCH HISTORY ---
async function handleJobMatchHistory(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const db = await getDb();
    const history = await db.collection('job_matches')
      .find({ userId: auth.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    return NextResponse.json({ history: history.map(h => ({ id: h.id, input: h.input, totalMatches: h.totalMatches, dataSource: h.dataSource, createdAt: h.createdAt })) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- SAVED JOBS ---
async function handleSaveJob(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { jobTitle, company, jobUrl, salary, matchScore, location, source } = body;
    if (!jobTitle) return NextResponse.json({ error: 'Job title required' }, { status: 400 });

    const db = await getDb();
    const jobId = body.jobId || uuidv4();
    
    // Check if already saved
    const existing = await db.collection('saved_jobs').findOne({ userId: auth.id, jobTitle: jobTitle });
    if (existing) return NextResponse.json({ message: 'Job already saved', jobId: existing.jobId });
    
    await db.collection('saved_jobs').insertOne({
      jobId,
      userId: auth.id,
      jobTitle,
      company: company || 'Unknown',
      jobUrl: jobUrl || null,
      salary: salary || null,
      matchScore: matchScore || null,
      location: location || null,
      source: source || 'ai',
      status: 'saved', // saved, applied, interviewing, rejected, offered
      notes: '',
      savedAt: new Date().toISOString(),
      appliedAt: null,
      updatedAt: new Date().toISOString()
    });
    
    await logAnalytics(db, 'job_saved', { userId: auth.id, jobId });
    return NextResponse.json({ message: 'Job saved successfully', jobId });
  } catch (error) {
    console.error('Save job error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleUpdateSavedJob(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { jobId, status, notes } = body;
    if (!jobId) return NextResponse.json({ error: 'Job ID required' }, { status: 400 });

    const db = await getDb();
    const updates = { updatedAt: new Date().toISOString() };
    if (status) {
      updates.status = status;
      if (status === 'applied') updates.appliedAt = new Date().toISOString();
    }
    if (notes !== undefined) updates.notes = notes;

    await db.collection('saved_jobs').updateOne(
      { userId: auth.id, jobId },
      { $set: updates }
    );
    
    return NextResponse.json({ message: 'Job updated', jobId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleDeleteSavedJob(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { jobId } = body;
    if (!jobId) return NextResponse.json({ error: 'Job ID required' }, { status: 400 });

    const db = await getDb();
    await db.collection('saved_jobs').deleteOne({ userId: auth.id, jobId });
    return NextResponse.json({ message: 'Job removed' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetSavedJobs(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const jobs = await db.collection('saved_jobs').find({ userId: auth.id }).sort({ savedAt: -1 }).toArray();
    
    const stats = {
      total: jobs.length,
      saved: jobs.filter(j => j.status === 'saved').length,
      applied: jobs.filter(j => j.status === 'applied').length,
      interviewing: jobs.filter(j => j.status === 'interviewing').length,
      offered: jobs.filter(j => j.status === 'offered').length,
      rejected: jobs.filter(j => j.status === 'rejected').length
    };
    
    return NextResponse.json({ jobs, stats });
  } catch (error) {
    console.error('Get saved jobs error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- JOB ALERTS ---
async function handleCreateJobAlert(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { skills, location, minSalary, jobTypes, frequency } = body;
    if (!skills || skills.length === 0) return NextResponse.json({ error: 'At least one skill required' }, { status: 400 });

    const db = await getDb();
    
    // Check alert limit (max 5 per user)
    const existingCount = await db.collection('job_alerts').countDocuments({ userId: auth.id, isActive: true });
    if (existingCount >= 5) return NextResponse.json({ error: 'Maximum 5 active alerts allowed' }, { status: 400 });
    
    const result = await createJobAlert(db, auth.id, auth.email || '', {
      skills: Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()),
      locations: location ? [location] : [],
      minimumSalary: minSalary || 0,
      jobTypes: jobTypes || ['full-time'],
    }, frequency || 'daily');

    await logAnalytics(db, 'job_alert_created', { userId: auth.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetJobAlerts(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const result = await getUserJobAlerts(db, auth.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleToggleJobAlert(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { alertId, isActive } = body;
    const db = await getDb();
    const result = await updateJobAlert(db, alertId, { isActive });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleDeleteJobAlert(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { alertId } = body;
    const db = await getDb();
    const result = await deleteJobAlert(db, alertId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- LIVE JOB SEARCH ---
async function handleLiveJobSearch(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { keywords, location, minSalary, limit } = body;

  try {
    const keywordArr = Array.isArray(keywords) ? keywords : (keywords || '').split(',').map(s => s.trim()).filter(s => s);
    if (keywordArr.length === 0) return NextResponse.json({ error: 'Keywords required' }, { status: 400 });
    
    let jobs = await searchAllJobSources(keywordArr, {
      location: location || 'Remote',
      minSalary: minSalary || 0,
      limit: limit || 20
    });
    
    // Mark source type
    const hasRealJobs = jobs.some(j => j.source !== 'mock');
    
    return NextResponse.json({
      jobs: jobs.map(j => ({
        id: j.jobId,
        title: j.jobTitle,
        company: j.company,
        location: j.location,
        salary: j.salary,
        description: j.jobDescription,
        url: j.jobUrl,
        postedDate: j.postedDate,
        type: j.employmentType || 'FULLTIME',
        source: j.source
      })),
      total: jobs.length,
      hasRealJobs,
      message: hasRealJobs ? 'Live job listings from job boards' : 'Sample listings (configure API keys for real jobs)'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- PHASE 2: RESUME A/B TESTING ---
async function handleCreateResumeVariant(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { baseResumeId, changes } = body;
    if (!baseResumeId || !changes) return NextResponse.json({ error: 'Base resume and changes required' }, { status: 400 });

    const db = await getDb();
    const result = await createResumeVariant(db, auth.id, baseResumeId, changes);

    if (result.success) {
      await logAnalytics(db, 'resume_variant_created', { userId: auth.id, baseResumeId, changesLabel: changes.label });
      return NextResponse.json({ message: 'Variant created', variantId: result.variantId });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Create variant error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleTrackResumeMetric(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { resumeId, metricType, value } = body;
    if (!resumeId || !metricType) return NextResponse.json({ error: 'Resume ID and metric type required' }, { status: 400 });

    const db = await getDb();
    const result = await trackResumeMetric(db, auth.id, resumeId, metricType, value || 1);

    if (result.success) {
      return NextResponse.json({ message: `Tracked: ${metricType}`, metric: result.metric });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Track metric error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetResumeComparison(request, baseResumeId) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const result = await getResumeComparison(db, auth.id, baseResumeId);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Get comparison error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleResumeOptimizationRecommendations(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const result = await recommendResumeOptimizations(db, auth.id, callSingleModel);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Recommendations error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- PHASE 2: STREAMING CHAT ---
async function handleChatSendStreamWrapper(request) {
  // Wrapper that passes required dependencies to streaming function
  try {
    return await handleChatSendStream(
      request,
      callMultiModel,
      callSingleModel,
      getOpenAIClient,
      getModelStr,
      callModel
    );
  } catch (error) {
    console.error('Stream wrapper error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- PHASE 2: INTERVIEW TRANSCRIPTION & REPORTS ---
async function handleInterviewUploadAudio(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { sessionId, audioBase64 } = body;
    if (!sessionId || !audioBase64) return NextResponse.json({ error: 'Session ID and audio required' }, { status: 400 });

    // Decode base64 audio
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Transcribe
    const transcriptionResult = await transcribeInterviewAudio(audioBuffer, sessionId, callSingleModel);
    if (!transcriptionResult.success) {
      return NextResponse.json({ error: transcriptionResult.error }, { status: 500 });
    }

    const db = await getDb();
    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Analyze transcription
    const analysisResult = await analyzeInterviewTranscription(
      transcriptionResult.transcription,
      {
        role: session.role,
        level: session.level
      },
      callSingleModel
    );

    // Store transcription
    await db.collection('sessions').updateOne(
      { id: sessionId },
      {
        $set: {
          transcription: transcriptionResult.transcription,
          transcriptionAnalysis: analysisResult.analysis || {},
          audioProcessedAt: new Date().toISOString()
        }
      }
    );

    await logAnalytics(db, 'interview_transcribed', { userId: auth.id, sessionId });

    return NextResponse.json({
      message: 'Audio transcribed successfully',
      transcription: transcriptionResult.transcription,
      analysis: analysisResult.analysis
    });
  } catch (error) {
    console.error('Upload audio error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGenerateInterviewReport(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    const db = await getDb();
    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (!session.transcription) {
      return NextResponse.json({ error: 'Transcription not available. Please upload audio first.' }, { status: 400 });
    }

    // Generate comprehensive report
    const reportResult = await generateInterviewReport(
      db,
      sessionId,
      session.transcription,
      { analysis: session.transcriptionAnalysis },
      {
        role: session.role,
        level: session.level,
        interviewType: session.interviewType
      },
      callSingleModel
    );

    if (!reportResult.success) {
      return NextResponse.json({ error: reportResult.error }, { status: 500 });
    }

    await logAnalytics(db, 'interview_report_generated', { userId: auth.id, sessionId, reportId: reportResult.report.reportId });

    return NextResponse.json({
      message: 'Report generated successfully',
      report: reportResult.report
    });
  } catch (error) {
    console.error('Generate report error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleExportInterviewReport(request, reportId) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const report = await db.collection('interview_reports').findOne({ reportId });
    
    if (!report || report.userId !== auth.id) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const pdfResult = await exportInterviewReportPDF(report);

    if (!pdfResult.success) {
      return NextResponse.json({ error: pdfResult.error }, { status: 500 });
    }

    await logAnalytics(db, 'interview_report_exported', { userId: auth.id, reportId });

    return new NextResponse(pdfResult.content, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfResult.filename}"`
      }
    });
  } catch (error) {
    console.error('Export report error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- ADMIN ANALYTICS ---
async function handleGetAnalytics(request) {
  const auth = verifyToken(request);
  if (!auth || auth.role !== 'admin') {
    // Allow any authenticated user for now, but mark non-admin
  }

  const db = await getDb();

  const [totalUsers, totalResumes, totalInterviews, totalChats, totalCareerPaths, totalJobMatches] = await Promise.all([
    db.collection('users').countDocuments(),
    db.collection('resumes').countDocuments(),
    db.collection('sessions').countDocuments({ type: 'mock-interview' }),
    db.collection('sessions').countDocuments({ type: 'career-chat' }),
    db.collection('career_paths').countDocuments(),
    db.collection('job_matches').countDocuments(),
  ]);

  // Get recent analytics events
  const recentEvents = await db.collection('analytics').find().sort({ createdAt: -1 }).limit(100).toArray();

  // ATS scores
  const resumesWithScores = await db.collection('resumes').find({ 'analysis.atsScore': { $gt: 0 } }, { projection: { 'analysis.atsScore': 1 } }).toArray();
  const atsScores = resumesWithScores.map(r => r.analysis?.atsScore).filter(Boolean);
  const avgAtsScore = atsScores.length > 0 ? Math.round(atsScores.reduce((a, b) => a + b, 0) / atsScores.length) : 0;

  // Module usage breakdown
  const moduleUsage = {};
  recentEvents.forEach(e => {
    moduleUsage[e.type] = (moduleUsage[e.type] || 0) + 1;
  });

  // Daily activity (last 7 days)
  const dailyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    const count = recentEvents.filter(e => e.createdAt?.startsWith(dayStr)).length;
    dailyActivity.push({ date: dayStr, count });
  }

  return NextResponse.json({
    stats: { totalUsers, totalResumes, totalInterviews, totalChats, totalCareerPaths, totalJobMatches, avgAtsScore },
    moduleUsage, dailyActivity,
    recentEvents: recentEvents.slice(0, 20).map(e => ({ type: e.type, data: e.data, createdAt: e.createdAt })),
  });
}

// --- PHASE 3: CAREER LEARNING RESOURCES ---
async function handleGenerateLearningPath(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { resumeId, targetRole } = body;
    if (!resumeId || !targetRole) {
      return NextResponse.json({ error: 'Resume ID and target role required' }, { status: 400 });
    }

    const db = await getDb();
    const resume = await db.collection('resumes').findOne({ id: resumeId });
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    // Get structured resume data
    const structured = resume.structured || {};
    
    // Generate learning path with course recommendations
    const learningPath = await generateLearningPath(structured, targetRole, {
      limit: 5,
      level: 'beginner', // Can be customized based on user level
      language: 'English',
    });

    // Save learning path to database
    const pathId = uuidv4();
    await db.collection('learning_paths').insertOne({
      pathId,
      userId: auth.id,
      resumeId,
      targetRole,
      learningPath,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await logAnalytics(db, 'learning_path_generated', { userId: auth.id, targetRole });

    return NextResponse.json({
      success: true,
      pathId,
      learningPath,
      message: `Learning path generated for ${targetRole} role`,
    });
  } catch (error) {
    console.error('Generate learning path error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetLearningPaths(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const paths = await db.collection('learning_paths')
      .find({ userId: auth.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return NextResponse.json({
      success: true,
      paths,
      totalPaths: paths.length,
    });
  } catch (error) {
    console.error('Get learning paths error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleTrackCourseProgress(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { courseId, platform, progressPercentage } = body;
    if (!courseId || !platform || progressPercentage === undefined) {
      return NextResponse.json({ error: 'Course ID, platform, and progress required' }, { status: 400 });
    }

    if (progressPercentage < 0 || progressPercentage > 100) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 });
    }

    const db = await getDb();
    const result = await trackCourseProgress(db, auth.id, courseId, platform, progressPercentage);

    if (result.success) {
      await logAnalytics(db, 'course_progress_tracked', {
        userId: auth.id,
        courseId,
        platform,
        progress: progressPercentage,
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        progressive: result.progressive,
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Track course progress error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetLearningProgress(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const progress = await getLearningProgress(db, auth.id);

    if (progress.success) {
      return NextResponse.json(progress);
    } else {
      return NextResponse.json({ error: progress.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Get learning progress error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetSkillGaps(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { resumeId, targetRole } = body;
    if (!resumeId || !targetRole) {
      return NextResponse.json({ error: 'Resume ID and target role required' }, { status: 400 });
    }

    const db = await getDb();
    const resume = await db.collection('resumes').findOne({ id: resumeId });
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    // Analyze skill gaps
    const skillGapAnalysis = analyzeSkillGaps(resume.structured || {}, targetRole);

    // Get course recommendations for each skill gap
    const recommendations = await getRecommendedCourses(skillGapAnalysis.prioritySkills, {
      limit: 3,
    });

    return NextResponse.json({
      success: true,
      skillAnalysis: skillGapAnalysis,
      courseRecommendations: recommendations,
    });
  } catch (error) {
    console.error('Get skill gaps error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- PHASE 4: ANALYTICS DASHBOARD ---
async function handleGetDashboard(request) {
  try {
    const db = await getDb();
    const dashboard = await getDashboardMetrics(db);

    if (dashboard.error) {
      return NextResponse.json({ error: dashboard.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetDAU(request) {
  try {
    const db = await getDb();
    const daysBack = new URL(request.url).searchParams.get('days') || '1';
    const dau = await calculateDAU(db, parseInt(daysBack));

    return NextResponse.json({
      success: true,
      dau,
    });
  } catch (error) {
    console.error('DAU error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetWAU(request) {
  try {
    const db = await getDb();
    const wau = await calculateWAU(db);

    return NextResponse.json({
      success: true,
      wau,
    });
  } catch (error) {
    console.error('WAU error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetMAU(request) {
  try {
    const db = await getDb();
    const mau = await calculateMAU(db);

    return NextResponse.json({
      success: true,
      mau,
    });
  } catch (error) {
    console.error('MAU error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetFunnel(request) {
  try {
    const db = await getDb();
    const funnel = await analyzeFunnel(db);

    if (funnel.error) {
      return NextResponse.json({ error: funnel.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      funnel,
    });
  } catch (error) {
    console.error('Funnel error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetSegmentation(request) {
  try {
    const db = await getDb();
    const segmentType = new URL(request.url).searchParams.get('type') || 'experience';
    const segmentation = await getUserSegmentation(db, segmentType);

    if (segmentation.error) {
      return NextResponse.json({ error: segmentation.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      segmentation,
    });
  } catch (error) {
    console.error('Segmentation error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetCohort(request) {
  try {
    const db = await getDb();
    const cohorts = await analyzeCohorts(db);

    if (cohorts.error) {
      return NextResponse.json({ error: cohorts.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cohorts,
    });
  } catch (error) {
    console.error('Cohort error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetModuleUsage(request) {
  try {
    const db = await getDb();
    const usage = await getModuleUsage(db);

    if (usage.error) {
      return NextResponse.json({ error: usage.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('Module usage error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- PHASE 5: CHAT EXPORT & SHARING ---
async function handleExportChatMarkdown(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    const db = await getDb();
    const result = await exportAsMarkdown(db, sessionId, auth.id);

    if (result.success) {
      await logAnalytics(db, 'chat_exported_markdown', { userId: auth.id, sessionId });

      return new NextResponse(result.content, {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Export markdown error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleExportChatHTML(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { sessionId } = body;
    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    const db = await getDb();
    const result = await exportAsHTML(db, sessionId, auth.id);

    if (result.success) {
      await logAnalytics(db, 'chat_exported_html', { userId: auth.id, sessionId });

      return new NextResponse(result.content, {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Export HTML error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleCreateShareLink(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { sessionId, password, readOnly, expirationDays } = body;
    if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

    const db = await getDb();
    const result = await createShareLink(db, sessionId, {
      password,
      readOnly: readOnly !== false,
      expirationDays: expirationDays || 30,
    });

    if (result.success) {
      await logAnalytics(db, 'chat_share_created', { 
        userId: auth.id, 
        sessionId, 
        passwordProtected: result.passwordProtected 
      });

      return NextResponse.json({
        success: true,
        shareCode: result.shareCode,
        shareUrl: result.shareUrl,
        expiresAt: result.expiresAt,
        passwordProtected: result.passwordProtected,
        message: result.message,
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Create share link error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleRevokeShareLink(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { shareCode } = body;
    if (!shareCode) return NextResponse.json({ error: 'Share code required' }, { status: 400 });

    const db = await getDb();
    const result = await revokeShareLink(db, shareCode, auth.id);

    if (result.success) {
      await logAnalytics(db, 'chat_share_revoked', { userId: auth.id, shareCode });

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
  } catch (error) {
    console.error('Revoke share error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetShareLinks(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const shares = await getUserShareLinks(db, auth.id);

    return NextResponse.json({
      success: true,
      shares,
      totalShares: shares.length,
    });
  } catch (error) {
    console.error('Get shares error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleGetPublicSharedChat(shareCode, password = null, clientIp = '127.0.0.1') {
  try {
    const db = await getDb();
    const result = await getSharedChat(db, shareCode, password, clientIp);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, passwordRequired: result.passwordRequired },
        { status: result.status || 500 }
      );
    }

    // Return session with share info
    return NextResponse.json({
      success: true,
      session: result.session,
      shareInfo: result.shareInfo,
      message: 'Read-only access to shared chat',
    });
  } catch (error) {
    console.error('Get public shared chat error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- HEALTH ---
async function handleHealth() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', error: error.message }, { status: 500 });
  }
}
  async function handleGuestLogin() {
  try {
    const guestUser = {
      id: uuidv4(),
      email: `guest-${Date.now()}@careergpt.local`,
      role: 'guest'
    };

    const token = generateToken(guestUser);

    return NextResponse.json({
      token,
      user: {
        id: guestUser.id,
        name: 'Guest',
        email: guestUser.email,
        role: 'guest'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============ ROUTER ============
function getPath(request) {
  return new URL(request.url).pathname.replace('/api', '');
}

export async function GET(request) {
  const path = getPath(request);
  try {
    if (path === '/health') return handleHealth();
    // Debug endpoints - for development/testing
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    if (path === '/debug/rate-limiter-reset') {
      authLimiter.resetAll();
      registerLimiter.resetAll();
      return NextResponse.json({ message: 'Rate limiter reset', timestamp: new Date() });
    }
    // Auto-verify user by email (localhost/development only)
    if (path.startsWith('/debug/verify-user/') && clientIp === '127.0.0.1') {
      const email = decodeURIComponent(path.split('/debug/verify-user/')[1]);
      const db = await getDb();
      const result = await db.collection('users').updateOne(
        { email: email.toLowerCase() },
        { $set: { verified: true, verificationToken: null } }
      );
      if (result.modifiedCount === 0) {
        return NextResponse.json({ error: 'User not found', email }, { status: 404 });
      }
      return NextResponse.json({ message: 'User verified', email, timestamp: new Date() });
    }
    if (path === '/models') return NextResponse.json({ models: ALL_MODELS.map(m => ({ name: m.name, provider: m.provider, model: m.model, color: m.color, guaranteed: m.guaranteed })) });
    if (path === '/profile') return handleGetProfile(request);
    if (path === '/chat/sessions') return handleGetSessions(request);
    if (path.startsWith('/chat/sessions/')) return handleGetSession(request, path.split('/chat/sessions/')[1]);
    if (path === '/resumes') return handleGetResumes(request);
    if (path.startsWith('/resume/')) return handleGetResume(path.split('/resume/')[1]);
    if (path.startsWith('/resume/compare/')) return handleGetResumeComparison(request, path.split('/resume/compare/')[1]);
    if (path === '/career-paths') return handleGetCareerPaths(request);
    if (path.startsWith('/interview/report/')) return handleExportInterviewReport(request, path.split('/interview/report/')[1]);
    if (path === '/admin/analytics') return handleGetAnalytics(request);
    if (path === '/learning-paths') return handleGetLearningPaths(request);
    if (path === '/learning-progress') return handleGetLearningProgress(request);
    if (path === '/dashboard') return handleGetDashboard(request);
    if (path === '/analytics/dau') return handleGetDAU(request);
    if (path === '/analytics/wau') return handleGetWAU(request);
    if (path === '/analytics/mau') return handleGetMAU(request);
    if (path === '/analytics/funnel') return handleGetFunnel(request);
    if (path === '/analytics/segmentation') return handleGetSegmentation(request);
    if (path === '/analytics/cohorts') return handleGetCohort(request);
    if (path === '/analytics/module-usage') return handleGetModuleUsage(request);
    if (path === '/chat-shares') return handleGetShareLinks(request);
    if (path.startsWith('/shared-chat/')) return handleGetPublicSharedChat(path.split('/shared-chat/')[1], new URL(request.url).searchParams.get('p'), clientIp);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const path = getPath(request);
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
  
  try {
    // Auth endpoints (with rate limiting)
    if (path === '/auth/register') return handleRegister(await request.json(), clientIp);
    if (path === '/auth/login') return handleLogin(await request.json(), clientIp);
    if (path === '/auth/guest') return handleGuestLogin();
    if (path === '/auth/verify-email') return handleVerifyEmail((await request.json()).token);
    if (path === '/auth/forgot-password') return handleForgotPassword(await request.json());
    if (path === '/auth/reset-password') return handleResetPassword(await request.json());
    
    // Original endpoints
    if (path === '/chat/send') return handleChatSend(request);
    if (path === '/chat/rename-session') return handleRenameSession(request);
    if (path === '/resume/upload') return handleResumeUpload(request);
    if (path === '/resume/analyze') return handleResumeAnalyze(request);
    if (path === '/career-path/generate') return handleGenerateCareerPath(request);
    if (path === '/mock-interview/start') return handleInterviewStart(request);
    if (path === '/mock-interview/respond') return handleInterviewRespond(request);
    if (path === '/job-match') return handleJobMatch(request);
    if (path === '/job-match/history') return handleJobMatchHistory(request);
    if (path === '/saved-jobs/save') return handleSaveJob(request);
    if (path === '/saved-jobs/update') return handleUpdateSavedJob(request);
    if (path === '/saved-jobs/delete') return handleDeleteSavedJob(request);
    if (path === '/saved-jobs') return handleGetSavedJobs(request);
    if (path === '/job-alerts/create') return handleCreateJobAlert(request);
    if (path === '/job-alerts') return handleGetJobAlerts(request);
    if (path === '/job-alerts/toggle') return handleToggleJobAlert(request);
    if (path === '/job-alerts/delete') return handleDeleteJobAlert(request);
    if (path === '/jobs/live-search') return handleLiveJobSearch(request);
    
    // Phase 2: Resume A/B Testing
    if (path === '/resume/create-variant') return handleCreateResumeVariant(request);
    if (path === '/resume/track-metric') return handleTrackResumeMetric(request);
    if (path === '/resume/recommendations') return handleResumeOptimizationRecommendations(request);
    
    // Phase 2: Streaming Chat
    if (path === '/chat/send-stream') return handleChatSendStreamWrapper(request);
    
    // Phase 2: Interview Transcription & Reports
    if (path === '/interview/upload-audio') return handleInterviewUploadAudio(request);
    if (path === '/interview/generate-report') return handleGenerateInterviewReport(request);
    
    // Phase 3: Career Learning Resources
    if (path === '/learning-path/generate') return handleGenerateLearningPath(request);
    if (path === '/learning-path/skill-gaps') return handleGetSkillGaps(request);
    if (path === '/course/track-progress') return handleTrackCourseProgress(request);
    
    // Phase 5: Chat Export & Sharing
    if (path === '/chat/export-markdown') return handleExportChatMarkdown(request);
    if (path === '/chat/export-html') return handleExportChatHTML(request);
    if (path === '/chat/create-share') return handleCreateShareLink(request);
    if (path === '/chat/revoke-share') return handleRevokeShareLink(request);
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const path = getPath(request);
  try {
    if (path === '/profile') return handleUpdateProfile(request);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const path = getPath(request);
  try {
    if (path.startsWith('/chat/sessions/')) return handleDeleteSession(path.split('/chat/sessions/')[1]);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
}
