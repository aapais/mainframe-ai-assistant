/**
 * RAGChatService - JavaScript version
 * Provides chat-specific RAG functionality
 */

const { EventEmitter } = require('events');

class RAGChatService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.db = config.database;
    this.embeddingService = config.embeddingService;
    this.ragService = config.ragService;
  }

  async processQuery(query, options) {
    try {
      const provider = this.getProviderFromModel(options.model_id);

      // 1. Generate embedding for the query
      let queryEmbedding = null;
      let embeddingColumn = 'embedding_openai';

      if (this.embeddingService && options.api_keys) {
        try {
          // Create embedding for the query
          if (provider === 'openai' && options.api_keys.openai_api_key) {
            queryEmbedding = await this.embeddingService.createEmbedding(
              query,
              'openai',
              options.api_keys.openai_api_key
            );
            embeddingColumn = 'embedding_openai';
          } else if (provider === 'gemini' && options.api_keys.gemini_api_key) {
            queryEmbedding = await this.embeddingService.createEmbedding(
              query,
              'gemini',
              options.api_keys.gemini_api_key
            );
            embeddingColumn = 'embedding_gemini';
          }
        } catch (embError) {
          console.warn('Failed to create embedding:', embError.message);
        }
      }

      // 2. Search knowledge base for relevant context
      let context = '';
      const relevantDocs = [];

      if (queryEmbedding && this.db) {
        try {
          // Search for similar documents using pgvector
          const searchQuery = `
            SELECT id, title, content,
                   1 - (${embeddingColumn} <=> $1::vector) as similarity
            FROM knowledge_base
            WHERE ${embeddingColumn} IS NOT NULL
            ORDER BY ${embeddingColumn} <=> $1::vector
            LIMIT 5
          `;

          const result = await this.db.query(searchQuery, [`[${queryEmbedding.join(',')}]`]);

          if (result.rows && result.rows.length > 0) {
            relevantDocs.push(...result.rows);
            context = result.rows
              .map(row => `${row.title || 'Document'}:\n${row.content}`)
              .join('\n\n---\n\n');
          }
        } catch (searchError) {
          console.warn('Knowledge base search failed:', searchError.message);
          // Fall back to basic text search
          try {
            const textSearchQuery = `
              SELECT id, title, content
              FROM knowledge_base
              WHERE content ILIKE $1 OR title ILIKE $1
              LIMIT 5
            `;
            const searchTerm = `%${query.slice(0, 50)}%`;
            const textResult = await this.db.query(textSearchQuery, [searchTerm]);

            if (textResult.rows && textResult.rows.length > 0) {
              relevantDocs.push(...textResult.rows);
              context = textResult.rows
                .map(row => `${row.title || 'Document'}:\n${row.content}`)
                .join('\n\n---\n\n');
            }
          } catch (textSearchError) {
            console.warn('Text search also failed:', textSearchError.message);
          }
        }
      }

      // 3. Generate response using LLM with context
      let response = '';

      if (context) {
        // Build RAG prompt with context
        const systemPrompt = `You are a helpful AI assistant with access to a knowledge base of technical documentation.
        Use the following context to answer the user's question. If the context doesn't contain relevant information,
        say so and provide the best answer you can based on general knowledge.

        Context from knowledge base:
        ${context}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ];

        // Call appropriate LLM
        if (provider === 'openai' && options.api_keys?.openai_api_key) {
          response = await this.callOpenAI(messages, options.model_id, options.api_keys.openai_api_key, options.stream);
        } else if (provider === 'gemini' && options.api_keys?.gemini_api_key) {
          response = await this.callGemini(messages, options.model_id, options.api_keys.gemini_api_key, options.stream);
        } else {
          response = `I found ${relevantDocs.length} relevant documents in the knowledge base, but I need valid API keys to generate a complete response.\n\nRelevant topics found:\n${relevantDocs.map(d => `- ${d.title || 'Untitled'}`).join('\n')}`;
        }
      } else {
        // No context found, provide general response
        if (provider === 'openai' && options.api_keys?.openai_api_key) {
          const messages = [
            { role: 'system', content: 'You are a helpful AI assistant. The knowledge base search did not return relevant results, so please provide a general response.' },
            { role: 'user', content: query }
          ];
          response = await this.callOpenAI(messages, options.model_id, options.api_keys.openai_api_key, options.stream);
        } else if (provider === 'gemini' && options.api_keys?.gemini_api_key) {
          const messages = [
            { role: 'system', content: 'You are a helpful AI assistant. The knowledge base search did not return relevant results, so please provide a general response.' },
            { role: 'user', content: query }
          ];
          response = await this.callGemini(messages, options.model_id, options.api_keys.gemini_api_key, options.stream);
        } else {
          response = 'I couldn\'t find relevant information in the knowledge base for your query. Please ensure you have configured API keys for OpenAI or Gemini to get complete responses.';
        }
      }

      // Store context references if we found relevant documents
      if (relevantDocs.length > 0 && options.message_id) {
        await this.storeKnowledgeContext(options.message_id, relevantDocs);
      }

      if (options.stream) {
        return this.generateStreamingResponse(response, options);
      } else {
        return response;
      }
    } catch (error) {
      console.error('RAG Chat Service error:', error);
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  async callOpenAI(messages, modelId, apiKey, stream = false) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelId || 'gpt-3.5-turbo',
          messages: messages,
          stream: false, // For simplicity, not implementing streaming yet
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  async callGemini(messages, modelId, apiKey, stream = false) {
    try {
      // Convert messages to Gemini format
      const parts = messages.map(m => ({
        text: m.content
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }

  async storeKnowledgeContext(messageId, documents) {
    if (!this.db) return;

    try {
      for (const doc of documents) {
        const query = `
          INSERT INTO knowledge_context
          (message_id, knowledge_id, relevance_score, chunk_text, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `;

        await this.db.query(query, [
          messageId,
          doc.id,
          doc.similarity || 0.5,
          doc.content.substring(0, 1000), // Store first 1000 chars as chunk
          JSON.stringify({ title: doc.title })
        ]);
      }
    } catch (error) {
      console.warn('Failed to store knowledge context:', error);
    }
  }

  async *generateStreamingResponse(content, options) {
    yield `event: start\ndata: {"type": "start", "model": "${options.model_id}"}\n\n`;

    // Simulate streaming by yielding words
    const words = content.split(' ');
    for (const word of words) {
      yield `event: message\ndata: {"type": "content", "content": "${word} "}\n\n`;
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
    }

    yield `event: done\ndata: {"type": "done"}\n\n`;
  }

  getProviderFromModel(modelId) {
    if (modelId.startsWith('gpt')) {
      return 'openai';
    } else if (modelId.includes('gemini')) {
      return 'gemini';
    } else {
      return 'openai';
    }
  }

  estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

module.exports = { RAGChatService };