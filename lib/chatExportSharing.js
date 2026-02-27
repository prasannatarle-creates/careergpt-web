/**
 * Chat Export & Sharing Module
 * Phase 5: Export conversations and create shareable links
 * 
 * Features:
 * 1. Export chat sessions to Markdown format
 * 2. Export chat sessions to PDF format
 * 3. Create shareable links with unique codes
 * 4. Password protection for shares
 * 5. Read-only access for shared conversations
 * 6. Expiration dates on shared links
 * 7. Share analytics (view counts, last accessed)
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Convert chat session to Markdown format
 * @param {object} session - Chat session object
 * @returns {string} Markdown formatted conversation
 */
function convertToMarkdown(session) {
  try {
    if (!session || !session.messages) {
      return '# Chat Session\n\nNo messages found.';
    }

    let markdown = '';

    // Header
    markdown += `# ${session.title || 'Career Chat Session'}\n\n`;
    markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n`;
    markdown += `**Duration:** ${Math.round((new Date(session.updatedAt) - new Date(session.createdAt)) / 60000)} minutes\n`;
    markdown += `**Messages:** ${session.messages.length}\n\n`;
    markdown += `---\n\n`;

    // Messages
    session.messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? '👤 You' : '🤖 Assistant';
      markdown += `## ${role}\n\n`;
      
      if (msg.structured) {
        // Structured response (JSON)
        markdown += '```json\n';
        markdown += JSON.stringify(JSON.parse(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)), null, 2);
        markdown += '\n```\n\n';
      } else {
        // Regular text response
        markdown += `${msg.content}\n\n`;
      }

      // Model attribution for assistant messages
      if (msg.role === 'assistant' && msg.models) {
        markdown += `*Models: ${msg.models.join(', ')}*\n\n`;
      }

      markdown += '---\n\n';
    });

    // Footer
    markdown += `\n## Summary\n\n`;
    markdown += `- **Total Messages:** ${session.messages.length}\n`;
    markdown += `- **Session Type:** ${session.type || 'career-chat'}\n`;
    if (session.models) {
      markdown += `- **Models Used:** ${Array.isArray(session.models) ? session.models.join(', ') : session.models}\n`;
    }
    markdown += `- **Export Date:** ${new Date().toLocaleString()}\n`;

    return markdown;
  } catch (error) {
    console.error('Markdown conversion error:', error.message);
    return `# Chat Export Error\n\nFailed to convert session: ${error.message}`;
  }
}

/**
 * Convert chat session to PDF-friendly HTML
 * @param {object} session - Chat session object
 * @returns {string} HTML formatted conversation
 */
