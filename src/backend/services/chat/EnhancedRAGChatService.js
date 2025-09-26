/**
 * EnhancedRAGChatService - Optimized RAG with multi-provider embeddings
 * Supports vector search when pgvector is available, falls back to smart text search
 */

const { RAGChatService } = require('./RAGChatService');
const LanguageDetectionService = require('../../../services/language-detection-service');
const MultiEmbeddingService = require('../../../services/multi-embedding-service');

class EnhancedRAGChatService extends RAGChatService {
  constructor(config) {
    super(config);
    this.vectorSearchAvailable = false;
    this.languageDetector = new LanguageDetectionService();
    // Check vector support after initialization
    if (this.db) {
      this.checkVectorSupport();
    }
  }

  async checkVectorSupport() {
    try {
      // Test pgvector extension
      const result = await this.db.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as has_vector
      `);

      this.vectorSearchAvailable = result.rows[0]?.has_vector || false;

      if (this.vectorSearchAvailable) {
        console.log('✅ Vector search enabled with pgvector');
      } else {
        console.log('⚠️ Vector search disabled (pgvector not available)');
      }
    } catch (error) {
      this.vectorSearchAvailable = false;
      console.log('⚠️ Vector search disabled - Error checking pgvector:', error.message);
    }
  }

  async processQuery(query, options) {
    try {
      // Ensure vector support is checked
      if (this.db && this.vectorSearchAvailable === false) {
        await this.checkVectorSupport();
      }

      const provider = this.getProviderFromModel(options.model_id);

      // Detect language from the query itself
      const detectedLanguage = this.languageDetector.detectLanguage(query);
      console.log(`🌐 Query language detected: ${detectedLanguage} - "${query.substring(0, 50)}..."`);

      // Determine which embedding column to use based on provider
      let embeddingColumn = null;
      let queryEmbedding = null;

      // Map provider to embedding column
      const embeddingColumnMap = {
        'openai': 'embedding_openai',
        'gemini': 'embedding_gemini',
        'anthropic': 'embedding_anthropic'
      };

      embeddingColumn = embeddingColumnMap[provider] || 'embedding_openai';

      // If query is not in Portuguese, we'll need to translate it for search
      let searchQuery = query;
      if (detectedLanguage !== 'pt' && this.languageDetector.needsTranslation(detectedLanguage)) {
        console.log(`🔄 Query needs translation from ${detectedLanguage} to Portuguese for KB search`);
        // For now, we'll search with the original query
        // In a production system, you'd translate here using a translation API
        searchQuery = query;
      }

      // Try to generate embedding for vector search if available
      if (this.vectorSearchAvailable && options.api_keys) {
        console.log(`🧬 Attempting to generate embedding for vector search...`);
        console.log(`🔑 API Keys available: Gemini=${!!options.api_keys.gemini_api_key}, OpenAI=${!!options.api_keys.openai_api_key}`);

        try {
          // Create a temporary MultiEmbeddingService instance with the user's API keys
          const embeddingConfig = {};

          if (options.api_keys.openai_api_key) {
            embeddingConfig.openai = { apiKey: options.api_keys.openai_api_key };
          }
          if (options.api_keys.gemini_api_key) {
            embeddingConfig.gemini = { apiKey: options.api_keys.gemini_api_key };
          }

          const tempEmbeddingService = new MultiEmbeddingService(embeddingConfig);

          if (provider === 'openai' && options.api_keys.openai_api_key) {
            console.log('🎯 Using OpenAI to generate query embedding...');
            embeddingColumn = 'embedding_openai';
            queryEmbedding = await tempEmbeddingService.generateEmbedding(
              searchQuery,
              {
                provider: 'openai',
                model: 'ada-002'
              }
            );
            if (queryEmbedding) {
              console.log(`✅ OpenAI embedding generated: ${queryEmbedding.length} dimensions`);
            }
          } else if (provider === 'gemini' && options.api_keys.gemini_api_key) {
            console.log('🎯 Using Gemini to generate query embedding...');
            embeddingColumn = 'embedding_gemini';
            queryEmbedding = await tempEmbeddingService.generateEmbedding(
              searchQuery,
              {
                provider: 'gemini',
                model: 'embedding-001'
              }
            );
            if (queryEmbedding) {
              console.log(`✅ Gemini embedding generated: ${queryEmbedding.length} dimensions`);
            }
          } else if (options.api_keys.gemini_api_key) {
            // Fallback to Gemini if available
            console.log('🎯 Using Gemini as fallback to generate query embedding...');
            embeddingColumn = 'embedding_gemini';
            queryEmbedding = await tempEmbeddingService.generateEmbedding(
              searchQuery,
              {
                provider: 'gemini',
                model: 'embedding-001'
              }
            );
            if (queryEmbedding) {
              console.log(`✅ Gemini embedding generated (fallback): ${queryEmbedding.length} dimensions`);
            }
          } else if (options.api_keys.openai_api_key) {
            // Fallback to OpenAI if available
            console.log('🎯 Using OpenAI as fallback to generate query embedding...');
            embeddingColumn = 'embedding_openai';
            queryEmbedding = await tempEmbeddingService.generateEmbedding(
              searchQuery,
              {
                provider: 'openai',
                model: 'ada-002'
              }
            );
            if (queryEmbedding) {
              console.log(`✅ OpenAI embedding generated (fallback): ${queryEmbedding.length} dimensions`);
            }
          } else {
            console.log('⚠️ No API key available for embedding generation');
          }
        } catch (embError) {
          console.warn('❌ Failed to create embedding:', embError.message);
          console.warn('Full error:', embError);
        }
      } else {
        console.log(`🚫 Embedding generation skipped: vectorSearch=${this.vectorSearchAvailable}, hasApiKeys=${!!options.api_keys}`);
      }

      // Search knowledge base for relevant context
      let context = '';
      const relevantDocs = [];

      // OPTIMIZED SEARCH STRATEGY
      if (queryEmbedding && this.vectorSearchAvailable) {
        // Vector similarity search with multi-provider support
        console.log(`🔍 Using vector search with ${embeddingColumn}`);

        const searchQuery = `
          SELECT
            id,
            title,
            content,
            summary,
            category,
            confidence_score,
            1 - (${embeddingColumn} <=> $1::vector) as similarity
          FROM knowledge_base
          WHERE ${embeddingColumn} IS NOT NULL
            AND (1 - (${embeddingColumn} <=> $1::vector)) > 0.5  -- Lower threshold for better recall
          ORDER BY ${embeddingColumn} <=> $1::vector
          LIMIT 15
        `;

        try {
          const result = await this.db.query(searchQuery, [`[${queryEmbedding.join(',')}]`]);

          if (result.rows && result.rows.length > 0) {
            relevantDocs.push(...result.rows);
            console.log(`✅ Found ${result.rows.length} relevant documents via vector search`);
          }
        } catch (searchError) {
          console.warn('Vector search failed:', searchError.message);
        }
      }

      // Always use enhanced text search for better coverage
      if (relevantDocs.length < 10) {
        console.log('🔍 Using enhanced text search');

        try {
          // Smart keyword extraction from query
          const keywords = this.extractKeywords(searchQuery);
          console.log(`📋 Extracted keywords: [${keywords.join(', ')}]`);

          const textSearchQuery = `
            SELECT
              id,
              title,
              content,
              summary,
              category,
              confidence_score,
              GREATEST(
                ts_rank(
                  to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '')),
                  plainto_tsquery('portuguese', $1)
                ),
                ts_rank(
                  to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '')),
                  plainto_tsquery('simple', $1)
                )
              ) as relevance
            FROM knowledge_base
            WHERE
              (
                to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, ''))
                @@ plainto_tsquery('portuguese', $1)
              )
              OR (
                to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, ''))
                @@ plainto_tsquery('simple', $1)
              )
              OR title ILIKE ANY($2)
              OR content ILIKE ANY($2)
              OR summary ILIKE ANY($2)
            ORDER BY
              CASE
                WHEN title ILIKE $3 THEN 0
                WHEN summary ILIKE $3 THEN 1
                ELSE 2
              END,
              relevance DESC,
              confidence_score DESC
            LIMIT 15
          `;

          const searchTerms = keywords.map(k => `%${k}%`);
          const fullQuery = `%${query.slice(0, 100)}%`;

          const textResult = await this.db.query(textSearchQuery, [
            keywords.join(' '),
            searchTerms,
            fullQuery
          ]);

          if (textResult.rows && textResult.rows.length > 0) {
            // Merge with existing results, avoiding duplicates
            const existingIds = new Set(relevantDocs.map(d => d.id));
            const newDocs = textResult.rows.filter(row => !existingIds.has(row.id));
            relevantDocs.push(...newDocs);
            console.log(`✅ Found ${newDocs.length} additional documents via text search`);
          }
        } catch (textSearchError) {
          console.warn('Enhanced text search failed:', textSearchError.message);

          // Ultimate fallback: simple ILIKE search
          try {
            const simpleFallback = `
              SELECT id, title, content, summary, category, confidence_score
              FROM knowledge_base
              WHERE content ILIKE $1 OR title ILIKE $1 OR summary ILIKE $1
              ORDER BY confidence_score DESC
              LIMIT 5
            `;

            const searchTerm = `%${query.slice(0, 50)}%`;
            const fallbackResult = await this.db.query(simpleFallback, [searchTerm]);

            if (fallbackResult.rows && fallbackResult.rows.length > 0) {
              relevantDocs.push(...fallbackResult.rows);
              console.log(`✅ Found ${fallbackResult.rows.length} documents via simple search`);
            }
          } catch (err) {
            console.error('All search methods failed:', err);
          }
        }
      }

      // Build context from relevant documents
      if (relevantDocs.length > 0) {
        // Sort by relevance/similarity if available
        relevantDocs.sort((a, b) => {
          const scoreA = a.similarity || a.relevance || a.confidence_score || 0;
          const scoreB = b.similarity || b.relevance || b.confidence_score || 0;
          return scoreB - scoreA;
        });

        // Take top 8 most relevant documents for better context
        const topDocs = relevantDocs.slice(0, 8);

        context = topDocs
          .map((row) => {
            // Just extract the content without metadata references
            const content = row.content || '';
            const summary = row.summary || '';
            return `${summary}\n${content.substring(0, 800)}${content.length > 800 ? '...' : ''}`;
          })
          .join('\n\n');

        console.log(`📚 Using ${topDocs.length} documents for context (${context.length} chars)`);
      }

      // Generate response using LLM with context
      let response = '';

      if (context) {
        // Use detected language instead of user settings
        const responseLanguage = detectedLanguage;
        const responseLanguagePrompt = this.languageDetector.getResponseLanguagePrompt(responseLanguage);

        console.log(`💬 Responding in ${this.languageDetector.getLanguageName(responseLanguage)}`);

        // Build enhanced RAG prompt based on detected language
        const systemPrompt = responseLanguage === 'pt' ?
          `É um consultor especialista em sistemas mainframe com profundo conhecimento de IBM z/OS, CICS, JCL, COBOL, DB2 e VSAM.

