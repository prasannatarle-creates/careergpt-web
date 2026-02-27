// Comprehensive Module Testing Script for CareerGPT
// Tests ALL API endpoints with real HTTP requests

const BASE = 'http://localhost:3099/api';
let TOKEN = null;
let TEST_USER_EMAIL = `test-${Date.now()}@careergpt-test.com`;
let TEST_USER_PASSWORD = 'TestPass123!';
let GUEST_TOKEN = null;

// Track results
const results = [];
function log(module, test, pass, detail = '') {
  const status = pass ? '✅ PASS' : '❌ FAIL';
  results.push({ module, test, pass, detail });
  console.log(`  ${status} | ${module} > ${test}${detail ? ' — ' + detail : ''}`);
}

async function req(url, options = {}) {
  const headers = { ...options.headers };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(`${BASE}${url}`, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { _raw: await res.text(), _contentType: contentType };
    }
    return { status: res.status, data, ok: res.ok };
  } catch (e) {
    return { status: 0, data: { error: e.message }, ok: false };
  }
}

async function testHealthAndModels() {
  console.log('\n═══ HEALTH & MODELS ═══');
  
  const h = await req('/health');
  log('Health', 'GET /health', h.ok && h.data.status === 'healthy', `status=${h.data.status}`);

  const m = await req('/models');
  log('Models', 'GET /models', m.ok && Array.isArray(m.data.models) && m.data.models.length === 5,
    `models=${m.data.models?.map(x => x.name).join(', ')}`);

  // Verify model names match frontend
  const expectedNames = ['GPT-4.1', 'Claude 4 Sonnet', 'Gemini 2.5 Flash', 'Grok 3 Mini', 'Perplexity Sonar'];
  const actualNames = m.data.models?.map(x => x.name) || [];
  const nameMatch = expectedNames.every(n => actualNames.includes(n));
  log('Models', 'Model names match frontend', nameMatch, `expected=${expectedNames.join(',')} actual=${actualNames.join(',')}`);
}

async function testAuth() {
  console.log('\n═══ AUTH ═══');

  // Guest login
  const guest = await req('/auth/guest', { method: 'POST', body: {} });
  log('Auth', 'POST /auth/guest', guest.ok && guest.data.token, `role=${guest.data.user?.role}`);
  GUEST_TOKEN = guest.data.token;

  // Register
  const reg = await req('/auth/register', { method: 'POST', body: { name: 'Test User', email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } });
  log('Auth', 'POST /auth/register', reg.ok || reg.data.error?.includes('verification'), `msg=${reg.data.message || reg.data.error}`);

  // Register validation - weak password
  const regWeak = await req('/auth/register', { method: 'POST', body: { name: 'Test', email: 'weak@test.com', password: '123' } });
  log('Auth', 'Register weak password rejected', regWeak.status === 400, `error=${regWeak.data.error}`);

  // Register duplicate
  const regDup = await req('/auth/register', { method: 'POST', body: { name: 'Test', email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } });
  log('Auth', 'Register duplicate rejected', regDup.status === 400 || regDup.status === 409, `error=${regDup.data.error}`);

  // Login before verify (should fail or succeed depending on setup)
  const loginPre = await req('/auth/login', { method: 'POST', body: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } });
  log('Auth', 'POST /auth/login (pre-verify)', loginPre.status === 403 || loginPre.ok, `msg=${loginPre.data.error || 'got token'}`);

  // Auto-verify (debug endpoint)
  const verify = await req(`/debug/verify-user/${encodeURIComponent(TEST_USER_EMAIL)}`);
  log('Auth', 'GET /debug/verify-user', verify.ok, `msg=${verify.data.message || verify.data.error}`);

  // Login after verify
  const login = await req('/auth/login', { method: 'POST', body: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD } });
  log('Auth', 'POST /auth/login (after verify)', login.ok && login.data.token, `has_token=${!!login.data.token}`);
  if (login.data.token) TOKEN = login.data.token;

  // Login wrong password
  const loginBad = await req('/auth/login', { method: 'POST', body: { email: TEST_USER_EMAIL, password: 'wrong123' } });
  log('Auth', 'Login wrong password rejected', loginBad.status === 401, `error=${loginBad.data.error}`);

  // Forgot password
  const forgot = await req('/auth/forgot-password', { method: 'POST', body: { email: TEST_USER_EMAIL } });
  log('Auth', 'POST /auth/forgot-password', forgot.ok, `msg=${forgot.data.message}`);

  // Change password
  const changePw = await req('/auth/change-password', { method: 'POST', body: { currentPassword: TEST_USER_PASSWORD, newPassword: 'NewPass456!' } });
  log('Auth', 'POST /auth/change-password', changePw.ok && changePw.data.success, `msg=${changePw.data.message || changePw.data.error}`);

  // Change back
  await req('/auth/change-password', { method: 'POST', body: { currentPassword: 'NewPass456!', newPassword: TEST_USER_PASSWORD } });

  // Change password - wrong current
  const changeBad = await req('/auth/change-password', { method: 'POST', body: { currentPassword: 'wrong', newPassword: 'NewPass789!' } });
  log('Auth', 'Change password wrong current rejected', changeBad.status === 401, `error=${changeBad.data.error}`);
}

