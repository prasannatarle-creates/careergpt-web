/**
 * Chat Memory Management Module
 * Stores and retrieves chat conversation history with context
 * Enables multi-turn conversations with full context awareness
 */

const { v4: uuidv4 } = require('uuid');

class ChatMemory {
  constructor(userEmail) {
    this.userEmail = userEmail;
    this.conversationId = uuidv4();
    this.messages = [];
    this.metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      turnCount: 0,
      model: 'gpt-4.1',
      title: 'New Conversation'
    };
  }

  // Add a message to the conversation
  addMessage(role, content, metadata = {}) {
    const message = {
      id: uuidv4(),
      role, // 'user' or 'assistant'
      content,
      timestamp: new Date(),
      ...metadata
    };
    this.messages.push(message);
    this.metadata.updatedAt = new Date();
    this.metadata.turnCount++;
    return message;
  }

  // Get conversation history with proper context
  getHistoryForLLM(maxMessages = 20) {
    // Return last N messages to stay within token limits
    const recentMessages = this.messages.slice(-maxMessages);
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Get full conversation for display/export
  getFullHistory() {
    return {
      conversationId: this.conversationId,
      userEmail: this.userEmail,
      messages: this.messages,
      metadata: this.metadata
    };
  }

  // Search messages by keyword
  searchMessages(keyword) {
    return this.messages.filter(msg =>
      msg.content.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // Extract context summary from conversation
  getContextSummary(lastN = 5) {
    const recentMessages = this.messages.slice(-lastN);
    const summary = recentMessages
      .filter(m => m.role === 'user')
      .map(m => m.content.substring(0, 100))
      .join(' | ');
    return summary;
  }

  // Update conversation title based on first message
  generateTitle() {
    if (this.messages.length === 0) return 'New Conversation';
    const firstMessage = this.messages[0].content;
    const title = firstMessage.substring(0, 60).replace(/[^a-zA-Z0-9\s]/g, '');
    this.metadata.title = title || 'Untitled Conversation';
    return this.metadata.title;
  }

  // Export conversation to different formats
  exportToMarkdown() {
    let markdown = `# ${this.metadata.title}\n\n`;
    markdown += `*Conversation ID: ${this.conversationId}*\n`;
    markdown += `*Model: ${this.metadata.model}*\n`;
    markdown += `*Date: ${this.metadata.createdAt.toISOString()}*\n\n`;
    markdown += `---\n\n`;

    this.messages.forEach(msg => {
      const speaker = msg.role === 'user' ? '**User:**' : '**Assistant:**';
      markdown += `${speaker}\n${msg.content}\n\n`;
    });

    return markdown;
  }

  // Clear conversation
  clear() {
    this.messages = [];
    this.metadata.turnCount = 0;
    this.conversationId = uuidv4();
  }

  // Get memory statistics
  getStats() {
    const userMessages = this.messages.filter(m => m.role === 'user');
    const assistantMessages = this.messages.filter(m => m.role === 'assistant');

    const totalTokens = this.messages.reduce((sum, msg) => {
      // Rough estimation: 1 character ≈ 0.25 tokens
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);

    return {
      totalMessages: this.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      avgUserMessageLength: userMessages.length > 0
        ? userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length
        : 0,
      avgAssistantMessageLength: assistantMessages.length > 0
        ? assistantMessages.reduce((sum, m) => sum + m.content.length, 0) / assistantMessages.length
        : 0,
      estimatedTokens: totalTokens,
      conversationDuration: new Date() - this.metadata.createdAt
    };
  }
}

// Database persistence functions
async function saveChatMemory(db, userEmail, memory) {
  try {
    const conversation = {
      conversationId: memory.conversationId,
      userEmail,
      messages: memory.messages,
      metadata: memory.metadata,
      savedAt: new Date()
    };

    const result = await db.collection('chat_conversations').insertOne(conversation);
    return {
      success: true,
      conversationId: memory.conversationId,
      messageCount: memory.messages.length
    };
  } catch (error) {
    console.error('Error saving chat memory:', error);
    return { success: false, error: error.message };
  }
}

async function loadChatMemory(db, conversationId) {
  try {
    const conversation = await db.collection('chat_conversations').findOne({
      conversationId
    });

    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    const memory = new ChatMemory(conversation.userEmail);
    memory.conversationId = conversation.conversationId;
    memory.messages = conversation.messages;
    memory.metadata = conversation.metadata;

    return { success: true, memory };
  } catch (error) {
    console.error('Error loading chat memory:', error);
    return { success: false, error: error.message };
  }
}

async function getUserConversations(db, userEmail, limit = 50) {
  try {
    const conversations = await db.collection('chat_conversations')
      .find({ userEmail })
      .sort({ 'metadata.updatedAt': -1 })
      .limit(limit)
      .toArray();

    return {
      success: true,
      conversations: conversations.map(conv => ({
        conversationId: conv.conversationId,
        title: conv.metadata.title,
        messageCount: conv.messages.length,
        updatedAt: conv.metadata.updatedAt,
        model: conv.metadata.model
      }))
    };
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return { success: false, error: error.message };
  }
}

async function deleteChatMemory(db, conversationId) {
  try {
    const result = await db.collection('chat_conversations').deleteOne({
      conversationId
    });

    return {
      success: result.deletedCount > 0,
      deleted: result.deletedCount > 0
    };
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  ChatMemory,
  saveChatMemory,
  loadChatMemory,
  getUserConversations,
  deleteChatMemory
};
