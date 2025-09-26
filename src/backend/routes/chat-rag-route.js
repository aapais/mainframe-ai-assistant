/**
 * RAG Chat Endpoint - Uses knowledge base for context-aware responses
 */

const { EnhancedRAGChatService } = require('../services/chat/EnhancedRAGChatService');
const MultiEmbeddingService = require('../../services/multi-embedding-service');
const cryptoService = require('../../services/crypto-service');

async function setupRAGChatRoute(app, db, authenticateUser) {

  // RAG-enabled chat endpoint
  app.post('/api/chat/rag', authenticateUser, async (req, res) => {
    try {
      const { message, content } = req.body;
      const messageText = message || content;
      const userId = req.user.id;

      if (!messageText) {
        return res.status(400).json({ error: 'Message is required' });
      }

      console.log(`📚 RAG Chat Request: "${messageText.substring(0, 50)}..."`);

      // Get user settings including language
      const settingsQuery = `
        SELECT language
        FROM user_settings
        WHERE user_id = $1
      `;
      const settingsResult = await db.query(settingsQuery, [userId]);
      const userLanguage = settingsResult.rows[0]?.language || 'pt-BR';

      // Get API keys from database
      const keysQuery = `
        SELECT service, key_encrypted
        FROM api_keys
        WHERE user_id = $1 AND is_active = true
      `;
      const keysResult = await db.query(keysQuery, [userId]);

      const apiKeys = {};
      for (const row of keysResult.rows) {
        const decryptedKey = cryptoService.decrypt(row.key_encrypted);
        if (row.service === 'google') {
          apiKeys.gemini_api_key = decryptedKey;
        } else if (row.service === 'openai') {
          apiKeys.openai_api_key = decryptedKey;
        }
      }

      if (!apiKeys.gemini_api_key && !apiKeys.openai_api_key) {
        return res.status(400).json({
          error: 'No API keys configured',
          details: 'Please configure Gemini or OpenAI API keys in settings'
        });
      }

      // Initialize embedding service with correct configuration format
      const embeddingService = new MultiEmbeddingService({
        provider: apiKeys.openai_api_key ? 'openai' : 'gemini',
        openai: apiKeys.openai_api_key ? { apiKey: apiKeys.openai_api_key } : null,
        gemini: apiKeys.gemini_api_key ? { apiKey: apiKeys.gemini_api_key } : null
      });

      // Initialize Enhanced RAG service with optimized vector search
      const ragService = new EnhancedRAGChatService({
        database: db,
        embeddingService: embeddingService
      });

      // Choose model based on available API keys
      const modelId = apiKeys.gemini_api_key ? 'gemini-2.0-flash' : 'gpt-3.5-turbo';

      console.log(`🤖 Using model: ${modelId}`);
      console.log(`🔑 API Keys available: Gemini=${!!apiKeys.gemini_api_key}, OpenAI=${!!apiKeys.openai_api_key}`);

      // Process query through RAG pipeline
      const response = await ragService.processQuery(messageText, {
        model_id: modelId,
        api_keys: apiKeys,
        message_id: null,
        stream: false,
        language: userLanguage
      });

      console.log(`✅ RAG response generated successfully`);

      return res.json({
        success: true,
        response: response,
        provider: apiKeys.gemini_api_key ? 'gemini' : 'openai',
        rag_enabled: true
      });

    } catch (error) {
      console.error('❌ RAG Chat error:', error);

      // Return error details for debugging
      return res.status(500).json({
        error: 'Failed to process RAG chat',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  console.log('✅ RAG Chat endpoint registered at /api/chat/rag');
}

module.exports = { setupRAGChatRoute };