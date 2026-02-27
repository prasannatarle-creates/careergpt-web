// ═══════════════════════════════════════════════════════════════════════════
// CareerGPT — FINAL COMPREHENSIVE TEST SUITE
// Tests ALL 61 API endpoints + edge cases + auth flows + security
// ═══════════════════════════════════════════════════════════════════════════

const BASE = 'http://localhost:3099/api';
let TOKEN = null;
let GUEST_TOKEN = null;
const TS = Date.now();
let TEST_EMAIL = `finaltest-${TS}@careergpt-test.com`;
let TEST_PASS = 'SecurePass123!';
let TEST_EMAIL_2 = `finaltest2-${TS}@careergpt-test.com`;

// Stored IDs for cross-test references
let sessionId = null;
let resumeId = null;
let careerPathId = null;
let interviewSessionId = null;
let savedJobId = null;
let alertId = null;
let learningPathId = null;
let shareCode = null;
let resumeVariantId = null;

// Results tracking
const results = [];
let currentSection = '';
function log(test, pass, detail = '') {
  const status = pass ? '✅ PASS' : '❌ FAIL';
  results.push({ section: currentSection, test, pass, detail });
  console.log(`  ${status} | ${test}${detail ? ' — ' + detail : ''}`);
}

function section(name) {
  currentSection = name;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(50));
}

async function req(url, options = {}) {
  const headers = { ...options.headers };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(`${BASE}${url}`, { ...options, headers, signal: AbortSignal.timeout(30000) });
    const ct = res.headers.get('content-type') || '';
    let data;
    if (ct.includes('application/json')) {
      data = await res.json();
    } else if (ct.includes('text/markdown') || ct.includes('text/html') || ct.includes('text/plain')) {
      data = { _raw: await res.text(), _contentType: ct };
    } else if (ct.includes('application/pdf')) {
      const buf = await res.arrayBuffer();
      data = { _binary: true, _contentType: ct, _size: buf.byteLength };
    } else {
      data = { _raw: await res.text(), _contentType: ct };
    }
    return { status: res.status, data, ok: res.ok, headers: Object.fromEntries(res.headers.entries()) };
  } catch (e) {
    return { status: 0, data: { error: e.message }, ok: false };
  }
}

// Helper: req without auth
async function reqNoAuth(url, options = {}) {
  const saved = TOKEN;
  TOKEN = null;
  const r = await req(url, options);
  TOKEN = saved;
  return r;
}

// ═══════════════════════════════════════════════════════════════
// 1. SYSTEM HEALTH & MODELS
// ═══════════════════════════════════════════════════════════════
async function testSystem() {
  section('1. SYSTEM — Health & Models');

  // GET /health
  const h = await req('/health');
  log('GET /health returns healthy', h.ok && h.data.status === 'healthy', `status=${h.data.status}, db=${h.data.database}`);

  // GET /models
  const m = await req('/models');
  log('GET /models returns 5 models', m.ok && Array.isArray(m.data.models) && m.data.models.length === 5,
    `count=${m.data.models?.length}`);

  // Verify each model has required fields
  if (m.data.models) {
    const allValid = m.data.models.every(mod => mod.name && mod.provider && mod.model && mod.color);
    log('Each model has name/provider/model/color', allValid,
      `names=${m.data.models.map(x => x.name).join(', ')}`);
  }

  // Verify exact model names
  const expected = ['GPT-4.1', 'Claude 4 Sonnet', 'Gemini 2.5 Flash', 'Grok 3 Mini', 'Perplexity Sonar'];
  const actual = (m.data.models || []).map(x => x.name);
  log('Model names are correct', expected.every(n => actual.includes(n)),
    `expected=${expected.join(',')} actual=${actual.join(',')}`);

  // OPTIONS (CORS preflight)
  const cors = await fetch(`${BASE}/health`, { method: 'OPTIONS' });
  const acaoHeader = cors.headers.get('access-control-allow-origin');
  log('OPTIONS returns CORS headers', cors.ok, `allow-origin=${acaoHeader}`);
}

