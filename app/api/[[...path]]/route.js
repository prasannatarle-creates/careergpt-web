import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'careergpt';
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;
const LLM_PROXY_URL = process.env.LLM_PROXY_URL || 'https://integrations.emergentagent.com/llm';

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  const client = await MongoClient.connect(MONGO_URL);
  cachedClient = client;
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

function getOpenAIClient(apiKey) {
  const isEmergent = apiKey && apiKey.startsWith('sk-emergent-');
  if (isEmergent) {
    return new OpenAI({
      apiKey: apiKey,
      baseURL: LLM_PROXY_URL,
    });
  }
  return new OpenAI({ apiKey });
}

function getModelConfig(provider, model) {
  const isEmergent = EMERGENT_KEY && EMERGENT_KEY.startsWith('sk-emergent-');
  if (isEmergent) {
    if (provider === 'gemini') return `gemini/${model}`;
    if (provider === 'xai') return `xai/${model}`;
    if (provider === 'perplexity') return `perplexity/${model}`;
    return model;
  }
  return `${provider}/${model}`;
}

// All 5 AI models - Claude is guaranteed, Grok & Perplexity are attempted
const ALL_MODELS = [
  { provider: 'openai', model: 'gpt-4.1', name: 'GPT-4.1', color: '#10a37f', guaranteed: true },
  { provider: 'anthropic', model: 'claude-4-sonnet-20250514', name: 'Claude 4 Sonnet', color: '#d97706', guaranteed: true },
  { provider: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', color: '#4285f4', guaranteed: true },
  { provider: 'xai', model: 'grok-3-mini', name: 'Grok 3 Mini', color: '#ef4444', guaranteed: false },
  { provider: 'perplexity', model: 'sonar-pro', name: 'Perplexity Sonar Pro', color: '#22d3ee', guaranteed: false },
];

// Default active models (all enabled)
const MODELS = ALL_MODELS;

const CAREER_SYSTEM_PROMPT = `You are CareerGPT, an expert AI career guidance counselor. You help students and job seekers with:
- Career path selection and exploration
- Resume improvement and optimization
- Job search strategies
- Skill development recommendations
- Interview preparation
- Industry insights and trends

Be specific, actionable, and encouraging. Use examples and data when possible. Format your responses with markdown for readability. Keep responses focused and valuable.`;

const RESUME_ANALYSIS_PROMPT = `You are an expert resume analyst. Analyze the following resume and provide:

1. **Overall Score** (out of 100)
2. **Strengths** (top 3-5 bullet points)
3. **Weaknesses** (areas for improvement)
4. **Missing Sections** (what should be added)
5. **ATS Optimization** (keyword suggestions)
6. **Skills Extracted** (list of skills found)
7. **Experience Level** (entry/mid/senior)
8. **Recommended Job Titles** (3-5 matching roles)
9. **Actionable Improvements** (specific, numbered steps)

Be thorough but concise. Use markdown formatting.`;

const MOCK_INTERVIEW_SYSTEM = `You are an expert interviewer conducting a mock interview. Your role is to:
- Ask realistic interview questions one at a time
- Evaluate responses and provide constructive feedback
- Adjust difficulty based on the candidate's level
- Cover both technical and behavioral questions
- Provide a score and detailed feedback after each answer

Format your feedback with markdown. Be encouraging but honest.`;

async function callSingleModel(client, modelStr, messages, timeoutMs = 30000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await client.chat.completions.create({
      model: modelStr,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
    });
    
    clearTimeout(timeoutId);
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Error calling model ${modelStr}:`, error.message);
    return null;
  }
}

async function callMultiModel(userMessage, sessionMessages = [], activeModelNames = null) {
  const client = getOpenAIClient(EMERGENT_KEY);
  
  // Filter to only active models if specified
  const modelsToUse = activeModelNames 
    ? ALL_MODELS.filter(m => activeModelNames.includes(m.name))
    : MODELS;
  
  const baseMessages = [
    { role: 'system', content: CAREER_SYSTEM_PROMPT },
    ...sessionMessages,
    { role: 'user', content: userMessage },
  ];

  // Call multiple models in parallel with individual timeouts
  const modelPromises = modelsToUse.map(async (m) => {
    const startTime = Date.now();
    const modelStr = getModelConfig(m.provider, m.model);
    const result = await callSingleModel(client, modelStr, baseMessages, 30000);
    const duration = Date.now() - startTime;
    return { 
      name: m.name, 
      provider: m.provider, 
      model: m.model,
      color: m.color,
      response: result, 
      duration,
      success: !!result,
    };
  });

  const results = await Promise.all(modelPromises);
  const validResults = results.filter(r => r.response);
  const failedModels = results.filter(r => !r.response);

  if (validResults.length === 0) {
    throw new Error('All models failed to respond');
  }

  if (validResults.length === 1) {
    return {
      combinedResponse: validResults[0].response,
      modelResponses: validResults,
      failedModels: failedModels.map(r => ({ name: r.name, provider: r.provider })),
      synthesized: false,
      totalModels: modelsToUse.length,
      successCount: validResults.length,
    };
  }

  // Synthesize responses from multiple models
  const synthesisPrompt = `You are a career guidance synthesizer. Below are responses from ${validResults.length} AI models to a career-related query. Combine them into a single, comprehensive, well-structured response that takes the best insights from each.

Original query: "${userMessage}"

${validResults.map((r, i) => `--- Response from ${r.name} ---\n${r.response}`).join('\n\n')}

---
Provide a unified, well-formatted markdown response that combines the best insights. Do NOT mention that multiple models were used. Just provide the best combined career advice.`;

  const synthesisModel = getModelConfig('openai', 'gpt-4.1');
  const synthesized = await callSingleModel(client, synthesisModel, [
    { role: 'system', content: 'You synthesize multiple AI responses into one cohesive, high-quality response. Output only the final combined response in markdown.' },
    { role: 'user', content: synthesisPrompt },
  ]);

  return {
    combinedResponse: synthesized || validResults[0].response,
    modelResponses: validResults,
    failedModels: failedModels.map(r => ({ name: r.name, provider: r.provider })),
    synthesized: true,
    totalModels: modelsToUse.length,
    successCount: validResults.length,
  };
  };
}

async function callSingleModelForFeature(systemPrompt, userMessage) {
  const client = getOpenAIClient(EMERGENT_KEY);
  const modelStr = getModelConfig('openai', 'gpt-4.1');
  return await callSingleModel(client, modelStr, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);
}

// Route handlers
async function handleChatSend(body) {
  const { sessionId, message, activeModels } = body;
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  const db = await getDb();
  let session;
  const sid = sessionId || uuidv4();

  if (sessionId) {
    session = await db.collection('sessions').findOne({ id: sessionId });
  }

  if (!session) {
    session = {
      id: sid,
      title: message.substring(0, 60) + (message.length > 60 ? '...' : ''),
      type: 'career-chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection('sessions').insertOne(session);
  }

  // Get recent message history for context (last 10 messages)
  const recentMessages = (session.messages || []).slice(-10).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };

  try {
    const result = await callMultiModel(message, recentMessages, activeModels);
    const assistantMsg = {
      role: 'assistant',
      content: result.combinedResponse,
      timestamp: new Date().toISOString(),
      models: result.modelResponses.map(r => r.name),
      failedModels: result.failedModels || [],
      synthesized: result.synthesized,
      successCount: result.successCount,
      totalModels: result.totalModels,
    };

    await db.collection('sessions').updateOne(
      { id: sid },
      {
        $push: { messages: { $each: [userMsg, assistantMsg] } },
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    return NextResponse.json({
      sessionId: sid,
      response: result.combinedResponse,
      models: result.modelResponses.map(r => ({ name: r.name, color: r.color, duration: r.duration })),
      failedModels: result.failedModels || [],
      synthesized: result.synthesized,
      successCount: result.successCount,
      totalModels: result.totalModels,
      individualResponses: result.modelResponses.map(r => ({
        name: r.name,
        color: r.color,
        preview: r.response ? r.response.substring(0, 200) + '...' : null,
        duration: r.duration,
      })),
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to get AI response: ' + error.message }, { status: 500 });
  }
}

async function handleGetSessions() {
  const db = await getDb();
  const sessions = await db.collection('sessions')
    .find({}, { projection: { messages: 0 } })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
  return NextResponse.json({ sessions });
}

async function handleGetSession(sessionId) {
  const db = await getDb();
  const session = await db.collection('sessions').findOne({ id: sessionId });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ session });
}

async function handleDeleteSession(sessionId) {
  const db = await getDb();
  await db.collection('sessions').deleteOne({ id: sessionId });
  return NextResponse.json({ success: true });
}

async function handleResumeUpload(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    let textContent = '';
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(buffer);
      textContent = pdfData.text;
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      textContent = buffer.toString('utf-8');
    } else {
      // Try to parse as text
      textContent = buffer.toString('utf-8');
    }

    if (!textContent || textContent.trim().length < 20) {
      return NextResponse.json({ error: 'Could not extract meaningful text from the file. Please upload a valid resume.' }, { status: 400 });
    }

    const resumeId = uuidv4();
    const db = await getDb();
    
    const resume = {
      id: resumeId,
      fileName: file.name,
      fileSize: file.size,
      textContent: textContent.substring(0, 10000),
      analysis: null,
      createdAt: new Date().toISOString(),
    };

    await db.collection('resumes').insertOne(resume);

    return NextResponse.json({
      resumeId,
      fileName: file.name,
      textPreview: textContent.substring(0, 500),
      charCount: textContent.length,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Failed to process resume: ' + error.message }, { status: 500 });
  }
}

async function handleResumeAnalyze(body) {
  const { resumeId } = body;
  if (!resumeId) return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });

  const db = await getDb();
  const resume = await db.collection('resumes').findOne({ id: resumeId });
  if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

  try {
    const analysis = await callSingleModelForFeature(
      RESUME_ANALYSIS_PROMPT,
      `Here is the resume text:\n\n${resume.textContent}`
    );

    await db.collection('resumes').updateOne(
      { id: resumeId },
      { $set: { analysis, analyzedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ resumeId, analysis });
  } catch (error) {
    console.error('Resume analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze resume: ' + error.message }, { status: 500 });
  }
}

async function handleGetResume(resumeId) {
  const db = await getDb();
  const resume = await db.collection('resumes').findOne({ id: resumeId });
  if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  return NextResponse.json({ resume });
}

async function handleGetResumes() {
  const db = await getDb();
  const resumes = await db.collection('resumes')
    .find({}, { projection: { textContent: 0 } })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  return NextResponse.json({ resumes });
}

async function handleMockInterviewStart(body) {
  const { role, level, type } = body;
  const db = await getDb();
  const sessionId = uuidv4();

  const interviewPrompt = `Start a mock ${type || 'behavioral'} interview for a ${level || 'mid-level'} ${role || 'Software Engineer'} position. Ask the first question. Be professional and realistic. Only ask ONE question at a time.`;

  try {
    const response = await callSingleModelForFeature(MOCK_INTERVIEW_SYSTEM, interviewPrompt);

    const session = {
      id: sessionId,
      title: `Mock Interview: ${role || 'Software Engineer'}`,
      type: 'mock-interview',
      role: role || 'Software Engineer',
      level: level || 'mid-level',
      interviewType: type || 'behavioral',
      messages: [
        { role: 'user', content: interviewPrompt, timestamp: new Date().toISOString(), hidden: true },
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ],
      questionCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('sessions').insertOne(session);

    return NextResponse.json({
      sessionId,
      question: response,
      questionNumber: 1,
    });
  } catch (error) {
    console.error('Mock interview error:', error);
    return NextResponse.json({ error: 'Failed to start interview: ' + error.message }, { status: 500 });
  }
}

async function handleMockInterviewRespond(body) {
  const { sessionId, answer } = body;
  if (!sessionId || !answer) {
    return NextResponse.json({ error: 'sessionId and answer are required' }, { status: 400 });
  }

  const db = await getDb();
  const session = await db.collection('sessions').findOne({ id: sessionId });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const feedbackPrompt = `The candidate answered: "${answer}"

Provide:
1. **Score**: (1-10)
2. **Feedback**: What was good and what could be improved
3. **Sample Better Answer**: A brief example of a stronger response

Then ask the NEXT interview question. If this is question ${(session.questionCount || 1) + 1} of 5, mention the progress. After 5 questions, provide overall assessment instead of next question.`;

  try {
    const recentMessages = session.messages.filter(m => !m.hidden).slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const client = getOpenAIClient(EMERGENT_KEY);
    const modelStr = getModelConfig('openai', 'gpt-4.1');
    const response = await callSingleModel(client, modelStr, [
      { role: 'system', content: MOCK_INTERVIEW_SYSTEM },
      ...recentMessages,
      { role: 'user', content: feedbackPrompt },
    ]);

    const newCount = (session.questionCount || 1) + 1;
    await db.collection('sessions').updateOne(
      { id: sessionId },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: answer, timestamp: new Date().toISOString() },
              { role: 'assistant', content: response, timestamp: new Date().toISOString() },
            ],
          },
        },
        $set: { questionCount: newCount, updatedAt: new Date().toISOString() },
      }
    );

    return NextResponse.json({
      sessionId,
      feedback: response,
      questionNumber: newCount,
      isComplete: newCount > 5,
    });
  } catch (error) {
    console.error('Interview respond error:', error);
    return NextResponse.json({ error: 'Failed to process answer: ' + error.message }, { status: 500 });
  }
}

async function handleCareerPathExplore(body) {
  const { interests, skills, experience } = body;

  const prompt = `Based on the following profile, suggest 5 detailed career paths:

**Interests**: ${interests || 'Not specified'}
**Skills**: ${skills || 'Not specified'}
**Experience**: ${experience || 'Not specified'}

For each career path provide:
1. **Career Title**
2. **Description** (2-3 sentences)
3. **Required Skills** (list)
4. **Average Salary Range**
5. **Growth Outlook** (high/medium/low)
6. **Learning Path** (steps to get there)
7. **Match Score** (percentage based on profile)

Format as detailed markdown.`;

  try {
    const result = await callMultiModel(prompt);
    return NextResponse.json({ paths: result.combinedResponse, models: result.modelResponses.map(r => r.name) });
  } catch (error) {
    console.error('Career path error:', error);
    return NextResponse.json({ error: 'Failed to explore career paths: ' + error.message }, { status: 500 });
  }
}

async function handleHealthCheck() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', error: error.message }, { status: 500 });
  }
}

// Router
function getPath(request) {
  const url = new URL(request.url);
  return url.pathname.replace('/api', '');
}

export async function GET(request) {
  const path = getPath(request);
  const headers = { 'Access-Control-Allow-Origin': '*' };

  try {
    if (path === '/health') return handleHealthCheck();
    if (path === '/chat/sessions') return handleGetSessions();
    if (path.startsWith('/chat/sessions/')) {
      const id = path.split('/chat/sessions/')[1];
      return handleGetSession(id);
    }
    if (path === '/resumes') return handleGetResumes();
    if (path.startsWith('/resume/')) {
      const id = path.split('/resume/')[1];
      return handleGetResume(id);
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const path = getPath(request);

  try {
    if (path === '/chat/send') {
      const body = await request.json();
      return handleChatSend(body);
    }
    if (path === '/resume/upload') {
      return handleResumeUpload(request);
    }
    if (path === '/resume/analyze') {
      const body = await request.json();
      return handleResumeAnalyze(body);
    }
    if (path === '/mock-interview/start') {
      const body = await request.json();
      return handleMockInterviewStart(body);
    }
    if (path === '/mock-interview/respond') {
      const body = await request.json();
      return handleMockInterviewRespond(body);
    }
    if (path === '/career-paths/explore') {
      const body = await request.json();
      return handleCareerPathExplore(body);
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const path = getPath(request);

  try {
    if (path.startsWith('/chat/sessions/')) {
      const id = path.split('/chat/sessions/')[1];
      return handleDeleteSession(id);
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
