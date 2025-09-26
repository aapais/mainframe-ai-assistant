/**
 * ChatInterface Component
 * Main interface combining all chat components
 */

import React from 'react';
import { ConversationList } from './ConversationList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ModelSelector } from './ModelSelector';
import { TokenWarning } from './TokenWarning';
import { Conversation, Message } from './hooks/useChat';
import { Model } from './hooks/useModels';

export interface ChatInterfaceProps {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  models: Model[];
  selectedModel: Model | null;
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  tokenWarning: { current_tokens: number; max_tokens: number } | null;
  onConversationSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onModelChange: (modelId: string) => void;
  onSendMessage: (message: string) => void;
  className?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversations,
  currentConversation,
  messages,
  models,
  selectedModel,
  isLoading,
  isStreaming,
  streamingContent,
  tokenWarning,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation,
  onModelChange,
  onSendMessage,
  className = ''
}) => {
  return (
    <div className={`flex h-full bg-gray-50 ${className}`}>
      {/* Sidebar with conversations */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onNewConversation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center space-x-2"
            aria-label="Start new conversation"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New Chat</span>
          </button>
        </div>
        <ConversationList
          conversations={conversations}
          currentConversation={currentConversation}
          onSelect={onConversationSelect}
          onDelete={onDeleteConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header with model selector */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {currentConversation?.title || 'New Conversation'}
              </h2>
              {currentConversation && (
                <p className="text-sm text-gray-500">
                  {new Date(currentConversation.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Token warning */}
        {tokenWarning && (
          <div className="px-6 py-3">
            <TokenWarning
              currentTokens={tokenWarning.current_tokens}
              maxTokens={tokenWarning.max_tokens}
            />
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-hidden">
          {currentConversation ? (
            <MessageList
              messages={messages}
              isLoading={isLoading || isStreaming}
              streamingContent={streamingContent}
              className="h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-gray-300"
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
                <p>Select a conversation or start a new one</p>
              </div>
            </div>
          )}
        </div>

        {/* Message input */}
        {currentConversation && (
          <MessageInput
            onSend={onSendMessage}
            disabled={isLoading || isStreaming || !selectedModel}
            placeholder={
              !selectedModel
                ? 'Select a model to start chatting'
                : 'Type your message...'
            }
          />
        )}
      </div>
    </div>
  );
};