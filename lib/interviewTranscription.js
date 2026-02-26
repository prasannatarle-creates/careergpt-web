// Interview Transcription & Report Module
// Record, transcribe, and generate interview performance reports
// Uses OpenAI Whisper API for transcription

async function transcribeInterviewAudio(audioBuffer, sessionId, callSingleModel) {
  // Transcribe audio from interview using OpenAI Whisper API
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { error: 'OpenAI API key not configured' };
    }

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), `interview-${sessionId}.webm`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('timestamp_granularities', 'segment');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: true,
      transcription: result.text,
      segments: result.segments || [],
      language: result.language || 'en',
      duration: result.duration || 0
    };
  } catch (error) {
    console.error('Transcription error:', error.message);
    return { error: error.message };
  }
}

async function analyzeInterviewTranscription(transcription, sessionContext, callSingleModel) {
  // Analyze transcription for quality metrics
  try {
    const analysisPrompt = `Analyze this interview transcription for a ${sessionContext.role} position (${sessionContext.level} level).

Interview Transcription:
"${transcription}"

Evaluate ONLY valid JSON (no markdown):
{
  "speechQuality": {
    "clarity": 0.85,
    "pace": "moderate",
    "fillerWords": ["um", "like"],
    "fillerCount": 3,
    "pauseCount": 5,
    "confidenceLevel": "high"
  },
  "content": {
    "relevance": 0.9,
    "technicalAccuracy": 0.95,
    "completeness": 0.85,
    "examplesProvided": 3,
    "starMethod": true
  },
  "communication": {
    "clarity": 0.88,
    "engagement": 0.8,
    "professionalism": 0.92
  },
  "strengths": ["good technical depth", "clear examples"],
  "improvements": ["reduce filler words", "speak slower"],
  "overallScore": 0.88,
  "feedback": "Strong technical knowledge demonstrated with good use of examples. Work on reducing filler words like 'um' for higher confidence perception."
}`;

    const result = await callSingleModel(
      'You are an expert interview coach analyzing candidate performance.',
      analysisPrompt
    );

    if (!result) {
      return { error: 'Failed to analyze transcription' };
    }

    try {
      const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(jsonStr);
      return { success: true, analysis };
    } catch {
      return { success: true, analysis: { feedback: result, raw: true } };
    }
  } catch (error) {
    console.error('Analysis error:', error.message);
    return { error: error.message };
  }
}

async function generateInterviewReport(
  db,
  sessionId,
  transcription,
  analysis,
  sessionContext,
  callSingleModel
) {
  // Generate comprehensive PDF/JSON report
  try {
    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) return { error: 'Session not found' };

    // Calculate interview metrics
    const scores = session.scores || [];
    const avgScore = scores.length > 0 
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : 0;

    const speechQuality = analysis?.analysis?.speechQuality || {};
    const contentQuality = analysis?.analysis?.content || {};

    // Generate recommendations using LLM
    const recommendationPrompt = `Based on this interview performance, provide specific, actionable recommendations:

Interview Role: ${sessionContext.role}
Level: ${sessionContext.level}
Type: ${sessionContext.interviewType}
Questions Asked: ${session.questionCount || 5}
Average Score: ${avgScore}/10

Performance Metrics:
- Technical Accuracy: ${contentQuality.technicalAccuracy ? (contentQuality.technicalAccuracy * 100).toFixed(0) : 'N/A'}%
- Communication Clarity: ${analysis?.analysis?.communication?.clarity ? (analysis.analysis.communication.clarity * 100).toFixed(0) : 'N/A'}%
- Confidence Level: ${speechQuality.confidenceLevel || 'moderate'}
- Filler Words: ${speechQuality.fillerCount || 0}

Provide 3-5 specific ways to improve for next time.`;

    const recommendations = await callSingleModel(
      'You are a professional interview coach with deep expertise.',
      recommendationPrompt
    );

    // Compile report
    const report = {
      reportId: `report-${sessionId}-${Date.now()}`,
      sessionId,
      userId: session.userId,
      generatedAt: new Date().toISOString(),
      
      jobContext: {
        role: sessionContext.role,
        level: sessionContext.level,
        interviewType: sessionContext.interviewType
      },

      interviewMetrics: {
        totalQuestions: session.questionCount || 5,
        totalDuration: calculateDuration(session.messages),
        averageScore: parseFloat(avgScore),
        scores: scores
      },

      speechQuality: {
        clarity: speechQuality.clarity ? (speechQuality.clarity * 100).toFixed(0) : 'N/A',
        pace: speechQuality.pace || 'moderate',
        fillerWordsDetected: speechQuality.fillerWords || [],
        fillerWordCount: speechQuality.fillerCount || 0,
        pauseCount: speechQuality.pauseCount || 0,
        confidenceLevel: speechQuality.confidenceLevel || 'moderate'
      },

      contentQuality: {
        relevance: contentQuality.relevance ? (contentQuality.relevance * 100).toFixed(0) : 'N/A',
        technicalAccuracy: contentQuality.technicalAccuracy ? (contentQuality.technicalAccuracy * 100).toFixed(0) : 'N/A',
        completeness: contentQuality.completeness ? (contentQuality.completeness * 100).toFixed(0) : 'N/A',
        examplesProvided: contentQuality.examplesProvided || 0,
        usedSTARMethod: contentQuality.starMethod || false
      },

      communication: {
        clarity: analysis?.analysis?.communication?.clarity ? (analysis.analysis.communication.clarity * 100).toFixed(0) : 'N/A',
        engagement: analysis?.analysis?.communication?.engagement ? (analysis.analysis.communication.engagement * 100).toFixed(0) : 'N/A',
        professionalism: analysis?.analysis?.communication?.professionalism ? (analysis.analysis.communication.professionalism * 100).toFixed(0) : 'N/A'
      },

      summary: {
        strengths: analysis?.analysis?.strengths || [],
        improvements: analysis?.analysis?.improvements || [],
        overallFeedback: analysis?.analysis?.feedback || 'Interview completed'
      },

      recommendations: recommendations,

      transcription: {
        fullText: transcription,
        wordCount: transcription.split(/\s+/).length,
        characterCount: transcription.length
      },

      actionItems: generateActionItems(analysis?.analysis, recommendations)
    };

    // Store report in database
    await db.collection('interview_reports').insertOne(report);

    // Update session with report reference
    await db.collection('sessions').updateOne(
      { id: sessionId },
      { $set: { reportId: report.reportId, reportGeneratedAt: new Date().toISOString() } }
    );

    return { success: true, report };
  } catch (error) {
    console.error('Report generation error:', error.message);
    return { error: error.message };
  }
}

