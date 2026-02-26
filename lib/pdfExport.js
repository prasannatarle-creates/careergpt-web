/**
 * PDF Export Module  
 * Converts chats, resumes, and reports to PDF format
 * Handles formatting, styling, and document generation
 */

class PDFGenerator {
  constructor(title = 'CareerGPT Document', author = 'CareerGPT') {
    this.title = title;
    this.author = author;
    this.pages = [];
    this.metadata = {
      createdDate: new Date(),
      subject: 'Career Development Document'
    };
  }

  // Generate PDF header
  generateHeader() {
    return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj`;
  }

  // Generate PDF content stream for text
  generateContentStream(content) {
    // Escape special characters
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    return `BT
/F1 12 Tf
100 700 Td
(${escaped}) Tj
ET`;
  }

  // Convert chat to PDF
  async chatToPDF(conversation) {
    const lines = [
      `%PDF-1.4`,
      `1 0 obj`,
      `<< /Type /Catalog /Pages 2 0 R >>`,
      `endobj`,
      ``,
      `2 0 obj`,
      `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
      `endobj`,
      ``,
      `3 0 obj`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
      `endobj`,
      ``,
      `4 0 obj`,
      `<< /Length 500 >>`,
      `stream`
    ];

    // Add title
    lines.push(`BT /F1 24 Tf 50 750 Td (${this.escapeText(conversation.title || 'Conversation')}) Tj ET`);

    // Add metadata
    const metadata = conversation.metadata || {};
    lines.push(`BT /F1 10 Tf 50 720 Td (${this.escapeText(`Created: ${metadata.createdAt || 'N/A'}`)}) Tj ET`);
    lines.push(`BT /F1 10 Tf 50 705 Td (${this.escapeText(`Model: ${metadata.model || 'Unknown'}`)}) Tj ET`);
    lines.push(`BT /F1 10 Tf 50 690 Td (${this.escapeText(`Messages: ${conversation.messages?.length || 0}`)}) Tj ET`);

    lines.push('endstream');
    lines.push('endobj');