async function testProfile() {
  console.log('\n═══ PROFILE ═══');

  const get = await req('/profile');
  log('Profile', 'GET /profile', get.ok && get.data.user, `name=${get.data.user?.name}, stats keys=${Object.keys(get.data.stats || {}).join(',')}`);

  const update = await req('/profile', {
    method: 'PUT',
    body: {
      name: 'Test User Updated',
      profile: {
        skills: ['JavaScript', 'Python', 'React', 'Node.js'],
        interests: ['AI', 'Web Dev', 'Data Science'],
        education: 'B.Tech CS',
        experience: '2 years',
        careerGoal: 'Senior Full-Stack Developer'
      }
    }
  });
  log('Profile', 'PUT /profile', update.ok && update.data.success, `success=${update.data.success}`);

  // Verify update
  const get2 = await req('/profile');
  log('Profile', 'Profile update persisted', get2.data.user?.name === 'Test User Updated', `name=${get2.data.user?.name}`);
}

async function testChat() {
  console.log('\n═══ AI CHAT & LLM ═══');

  // Send first message (creates session) - retry once if LLM times out
  let send1 = await req('/chat/send', { method: 'POST', body: { message: 'What are top 3 skills for a software developer in 2026?', activeModels: ['GPT-4.1'] } });
  if (!send1.ok || !send1.data.sessionId) {
    console.log('    ⏳ Retrying chat/send (LLM may have timed out)...');
    send1 = await req('/chat/send', { method: 'POST', body: { message: 'What are top 3 skills for a software developer in 2026?', activeModels: ['GPT-4.1'] } });
  }
  log('Chat', 'POST /chat/send (new session)', send1.ok && send1.data.response && send1.data.sessionId,
    `sessionId=${send1.data.sessionId?.substring(0,8)}, models=${send1.data.models?.map(m=>m.name).join(',')}, len=${send1.data.response?.length}`);

  const sessionId = send1.data.sessionId;

  // Check LLM response quality
  if (send1.data.response) {
    const hasContent = send1.data.response.length > 50;
    log('Chat', 'LLM response quality', hasContent, `response_length=${send1.data.response.length}`);
  }

  // Follow-up in same session
  if (sessionId) {
    const send2 = await req('/chat/send', { method: 'POST', body: { sessionId, message: 'Tell me more about the first one', activeModels: ['GPT-4.1'] } });
    log('Chat', 'Follow-up message (context)', send2.ok && send2.data.response, `len=${send2.data.response?.length}`);
  }

  // Get sessions
  const sessions = await req('/chat/sessions');
  log('Chat', 'GET /chat/sessions', sessions.ok && Array.isArray(sessions.data.sessions), `count=${sessions.data.sessions?.length}`);

  // Get specific session
  if (sessionId) {
    const sess = await req(`/chat/sessions/${sessionId}`);
    log('Chat', 'GET /chat/sessions/:id', sess.ok && sess.data.session, `messages=${sess.data.session?.messages?.length}`);
  }

  // Rename session
  if (sessionId) {
    const rename = await req('/chat/rename-session', { method: 'POST', body: { sessionId, title: 'Test Session Renamed' } });
    log('Chat', 'POST /chat/rename-session', rename.ok && rename.data.success, `success=${rename.data.success}`);
  }

  return sessionId;
}

