/**
 * RAGChatService
 * Extends RAGService to provide chat-specific RAG functionality
 */

import { ChatMessageModel } from '../../models/ChatMessage';
import { EventEmitter } from 'events';

export interface RAGChatServiceConfig {
  database: any;
  openaiApiKey?: string;
  geminiApiKey?: string;
  embeddingService: any; // Existing MultiEmbeddingService
  ragService: any; // Existing RAGService
}

export interface RAGQueryOptions {
  model_id: string;
  conversation_id: string;
  context: any;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface RetrievedContext {
  knowledge_id?: string;
  content: string;
  relevance_score: number;
  metadata?: any;
}

export class RAGChatService extends EventEmitter {
  private config: RAGChatServiceConfig;
  private messageModel: ChatMessageModel;
  private embeddingService: any;
  private ragService: any;

  constructor(config: RAGChatServiceConfig) {
    super();
    this.config = config;
    this.messageModel = new ChatMessageModel(config.database);
    this.embeddingService = config.embeddingService;
    this.ragService = config.ragService;
  }

  /**
   * Process a chat query with RAG
   */
  async processQuery(
    query: string,
    options: RAGQueryOptions
  ): Promise<string | AsyncGenerator<string, void, unknown>> {
    try {
      // 1. Generate embedding for the query
      const embedding = await this.generateEmbedding(query, options.model_id);

      // 2. Retrieve relevant knowledge base entries
      const retrievedContexts = await this.retrieveKnowledge(embedding, options.model_id);

      // 3. Build enhanced prompt with context
      const enhancedPrompt = this.buildRAGPrompt(query, retrievedContexts, options.context);

      // 4. Generate response using selected model
      if (options.stream) {
        return this.generateStreamingResponse(
          enhancedPrompt,
          options,
          retrievedContexts
        );
      } else {
        return await this.generateResponse(
          enhancedPrompt,
          options,
          retrievedContexts
        );
      }
    } catch (error) {
      console.error('RAG Chat Service error:', error);
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  /**
   * Generate embedding for query based on model provider
   */
  private async generateEmbedding(query: string, modelId: string): Promise<Float32Array> {
    const provider = this.getProviderFromModel(modelId);

    // Use existing MultiEmbeddingService
    const embedding = await this.embeddingService.generateEmbedding(
      query,
      provider
    );

    return embedding;
  }

  /**
   * Retrieve relevant knowledge using vector similarity search
   */
  private async retrieveKnowledge(
    queryEmbedding: Float32Array,
    modelId: string,
    limit: number = 5
  ): Promise<RetrievedContext[]> {
    const provider = this.getProviderFromModel(modelId);
    const columnName = provider === 'openai' ? 'embedding_openai' : 'embedding_gemini';
    const functionName = provider === 'openai' ? 'search_knowledge_base_openai' : 'search_knowledge_base_gemini';

    // Convert Float32Array to PostgreSQL vector string
    const vectorString = `[${Array.from(queryEmbedding).join(',')}]`;

    const query = `
      SELECT * FROM ${functionName}($1::vector, $2, $3)
    `;

    const result = await this.config.database.query(query, [
      vectorString,
      limit,
      0.7 // minimum relevance score
    ]);

    return result.rows.map(row => ({
      knowledge_id: row.id,
      content: row.content,
      relevance_score: row.relevance_score,
      metadata: row.metadata
    }));
  }

  /**
   * Build RAG-enhanced prompt
   */
  private buildRAGPrompt(
    query: string,
    retrievedContexts: RetrievedContext[],
    conversationContext: any
  ): string {
    let prompt = '';

    // Add conversation context if available
    if (conversationContext?.summary) {
      prompt += `Previous conversation summary:\n${conversationContext.summary}\n\n`;
    }

    // Add retrieved knowledge
    if (retrievedContexts.length > 0) {
      prompt += 'Relevant information from knowledge base:\n';
      retrievedContexts.forEach((ctx, index) => {
        prompt += `${index + 1}. ${ctx.content}\n`;
      });
      prompt += '\n';
    }

    // Add recent messages for context
    if (conversationContext?.recentMessages?.length > 0) {
      prompt += 'Recent conversation:\n';
      conversationContext.recentMessages.forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    // Add the current query
    prompt += `User query: ${query}\n\n`;
    prompt += 'Assistant: Based on the provided context and knowledge base, ';

    return prompt;
  }

  /**
   * Generate standard response
   */
  private async generateResponse(
    prompt: string,
    options: RAGQueryOptions,
    retrievedContexts: RetrievedContext[]
  ): Promise<string> {
    const provider = this.getProviderFromModel(options.model_id);
    let response: string;

    if (provider === 'openai') {
      response = await this.generateOpenAIResponse(prompt, options);
    } else if (provider === 'gemini') {
      response = await this.generateGeminiResponse(prompt, options);
    } else {
      throw new Error(`Unsupported model provider: ${provider}`);
    }

    // Save assistant message with token count
    const assistantMessage = await this.messageModel.create({
      conversation_id: options.conversation_id,
      role: 'assistant',
      content: response,
      model_id: options.model_id,
      tokens_used: this.estimateTokens(prompt + response)
    });

    // Store knowledge contexts for the message
    if (retrievedContexts.length > 0) {
      await this.messageModel.addKnowledgeContext(
        assistantMessage.id,
        retrievedContexts.map(ctx => ({
          knowledge_id: ctx.knowledge_id,
          relevance_score: ctx.relevance_score,
          chunk_text: ctx.content.substring(0, 500),
          metadata: ctx.metadata
        }))
      );
    }

    return response;
  }

  /**
   * Generate streaming response
   */
  private async *generateStreamingResponse(
    prompt: string,
    options: RAGQueryOptions,
    retrievedContexts: RetrievedContext[]
  ): AsyncGenerator<string, void, unknown> {
    const provider = this.getProviderFromModel(options.model_id);
    let fullResponse = '';

    yield `event: start\ndata: {"type": "start", "model": "${options.model_id}"}\n\n`;

    if (provider === 'openai') {
      // Stream from OpenAI
      for await (const chunk of this.streamOpenAIResponse(prompt, options)) {
        fullResponse += chunk;
        yield `event: message\ndata: {"type": "content", "content": "${this.escapeSSE(chunk)}"}\n\n`;
      }
    } else if (provider === 'gemini') {
      // Stream from Gemini
      for await (const chunk of this.streamGeminiResponse(prompt, options)) {
        fullResponse += chunk;
        yield `event: message\ndata: {"type": "content", "content": "${this.escapeSSE(chunk)}"}\n\n`;
      }
    }

    // Save complete message
    const assistantMessage = await this.messageModel.create({
      conversation_id: options.conversation_id,
      role: 'assistant',
      content: fullResponse,
      model_id: options.model_id,
      tokens_used: this.estimateTokens(prompt + fullResponse)
    });

    // Store knowledge contexts
    if (retrievedContexts.length > 0) {
      await this.messageModel.addKnowledgeContext(
        assistantMessage.id,
        retrievedContexts.map(ctx => ({
          knowledge_id: ctx.knowledge_id,
          relevance_score: ctx.relevance_score,
          chunk_text: ctx.content.substring(0, 500),
          metadata: ctx.metadata
        }))
      );
    }

    yield `event: done\ndata: {"type": "done", "message_id": "${assistantMessage.id}"}\n\n`;
  }

  /**
   * Generate OpenAI response
   */
  private async generateOpenAIResponse(prompt: string, options: RAGQueryOptions): Promise<string> {
    // This would integrate with existing OpenAI service
    // Placeholder for now
    return `OpenAI response for: ${prompt.substring(0, 50)}...`;
  }

  /**
   * Generate Gemini response
   */
  private async generateGeminiResponse(prompt: string, options: RAGQueryOptions): Promise<string> {
    // This would integrate with existing Gemini service
    // Placeholder for now
    return `Gemini response for: ${prompt.substring(0, 50)}...`;
  }

  /**
   * Stream OpenAI response
   */
  private async *streamOpenAIResponse(
    prompt: string,
    options: RAGQueryOptions
  ): AsyncGenerator<string, void, unknown> {
    // Placeholder streaming implementation
    const words = prompt.split(' ').slice(0, 10);
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Stream Gemini response
   */
  private async *streamGeminiResponse(
    prompt: string,
    options: RAGQueryOptions
  ): AsyncGenerator<string, void, unknown> {
    // Placeholder streaming implementation
    const words = prompt.split(' ').slice(0, 10);
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get provider from model ID
   */
  private getProviderFromModel(modelId: string): string {
    if (modelId.startsWith('gpt')) {
      return 'openai';
    } else if (modelId.includes('gemini')) {
      return 'gemini';
    } else {
      throw new Error(`Unknown model provider for: ${modelId}`);
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Escape content for SSE
   */
  private escapeSSE(content: string): string {
    return content
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }
}