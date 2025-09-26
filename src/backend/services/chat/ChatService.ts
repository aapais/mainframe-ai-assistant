/**
 * ChatService
 * Core service for managing chat conversations and messages
 */

import { ChatConversationModel, CreateConversationDTO } from '../../models/ChatConversation';
import { ChatMessageModel, CreateMessageDTO, MessageRole } from '../../models/ChatMessage';
import { ConversationContextManager } from './ConversationContextManager';
import { ModelSelectorService } from './ModelSelectorService';
import { EventEmitter } from 'events';

export interface ChatServiceConfig {
  database: any; // PostgreSQL pool
  maxMessagesVisible: number;
  tokenWarningThreshold: number;
}

export interface SendMessageOptions {
  modelOverride?: string;
  stream?: boolean;
}

export class ChatService extends EventEmitter {
  private conversationModel: ChatConversationModel;
  private messageModel: ChatMessageModel;
  private contextManager: ConversationContextManager;
  private modelSelector: ModelSelectorService;
  private config: ChatServiceConfig;

  constructor(config: ChatServiceConfig) {
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
  async createConversation(userId: string, title?: string, modelId?: string) {
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
  async getConversation(conversationId: string, userId: string) {
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
      approaching_limit: modelInfo ?
        (tokenCount / modelInfo.max_tokens) > this.config.tokenWarningThreshold :
        false
    };
  }

  /**
   * List user's conversations
   */
  async listConversations(userId: string, limit: number = 10, offset: number = 0) {
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
  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    options: SendMessageOptions = {}
  ): Promise<AsyncGenerator<string, void, unknown> | string> {
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
      role: 'user' as MessageRole,
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

    // This will be handled by RAGChatService
    this.emit('message_ready', {
      conversation_id: conversationId,
      message: userMessage,
      model_id: modelId,
      context,
      stream: options.stream
    });

    if (options.stream) {
      return this.createStreamResponse(conversationId, modelId, context);
    } else {
      return this.createStandardResponse(conversationId, modelId, context);
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, userId: string) {
    const deleted = await this.conversationModel.delete(conversationId, userId);

    if (!deleted) {
      throw new Error('Conversation not found');
    }

    return { success: true };
  }

  /**
   * Switch model for a conversation
   */
  async switchModel(conversationId: string, userId: string, newModelId: string) {
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

  /**
   * Generate conversation title from first message
   */
  async generateTitle(conversationId: string): Promise<string> {
    const messages = await this.messageModel.listByConversation(conversationId, 1);

    if (messages.length === 0) {
      return 'New Conversation';
    }

    const firstMessage = messages[0].content;
    // Take first 50 characters or until first line break
    const title = firstMessage.substring(0, 50).split('\n')[0];

    return title.length < firstMessage.length ? title + '...' : title;
  }

  /**
   * Create streaming response generator
   */
  private async *createStreamResponse(
    conversationId: string,
    modelId: string,
    context: any
  ): AsyncGenerator<string, void, unknown> {
    // This will be implemented by RAGChatService
    yield `event: message\ndata: {"type": "start"}\n\n`;
    yield `event: message\ndata: {"type": "done"}\n\n`;
  }

  /**
   * Create standard response
   */
  private async createStandardResponse(
    conversationId: string,
    modelId: string,
    context: any
  ): Promise<string> {
    // This will be implemented by RAGChatService
    return 'Response will be generated by RAGChatService';
  }
}