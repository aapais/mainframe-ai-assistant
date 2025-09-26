/**
 * ChatMessageModel - JavaScript version
 */

class ChatMessageModel {
  constructor(database) {
    this.db = database;
  }

  async create(data) {
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

  async listByConversation(conversationId, limit = 5, offset = 0) {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(query, [conversationId, limit, offset]);
    return result.rows.reverse(); // Return in chronological order
  }

  async getAllByConversation(conversationId) {
    const query = `
      SELECT * FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [conversationId]);
    return result.rows;
  }

  async countTokens(conversationId) {
    const query = `
      SELECT COALESCE(SUM(tokens_used), 0) as total_tokens
      FROM chat_messages
      WHERE conversation_id = $1
    `;

    const result = await this.db.query(query, [conversationId]);
    return parseInt(result.rows[0].total_tokens, 10);
  }

  async deleteOldMessages(conversationId, keepCount) {
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

  async addKnowledgeContext(messageId, contexts) {
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

module.exports = { ChatMessageModel };