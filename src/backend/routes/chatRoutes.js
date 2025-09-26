/**
 * Chat API Routes
 * Express routes for chat functionality
 */

const express = require('express');
const router = express.Router();
const { ChatService } = require('../services/chat/ChatService');
const { RAGChatService } = require('../services/chat/RAGChatService');
const { ModelSelectorService } = require('../services/chat/ModelSelectorService');
const { authenticateUser } = require('../middleware/auth');

// Initialize services
let chatService;
let ragChatService;
let modelSelectorService;

const initializeServices = (database, embeddingService, ragService) => {
  chatService = new ChatService({
    database,
    maxMessagesVisible: 5,
    tokenWarningThreshold: 0.75
  });

  ragChatService = new RAGChatService({
    database,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GOOGLE_GENERATIVE_AI_KEY,
    embeddingService,
    ragService
  });

  modelSelectorService = new ModelSelectorService(database);
};

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * GET /api/chat/conversations
 * List user's conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const userId = req.user.id;

    const result = await chatService.listConversations(
      userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json(result);
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * POST /api/chat/conversations
 * Create new conversation
 */
router.post('/conversations', async (req, res) => {
  try {
    const { title, model_id } = req.body;
    const userId = req.user.id;

    const conversation = await chatService.createConversation(
      userId,
      title,
      model_id
    );

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get conversation with messages
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    const conversation = await chatService.getConversation(
      conversationId,
      userId
    );

    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(error.message === 'Conversation not found' ? 404 : 500).json({
      error: error.message || 'Failed to get conversation'
    });
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    await chatService.deleteConversation(conversationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(error.message === 'Conversation not found' ? 404 : 500).json({
      error: error.message || 'Failed to delete conversation'
    });
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send message in conversation
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { content, model_id, stream = false } = req.body;
    const userId = req.user.id;

    // Setup message ready event listener
    chatService.once('message_ready', async (data) => {
      try {
        // Get user's API keys from database using the authenticated user's ID
        let apiKeys = {};

        // First try to get keys from database
        const db = chatService.db;
        if (db) {
          const cryptoService = require('../../services/crypto-service');
          const keysQuery = `
            SELECT service, key_encrypted
            FROM api_keys
            WHERE user_id = $1 AND is_active = true
          `;

          const keysResult = await db.query(keysQuery, [req.user.id]);

          for (const row of keysResult.rows) {
            const decryptedKey = cryptoService.decrypt(row.key_encrypted);
            if (row.service === 'google') {
              apiKeys.gemini_api_key = decryptedKey;
            } else if (row.service === 'openai') {
              apiKeys.openai_api_key = decryptedKey;
            }
          }
        }

        // Fallback to request body if no keys found in database
        if (!apiKeys.openai_api_key && !apiKeys.gemini_api_key) {
          apiKeys = {
            openai_api_key: req.body.openai_api_key || req.user.openai_api_key,
            gemini_api_key: req.body.gemini_api_key || req.user.gemini_api_key
          };
        }

        // Process with RAG
        const response = await ragChatService.processQuery(content, {
          model_id: data.model_id,
          conversation_id: conversationId,
          context: data.context,
          stream,
          api_keys: apiKeys,
          message_id: data.message?.id
        });

        if (stream) {
          // Set up SSE headers
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });

          // Stream the response
          for await (const chunk of response) {
            res.write(chunk);
          }

          res.end();
        } else {
          // Send standard response
          const conversation = await chatService.getConversation(
            conversationId,
            userId
          );

          res.json({
            user_message: conversation.messages[conversation.messages.length - 2],
            assistant_message: conversation.messages[conversation.messages.length - 1],
            token_warning: conversation.approaching_limit ? {
              current_tokens: conversation.token_count,
              max_tokens: conversation.token_limit
            } : null
          });
        }
      } catch (error) {
        console.error('RAG processing error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to process message' });
        }
      }
    });

    // Send message through chat service
    await chatService.sendMessage(conversationId, userId, content, {
      modelOverride: model_id,
      stream
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  }
});

/**
 * GET /api/chat/models
 * Get available models for user
 */
router.get('/models', async (req, res) => {
  try {
    const userId = req.user.id;
    const models = await modelSelectorService.getAvailableModels(userId);

    // Get user's default model preference
    const userPreferences = await modelSelectorService.getUserModelPreferences(userId);

    res.json({
      models,
      default_model_id: userPreferences?.default_model_id || models[0]?.model_id
    });
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * GET /api/chat/models/:id/availability
 * Check model availability
 */
router.get('/models/:id/availability', async (req, res) => {
  try {
    const modelId = req.params.id;
    const userId = req.user.id;

    const available = await modelSelectorService.isModelAvailable(userId, modelId);

    res.json({ available });
  } catch (error) {
    console.error('Error checking model availability:', error);
    res.status(500).json({ error: 'Failed to check model availability' });
  }
});

/**
 * PATCH /api/user/preferences
 * Update user model preferences
 */
router.patch('/user/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const { default_model_id } = req.body;

    await modelSelectorService.updateUserModelPreference(userId, default_model_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = {
  chatRouter: router,
  initializeChatRoutes: initializeServices
};