/**
 * Career Learning Resources Module
 * Phase 3: Learning Path Integration with Coursera & Udemy
 * 
 * Features:
 * 1. Course discovery from Coursera & Udemy APIs
 * 2. Skill gap analysis from resume parsing
 * 3. Auto-suggest relevant courses & learning paths
 * 4. Track course progress & completion
 * 5. Skill-based learning recommendations
 */

/**
 * Search Coursera API for relevant courses
 * @param {string} skillOrRole - Skill or role to search for
 * @param {object} filters - Filter options (level, duration, price)
 * @returns {Promise<Array>} Array of course objects
 */
async function searchCourseraAPI(skillOrRole, filters = {}) {
  try {
    const apiKey = process.env.COURSERA_API_KEY;
    if (!apiKey) {
      console.warn('COURSERA_API_KEY not configured');
      return [];
    }

    // Coursera API endpoint for searching courses
    // Note: Actual implementation depends on Coursera API version
    const searchParams = new URLSearchParams({
      query: skillOrRole,
      limit: filters.limit || 10,
      offset: 0,
    });

    if (filters.level) searchParams.append('level', filters.level); // beginner, intermediate, advanced
    if (filters.language) searchParams.append('language', filters.language);

    const response = await fetch(
      `https://api.coursera.org/api/onDemandCourses.v1?${searchParams}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Coursera API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.elements || []).map(course => ({
      id: course.id,
      platform: 'Coursera',
      title: course.name,
      description: course.description || '',
      url: `https://www.coursera.org/learn/${course.slug}`,
      instructor: course.instructorIds ? `${course.instructorIds.length} instructors` : 'Unknown',
      rating: course.avgRating || 4.5,
      enrolledCount: course.enrolledCount || 0,
      duration: course.durationMonths || 'Self-paced',
      level: course.level || 'Intermediate',
      skills: course.specializations || [],
      price: 'Free or paid',
      certificate: true,
      language: course.language || 'English',
      updated: course.lastUpdated || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Coursera search error:', error.message);
    return [];
  }
}

/**
 * Search Udemy API for relevant courses
 * @param {string} skillOrRole - Skill or role to search for
 * @param {object} filters - Filter options (level, price, language)
 * @returns {Promise<Array>} Array of course objects
 */
async function searchUdemyAPI(skillOrRole, filters = {}) {
  try {
    const clientId = process.env.UDEMY_CLIENT_ID;
    if (!clientId) {
      console.warn('UDEMY_CLIENT_ID not configured');
      return [];
    }

    // Udemy API endpoint for searching courses
    const searchParams = new URLSearchParams({
      search: skillOrRole,
      page_size: filters.limit || 10,
      ordering: '-rating', // Order by highest rating
      fields: ['title', 'rating', 'headline', 'price', 'image_480x270', 'url', 'instructor', 'num_subscribers'].join(','),
    });

    if (filters.level) searchParams.append('subcategory__title', filters.level);
    if (filters.minRating) searchParams.append('rating__gte', filters.minRating);
    if (filters.language) searchParams.append('language', filters.language);

    const response = await fetch(
      `https://www.udemy.com/api-2.0/courses/?${searchParams}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${clientId}:`).toString('base64')}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Udemy API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.results || []).map(course => ({
      id: course.id,
      platform: 'Udemy',
      title: course.title,
      description: course.headline || '',
      url: `https://www.udemy.com${course.url}`,
      instructor: course.instructor?.[0]?.title || 'Multiple instructors',
      rating: course.rating || 4.0,
      enrolledCount: course.num_subscribers || 0,
      duration: 'Self-paced',
      level: course.level || 'All levels',
      skills: [], // Would need additional API call to get skills
      price: course.price ? `$${course.price}` : 'Free',
      certificate: true,
      language: 'English',
      image: course.image_480x270 || '',
      updated: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Udemy search error:', error.message);
    return [];
  }
}

/**
 * Get skill gap from resume analysis
 * Identifies what skills user needs to learn
 * @param {object} resumeStructured - Parsed resume data
 * @param {string} targetRole - Target job role
 * @returns {object} Skill gap analysis
 */
function analyzeSkillGaps(resumeStructured, targetRole) {
  if (!resumeStructured) {
    return {
      requiredSkills: [],
      currentSkills: [],
      skillGaps: [],
      prioritySkills: [],
    };
  }

  // Extract current skills from resume
  const currentSkills = resumeStructured.skills || [];
  
  // Common required skills by role (expanded list)
  const roleSkillMap = {
    'software engineer': ['JavaScript', 'Python', 'Java', 'System Design', 'Data Structures', 'SQL', 'Git', 'Testing'],
    'frontend developer': ['React', 'TypeScript', 'CSS', 'HTML5', 'Vue.js', 'Webpack', 'Performance Optimization'],
    'backend developer': ['Node.js', 'Python', 'Java', 'REST APIs', 'Databases', 'Docker', 'Kubernetes', 'System Design'],
    'data scientist': ['Python', 'SQL', 'Machine Learning', 'Statistics', 'TensorFlow', 'Pandas', 'Data Visualization'],
    'devops engineer': ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Terraform', 'Monitoring', 'Networking'],
    'product manager': ['Product Strategy', 'Analytics', 'User Research', 'Roadmapping', 'Stakeholder Management', 'Metrics'],
    'ux designer': ['UI Design', 'Figma', 'User Research', 'Wireframing', 'Prototyping', 'Accessibility', 'Design Systems'],
    'cloud architect': ['AWS', 'Azure', 'GCP', 'Networking', 'Security', 'Scalability', 'Cost Optimization'],
  };

  const lowerRole = (targetRole || 'software engineer').toLowerCase();
  const requiredSkills = roleSkillMap[lowerRole] || roleSkillMap['software engineer'];
  
  // Calculate skill gaps
  const currentSkillsLower = currentSkills.map(s => s.toLowerCase());
  const skillGaps = requiredSkills.filter(skill => 
    !currentSkillsLower.some(current => current.includes(skill.toLowerCase()))
  );

  // Prioritize critical skills (first 3)
  const prioritySkills = skillGaps.slice(0, 3);

  return {
    requiredSkills,
    currentSkills,
    skillGaps,
    prioritySkills,
    targetRole: lowerRole,
    completionPercentage: Math.round(((requiredSkills.length - skillGaps.length) / requiredSkills.length) * 100),
  };
}

/**
 * Get recommended courses based on skill gaps
 * Searches both Coursera and Udemy for relevant courses
 * @param {array} skillGaps - Array of skills to learn
 * @param {object} filters - Search filters
 * @returns {Promise<object>} Recommended courses grouped by skill
 */
async function getRecommendedCourses(skillGaps, filters = {}) {
  try {
    if (!skillGaps || skillGaps.length === 0) {
      return {
        recommendations: [],
        message: 'No skill gaps to address',
      };
    }

    // Search for courses for each skill gap
    const recommendations = {};
    
    for (const skill of skillGaps.slice(0, 5)) { // Limit to top 5 skills
      try {
        const [courseraResults, udemyResults] = await Promise.all([
          searchCourseraAPI(skill, { ...filters, limit: 5 }),
          searchUdemyAPI(skill, { ...filters, limit: 5 }),
        ]);

        // Combine and sort by rating
        const combinedCourses = [...courseraResults, ...udemyResults]
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 5); // Top 5 for this skill

        if (combinedCourses.length > 0) {
          recommendations[skill] = {
            skill,
            courses: combinedCourses,
            totalAvailable: combinedCourses.length,
            topCourse: combinedCourses[0],
          };
        }
      } catch (error) {
        console.warn(`Error fetching courses for ${skill}:`, error.message);
      }
    }

    return {
      recommendations,
      totalSkillsAddressed: Object.keys(recommendations).length,
      totalCoursesFound: Object.values(recommendations).reduce((sum, r) => sum + r.totalAvailable, 0),
    };
  } catch (error) {
    console.error('Recommendation error:', error.message);
    return {
      recommendations: {},
      error: error.message,
    };
  }
}

/**
 * Create a personalized learning path
 * Combines skill gaps with course recommendations
 * @param {object} resumeStructured - User's resume data
 * @param {string} targetRole - Target career role
 * @param {object} filters - Search filters
 * @returns {Promise<object>} Complete learning path
 */
async function generateLearningPath(resumeStructured, targetRole, filters = {}) {
  try {
    // Analyze skill gaps
    const skillGapAnalysis = analyzeSkillGaps(resumeStructured, targetRole);
    
    // Get recommended courses
    const courseRecommendations = await getRecommendedCourses(
      skillGapAnalysis.prioritySkills,
      filters
    );

    // Build learning path timeline
    const learningPath = {
      targetRole: skillGapAnalysis.targetRole,
      currentSkills: skillGapAnalysis.currentSkills,
      requiredSkills: skillGapAnalysis.requiredSkills,
      skillGaps: skillGapAnalysis.skillGaps,
      prioritySkills: skillGapAnalysis.prioritySkills,
      completionPercentage: skillGapAnalysis.completionPercentage,
      
      // Timeline phases (estimated durations)
      timeline: {
        phase1: {
          duration: '2-4 weeks',
          skills: skillGapAnalysis.prioritySkills.slice(0, 1),
          focus: 'Foundation building',
          courses: courseRecommendations.recommendations[skillGapAnalysis.prioritySkills[0]]?.courses.slice(0, 2) || [],
        },
        phase2: {
          duration: '4-8 weeks',
          skills: skillGapAnalysis.prioritySkills.slice(1, 2),
          focus: 'Core competency',
          courses: courseRecommendations.recommendations[skillGapAnalysis.prioritySkills[1]]?.courses.slice(0, 2) || [],
        },
        phase3: {
          duration: '8-12 weeks',
          skills: skillGapAnalysis.prioritySkills.slice(2, 3),
          focus: 'Advanced topics',
          courses: courseRecommendations.recommendations[skillGapAnalysis.prioritySkills[2]]?.courses.slice(0, 2) || [],
        },
      },
      
      // Cost estimation
      estimatedCost: {
        courseraSpecializations: 39 * skillGapAnalysis.prioritySkills.length, // ~$39 each
        udemyCoursesBundle: 10 * skillGapAnalysis.prioritySkills.length, // ~$10 on sale
        totalRange: `$${skillGapAnalysis.prioritySkills.length * 10}-$${skillGapAnalysis.prioritySkills.length * 39}`,
      },

      // Time investment (hours)
      estimatedHours: {
        phase1: 20,
        phase2: 40,
        phase3: 40,
        projects: 20,
        total: 120,
      },

      // Project suggestions for practice
      projects: [
        {
          title: `Build a ${skillGapAnalysis.targetRole} project`,
          description: 'Apply learned skills in a real-world project',
          difficulty: 'Intermediate',
          timeInvest: '20 hours',
          portfolioValue: 'High',
        },
        {
          title: `Contribute to open source in ${skillGapAnalysis.prioritySkills[0]}`,
          description: 'Real-world experience with industry-standard tools',
          difficulty: 'Advanced',
          timeInvest: '10-20 hours',
          portfolioValue: 'Very High',
        },
      ],

      // Success metrics
      metrics: {
        coursesRequired: skillGapAnalysis.prioritySkills.length,
        projectsRequired: 2,
        estimatedDuration: '12-16 weeks',
        careerImpact: {
          salaryIncrease: '15-25%',
          promotionReadiness: 'High',
          jobOpportunitiesIncrease: '40-60%',
        },
      },
    };

    return learningPath;
  } catch (error) {
    console.error('Learning path generation error:', error.message);
    return {
      error: error.message,
      targetRole,
    };
  }
}

/**
 * Track user's course progress
 * @param {object} db - Database connection
 * @param {string} userId - User ID
 * @param {string} courseId - Course ID
 * @param {string} platform - Course platform (Coursera/Udemy)
 * @param {number} progressPercentage - Completion percentage (0-100)
 * @returns {Promise<object>} Progress tracking result
 */
async function trackCourseProgress(db, userId, courseId, platform, progressPercentage) {
  try {
    const now = new Date().toISOString();
    
    // Find or create course progress record
    const existing = await db.collection('course_progress').findOne({
      userId,
      courseId,
      platform,
    });

    if (existing) {
      // Update progress
      await db.collection('course_progress').updateOne(
        { userId, courseId, platform },
        {
          $set: {
            progressPercentage,
            lastUpdated: now,
            updatedAt: now,
          },
          $inc: { updateCount: 1 },
        }
      );

      return {
        success: true,
        message: 'Progress updated',
        progressive: progressPercentage > existing.progressPercentage,
      };
    } else {
      // Create new progress record
      const progressRecord = {
        userId,
        courseId,
        platform,
        progressPercentage,
        status: progressPercentage === 100 ? 'completed' : 'in_progress',
        startedAt: now,
        completedAt: progressPercentage === 100 ? now : null,
        updateCount: 1,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('course_progress').insertOne(progressRecord);

      return {
        success: true,
        message: 'Progress tracked',
        progressive: true,
      };
    }
  } catch (error) {
    console.error('Track progress error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get user's learning progress summary
 * @param {object} db - Database connection
 * @param {string} userId - User ID
 * @returns {Promise<object>} Learning progress summary
 */
async function getLearningProgress(db, userId) {
  try {
    const progressRecords = await db.collection('course_progress')
      .find({ userId })
      .toArray();

    const completed = progressRecords.filter(p => p.progressPercentage === 100);
    const inProgress = progressRecords.filter(p => p.progressPercentage < 100 && p.progressPercentage > 0);
    const notStarted = progressRecords.filter(p => p.progressPercentage === 0);

    const totalHoursLearned = completed.length * 20 + 
                             inProgress.reduce((sum, p) => sum + (p.progressPercentage / 100) * 20, 0);

    return {
      success: true,
      summary: {
        totalCourses: progressRecords.length,
        completedCourses: completed.length,
        inProgressCourses: inProgress.length,
        notStartedCourses: notStarted.length,
        completionPercentage: progressRecords.length > 0 
          ? Math.round((completed.length / progressRecords.length) * 100)
          : 0,
        estimatedHoursLearned: Math.round(totalHoursLearned),
      },
      completed: completed.slice(0, 10),
      inProgress: inProgress.slice(0, 10),
    };
  } catch (error) {
    console.error('Get progress error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  searchCourseraAPI,
  searchUdemyAPI,
  analyzeSkillGaps,
  getRecommendedCourses,
  generateLearningPath,
  trackCourseProgress,
  getLearningProgress,
};
