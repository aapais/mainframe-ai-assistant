/**
 * ChatMessage Model
 * Individual message in a conversation
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  model_id?: string;
  tokens_used?: number;
  created_at: Date;
}

export interface CreateMessageDTO {
  conversation_id: string;
  role: MessageRole;
  content: string;
  model_id?: string;
  tokens_used?: number;
}

export interface MessageWithContext extends ChatMessage {
  knowledge_contexts?: KnowledgeContext[];
}

export interface KnowledgeContext {
  id: string;
  message_id: string;
  knowledge_id?: string;
  relevance_score: number;
  chunk_text: string;
  metadata?: any;
}

export class ChatMessageModel {
  private db: any; // PostgreSQL connection pool

  constructor(database: any) {
    this.db = database;
  }

  /**
   * Create a new message
   */
  async create(data: CreateMessageDTO): Promise<ChatMessage> {
    const query = `
      INSERT INTO chat_messages
      (conversation_id, role, content, model_id, tokens_used)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.conversation_id,
      data.role,
      data.content,
      data.model_id || null,
      data.tokens_used || null
    ];

    const result = await this.db.query(query, values);

    // Update conversation's updated_at
    await this.db.query(
      'UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1',
      [data.conversation_id]
    );

    return result.rows[0];
  }

  /**
   * Get messages for a conversation
   */
  async listByConversation(
    conversationId: string,
    limit: number = 5,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(query, [conversationId, limit, offset]);
    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Get all messages for token counting
   */
  async getAllByConversation(conversationId: string): Promise<ChatMessage[]> {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [conversationId]);
    return result.rows;
  }

  /**
   * Get message with knowledge contexts
   */
  async getWithContext(messageId: string): Promise<MessageWithContext | null> {
    const messageQuery = `
      SELECT * FROM chat_messages
      WHERE id = $1
    `;

    const contextQuery = `
      SELECT * FROM knowledge_context
      WHERE message_id = $1
      ORDER BY relevance_score DESC
    `;

    const messageResult = await this.db.query(messageQuery, [messageId]);

    if (messageResult.rows.length === 0) {
      return null;
    }

    const message = messageResult.rows[0];
    const contextResult = await this.db.query(contextQuery, [messageId]);

    return {
      ...message,
      knowledge_contexts: contextResult.rows
    };
  }

  /**
   * Count tokens in conversation
   */
  async countTokens(conversationId: string): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(tokens_used), 0) as total_tokens
      FROM chat_messages
      WHERE conversation_id = $1
    `;

    const result = await this.db.query(query, [conversationId]);
    return parseInt(result.rows[0].total_tokens, 10);
  }

  /**
   * Delete old messages (for summarization)
   */
  async deleteOldMessages(conversationId: string, keepCount: number): Promise<number> {
    const query = `
      DELETE FROM chat_messages
      WHERE conversation_id = $1
      AND id NOT IN (
        SELECT id FROM chat_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      )
    `;

    const result = await this.db.query(query, [conversationId, keepCount]);
    return result.rowCount;
  }

  /**
   * Store knowledge context for a message
   */
  async addKnowledgeContext(
    messageId: string,
    contexts: Array<{
      knowledge_id?: string;
      relevance_score: number;
      chunk_text: string;
      metadata?: any;
    }>
  ): Promise<void> {
    if (contexts.length === 0) return;

    const values = contexts.map((ctx, index) => {
      const offset = index * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    }).join(', ');

    const query = `
      INSERT INTO knowledge_context
      (message_id, knowledge_id, relevance_score, chunk_text, metadata)
      VALUES ${values}
    `;

    const flatValues = contexts.flatMap(ctx => [
      messageId,
      ctx.knowledge_id || null,
      ctx.relevance_score,
      ctx.chunk_text,
      JSON.stringify(ctx.metadata || {})
    ]);

    await this.db.query(query, flatValues);
  }
}