// Job API Integration - Fetch real jobs from multiple sources
// Supports: Remotive (free), Arbeitnow (free), JSearch (RapidAPI), Jooble

// --- FREE APIs (no key required) ---

async function searchRemotive(keywords, filters = {}) {
  // Remotive.com - Free API for remote tech jobs, no auth needed
  try {
    const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${filters.limit || 15}`;
    console.log('Remotive: Searching for', query);

    const response = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) { console.warn('Remotive API returned', response.status); return []; }

    const data = await response.json();
    const jobs = (data.jobs || []).map(job => ({
      jobId: `remotive-${job.id}`,
      jobTitle: job.title,
      company: job.company_name,
      location: job.candidate_required_location || 'Remote',
      salary: job.salary || 'Not disclosed',
      jobDescription: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 300),
      jobUrl: job.url, // Real application URL
      postedDate: job.publication_date,
      employmentType: job.job_type || 'full_time',
      source: 'remotive',
      tags: job.tags || [],
      category: job.category || ''
    }));

    console.log(`✓ Fetched ${jobs.length} real jobs from Remotive`);
    return jobs;
  } catch (error) {
    console.warn('Remotive error:', error.message);
    return [];
  }
}

async function searchArbeitnow(keywords, filters = {}) {
  // Arbeitnow - Free job API, no auth required
  try {
    const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
    const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}&per_page=${filters.limit || 15}`;
    console.log('Arbeitnow: Searching for', query);

    const response = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) { console.warn('Arbeitnow API returned', response.status); return []; }

    const data = await response.json();
    const jobs = (data.data || []).map(job => ({
      jobId: `arbeitnow-${job.slug}`,
      jobTitle: job.title,
      company: job.company_name,
      location: job.location || (job.remote ? 'Remote' : 'On-site'),
      salary: 'Competitive',
      jobDescription: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 300),
      jobUrl: job.url, // Real application URL
      postedDate: job.created_at,
      employmentType: 'FULLTIME',
      source: 'arbeitnow',
      tags: job.tags || []
    }));

    console.log(`✓ Fetched ${jobs.length} real jobs from Arbeitnow`);
    return jobs;
  } catch (error) {
    console.warn('Arbeitnow error:', error.message);
    return [];
  }
}

// --- PAID APIs (key required) ---

async function searchJSerch(keywords, filters = {}) {
  // JSearch API via RapidAPI
  const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY;
  
  if (!JSEARCH_API_KEY) {
    console.warn('JSEARCH_API_KEY not configured, skipping JSearch.');
    return [];
  }

  try {
    const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
    const params = new URLSearchParams({
      query: query,
      page: '1',
      num_pages: '1'
    });
    if (filters.location) params.set('query', `${query} in ${filters.location}`);

    const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': JSEARCH_API_KEY,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.warn('JSearch API error:', response.status);
      return [];
    }

    const data = await response.json();
    const jobs = (data.data || []).map(job => ({
      jobId: job.job_id,
      jobTitle: job.job_title,
      company: job.employer_name,
      location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ') || 'Remote',
      salary: job.job_max_salary ? `$${Math.round(job.job_min_salary || 0 / 1000)}k-${Math.round(job.job_max_salary / 1000)}k` : 'Competitive',
      jobDescription: (job.job_description || '').substring(0, 300),
      jobUrl: job.job_apply_link || `https://www.google.com/search?q=${encodeURIComponent(job.job_title + ' ' + job.employer_name + ' apply')}`,
      postedDate: job.job_posted_at_datetime_utc,
      employmentType: job.job_employment_type || 'FULLTIME',
      source: 'jsearch'
    }));

    console.log(`✓ Fetched ${jobs.length} real jobs from JSearch`);
    return jobs;
  } catch (error) {
    console.error('JSearch error:', error.message);
    return [];
  }
}

