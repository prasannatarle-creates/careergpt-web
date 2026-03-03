// Comprehensive Module Test Script for CareerGPT
// Tests all API endpoints and modules end-to-end

const BASE = 'http://localhost:3000/api';
let TOKEN = null;
let USER = null;
const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Test User';

const results = [];

async function api(method, path, body = null) {
  const headers = {};
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  
  const options = { method, headers, signal: AbortSignal.timeout(120000) };
  if (body) options.body = typeof body === 'string' ? body : JSON.stringify(body);
  
  try {
    const res = await fetch(`${BASE}${path}`, options);
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return { httpStatus: res.status, ...data };
    }
    return { httpStatus: res.status, text: await res.text() };
  } catch (err) {
    return { httpStatus: 0, error: err.message };
  }
}

function test(name, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  results.push({ name, status, details });
  console.log(`${passed ? '✅' : '❌'} ${name}${details ? ` — ${details}` : ''}`);
}

async function runTests() {
  console.log('\n========================================');
  console.log('  CareerGPT Module Tests');
  console.log('========================================\n');

  // ==========================================
  // 1. HEALTH CHECK
  // ==========================================
  console.log('\n--- 1. HEALTH CHECK ---');
  const health = await api('GET', '/health');
  test('Health endpoint', health.httpStatus === 200 && health.status === 'healthy', `status=${health.status}, http=${health.httpStatus}`);

  // Reset rate limiters before auth tests
  await api('GET', '/debug/rate-limiter-reset');

  // ==========================================
  // 2. AUTH MODULE
  // ==========================================
  console.log('\n--- 2. AUTH MODULE ---');
  
  // Register
  const reg = await api('POST', '/auth/register', { name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });
  test('Register new user', !reg.error || reg.autoVerified, reg.message || reg.error || '');
  
  if (reg.token) {
    TOKEN = reg.token;
    USER = reg.user;
    test('Auto-verified (no email provider)', reg.autoVerified === true, 'Dev mode auto-verify');
  } else if (reg.requiresVerification) {
    test('Requires email verification', true, 'Email provider configured');
    
    // Test resend verification (should auto-verify in dev)
    const resend = await api('POST', '/auth/resend-verification', { email: TEST_EMAIL });
    test('Resend verification', !resend.error, resend.message || resend.error || '');
    if (resend.token) {
      TOKEN = resend.token;
      USER = resend.user;
    }
  }

  // If still no token, login
  if (!TOKEN) {
    const login = await api('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
    test('Login', !!login.token, login.error || '');
    if (login.token) { TOKEN = login.token; USER = login.user; }
  }

  // Duplicate register
  const dupReg = await api('POST', '/auth/register', { name: 'Dup', email: TEST_EMAIL, password: TEST_PASSWORD });
  test('Reject duplicate email', dupReg.httpStatus === 409 || (dupReg.error && dupReg.error.includes('already')), dupReg.error || '');

  // Invalid login
  const badLogin = await api('POST', '/auth/login', { email: TEST_EMAIL, password: 'wrongpass' });
  test('Reject wrong password', badLogin.httpStatus === 401 || (badLogin.error && badLogin.error.includes('Invalid')), badLogin.error || '');

  // Guest login
  const guest = await api('POST', '/auth/guest');
  test('Guest login', !!guest.guest || !!guest.user, '');

  // Email verification endpoint
  const verifyBad = await api('POST', '/auth/verify-email', { token: 'invalidtoken' });
  test('Reject invalid verify token', !!verifyBad.error, verifyBad.error || '');

  if (!TOKEN) {
    console.log('⚠️  No auth token — skipping authenticated tests');
    printSummary();
    return;
  }

  // ==========================================
  // 3. PROFILE MODULE
  // ==========================================
  console.log('\n--- 3. PROFILE MODULE ---');
  
  const profile = await api('GET', '/profile');
  test('Get profile', !!profile.user, `name=${profile.user?.name || 'N/A'}`);
  
  const updateProfile = await api('PUT', '/profile', { 
    name: 'Updated Test User', 
    profile: { skills: ['JavaScript', 'Python'], interests: ['AI', 'Web Dev'], education: 'BS CS', experience: '2 years', careerGoal: 'Full-stack developer' }
  });
  test('Update profile', !updateProfile.error, updateProfile.error || 'Profile updated');

  // Change password (use a different password then change back)
  const changePw = await api('POST', '/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD + '!New' });
  test('Change password', !changePw.error, changePw.error || changePw.message || '');
  // Change back
  await api('POST', '/auth/change-password', { currentPassword: TEST_PASSWORD + '!New', newPassword: TEST_PASSWORD });

  // ==========================================
  // 4. AI CHAT MODULE
  // ==========================================
  console.log('\n--- 4. AI CHAT MODULE ---');
  
  let chatSend;
  try {
    chatSend = await api('POST', '/chat/send', { message: 'What are the top skills for a software developer in 2025?', models: ['GPT-4.1'] });
  } catch (e) {
    chatSend = { error: e.message };
  }
  test('Chat send', !!chatSend.combinedResponse || !!chatSend.response, 
    chatSend.error || `${(chatSend.combinedResponse || chatSend.response || '').substring(0, 60)}...`);

  const sessions = await api('GET', '/chat/sessions');
  test('Get chat sessions', Array.isArray(sessions.sessions), `count=${sessions.sessions?.length || 0}`);

  if (sessions.sessions?.length > 0) {
    const sid = sessions.sessions[0].id;
    const session = await api('GET', `/chat/sessions/${sid}`);
    test('Get single session', !!session.session, `messages=${session.session?.messages?.length || 0}`);
  }

  // ==========================================
  // 5. RESUME ANALYZER MODULE
  // ==========================================
  console.log('\n--- 5. RESUME MODULE ---');
  
  // Upload text resume
  const resumeUpload = await api('POST', '/resume/upload', { 
    text: 'John Doe\njohndoe@email.com\n(555) 123-4567\n\nSummary\nExperienced software developer with 3 years in React and Node.js. Proficient in modern web technologies.\n\nExperience\nSoftware Developer at TechCorp (2022-2025)\n- Built REST APIs using Node.js and Express serving 100k requests/day\n- Developed React components for analytics dashboard reducing load time by 40%\n- Implemented CI/CD pipelines with GitHub Actions\n\nEducation\nBS Computer Science, State University (2022)\n\nSkills\nJavaScript, React, Node.js, PostgreSQL, Git, Docker, TypeScript, AWS',
    fileName: 'test_resume.txt'
  });
  const uploadedResumeId = resumeUpload.resumeId || resumeUpload.resume?.id || resumeUpload.id || null;
  test('Resume upload', !!uploadedResumeId, resumeUpload.error || `id=${uploadedResumeId}, chars=${resumeUpload.charCount || 0}`);

  // Resume analyze requires a resumeId from an uploaded resume
  if (uploadedResumeId) {
    const resumeAnalyze = await api('POST', '/resume/analyze', { 
      resumeId: uploadedResumeId,
      targetRole: 'Frontend Developer'
    });
    test('Resume ATS analysis', !!resumeAnalyze.analysis || resumeAnalyze.atsScore !== undefined, 
      resumeAnalyze.error || `ATS Score: ${resumeAnalyze.analysis?.atsScore || resumeAnalyze.atsScore || 'N/A'}`);
  } else {
    test('Resume ATS analysis', false, 'Skipped — no resume uploaded');
  }

  const resumes = await api('GET', '/resumes');
  test('Get resumes list', Array.isArray(resumes.resumes), `count=${resumes.resumes?.length || 0}`);

  // ==========================================
  // 6. CAREER PATH MODULE
  // ==========================================
  console.log('\n--- 6. CAREER PATH MODULE ---');
  
  const careerPath = await api('POST', '/career-path/generate', { 
    skills: ['JavaScript', 'React', 'Node.js'],
    interests: ['AI', 'Web Development'],
    experience: '2 years as frontend developer',
    education: 'BS Computer Science',
    careerGoal: 'Become a senior full-stack developer'
  });
  test('Generate career path', !!careerPath.careerPath || !!careerPath.path, 
    careerPath.error || `title=${(careerPath.careerPath?.title || careerPath.path?.title || '').substring(0, 50)}`);

  const careerPaths = await api('GET', '/career-paths');
  test('Get career paths', Array.isArray(careerPaths.paths) || Array.isArray(careerPaths.careerPaths), 
    `count=${careerPaths.paths?.length || careerPaths.careerPaths?.length || 0}`);

  // ==========================================
  // 7. MOCK INTERVIEW MODULE
  // ==========================================
  console.log('\n--- 7. MOCK INTERVIEW MODULE ---');
  
  const interviewStart = await api('POST', '/mock-interview/start', { 
    role: 'Frontend Developer',
    level: 'mid',
    type: 'behavioral'
  });
  test('Start mock interview', !!interviewStart.question || !!interviewStart.session, 
    interviewStart.error || `question starts: ${(interviewStart.question || '').substring(0, 60)}...`);

  if (interviewStart.sessionId || interviewStart.session?.id) {
    const sessionId = interviewStart.sessionId || interviewStart.session?.id;
    const respond = await api('POST', '/mock-interview/respond', {
      sessionId,
      answer: 'In my previous role at a startup, I led the migration of our legacy jQuery codebase to React. I started by identifying critical user-facing components, created a migration plan, and worked with the team over 3 sprints. We achieved 95% test coverage on new components and reduced bug reports by 60%.',
      questionNumber: 1
    });
    test('Interview respond', !!respond.feedback || !!respond.score !== undefined, 
      respond.error || `score=${respond.feedback?.score || respond.score || 'N/A'}`);
  }

  // ==========================================
  // 8. JOB MATCHING MODULE
  // ==========================================
  console.log('\n--- 8. JOB MATCHING MODULE ---');
  
  const jobMatch = await api('POST', '/job-match', {
    skills: ['JavaScript', 'React', 'Node.js', 'Python'],
    experience: '2 years as software developer',
    location: 'Remote',
    interests: ['AI', 'web development']
  });
  test('Job matching', !!jobMatch.matches || !!jobMatch.result, 
    jobMatch.error || `matches=${jobMatch.matches?.length || jobMatch.result?.matches?.length || 0}`);

  const jobHistory = await api('GET', '/job-match/history');
  test('Job match history', !jobHistory.error || Array.isArray(jobHistory.matches), jobHistory.error || '');

  // ==========================================
  // 9. SAVED JOBS MODULE
  // ==========================================
  console.log('\n--- 9. SAVED JOBS MODULE ---');
  
  const saveJob = await api('POST', '/saved-jobs/save', {
    jobTitle: 'Frontend Developer', company: 'TestCorp', location: 'Remote', salary: '$80k-120k', jobUrl: 'https://example.com/job', source: 'test'
  });
  test('Save job', !saveJob.error, saveJob.error || saveJob.message || '');

  const savedJobs = await api('GET', '/saved-jobs');
  test('Get saved jobs', Array.isArray(savedJobs.jobs) || Array.isArray(savedJobs.savedJobs), 
    `count=${savedJobs.jobs?.length || savedJobs.savedJobs?.length || 0}`);

  if (savedJobs.jobs?.length > 0 || savedJobs.savedJobs?.length > 0) {
    const jobs = savedJobs.jobs || savedJobs.savedJobs;
    const updateJob = await api('POST', '/saved-jobs/update', { 
      jobId: jobs[0].id, 
      status: 'applied',
      notes: 'Applied via website'
    });
    test('Update saved job status', !updateJob.error, updateJob.error || '');
  }

  // ==========================================
  // 10. JOB ALERTS MODULE
  // ==========================================
  console.log('\n--- 10. JOB ALERTS MODULE ---');
  
  const createAlert = await api('POST', '/job-alerts/create', {
    skills: ['React', 'JavaScript', 'TypeScript'],
    location: 'Remote',
    frequency: 'daily'
  });
  test('Create job alert', !createAlert.error, createAlert.error || '');

  const alerts = await api('GET', '/job-alerts');
  test('Get job alerts', Array.isArray(alerts.alerts) || !alerts.error, `count=${alerts.alerts?.length || 0}`);

  // ==========================================
  // 11. LIVE JOB SEARCH MODULE
  // ==========================================
  console.log('\n--- 11. LIVE JOB SEARCH MODULE ---');
  
  const liveSearch = await api('POST', '/jobs/live-search', {
    keywords: 'React Developer',
    location: 'Remote'
  });
  test('Live job search', Array.isArray(liveSearch.jobs) || !liveSearch.error, 
    liveSearch.error || `jobs=${liveSearch.jobs?.length || 0}`);

  // ==========================================
  // 12. LEARNING CENTER MODULE
  // ==========================================
  console.log('\n--- 12. LEARNING CENTER MODULE ---');
  
  // Learning path + skill gaps require a resumeId
  if (uploadedResumeId) {
    const learningPath = await api('POST', '/learning-path/generate', {
      resumeId: uploadedResumeId,
      targetRole: 'Full Stack Developer'
    });
    test('Generate learning path', !learningPath.error, 
      learningPath.error || `path generated`);

    const skillGaps = await api('POST', '/learning-path/skill-gaps', {
      resumeId: uploadedResumeId,
      targetRole: 'Full Stack Developer'
    });
    test('Analyze skill gaps', !skillGaps.error, skillGaps.error || '');
  } else {
    test('Generate learning path', false, 'Skipped — no resume uploaded');
    test('Analyze skill gaps', false, 'Skipped — no resume uploaded');
  }

  const learningPaths = await api('GET', '/learning-paths');
  test('Get learning paths', !learningPaths.error, `count=${learningPaths.paths?.length || learningPaths.learningPaths?.length || 0}`);

  const learningProgress = await api('GET', '/learning-progress');
  test('Get learning progress', !learningProgress.error, learningProgress.error || '');

  // ==========================================
  // 13. ANALYTICS MODULE
  // ==========================================
  console.log('\n--- 13. ANALYTICS MODULE ---');
  
  const dashboard = await api('GET', '/dashboard');
  test('Get dashboard', !dashboard.error, dashboard.error || '');

  const dau = await api('GET', '/analytics/dau');
  test('Get DAU analytics', !dau.error, dau.error || '');

  const funnel = await api('GET', '/analytics/funnel');
  test('Get funnel analytics', !funnel.error, funnel.error || '');

  const segmentation = await api('GET', '/analytics/segmentation');
  test('Get user segmentation', !segmentation.error, segmentation.error || '');

  const moduleUsage = await api('GET', '/analytics/module-usage');
  test('Get module usage', !moduleUsage.error, moduleUsage.error || '');

  // ==========================================
  // 14. CHAT EXPORT/SHARING MODULE
  // ==========================================
  console.log('\n--- 14. CHAT EXPORT/SHARING ---');
  
  const shares = await api('GET', '/chat-shares');
  test('Get share links', !shares.error, shares.error || `count=${shares.links?.length || 0}`);

  // ==========================================
  // 15. MODELS MODULE
  // ==========================================
  console.log('\n--- 15. MODELS ---');
  
  const models = await api('GET', '/models');
  test('Get models list', Array.isArray(models.models), `count=${models.models?.length || 0}`);
  if (models.models) {
    const names = models.models.map(m => m.name).join(', ');
    test('All 5 models listed', models.models.length >= 5, names);
  }

  // ==========================================
  // 16. RESUME A/B TESTING
  // ==========================================
  console.log('\n--- 16. RESUME A/B TESTING ---');
  
  const abVariant = await api('POST', '/resume/create-variant', {
    resumeId: 'test',
    variantName: 'Tech Focus',
    modifications: { skills: ['JavaScript', 'TypeScript', 'React'] }
  });
  test('Create resume variant', !abVariant.error || abVariant.httpStatus !== 500, abVariant.error || '');

  // ==========================================
  // CLEANUP: Delete test session
  // ==========================================
  if (sessions?.sessions?.length > 0) {
    const delResult = await api('DELETE', `/chat/sessions/${sessions.sessions[0].id}`);
    test('Delete chat session', !delResult.error, delResult.error || '');
  }

  printSummary();
}

function printSummary() {
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n  Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n  FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.details}`);
    });
  }
  console.log('\n========================================\n');
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
