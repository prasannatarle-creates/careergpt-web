// Email Service - Development Mode (Console Log) + Production Ready (SendGrid/SMTP)
// For development: emails are logged to console
// For production: configure SMTP_HOST or SENDGRID_API_KEY in .env.local

async function sendEmail(to, subject, htmlContent, textContent) {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const SMTP_HOST = process.env.SMTP_HOST;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@careergpt.ai';

  // Development mode: Log to console
  if (NODE_ENV === 'development' && !SENDGRID_API_KEY && !SMTP_HOST) {
    console.log('📧 EMAIL (Development Mode)');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${textContent || htmlContent}`);
    console.log('---');
    return { success: true, mode: 'development' };
  }

  // SendGrid API
  if (SENDGRID_API_KEY) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: EMAIL_FROM },
          subject: subject,
          content: [
            { type: 'text/html', value: htmlContent },
            { type: 'text/plain', value: textContent || htmlContent.replace(/<[^>]*>/g, '') },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`SendGrid error: ${response.statusText}`);
      }
      console.log(`✓ Email sent to ${to} via SendGrid`);
      return { success: true, provider: 'sendgrid' };
    } catch (error) {
      console.error('SendGrid error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // SMTP (nodemailer alternative)
  if (SMTP_HOST) {
    try {
      // nodemailer is optional - install if you want SMTP support: npm install nodemailer
      let nodemailer;
      try {
        nodemailer = require('nodemailer');
      } catch (e) {
        console.warn('nodemailer not installed. For SMTP email support, run: npm install nodemailer');
        return { success: false, error: 'nodemailer not installed' };
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(`✓ Email sent to ${to} via SMTP`);
      return { success: true, provider: 'smtp' };
    } catch (error) {
      console.error('SMTP error:', error.message);
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'No email provider configured' };
}

// Email templates
const emailTemplates = {
  verifyEmail: (verificationLink) => ({
    subject: 'Verify Your CareerGPT Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Welcome to CareerGPT!</h2>
        <p>Click the button below to verify your email address and activate your career guidance account.</p>
        <a href="${verificationLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Or copy this link: <code>${verificationLink}</code>
        </p>
        <p style="color: #666; font-size: 12px;">
          This link expires in 24 hours. If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
    text: `
      Click the link to verify: ${verificationLink}
      This link expires in 24 hours.
    `,
  }),

  resetPassword: (resetLink) => ({
    subject: 'Reset Your CareerGPT Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Reset Your Password</h2>
        <p>Click the button below to reset your CareerGPT password.</p>
        <a href="${resetLink}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Or copy this link: <code>${resetLink}</code>
        </p>
        <p style="color: #666; font-size: 12px;">
          This link expires in 30 minutes. If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
    text: `
      Click the link to reset password: ${resetLink}
      This link expires in 30 minutes.
    `,
  }),

  welcomeEmail: (userName) => ({
    subject: 'Welcome to CareerGPT - Your AI Career Guide',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Welcome, ${userName}!</h2>
        <p>Your account is now active. You can now:</p>
        <ul>
          <li>💬 Chat with AI career advisors (GPT-4, Claude, Gemini)</li>
          <li>📄 Upload and analyze your resume for ATS optimization</li>
          <li>🎯 Generate personalized career paths</li>
          <li>🎤 Practice mock interviews with AI feedback</li>
          <li>💼 Find job matches tailored to your skills</li>
        </ul>
        <p style="margin-top: 30px;">
          <a href="https://careergpt.ai" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Start Your Career Journey
          </a>
        </p>
      </div>
    `,
    text: 'Welcome to CareerGPT! You can now start your AI-guided career journey.',
  }),
};

module.exports = { sendEmail, emailTemplates };
