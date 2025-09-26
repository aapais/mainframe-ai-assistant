/**
 * ModelSelector Component
 * Dropdown for selecting AI models
 */

import React from 'react';

export interface Model {
  model_id: string;
  name: string;
  provider: string;
  max_tokens: number;
  supports_streaming: boolean;
  available: boolean;
}

export interface ModelSelectorProps {
  models: Model[];
  selectedModel: Model | null;
  onModelChange: (modelId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onModelChange,
  isLoading = false,
  className = ''
}) => {
  const availableModels = models.filter(m => m.available);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    if (modelId) {
      onModelChange(modelId);
    }
  };

  const getModelIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'gemini':
      case 'google':
        return '✨';
      default:
        return '🔧';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <label
        htmlFor="model-selector"
        className="text-sm font-medium text-gray-700"
      >
        Model:
      </label>
      <div className="relative flex-1">
        <select
          id="model-selector"
          value={selectedModel?.model_id || ''}
          onChange={handleChange}
          disabled={isLoading || availableModels.length === 0}
          className="w-full px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none pr-8"
          aria-label="Select AI model"
          aria-describedby="model-description"
        >
          {availableModels.length === 0 ? (
            <option value="">No models available</option>
          ) : (
            <>
              <option value="">Select a model</option>
              {availableModels.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {getModelIcon(model.provider)} {model.name}
                  {model.supports_streaming && ' ⚡'}
                </option>
              ))}
            </>
          )}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      {isLoading && (
        <div
          className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"
          aria-label="Loading models"
        />
      )}
      {selectedModel && (
        <div id="model-description" className="sr-only">
          Selected: {selectedModel.name} from {selectedModel.provider}.
          Maximum {selectedModel.max_tokens} tokens.
          {selectedModel.supports_streaming
            ? ' Supports streaming responses.'
            : ' Standard responses only.'}
        </div>
      )}
    </div>
  );
};