async function searchJooble(keywords, filters = {}) {
  const JOOBLE_API_KEY = process.env.JOOBLE_API_KEY;
  if (!JOOBLE_API_KEY) return [];

  try {
    const response = await fetch('https://jooble.org/api/' + JOOBLE_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: Array.isArray(keywords) ? keywords.join(' ') : keywords,
        location: filters.location || '',
        page: 1
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return [];
    const data = await response.json();
    return (data.jobs || []).map(job => ({
      jobId: `jooble-${job.id || Math.random().toString(36).slice(2)}`,
      jobTitle: job.title,
      company: job.company,
      location: job.location || 'Remote',
      salary: job.salary || 'Not specified',
      jobDescription: (job.snippet || '').substring(0, 300),
      jobUrl: job.link,
      postedDate: job.updated,
      employmentType: 'FULLTIME',
      source: 'jooble'
    }));
  } catch (error) {
    console.warn('Jooble error:', error.message);
    return [];
  }
}

// Aggregate jobs from ALL sources (free + paid)
async function searchAllJobSources(keywords, filters = {}) {
  try {
    // Fire all APIs in parallel — free ones always run, paid ones only if key exists
    const [remotiveJobs, arbeitnowJobs, jsearchJobs, joobleJobs] = await Promise.all([
      searchRemotive(keywords, filters).catch(() => []),
      searchArbeitnow(keywords, filters).catch(() => []),
      searchJSerch(keywords, filters).catch(() => []),
      searchJooble(keywords, filters).catch(() => [])
    ]);

    const allJobs = [...remotiveJobs, ...arbeitnowJobs, ...jsearchJobs, ...joobleJobs];
    
    console.log(`Job sources: Remotive(${remotiveJobs.length}), Arbeitnow(${arbeitnowJobs.length}), JSearch(${jsearchJobs.length}), Jooble(${joobleJobs.length})`);

    // Remove duplicates by title + company
    const uniqueJobs = [];
    const seen = new Set();
    
    allJobs.forEach(job => {
      const key = `${(job.jobTitle || '').toLowerCase().trim()}:${(job.company || '').toLowerCase().trim()}`;
      if (!seen.has(key) && job.jobTitle && job.jobUrl) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    });

    // Filter out any with example.com or placeholder URLs
    const validJobs = uniqueJobs.filter(j => j.jobUrl && !j.jobUrl.includes('example.com'));

    console.log(`✓ Total unique real jobs: ${validJobs.length}`);
    return validJobs.slice(0, filters.limit || 20);
  } catch (error) {
    console.error('Job search aggregation error:', error.message);
    return [];
  }
}

// Mock jobs for development/fallback — clearly labeled, no fake apply links
function getMockJobs(keywords, filters = {}, source = 'mock') {
  const keywordStr = Array.isArray(keywords) ? keywords.join(', ') : keywords;
  
  const roles = [
    { title: `${keywordStr} Developer`, salary: '$90k-140k', company: 'Sample Corp (Mock)' },
    { title: `Senior ${keywordStr} Engineer`, salary: '$120k-180k', company: 'Tech Holdings (Mock)' },
    { title: `${keywordStr} Architect`, salary: '$130k-190k', company: 'Enterprise Solutions (Mock)' },
  ];

  return roles.map((role, idx) => ({
    jobId: `mock-${source}-${idx}-${Date.now()}`,
    jobTitle: role.title,
    company: role.company,
    location: filters.location || 'Remote',
    salary: role.salary,
    jobDescription: `This is a sample listing for ${role.title}. Real job listings will appear when job APIs return results. Try different keywords to find live openings.`,
    jobUrl: null, // No fake URLs — mock jobs don't have real apply links
    postedDate: new Date().toISOString(),
    employmentType: 'FULLTIME',
    source: 'mock'
  }));
}

// Rank jobs by relevance to user profile (using LLM)
async function rankJobsByRelevance(jobs, userProfile, callSingleModel) {
  if (!jobs || jobs.length === 0) return [];

  // If 3 or fewer jobs, skip expensive LLM call and provide basic scoring
  if (jobs.length <= 3) {
    return jobs.map((j, i) => ({
      ...j,
      matchScore: Math.max(60, 95 - (i * 10)),
      keyReasons: [`Matches your ${userProfile.skills ? 'skills' : 'profile'}`],
      skillGaps: []
    }));
  }

  const skillsList = Array.isArray(userProfile.skills) ? userProfile.skills.join(', ') : (userProfile.skills || 'Not specified');

  const rankPrompt = `Given these ${jobs.length} real job openings and user profile, rank them by best match.
User Profile:
- Skills: ${skillsList}
- Experience: ${userProfile.experience || 'Not specified'}
- Location preference: ${userProfile.location || 'Any'}
- Interests: ${userProfile.interests || 'Not specified'}

Jobs:
${jobs.map((j, i) => `${i+1}. "${j.jobTitle}" at ${j.company} (${j.location}) [id: ${j.jobId}]`).join('\n')}

Return ONLY valid JSON array, no markdown:
[
  { "index": 0, "matchScore": 92, "keyReasons": ["reason1", "reason2"], "skillGaps": ["skill1"] },
  { "index": 1, "matchScore": 78, "keyReasons": ["reason1"], "skillGaps": ["skill1", "skill2"] }
]
Important: "index" is the 0-based position in the jobs list above. Score 0-100. Include ALL jobs.`;

  try {
    const response = await callSingleModel(
      'You are a job matching expert. Return ONLY valid JSON. No markdown, no code fences.',
      rankPrompt
    );

    if (!response) {
      console.warn('LLM ranking returned null, using position-based scores');
      return jobs.map((j, i) => ({ ...j, matchScore: Math.max(50, 90 - (i * 5)), keyReasons: ['Matches your profile'], skillGaps: [] }));
    }

    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const rankings = JSON.parse(cleanJson);

    // Handle both array format and {ranked: [...]} format
    const rankArray = Array.isArray(rankings) ? rankings : (rankings.ranked || []);

    const rankedJobs = rankArray.map(rank => {
      const idx = rank.index !== undefined ? rank.index : rankArray.indexOf(rank);
      const job = jobs[idx] || jobs.find(j => j.jobId === rank.jobId);
      if (!job) return null;
      return {
        ...job,
        matchScore: Math.min(100, Math.max(1, rank.matchScore || 50)),
        keyReasons: rank.keyReasons || [],
        skillGaps: rank.skillGaps || []
      };
    }).filter(Boolean);

    // Add any unjranked jobs with default score
    const rankedIds = new Set(rankedJobs.map(j => j.jobId));
    const unranked = jobs.filter(j => !rankedIds.has(j.jobId)).map(j => ({ ...j, matchScore: 40, keyReasons: ['Potential match'], skillGaps: [] }));

    return [...rankedJobs, ...unranked].sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    console.warn('Job ranking parse error:', error.message, '- using position-based scores');
    return jobs.map((j, i) => ({ ...j, matchScore: Math.max(50, 90 - (i * 5)), keyReasons: ['Matches your profile'], skillGaps: [] }));
  }
}

// Add a single job to user's saved jobs
async function saveJobForUser(db, userId, job) {
  try {
    await db.collection('saved_jobs').insertOne({
      userId,
      jobId: job.jobId,
      jobTitle: job.jobTitle,
      company: job.company,
      jobUrl: job.jobUrl,
      savedAt: new Date().toISOString(),
      applied: false,
      notes: ''
    });
    return { success: true };
  } catch (error) {
    console.error('Save job error:', error.message);
    return { success: false, error: error.message };
  }
}

// Get user's saved jobs
async function getSavedJobs(db, userId) {
  return db.collection('saved_jobs').find({ userId }).sort({ savedAt: -1 }).toArray();
}

module.exports = {
  searchRemotive,
  searchArbeitnow,
  searchJSerch,
  searchJooble,
  searchAllJobSources,
  getMockJobs,
  rankJobsByRelevance,
  saveJobForUser,
  getSavedJobs,
};