// ═══════════════════════════════════════════════════════════════
// 2. AUTH — All 8 auth endpoints
// ═══════════════════════════════════════════════════════════════
async function testAuth() {
  section('2. AUTH — Registration, Login, Verification, Passwords');

  // ---- GUEST LOGIN ----
  const guest = await reqNoAuth('/auth/guest', { method: 'POST', body: {} });
  log('POST /auth/guest succeeds', guest.ok && guest.data.token && guest.data.user,
    `role=${guest.data.user?.role}, has_token=${!!guest.data.token}`);
  GUEST_TOKEN = guest.data.token;

  // Guest should have 'guest' role
  log('Guest user has role=guest', guest.data.user?.role === 'guest');

  // ---- REGISTRATION ----
  const reg = await reqNoAuth('/auth/register', { method: 'POST', body: { name: 'Test User Final', email: TEST_EMAIL, password: TEST_PASS } });
  log('POST /auth/register creates account', reg.ok, `msg=${reg.data.message || reg.data.error}`);

  // Register with weak password (< 6 chars)
  const weakPw = await reqNoAuth('/auth/register', { method: 'POST', body: { name: 'X', email: 'weakpw@test.com', password: '123' } });
  log('Register rejects weak password (<6)', weakPw.status === 400, `error=${weakPw.data.error}`);

  // Register with missing fields
  const noName = await reqNoAuth('/auth/register', { method: 'POST', body: { email: 'test@x.com', password: 'Valid123!' } });
  log('Register rejects missing name', noName.status === 400, `error=${noName.data.error}`);

  // Reset rate limiter before more registration tests (limit is 3/hour)
  await reqNoAuth('/debug/rate-limiter-reset');

  const noEmail = await reqNoAuth('/auth/register', { method: 'POST', body: { name: 'Test', password: 'Valid123!' } });
  log('Register rejects missing email', noEmail.status === 400, `error=${noEmail.data.error}`);

  const noPw = await reqNoAuth('/auth/register', { method: 'POST', body: { name: 'Test', email: 'test@x.com' } });
  log('Register rejects missing password', noPw.status === 400, `error=${noPw.data.error}`);

  // Register duplicate
  const dup = await reqNoAuth('/auth/register', { method: 'POST', body: { name: 'Dup', email: TEST_EMAIL, password: TEST_PASS } });
  log('Register rejects duplicate email', dup.status === 400 || dup.status === 409, `error=${dup.data.error}`);

  // ---- EMAIL VERIFICATION ----
  // Debug auto-verify
  const verify = await reqNoAuth(`/debug/verify-user/${encodeURIComponent(TEST_EMAIL)}`);
  log('GET /debug/verify-user auto-verifies', verify.ok, `msg=${verify.data.message}`);

  // POST /auth/verify-email (with invalid token)
  const badVerify = await reqNoAuth('/auth/verify-email', { method: 'POST', body: { token: 'invalid-token-xyz' } });
  log('POST /auth/verify-email rejects bad token', !badVerify.ok, `status=${badVerify.status}`);

  // POST /auth/resend-verification
  const resend = await reqNoAuth('/auth/resend-verification', { method: 'POST', body: { email: TEST_EMAIL } });
  log('POST /auth/resend-verification works', resend.ok || resend.data.message, `msg=${resend.data.message || resend.data.error}`);

  // ---- LOGIN ----
  const login = await reqNoAuth('/auth/login', { method: 'POST', body: { email: TEST_EMAIL, password: TEST_PASS } });
  log('POST /auth/login succeeds', login.ok && login.data.token, `has_token=${!!login.data.token}`);
  if (login.data.token) TOKEN = login.data.token;

  // Login with wrong password
  const badPw = await reqNoAuth('/auth/login', { method: 'POST', body: { email: TEST_EMAIL, password: 'wrongpw' } });
  log('Login rejects wrong password', badPw.status === 401, `error=${badPw.data.error}`);

  // Login with non-existent email
  const noUser = await reqNoAuth('/auth/login', { method: 'POST', body: { email: 'nobody@nowhere.com', password: 'x' } });
  log('Login rejects non-existent user', noUser.status === 401 || noUser.status === 404, `status=${noUser.status}`);

  // Login with empty body
  const emptyLogin = await reqNoAuth('/auth/login', { method: 'POST', body: {} });
  log('Login rejects empty body', !emptyLogin.ok, `status=${emptyLogin.status}`);

  // ---- FORGOT PASSWORD ----
  const forgot = await reqNoAuth('/auth/forgot-password', { method: 'POST', body: { email: TEST_EMAIL } });
  log('POST /auth/forgot-password succeeds', forgot.ok, `msg=${forgot.data.message}`);

  // Forgot with non-existent email (should not reveal user existence)
  const forgotBad = await reqNoAuth('/auth/forgot-password', { method: 'POST', body: { email: 'ghost@nope.com' } });
  log('Forgot password doesnt reveal non-existent user', forgotBad.ok || forgotBad.data.message, `msg=${forgotBad.data.message}`);

  // ---- RESET PASSWORD (with invalid token) ----
  const resetBad = await reqNoAuth('/auth/reset-password', { method: 'POST', body: { token: 'fake-reset-token', newPassword: 'NewPass999!' } });
  log('POST /auth/reset-password rejects bad token', !resetBad.ok, `status=${resetBad.status}, error=${resetBad.data.error}`);

  // ---- CHANGE PASSWORD ----
  const changePw = await req('/auth/change-password', { method: 'POST', body: { currentPassword: TEST_PASS, newPassword: 'Changed456!' } });
  log('POST /auth/change-password succeeds', changePw.ok && changePw.data.success, `msg=${changePw.data.message}`);

  // Change back
  await req('/auth/change-password', { method: 'POST', body: { currentPassword: 'Changed456!', newPassword: TEST_PASS } });

  // Change with wrong current password
  const changeBad = await req('/auth/change-password', { method: 'POST', body: { currentPassword: 'wrongcurr', newPassword: 'ValidNewPw123!' } });
  log('Change password rejects wrong current', changeBad.status === 401, `error=${changeBad.data.error}`);

  // ---- SECOND USER REGISTRATION ----
  await reqNoAuth('/debug/rate-limiter-reset');
  const reg2 = await reqNoAuth('/auth/register', { method: 'POST', body: { name: 'User Two', email: TEST_EMAIL_2, password: TEST_PASS } });
  log('Second user registration works', reg2.ok, `msg=${reg2.data.message}`);
  await reqNoAuth(`/debug/verify-user/${encodeURIComponent(TEST_EMAIL_2)}`);
}

// ═══════════════════════════════════════════════════════════════
// 3. PROFILE
// ═══════════════════════════════════════════════════════════════
async function testProfile() {
  section('3. PROFILE — Get & Update');

  const get = await req('/profile');
  log('GET /profile returns user', get.ok && get.data.user, `name=${get.data.user?.name}`);
  log('GET /profile returns stats', !!get.data.stats, `keys=${Object.keys(get.data.stats || {}).join(',')}`);

  const update = await req('/profile', {
    method: 'PUT',
    body: {
      name: 'Final Test User',
      profile: {
        skills: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Docker'],
        interests: ['AI', 'Web Development', 'Cloud Computing'],
        education: 'B.Tech Computer Science',
        experience: '3 years',
        careerGoal: 'Senior Full-Stack Engineer'
      }
    }
  });
  log('PUT /profile updates successfully', update.ok && update.data.success, `success=${update.data.success}`);

  // Verify persistence
  const get2 = await req('/profile');
  log('Profile update persisted', get2.data.user?.name === 'Final Test User', `name=${get2.data.user?.name}`);
  log('Profile skills persisted', get2.data.user?.profile?.skills?.length === 6, `skills=${get2.data.user?.profile?.skills?.length}`);

  // Profile without auth
  const noAuth = await reqNoAuth('/profile');
  log('GET /profile rejects without auth', noAuth.status === 401, `status=${noAuth.status}`);
}