    // Add messages
    if (conversation.messages && conversation.messages.length > 0) {
      let yPosition = 670;
      const messages = conversation.messages.slice(0, 20); // Limit to 20 messages per page

      messages.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : 'Assistant';
        const prefix = `${role}: ${msg.content?.substring(0, 60) || ''}...`;

        lines.push(`BT /F1 11 Tf 50 ${yPosition} Td (${this.escapeText(prefix)}) Tj ET`);
        yPosition -= 15;

        if (yPosition < 50) {
          // New page needed
          // This is simplified - real implementation would handle multiple pages
        }
      });
    }

    lines.push('');
    lines.push('xref');
    lines.push('trailer');
    lines.push('<< /Size 6 /Root 1 0 R >>');
    lines.push('%%EOF');

    return lines.join('\n');
  }

  // Convert resume to PDF
  async resumeToPDF(resume) {
    const lines = [
      `%PDF-1.4`,
      `1 0 obj`,
      `<< /Type /Catalog /Pages 2 0 R >>`,
      `endobj`,
      ``,
      `2 0 obj`,
      `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
      `endobj`,
      ``,
      `3 0 obj`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
      `endobj`,
      ``,
      `4 0 obj`,
      `<< /Length 1000 >>`,
      `stream`
    ];

    // Add resume header
    lines.push(`BT /F1 24 Tf 50 750 Td (${this.escapeText(resume.name || 'Resume')}) Tj ET`);

    // Add contact info
    if (resume.email) {
      lines.push(`BT /F1 11 Tf 50 720 Td (Email: ${this.escapeText(resume.email)}) Tj ET`);
    }
    if (resume.phone) {
      lines.push(`BT /F1 11 Tf 50 705 Td (Phone: ${this.escapeText(resume.phone)}) Tj ET`);
    }

    let yPos = 680;

    // Add professional summary
    if (resume.summary) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Professional Summary) Tj ET`);
      yPos -= 20;
      lines.push(`BT /F1 11 Tf 50 ${yPos} Td (${this.escapeText(resume.summary.substring(0, 80))}) Tj ET`);
      yPos -= 30;
    }

    // Add experience
    if (resume.experience && resume.experience.length > 0) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Experience) Tj ET`);
      yPos -= 20;

      resume.experience.slice(0, 3).forEach(exp => {
        lines.push(`BT /F1 12 Tf 50 ${yPos} Td (${this.escapeText(exp.title || '')}) Tj ET`);
        yPos -= 15;
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (${this.escapeText(exp.company || '')}) Tj ET`);
        yPos -= 15;
      });

      yPos -= 10;
    }

    // Add skills
    if (resume.skills && resume.skills.length > 0) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Skills) Tj ET`);
      yPos -= 20;
      const skillsText = resume.skills.slice(0, 10).join(', ');
      lines.push(`BT /F1 11 Tf 50 ${yPos} Td (${this.escapeText(skillsText.substring(0, 80))}) Tj ET`);
    }

    lines.push('endstream');
    lines.push('endobj');
    lines.push('');
    lines.push('xref');
    lines.push('trailer');
    lines.push('<< /Size 6 /Root 1 0 R >>');
    lines.push('%%EOF');

    return lines.join('\n');
  }

  // Convert interview report to PDF
  async interviewReportToPDF(report) {
    const lines = [
      `%PDF-1.4`,
      `1 0 obj`,
      `<< /Type /Catalog /Pages 2 0 R >>`,
      `endobj`,
      ``,
      `2 0 obj`,
      `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
      `endobj`,
      ``,
      `3 0 obj`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
      `endobj`,
      ``,
      `4 0 obj`,
      `<< /Length 1500 >>`,
      `stream`
    ];

    // Title
    lines.push(`BT /F1 24 Tf 50 750 Td (Interview Report) Tj ET`);
    lines.push(`BT /F1 12 Tf 50 720 Td (${this.escapeText(report.position || 'Technical Interview')}) Tj ET`);

    let yPos = 690;

    // Summary
    if (report.summary) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Summary) Tj ET`);
      yPos -= 20;
      lines.push(`BT /F1 11 Tf 50 ${yPos} Td (${this.escapeText(report.summary.substring(0, 100))}) Tj ET`);
      yPos -= 30;
    }

    // Performance Metrics
    if (report.metrics) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Performance Metrics) Tj ET`);
      yPos -= 20;

      if (report.metrics.score !== undefined) {
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (Overall Score: ${report.metrics.score}%) Tj ET`);
        yPos -= 15;
      }
      if (report.metrics.clarity !== undefined) {
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (Communication Clarity: ${report.metrics.clarity}%) Tj ET`);
        yPos -= 15;
      }
      if (report.metrics.technicalDepth !== undefined) {
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (Technical Depth: ${report.metrics.technicalDepth}%) Tj ET`);
        yPos -= 15;
      }

      yPos -= 15;
    }

    // Q&A Summary
    if (report.qa && report.qa.length > 0) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Q&A Summary) Tj ET`);
      yPos -= 20;

      report.qa.slice(0, 5).forEach(qa => {
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (Q: ${this.escapeText(qa.question?.substring(0, 50) || '')}) Tj ET`);
        yPos -= 15;
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (A: ${this.escapeText(qa.answer?.substring(0, 50) || '')}) Tj ET`);
        yPos -= 20;
      });
    }

    // Recommendations
    if (report.recommendations) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Recommendations) Tj ET`);
      yPos -= 20;
      lines.push(`BT /F1 11 Tf 50 ${yPos} Td (${this.escapeText(report.recommendations.substring(0, 80))}) Tj ET`);
    }

    lines.push('endstream');
    lines.push('endobj');
    lines.push('');
    lines.push('xref');
    lines.push('trailer');
    lines.push('<< /Size 6 /Root 1 0 R >>');
    lines.push('%%EOF');

    return lines.join('\n');
  }

  // Convert analytics report to PDF
  async analyticsReportToPDF(analytics) {
    const lines = [
      `%PDF-1.4`,
      `1 0 obj`,
      `<< /Type /Catalog /Pages 2 0 R >>`,
      `endobj`,
      ``,
      `2 0 obj`,
      `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
      `endobj`,
      ``,
      `3 0 obj`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
      `endobj`,
      ``,
      `4 0 obj`,
      `<< /Length 800 >>`,
      `stream`
    ];

    // Title
    lines.push(`BT /F1 24 Tf 50 750 Td (Analytics Report) Tj ET`);
    lines.push(`BT /F1 10 Tf 50 730 Td (Generated: ${this.escapeText(new Date().toDateString())}) Tj ET`);

    let yPos = 700;

    // Key Metrics
    if (analytics.dau !== undefined) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Key Metrics) Tj ET`);
      yPos -= 25;
      lines.push(`BT /F1 12 Tf 50 ${yPos} Td (Daily Active Users: ${analytics.dau}) Tj ET`);
      yPos -= 20;
    }

    if (analytics.wau !== undefined) {
      lines.push(`BT /F1 12 Tf 50 ${yPos} Td (Weekly Active Users: ${analytics.wau}) Tj ET`);
      yPos -= 20;
    }

    if (analytics.mau !== undefined) {
      lines.push(`BT /F1 12 Tf 50 ${yPos} Td (Monthly Active Users: ${analytics.mau}) Tj ET`);
      yPos -= 25;
    }

    // Engagement
    if (analytics.engagement) {
      lines.push(`BT /F1 14 Tf 50 ${yPos} Td (Engagement) Tj ET`);
      yPos -= 20;
      if (analytics.engagement.avgSessionDuration) {
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (Avg Session: ${analytics.engagement.avgSessionDuration} min) Tj ET`);
        yPos -= 15;
      }
      if (analytics.engagement.conversionRate) {
        lines.push(`BT /F1 11 Tf 50 ${yPos} Td (Conversion Rate: ${analytics.engagement.conversionRate}%) Tj ET`);
        yPos -= 15;
      }
    }

    lines.push('endstream');
    lines.push('endobj');
    lines.push('');
    lines.push('xref');
    lines.push('trailer');
    lines.push('<< /Size 6 /Root 1 0 R >>');
    lines.push('%%EOF');

    return lines.join('\n');
  }

  // Escape text for PDF
  escapeText(text) {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  // Generate generic text document as PDF
  async textToPDF(title, content) {
    const lines = [
      `%PDF-1.4`,
      `1 0 obj`,
      `<< /Type /Catalog /Pages 2 0 R >>`,
      `endobj`,
      ``,
      `2 0 obj`,
      `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
      `endobj`,
      ``,
      `3 0 obj`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
      `endobj`,
      ``,
      `4 0 obj`,
      `<< /Length 500 >>`,
      `stream`,
      `BT /F1 20 Tf 50 750 Td (${this.escapeText(title)}) Tj ET`,
      `BT /F1 11 Tf 50 700 Td (${this.escapeText(content?.substring(0, 200) || '')}) Tj ET`,
      `endstream`,
      `endobj`,
      ``,
      `xref`,
      `trailer`,
      `<< /Size 5 /Root 1 0 R >>`,
      `%%EOF`
    ];

    return lines.join('\n');
  }
}

// Helper functions for PDF export

async function exportChatAsPDF(chat) {
  const generator = new PDFGenerator(`Chat: ${chat.title || 'Conversation'}`);
  return await generator.chatToPDF(chat);
}

async function exportResumeAsPDF(resume) {
  const generator = new PDFGenerator(`Resume: ${resume.name || 'MyResume'}`);
  return await generator.resumeToPDF(resume);
}

async function exportInterviewReportAsPDF(report) {
  const generator = new PDFGenerator('Interview Report');
  return await generator.interviewReportToPDF(report);
}

async function exportAnalyticsAsPDF(analytics) {
  const generator = new PDFGenerator('Analytics Report');
  return await generator.analyticsReportToPDF(analytics);
}

module.exports = {
  PDFGenerator,
  exportChatAsPDF,
  exportResumeAsPDF,
  exportInterviewReportAsPDF,
  exportAnalyticsAsPDF
};
