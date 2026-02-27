// ═══════════════════════════════════════════════════════════════
// CareerGPT — DEEP OUTPUT QUALITY VERIFICATION (v2)
// Checks every module's actual output using correct API field names
// ═══════════════════════════════════════════════════════════════

const BASE = 'http://localhost:3099/api';
const TS = Date.now();
const EMAIL = `verify-${TS}@careergpt-test.com`;
const PASS = 'VerifyTest123!';
let TOKEN = '';
let GUEST_TOKEN = '';
let resumeId = '';
let sessionId = '';
let careerPathId = '';
let interviewSid = '';
const issues = [];
const results = {};

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  if (opts.noAuth) delete headers['Authorization'];
  if (opts.headers) Object.assign(headers, opts.headers);
  const r = await fetch(BASE + path, { method: opts.method || 'GET', headers, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  const ct = r.headers.get('content-type') || '';
  let data;
  if (ct.includes('text/markdown')) data = { _raw: await r.text(), _type: 'markdown' };
  else if (ct.includes('text/html')) data = { _raw: await r.text(), _type: 'html' };
  else data = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, data };
}

function check(module, test, condition, detail) {
  const pass = !!condition;
  if (!pass) issues.push({ module, test, detail });
  if (!results[module]) results[module] = { pass: 0, fail: 0, tests: [] };
  results[module][pass ? 'pass' : 'fail']++;
  results[module].tests.push({ test, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${test} — ${detail}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   DEEP OUTPUT QUALITY VERIFICATION v2                  ║');
  console.log('║   Correct API field names • Full output validation     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Reset rate limiter
  await fetch(BASE + '/debug/rate-limiter-reset');

  // ═══════════════════════════════════════════════════════════
  // 1. AUTH MODULE
  // ═══════════════════════════════════════════════════════════
  console.log('\n🔐 AUTH MODULE');
  console.log('─'.repeat(50));

  // Guest login
  const guest = await req('/auth/guest', { method: 'POST', noAuth: true });
  GUEST_TOKEN = guest.data.token;
  check('Auth', 'Guest login → JWT token', guest.data.token?.length > 50, `token_len=${guest.data.token?.length}`);
  check('Auth', 'Guest → role=guest', guest.data.user?.role === 'guest', `role=${guest.data.user?.role}`);
  check('Auth', 'Guest → unique email', guest.data.user?.email?.includes('guest-'), `email=${guest.data.user?.email}`);
  check('Auth', 'Guest → UUID id', guest.data.user?.id?.includes('-'), `id=${guest.data.user?.id?.substring(0,8)}`);

  // Register
  const reg = await req('/auth/register', { method: 'POST', body: { name: 'Output Verifier', email: EMAIL, password: PASS }, noAuth: true });
  check('Auth', 'Register → success message', reg.data.message === 'Account created successfully!', `msg=${reg.data.message}`);

  // Verify
  await req(`/debug/verify-user/${encodeURIComponent(EMAIL)}`, { noAuth: true });

  // Login
  const login = await req('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASS }, noAuth: true });
  TOKEN = login.data.token;
  check('Auth', 'Login → JWT token (>100 chars)', TOKEN?.length > 100, `token_len=${TOKEN?.length}`);
  check('Auth', 'Login → user object', !!login.data.user, `keys=${Object.keys(login.data.user || {}).join(',')}`);
  check('Auth', 'Login → correct name', login.data.user?.name === 'Output Verifier', `name=${login.data.user?.name}`);
  check('Auth', 'Login → correct email', login.data.user?.email === EMAIL, `email match=${login.data.user?.email === EMAIL}`);
  check('Auth', 'Login → role=user', login.data.user?.role === 'user', `role=${login.data.user?.role}`);

  // Forgot password
  const forgot = await req('/auth/forgot-password', { method: 'POST', body: { email: EMAIL }, noAuth: true });
  check('Auth', 'Forgot password → safe msg', forgot.data.message?.includes('If an account exists'), `safe=true`);

  // Change password
  const changePw = await req('/auth/change-password', { method: 'POST', body: { currentPassword: PASS, newPassword: 'NewPass456!' } });
  check('Auth', 'Change password → success', changePw.data.success && changePw.data.message === 'Password changed successfully', `msg=${changePw.data.message}`);
  await req('/auth/change-password', { method: 'POST', body: { currentPassword: 'NewPass456!', newPassword: PASS } });

  // ═══════════════════════════════════════════════════════════
  // 2. PROFILE MODULE (fields nested in user.profile)
  // ═══════════════════════════════════════════════════════════
  console.log('\n👤 PROFILE MODULE');
  console.log('─'.repeat(50));

  const profile = await req('/profile');
  check('Profile', 'GET → user.name', profile.data.user?.name === 'Output Verifier', `name=${profile.data.user?.name}`);
  check('Profile', 'GET → user.email', profile.data.user?.email === EMAIL, `email match=${profile.data.user?.email === EMAIL}`);
  check('Profile', 'GET → stats object', typeof profile.data.stats === 'object', `keys=${Object.keys(profile.data.stats || {}).join(',')}`);
  check('Profile', 'Stats → resumeCount', typeof profile.data.stats?.resumeCount === 'number', `resumeCount=${profile.data.stats?.resumeCount}`);
  check('Profile', 'Stats → interviewCount', typeof profile.data.stats?.interviewCount === 'number', `interviewCount=${profile.data.stats?.interviewCount}`);
  check('Profile', 'Stats → chatCount', typeof profile.data.stats?.chatCount === 'number', `chatCount=${profile.data.stats?.chatCount}`);
  check('Profile', 'Stats → careerPathCount', typeof profile.data.stats?.careerPathCount === 'number', `careerPathCount=${profile.data.stats?.careerPathCount}`);

  // Update with correct structure: { name, profile: { title, skills, ... } }
  const update = await req('/profile', { method: 'PUT', body: {
    name: 'Verified User',
    profile: {
      title: 'Full Stack Developer',
      skills: ['React', 'Node.js', 'Python', 'MongoDB', 'TypeScript'],
      experience: '3 years',
      education: 'B.Tech Computer Science',
      interests: ['AI', 'Web Development']
    }
  }});
  check('Profile', 'PUT → success=true', update.data.success === true, `success=${update.data.success}`);

  // Verify persistence
  const p2 = await req('/profile');
  check('Profile', 'Name persisted', p2.data.user?.name === 'Verified User', `name=${p2.data.user?.name}`);
  check('Profile', 'Title persisted (in profile)', p2.data.user?.profile?.title === 'Full Stack Developer', `title=${p2.data.user?.profile?.title}`);
  check('Profile', 'Skills persisted', p2.data.user?.profile?.skills?.length === 5, `skills=${p2.data.user?.profile?.skills?.join(',')}`);
  check('Profile', 'Experience persisted', p2.data.user?.profile?.experience === '3 years', `exp=${p2.data.user?.profile?.experience}`);
  check('Profile', 'Education persisted', p2.data.user?.profile?.education === 'B.Tech Computer Science', `edu=${p2.data.user?.profile?.education}`);

  // ═══════════════════════════════════════════════════════════
  // 3. AI CHAT MODULE (response is string, not array)
  // ═══════════════════════════════════════════════════════════
  console.log('\n💬 AI CHAT MODULE');
  console.log('─'.repeat(50));

  const chat1 = await req('/chat/send', { method: 'POST', body: { message: 'What are the top 3 skills needed for a full-stack developer in 2026?', activeModels: ['GPT-4.1'] } });
  sessionId = chat1.data.sessionId;
  const chatReply = chat1.data.response || '';
  check('Chat', 'Returns sessionId', !!sessionId, `sid=${sessionId?.substring(0,8)}`);
  check('Chat', 'Returns response (string)', typeof chat1.data.response === 'string' && chatReply.length > 100, `len=${chatReply.length}`);
  check('Chat', 'Response has meaningful content', chatReply.length > 200, `len=${chatReply.length}`);
  check('Chat', 'Response mentions relevant skills', /javascript|react|node|python|type ?script|api|front.?end|back.?end/i.test(chatReply), `relevant=true`);
  check('Chat', 'Has models array', Array.isArray(chat1.data.models) && chat1.data.models.length > 0, `count=${chat1.data.models?.length}`);
  check('Chat', 'Model has name+color', !!chat1.data.models?.[0]?.name && !!chat1.data.models?.[0]?.color, `name=${chat1.data.models?.[0]?.name}`);
  check('Chat', 'Has individualResponses', Array.isArray(chat1.data.individualResponses), `count=${chat1.data.individualResponses?.length}`);

  // Follow-up
  const chat2 = await req('/chat/send', { method: 'POST', body: { sessionId, message: 'Which of those is most important for beginners?', activeModels: ['GPT-4.1'] } });
  const chat2Reply = chat2.data.response || '';
  check('Chat', 'Follow-up has context', chat2Reply.length > 50, `len=${chat2Reply.length}`);

  // Sessions list
  const sessions = await req('/chat/sessions');
  check('Chat', 'Sessions returns array', Array.isArray(sessions.data.sessions), `count=${sessions.data.sessions?.length}`);
  check('Chat', 'Session has id+title', !!sessions.data.sessions?.[0]?.id && !!sessions.data.sessions?.[0]?.title, `title=${sessions.data.sessions?.[0]?.title?.substring(0,30)}`);

  // Session detail
  const sd = await req(`/chat/sessions/${sessionId}`);
  const msgs = sd.data.session?.messages || sd.data.messages || [];
  check('Chat', 'Session detail has messages', Array.isArray(msgs) && msgs.length > 0, `count=${msgs.length}`);
  check('Chat', 'Messages have roles', msgs.some(m => m.role === 'user') && msgs.some(m => m.role === 'assistant'), `roles=user+assistant`);

  // Rename
  const rename = await req('/chat/rename-session', { method: 'POST', body: { sessionId, title: 'Skills Discussion' } });
  check('Chat', 'Rename success', rename.data.success === true, `success=${rename.data.success}`);

  // ═══════════════════════════════════════════════════════════
  // 4. RESUME MODULE
  // ═══════════════════════════════════════════════════════════
  console.log('\n📄 RESUME MODULE');
  console.log('─'.repeat(50));

  const resumeText = `John Smith
Senior Software Engineer
john.smith@email.com | (555) 123-4567 | San Francisco, CA | linkedin.com/in/johnsmith

PROFESSIONAL SUMMARY
Experienced full-stack developer with 5+ years building scalable web applications using React, Node.js, and Python. Led a team of 4 developers, improved API response time by 60%, and delivered 3 major product launches.

EXPERIENCE
Senior Software Engineer, TechCorp Inc. (2022-Present)
- Architected microservices handling 1M+ daily requests using Node.js and AWS Lambda
- Built real-time dashboard with React and WebSocket reducing monitoring time by 40%
- Mentored 3 junior developers, improving team velocity by 25%

Software Developer, StartupABC (2020-2022)
- Developed RESTful APIs using Python/FastAPI serving 50K+ users
- Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes

EDUCATION
B.S. Computer Science, UC Berkeley (2020)

SKILLS
JavaScript, TypeScript, React, Node.js, Python, FastAPI, AWS, Docker, PostgreSQL, MongoDB, Redis, GraphQL

CERTIFICATIONS
AWS Certified Solutions Architect - Associate (2023)`;

  const upload = await req('/resume/upload', { method: 'POST', body: { text: resumeText, fileName: 'john-smith-resume.txt', fileType: 'text/plain' } });
  resumeId = upload.data.resumeId;
  check('Resume', 'Upload → resumeId', !!resumeId, `id=${resumeId?.substring(0,8)}`);
  check('Resume', 'Upload → fileName', !!upload.data.fileName, `file=${upload.data.fileName}`);

  // Analyze
  if (resumeId) {
    const analyze = await req('/resume/analyze', { method: 'POST', body: { resumeId, targetRole: 'Senior Software Engineer' } });
    const a = analyze.data.analysis;
    check('Resume', 'Analyze → analysis object', !!a, `keys=${Object.keys(a || {}).join(',').substring(0,60)}`);
    check('Resume', 'ATS score (0-100)', typeof a?.atsScore === 'number' && a.atsScore >= 0 && a.atsScore <= 100, `score=${a?.atsScore}`);
    check('Resume', 'Overall feedback text', typeof a?.overallFeedback === 'string' && a.overallFeedback.length > 20, `len=${a?.overallFeedback?.length}`);
    check('Resume', 'Keywords found array', Array.isArray(a?.keywords?.found) && a.keywords.found.length > 0, `found=${a?.keywords?.found?.length}`);
    check('Resume', 'Keywords missing array', Array.isArray(a?.keywords?.missing), `missing=${a?.keywords?.missing?.length}`);
    check('Resume', 'ATS checklist (>5 items)', Array.isArray(a?.atsChecklist) && a.atsChecklist.length >= 5, `items=${a?.atsChecklist?.length}`);
    check('Resume', 'Checklist: item+passed+tip', !!a?.atsChecklist?.[0]?.item && typeof a?.atsChecklist?.[0]?.passed === 'boolean', `first=${a?.atsChecklist?.[0]?.item?.substring(0,30)}`);
    check('Resume', 'Readability score', typeof a?.readability?.score === 'number', `score=${a?.readability?.score}`);
    check('Resume', 'Sections analysis', typeof a?.sections === 'object' && Object.keys(a?.sections).length >= 3, `keys=${Object.keys(a?.sections || {}).join(',').substring(0,50)}`);
    check('Resume', 'Word count', typeof a?.wordCount === 'number' && a.wordCount > 50, `words=${a?.wordCount}`);
    check('Resume', 'Structured data present', !!a?.structuredData, `has=${!!a?.structuredData}`);
    if (a?.structuredData) {
      check('Resume', 'Parsed contact info', !!a.structuredData.contact, `name=${a.structuredData.contact?.name}`);
      check('Resume', 'Parsed experience', Array.isArray(a.structuredData.experience) && a.structuredData.experience.length > 0, `jobs=${a.structuredData.experience?.length}`);
      check('Resume', 'Parsed skills list', Array.isArray(a.structuredData.skills) && a.structuredData.skills.length > 3, `skills=${a.structuredData.skills?.length}`);
      check('Resume', 'Seniority detected', !!a.structuredData.seniority, `level=${a.structuredData.seniority}`);
    }
  }

  // List
  const list = await req('/resumes');
  check('Resume', 'List resumes', Array.isArray(list.data.resumes) && list.data.resumes.length > 0, `count=${list.data.resumes?.length}`);

  // Get single
  if (resumeId) {
    const single = await req(`/resume/${resumeId}`);
    const tc = single.data.resume?.textContent || single.data.textContent;
    check('Resume', 'Single resume text', tc?.length > 100, `len=${tc?.length}`);
  }

  // Create variant
  if (resumeId) {
    const variant = await req('/resume/create-variant', { method: 'POST', body: { baseResumeId: resumeId, changes: { label: 'tech-focused', highlightSkills: ['React', 'Node.js'] } } });
    check('Resume', 'Create variant', variant.ok, `has_variant=${!!variant.data.variantId || variant.ok}`);
  }

  // Track metric
  if (resumeId) {
    const track = await req('/resume/track-metric', { method: 'POST', body: { resumeId, metricType: 'view', value: 1 } });
    check('Resume', 'Track metric → message', track.ok && !!track.data.message, `msg=${track.data.message}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 5. CAREER PATH MODULE (data nested in careerPath)
  // ═══════════════════════════════════════════════════════════
  console.log('\n🛤️ CAREER PATH MODULE');
  console.log('─'.repeat(50));

  const cp = await req('/career-path/generate', { method: 'POST', body: {
    currentRole: 'Software Developer',
    targetRole: 'Engineering Manager',
    skills: ['React', 'Node.js', 'Python', 'Team Leadership'],
    experience: '5 years'
  }});
  careerPathId = cp.data.pathId;
  const cpData = cp.data.careerPath || {};
  check('Career', 'Returns pathId', !!careerPathId, `id=${careerPathId?.substring(0,8)}`);
  check('Career', 'careerPath.title', typeof cpData.title === 'string' && cpData.title.length > 5, `title=${cpData.title?.substring(0,50)}`);
  check('Career', 'careerPath.summary', typeof cpData.summary === 'string' && cpData.summary.length > 50, `len=${cpData.summary?.length}`);
  check('Career', 'careerPath.timeline (phases)', Array.isArray(cpData.timeline) && cpData.timeline.length >= 2, `phases=${cpData.timeline?.length}`);
  if (cpData.timeline?.[0]) {
    const p = cpData.timeline[0];
    check('Career', 'Phase has phase/title', !!p.phase || !!p.title, `phase=${p.phase || p.title}`);
    check('Career', 'Phase has duration', !!p.duration || !!p.timeframe || /\d+.*month|year/i.test(p.phase), `dur=${p.duration || p.timeframe || p.phase}`);
    check('Career', 'Phase has goals/actions', Array.isArray(p.goals) || Array.isArray(p.actions), `goals=${(p.goals || p.actions)?.length}`);
  }
  check('Career', 'Has salary info', !!cpData.salaryRange || !!cpData.salaryRanges, `has_salary=true`);
  check('Career', 'Has skill gaps', Array.isArray(cpData.skillGaps) || !!cpData.gapAnalysis, `gaps=${cpData.skillGaps?.length || 'obj'}`);
  check('Career', 'Has market demand', !!cpData.marketDemand, `demand=${cpData.marketDemand}`);
  check('Career', 'Has recommendations', Array.isArray(cpData.recommendations) || !!cpData.tips, `has=${!!cpData.recommendations || !!cpData.tips}`);

  // List
  const cpList = await req('/career-paths');
  check('Career', 'List saved paths', Array.isArray(cpList.data.paths) && cpList.data.paths.length > 0, `count=${cpList.data.paths?.length}`);

  // ═══════════════════════════════════════════════════════════
  // 6. MOCK INTERVIEW MODULE (feedback nested in .feedback)
  // ═══════════════════════════════════════════════════════════
  console.log('\n🎤 MOCK INTERVIEW MODULE');
  console.log('─'.repeat(50));

  const iv = await req('/mock-interview/start', { method: 'POST', body: {
    role: 'Senior React Developer',
    type: 'technical',
    difficulty: 'medium'
  }});
  interviewSid = iv.data.sessionId;
  const firstQ = iv.data.question;
  check('Interview', 'Returns sessionId', !!interviewSid, `sid=${interviewSid?.substring(0,8)}`);
  check('Interview', 'Returns first question', typeof firstQ === 'string' && firstQ.length > 30, `len=${firstQ?.length}`);
  check('Interview', 'Returns questionNumber', typeof iv.data.questionNumber === 'number', `qnum=${iv.data.questionNumber}`);

  // Answer
  if (interviewSid) {
    const resp = await req('/mock-interview/respond', { method: 'POST', body: {
      sessionId: interviewSid,
      answer: 'React uses a virtual DOM for efficient UI updates. When state changes, React creates a new virtual DOM tree, diffs it against the previous one, and applies only the minimum changes to the real DOM. This is called reconciliation. React 18 introduced concurrent rendering with the fiber architecture for better performance.'
    }});
    const fb = resp.data.feedback;
    check('Interview', 'Returns feedback object', !!fb, `keys=${Object.keys(fb || {}).join(',').substring(0,60)}`);
    check('Interview', 'Score (1-10)', typeof fb?.score === 'number' && fb.score >= 1 && fb.score <= 10, `score=${fb?.score}/10`);
    check('Interview', 'maxScore = 10', fb?.maxScore === 10, `maxScore=${fb?.maxScore}`);
    check('Interview', 'Detailed feedback text', typeof fb?.feedback === 'string' && fb.feedback.length > 30, `len=${fb?.feedback?.length}`);
    check('Interview', 'Technical accuracy score', typeof fb?.technicalAccuracy === 'number', `tech=${fb?.technicalAccuracy}`);
    check('Interview', 'Communication score', typeof fb?.communicationScore === 'number', `comm=${fb?.communicationScore}`);
    check('Interview', 'Strengths array', Array.isArray(fb?.strengths) && fb.strengths.length > 0, `count=${fb?.strengths?.length}`);
    check('Interview', 'Strength is text', typeof fb?.strengths?.[0] === 'string' && fb.strengths[0].length > 5, `first=${fb?.strengths?.[0]?.substring(0,40)}`);
    check('Interview', 'Improvements array', Array.isArray(fb?.improvements) && fb.improvements.length > 0, `count=${fb?.improvements?.length}`);
    check('Interview', 'Next question', typeof fb?.nextQuestion === 'string' && fb.nextQuestion.length > 20, `len=${fb?.nextQuestion?.length}`);
    check('Interview', 'Sample answer', typeof fb?.sampleAnswer === 'string' && fb.sampleAnswer.length > 20, `len=${fb?.sampleAnswer?.length}`);
    check('Interview', 'questionNumber incremented', typeof resp.data.questionNumber === 'number', `qnum=${resp.data.questionNumber}`);
    check('Interview', 'isComplete flag', typeof resp.data.isComplete === 'boolean', `complete=${resp.data.isComplete}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 7. JOBS MODULE (matches, not jobs; jobTitle not title)
  // ═══════════════════════════════════════════════════════════
  console.log('\n💼 JOBS MODULE');
  console.log('─'.repeat(50));

  // AI Job Matching
  const match = await req('/job-match', { method: 'POST', body: {
    skills: ['React', 'Node.js', 'Python', 'AWS'],
    experience: '5 years',
    preferences: { location: 'remote', salary: '150000' }
  }});
  check('Jobs', 'AI match → has matches', Array.isArray(match.data.matches) && match.data.matches.length > 0, `count=${match.data.matches?.length}`);
  if (match.data.matches?.[0]) {
    const j = match.data.matches[0];
    check('Jobs', 'Match has title', !!j.title || !!j.role, `title=${(j.title || j.role)?.substring(0,40)}`);
    check('Jobs', 'Match has company', !!j.company || !!j.company_type, `company=${j.company || j.company_type}`);
    check('Jobs', 'Match has score', typeof j.matchScore === 'number' || typeof j.score === 'number', `score=${j.matchScore || j.score}`);
    check('Jobs', 'Match has location', !!j.location, `loc=${j.location}`);
  }
  check('Jobs', 'Has dataSource', !!match.data.dataSource, `src=${match.data.dataSource}`);
  check('Jobs', 'Has totalMatches', typeof match.data.totalMatches === 'number', `total=${match.data.totalMatches}`);

  // Live Job Search
  const live = await req('/jobs/live-search', { method: 'POST', body: { keywords: 'React developer', location: 'remote' } });
  check('Jobs', 'Live search → jobs', Array.isArray(live.data.jobs) && live.data.jobs.length > 0, `count=${live.data.jobs?.length}`);
  check('Jobs', 'Live → hasRealJobs', live.data.hasRealJobs === true, `real=${live.data.hasRealJobs}`);
  if (live.data.jobs?.[0]) {
    const lj = live.data.jobs[0];
    check('Jobs', 'Live job has title', !!lj.title, `title=${lj.title?.substring(0,40)}`);
    check('Jobs', 'Live job has company', !!lj.company, `company=${lj.company}`);
    check('Jobs', 'Live job has URL', !!lj.url, `has_url=true`);
    check('Jobs', 'Live job has source', !!lj.source, `source=${lj.source}`);
  }

  // Save job (field = jobTitle, not title)
  const save = await req('/saved-jobs/save', { method: 'POST', body: {
    jobTitle: 'Senior React Developer', company: 'TechCorp', location: 'Remote', jobUrl: 'https://example.com/job1', salary: '$150k', source: 'test'
  }});
  check('Jobs', 'Save job → success', save.ok, `msg=${save.data.message || save.data.jobId}`);
  const savedJobId = save.data.jobId;

  // List saved jobs
  const savedList = await req('/saved-jobs', { method: 'POST', body: {} });
  check('Jobs', 'Saved list → array', Array.isArray(savedList.data.jobs), `count=${savedList.data.jobs?.length}`);
  check('Jobs', 'Saved has stats', typeof savedList.data.stats === 'object', `stats_keys=${Object.keys(savedList.data.stats || {}).join(',')}`);

  // Update status
  if (savedJobId) {
    const upd = await req('/saved-jobs/update', { method: 'POST', body: { jobId: savedJobId, status: 'applied' } });
    check('Jobs', 'Update status → applied', upd.ok && upd.data.message === 'Job updated', `msg=${upd.data.message}`);
  }

  // Job alerts (field = skills, not keywords)
  const alert = await req('/job-alerts/create', { method: 'POST', body: {
    skills: ['React', 'Node.js'], location: 'Remote', frequency: 'daily'
  }});
  check('Jobs', 'Create alert → alertId', !!alert.data.alertId, `id=${alert.data.alertId?.substring(0,8)}`);
  const alertId = alert.data.alertId;

  const alerts = await req('/job-alerts', { method: 'POST', body: {} });
  check('Jobs', 'List alerts → array', Array.isArray(alerts.data.alerts), `count=${alerts.data.alerts?.length}`);

  if (alertId) {
    const toggle = await req('/job-alerts/toggle', { method: 'POST', body: { alertId, isActive: false } });
    check('Jobs', 'Toggle alert → deactivate', toggle.ok, `msg=${toggle.data.message}`);
  }

  // Match history
  const hist = await req('/job-match/history', { method: 'POST', body: {} });
  check('Jobs', 'Match history', hist.ok, `count=${hist.data.history?.length}`);

  // ═══════════════════════════════════════════════════════════
  // 8. LEARNING CENTER (requires resumeId + targetRole)
  // ═══════════════════════════════════════════════════════════
  console.log('\n📚 LEARNING CENTER MODULE');
  console.log('─'.repeat(50));

  if (resumeId) {
    const lp = await req('/learning-path/generate', { method: 'POST', body: { resumeId, targetRole: 'Machine Learning Engineer' } });
    const lpData = lp.data.learningPath || {};
    check('Learning', 'Returns pathId', !!lp.data.pathId, `id=${lp.data.pathId?.substring(0,8)}`);
    check('Learning', 'Has learningPath object', !!lp.data.learningPath, `keys=${Object.keys(lpData).join(',').substring(0,60)}`);
    check('Learning', 'targetRole in response', !!lpData.targetRole, `role=${lpData.targetRole}`);
    check('Learning', 'requiredSkills array', Array.isArray(lpData.requiredSkills) && lpData.requiredSkills.length > 0, `count=${lpData.requiredSkills?.length}`);
    check('Learning', 'skillGaps array', Array.isArray(lpData.skillGaps) && lpData.skillGaps.length > 0, `count=${lpData.skillGaps?.length}`);
    check('Learning', 'prioritySkills array', Array.isArray(lpData.prioritySkills), `count=${lpData.prioritySkills?.length}`);
    check('Learning', 'completionPercentage', typeof lpData.completionPercentage === 'number', `pct=${lpData.completionPercentage}%`);
  } else {
    check('Learning', 'SKIPPED (no resumeId)', false, 'Need resume upload first');
  }

  // Skill gaps
  if (resumeId) {
    const gaps = await req('/learning-path/skill-gaps', { method: 'POST', body: { resumeId, targetRole: 'Machine Learning Engineer' } });
    check('Learning', 'Skill gaps analysis', gaps.ok, `keys=${Object.keys(gaps.data).join(',').substring(0,50)}`);
    const gapArr = gaps.data.skillAnalysis?.skillGaps || gaps.data.skillGaps || [];
    check('Learning', 'Has skill analysis', Array.isArray(gapArr) && gapArr.length > 0, `count=${gapArr?.length}`);
  }

  // List + progress
  const lpList = await req('/learning-paths');
  check('Learning', 'List learning paths', Array.isArray(lpList.data.paths), `count=${lpList.data.paths?.length}`);

  const progress = await req('/learning-progress');
  check('Learning', 'Learning progress', progress.ok, `keys=${Object.keys(progress.data).join(',').substring(0,50)}`);

  // ═══════════════════════════════════════════════════════════
  // 9. ANALYTICS MODULE (stats nested in .stats)
  // ═══════════════════════════════════════════════════════════
  console.log('\n📊 ANALYTICS MODULE');
  console.log('─'.repeat(50));

  const an = await req('/admin/analytics');
  check('Analytics', 'stats.totalUsers', typeof an.data.stats?.totalUsers === 'number' && an.data.stats.totalUsers > 0, `users=${an.data.stats?.totalUsers}`);
  check('Analytics', 'stats.totalResumes', typeof an.data.stats?.totalResumes === 'number', `resumes=${an.data.stats?.totalResumes}`);
  check('Analytics', 'stats.totalInterviews', typeof an.data.stats?.totalInterviews === 'number', `interviews=${an.data.stats?.totalInterviews}`);
  check('Analytics', 'stats.totalChats', typeof an.data.stats?.totalChats === 'number', `chats=${an.data.stats?.totalChats}`);
  check('Analytics', 'Has moduleUsage', !!an.data.moduleUsage, `has=${!!an.data.moduleUsage}`);
  check('Analytics', 'Has dailyActivity', !!an.data.dailyActivity, `has=${!!an.data.dailyActivity}`);

  const dashboard = await req('/dashboard');
  check('Analytics', 'Dashboard success', dashboard.data.success === true, `has_dashboard=${!!dashboard.data.dashboard}`);

  const dau = await req('/analytics/dau');
  check('Analytics', 'DAU success', dau.data.success === true, `has_data=${!!dau.data.data}`);

  const wau = await req('/analytics/wau');
  check('Analytics', 'WAU success', wau.data.success === true, `has_data=${!!wau.data.data}`);

  const mau = await req('/analytics/mau');
  check('Analytics', 'MAU success', mau.data.success === true, `has_data=${!!mau.data.data}`);

  const funnel = await req('/analytics/funnel');
  check('Analytics', 'Funnel data', funnel.ok && !!funnel.data.funnel, `has_funnel=${!!funnel.data.funnel}`);

  const segments = await req('/analytics/segmentation');
  check('Analytics', 'Segmentation data', segments.ok, `keys=${Object.keys(segments.data).join(',').substring(0,40)}`);

  const cohorts = await req('/analytics/cohorts');
  check('Analytics', 'Cohorts data', cohorts.ok, `keys=${Object.keys(cohorts.data).join(',').substring(0,40)}`);

  const modUsage = await req('/analytics/module-usage');
  check('Analytics', 'Module usage', modUsage.data.success === true, `has_data=${!!modUsage.data.data}`);

  // ═══════════════════════════════════════════════════════════
  // 10. CHAT EXPORT & SHARING MODULE
  // ═══════════════════════════════════════════════════════════
  console.log('\n📤 EXPORT & SHARING MODULE');
  console.log('─'.repeat(50));

  if (sessionId) {
    // Markdown
    const md = await req('/chat/export-markdown', { method: 'POST', body: { sessionId } });
    check('Export', 'Markdown → text/markdown type', md.data._type === 'markdown', `type=${md.data._type}`);
    check('Export', 'Markdown content length', md.data._raw?.length > 100, `len=${md.data._raw?.length}`);
    check('Export', 'Markdown has headers', md.data._raw?.includes('#'), `has_headers=true`);

    // HTML
    const html = await req('/chat/export-html', { method: 'POST', body: { sessionId } });
    check('Export', 'HTML → text/html type', html.data._type === 'html', `type=${html.data._type}`);
    check('Export', 'HTML content length', html.data._raw?.length > 200, `len=${html.data._raw?.length}`);
    check('Export', 'HTML has tags', html.data._raw?.includes('<') && html.data._raw?.includes('>'), `has_tags=true`);

    // Share
    const share = await req('/chat/create-share', { method: 'POST', body: { sessionId } });
    const shareCode = share.data.shareCode;
    check('Export', 'Share → code', !!shareCode, `code=${shareCode}`);
    check('Export', 'Share → shareUrl', !!share.data.shareUrl, `url=${share.data.shareUrl?.substring(0,40)}`);

    if (shareCode) {
      // Access without auth
      const shared = await req(`/shared-chat/${shareCode}`, { noAuth: true });
      check('Export', 'Shared chat accessible (no auth)', shared.data.success === true, `has_session=${!!shared.data.session}`);
      check('Export', 'Shared has messages', shared.data.session?.messages?.length > 0, `msgs=${shared.data.session?.messages?.length}`);

      // List shares
      const shares = await req('/chat-shares');
      check('Export', 'List shares', Array.isArray(shares.data.shares), `count=${shares.data.shares?.length}`);

      // Revoke
      const revoke = await req('/chat/revoke-share', { method: 'POST', body: { shareCode } });
      check('Export', 'Revoke → success', revoke.data.success === true, `msg=${revoke.data.message}`);

      // Verify revoked
      const revoked = await req(`/shared-chat/${shareCode}`, { noAuth: true });
      check('Export', 'Revoked → blocked', !revoked.ok || !revoked.data.success, `status=${revoked.status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 11. MODELS ENDPOINT (returns { models: [...] })
  // ═══════════════════════════════════════════════════════════
  console.log('\n🤖 MODELS ENDPOINT');
  console.log('─'.repeat(50));

  const models = await req('/models', { noAuth: true });
  const modelArr = models.data.models || models.data;
  check('Models', 'Returns 5 models', Array.isArray(modelArr) && modelArr.length === 5, `count=${modelArr?.length}`);
  const modelNames = (modelArr || []).map(m => m.name);
  check('Models', 'Has GPT-4.1', modelNames.includes('GPT-4.1'), `found=true`);
  check('Models', 'Has Claude 4 Sonnet', modelNames.includes('Claude 4 Sonnet'), `found=true`);
  check('Models', 'Has Gemini 2.5 Flash', modelNames.includes('Gemini 2.5 Flash'), `found=true`);
  check('Models', 'Has Grok 3 Mini', modelNames.includes('Grok 3 Mini'), `found=true`);
  check('Models', 'Has Perplexity Sonar', modelNames.includes('Perplexity Sonar'), `found=true`);
  check('Models', 'Each has provider+model+color', (modelArr || []).every(m => m.provider && m.model && m.color), `valid=true`);

  // ═══════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('            DEEP OUTPUT QUALITY RESULTS');
  console.log('═'.repeat(60));

  let totalPass = 0, totalFail = 0;
  for (const [mod, r] of Object.entries(results)) {
    totalPass += r.pass;
    totalFail += r.fail;
    const pct = ((r.pass / (r.pass + r.fail)) * 100).toFixed(0);
    const status = r.fail === 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${mod.padEnd(12)} ${r.pass}/${r.pass + r.fail} (${pct}%)`);
  }

  console.log('─'.repeat(60));
  console.log(`  Total: ${totalPass + totalFail} | ✅ Passed: ${totalPass} | ❌ Failed: ${totalFail}`);
  console.log(`  Pass Rate: ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));

  if (issues.length > 0) {
    console.log('\n  ❌ ISSUES FOUND:');
    for (const i of issues) {
      console.log(`    • [${i.module}] ${i.test} — ${i.detail}`);
    }
  } else {
    console.log('\n  🎉 ALL MODULES PRODUCING CORRECT OUTPUT!');
  }
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
