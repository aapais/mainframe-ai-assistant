/**
 * useModels Hook
 * Manages available AI models and user preferences
 */

import { useState, useEffect, useCallback } from 'react';

export interface Model {
  model_id: string;
  name: string;
  provider: string;
  max_tokens: number;
  supports_streaming: boolean;
  available: boolean;
  api_key_required: string;
}

export const useModels = (userId: string) => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available models on mount
  useEffect(() => {
    loadModels();
  }, [userId]);

  const loadModels = async () => {
    try {
      setIsLoadingModels(true);
      setError(null);

      const response = await fetch('/api/chat/models', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load models');
      }

      const data = await response.json();
      setModels(data.models);

      // Select default or previously selected model
      if (data.models.length > 0) {
        const defaultModel = data.models.find(m => m.model_id === data.default_model_id)
          || data.models.find(m => m.available)
          || data.models[0];

        setSelectedModel(defaultModel);
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to load models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const selectModel = useCallback((model: Model) => {
    if (model.available) {
      setSelectedModel(model);

      // Persist user preference
      localStorage.setItem('preferred_model_id', model.model_id);

      // Update user preference on server
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          default_model_id: model.model_id
        })
      }).catch(console.error);
    }
  }, []);

  const checkModelAvailability = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/chat/models/${modelId}/availability`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.available;
    } catch (err) {
      console.error('Failed to check model availability:', err);
      return false;
    }
  }, []);

  const refreshModels = useCallback(async () => {
    await loadModels();
  }, [userId]);

  return {
    models,
    selectedModel,
    isLoadingModels,
    error,
    selectModel,
    checkModelAvailability,
    refreshModels
  };
};