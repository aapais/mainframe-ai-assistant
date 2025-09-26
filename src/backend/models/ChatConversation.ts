/**
 * ChatConversation Model
 * Represents a dialogue session between user and chatbot
 */

export interface ChatConversation {
  id: string;
  user_id: string;
  title?: string;
  model_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConversationDTO {
  user_id: string;
  title?: string;
  model_id?: string;
}

export interface UpdateConversationDTO {
  title?: string;
  model_id?: string;
}

export class ChatConversationModel {
  private db: any; // PostgreSQL connection pool

  constructor(database: any) {
    this.db = database;
  }

  /**
   * Create a new conversation
   */
  async create(data: CreateConversationDTO): Promise<ChatConversation> {
    const query = `
      INSERT INTO chat_conversations (user_id, title, model_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [data.user_id, data.title || null, data.model_id || null];
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get conversation by ID
   */
  async findById(id: string, userId: string): Promise<ChatConversation | null> {
    const query = `
      SELECT * FROM chat_conversations
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);
    return result.rows[0] || null;
  }

  /**
   * List user's conversations
   */
  async listByUser(userId: string, limit: number = 10, offset: number = 0): Promise<ChatConversation[]> {
    const query = `
      SELECT * FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Update conversation
   */
  async update(id: string, userId: string, data: UpdateConversationDTO): Promise<ChatConversation | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(data.title);
    }

    if (data.model_id !== undefined) {
      fields.push(`model_id = $${paramCount++}`);
      values.push(data.model_id);
    }

    if (fields.length === 0) {
      return this.findById(id, userId);
    }

    values.push(id, userId);

    const query = `
      UPDATE chat_conversations
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete conversation
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM chat_conversations
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);
    return result.rowCount > 0;
  }

  /**
   * Count user's conversations
   */
  async countByUser(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as total
      FROM chat_conversations
      WHERE user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    return parseInt(result.rows[0].total, 10);
  }
}