function calculateDuration(messages) {
  // Rough estimate from message timestamps
  if (!messages || messages.length < 2) return 0;
  
  const first = new Date(messages[0].timestamp);
  const last = new Date(messages[messages.length - 1].timestamp);
  
  return Math.round((last - first) / 1000); // seconds
}

function generateActionItems(analysis, recommendations) {
  const items = [];

  if (analysis?.speechQuality?.fillerCount > 5) {
    items.push({
      priority: 'high',
      category: 'speech',
      action: 'Reduce filler words (um, like, uh)',
      tip: 'Practice pausing instead of filling silence with words'
    });
  }

  if (analysis?.speechQuality?.pauseCount > 10) {
    items.push({
      priority: 'medium',
      category: 'pacing',
      action: 'Increase speaking confidence',
      tip: 'Practice speaking at natural pace without long pauses before answering'
    });
  }

  if (analysis?.content?.starMethod === false) {
    items.push({
      priority: 'high',
      category: 'content',
      action: 'Learn STAR interview method',
      tip: 'Structure: Situation → Task → Action → Result'
    });
  }

  if (analysis?.content?.technicalAccuracy < 0.8) {
    items.push({
      priority: 'high',
      category: 'technical',
      action: 'Deepen technical knowledge',
      tip: 'Review core concepts related to role requirements'
    });
  }

  return items;
}

async function exportInterviewReportPDF(report) {
  // Generate PDF version of report for download
  // Would use a library like pdfkit or html-pdf
  try {
    const pdfContent = `
Interview Performance Report
Generated: ${new Date(report.generatedAt).toLocaleDateString()}

Position: ${report.jobContext.role} (${report.jobContext.level})
Interview Type: ${report.jobContext.interviewType}

PERFORMANCE SUMMARY
==================
Overall Score: ${report.interviewMetrics.averageScore}/10
Questions: ${report.interviewMetrics.totalQuestions}
Duration: ${report.interviewMetrics.totalDuration}s

SPEECH QUALITY
==============
Clarity: ${report.speechQuality.clarity}%
Pace: ${report.speechQuality.pace}
Filler Words: ${report.speechQuality.fillerWordCount}
Confidence: ${report.speechQuality.confidenceLevel}

CONTENT QUALITY
===============
Technical Accuracy: ${report.contentQuality.technicalAccuracy}%
Relevance: ${report.contentQuality.relevance}%
Examples Provided: ${report.contentQuality.examplesProvided}
Used STAR Method: ${report.contentQuality.usedSTARMethod ? 'Yes' : 'No'}

COMMUNICATION
==============
Clarity: ${report.communication.clarity}%
Engagement: ${report.communication.engagement}%
Professionalism: ${report.communication.professionalism}%

STRENGTHS
=========
${report.summary.strengths.map(s => `• ${s}`).join('\n')}

AREAS FOR IMPROVEMENT
====================
${report.summary.improvements.map(i => `• ${i}`).join('\n')}

FEEDBACK
========
${report.summary.overallFeedback}

ACTION ITEMS
===========
${report.actionItems.map(item => `[${item.priority.toUpperCase()}] ${item.action}\nTip: ${item.tip}`).join('\n\n')}

TRANSCRIPT
==========
${report.transcription.fullText}
`;

    return {
      success: true,
      filename: `interview-report-${report.reportId}.pdf`,
      content: pdfContent,
      mimeType: 'application/pdf'
    };
  } catch (error) {
    console.error('PDF export error:', error.message);
    return { error: error.message };
  }
}

module.exports = {
  transcribeInterviewAudio,
  analyzeInterviewTranscription,
  generateInterviewReport,
  exportInterviewReportPDF,
  calculateDuration,
  generateActionItems
};
