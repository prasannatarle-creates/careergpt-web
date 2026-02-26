// Resume Parser - Extracts structured data from resume text
// Returns: contact info, experience, education, skills, certifications

async function parseResumeStructure(textContent, callSingleModel) {
  // Use LLM to parse resume into structured format
  const parsePrompt = `Parse this resume text and extract ONLY valid JSON (no markdown, no code fences):
{
  "contact": {
    "name": "extracted name or null",
    "email": "email if found or null",
    "phone": "phone if found or null",
    "location": "city, state or null",
    "website": "website URL or null",
    "linkedin": "linkedin URL or null"
  },
  "summary": "extracted summary/objective or null",
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or 'Present'",
      "description": "concatenated bullet points",
      "durationMonths": 24
    }
  ],
  "education": [
    {
      "school": "School/University Name",
      "degree": "Bachelor/Master/etc",
      "fieldOfStudy": "Major/Field",
      "graduationDate": "YYYY-MM or YYYY",
      "gpa": "GPA if listed or null"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuer/Provider",
      "issueDate": "YYYY-MM or YYYY or null",
      "expiryDate": "YYYY-MM or YYYY or null"
    }
  ],
  "metadata": {
    "totalExperienceYears": 5,
    "projectsCount": 2,
    "languagesCount": 1,
    "certificationCount": 0,
    "pages": 1
  }
}

Resume Text:
${textContent}`;

  try {
    const response = await callSingleModel(
      'You are an expert resume parser. Extract all information into structured JSON format.',
      parsePrompt
    );

    if (!response) {
      return null;
    }

    // Clean JSON (remove markdown code fences)
    const cleanJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return parsed;
  } catch (error) {
    console.error('Resume parsing error:', error.message);
    return null;
  }
}

// Calculate total years of experience
function calculateExperienceYears(experiences) {
  if (!experiences || experiences.length === 0) return 0;

  let totalMonths = 0;
  experiences.forEach((exp) => {
    if (exp.durationMonths) {
      totalMonths += exp.durationMonths;
    }
  });

  return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
}

// Extract all unique skills mentioned
function extractSkills(parsed) {
  const skills = new Set();

  if (parsed.skills && Array.isArray(parsed.skills)) {
    parsed.skills.forEach(s => skills.add(s));
  }

  // Also extract from experience descriptions
  if (parsed.experience && Array.isArray(parsed.experience)) {
    parsed.experience.forEach((exp) => {
      // Look for common skill keywords in descriptions
      const skillKeywords = [
        'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust',
        'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI',
        'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab',
        'REST API', 'GraphQL', 'WebSocket', 'gRPC',
        'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn',
        'Leadership', 'Agile', 'Scrum', 'Project Management', 'Communication'
      ];

      skillKeywords.forEach((keyword) => {
        if (exp.description.toLowerCase().includes(keyword.toLowerCase())) {
          skills.add(keyword);
        }
      });
    });
  }

  return Array.from(skills);
}

// Get seniority level based on experience
function detectSeniorityLevel(years) {
  if (years < 2) return 'entry';
  if (years < 5) return 'mid';
  if (years < 10) return 'senior';
  return 'lead';
}

// Detect focus areas (Backend, Frontend, Full-stack, etc.)
function detectFocusArea(skills) {
  const backendSkills = ['Python', 'Java', 'C++', 'Node.js', 'Django', 'FastAPI', 'Spring', 'Go', 'Rust'];
  const frontendSkills = ['React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'CSS', 'HTML'];
  const devopsSkills = ['Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Jenkins', 'GitLab'];
  const mlSkills = ['Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn'];

  const skillsLower = skills.map(s => s.toLowerCase());
  
  const backendCount = backendSkills.filter(s => skillsLower.some(sk => sk.includes(s.toLowerCase()))).length;
  const frontendCount = frontendSkills.filter(s => skillsLower.some(sk => sk.includes(s.toLowerCase()))).length;
  const devopsCount = devopsSkills.filter(s => skillsLower.some(sk => sk.includes(s.toLowerCase()))).length;
  const mlCount = mlSkills.filter(s => skillsLower.some(sk => sk.includes(s.toLowerCase()))).length;

  if (mlCount >= 2) return 'AI/ML Engineer';
  if (devopsCount >= 2) return 'DevOps Engineer';
  if (backendCount >= 2 && frontendCount >= 2) return 'Full-Stack Engineer';
  if (frontendCount >= 2) return 'Frontend Engineer';
  if (backendCount >= 2) return 'Backend Engineer';
  
  return 'Software Engineer';
}

// Validate parsed data quality
function validateParsedData(parsed) {
  const issues = [];

  if (!parsed.contact || !parsed.contact.email) {
    issues.push('Missing email address');
  }

  if (!parsed.experience || parsed.experience.length === 0) {
    issues.push('No work experience found');
  }

  if (!parsed.education || parsed.education.length === 0) {
    issues.push('No education found');
  }

  if (!parsed.skills || parsed.skills.length === 0) {
    issues.push('No skills listed');
  }

  return { isValid: issues.length === 0, issues };
}

module.exports = {
  parseResumeStructure,
  calculateExperienceYears,
  extractSkills,
  detectSeniorityLevel,
  detectFocusArea,
  validateParsedData,
};