async function testResume() {
  console.log('\n═══ RESUME ANALYZER ═══');

  // Upload a text resume
  const resumeText = `John Doe
Email: john@example.com | Phone: 555-123-4567 | LinkedIn: linkedin.com/in/johndoe

SUMMARY
Experienced full-stack developer with 3 years building web applications using React, Node.js, and Python.

EXPERIENCE
Software Developer, TechCorp Inc. (2023-2026)
- Built RESTful APIs serving 10K+ users using Node.js and Express
- Developed React dashboards that improved team productivity by 30%
- Implemented CI/CD pipelines reducing deployment time by 50%

Junior Developer, StartupXYZ (2021-2023)
- Created responsive web interfaces using HTML, CSS, JavaScript
- Managed PostgreSQL databases with optimized queries

EDUCATION
B.Tech Computer Science, State University (2021)

SKILLS
JavaScript, TypeScript, React, Node.js, Python, SQL, Git, Docker, AWS`;

  const uploadRes = await req('/resume/upload', {
    method: 'POST',
    body: { text: resumeText, fileName: 'test-resume.txt', fileType: 'text/plain' }
  });
  log('Resume', 'POST /resume/upload', uploadRes.ok && uploadRes.data.resumeId, `resumeId=${uploadRes.data.resumeId?.substring(0,8)}`);

  const resumeId = uploadRes.data.resumeId;

  // Analyze resume
  if (resumeId) {
    const analyze = await req('/resume/analyze', { method: 'POST', body: { resumeId, targetRole: 'Senior Full-Stack Developer' } });
    log('Resume', 'POST /resume/analyze (LLM)', analyze.ok && analyze.data.analysis,
      `atsScore=${analyze.data.analysis?.atsScore}, sections=${Object.keys(analyze.data.analysis?.sections || {}).length}`);

    // Check ATS analysis quality
    if (analyze.data.analysis) {
      const a = analyze.data.analysis;
      const hasScore = typeof a.atsScore === 'number' && a.atsScore >= 0 && a.atsScore <= 100;
      log('Resume', 'ATS score valid (0-100)', hasScore, `score=${a.atsScore}`);
      
      const hasKeywords = a.keywords && Array.isArray(a.keywords.found);
      log('Resume', 'Keywords analysis present', hasKeywords, `found=${a.keywords?.found?.length}, missing=${a.keywords?.missing?.length}`);
      
      const hasChecklist = Array.isArray(a.atsChecklist) && a.atsChecklist.length > 0;
      log('Resume', 'ATS checklist present', hasChecklist, `items=${a.atsChecklist?.length}`);

      const hasReadability = a.readability && typeof a.readability.score === 'number';
      log('Resume', 'Readability score present', hasReadability, `readability=${a.readability?.score}`);
    }
  }

  // Get resumes list
  const list = await req('/resumes');
  log('Resume', 'GET /resumes', list.ok && Array.isArray(list.data.resumes), `count=${list.data.resumes?.length}`);

  // Get specific resume
  if (resumeId) {
    const single = await req(`/resume/${resumeId}`);
    log('Resume', 'GET /resume/:id', single.ok, `fileName=${single.data.resume?.fileName || single.data.fileName}`);
  }

  return resumeId;
}

