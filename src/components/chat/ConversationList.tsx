/**
 * ConversationList Component
 * Displays list of chat conversations
 */

import React from 'react';
import { Conversation } from './hooks/useChat';

export interface ConversationListProps {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  onSelect: (conversation: Conversation) => void;
  onDelete: (conversationId: string) => void;
  className?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversation,
  onSelect,
  onDelete,
  className = ''
}) => {
  const handleDelete = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      onDelete(conversationId);
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>
      <div className="px-2 py-2">
        <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Recent Conversations
        </h3>
        <div className="mt-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-sm text-gray-500 text-center">
              No conversations yet
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors group flex items-center justify-between ${
                  currentConversation?.id === conversation.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                aria-current={currentConversation?.id === conversation.id ? 'true' : 'false'}
                aria-label={`Select conversation: ${conversation.title || 'Untitled'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {conversation.title || 'Untitled Conversation'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {new Date(conversation.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conversation.id)}
                  className="opacity-0 group-hover:opacity-100 ml-2 p-1 rounded hover:bg-red-100 text-red-600 transition-opacity"
                  aria-label={`Delete conversation: ${conversation.title || 'Untitled'}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};