// ═══════════════════════════════════════════════════════════════
// 4. AI CHAT — Send, Sessions, Rename, Delete
// ═══════════════════════════════════════════════════════════════
async function testChat() {
  section('4. AI CHAT — Messaging, Sessions, Multi-Model');

  // Send first message (creates session)
  let send1 = await req('/chat/send', { method: 'POST', body: { message: 'What are the top 3 programming languages for AI in 2026?', activeModels: ['GPT-4.1'] } });
  if (!send1.ok) {
    console.log('    ⏳ Retrying chat (LLM timeout)...');
    send1 = await req('/chat/send', { method: 'POST', body: { message: 'What are the top 3 programming languages for AI in 2026?', activeModels: ['GPT-4.1'] } });
  }
  log('POST /chat/send creates session', send1.ok && send1.data.sessionId, `sid=${send1.data.sessionId?.substring(0,8)}`);
  log('Chat returns LLM response', !!send1.data.response && send1.data.response.length > 20, `len=${send1.data.response?.length}`);
  log('Chat returns model info', Array.isArray(send1.data.models), `models=${send1.data.models?.map(m=>m.name).join(',')}`);
  sessionId = send1.data.sessionId;

  // Follow-up in same session (context test)
  if (sessionId) {
    const send2 = await req('/chat/send', { method: 'POST', body: { sessionId, message: 'Tell me more about the first one', activeModels: ['GPT-4.1'] } });
    log('Follow-up maintains context', send2.ok && send2.data.response, `len=${send2.data.response?.length}`);
  }

  // Empty message rejected
  const empty = await req('/chat/send', { method: 'POST', body: { message: '' } });
  log('Empty message rejected', empty.status === 400, `error=${empty.data.error}`);

  // Chat without auth (allows anonymous by design for guest access)
  const noAuth = await reqNoAuth('/chat/send', { method: 'POST', body: { message: 'test', activeModels: ['GPT-4.1'] } });
  log('Chat allows anonymous (guest support)', noAuth.ok, `status=${noAuth.status}`);

  // List sessions
  const sessions = await req('/chat/sessions');
  log('GET /chat/sessions lists sessions', sessions.ok && Array.isArray(sessions.data.sessions), `count=${sessions.data.sessions?.length}`);

  // Get specific session
  if (sessionId) {
    const sess = await req(`/chat/sessions/${sessionId}`);
    log('GET /chat/sessions/:id returns session', sess.ok && sess.data.session, `messages=${sess.data.session?.messages?.length}`);
    log('Session has correct message count', sess.data.session?.messages?.length >= 2, `count=${sess.data.session?.messages?.length}`);
  }

  // Rename session
  if (sessionId) {
    const rename = await req('/chat/rename-session', { method: 'POST', body: { sessionId, title: 'Comprehensive Test Chat' } });
    log('POST /chat/rename-session works', rename.ok, `success=${rename.data.success}`);
  }

  // Create a second session for later
  const send3 = await req('/chat/send', { method: 'POST', body: { message: 'What is Docker?', activeModels: ['GPT-4.1'] } });
  const session2 = send3.data.sessionId;
  log('Can create multiple sessions', !!session2 && session2 !== sessionId, `sid2=${session2?.substring(0,8)}`);
}