async function testCareerPath() {
  console.log('\n═══ CAREER PATH ═══');

  const gen = await req('/career-path/generate', {
    method: 'POST',
    body: {
      skills: 'JavaScript, React, Node.js, Python',
      interests: 'AI, Web Development',
      education: 'B.Tech CS',
      experience: '3 years',
      targetRole: 'AI/ML Engineer',
      location: 'San Francisco'
    }
  });
  log('Career Path', 'POST /career-path/generate (LLM)', gen.ok && gen.data.pathId,
    `pathId=${gen.data.pathId?.substring(0,8)}`);

  // Check career path quality
  if (gen.data.path) {
    const p = gen.data.path;
    const timeline = p.timeline || p.phases || p.roadmap || p.milestones || p.steps || p.careerTimeline || [];
    log('Career Path', 'Has timeline phases', Array.isArray(timeline) && timeline.length >= 1, `phases=${timeline?.length}`);
    log('Career Path', 'Has salary ranges', !!p.salaryRange, `entry=${p.salaryRange?.entry}`);
    log('Career Path', 'Has certifications', Array.isArray(p.certifications), `count=${p.certifications?.length}`);
    log('Career Path', 'Has top roles', Array.isArray(p.topRoles), `count=${p.topRoles?.length}`);
    log('Career Path', 'Has market demand', !!p.marketDemand, `level=${p.marketDemand?.level}`);
  }

  // Get career paths
  const list = await req('/career-paths');
  log('Career Path', 'GET /career-paths', list.ok && Array.isArray(list.data.paths), `count=${list.data.paths?.length}`);
}

async function testMockInterview() {
  console.log('\n═══ MOCK INTERVIEW ═══');

  const start = await req('/mock-interview/start', {
    method: 'POST',
    body: { role: 'Frontend Developer', level: 'mid', type: 'technical' }
  });
  log('Interview', 'POST /mock-interview/start (LLM)', start.ok && start.data.sessionId && start.data.question,
    `sessionId=${start.data.sessionId?.substring(0,8)}, qLen=${start.data.question?.length}`);

  const interviewId = start.data.sessionId;

  // Respond
  if (interviewId) {
    const respond = await req('/mock-interview/respond', {
      method: 'POST',
      body: { sessionId: interviewId, answer: 'React uses a virtual DOM to optimize rendering. When state changes, React creates a new virtual DOM tree, diffs it with the previous one, and only updates the real DOM where changes occurred. This makes updates efficient.' }
    });
    log('Interview', 'POST /mock-interview/respond (LLM)', respond.ok && respond.data.feedback,
      `score=${respond.data.feedback?.score}/${respond.data.feedback?.maxScore}, qNum=${respond.data.questionNumber}`);

    // Check feedback quality  
    if (respond.data.feedback) {
      const fb = respond.data.feedback;
      log('Interview', 'Feedback has scores', typeof fb.score === 'number' && typeof fb.technicalAccuracy === 'number',
        `score=${fb.score}, tech=${fb.technicalAccuracy}, comm=${fb.communicationScore}`);
      log('Interview', 'Has next question', !!fb.nextQuestion, `nextQ length=${fb.nextQuestion?.length}`);
      log('Interview', 'Has strengths/improvements', Array.isArray(fb.strengths) && Array.isArray(fb.improvements),
        `strengths=${fb.strengths?.length}, improve=${fb.improvements?.length}`);
    }
  }
}

async function testJobMatching() {
  console.log('\n═══ JOB MATCHING ═══');

  const match = await req('/job-match', {
    method: 'POST',
    body: {
      skills: 'JavaScript, React, Node.js, Python, SQL',
      interests: 'Web Development, AI',
      experience: '3 years software development',
      targetIndustry: 'Technology',
      location: 'Remote'
    }
  });
  log('Job Match', 'POST /job-match', match.ok && match.data.matches,
    `matches=${match.data.matches?.length}, source=${match.data.source}`);

  // Check match quality
  if (match.data.matches?.length > 0) {
    const first = match.data.matches[0];
    log('Job Match', 'Match has required fields', !!first.jobTitle && first.matchScore !== undefined,
      `title=${first.jobTitle}, score=${first.matchScore}, company=${first.company}`);
  }

  // History
  const hist = await req('/job-match/history', { method: 'POST', body: {} });
  log('Job Match', 'POST /job-match/history', hist.ok, `count=${hist.data.history?.length}`);
}

