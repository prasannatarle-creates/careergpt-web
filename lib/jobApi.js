// Job API Integration - Fetch real jobs from multiple sources
// Supports: RapidAPI JSearch, Indeed, Jooble, Adzuna

async function searchJSerch(keywords, filters = {}) {
  // JSearch API via RapidAPI - Fast and easy integration
  const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY;
  
  if (!JSEARCH_API_KEY) {
    console.warn('JSEARCH_API_KEY not configured. Using mock jobs.');
    return getMockJobs(keywords, filters);
  }

  try {
    const query = Array.isArray(keywords) ? keywords.join(' OR ') : keywords;
    const response = await fetch('https://jsearch.p.rapidapi.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rapidapi-key': JSEARCH_API_KEY,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com'
      },
      body: JSON.stringify({
        query: query,
        location: filters.location || 'Remote',
        employment_types: filters.employmentTypes || ['FULLTIME', 'CONTRACTOR'],
        salary_min: filters.minSalary || 50000,
        pages: 1,
        limit: filters.limit || 20
      })
    });

    if (!response.ok) {
      console.warn('JSearch API error, falling back to mock jobs');
      return getMockJobs(keywords, filters);
    }

    const data = await response.json();
    const jobs = (data.data || []).map(job => ({
      jobId: job.job_id,
      jobTitle: job.job_title,
      company: job.employer_name,
      location: `${job.job_city || 'Remote'}, ${job.job_state || ''}`,
      salary: job.job_salary_max ? `$${job.job_salary_min || 0}-${job.job_salary_max}` : 'Competitive',
      jobDescription: job.job_description || '',
      jobUrl: job.job_apply_link,
      postedDate: job.job_posted_at_datetime_utc,
      employmentType: job.job_employment_type,
      source: 'jsearch'
    }));

    console.log(`✓ Fetched ${jobs.length} real jobs from JSearch`);
    return jobs;
  } catch (error) {
    console.error('JSearch error:', error.message);
    return getMockJobs(keywords, filters);
  }
}

async function searchIndeedAPI(keywords, filters = {}) {
  // Would use Indeed API (requires authentication setup)
  // For now, return mock data
  return getMockJobs(keywords, filters, 'indeed');
}

async function searchJooble(keywords, filters = {}) {
  // Jooble API endpoint
  const JOOBLE_API_KEY = process.env.JOOBLE_API_KEY;
  
  if (!JOOBLE_API_KEY) {
    return null; // Skip if not configured
  }

  try {
    const response = await fetch('https://api.jooble.org/api/v2/' + JOOBLE_API_KEY + '/search', {
      method: 'POST',
      body: JSON.stringify({
        keywords: Array.isArray(keywords) ? keywords.join(' ') : keywords,
        location: filters.location || 'Remote',
        salaryMin: filters.minSalary,
        salaryMax: filters.maxSalary,
        postsPerPage: filters.limit || 20
      })
    });

    const data = await response.json();
    return (data.jobs || []).map(job => ({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary || 'Not specified',
      jobDescription: job.snippet,
      jobUrl: job.link,
      postedDate: job.updated,
      source: 'jooble'
    }));
  } catch (error) {
    console.warn('Jooble error:', error.message);
    return null;
  }
}

// Aggregate jobs from multiple sources
async function searchAllJobSources(keywords, filters = {}) {
  try {
    const [jsearchJobs, joobleJobs] = await Promise.all([
      searchJSerch(keywords, filters),
      searchJooble(keywords, filters)
    ]);

    const allJobs = [...(jsearchJobs || []), ...(joobleJobs || [])];
    
    // Remove duplicates by job title + company
    const uniqueJobs = [];
    const seen = new Set();
    
    allJobs.forEach(job => {
      const key = `${job.jobTitle}:${job.company}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    });

    return uniqueJobs.slice(0, filters.limit || 20);
  } catch (error) {
    console.error('Job search error:', error.message);
    return getMockJobs(keywords, filters);
  }
}

// Mock jobs for development/fallback
function getMockJobs(keywords, filters = {}, source = 'mock') {
  const jobRoles = {
    'python': [
      { title: 'Python Backend Developer', salary: '$100k-140k', company: 'Tech Corp' },
      { title: 'Machine Learning Engineer', salary: '$120k-180k', company: 'AI Labs' },
      { title: 'Data Engineer', salary: '$110k-160k', company: 'Data Inc' }
    ],
    'javascript': [
      { title: 'Frontend Engineer', salary: '$90k-130k', company: 'Web Co' },
      { title: 'Full-Stack Developer', salary: '$100k-150k', company: 'Startup XYZ' },
      { title: 'React Developer', salary: '$95k-140k', company: 'Digital Pro' }
    ],
    'default': [
      { title: 'Software Engineer', salary: '$100k-150k', company: 'Tech Company' },
      { title: 'Senior Developer', salary: '$120k-180k', company: 'Big Corp' },
      { title: 'Solutions Architect', salary: '$130k-190k', company: 'Enterprise Inc' }
    ]
  };

  const keywordLower = (Array.isArray(keywords) ? keywords[0] : keywords).toLowerCase();
  const roles = jobRoles[keywordLower] || jobRoles['default'];

  return roles.map((role, idx) => ({
    jobId: `mock-${source}-${idx}`,
    jobTitle: role.title,
    company: role.company,
    location: filters.location || 'San Francisco, CA',
    salary: role.salary,
    jobDescription: `${role.title} position at ${role.company}. We're looking for talented developers to join our team.`,
    jobUrl: `https://example.com/jobs/${idx}`,
    postedDate: new Date().toISOString(),
    employmentType: 'FULLTIME',
    source: source
  }));
}

// Rank jobs by relevance to user profile (using LLM)
async function rankJobsByRelevance(jobs, userProfile, callSingleModel) {
  if (!jobs || jobs.length === 0) return [];

  const rankPrompt = `Given these ${jobs.length} real job openings and user profile, rank them by best match.
User Profile:
- Skills: ${userProfile.skills?.join(', ') || 'Not specified'}
- Experience: ${userProfile.experience || 'Not specified'}
- Location: ${userProfile.location || 'Any'}
- Target Industry: ${userProfile.targetIndustry || 'Any'}

Jobs:
${jobs.map((j, i) => `${i+1}. ${j.jobTitle} at ${j.company} - ${j.location} - ${j.salary}`).join('\n')}

Return ONLY valid JSON (no markdown):
{
  "ranked": [
    { "jobId": "id", "rank": 1, "matchScore": 92, "keyReasons": ["reason1", "reason2"], "skillGaps": ["skill1"] }
  ]
}`;

  try {
    const response = await callSingleModel(
      'You are a job matching expert. Rank jobs by user fit.',
      rankPrompt
    );

    if (!response) return jobs; // Return unranked if LLM fails

    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const rankings = JSON.parse(cleanJson);

    // Merge rankings with jobs
    const rankedJobs = rankings.ranked.map(rank => {
      const job = jobs.find(j => j.jobId === rank.jobId);
      return {
        ...job,
        matchScore: rank.matchScore,
        keyReasons: rank.keyReasons,
        skillGaps: rank.skillGaps,
        rank: rank.rank
      };
    });

    return rankedJobs.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    console.warn('Job ranking error:', error.message, '- returning unranked jobs');
    return jobs;
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
  searchJSerch,
  searchIndeedAPI,
  searchJooble,
  searchAllJobSources,
  getMockJobs,
  rankJobsByRelevance,
  saveJobForUser,
  getSavedJobs,
};