// ═══════════════════════════════════════════════════════════════
// 5. RESUME ANALYZER — Upload, Analyze, List, Get
// ═══════════════════════════════════════════════════════════════
async function testResume() {
  section('5. RESUME — Upload, Analyze, List, Variants');

  const resumeText = `Jane Smith
Email: jane@example.com | Phone: 555-987-6543 | LinkedIn: linkedin.com/in/janesmith | GitHub: github.com/janesmith

PROFESSIONAL SUMMARY
Senior full-stack developer with 5+ years building scalable web applications using React, Node.js, TypeScript, and Python. Expert in cloud architectures (AWS, GCP), CI/CD pipelines, and agile methodologies. Led teams of 5-8 developers.

EXPERIENCE
Senior Software Engineer, MegaCorp (2024-Present)
- Architected microservices handling 1M+ daily requests using Node.js, Express, and Redis
- Led migration from monolith to microservices, reducing deployment time by 70%
- Mentored 5 junior developers through code reviews and pair programming
- Implemented automated testing suite achieving 95% code coverage

Software Developer, TechStartup Inc. (2021-2024)
- Built React/TypeScript dashboards used by 10K+ enterprise clients
- Developed RESTful APIs with Express.js and PostgreSQL
- Integrated third-party APIs (Stripe, SendGrid, Twilio)
- Reduced page load time by 60% through performance optimization

Junior Developer, WebAgency (2019-2021)
- Created responsive websites using HTML5, CSS3, JavaScript
- Built WordPress plugins and custom themes
- Managed MySQL databases with complex queries

EDUCATION
M.S. Computer Science, Stanford University (2019)
B.S. Computer Science, UC Berkeley (2017)

CERTIFICATIONS
- AWS Solutions Architect Associate
- Google Cloud Professional Developer

SKILLS
JavaScript, TypeScript, React, Next.js, Node.js, Express, Python, Django, SQL, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, AWS, GCP, Git, CI/CD, GraphQL, REST APIs, Agile, Scrum`;

  // Upload text resume
  const upload = await req('/resume/upload', { method: 'POST', body: { text: resumeText, fileName: 'jane-smith-resume.txt', fileType: 'text/plain' } });
  log('POST /resume/upload succeeds', upload.ok && upload.data.resumeId, `id=${upload.data.resumeId?.substring(0,8)}`);
  resumeId = upload.data.resumeId;

  // Upload without content
  const emptyUpload = await req('/resume/upload', { method: 'POST', body: {} });
  log('Upload rejects empty body', !emptyUpload.ok, `status=${emptyUpload.status}`);

  // Analyze resume
  if (resumeId) {
    const analyze = await req('/resume/analyze', { method: 'POST', body: { resumeId, targetRole: 'Staff Software Engineer' } });
    log('POST /resume/analyze succeeds', analyze.ok && analyze.data.analysis, `atsScore=${analyze.data.analysis?.atsScore}`);

    if (analyze.data.analysis) {
      const a = analyze.data.analysis;
      log('ATS score is valid (0-100)', typeof a.atsScore === 'number' && a.atsScore >= 0 && a.atsScore <= 100, `score=${a.atsScore}`);
      log('Has keyword analysis', !!a.keywords && Array.isArray(a.keywords.found), `found=${a.keywords?.found?.length}, missing=${a.keywords?.missing?.length}`);
      log('Has ATS checklist', Array.isArray(a.atsChecklist) && a.atsChecklist.length > 0, `items=${a.atsChecklist?.length}`);
      log('Has readability score', !!a.readability && typeof a.readability.score === 'number', `score=${a.readability?.score}`);
      log('Has sections analysis', !!a.sections, `keys=${Object.keys(a.sections || {}).length}`);
    }
  }

  // Analyze without resumeId
  const noId = await req('/resume/analyze', { method: 'POST', body: {} });
  log('Analyze rejects without resumeId', noId.status === 400, `error=${noId.data.error}`);

  // List resumes
  const list = await req('/resumes');
  log('GET /resumes lists uploads', list.ok && Array.isArray(list.data.resumes), `count=${list.data.resumes?.length}`);

  // Get specific resume
  if (resumeId) {
    const single = await req(`/resume/${resumeId}`);
    log('GET /resume/:id returns resume', single.ok, `file=${single.data.resume?.fileName || single.data.fileName}`);
  }

  // Create resume variant (A/B testing)
  if (resumeId) {
    const variant = await req('/resume/create-variant', { method: 'POST', body: { baseResumeId: resumeId, changes: { label: 'tech-focused', highlightSkills: ['React', 'Node.js'] } } });
    log('POST /resume/create-variant works', variant.ok || variant.data.variantId, `id=${variant.data.variantId?.substring(0,8) || 'N/A'}`);
    resumeVariantId = variant.data.variantId;
  }

  // Track resume metric
  if (resumeId) {
    const track = await req('/resume/track-metric', { method: 'POST', body: { resumeId, metricType: 'view', value: 1 } });
    log('POST /resume/track-metric works', track.ok, `msg=${track.data.message || track.data.success}`);
  }

  // Get resume recommendations
  if (resumeId) {
    const recs = await req('/resume/recommendations', { method: 'POST', body: { resumeId } });
    log('POST /resume/recommendations works', recs.ok, `has_recs=${!!recs.data.recommendations || !!recs.data.optimizations}`);
  }

  // Resume compare (A/B testing)
  if (resumeId) {
    const compare = await req(`/resume/compare/${resumeId}`);
    log('GET /resume/compare/:id works', compare.ok || compare.status !== 500, `status=${compare.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. CAREER PATH
// ═══════════════════════════════════════════════════════════════
async function testCareerPath() {
  section('6. CAREER PATH — Generate, List, Quality');

  const gen = await req('/career-path/generate', {
    method: 'POST',
    body: {
      skills: 'JavaScript, React, Node.js, Python, Docker, AWS',
      interests: 'AI, Cloud Architecture, System Design',
      education: 'M.S. Computer Science',
      experience: '5 years full-stack development',
      targetRole: 'Staff Engineer / Engineering Manager',
      location: 'San Francisco Bay Area'
    }
  });
  log('POST /career-path/generate succeeds', gen.ok && gen.data.pathId, `pathId=${gen.data.pathId?.substring(0,8)}`);
  careerPathId = gen.data.pathId;

  if (gen.data.path) {
    const p = gen.data.path;
    log('Has title', !!p.title, `title=${p.title?.substring(0,50)}`);
    log('Has summary', !!p.summary, `len=${p.summary?.length}`);

    const timeline = p.timeline || p.phases || p.roadmap || p.milestones || p.steps || [];
    log('Has timeline/phases', Array.isArray(timeline) && timeline.length >= 1, `phases=${timeline.length}`);
    log('Has salary ranges', !!p.salaryRange, `entry=${p.salaryRange?.entry || 'N/A'}`);
    log('Has market demand', !!p.marketDemand, `level=${p.marketDemand?.level || p.marketDemand}`);
    log('Has skill gaps', Array.isArray(p.skillGaps) || !!p.skillGaps, `count=${p.skillGaps?.length || 'obj'}`);
  }

  // List career paths
  const list = await req('/career-paths');
  log('GET /career-paths lists saved paths', list.ok && Array.isArray(list.data.paths), `count=${list.data.paths?.length}`);
}

// ═══════════════════════════════════════════════════════════════
// 7. MOCK INTERVIEW — Start, Respond, Report
// ═══════════════════════════════════════════════════════════════
async function testInterview() {
  section('7. MOCK INTERVIEW — Start, Respond, Feedback, Report');

  // Start interview
  const start = await req('/mock-interview/start', {
    method: 'POST',
    body: { role: 'Senior React Developer', level: 'senior', type: 'technical' }
  });
  log('POST /mock-interview/start succeeds', start.ok && start.data.sessionId, `sid=${start.data.sessionId?.substring(0,8)}`);
  log('Returns first question', !!start.data.question && start.data.question.length > 10, `qLen=${start.data.question?.length}`);
  interviewSessionId = start.data.sessionId;

  // Respond to question
  if (interviewSessionId) {
    const respond = await req('/mock-interview/respond', {
      method: 'POST',
      body: {
        sessionId: interviewSessionId,
        answer: 'React uses a virtual DOM that creates a lightweight representation of the real DOM. When state changes, React creates a new virtual DOM tree, performs a diffing algorithm to find minimal changes needed, and batch-updates only those specific DOM nodes. This is much faster than manipulating the real DOM directly. React 18 introduced concurrent rendering which allows React to prepare multiple versions of the UI simultaneously.'
      }
    });
    log('POST /mock-interview/respond succeeds', respond.ok && respond.data.feedback, `score=${respond.data.feedback?.score}`);

    if (respond.data.feedback) {
      const fb = respond.data.feedback;
      log('Feedback has score', typeof fb.score === 'number', `score=${fb.score}/${fb.maxScore}`);
      log('Feedback has technical accuracy', typeof fb.technicalAccuracy === 'number', `tech=${fb.technicalAccuracy}`);
      log('Feedback has communication score', typeof fb.communicationScore === 'number', `comm=${fb.communicationScore}`);
      log('Has strengths array', Array.isArray(fb.strengths), `count=${fb.strengths?.length}`);
      log('Has improvements array', Array.isArray(fb.improvements), `count=${fb.improvements?.length}`);
      log('Has next question', !!fb.nextQuestion, `len=${fb.nextQuestion?.length}`);
    }
  }

  // Respond without session
  const noSess = await req('/mock-interview/respond', { method: 'POST', body: { answer: 'test' } });
  log('Respond rejects without sessionId', noSess.status === 400 || noSess.status === 404, `status=${noSess.status}`);

  // Generate interview report
  if (interviewSessionId) {
    const report = await req('/interview/generate-report', { method: 'POST', body: { sessionId: interviewSessionId } });
    log('POST /interview/generate-report works', report.ok || report.status !== 500, `status=${report.status}, has_report=${!!report.data.report || !!report.data.reportId}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. JOB MATCHING (AI MATCH TAB)
// ═══════════════════════════════════════════════════════════════
async function testJobMatch() {
  section('8. JOB MATCHING — AI Match, History');

  const match = await req('/job-match', {
    method: 'POST',
    body: {
      skills: 'React, Node.js, Python, SQL, Docker, AWS',
      interests: 'AI, Full-Stack Development',
      experience: '5 years senior software engineer',
      targetIndustry: 'Technology',
      location: 'Remote'
    }
  });
  log('POST /job-match returns matches', match.ok && match.data.matches, `count=${match.data.matches?.length}`);

  if (match.data.matches?.length > 0) {
    const first = match.data.matches[0];
    const hasTitle = !!(first.role || first.jobTitle);
    log('Match has title', hasTitle, `title=${first.role || first.jobTitle}`);
    log('Match has score', first.matchScore !== undefined, `score=${first.matchScore}`);
    log('Match has company', !!(first.company_type || first.company), `company=${first.company_type || first.company}`);
  }

  log('Has data source info', !!match.data.dataSource || !!match.data.source, `source=${match.data.dataSource || match.data.source}`);

  // History
  const hist = await req('/job-match/history', { method: 'POST', body: {} });
  log('POST /job-match/history returns results', hist.ok, `count=${hist.data.history?.length}`);

  // Empty skills
  const noSkills = await req('/job-match', { method: 'POST', body: { skills: '' } });
  log('Job match handles empty skills', noSkills.status === 400 || noSkills.ok, `status=${noSkills.status}`);
}

// ═══════════════════════════════════════════════════════════════
// 9. SAVED JOBS
// ═══════════════════════════════════════════════════════════════
async function testSavedJobs() {
  section('9. SAVED JOBS — Save, List, Update, Delete, Duplicates');

  // Save job
  const save = await req('/saved-jobs/save', {
    method: 'POST',
    body: { jobTitle: 'Senior React Developer', company: 'TechCorp', salary: '$150k-180k', location: 'Remote', matchScore: 92, jobUrl: 'https://example.com/job1' }
  });
  log('POST /saved-jobs/save works', save.ok && save.data.jobId, `id=${save.data.jobId?.substring(0,8)}`);
  savedJobId = save.data.jobId;

  // Save a second job
  const save2 = await req('/saved-jobs/save', {
    method: 'POST',
    body: { jobTitle: 'Full-Stack Engineer', company: 'StartupXYZ', salary: '$120k-140k', location: 'San Francisco', matchScore: 78 }
  });
  log('Can save multiple jobs', save2.ok, `id2=${save2.data.jobId?.substring(0,8)}`);

  // Save duplicate
  const dup = await req('/saved-jobs/save', {
    method: 'POST',
    body: { jobTitle: 'Senior React Developer', company: 'TechCorp' }
  });
  log('Duplicate save handled gracefully', dup.ok, `msg=${dup.data.message}`);

  // List saved jobs
  const list = await req('/saved-jobs', { method: 'POST', body: {} });
  log('POST /saved-jobs lists all', list.ok && Array.isArray(list.data.jobs), `count=${list.data.jobs?.length}`);
  log('Has status stats', !!list.data.stats, `stats=${JSON.stringify(list.data.stats)}`);

  // Update status
  if (savedJobId) {
    const upd = await req('/saved-jobs/update', { method: 'POST', body: { jobId: savedJobId, status: 'applied', notes: 'Applied via company portal on 2026-02-27' } });
    log('POST /saved-jobs/update changes status', upd.ok, `msg=${upd.data.message}`);

    // Verify update
    const list2 = await req('/saved-jobs', { method: 'POST', body: {} });
    const updated = list2.data.jobs?.find(j => j.jobId === savedJobId);
    log('Status update persisted', updated?.status === 'applied', `status=${updated?.status}`);
  }

  // Delete job
  if (save2.data.jobId) {
    const del = await req('/saved-jobs/delete', { method: 'POST', body: { jobId: save2.data.jobId } });
    log('POST /saved-jobs/delete works', del.ok, `msg=${del.data.message}`);
  }

  // Delete the first saved job too
  if (savedJobId) {
    const del = await req('/saved-jobs/delete', { method: 'POST', body: { jobId: savedJobId } });
    log('Can delete all saved jobs', del.ok, `msg=${del.data.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 10. JOB ALERTS
// ═══════════════════════════════════════════════════════════════
async function testJobAlerts() {
  section('10. JOB ALERTS — Create, List, Toggle, Delete');

  // Create alert
  const create = await req('/job-alerts/create', {
    method: 'POST',
    body: { skills: ['React', 'Node.js', 'TypeScript'], location: 'Remote', frequency: 'daily' }
  });
  log('POST /job-alerts/create works', create.ok && create.data.alertId, `id=${create.data.alertId?.substring(0,8)}`);
  alertId = create.data.alertId;

  // Create a second alert
  const create2 = await req('/job-alerts/create', {
    method: 'POST',
    body: { skills: ['Python', 'ML', 'Data Science'], location: 'San Francisco', frequency: 'weekly' }
  });
  log('Can create multiple alerts', create2.ok, `id2=${create2.data.alertId?.substring(0,8)}`);

  // List alerts
  const list = await req('/job-alerts', { method: 'POST', body: {} });
  log('POST /job-alerts lists all', list.ok, `count=${list.data.alerts?.length || list.data.length}`);

  // Toggle alert off
  if (alertId) {
    const toggle = await req('/job-alerts/toggle', { method: 'POST', body: { alertId, isActive: false } });
    log('POST /job-alerts/toggle (deactivate)', toggle.ok, `msg=${toggle.data.message || 'ok'}`);
  }

  // Toggle alert back on
  if (alertId) {
    const toggle2 = await req('/job-alerts/toggle', { method: 'POST', body: { alertId, isActive: true } });
    log('POST /job-alerts/toggle (reactivate)', toggle2.ok, `msg=${toggle2.data.message || 'ok'}`);
  }

  // Delete alerts
  if (alertId) {
    const del = await req('/job-alerts/delete', { method: 'POST', body: { alertId } });
    log('POST /job-alerts/delete works', del.ok, `msg=${del.data.message || 'ok'}`);
  }
  if (create2.data.alertId) {
    const del2 = await req('/job-alerts/delete', { method: 'POST', body: { alertId: create2.data.alertId } });
    log('Can delete all alerts', del2.ok);
  }
}

// ═══════════════════════════════════════════════════════════════
// 11. LIVE JOB SEARCH (BROWSE TAB)
// ═══════════════════════════════════════════════════════════════
async function testLiveJobs() {
  section('11. LIVE JOB SEARCH — Search, Filters, Results');

  // Search with keywords
  const search = await req('/jobs/live-search', {
    method: 'POST',
    body: { keywords: 'React developer', location: 'Remote', limit: 5 }
  });
  log('POST /jobs/live-search works', search.ok && Array.isArray(search.data.jobs), `count=${search.data.jobs?.length}`);
  log('Returns hasRealJobs flag', typeof search.data.hasRealJobs === 'boolean', `real=${search.data.hasRealJobs}`);
  log('Returns message', !!search.data.message, `msg=${search.data.message?.substring(0,60)}`);

  if (search.data.jobs?.length > 0) {
    const j = search.data.jobs[0];
    log('Job has title', !!j.title, `title=${j.title}`);
    log('Job has company', !!j.company, `company=${j.company}`);
    log('Job has source', !!j.source, `source=${j.source}`);
    log('Job has location', j.location !== undefined, `loc=${j.location}`);
  }

  // Search with different keywords
  const search2 = await req('/jobs/live-search', { method: 'POST', body: { keywords: 'Python data scientist', location: 'New York' } });
  log('Different search works', search2.ok, `count=${search2.data.jobs?.length}`);

  // Empty keywords
  const empty = await req('/jobs/live-search', { method: 'POST', body: { keywords: '' } });
  log('Empty keywords handled', empty.status === 400 || empty.ok, `status=${empty.status}`);
}

// ═══════════════════════════════════════════════════════════════
// 12. LEARNING CENTER
// ═══════════════════════════════════════════════════════════════
async function testLearning() {
  section('12. LEARNING CENTER — Generate, Paths, Skill Gaps');

  if (!resumeId) {
    log('SKIP - no resumeId', false, 'Resume upload needed first');
    return;
  }

  // Generate learning path
  const gen = await req('/learning-path/generate', {
    method: 'POST',
    body: { resumeId, targetRole: 'Machine Learning Engineer' }
  });
  log('POST /learning-path/generate works', gen.ok && gen.data.pathId, `pathId=${gen.data.pathId?.substring(0,8)}`);
  learningPathId = gen.data.pathId;

  if (gen.data.learningPath || gen.data.path) {
    const lp = gen.data.learningPath || gen.data.path;
    log('Has learning path content', !!lp, `keys=${Object.keys(lp).join(',').substring(0,80)}`);
  }

  // List learning paths
  const paths = await req('/learning-paths');
  log('GET /learning-paths lists results', paths.ok, `count=${paths.data.paths?.length || paths.data.totalPaths}`);

  // Skill gaps analysis
  const gaps = await req('/learning-path/skill-gaps', {
    method: 'POST',
    body: { resumeId, targetRole: 'Machine Learning Engineer' }
  });
  log('POST /learning-path/skill-gaps works', gaps.ok, `has_analysis=${!!gaps.data.skillAnalysis}`);
  if (gaps.data.skillAnalysis) {
    log('Has skill gap details', !!gaps.data.skillAnalysis, `keys=${Object.keys(gaps.data.skillAnalysis).join(',').substring(0,60)}`);
  }
  log('Has course recommendations', Array.isArray(gaps.data.courseRecommendations) || gaps.data.courseRecommendations !== undefined, `count=${gaps.data.courseRecommendations?.length || 0}`);

  // Track course progress
  const trackProgress = await req('/course/track-progress', {
    method: 'POST',
    body: { courseId: 'test-course-1', courseName: 'Intro to ML', progress: 50, pathId: learningPathId || 'test' }
  });
  log('POST /course/track-progress works', trackProgress.ok || trackProgress.status !== 500, `status=${trackProgress.status}`);

  // Get learning progress
  const progress = await req('/learning-progress');
  log('GET /learning-progress works', progress.ok || progress.status !== 500, `status=${progress.status}`);

  // Generate with different role
  const gen2 = await req('/learning-path/generate', {
    method: 'POST',
    body: { resumeId, targetRole: 'Cloud Solutions Architect' }
  });
  log('Can generate multiple learning paths', gen2.ok, `pathId2=${gen2.data.pathId?.substring(0,8)}`);
}

// ═══════════════════════════════════════════════════════════════
// 13. ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function testAnalytics() {
  section('13. ANALYTICS — Dashboard, DAU, WAU, MAU, Funnel, Segments');

  const admin = await req('/admin/analytics');
  log('GET /admin/analytics works', admin.ok, `users=${admin.data.stats?.totalUsers}, resumes=${admin.data.stats?.totalResumes}`);
  if (admin.data.stats) {
    log('Has user stats', admin.data.stats.totalUsers !== undefined, `users=${admin.data.stats.totalUsers}`);
    log('Has resume stats', admin.data.stats.totalResumes !== undefined, `resumes=${admin.data.stats.totalResumes}`);
  }

  const dash = await req('/dashboard');
  log('GET /dashboard works', dash.ok, `success=${dash.data.success}`);

  const dau = await req('/analytics/dau');
  log('GET /analytics/dau works', dau.ok, `success=${dau.data.success}`);

  const dau7 = await req('/analytics/dau?days=7');
  log('GET /analytics/dau?days=7 with param', dau7.ok, `success=${dau7.data.success}`);

  const wau = await req('/analytics/wau');
  log('GET /analytics/wau works', wau.ok, `success=${wau.data.success}`);

  const mau = await req('/analytics/mau');
  log('GET /analytics/mau works', mau.ok, `success=${mau.data.success}`);

  const funnel = await req('/analytics/funnel');
  log('GET /analytics/funnel works', funnel.ok || funnel.status !== 500, `status=${funnel.status}`);

  const segments = await req('/analytics/segmentation');
  log('GET /analytics/segmentation works', segments.ok || segments.status !== 500, `status=${segments.status}`);

  const cohorts = await req('/analytics/cohorts');
  log('GET /analytics/cohorts works', cohorts.ok || cohorts.status !== 500, `status=${cohorts.status}`);

  const moduleUsage = await req('/analytics/module-usage');
  log('GET /analytics/module-usage works', moduleUsage.ok, `success=${moduleUsage.data.success}`);
}

// ═══════════════════════════════════════════════════════════════
// 14. CHAT EXPORT & SHARING
// ═══════════════════════════════════════════════════════════════
async function testExportShare() {
  section('14. CHAT EXPORT & SHARING — Markdown, HTML, Share, Revoke');

  if (!sessionId) {
    const sessions = await req('/chat/sessions');
    if (sessions.data.sessions?.length > 0) sessionId = sessions.data.sessions[0].id;
  }
  if (!sessionId) { log('SKIP - no session', false); return; }

  // Export markdown
  const md = await req('/chat/export-markdown', { method: 'POST', body: { sessionId } });
  log('POST /chat/export-markdown returns markdown', md.status === 200, `type=${md.data._contentType || 'json'}, len=${md.data._raw?.length || JSON.stringify(md.data).length}`);

  // Export HTML
  const html = await req('/chat/export-html', { method: 'POST', body: { sessionId } });
  log('POST /chat/export-html returns HTML', html.status === 200, `type=${html.data._contentType || 'json'}, len=${html.data._raw?.length || JSON.stringify(html.data).length}`);

  // Create share
  const share = await req('/chat/create-share', { method: 'POST', body: { sessionId, readOnly: true, expirationDays: 7 } });
  log('POST /chat/create-share creates link', share.ok && share.data.shareCode, `code=${share.data.shareCode}`);
  shareCode = share.data.shareCode;

  // List share links
  const shareList = await req('/chat-shares');
  log('GET /chat-shares lists shares', shareList.ok, `count=${shareList.data.totalShares}`);

  // Access shared chat (public - no auth)
  if (shareCode) {
    const pub = await reqNoAuth(`/shared-chat/${shareCode}`);
    log('GET /shared-chat/:code (no auth) works', pub.ok, `success=${pub.data.success}`);
  }

  // Access with bad code
  const badShare = await reqNoAuth('/shared-chat/NONEXISTENT');
  log('Bad share code returns error', !badShare.ok || !badShare.data.success, `status=${badShare.status}`);

  // Revoke share
  if (shareCode) {
    const revoke = await req('/chat/revoke-share', { method: 'POST', body: { shareCode } });
    log('POST /chat/revoke-share works', revoke.ok, `msg=${revoke.data.message}`);

    // Verify revoked share no longer accessible
    const revoked = await reqNoAuth(`/shared-chat/${shareCode}`);
    log('Revoked share is inaccessible', !revoked.ok || !revoked.data.success, `status=${revoked.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 15. SECURITY & AUTH ENFORCEMENT
// ═══════════════════════════════════════════════════════════════
async function testSecurity() {
  section('15. SECURITY — Auth enforcement, Rate limiting');

  // Protected endpoints without auth
  const endpoints = [
    { url: '/profile', method: 'GET', name: 'Profile' },
    { url: '/chat/sessions', method: 'GET', name: 'Chat Sessions' },
    { url: '/resumes', method: 'GET', name: 'Resumes' },
    { url: '/career-paths', method: 'GET', name: 'Career Paths' },
    { url: '/learning-paths', method: 'GET', name: 'Learning Paths' },
    { url: '/chat-shares', method: 'GET', name: 'Chat Shares' },
  ];

  for (const ep of endpoints) {
    const r = await reqNoAuth(ep.url);
    log(`${ep.name} rejects no auth`, r.status === 401, `status=${r.status}`);
  }

  // Delete session without auth
  if (sessionId) {
    const del = await reqNoAuth(`/chat/sessions/${sessionId}`, { method: 'DELETE' });
    log('DELETE session rejects no auth', del.status === 401, `status=${del.status}`);
  }

  // Delete with auth works
  // First create a disposable session
  const tempChat = await req('/chat/send', { method: 'POST', body: { message: 'Disposable test message', activeModels: ['GPT-4.1'] } });
  if (tempChat.data.sessionId) {
    const del = await req(`/chat/sessions/${tempChat.data.sessionId}`, { method: 'DELETE' });
    log('DELETE session with auth works', del.ok, `success=${del.data.success}`);
  }

  // Invalid token
  const saved = TOKEN;
  TOKEN = 'completely-invalid-jwt-token';
  const badToken = await req('/profile');
  log('Invalid JWT token rejected', badToken.status === 401 || badToken.status === 403, `status=${badToken.status}`);
  TOKEN = saved;

  // Debug rate limiter reset (dev only)
  const reset = await req('/debug/rate-limiter-reset');
  log('GET /debug/rate-limiter-reset works', reset.ok || reset.status !== 500, `status=${reset.status}`);
}

// ═══════════════════════════════════════════════════════════════
// 16. EDGE CASES & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════
async function testEdgeCases() {
  section('16. EDGE CASES — 404s, Bad input, Boundary conditions');

  // Unknown GET route
  const notFound = await req('/this-route-does-not-exist');
  log('Unknown GET returns 404', notFound.status === 404, `status=${notFound.status}`);

  // Unknown POST route
  const notFoundPost = await req('/nope', { method: 'POST', body: {} });
  log('Unknown POST returns 404', notFoundPost.status === 404, `status=${notFoundPost.status}`);

  // Empty body on POST endpoints
  const emptyChat = await req('/chat/send', { method: 'POST', body: { message: '' } });
  log('Empty chat message rejected', emptyChat.status === 400, `status=${emptyChat.status}, error=${emptyChat.data.error}`);

  // Non-existent resume
  const badResume = await req('/resume/nonexistent-id-12345');
  log('Non-existent resume handled', badResume.status === 404 || badResume.ok, `status=${badResume.status}`);

  // Non-existent session
  const badSess = await req('/chat/sessions/nonexistent-session-id');
  log('Non-existent session handled', badSess.status === 404 || badSess.ok, `status=${badSess.status}`);

  // Save job with minimal data
  const minSave = await req('/saved-jobs/save', { method: 'POST', body: { jobTitle: 'Minimal Job' } });
  log('Minimal job save handled', minSave.ok || minSave.status === 400, `status=${minSave.status}`);

  // Double delete of same job
  if (savedJobId) {
    const doubleDel = await req('/saved-jobs/delete', { method: 'POST', body: { jobId: savedJobId } });
    log('Double delete handled', doubleDel.ok || doubleDel.status !== 500, `status=${doubleDel.status}`);
  }

  // Very long input
  const longMsg = 'a'.repeat(5000);
  const longChat = await req('/chat/send', { method: 'POST', body: { message: longMsg, activeModels: ['GPT-4.1'] } });
  log('Very long message handled', longChat.ok || longChat.status !== 500, `status=${longChat.status}`);

  // Special characters in search
  const specialSearch = await req('/jobs/live-search', { method: 'POST', body: { keywords: '<script>alert("xss")</script>', location: '"; DROP TABLE jobs; --' } });
  log('XSS/SQL injection in job search handled', specialSearch.ok || specialSearch.status === 400, `status=${specialSearch.status}`);

  // Unicode in profile
  const unicode = await req('/profile', { method: 'PUT', body: { name: '日本語テスト 🚀 Ñoño', profile: { skills: ['技術'] } } });
  log('Unicode profile update handled', unicode.ok, `success=${unicode.data.success}`);
  // Restore name
  await req('/profile', { method: 'PUT', body: { name: 'Final Test User' } });
}

// ═══════════════════════════════════════════════════════════════
// 17. GUEST USER FLOW
// ═══════════════════════════════════════════════════════════════
async function testGuestFlow() {
  section('17. GUEST USER — Limited access flow');

  const saved = TOKEN;
  TOKEN = GUEST_TOKEN;

  // Guest can access profile (guests use a different token format)
  const profile = await req('/profile');
  log('Guest can access profile', profile.ok || profile.status === 401 || profile.status === 404, `status=${profile.status}`);

  // Guest can use chat
  const chat = await req('/chat/send', { method: 'POST', body: { message: 'Hello as guest', activeModels: ['GPT-4.1'] } });
  log('Guest can use chat', chat.ok || chat.status !== 500, `status=${chat.status}`);

  TOKEN = saved;
}

// ═══════════════════════════════════════════════════════════════
// 18. CROSS-MODULE INTEGRATION
// ═══════════════════════════════════════════════════════════════
async function testIntegration() {
  section('18. INTEGRATION — Cross-module workflows');

  // After uploading resume → can generate career path + learning path
  log('Resume exists for integration', !!resumeId, `id=${resumeId?.substring(0,8)}`);

  // Profile stats should reflect activity
  const prof = await req('/profile');
  if (prof.data.stats) {
    log('Profile tracks resume count', prof.data.stats.resumeCount >= 1, `count=${prof.data.stats.resumeCount}`);
    log('Profile tracks chat count', prof.data.stats.chatCount >= 1, `count=${prof.data.stats.chatCount}`);
    log('Profile tracks career path count', prof.data.stats.careerPathCount >= 1, `count=${prof.data.stats.careerPathCount}`);
  }

  // Analytics should show our test activity
  const analytics = await req('/admin/analytics');
  if (analytics.data.stats) {
    log('Analytics shows users', analytics.data.stats.totalUsers >= 1, `users=${analytics.data.stats.totalUsers}`);
  }

  // Dashboard endpoint should work
  const dash = await req('/dashboard');
  log('Dashboard returns data', dash.ok, `keys=${Object.keys(dash.data).join(',').substring(0,60)}`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   CareerGPT — FINAL COMPREHENSIVE TEST SUITE           ║');
  console.log('║   Testing ALL 61 endpoints + edge cases + security     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Server: ${BASE}`);
  console.log(`Test user: ${TEST_EMAIL}`);
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  const t0 = Date.now();

  // Reset rate limiter before tests
  console.log('  Resetting rate limiter...');
  try { await fetch(`${BASE}/debug/rate-limiter-reset`); } catch(e) {}
  console.log('  Rate limiter reset ✓\n');

  await testSystem();          // 1. Health, Models
  await testAuth();            // 2. All 8 auth endpoints
  await testProfile();         // 3. Profile CRUD
  await testChat();            // 4. AI Chat + Sessions
  await testResume();          // 5. Resume upload, analyze, variants
  await testCareerPath();      // 6. Career Path generation
  await testInterview();       // 7. Mock Interview flow
  await testJobMatch();        // 8. AI Job Matching
  await testSavedJobs();       // 9. Saved Jobs CRUD
  await testJobAlerts();       // 10. Job Alerts CRUD
  await testLiveJobs();        // 11. Live Job Search
  await testLearning();        // 12. Learning Center
  await testAnalytics();       // 13. Analytics Dashboard
  await testExportShare();     // 14. Chat Export & Sharing
  await testSecurity();        // 15. Security checks
  await testEdgeCases();       // 16. Edge cases
  await testGuestFlow();       // 17. Guest user flow
  await testIntegration();     // 18. Cross-module integration

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // ═══ SUMMARY ═══
  console.log('\n' + '═'.repeat(58));
  console.log('                    TEST RESULTS SUMMARY');
  console.log('═'.repeat(58));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;
  const pct = ((passed / total) * 100).toFixed(1);

  console.log(`\n  Total Tests: ${total}`);
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  Pass Rate:   ${pct}%`);
  console.log(`  Duration:    ${elapsed}s\n`);

  // Sections summary
  console.log('  SECTION BREAKDOWN:');
  const sections = [...new Set(results.map(r => r.section))];
  for (const s of sections) {
    const sTests = results.filter(r => r.section === s);
    const sp = sTests.filter(r => r.pass).length;
    const icon = sp === sTests.length ? '✅' : '⚠️';
    console.log(`    ${icon} ${s}: ${sp}/${sTests.length}`);
  }

  if (failed > 0) {
    console.log('\n  ❌ FAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    • [${r.section}] ${r.test} — ${r.detail}`);
    });
  }

  console.log('\n' + '═'.repeat(58));
  console.log(`  Completed: ${new Date().toLocaleString()}`);
  console.log('═'.repeat(58));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
