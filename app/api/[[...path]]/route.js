import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

// Shared backend modules
import { getDb, isUsingMockDb } from '@/lib/backend/db';
import { JWT_SECRET } from '@/lib/backend/config';
import { getOpenAIClient, getModelStr, ALL_MODELS, GUARANTEED_MODELS, modelHealth, callModel, callMultiModel, callSingleModel, modelRotationIndex, getModelRotationIndex, incrementModelRotation } from '@/lib/backend/llm';
import { generateToken, verifyToken } from '@/lib/backend/auth';
import { logAnalytics } from '@/lib/backend/analytics-helper';
import { CAREER_SYSTEM, CAREER_PATH_SYSTEM, RESUME_ATS_SYSTEM, INTERVIEW_SYSTEM, INTERVIEW_FEEDBACK_SYSTEM, JOB_MATCH_SYSTEM } from '@/lib/backend/prompts';

// External utility imports
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
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
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
    const verificationToken = jwt.sign({ email: email.toLowerCase(), type: 'email-verify' }, JWT_SECRET, { expiresIn: '24h' });

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

    // Check if a real email provider is configured
    const hasEmailProvider = !!(process.env.SENDGRID_API_KEY || process.env.SMTP_HOST);

    if (hasEmailProvider) {
      // Send verification email via configured provider
      const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}?verify=${verificationToken}`;
      const { subject, html, text } = emailTemplates.verifyEmail(verificationLink);
      await sendEmail(email.toLowerCase(), subject, html, text);

      await logAnalytics(db, 'user_register', { userId });

      return NextResponse.json({
        message: 'Registration successful. Please check your email to verify your account.',
        email: email.toLowerCase(),
        requiresVerification: true
      });
    } else {
      // No email provider configured — auto-verify the user for seamless dev experience
      await db.collection('users').updateOne(
        { id: userId },
        { $set: { verified: true, verificationToken: null } }
      );
      console.log(`✓ Auto-verified user ${email.toLowerCase()} (no email provider configured)`);

      // Auto-login: generate token immediately
      const verifiedUser = await db.collection('users').findOne({ id: userId });
      const token = generateToken(verifiedUser);

      await logAnalytics(db, 'user_register', { userId, autoVerified: true });

      return NextResponse.json({
        message: 'Account created successfully!',
        token,
        user: { id: verifiedUser.id, name: verifiedUser.name, email: verifiedUser.email, role: verifiedUser.role, profile: verifiedUser.profile },
        autoVerified: true
      });
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    return NextResponse.json({ error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}

async function handleVerifyEmail(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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

    // Send welcome email (fire-and-forget, don't block verification)
    try {
      const { subject, html, text } = emailTemplates.welcomeEmail(user.name);
      await sendEmail(user.email, subject, html, text);
    } catch (emailErr) {
      console.warn('Welcome email failed (non-blocking):', emailErr.message);
    }

    await logAnalytics(db, 'email_verified', { userId: user.id });

    // Auto-login after verification: generate token
    const updatedUser = await db.collection('users').findOne({ email: decoded.email });
    const authToken = generateToken(updatedUser);

    return NextResponse.json({
      message: 'Email verified successfully!',
      verified: true,
      token: authToken,
      user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, profile: updatedUser.profile }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Verification link has expired. Please register again.' }, { status: 400 });
    }
    console.error('Email verification error:', error.message);
    return NextResponse.json({ error: 'Verification failed: ' + error.message }, { status: 500 });
  }
}

// Resend verification email
async function handleResendVerification(body) {
  try {
    const { email } = body;
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) return NextResponse.json({ message: 'If an account exists, a verification email has been sent.' });
    if (user.verified) return NextResponse.json({ message: 'Email is already verified. You can login now.', alreadyVerified: true });

    const hasEmailProvider = !!(process.env.SENDGRID_API_KEY || process.env.SMTP_HOST);

    if (!hasEmailProvider) {
      // No email provider — auto-verify
      await db.collection('users').updateOne(
        { email: email.toLowerCase() },
        { $set: { verified: true, verificationToken: null } }
      );
      console.log(`✓ Auto-verified user ${email.toLowerCase()} via resend (no email provider configured)`);

      const verifiedUser = await db.collection('users').findOne({ email: email.toLowerCase() });
      const token = generateToken(verifiedUser);

      return NextResponse.json({
        message: 'Account verified successfully!',
        autoVerified: true,
        token,
        user: { id: verifiedUser.id, name: verifiedUser.name, email: verifiedUser.email, role: verifiedUser.role, profile: verifiedUser.profile }
      });
    }

    // Generate new verification token
    const verificationToken = jwt.sign({ email: email.toLowerCase(), type: 'email-verify' }, JWT_SECRET, { expiresIn: '24h' });
    await db.collection('users').updateOne(
      { email: email.toLowerCase() },
      { $set: { verificationToken } }
    );

    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}?verify=${verificationToken}`;
    const { subject, html, text } = emailTemplates.verifyEmail(verificationLink);
    await sendEmail(email.toLowerCase(), subject, html, text);

    return NextResponse.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    const resetToken = jwt.sign({ email: email.toLowerCase(), type: 'password-reset' }, JWT_SECRET, { expiresIn: '30m' });
    
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: { resetToken, resetTokenCreatedAt: new Date().toISOString() } }
    );

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const { subject, html, text } = emailTemplates.resetPassword(resetLink);
    try {
      await sendEmail(user.email, subject, html, text);
    } catch (emailErr) {
      console.warn('Reset email failed:', emailErr.message);
      // In development without email provider, return the reset token directly  
      return NextResponse.json({ message: 'If an account exists, password reset link sent to email', resetToken, devFallback: true });
    }

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

    const decoded = jwt.verify(token, JWT_SECRET);
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
  const savedJobsCount = await db.collection('saved_jobs').countDocuments({ userId: auth.id });
  const jobMatchCount = await db.collection('sessions').countDocuments({ userId: auth.id, type: 'job-match' });
  const learningPathCount = await db.collection('sessions').countDocuments({ userId: auth.id, type: 'learning-path' });

  // Recent activity (last 10 events)
  const recentActivity = await db.collection('analytics')
    .find({ userId: auth.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile, createdAt: user.createdAt },
    stats: { resumeCount, interviewCount, chatCount, careerPathCount, savedJobsCount, jobMatchCount, learningPathCount },
    recentActivity: recentActivity.map(a => ({ type: a.type, createdAt: a.createdAt, metadata: a.metadata || a.data })),
    profile: user.profile || {},
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

// --- PROFILE AVATAR ---
async function handleUpdateAvatar(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { avatar } = body;
    if (!avatar || !avatar.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }
    // Limit to 2MB base64
    if (avatar.length > 2.8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 });
    }
    const db = await getDb();
    await db.collection('users').updateOne({ id: auth.id }, { $set: { 'profile.avatar': avatar } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- CHANGE PASSWORD ---
async function handleChangePassword(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    if (newPassword.length < 6) return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    if (currentPassword === newPassword) return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ id: auth.id });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('users').updateOne({ id: auth.id }, { $set: { password: hashed } });
    
    await logAnalytics(db, 'password_changed', { userId: auth.id });
    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

  // Load user profile for personalized responses
  let userProfile = null;
  if (auth?.id) {
    const userDoc = await db.collection('users').findOne({ id: auth.id });
    userProfile = userDoc?.profile || null;
  }

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
    // Build personalized system prompt with user context
    let systemPrompt = CAREER_SYSTEM;
    if (userProfile) {
      const profileCtx = [];
      if (userProfile.skills?.length > 0) profileCtx.push(`Skills: ${Array.isArray(userProfile.skills) ? userProfile.skills.join(', ') : userProfile.skills}`);
      if (userProfile.interests?.length > 0) profileCtx.push(`Interests: ${Array.isArray(userProfile.interests) ? userProfile.interests.join(', ') : userProfile.interests}`);
      if (userProfile.education) profileCtx.push(`Education: ${userProfile.education}`);
      if (userProfile.experience) profileCtx.push(`Experience: ${userProfile.experience}`);
      if (userProfile.careerGoal) profileCtx.push(`Career Goal: ${userProfile.careerGoal}`);
      if (profileCtx.length > 0) {
        systemPrompt += `\n\nUser Profile (use to personalize your advice):\n${profileCtx.join('\n')}`;
      }
    }

    const fullMessages = [{ role: 'system', content: systemPrompt }, ...recentMsgs, { role: 'user', content: message }];
    const client = getOpenAIClient();
    let modelsToUse = activeModels ? ALL_MODELS.filter(m => activeModels.includes(m.name)) : ALL_MODELS;
    
    const guaranteedModels = modelsToUse.filter(m => m.guaranteed);
    const betaModels = modelsToUse.filter(m => !m.guaranteed);

    // Query ALL models in parallel — guaranteed get 20s timeout, beta get 12s
    const results = [];
    const modelPromises = modelsToUse.map(async (m) => {
      const start = Date.now();
      const timeoutMs = m.guaranteed ? 20000 : 12000;
      try {
        // Skip unhealthy beta models
        const health = modelHealth[m.name];
        if (!m.guaranteed && health.failCount >= 3 && health.lastError && (Date.now() - health.lastError < 300000)) {
          return { name: m.name, color: m.color, response: null, duration: 0, success: false, skipped: true };
        }
        const modelStr = getModelStr(m.provider, m.model);
        const modelPromise = callModel(client, modelStr, fullMessages);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Model timeout')), timeoutMs));
        const response = await Promise.race([modelPromise, timeoutPromise]);
        if (response) {
          modelHealth[m.name].failCount = 0;
          modelHealth[m.name].healthy = true;
        }
        return { name: m.name, color: m.color, response, duration: Date.now() - start, success: !!response };
      } catch (e) {
        console.warn(`Chat model ${m.name} failed:`, e.message);
        modelHealth[m.name].failCount++;
        modelHealth[m.name].lastError = Date.now();
        modelHealth[m.name].healthy = false;
        return { name: m.name, color: m.color, response: null, duration: Date.now() - start, success: false };
      }
    });
    
    const allResults = await Promise.all(modelPromises);
    results.push(...allResults);
    console.log(`[Chat] ${results.filter(r => r.success).length}/${results.length} models responded: ${results.filter(r => r.success).map(r => r.name).join(', ')}`);

    let valid = results.filter(r => r.response);
    let failed = results.filter(r => !r.response);

    // MINIMUM 4 MODELS: Retry failed models if fewer than 4 responded
    const MIN_CHAT_MODELS = Math.min(4, modelsToUse.length);
    if (valid.length < MIN_CHAT_MODELS && failed.length > 0) {
      console.log(`[Chat] Only ${valid.length} models, need ${MIN_CHAT_MODELS}. Retrying ${failed.length} failed...`);
      const retryPromises = failed.map(async (f) => {
        const mInfo = modelsToUse.find(m => m.name === f.name);
        if (!mInfo) return f;
        const start = Date.now();
        try {
          const modelStr = getModelStr(mInfo.provider, mInfo.model);
          const response = await Promise.race([
            callModel(client, modelStr, fullMessages),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Retry timeout')), 25000))
          ]);
          if (response) {
            modelHealth[mInfo.name].failCount = 0;
            modelHealth[mInfo.name].healthy = true;
            return { name: mInfo.name, color: mInfo.color, response, duration: Date.now() - start, success: true };
          }
          return f;
        } catch (e) { return f; }
      });
      const retryResults = await Promise.all(retryPromises);
      valid = [...valid, ...retryResults.filter(r => r.success && r.response)];
      console.log(`[Chat] After retry: ${valid.length} models`);
    }

    if (valid.length === 0) throw new Error('All models failed');

    let combinedResponse = valid[0].response;
    let synthesized = false;

    if (valid.length > 1) {
      const synthPrompt = `You are given ${valid.length} independent expert career advice responses. Synthesize into ONE unified response.

RULES:
- Cross-reference facts: only keep info confirmed by 2+ sources
- NEVER invent companies, URLs, statistics, or certifications
- Use ONLY real platforms: LinkedIn, Coursera, Udemy, edX, Glassdoor, Indeed, freeCodeCamp, LeetCode, etc.
- If responses conflict, note the disagreement briefly
- Format in clean markdown

Responses:\n\n${valid.map(r => `--- ${r.name} ---\n${r.response}`).join('\n\n')}`;
      const fastestModel = [...valid].sort((a, b) => a.duration - b.duration)[0];
      const synthModelStr = getModelStr(ALL_MODELS.find(m => m.name === fastestModel.name)?.provider || 'openai', ALL_MODELS.find(m => m.name === fastestModel.name)?.model || 'gpt-4.1');
      const synthResult = await callModel(client, synthModelStr, [
        { role: 'system', content: 'You are a fact-checking career advice synthesizer. Merge multiple AI responses into one accurate response. Strip hallucinated data, fake URLs, invented statistics. Only include real, verifiable career information. Output markdown.' },
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

    // Generate follow-up suggestions — rotate model
    let followUpSuggestions = [];
    try {
      const suggestModel = GUARANTEED_MODELS[getModelRotationIndex() % GUARANTEED_MODELS.length];
      incrementModelRotation();
      const suggestPrompt = `Based on this career conversation, suggest exactly 3 short follow-up questions (max 10 words each) the user might ask next. Return ONLY a JSON array of strings, no markdown:\nUser: ${message}\nAssistant: ${combinedResponse.substring(0, 500)}`;
      const suggestResult = await callModel(client, getModelStr(suggestModel.provider, suggestModel.model), [
        { role: 'system', content: 'Return only a JSON array of 3 short follow-up questions. No markdown, no explanation.' },
        { role: 'user', content: suggestPrompt },
      ], 200);
      if (suggestResult) {
        const cleaned = suggestResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        followUpSuggestions = JSON.parse(cleaned);
        if (!Array.isArray(followUpSuggestions)) followUpSuggestions = [];
      }
    } catch { /* follow-ups are optional, don't block response */ }

    return NextResponse.json({
      sessionId: sid, response: combinedResponse, synthesized,
      models: valid.map(r => ({ name: r.name, color: r.color, duration: r.duration })),
      failedModels: failed.map(r => ({ name: r.name })),
      successCount: valid.length, totalModels: modelsToUse.length,
      individualResponses: valid.map(r => ({ name: r.name, color: r.color, preview: r.response?.substring(0, 200) + '...', duration: r.duration })),
      followUpSuggestions,
    });
  } catch (error) {
    return NextResponse.json({ error: 'AI error: ' + error.message }, { status: 500 });
  }
}

async function handleGetSessions(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const sessions = await db.collection('sessions').find({ userId: auth.id }, { projection: { messages: 0 } }).sort({ updatedAt: -1 }).limit(50).toArray();
  return NextResponse.json({ sessions });
}

async function handleGetSession(request, sessionId) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const session = await db.collection('sessions').findOne({ id: sessionId, userId: auth.id });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ session });
}

