import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as pdfParseModule from 'pdf-parse';

// ============ CONFIG ============
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'careergpt';
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;
const LLM_PROXY_URL = process.env.LLM_PROXY_URL || 'https://integrations.emergentagent.com/llm';
const JWT_SECRET = process.env.JWT_SECRET || 'careergpt-secret-key-2025';

let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(MONGO_URL);
  cachedDb = client.db(DB_NAME);
  // Create indexes
  try {
    await cachedDb.collection('users').createIndex({ email: 1 }, { unique: true });
    await cachedDb.collection('sessions').createIndex({ userId: 1, updatedAt: -1 });
    await cachedDb.collection('resumes').createIndex({ userId: 1, createdAt: -1 });
    await cachedDb.collection('career_paths').createIndex({ userId: 1 });
    await cachedDb.collection('job_matches').createIndex({ userId: 1 });
    await cachedDb.collection('analytics').createIndex({ type: 1, createdAt: -1 });
  } catch (e) { /* indexes may already exist */ }
  return cachedDb;
}

// ============ LLM SETUP ============
function getOpenAIClient() {
  const isEmergent = EMERGENT_KEY && EMERGENT_KEY.startsWith('sk-emergent-');
  if (isEmergent) {
    return new OpenAI({ apiKey: EMERGENT_KEY, baseURL: LLM_PROXY_URL });
  }
  return new OpenAI({ apiKey: EMERGENT_KEY });
}

function getModelStr(provider, model) {
  const isEmergent = EMERGENT_KEY && EMERGENT_KEY.startsWith('sk-emergent-');
  if (isEmergent) {
    if (provider === 'gemini') return `gemini/${model}`;
    return model;
  }
  return `${provider}/${model}`;
}

