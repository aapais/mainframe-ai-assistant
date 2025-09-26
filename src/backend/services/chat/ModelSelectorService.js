/**
 * ModelSelectorService - Model management service
 */

class ModelSelectorService {
  constructor(database) {
    this.db = database;
    this.models = [
      {
        model_id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        max_tokens: 4096,
        supports_streaming: true,
        api_key_required: 'OPENAI_API_KEY'
      },
      {
        model_id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        max_tokens: 8192,
        supports_streaming: true,
        api_key_required: 'OPENAI_API_KEY'
      },
      {
        model_id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: 'google',
        max_tokens: 32768,
        supports_streaming: true,
        api_key_required: 'GOOGLE_GENERATIVE_AI_KEY'
      }
    ];
  }

  async getAvailableModels(userId) {
    // Check which API keys the user has configured
    const query = `
      SELECT service, key_encrypted
      FROM api_keys
      WHERE user_id = $1 AND is_active = true
    `;

    try {
      const result = await this.db.query(query, [userId]);
      const availableKeys = result.rows.map(r => r.service);

      return this.models.map(model => ({
        ...model,
        available: availableKeys.includes(model.api_key_required)
      }));
    } catch (error) {
      console.error('Error getting available models:', error);
      return this.models.map(m => ({ ...m, available: false }));
    }
  }

  async getModelInfo(modelId) {
    return this.models.find(m => m.model_id === modelId);
  }

  async isModelAvailable(userId, modelId) {
    const models = await this.getAvailableModels(userId);
    const model = models.find(m => m.model_id === modelId);
    return model ? model.available : false;
  }

  async getUserModelPreferences(userId) {
    try {
      const query = 'SELECT default_model_id FROM user_preferences WHERE user_id = $1';
      const result = await this.db.query(query, [userId]);
      return result.rows[0] || { default_model_id: 'gpt-3.5-turbo' };
    } catch (error) {
      return { default_model_id: 'gpt-3.5-turbo' };
    }
  }

  async updateUserModelPreference(userId, modelId) {
    const query = `
      INSERT INTO user_preferences (user_id, default_model_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE
      SET default_model_id = $2
    `;

    await this.db.query(query, [userId, modelId]);
    return true;
  }
}

module.exports = { ModelSelectorService };