async function handleDeleteSession(request, sessionId) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  await db.collection('sessions').deleteOne({ id: sessionId, userId: auth.id });
  return NextResponse.json({ success: true });
}

async function handleRenameSession(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const { sessionId, title } = body;
  if (!sessionId || !title) return NextResponse.json({ error: 'Session ID and title required' }, { status: 400 });
  const db = await getDb();
  await db.collection('sessions').updateOne({ id: sessionId, userId: auth.id }, { $set: { title: title.trim().substring(0, 100), updatedAt: new Date().toISOString() } });
  return NextResponse.json({ success: true });
}

// --- STRUCTURED CAREER PATH ---
async function handleGenerateCareerPath(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { skills, interests, education, experience, targetRole, location } = body;

  const prompt = `Generate a structured career path for this profile:
Skills: ${skills || 'Not specified'}
Interests: ${interests || 'Not specified'}
Education: ${education || 'Not specified'}
Experience: ${experience || 'Not specified'}
${targetRole ? `Target/Dream Role: ${targetRole}` : ''}
${location ? `Location/Market: ${location}` : ''}

Return ONLY valid JSON (no markdown) with EXACTLY these field names:
{
  "title": "Career Path Title",
  "summary": "Brief overview of the career path",
  "timeline": [
    { "phase": "Phase 1 (0-6 months)", "title": "Foundation", "goals": ["goal1"], "skills": ["skill1"], "milestones": ["milestone1"] },
    { "phase": "Phase 2 (6-18 months)", "title": "Growth", "goals": ["goal1"], "skills": ["skill1"], "milestones": ["milestone1"] }
  ],
  "salaryRange": { "entry": "$X-Y", "mid": "$X-Y", "senior": "$X-Y" },
  "certifications": [{ "name": "Cert Name", "provider": "Provider", "difficulty": "beginner|intermediate|advanced", "value": "high|medium" }],
  "topRoles": [{ "title": "Role", "salary": "$X-Y", "demand": "high|medium", "description": "Brief" }],
  "skillGaps": ["gap1", "gap2"],
  "marketDemand": { "level": "high|medium|low", "trend": "growing|stable|declining", "hotSkills": ["skill1"] },
  "alternativePaths": [{ "title": "Alt Path", "description": "Brief" }],
  "networkingTips": ["tip1", "tip2"],
  "recommendations": ["rec1", "rec2"]
}
Make salary ranges location-appropriate if location is specified. Include at least 3 timeline phases.`;

  try {
    const result = await callMultiModel(CAREER_PATH_SYSTEM, prompt, null, 4000);
    
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

    // Normalize career path fields — LLMs return varying structures
    // Support nested structures like { careerPath: { ... } }
    const src = parsed.careerPath || parsed.career_path || parsed.career || parsed;

    // Find timeline-like array from any key
    let timelineData = src.timeline || src.phases || src.roadmap || src.milestones || src.steps || src.careerTimeline || src.career_timeline || src.journey || [];
    if (!Array.isArray(timelineData) || timelineData.length === 0) {
      // Search all values for the first array with objects having phase/step/title
      for (const val of Object.values(src)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && (val[0].phase || val[0].step || val[0].title || val[0].name || val[0].period)) {
          timelineData = val;
          break;
        }
      }
    }

    const normalized = {
      ...src,
      title: src.title || `Career Path: ${targetRole || 'Professional'}`,
      summary: src.summary || src.overview || src.description || '',
      timeline: timelineData,
      salaryRange: src.salaryRange || src.salary || src.salaryRanges || src.salary_ranges || src.compensation || { entry: 'N/A', mid: 'N/A', senior: 'N/A' },
      certifications: src.certifications || src.certs || src.recommendedCertifications || src.recommended_certifications || [],
      topRoles: src.topRoles || src.top_roles || src.roles || src.suggestedRoles || src.careerOptions || [],
      skillGaps: (src.skillGaps || src.skill_gaps || src.gaps || src.missingSkills || []).map(sg => 
        typeof sg === 'string' ? { skill: sg, importance: 'important', howToLearn: `Study ${sg} through online courses and hands-on projects` } : sg
      ),
      marketDemand: src.marketDemand || src.market_demand || src.demand || src.market || { level: 'medium' },
      alternativePaths: (src.alternativePaths || src.alternative_paths || src.alternatives || []).map(ap =>
        typeof ap === 'string' ? { title: ap, reason: 'Alternative career direction based on your skills' } : ap
      ),
      networkingTips: src.networkingTips || src.networking_tips || src.networking || [],
      recommendations: src.recommendations || src.tips || src.advice || [],
      raw: parsed.raw || false
    };

    // Normalize timeline phases — ensure each has duration and proper fields
    normalized.timeline = normalized.timeline.map((phase, idx) => ({
      ...phase,
      phase: phase.phase || phase.step || phase.name || phase.title || `Phase ${idx + 1}`,
      duration: phase.duration || phase.timeframe || phase.period || '',
      goals: phase.goals || phase.objectives || phase.tasks || [],
      skills: phase.skills || phase.skillsToLearn || phase.technologies || [],
      milestone: phase.milestone || phase.milestones?.[0] || phase.outcome || '',
      resources: phase.resources || phase.learningResources || [],
    }));

    // Normalize certifications — handle strings
    normalized.certifications = normalized.certifications.map(c =>
      typeof c === 'string' ? { name: c, provider: '', priority: 'medium' } : c
    );

    // Normalize topRoles — handle strings
    normalized.topRoles = normalized.topRoles.map(r =>
      typeof r === 'string' ? { title: r, demand: 'medium', description: '' } : r
    );

    // Validate and sanitize career path: strip hallucinated URLs
    const KNOWN_DOMAINS = ['coursera.org', 'udemy.com', 'edx.org', 'linkedin.com', 'freecodecamp.org', 'youtube.com', 'github.com', 'stackoverflow.com', 'glassdoor.com', 'indeed.com', 'leetcode.com', 'hackerrank.com', 'kaggle.com', 'medium.com', 'pluralsight.com', 'skillshare.com', 'codecademy.com', 'khanacademy.org', 'mit.edu', 'stanford.edu', 'aws.amazon.com', 'cloud.google.com', 'learn.microsoft.com', 'developer.mozilla.org', 'w3schools.com'];
    const sanitizeUrl = (url) => {
      if (!url || typeof url !== 'string') return null;
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        return KNOWN_DOMAINS.some(d => hostname.endsWith(d)) ? url : null;
      } catch { return null; }
    };
    // Sanitize URLs in timeline resources
    if (normalized.timeline) {
      normalized.timeline.forEach(phase => {
        if (phase.resources) {
          phase.resources.forEach(r => {
            if (typeof r === 'object' && r.url) {
              r.url = sanitizeUrl(r.url);
            }
          });
        }
      });
    }
    // Sanitize URLs in certifications
    if (normalized.certifications) {
      normalized.certifications.forEach(c => {
        if (typeof c === 'object' && c.url) {
          c.url = sanitizeUrl(c.url);
        }
      });
    }

    const db = await getDb();
    const careerPath = {
      id: uuidv4(), userId: auth?.id || 'anonymous', input: { skills, interests, education, experience, targetRole, location },
      result: normalized, models: result.modelResponses.map(r => r.name), synthesized: result.synthesized,
      createdAt: new Date().toISOString(),
    };
    await db.collection('career_paths').insertOne(careerPath);
    await logAnalytics(db, 'career_path_generated', { userId: auth?.id });

    return NextResponse.json({ careerPath: normalized, path: normalized, id: careerPath.id, pathId: careerPath.id, models: result.modelResponses.map(r => r.name), synthesized: result.synthesized, modelCount: result.successCount, totalModels: result.totalModels });
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
    // Support both FormData (file upload) and JSON (text paste) formats
    const contentType = request.headers.get('content-type') || '';
    let file = null;
    let buffer = null;
    let textContent = '';
    let fileName = 'resume.txt';
    let fileSize = 0;

    if (contentType.includes('application/json')) {
      // JSON body with text content directly
      const body = await request.json();
      if (!body.text || body.text.length < 20) return NextResponse.json({ error: 'Resume text too short (min 20 chars)' }, { status: 400 });
      textContent = body.text;
      fileName = body.fileName || 'pasted-resume.txt';
      fileSize = Buffer.byteLength(textContent, 'utf-8');
    } else {
      // FormData file upload
      const formData = await request.formData();
      file = formData.get('file');
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      buffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
      fileSize = file.size;
    }
    
    if (buffer && !textContent) {
    if (fileName.toLowerCase().endsWith('.pdf')) {
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
    } else if (fileName.toLowerCase().endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value || '';
        console.log(`DOCX parsed successfully: ${textContent.length} chars extracted`);
        if (!textContent || textContent.length < 20) {
          return NextResponse.json({ error: 'Could not extract text from DOCX. Please try PDF or TXT format.' }, { status: 400 });
        }
      } catch (docxError) {
        console.error('DOCX parsing error:', docxError.message);
        return NextResponse.json({ error: 'Failed to parse DOCX file. Please try PDF or TXT format.' }, { status: 400 });
      }
    } else {
      textContent = buffer.toString('utf-8');
    }
    } // end if (buffer && !textContent)

    // Clean up text content
    textContent = textContent.replace(/\s+/g, ' ').trim();

    if (!textContent || textContent.length < 20) {
      return NextResponse.json({ error: 'Could not extract enough text from the file. Please ensure the file contains readable text.' }, { status: 400 });
    }

    const auth = verifyToken(request);
    const resumeId = uuidv4();
    const db = await getDb();
    await db.collection('resumes').insertOne({
      id: resumeId, userId: auth?.id || 'anonymous', fileName: fileName, fileSize: fileSize,
      textContent: textContent.substring(0, 15000), analysis: null, createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ resumeId, fileName: fileName, textPreview: textContent.substring(0, 300), charCount: textContent.length });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 });
  }
}