const ALL_MODELS = [
  { provider: 'openai', model: 'gpt-4.1', name: 'GPT-4.1', color: '#10a37f', guaranteed: true },
  { provider: 'anthropic', model: 'claude-4-sonnet-20250514', name: 'Claude 4 Sonnet', color: '#d97706', guaranteed: true },
  { provider: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', color: '#4285f4', guaranteed: true },
  { provider: 'xai', model: 'grok-3-mini', name: 'Grok 3 Mini', color: '#ef4444', guaranteed: false },
  { provider: 'perplexity', model: 'sonar-pro', name: 'Perplexity Sonar Pro', color: '#22d3ee', guaranteed: false },
];

async function callModel(client, modelStr, messages) {
  try {
    const response = await client.chat.completions.create({
      model: modelStr, messages, max_tokens: 2500, temperature: 0.7,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Model ${modelStr} error:`, error.message);
    return null;
  }
}

async function callMultiModel(systemPrompt, userMessage, activeModelNames = null) {
  const client = getOpenAIClient();
  const modelsToUse = activeModelNames
    ? ALL_MODELS.filter(m => activeModelNames.includes(m.name))
    : ALL_MODELS;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const results = await Promise.all(modelsToUse.map(async (m) => {
    const start = Date.now();
    const modelStr = getModelStr(m.provider, m.model);
    const response = await callModel(client, modelStr, messages);
    return { name: m.name, color: m.color, response, duration: Date.now() - start, success: !!response };
  }));

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
async function handleRegister(body) {
  const { name, email, password } = body;
  if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(), name, email: email.toLowerCase(), password: hashedPassword,
    role: 'user', profile: { skills: [], interests: [], education: '', experience: '' },
    createdAt: new Date().toISOString(),
  };

  await db.collection('users').insertOne(user);
  const token = generateToken(user);
  await logAnalytics(db, 'user_register', { userId: user.id });

  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile } });
}

async function handleLogin(body) {
  const { email, password } = body;
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const token = generateToken(user);
  await logAnalytics(db, 'user_login', { userId: user.id });

  return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile } });
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
    const result = await callMultiModel(CAREER_PATH_SYSTEM, prompt, ['GPT-4.1', 'Claude 4 Sonnet', 'Gemini 2.5 Flash']);
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
        // Use the pdf-parse module - it might be default or named export
        const pdfParseFn = pdfParseModule.default || pdfParseModule;
        const pdfData = await pdfParseFn(buffer);
        textContent = pdfData.text || '';
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError.message);
        // Try to extract any readable text from the buffer
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
  const body = await request.json();
  const { resumeId, targetRole } = body;
  if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

  const db = await getDb();
  const resume = await db.collection('resumes').findOne({ id: resumeId });
  if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

  try {
    const roleContext = targetRole ? `\nTarget Role: ${targetRole}\nEvaluate keywords and fit for this specific role.` : '';
    const response = await callSingleModel(RESUME_ATS_SYSTEM, `Analyze this resume:${roleContext}\n\n${resume.textContent}`);

    let analysis;
    try {
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { atsScore: 0, overallFeedback: response, raw: true };
    }

    await db.collection('resumes').updateOne({ id: resumeId }, { $set: { analysis, analyzedAt: new Date().toISOString() } });
    await logAnalytics(db, 'resume_analyzed', { resumeId, atsScore: analysis.atsScore });

    return NextResponse.json({ resumeId, analysis });
  } catch (error) {
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
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
  }
}

// --- JOB MATCHING ---
async function handleJobMatch(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { skills, interests, experience, targetIndustry } = body;

  const prompt = `Find the best matching job roles for this profile:
Skills: ${skills || 'Not specified'}
Interests: ${interests || 'Not specified'}
Experience: ${experience || 'Not specified'}
Target Industry: ${targetIndustry || 'Any'}

Return 5-7 matching roles with match scores, salary ranges, skill gaps, and explanations.`;

  try {
    const result = await callMultiModel(JOB_MATCH_SYSTEM, prompt, ['GPT-4.1', 'Claude 4 Sonnet', 'Gemini 2.5 Flash']);
    let parsed;
    try {
      const jsonStr = result.combinedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { matches: [], summary: result.combinedResponse, raw: true };
    }

    const db = await getDb();
    await db.collection('job_matches').insertOne({
      id: uuidv4(), userId: auth?.id || 'anonymous', input: { skills, interests, experience, targetIndustry },
      result: parsed, createdAt: new Date().toISOString(),
    });
    await logAnalytics(db, 'job_match', { userId: auth?.id });

    return NextResponse.json({ matches: parsed, models: result.modelResponses.map(r => r.name), synthesized: result.synthesized });
  } catch (error) {
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
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

// ============ ROUTER ============
function getPath(request) {
  return new URL(request.url).pathname.replace('/api', '');
}

export async function GET(request) {
  const path = getPath(request);
  try {
    if (path === '/health') return handleHealth();
    if (path === '/models') return NextResponse.json({ models: ALL_MODELS.map(m => ({ name: m.name, provider: m.provider, model: m.model, color: m.color, guaranteed: m.guaranteed })) });
    if (path === '/profile') return handleGetProfile(request);
    if (path === '/chat/sessions') return handleGetSessions(request);
    if (path.startsWith('/chat/sessions/')) return handleGetSession(request, path.split('/chat/sessions/')[1]);
    if (path === '/resumes') return handleGetResumes(request);
    if (path.startsWith('/resume/')) return handleGetResume(path.split('/resume/')[1]);
    if (path === '/career-paths') return handleGetCareerPaths(request);
    if (path === '/admin/analytics') return handleGetAnalytics(request);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const path = getPath(request);
  try {
    if (path === '/auth/register') return handleRegister(await request.json());
    if (path === '/auth/login') return handleLogin(await request.json());
    if (path === '/chat/send') return handleChatSend(request);
    if (path === '/resume/upload') return handleResumeUpload(request);
    if (path === '/resume/analyze') return handleResumeAnalyze(request);
    if (path === '/career-path/generate') return handleGenerateCareerPath(request);
    if (path === '/mock-interview/start') return handleInterviewStart(request);
    if (path === '/mock-interview/respond') return handleInterviewRespond(request);
    if (path === '/job-match') return handleJobMatch(request);
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
