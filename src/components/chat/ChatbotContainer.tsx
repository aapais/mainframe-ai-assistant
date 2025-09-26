/**
 * ChatbotContainer Component
 * Main container for the RAG chatbot interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChatInterface } from './ChatInterface';
import { ModelSelector } from './ModelSelector';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TokenWarning } from './TokenWarning';
import { useChat } from './hooks/useChat';
import { useModels } from './hooks/useModels';
import { useStreaming } from './hooks/useStreaming';

export interface ChatbotContainerProps {
  userId: string;
  className?: string;
  onClose?: () => void;
}

export const ChatbotContainer: React.FC<ChatbotContainerProps> = ({
  userId,
  className = '',
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    tokenWarning
  } = useChat(userId);

  const {
    models,
    selectedModel,
    isLoadingModels,
    selectModel
  } = useModels(userId);

  const {
    isStreaming,
    streamingContent,
    startStreaming,
    stopStreaming
  } = useStreaming();

  // Create new conversation on first open
  useEffect(() => {
    if (isOpen && !currentConversation && !isLoading) {
      handleNewConversation();
    }
  }, [isOpen, currentConversation, isLoading]);

  const handleNewConversation = async () => {
    if (selectedModel) {
      await createConversation(undefined, selectedModel.model_id);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversation || !content.trim()) return;

    try {
      if (selectedModel?.supports_streaming) {
        const stream = await sendMessage(content, {
          stream: true,
          model_id: selectedModel.model_id
        });

        if (stream) {
          startStreaming(stream);
        }
      } else {
        await sendMessage(content, {
          stream: false,
          model_id: selectedModel?.model_id
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleModelChange = async (modelId: string) => {
    const model = models.find(m => m.model_id === modelId);
    if (model) {
      selectModel(model);
      // Update current conversation's model
      if (currentConversation) {
        // This would call an API to update the conversation model
      }
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (isMinimized) {
      setIsMinimized(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-4 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all z-50 ${className}`}
        aria-label="Open chat"
      >
        <svg
          className="w-6 h-6 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-20 right-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col transition-all z-50 ${
            isMinimized ? 'h-14' : 'h-[600px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">
                AI Assistant
              </h3>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleMinimize}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                aria-label={isMinimized ? 'Maximize' : 'Minimize'}
              >
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isMinimized ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onClose) onClose();
                }}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                aria-label="Close chat"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Model Selector */}
              <div className="px-4 py-2 border-b border-gray-200">
                <ModelSelector
                  models={models}
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  isLoading={isLoadingModels}
                />
              </div>

              {/* Token Warning */}
              {tokenWarning && (
                <div className="px-4 py-2">
                  <TokenWarning
                    currentTokens={tokenWarning.current_tokens}
                    maxTokens={tokenWarning.max_tokens}
                  />
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <MessageList
                  messages={messages}
                  isLoading={isLoading || isStreaming}
                  streamingContent={streamingContent}
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Message Input */}
              <div className="border-t border-gray-200">
                <MessageInput
                  onSend={handleSendMessage}
                  disabled={isLoading || isStreaming || !selectedModel}
                  placeholder={
                    !selectedModel
                      ? 'Select a model to start chatting'
                      : 'Type your message...'
                  }
                />
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};