Baseie-se no seguinte contexto para fornecer respostas precisas e detalhadas:

CONTEXTO:
${context}

DIRETRIZES IMPORTANTES:
1. Forneça respostas diretas e técnicas sem mencionar fontes ou documentos
2. Não faça referências a "base de conhecimento", "documentos consultados" ou "informações encontradas"
3. Responda como se o conhecimento fosse seu, não cite fontes
4. Seja específico e técnico ao discutir tópicos de mainframe
5. Inclua comandos relevantes, sintaxe ou exemplos de código quando aplicável
6. ${responseLanguagePrompt}

Responda à pergunta do utilizador com expertise e precisão, sem mencionar de onde veio a informação.` :
          `You are an expert mainframe systems consultant with deep knowledge of IBM z/OS, CICS, JCL, COBOL, DB2, and VSAM.

CONTEXT (in Portuguese):
${context}

GUIDELINES:
1. Provide direct, technical answers without mentioning sources or documents
2. Do not reference "knowledge base", "documents consulted", or "information found"
3. Answer as if the knowledge is yours, do not cite sources
4. Be specific and technical when discussing mainframe topics
5. Include relevant commands, syntax, or code examples when applicable
6. Translate Portuguese technical information accurately to the response language
7. ${responseLanguagePrompt}