async function handleResumeAnalyze(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get ATS analysis — use lower temperature for reliable JSON
    const roleContext = targetRole ? `\nTarget Role: ${targetRole}\nEvaluate keywords and fit for this specific role.` : '';
    const response = await callSingleModel(RESUME_ATS_SYSTEM, `Analyze this resume:${roleContext}\n\n${resume.textContent}`, 4000, 0.4);

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

    // Add word count and text metrics
    const words = resume.textContent.split(/\s+/).filter(w => w.length > 0);
    analysis.wordCount = words.length;
    analysis.charCount = resume.textContent.length;
    analysis.pageEstimate = Math.max(1, Math.ceil(words.length / 400));

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
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const resumes = await db.collection('resumes').find({ userId: auth.id }, { projection: { textContent: 0 } }).sort({ createdAt: -1 }).limit(20).toArray();
  return NextResponse.json({ resumes });
}

async function handleGetResume(request, resumeId) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const resume = await db.collection('resumes').findOne({ id: resumeId, userId: auth.id });
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ resume });
}

// --- MOCK INTERVIEW ---
async function handleInterviewStart(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { role, level, type, questionCount, focusAreas } = body;

  const totalQuestions = Math.min(Math.max(questionCount || 5, 3), 10);
  const interviewType = type || 'behavioral';
  const interviewLevel = level || 'mid-level';
  const interviewRole = role || 'Software Engineer';

  const typeGuide = {
    'behavioral': 'Ask a STAR-method behavioral question about a real workplace situation (e.g., conflict resolution, leadership, failure, teamwork). Start with a moderately easy warm-up question.',
    'technical': `Ask a technical concept or problem-solving question specific to ${interviewRole}. Start with fundamentals before moving to advanced topics.`,
    'system-design': `Present a system design problem appropriate for a ${interviewLevel} ${interviewRole}. Start with a smaller-scope design question.`,
    'coding': `Give a specific coding/algorithm problem with clear input/output examples. Start with an easy-medium difficulty problem appropriate for ${interviewLevel}.`,
    'case-study': `Present a business case study or analytical problem relevant to ${interviewRole}. Include enough context for the candidate to analyze.`,
    'mixed': `Start with a behavioral warm-up question. This is a mixed interview that will cover behavioral, technical, and role-specific questions for a ${interviewRole}.`
  };

  const prompt = `You are conducting a ${totalQuestions}-question mock ${interviewType} interview for a ${interviewLevel} ${interviewRole} position.
${focusAreas ? `Focus areas: ${focusAreas}` : ''}

${typeGuide[interviewType] || typeGuide['behavioral']}

Ask the FIRST question now. Be professional and create a realistic interview atmosphere. Start with a brief greeting, then ask your question.
Format: Use markdown. Bold the actual question.`;

  try {
    const response = await callSingleModel(INTERVIEW_SYSTEM, prompt);
    if (!response) {
      return NextResponse.json({ error: 'Failed to start interview: LLM did not return a response' }, { status: 500 });
    }
    
    const db = await getDb();
    const sessionId = uuidv4();

    await db.collection('sessions').insertOne({
      id: sessionId, userId: auth?.id || 'anonymous',
      title: `Interview: ${interviewRole}`,
      type: 'mock-interview', role: interviewRole, level: interviewLevel,
      interviewType, questionCount: 1, totalQuestions,
      focusAreas: focusAreas || null,
      scores: [], categoryScores: {},
      messages: [
        { role: 'system', content: prompt, hidden: true },
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    await logAnalytics(db, 'interview_started', { userId: auth?.id, role: interviewRole, level: interviewLevel, type: interviewType, totalQuestions });
    return NextResponse.json({ sessionId, question: response, questionNumber: 1, totalQuestions });
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
  const totalQ = session.totalQuestions || 5;
  const isLast = newCount > totalQ;
  const currentQ = newCount - 1;

  // Determine difficulty progression
  const difficultyMap = { 1: 'easy', 2: 'medium' };
  const targetDifficulty = difficultyMap[currentQ] || (currentQ >= totalQ ? 'hard' : 'medium-hard');

  // Build context about previous performance
  const prevScores = session.scores || [];
  const avgSoFar = prevScores.length > 0 ? (prevScores.reduce((a, b) => a + b, 0) / prevScores.length).toFixed(1) : 'N/A';

  const evalPrompt = `The candidate is interviewing for ${session.role} (${session.level}), interview type: ${session.interviewType}.
This is question ${currentQ} of ${totalQ}. Current average score: ${avgSoFar}/10.
${session.focusAreas ? `Focus areas: ${session.focusAreas}` : ''}

The question was the previous assistant message. The candidate's answer: "${answer}"

Word count: ${answer.split(/\s+/).filter(w => w).length} words.

${isLast ? `This is the FINAL question. After evaluating this answer, also provide:
- "overallGrade": "A+/A/B+/B/C+/C/D/F" based on all scores
- "finalAssessment": "3-4 sentence overall assessment of interview performance"
- "topStrengths": ["Their top 2-3 strengths across all answers"]
- "topImprovements": ["Their top 2-3 areas to improve"]  
- "hireRecommendation": "Strong Hire / Hire / Lean Hire / Lean No Hire / No Hire"
- "improvementRoadmap": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
Do NOT include "nextQuestion" field.` : `Generate the next question at "${targetDifficulty}" difficulty level.
Make it progressively more challenging and specific to ${session.role}.
Vary question categories \u2014 don't ask the same type twice in a row.`}

Evaluate thoroughly. Be honest and specific in scoring. Return ONLY valid JSON matching the required schema.`;

  try {
    const recentMsgs = session.messages.filter(m => !m.hidden).slice(-6).map(m => ({ role: m.role, content: m.content }));
    const client = getOpenAIClient();
    const maxTok = isLast ? 4000 : 3000;
    // Rotate among guaranteed models for interview evaluation
    const evalModel = GUARANTEED_MODELS[getModelRotationIndex() % GUARANTEED_MODELS.length];
    incrementModelRotation();
    const evalModelStr = getModelStr(evalModel.provider, evalModel.model);
    console.log(`[Interview] Evaluating with ${evalModel.name}`);
    const response = await callModel(client, evalModelStr, [
      { role: 'system', content: INTERVIEW_FEEDBACK_SYSTEM },
      ...recentMsgs,
      { role: 'user', content: evalPrompt },
    ], maxTok, 0.4);

    if (!response) {
      // Fallback to GPT-4.1 if chosen model fails
      const fallbackStr = getModelStr('openai', 'gpt-4.1');
      const fallbackResponse = await callModel(client, fallbackStr, [
        { role: 'system', content: INTERVIEW_FEEDBACK_SYSTEM },
        ...recentMsgs,
        { role: 'user', content: evalPrompt },
      ], maxTok, 0.4);
      if (!fallbackResponse) {
        return NextResponse.json({ error: 'Failed to evaluate answer: LLM did not return a response' }, { status: 500 });
      }
      // Use fallback response
      var responseText = fallbackResponse;
    } else {
      var responseText = response;
    }

    let feedback;
    try {
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      feedback = JSON.parse(jsonStr);
    } catch {
      feedback = { score: 5, maxScore: 10, feedback: responseText, raw: true };
    }

    // Ensure nextQuestion exists for non-final questions
    if (!isLast && !feedback.nextQuestion) {
      // Generate a fallback next question
      try {
        const fallbackQ = await callSingleModel(
          INTERVIEW_SYSTEM,
          `Continue the ${session.interviewType} interview for ${session.role} (${session.level}). This is question ${newCount} of ${totalQ}. Ask a ${targetDifficulty} difficulty question. Ask ONE question only, formatted in markdown with the question in bold.`
        );
        if (fallbackQ) feedback.nextQuestion = fallbackQ;
      } catch { /* proceed without next question */ }
    }

    // Track category scores
    const category = feedback.questionCategory || session.interviewType || 'general';
    const categoryScores = session.categoryScores || {};
    if (!categoryScores[category]) categoryScores[category] = [];
    categoryScores[category].push(feedback.score || 5);

    await db.collection('sessions').updateOne({ id: sessionId }, {
      $push: {
        messages: { $each: [
          { role: 'user', content: answer, timestamp: new Date().toISOString() },
          { role: 'assistant', content: JSON.stringify(feedback), timestamp: new Date().toISOString(), structured: true },
        ]},
        scores: feedback.score || 5,
      },
      $set: { questionCount: newCount, updatedAt: new Date().toISOString(), categoryScores },
    });

    await logAnalytics(db, 'interview_answer', { sessionId, score: feedback.score, category, questionNum: currentQ });
    return NextResponse.json({ sessionId, feedback, questionNumber: newCount, isComplete: isLast, totalQuestions: totalQ });
  } catch (error) {
    console.error('Interview respond error:', error.message);
    return NextResponse.json({ error: 'Failed: ' + error.message }, { status: 500 });
  }
}

// --- JOB MATCHING ---
async function handleJobMatch(request) {
  const auth = verifyToken(request);
  const body = await request.json();
  const { skills, interests, experience, targetIndustry, location, minSalary, employmentType, experienceLevel, resumeId } = body;

  try {
    const db = await getDb();
    const userId = auth?.id || 'anonymous';
    let keywords = Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(s => s);

    // If resumeId provided, enrich skills from resume data
    let resumeSkills = [];
    if (resumeId) {
      try {
        const resume = await db.collection('resumes').findOne({ id: resumeId });
        if (resume && resume.structured && resume.structured.skills) {
          resumeSkills = resume.structured.skills;
          // Merge resume skills with manually entered skills (deduplicate)
          const allSkillsLower = new Set(keywords.map(k => k.toLowerCase()));
          resumeSkills.forEach(s => {
            if (!allSkillsLower.has(s.toLowerCase())) {
              keywords.push(s);
              allSkillsLower.add(s.toLowerCase());
            }
          });
        }
      } catch (e) { console.warn('Resume skills load error:', e.message); }
    }

    // Try to fetch REAL jobs from job APIs (free APIs don't need keys)
    let realJobs = [];
    try {
      realJobs = await searchAllJobSources(keywords, {
        location: location || 'Remote',
        minSalary: minSalary || 50000,
        limit: 20
      });
      console.log(`✓ Found ${realJobs.length} real job matches from APIs`);
    } catch (apiError) {
      console.warn('Real job search failed:', apiError.message);
    }

    let finalMatches = [];
    let responseSummary = '';
    let responseTopSkillGaps = [];
    let responseRecommendations = [];
    let responseRaw = false;

    if (realJobs && realJobs.length > 0) {
      // REAL JOBS found — rank them by relevance using LLM
      try {
        const ranked = await rankJobsByRelevance(realJobs, { skills: keywords, interests, experience, location }, callSingleModel);
        finalMatches = ranked.slice(0, 15);
      } catch (rankError) {
        console.warn('Job ranking failed:', rankError.message, '- using default scores');
        finalMatches = realJobs.slice(0, 15).map((j, i) => ({
          ...j,
          matchScore: Math.max(50, 90 - (i * 5)),
          keyReasons: [`Matches your ${skills ? 'skills' : 'profile'}`],
          skillGaps: []
        }));
      }
      responseSummary = `Found ${finalMatches.length} real job openings matching your skills. Click "Apply" to go directly to the application page.`;
    } else {
      // NO real jobs — use LLM to generate recommendations
      console.log('No real jobs from APIs, using LLM-based generation');

      const prompt = `Find the 8-10 best matching job roles for this profile:
Skills: ${keywords.join(', ') || 'Not specified'}
Interests: ${interests || 'Not specified'}
Experience: ${experience || 'Not specified'}
Target Industry: ${targetIndustry || 'Any'}
Location: ${location || 'Any'}
Minimum Salary: ${minSalary ? `$${minSalary}` : 'Any'}
Employment Type: ${employmentType || 'Any'}
Experience Level: ${experienceLevel || 'Not specified'}
${resumeSkills.length > 0 ? `Resume Skills (verified): ${resumeSkills.join(', ')}` : ''}

Include a mix of:
- 3-4 strong direct matches
- 2-3 adjacent/emerging roles they might not have considered
- 1-2 stretch roles with clear skill gap paths

Return ONLY valid JSON matching the system prompt schema.`;

      const result = await callMultiModel(JOB_MATCH_SYSTEM, prompt, null);

      if (result && result.combinedResponse) {
        try {
          const jsonStr = result.combinedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(jsonStr);
          finalMatches = parsed.matches || [];
          responseSummary = parsed.summary || '';
          responseTopSkillGaps = parsed.topSkillGaps || [];
          responseRecommendations = parsed.recommendations || [];
        } catch {
          console.warn('Failed to parse LLM JSON, returning as raw markdown');
          responseSummary = result.combinedResponse;
          responseRaw = true;
          finalMatches = [];
        }
      }

      // If LLM also failed, use mock jobs as last resort
      if (finalMatches.length === 0 && !responseRaw) {
        finalMatches = getMockJobs(keywords.length > 0 ? keywords[0] : 'Software Engineer', { location: location || 'Remote' });
        responseSummary = 'Showing sample job listings. Real-time job APIs did not return results for this search — try broader keywords like "Developer", "Engineer", or "Data Scientist".';
      }
    }

    // Normalize all job fields to match display schema
    finalMatches = finalMatches.map(m => {
      const role = m.role || m.jobTitle || m.title || 'Unknown Role';
      const company = m.company_type || m.company || 'Company';
      return {
        title: role,
        role,
        jobTitle: role,
        company_type: company,
        company: company,
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
        location: m.location || location || 'Remote',
        jobDescription: m.jobDescription || '',
        interviewFocus: m.interviewFocus || [],
        timeToReady: m.timeToReady || 'Ready now',
      };
    });

    // Sort by match score descending
    finalMatches.sort((a, b) => b.matchScore - a.matchScore);

    const dataSource = realJobs.length > 0 ? 'real_jobs_ranked_by_ai' : (finalMatches.some(m => m.source === 'mock') ? 'mock_fallback' : 'ai_generated');

    // Store results
    const searchId = uuidv4();
    await db.collection('job_matches').insertOne({
      id: searchId, userId,
      input: { skills, interests, experience, targetIndustry, location, minSalary },
      matches: finalMatches, totalMatches: finalMatches.length,
      dataSource: realJobs.length > 0 ? 'REAL_JOBS' : 'LLM_GENERATED',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await logAnalytics(db, 'job_match', { userId, matchCount: finalMatches.length, source: dataSource });

    return NextResponse.json({
      searchId, matches: finalMatches, totalMatches: finalMatches.length,
      summary: responseSummary, topSkillGaps: responseTopSkillGaps,
      recommendations: responseRecommendations, raw: responseRaw,
      dataSource,
      message: realJobs.length > 0
        ? `Found ${finalMatches.length} real jobs from live job boards, ranked by AI`
        : 'Job recommendations generated by AI. Try broader keywords for real-time listings.'
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
    
    const searchOpts = {
      location: location || 'Remote',
      minSalary: minSalary || 0,
      limit: limit || 20
    };

    let jobs = await searchAllJobSources(keywordArr, searchOpts);
    
    // Fallback to mock data when no real jobs found
    const hasRealJobs = jobs.length > 0 && jobs.some(j => j.source !== 'mock');
    if (jobs.length === 0) {
      jobs = getMockJobs(keywordArr, searchOpts, 'mock');
    }
    
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
        source: j.source,
        tags: j.tags || []
      })),
      total: jobs.length,
      hasRealJobs,
      message: hasRealJobs
        ? `Found ${jobs.length} live job listings from job boards`
        : 'Showing sample listings — real jobs will appear when external APIs are reachable. Try different or broader keywords.'
    });
  } catch (error) {
    console.error('Live job search error:', error.message);
    // Even on error, return mock data so the UI isn't empty
    try {
      const keywordArr = Array.isArray(keywords) ? keywords : (keywords || '').split(',').map(s => s.trim()).filter(s => s);
      const fallback = getMockJobs(keywordArr, { location: location || 'Remote' }, 'mock');
      return NextResponse.json({
        jobs: fallback.map(j => ({
          id: j.jobId, title: j.jobTitle, company: j.company, location: j.location,
          salary: j.salary, description: j.jobDescription, url: j.jobUrl,
          postedDate: j.postedDate, type: j.employmentType || 'FULLTIME', source: j.source, tags: []
        })),
        total: fallback.length,
        hasRealJobs: false,
        message: 'Showing sample listings — job search APIs temporarily unavailable.'
      });
    } catch (e2) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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

// --- MODEL HEALTH TEST ---
async function handleTestModels(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ error: 'No LLM API key configured' }, { status: 500 });

  const testPrompt = 'Respond with exactly: "Model operational." Nothing else.';
  const results = [];

  for (const m of ALL_MODELS) {
    const start = Date.now();
    try {
      const modelStr = getModelStr(m.provider, m.model);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (15s)')), 15000));
      const modelPromise = callModel(client, modelStr, [
        { role: 'system', content: 'You are a health check assistant. Respond exactly as instructed.' },
        { role: 'user', content: testPrompt },
      ], 50, 0.1);
      const response = await Promise.race([modelPromise, timeoutPromise]);
      results.push({
        name: m.name,
        provider: m.provider,
        model: m.model,
        color: m.color,
        guaranteed: m.guaranteed,
        status: response ? 'active' : 'no_response',
        responsePreview: response ? response.substring(0, 100) : null,
        latencyMs: Date.now() - start,
      });
    } catch (e) {
      results.push({
        name: m.name,
        provider: m.provider,
        model: m.model,
        color: m.color,
        guaranteed: m.guaranteed,
        status: 'error',
        error: e.message,
        latencyMs: Date.now() - start,
      });
    }
  }

  const active = results.filter(r => r.status === 'active').length;
  const total = results.length;

  return NextResponse.json({
    summary: `${active}/${total} models responding`,
    activeCount: active,
    totalCount: total,
    models: results,
    health: Object.fromEntries(ALL_MODELS.map(m => [m.name, modelHealth[m.name]])),
    testedAt: new Date().toISOString(),
    rotationIndex: getModelRotationIndex(),
  });
}

// --- ADMIN ANALYTICS ---
async function handleGetAnalytics(request) {
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Non-admin users get limited analytics (their own data only in future)

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

    // Flatten course recommendations into a flat array for the frontend
    let flatCourses = [];
    if (recommendations && recommendations.recommendations) {
      Object.values(recommendations.recommendations).forEach(r => {
        if (r.courses && Array.isArray(r.courses)) {
          flatCourses.push(...r.courses);
        }
      });
    }

    return NextResponse.json({
      success: true,
      skillAnalysis: {
        existingSkills: skillGapAnalysis.currentSkills || [],
        missingSkills: skillGapAnalysis.skillGaps || [],
        prioritySkills: skillGapAnalysis.prioritySkills || [],
        requiredSkills: skillGapAnalysis.requiredSkills || [],
        completionPercentage: skillGapAnalysis.completionPercentage || 0,
        targetRole: skillGapAnalysis.targetRole || targetRole,
      },
      courseRecommendations: flatCourses,
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const auth = verifyToken(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    if (typeof db.command === 'function') {
      await db.command({ ping: 1 });
    }
    return NextResponse.json({ status: 'healthy', usingMockDb: isUsingMockDb(), timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', error: error.message }, { status: 500 });
  }
}
  async function handleGuestLogin() {
  try {
    const guestUser = {
      id: uuidv4(),
      email: `guest-${Date.now()}@careergpt.local`,
      name: 'Guest',
      role: 'guest',
      verified: true,
      profile: {},
      createdAt: new Date().toISOString(),
    };

    // Persist guest user to DB so downstream handlers can find them
    const db = await getDb();
    await db.collection('users').insertOne(guestUser);

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
      const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || clientIp.startsWith('192.168.') || clientIp === 'localhost';
      if (!isLocal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      authLimiter.resetAll();
      registerLimiter.resetAll();
      return NextResponse.json({ message: 'Rate limiter reset', timestamp: new Date() });
    }
    // Auto-verify user by email (localhost/development only)
    const isLocalIp = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || clientIp.startsWith('192.168.') || clientIp === 'localhost';
    if (path.startsWith('/debug/verify-user/') && isLocalIp) {
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
    if (path === '/models/test') return handleTestModels(request);
    if (path === '/profile') return handleGetProfile(request);
    if (path === '/chat/sessions') return handleGetSessions(request);
    if (path.startsWith('/chat/sessions/')) return handleGetSession(request, path.split('/chat/sessions/')[1]);
    if (path === '/resumes') return handleGetResumes(request);
    if (path.startsWith('/resume/compare/')) return handleGetResumeComparison(request, path.split('/resume/compare/')[1]);
    if (path.startsWith('/resume/')) return handleGetResume(request, path.split('/resume/')[1]);
    if (path === '/career-paths') return handleGetCareerPaths(request);
    if (path.startsWith('/interview/report/')) return handleExportInterviewReport(request, path.split('/interview/report/')[1]);
    if (path === '/admin/analytics') return handleGetAnalytics(request);
    if (path === '/saved-jobs') return handleGetSavedJobs(request);
    if (path === '/job-match/history') return handleJobMatchHistory(request);
    if (path === '/job-alerts') return handleGetJobAlerts(request);
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
    if (path === '/auth/resend-verification') return handleResendVerification(await request.json());
    if (path === '/auth/forgot-password') return handleForgotPassword(await request.json());
    if (path === '/auth/reset-password') return handleResetPassword(await request.json());
    if (path === '/auth/change-password') return handleChangePassword(request);
    if (path === '/profile/avatar') return handleUpdateAvatar(request);
    
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
    if (path.startsWith('/chat/sessions/')) return handleDeleteSession(request, path.split('/chat/sessions/')[1]);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
}
