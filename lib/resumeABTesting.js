// Resume A/B Testing Module
// Track resume performance: which versions lead to interviews/offers

async function logAnalytics(db, type, data = {}) {
  try {
    await db.collection('analytics').insertOne({
      type, ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (e) { /* non-critical */ }
}

async function createResumeVariant(db, userId, baseResumeId, changes) {
  // Create a variation of a resume
  try {
    const baseResume = await db.collection('resumes').findOne({ id: baseResumeId, userId });
    if (!baseResume) return { error: 'Base resume not found' };

    const variantId = `${baseResumeId}-v${Date.now()}`;
    const variant = {
      id: variantId,
      userId,
      baseResumeId,
      fileName: baseResume.fileName.replace('.pdf', `-variant.pdf`),
      fileSize: baseResume.fileSize,
      textContent: applyChanges(baseResume.textContent, changes),
      changes: changes, // Track what was changed
      analysis: null,
      metrics: {
        views: 0,
        clicks: 0,
        interviews: 0,
        offers: 0,
        applicationsSent: 0
      },
      createdAt: new Date().toISOString(),
      baseCreatedAt: baseResume.createdAt,
      variantLabel: changes.label || `Variant ${Date.now()}`
    };

    await db.collection('resumes').insertOne(variant);
    return { success: true, variantId, variant };
  } catch (error) {
    console.error('Create variant error:', error.message);
    return { error: error.message };
  }
}

function applyChanges(textContent, changes) {
  let modified = textContent;

  // Apply keyword replacements
  if (changes.keywordReplacements) {
    Object.entries(changes.keywordReplacements).forEach(([oldKeyword, newKeyword]) => {
      const regex = new RegExp(`\\b${oldKeyword}\\b`, 'gi');
      modified = modified.replace(regex, newKeyword);
    });
  }

  // Rewrite specific sections
  if (changes.rewriteSections) {
    Object.entries(changes.rewriteSections).forEach(([section, newText]) => {
      // Simple section replacement (would be more sophisticated in production)
      modified = modified.replace(section, newText);
    });
  }

  // Reorder sections
  if (changes.sectionOrder) {
    // This would require more sophisticated parsing
    // For now, just track the reordering intent
  }

  return modified;
}

async function trackResumeMetric(db, userId, resumeId, metricType, value = 1) {
  // Record user actions on resume variants
  // metricType: 'view', 'click', 'application', 'interview', 'offer'
  
  try {
    const resume = await db.collection('resumes').findOne({ id: resumeId, userId });
    if (!resume) return { error: 'Resume not found' };

    const metricMap = {
      'view': 'views',
      'click': 'clicks',
      'application': 'applicationsSent',
      'interview': 'interviews',
      'offer': 'offers'
    };

    const fieldName = metricMap[metricType];
    if (!fieldName) return { error: 'Unknown metric type' };

    // Update resume metrics
    await db.collection('resumes').updateOne(
      { id: resumeId },
      {
        $inc: { [`metrics.${fieldName}`]: value },
        $push: {
          metricHistory: {
            type: metricType,
            value,
            timestamp: new Date().toISOString(),
            userAgent: '' // Could track from request
          }
        }
      }
    );

    // Record in analytics
    await logAnalytics(db, `resume_${metricType}`, {
      userId,
      resumeId,
      baseResumeId: resume.baseResumeId || resumeId
    });

    return { success: true, metric: fieldName, value };
  } catch (error) {
    console.error('Track metric error:', error.message);
    return { error: error.message };
  }
}

async function getResumeComparison(db, userId, baseResumeId) {
  // Compare all variants of a resume
  try {
    const variants = await db.collection('resumes')
      .find({
        userId,
        $or: [
          { id: baseResumeId },
          { baseResumeId }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray();

    if (variants.length === 0) return { error: 'No resume variants found' };

    // Calculate performance metrics
    const comparison = variants.map(resume => {
      const metrics = resume.metrics || { views: 0, clicks: 0, interviews: 0, offers: 0, applicationsSent: 0 };
      
      return {
        resumeId: resume.id,
        label: resume.variantLabel || 'Original',
        createdAt: resume.createdAt,
        isBaseResume: resume.id === baseResumeId,
        atsScore: resume.analysis?.atsScore || 0,
        metrics: metrics,
        conversionRate: metrics.applicationsSent > 0 
          ? Math.round((metrics.interviews / metrics.applicationsSent) * 100)
          : 0,
        offerRate: metrics.interviews > 0
          ? Math.round((metrics.offers / metrics.interviews) * 100)
          : 0,
        changes: resume.changes || null
      };
    });

    // Sort by conversion rate
    comparison.sort((a, b) => b.conversionRate - a.conversionRate);

    return {
      success: true,
      baseResumeId,
      totalVariants: variants.length,
      comparison,
      bestPerformer: comparison[0],
      analysis: generateResumeComparison(comparison)
    };
  } catch (error) {
    console.error('Get comparison error:', error.message);
    return { error: error.message };
  }
}

function generateResumeComparison(comparison) {
  // AI-friendly summary for LLM analysis
  const summary = comparison.map(variant => ({
    label: variant.label,
    atsScore: variant.atsScore,
    views: variant.metrics.views,
    applications: variant.metrics.applicationsSent,
    interviews: variant.metrics.interviews,
    conversionRate: `${variant.conversionRate}%`,
    offers: variant.metrics.offers,
    changes: variant.changes?.label || 'None'
  }));

  return {
    totalVariants: comparison.length,
    variants: summary,
    recommendation: `Variant "${comparison[0].label}" is performing best with ${comparison[0].conversionRate}% conversion rate`,
    insights: generateInsights(comparison)
  };
}

function generateInsights(comparison) {
  const insights = [];

  // Find highest ATS score
  const bestATS = comparison.reduce((max, v) => v.atsScore > max.atsScore ? v : max);
  insights.push(`Highest ATS score (${bestATS.atsScore}): ${bestATS.label}`);

  // Find highest conversion rate
  const bestConversion = comparison.reduce((max, v) => v.conversionRate > max.conversionRate ? v : max);
  insights.push(`Best conversion rate (${bestConversion.conversionRate}%): ${bestConversion.label}`);

  // Calculate average metrics
  const avgMetrics = {
    views: Math.round(comparison.reduce((sum, v) => sum + v.metrics.views, 0) / comparison.length),
    applications: Math.round(comparison.reduce((sum, v) => sum + v.metrics.applicationsSent, 0) / comparison.length),
    interviews: Math.round(comparison.reduce((sum, v) => sum + v.metrics.interviews, 0) / comparison.length)
  };

  insights.push(`Average metrics: ${avgMetrics.views} views, ${avgMetrics.applications} applications, ${avgMetrics.interviews} interviews`);

  return insights;
}

async function recommendResumeOptimizations(db, userId, callSingleModel) {
  // Use LLM to suggest which resume variant to focus on
  try {
    const resumes = await db.collection('resumes')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    if (resumes.length < 2) {
      return { error: 'Need at least 2 resume variants for comparison' };
    }

    const comparisonData = resumes.map(r => ({
      id: r.id,
      atsScore: r.analysis?.atsScore || 0,
      views: r.metrics?.views || 0,
      interviews: r.metrics?.interviews || 0,
      apps: r.metrics?.applicationsSent || 0,
      skills: r.analysis?.keywords?.found || [],
      changes: r.changes?.label || 'original'
    }));

    const prompt = `Analyze these resume variant performance metrics and recommend optimizations:

${comparisonData.map((r, i) => `
Resume ${i + 1} (${r.changes}):
- ATS Score: ${r.atsScore}/100
- Views: ${r.views}
- Applications: ${r.apps}
- Interviews: ${r.interviews}
- Interview Rate: ${r.apps > 0 ? (r.interviews / r.apps * 100).toFixed(1) : 0}%
- Top Skills: ${r.skills.slice(0, 5).join(', ')}
`).join('\n')}

Which variant should the user focus on and why? What specific changes would improve performance?`;

    const recommendation = await callSingleModel(
      'You are a resume optimization expert.',
      prompt
    );

    return {
      success: true,
      recommendation,
      variants: comparisonData
    };
  } catch (error) {
    console.error('Recommendation error:', error.message);
    return { error: error.message };
  }
}

module.exports = {
  createResumeVariant,
  trackResumeMetric,
  getResumeComparison,
  generateResumeComparison,
  recommendResumeOptimizations
};