Answer the user's question with expertise and precision, without mentioning where the information came from.`;

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
          response = this.generateFallbackResponse(relevantDocs, query);
        }
      } else {
        // No context found, provide general response
        console.log('⚠️ No relevant context found in knowledge base');

        const responseLanguage = detectedLanguage;
        const responseLanguagePrompt = this.languageDetector.getResponseLanguagePrompt(responseLanguage);

        const messages = [
          {
            role: 'system',
            content: responseLanguage === 'pt' ?
              `É um consultor especialista em sistemas mainframe.

              Forneça uma resposta útil baseada na sua expertise geral em mainframe.
              Não mencione que não encontrou informações ou que falta algo.
              Responda de forma natural e completa.
              ${responseLanguagePrompt}` :
              `You are an expert mainframe systems consultant.

              Provide a helpful response based on general mainframe expertise.
              Do not mention that you couldn't find information or that something is missing.
              Answer naturally and completely.
              ${responseLanguagePrompt}`
          },
          { role: 'user', content: query }
        ];

        if (provider === 'openai' && options.api_keys?.openai_api_key) {
          response = await this.callOpenAI(messages, options.model_id, options.api_keys.openai_api_key, options.stream);
        } else if (provider === 'gemini' && options.api_keys?.gemini_api_key) {
          response = await this.callGemini(messages, options.model_id, options.api_keys.gemini_api_key, options.stream);
        } else {
          response = 'Não foram encontrados documentos relevantes na base de conhecimento para a sua pergunta. Configure uma chave API do OpenAI ou Gemini para obter respostas completas.';
        }
      }

      // Store context references if we found relevant documents
      if (relevantDocs.length > 0 && options.message_id) {
        await this.storeKnowledgeContext(options.message_id, relevantDocs);
      }

      // Log search performance metrics
      console.log(`📊 RAG Performance: ${relevantDocs.length} docs found, ${context.length} chars context, vector search: ${this.vectorSearchAvailable}`);

      if (options.stream) {
        return this.generateStreamingResponse(response, options);
      } else {
        return response;
      }
    } catch (error) {
      console.error('Enhanced RAG Chat Service error:', error);
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  extractKeywords(query) {
    // Extract important mainframe-related keywords
    const mainframeKeywords = [
      'CICS', 'JCL', 'COBOL', 'DB2', 'VSAM', 'IMS', 'TSO', 'ISPF', 'RACF',
      'z/OS', 'MVS', 'mainframe', 'batch', 'job', 'dataset', 'SYSIN', 'SYSOUT',
      'ABEND', 'SQLCODE', 'JES', 'JES2', 'JES3', 'REXX', 'PL/I', 'Assembler'
    ];

    // Add banking/business keywords
    const businessKeywords = [
      'conta', 'poupança', 'cobrança', 'transferência', 'pagamento',
      'crédito', 'débito', 'saldo', 'extrato', 'juros', 'taxa',
      'empréstimo', 'financiamento', 'cartão', 'cheque', 'depósito'
    ];

    // Find mainframe and business keywords in query
    const foundMainframe = mainframeKeywords.filter(keyword =>
      query.toLowerCase().includes(keyword.toLowerCase())
    );

    const foundBusiness = businessKeywords.filter(keyword =>
      query.toLowerCase().includes(keyword.toLowerCase())
    );

    const foundKeywords = [...foundMainframe, ...foundBusiness];

    // Extract other significant words (2+ chars for Portuguese, not common words)
    const commonWords = [
      'the', 'and', 'or', 'but', 'for', 'with', 'what', 'how', 'when', 'where', 'why', 'can',
      'como', 'que', 'para', 'com', 'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos',
      'em', 'no', 'na', 'por', 'é', 'e', 'ou', 'mas', 'se', 'não', 'sim'
    ];
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length >= 2 && !commonWords.includes(word));

    // Combine and deduplicate
    const allKeywords = [...new Set([...foundKeywords, ...words])];

    // Limit to 10 most relevant keywords
    return allKeywords.slice(0, 10);
  }

  generateFallbackResponse(docs, query) {
    if (docs.length === 0) {
      return 'Configure uma chave API do OpenAI ou Gemini nas definições para obter respostas completas.';
    }

    // Extract key information without revealing sources
    const summary = docs.slice(0, 3)
      .map(doc => (doc.summary || doc.content).substring(0, 200))
      .join(' ');

    return `Com base na informação disponível: ${summary}...

Para uma resposta mais completa, configure uma chave API do OpenAI ou Gemini nas definições.`;
  }
}

module.exports = { EnhancedRAGChatService };