async function testSavedJobs() {
  console.log('\n═══ SAVED JOBS ═══');

  // Save a job
  const save = await req('/saved-jobs/save', {
    method: 'POST',
    body: { jobTitle: 'Test Developer', company: 'TestCorp', salary: '$100k-120k', location: 'Remote', matchScore: 85 }
  });
  log('Saved Jobs', 'POST /saved-jobs/save', save.ok && save.data.jobId, `jobId=${save.data.jobId?.substring(0,8)}`);

  const jobId = save.data.jobId;

  // Get saved jobs
  const list = await req('/saved-jobs', { method: 'POST', body: {} });
  log('Saved Jobs', 'POST /saved-jobs (list)', list.ok && Array.isArray(list.data.jobs), `count=${list.data.jobs?.length}, stats=${JSON.stringify(list.data.stats)}`);

  // Update job status
  if (jobId) {
    const upd = await req('/saved-jobs/update', { method: 'POST', body: { jobId, status: 'applied', notes: 'Submitted resume via portal' } });
    log('Saved Jobs', 'POST /saved-jobs/update', upd.ok, `msg=${upd.data.message}`);
  }

  // Save duplicate
  const saveDup = await req('/saved-jobs/save', {
    method: 'POST',
    body: { jobTitle: 'Test Developer', company: 'TestCorp' }
  });
  log('Saved Jobs', 'Duplicate save handled', saveDup.ok, `msg=${saveDup.data.message}`);

  // Delete saved job
  if (jobId) {
    const del = await req('/saved-jobs/delete', { method: 'POST', body: { jobId } });
    log('Saved Jobs', 'POST /saved-jobs/delete', del.ok, `msg=${del.data.message}`);
  }
}

async function testJobAlerts() {
  console.log('\n═══ JOB ALERTS ═══');

  // Create alert
  const create = await req('/job-alerts/create', {
    method: 'POST',
    body: { skills: ['React', 'Node.js'], location: 'Remote', frequency: 'daily' }
  });
  log('Job Alerts', 'POST /job-alerts/create', create.ok, `alertId=${create.data.alertId?.substring(0,8)}`);

  const alertId = create.data.alertId;

  // Get alerts
  const list = await req('/job-alerts', { method: 'POST', body: {} });
  log('Job Alerts', 'POST /job-alerts (list)', list.ok, `count=${list.data.alerts?.length || list.data.length}`);

  // Toggle alert
  if (alertId) {
    const toggle = await req('/job-alerts/toggle', { method: 'POST', body: { alertId, isActive: false } });
    log('Job Alerts', 'POST /job-alerts/toggle', toggle.ok, `msg=${toggle.data.message || JSON.stringify(toggle.data)}`);
  }

  // Delete alert
  if (alertId) {
    const del = await req('/job-alerts/delete', { method: 'POST', body: { alertId } });
    log('Job Alerts', 'POST /job-alerts/delete', del.ok, `msg=${del.data.message || JSON.stringify(del.data)}`);
  }
}

async function testLiveJobSearch() {
  console.log('\n═══ LIVE JOB SEARCH ═══');

  const search = await req('/jobs/live-search', {
    method: 'POST',
    body: { keywords: 'React developer', location: 'Remote', limit: 5 }
  });
  log('Live Jobs', 'POST /jobs/live-search', search.ok && Array.isArray(search.data.jobs),
    `jobs=${search.data.jobs?.length}, hasReal=${search.data.hasRealJobs}, msg=${search.data.message?.substring(0,50)}`);

  if (search.data.jobs?.length > 0) {
    const j = search.data.jobs[0];
    log('Live Jobs', 'Job has required fields', !!j.title && !!j.company,
      `title=${j.title}, company=${j.company}, source=${j.source}`);
  }
}

