/**
 * ChatService - JavaScript version
 * Core service for managing chat conversations and messages
 */

const { ChatConversationModel } = require('../../models/ChatConversation');
const { ChatMessageModel } = require('../../models/ChatMessage');
const { ConversationContextManager } = require('./ConversationContextManager');
const { ModelSelectorService } = require('./ModelSelectorService');
const { EventEmitter } = require('events');

class ChatService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.conversationModel = new ChatConversationModel(config.database);
    this.messageModel = new ChatMessageModel(config.database);
    this.contextManager = new ConversationContextManager(config.database);
    this.modelSelector = new ModelSelectorService(config.database);
  }

  /**
   * Create a new conversation
   */
  async createConversation(userId, title, modelId) {
    // If no model specified, get user's default
    if (!modelId) {
      const models = await this.modelSelector.getAvailableModels(userId);
      if (models.length > 0) {
        modelId = models[0].model_id;
      }
    }

    const conversation = await this.conversationModel.create({
      user_id: userId,
      title,
      model_id: modelId
    });

    return conversation;
  }

  /**
   * Get conversation with recent messages
   */
  async getConversation(conversationId, userId) {
    const conversation = await this.conversationModel.findById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await this.messageModel.listByConversation(
      conversationId,
      this.config.maxMessagesVisible || 5
    );

    const tokenCount = await this.messageModel.countTokens(conversationId);
    const modelInfo = await this.modelSelector.getModelInfo(conversation.model_id);

    return {
      ...conversation,
      messages,
      token_count: tokenCount,
      token_limit: modelInfo?.max_tokens || 128000,
      approaching_limit: modelInfo
        ? (tokenCount / modelInfo.max_tokens) > this.config.tokenWarningThreshold
        : false
    };
  }

  /**
   * List user's conversations
   */
  async listConversations(userId, limit = 10, offset = 0) {
    const conversations = await this.conversationModel.listByUser(userId, limit, offset);
    const total = await this.conversationModel.countByUser(userId);

    return {
      conversations,
      total,
      limit,
      offset
    };
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId, userId, content, options = {}) {
    // Verify conversation ownership
    const conversation = await this.conversationModel.findById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Use override model or conversation's model
    const modelId = options.modelOverride || conversation.model_id;

    // Validate model is available
    const modelAvailable = await this.modelSelector.isModelAvailable(userId, modelId);
    if (!modelAvailable) {
      throw new Error('Selected model is not available');
    }

    // Save user message
    const userMessage = await this.messageModel.create({
      conversation_id: conversationId,
      role: 'user',
      content
    });

    // Check token limits before processing
    const currentTokens = await this.messageModel.countTokens(conversationId);
    const modelInfo = await this.modelSelector.getModelInfo(modelId);

    if (modelInfo && currentTokens > modelInfo.max_tokens * 0.9) {
      // Trigger summarization
      await this.contextManager.summarizeOldMessages(conversationId);
      this.emit('token_warning', {
        conversation_id: conversationId,
        current_tokens: currentTokens,
        max_tokens: modelInfo.max_tokens
      });
    }

    // Get conversation context
    const context = await this.contextManager.getContext(conversationId, modelId);

    // Emit event for RAGChatService to handle
    this.emit('message_ready', {
      conversation_id: conversationId,
      message: userMessage,
      model_id: modelId,
      context,
      stream: options.stream
    });

    return userMessage;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId, userId) {
    const deleted = await this.conversationModel.delete(conversationId, userId);
    if (!deleted) {
      throw new Error('Conversation not found');
    }
    return { success: true };
  }

  /**
   * Switch model for a conversation
   */
  async switchModel(conversationId, userId, newModelId) {
    // Verify model is available
    const modelAvailable = await this.modelSelector.isModelAvailable(userId, newModelId);
    if (!modelAvailable) {
      throw new Error('Selected model is not available');
    }

    const updated = await this.conversationModel.update(
      conversationId,
      userId,
      { model_id: newModelId }
    );

    if (!updated) {
      throw new Error('Failed to update conversation model');
    }

    return updated;
  }
}

module.exports = { ChatService };