function convertToHTML(session) {
  try {
    if (!session || !session.messages) {
      return '<html><body><h1>Chat Session</h1><p>No messages found.</p></body></html>';
    }

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title || 'Career Chat Session'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    header {
      border-bottom: 3px solid #3b82f6;
      margin-bottom: 30px;
      padding-bottom: 20px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #1f2937;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 14px;
      color: #6b7280;
    }
    .message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 8px;
    }
    .user-message {
      background-color: #dbeafe;
      border-left: 4px solid #3b82f6;
    }
    .assistant-message {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
    }
    .message-role {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .message-content {
      margin-bottom: 8px;
    }
    .message-models {
      font-size: 12px;
      color: #6b7280;
      font-style: italic;
    }
    pre {
      background-color: #f3f4f6;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 12px;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <header>
    <h1>${session.title || 'Career Chat Session'}</h1>
    <div class="meta">
      <div><strong>Created:</strong> ${new Date(session.createdAt).toLocaleString()}</div>
      <div><strong>Duration:</strong> ${Math.round((new Date(session.updatedAt) - new Date(session.createdAt)) / 60000)} minutes</div>
      <div><strong>Messages:</strong> ${session.messages.length}</div>
      <div><strong>Session Type:</strong> ${session.type || 'career-chat'}</div>
    </div>
  </header>

  <main>
`;

    // Messages
    session.messages.forEach((msg, idx) => {
      const isUser = msg.role === 'user';
      const messageClass = isUser ? 'user-message' : 'assistant-message';
      const roleIcon = isUser ? '👤' : '🤖';
      const roleName = isUser ? 'You' : 'Assistant';

      html += `
    <div class="message ${messageClass}">
      <div class="message-role">${roleIcon} ${roleName}</div>
      <div class="message-content">
`;

      if (msg.structured) {
        // Structured response
        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        html += `<pre>${JSON.stringify(content, null, 2)}</pre>`;
      } else {
        // Regular text
        html += `<p>${msg.content.replace(/\n/g, '<br>')}</p>`;
      }

      html += `
      </div>
`;

      if (msg.role === 'assistant' && msg.models) {
        html += `<div class="message-models">Models: ${msg.models.join(', ')}</div>`;
      }

      html += `
    </div>
`;
    });

    html += `
  </main>

  <footer>
    <p>Downloaded on ${new Date().toLocaleString()} | Total Messages: ${session.messages.length}</p>
  </footer>
</body>
</html>
`;

    return html;
  } catch (error) {
    console.error('HTML conversion error:', error.message);
    return `<html><body><h1>Export Error</h1><p>Failed to convert: ${error.message}</p></body></html>`;
  }
}

/**
 * Generate a shareable link for a chat session
 * @param {object} db - Database connection
 * @param {string} sessionId - Chat session ID
 * @param {object} options - Share options
 * @returns {Promise<object>} Share link details
 */
async function createShareLink(db, sessionId, options = {}) {
  try {
    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const shareCode = uuidv4().substring(0, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options.expirationDays || 30)); // Default 30 days

    const shareLink = {
      shareCode,
      sessionId,
      userId: session.userId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      password: options.password || null,
      passwordProtected: !!options.password,
      readOnly: options.readOnly !== false, // Default to read-only
      allowComments: options.allowComments || false,
      viewCount: 0,
      lastAccessedAt: null,
      accessLog: [],
    };

    await db.collection('shared_chats').insertOne(shareLink);

    return {
      success: true,
      shareCode,
      shareUrl: `${process.env.APP_URL || 'http://localhost:3000'}/shared-chat/${shareCode}`,
      expiresAt,
      passwordProtected: shareLink.passwordProtected,
      message: `Share link created. Link expires on ${expiresAt.toLocaleDateString()}`,
    };
  } catch (error) {
    console.error('Create share link error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get shared chat session (verify access)
 * @param {object} db - Database connection
 * @param {string} shareCode - Share code
 * @param {string} password - Optional password (if protected)
 * @param {string} accessorIp - IP address of accessor for logging
 * @returns {Promise<object>} Shared session data or error
 */
async function getSharedChat(db, shareCode, password = null, accessorIp = '127.0.0.1') {
  try {
    const shareRecord = await db.collection('shared_chats').findOne({ shareCode });
    if (!shareRecord) {
      return { success: false, error: 'Share link not found', status: 404 };
    }

    // Check if revoked
    if (shareRecord.isRevoked) {
      return { success: false, error: 'Share link has been revoked', status: 410 };
    }

    // Check expiration
    if (new Date(shareRecord.expiresAt) < new Date()) {
      return { success: false, error: 'Share link has expired', status: 410 };
    }

    // Check password if protected
    if (shareRecord.passwordProtected) {
      if (!password) {
        return { success: false, error: 'Password required', status: 403, passwordRequired: true };
      }
      // Simple password check (in production, should hash)
      if (password !== shareRecord.password) {
        return { success: false, error: 'Invalid password', status: 403 };
      }
    }

    // Get the session
    const session = await db.collection('sessions').findOne({ id: shareRecord.sessionId });
    if (!session) {
      return { success: false, error: 'Session not found', status: 404 };
    }

    // Update access log
    await db.collection('shared_chats').updateOne(
      { shareCode },
      {
        $set: {
          lastAccessedAt: new Date().toISOString(),
        },
        $inc: {
          viewCount: 1,
        },
        $push: {
          accessLog: {
            timestamp: new Date().toISOString(),
            ipAddress: accessorIp,
          },
        },
      }
    );

    return {
      success: true,
      session: session,
      shareInfo: {
        shareCode,
        createdAt: shareRecord.createdAt,
        expiresAt: shareRecord.expiresAt,
        viewCount: shareRecord.viewCount + 1,
      },
    };
  } catch (error) {
    console.error('Get shared chat error:', error.message);
    return { success: false, error: error.message, status: 500 };
  }
}

/**
 * Revoke a share link
 * @param {object} db - Database connection
 * @param {string} shareCode - Share code to revoke
 * @param {string} userId - User ID (for verification)
 * @returns {Promise<object>} Revocation result
 */
async function revokeShareLink(db, shareCode, userId) {
  try {
    const shareRecord = await db.collection('shared_chats').findOne({ shareCode });
    if (!shareRecord) {
      return { success: false, error: 'Share link not found' };
    }

    // Verify ownership
    if (shareRecord.userId !== userId) {
      return { success: false, error: 'Not authorized to revoke this share' };
    }

    await db.collection('shared_chats').updateOne(
      { shareCode },
      { $set: { isRevoked: true, revokedAt: new Date().toISOString() } }
    );

    return {
      success: true,
      message: 'Share link revoked successfully',
      shareCode,
    };
  } catch (error) {
    console.error('Revoke share link error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get list of share links for a user
 * @param {object} db - Database connection
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of share links
 */
async function getUserShareLinks(db, userId) {
  try {
    const shares = await db.collection('shared_chats')
      .find({ userId, isRevoked: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return shares.map(share => ({
      shareCode: share.shareCode,
      shareUrl: `${process.env.APP_URL || 'http://localhost:3000'}/shared-chat/${share.shareCode}`,
      sessionId: share.sessionId,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      isExpired: new Date(share.expiresAt) < new Date(),
      viewCount: share.viewCount,
      lastAccessedAt: share.lastAccessedAt,
    }));
  } catch (error) {
    console.error('Get user shares error:', error.message);
    return [];
  }
}

/**
 * Export session as Markdown
 * @param {object} db - Database connection
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID (for verification)
 * @returns {Promise<object>} Markdown content and metadata
 */
async function exportAsMarkdown(db, sessionId, userId) {
  try {
    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Verify ownership
    if (session.userId !== userId) {
      return { success: false, error: 'Not authorized to export this session' };
    }

    const markdown = convertToMarkdown(session);
    const filename = `chat-export-${new Date().toISOString().split('T')[0]}.md`;

    return {
      success: true,
      content: markdown,
      filename,
      contentType: 'text/markdown',
      size: Buffer.byteLength(markdown, 'utf8'),
    };
  } catch (error) {
    console.error('Export markdown error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Export session as HTML (PDF-ready)
 * @param {object} db - Database connection
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID (for verification)
 * @returns {Promise<object>} HTML content and metadata
 */
async function exportAsHTML(db, sessionId, userId) {
  try {
    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Verify ownership
    if (session.userId !== userId) {
      return { success: false, error: 'Not authorized to export this session' };
    }

    const html = convertToHTML(session);
    const filename = `chat-export-${new Date().toISOString().split('T')[0]}.html`;

    return {
      success: true,
      content: html,
      filename,
      contentType: 'text/html',
      size: Buffer.byteLength(html, 'utf8'),
    };
  } catch (error) {
    console.error('Export HTML error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  convertToMarkdown,
  convertToHTML,
  createShareLink,
  getSharedChat,
  revokeShareLink,
  getUserShareLinks,
  exportAsMarkdown,
  exportAsHTML,
};