async function testLearningCenter(resumeId) {
  console.log('\n═══ LEARNING CENTER ═══');

  if (!resumeId) {
    log('Learning', 'SKIP - no resumeId available', false, 'Upload resume first');
    return;
  }

  // Generate learning path
  const gen = await req('/learning-path/generate', {
    method: 'POST',
    body: { resumeId, targetRole: 'Machine Learning Engineer' }
  });
  log('Learning', 'POST /learning-path/generate', gen.ok && gen.data.pathId,
    `pathId=${gen.data.pathId?.substring(0,8)}, msg=${gen.data.message || gen.data.error}`);

  // Get learning paths
  const paths = await req('/learning-paths');
  log('Learning', 'GET /learning-paths', paths.ok, `count=${paths.data.paths?.length || paths.data.totalPaths}`);

  // Skill gaps
  const gaps = await req('/learning-path/skill-gaps', {
    method: 'POST',
    body: { resumeId, targetRole: 'Machine Learning Engineer' }
  });
  log('Learning', 'POST /learning-path/skill-gaps', gaps.ok && gaps.data.success !== false,
    `has_analysis=${!!gaps.data.skillAnalysis}, courses=${gaps.data.courseRecommendations?.length || 0}`);
}

async function testAnalytics() {
  console.log('\n═══ ANALYTICS ═══');

  const analytics = await req('/admin/analytics');
  log('Analytics', 'GET /admin/analytics', analytics.ok && analytics.data.stats,
    `users=${analytics.data.stats?.totalUsers}, resumes=${analytics.data.stats?.totalResumes}, events=${analytics.data.recentEvents?.length}`);

  const dashboard = await req('/dashboard');
  log('Analytics', 'GET /dashboard', dashboard.ok, `success=${dashboard.data.success}`);

  const dau = await req('/analytics/dau');
  log('Analytics', 'GET /analytics/dau', dau.ok, `success=${dau.data.success}`);

  const moduleUsage = await req('/analytics/module-usage');
  log('Analytics', 'GET /analytics/module-usage', moduleUsage.ok, `success=${moduleUsage.data.success}`);
}

async function testChatExportShare(sessionId) {
  console.log('\n═══ CHAT EXPORT & SHARE ═══');

  if (!sessionId) {
    // Try to get a sessionId from existing sessions
    const sessions = await req('/chat/sessions');
    if (sessions.data.sessions?.length > 0) {
      sessionId = sessions.data.sessions[0].id;
      console.log(`    ℹ️ Using existing session: ${sessionId.substring(0,8)}`);
    } else {
      log('Export', 'SKIP - no sessionId', false, 'Create chat session first');
      return;
    }
  }

  // Export markdown
  const md = await req('/chat/export-markdown', { method: 'POST', body: { sessionId } });
  log('Export', 'POST /chat/export-markdown', md.status === 200, `contentType=${md.data._contentType || 'json'}, len=${md.data._raw?.length || JSON.stringify(md.data).length}`);

  // Export HTML
  const html = await req('/chat/export-html', { method: 'POST', body: { sessionId } });
  log('Export', 'POST /chat/export-html', html.status === 200, `contentType=${html.data._contentType || 'json'}, len=${html.data._raw?.length || JSON.stringify(html.data).length}`);

  // Create share link
  const share = await req('/chat/create-share', { method: 'POST', body: { sessionId, readOnly: true, expirationDays: 7 } });
  log('Export', 'POST /chat/create-share', share.ok && share.data.shareCode,
    `shareCode=${share.data.shareCode?.substring(0,8)}, url=${share.data.shareUrl?.substring(0,30)}`);

  const shareCode = share.data.shareCode;

  // Get share links
  const shareLinks = await req('/chat-shares');
  log('Export', 'GET /chat-shares', shareLinks.ok, `count=${shareLinks.data.totalShares}`);

  // Access shared chat (public, no auth needed)
  if (shareCode) {
    const saved = TOKEN;
    TOKEN = null;
    const pub = await req(`/shared-chat/${shareCode}`);
    log('Export', 'GET /shared-chat/:code (public)', pub.ok, `success=${pub.data.success}`);
    TOKEN = saved;
  }

  // Revoke share
  if (shareCode) {
    const revoke = await req('/chat/revoke-share', { method: 'POST', body: { shareCode } });
    log('Export', 'POST /chat/revoke-share', revoke.ok, `msg=${revoke.data.message}`);
  }
}

