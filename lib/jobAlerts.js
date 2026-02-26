/**
 * Job Alerts Module
 * Manages job match notifications and alert subscriptions
 * Sends email alerts when matching jobs are found
 */

const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('./email');

class JobAlert {
  constructor(userId, userEmail) {
    this.alertId = uuidv4();
    this.userId = userId;
    this.userEmail = userEmail;
    this.isActive = true;
    this.criteria = {
      skills: [],
      minimumSalary: 0,
      locations: [],
      experience: [],
      jobTypes: ['full-time'],
      seniorityLevels: []
    };
    this.frequency = 'daily'; // daily, weekly, immediately
    this.lastNotified = new Date();
    this.createdAt = new Date();
    this.matchedJobs = [];
    this.notificationCount = 0;
  }

  // Set alert criteria
  setCriteria(criteria) {
    this.criteria = { ...this.criteria, ...criteria };
  }

  // Check if job matches alert criteria
  matchesJob(job) {
    // Check skills
    if (this.criteria.skills.length > 0) {
      const hasSkill = this.criteria.skills.some(skill =>
        job.skills && job.skills.some(jobSkill =>
          jobSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
      if (!hasSkill) return false;
    }

    // Check salary
    if (this.criteria.minimumSalary > 0) {
      if (!job.salary || job.salary.min < this.criteria.minimumSalary) {
        return false;
      }
    }

    // Check locations
    if (this.criteria.locations.length > 0) {
      const locationMatch = this.criteria.locations.some(loc =>
        job.location && job.location.toLowerCase().includes(loc.toLowerCase())
      );
      if (!locationMatch && !job.remote) return false;
    }

    // Check job type
    if (this.criteria.jobTypes.length > 0) {
      if (!this.criteria.jobTypes.includes(job.jobType)) {
        return false;
      }
    }

    return true;
  }

  // Add matched job to alert
  addMatchedJob(job) {
    const matchedJob = {
      jobId: job.id || uuidv4(),
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      url: job.url,
      matchedAt: new Date(),
      relevanceScore: this.calculateRelevance(job)
    };
    this.matchedJobs.push(matchedJob);
    return matchedJob;
  }

  // Calculate relevance score
  calculateRelevance(job) {
    let score = 0;

    // Skills match (40 points max)
    if (job.skills && this.criteria.skills.length > 0) {
      const matchedSkills = job.skills.filter(skill =>
        this.criteria.skills.some(alertSkill =>
          skill.toLowerCase().includes(alertSkill.toLowerCase())
        )
      ).length;
      score += (matchedSkills / this.criteria.skills.length) * 40;
    }

    // Salary match (30 points max)
    if (job.salary && this.criteria.minimumSalary > 0) {
      const salaryMid = (job.salary.min + job.salary.max) / 2;
      if (salaryMid >= this.criteria.minimumSalary * 1.2) {
        score += 30;
      } else if (salaryMid >= this.criteria.minimumSalary) {
        score += 20;
      }
    }

    // Experience match (20 points max)
    if (job.experience && this.criteria.experience.length > 0) {
      if (this.criteria.experience.includes(job.experience)) {
        score += 20;
      }
    }

    // Location/Remote match (10 points max)
    if (job.location === this.criteria.locations[0] || job.remote) {
      score += 10;
    }

    return Math.round(score);
  }

  // Generate notification email
  generateEmailHTML(jobs = null) {
    const jobsToShow = jobs || this.matchedJobs.slice(0, 5);

    if (jobsToShow.length === 0) {
      return `
        <h2>Job Alert: No New Matches</h2>
        <p>No jobs matched your criteria this period.</p>
      `;
    }

    const jobsHTML = jobsToShow.map(job => `
      <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #4CAF50; background: #f9f9f9;">
        <h3 style="margin: 0 0 10px 0;">
          <a href="${job.url || '#'}" style="color: #2196F3; text-decoration: none;">
            ${job.title}
          </a>
        </h3>
        <p style="margin: 5px 0;"><strong>${job.company}</strong></p>
        <p style="margin: 5px 0; color: #666;">📍 ${job.location || 'Remote'}</p>
        ${job.salary ? `<p style="margin: 5px 0; color: #2ecc71;">💰 $${job.salary.min.toLocaleString()} - $${job.salary.max.toLocaleString()}</p>` : ''}
        <p style="margin: 5px 0;">Relevance: <strong>${job.relevanceScore || 0}%</strong></p>
      </div>
    `).join('');

    return `
      <h2>New Job Matches Found! 🎯</h2>
      <p>Hi there!</p>
      <p>We found <strong>${jobsToShow.length} Job${jobsToShow.length !== 1 ? 's' : ''}</strong> matching your criteria.</p>
      
      ${jobsHTML}
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      
      <p>
        <a href="http://localhost:3000/jobs" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View All Jobs
        </a>
      </p>
      
      <p style="color: #999; font-size: 12px;">
        You can manage your job alerts in your profile settings at any time.
      </p>
    `;
  }

  // Should send notification based on frequency
  shouldNotifyNow() {
    const now = new Date();
    const hoursSinceLastNotification = (now - this.lastNotified) / (1000 * 60 * 60);

    switch (this.frequency) {
      case 'immediately':
        return this.matchedJobs.length > 0;
      case 'daily':
        return hoursSinceLastNotification >= 24;
      case 'weekly':
        return hoursSinceLastNotification >= 168;
      default:
        return false;
    }
  }

  // Mark notification as sent
  markNotificationSent() {
    this.lastNotified = new Date();
    this.notificationCount++;
    this.matchedJobs = [];
  }
}

// Database persistence functions

async function createJobAlert(db, userId, userEmail, criteria, frequency = 'daily') {
  try {
    const alert = new JobAlert(userId, userEmail);
    alert.setCriteria(criteria);
    alert.frequency = frequency;

    const result = await db.collection('job_alerts').insertOne({
      alertId: alert.alertId,
      userId,
      userEmail,
      criteria: alert.criteria,
      frequency: alert.frequency,
      isActive: alert.isActive,
      createdAt: alert.createdAt,
      lastNotified: alert.lastNotified,
      notificationCount: 0
    });

    return {
      success: true,
      alertId: alert.alertId,
      message: 'Job alert created successfully'
    };
  } catch (error) {
    console.error('Error creating job alert:', error);
    return { success: false, error: error.message };
  }
}

async function getUserJobAlerts(db, userId) {
  try {
    const alerts = await db.collection('job_alerts').find({ userId }).toArray();
    return {
      success: true,
      alerts: alerts.map(alert => ({
        alertId: alert.alertId,
        criteria: alert.criteria,
        frequency: alert.frequency,
        isActive: alert.isActive,
        createdAt: alert.createdAt,
        notificationCount: alert.notificationCount
      }))
    };
  } catch (error) {
    console.error('Error fetching job alerts:', error);
    return { success: false, error: error.message };
  }
}

async function updateJobAlert(db, alertId, updates) {
  try {
    const result = await db.collection('job_alerts').updateOne(
      { alertId },
      { $set: updates }
    );

    return {
      success: result.modifiedCount > 0,
      message: 'Job alert updated successfully'
    };
  } catch (error) {
    console.error('Error updating job alert:', error);
    return { success: false, error: error.message };
  }
}

async function deleteJobAlert(db, alertId) {
  try {
    const result = await db.collection('job_alerts').deleteOne({ alertId });
    return {
      success: result.deletedCount > 0,
      message: 'Job alert deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting job alert:', error);
    return { success: false, error: error.message };
  }
}

async function sendJobAlertNotifications(db, jobs) {
  try {
    const alerts = await db.collection('job_alerts').find({ isActive: true }).toArray();
    let notificationsSent = 0;

    for (const alertData of alerts) {
      const alert = new JobAlert(alertData.userId, alertData.userEmail);
      alert.alertId = alertData.alertId;
      alert.frequency = alertData.frequency;
      alert.lastNotified = new DateTime(alertData.lastNotified);
      alert.criteria = alertData.criteria;

      // Find matching jobs
      const matchingJobs = jobs.filter(job => alert.matchesJob(job));

      if (matchingJobs.length > 0 && alert.shouldNotifyNow()) {
        // Add matched jobs to alert
        matchingJobs.forEach(job => alert.addMatchedJob(job));

        // Send notification email
        const emailHTML = alert.generateEmailHTML(matchingJobs);
        await sendEmail(
          alert.userEmail,
          'New Job Matches Found!',
          emailHTML,
          `Found ${matchingJobs.length} matching jobs for you`
        );

        // Update notification timestamp
        await updateJobAlert(db, alert.alertId, {
          lastNotified: new Date(),
          $inc: { notificationCount: 1 }
        });

        notificationsSent++;
      }
    }

    return {
      success: true,
      notificationsSent,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error sending job alert notifications:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  JobAlert,
  createJobAlert,
  getUserJobAlerts,
  updateJobAlert,
  deleteJobAlert,
  sendJobAlertNotifications
};
