/**
 * ChatConversationModel - JavaScript version
 */

class ChatConversationModel {
  constructor(database) {
    this.db = database;
  }

  async create(data) {
    const query = `
      INSERT INTO chat_conversations (user_id, title, model_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      data.user_id,
      data.title || 'New Conversation',
      data.model_id || 'gpt-3.5-turbo'
    ]);

    return result.rows[0];
  }

  async findById(id, userId) {
    const query = `
      SELECT * FROM chat_conversations
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);
    return result.rows[0] || null;
  }

  async listByUser(userId, limit = 10, offset = 0) {
    const query = `
      SELECT * FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async countByUser(userId) {
    const query = 'SELECT COUNT(*) FROM chat_conversations WHERE user_id = $1';
    const result = await this.db.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  async update(id, userId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount++}`);
      values.push(value);
    });

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

  async delete(id, userId) {
    const query = 'DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2 RETURNING id';
    const result = await this.db.query(query, [id, userId]);
    return result.rowCount > 0;
  }
}

module.exports = { ChatConversationModel };