async function testDeleteSession(sessionId) {
  console.log('\n═══ SESSION DELETE (AUTH) ═══');
  if (!sessionId) return;

  // Try delete without auth
  const saved = TOKEN;
  TOKEN = null;
  const noAuth = await req(`/chat/sessions/${sessionId}`, { method: 'DELETE' });
  log('Auth Security', 'DELETE without auth rejected', noAuth.status === 401, `status=${noAuth.status}`);
  TOKEN = saved;

  // Delete with auth
  const del = await req(`/chat/sessions/${sessionId}`, { method: 'DELETE' });
  log('Auth Security', 'DELETE with auth succeeds', del.ok, `success=${del.data.success}`);
}

async function testEdgeCases() {
  console.log('\n═══ EDGE CASES ═══');

  // 404 routes
  const notFound = await req('/nonexistent-route');
  log('Edge Cases', 'GET unknown route = 404', notFound.status === 404, `status=${notFound.status}`);

  const notFoundPost = await req('/nonexistent', { method: 'POST', body: {} });
  log('Edge Cases', 'POST unknown route = 404', notFoundPost.status === 404, `status=${notFoundPost.status}`);

  // Empty message
  const emptyMsg = await req('/chat/send', { method: 'POST', body: { message: '' } });
  log('Edge Cases', 'Empty chat message rejected', emptyMsg.status === 400, `status=${emptyMsg.status}, error=${emptyMsg.data.error}`);

  // Resume analyze without ID  
  const noId = await req('/resume/analyze', { method: 'POST', body: {} });
  log('Edge Cases', 'Resume analyze without ID rejected', noId.status === 400, `error=${noId.data.error}`);

  // Interview respond without session
  const noSess = await req('/mock-interview/respond', { method: 'POST', body: { answer: 'test' } });
  log('Edge Cases', 'Interview respond without session rejected', noSess.status === 400 || noSess.status === 404, `status=${noSess.status}`);
}

// ============ MAIN ============
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   CareerGPT — Comprehensive Module Testing  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Server: ${BASE}`);
  console.log(`Test user: ${TEST_USER_EMAIL}\n`);

  await testHealthAndModels();
  await testAuth();
  await testProfile();
  
  const sessionId = await testChat();
  const resumeId = await testResume();
  await testCareerPath();
  await testMockInterview();
  await testJobMatching();
  await testSavedJobs();
  await testJobAlerts();
  await testLiveJobSearch();
  await testLearningCenter(resumeId);
  await testAnalytics();
  await testChatExportShare(sessionId);
  await testDeleteSession(sessionId);
  await testEdgeCases();

  // Summary
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                    ║');
  console.log('╚══════════════════════════════════════════════╝');

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  console.log(`\n  Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log(`  Pass Rate: ${((passed/total)*100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('  ❌ FAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    • ${r.module} > ${r.test} — ${r.detail}`);
    });
  }

  console.log('\n  MODULES TESTED:');
  const modules = [...new Set(results.map(r => r.module))];
  modules.forEach(m => {
    const mod = results.filter(r => r.module === m);
    const p = mod.filter(r => r.pass).length;
    console.log(`    ${p === mod.length ? '✅' : '⚠️'} ${m}: ${p}/${mod.length} passed`);
  });
}

main().catch(console.error);
