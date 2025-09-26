/**
 * MessageList Component
 * Displays conversation messages with proper formatting
 */

import React, { useRef, useEffect } from 'react';
import { Message } from './hooks/useChat';

export interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  streamingContent?: string;
  className?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading = false,
  streamingContent = '',
  className = ''
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const formatContent = (content: string): JSX.Element => {
    // Basic markdown-like formatting
    const lines = content.split('\n');
    return (
      <>
        {lines.map((line, index) => {
          // Code block detection
          if (line.startsWith('```')) {
            return null; // Handle code blocks separately if needed
          }

          // Bold text
          line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

          // Italic text
          line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');

          // Links
          line = line.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
          );

          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: line }}
              className="block mb-1"
            />
          );
        })}
      </>
    );
  };

  const getMessageIcon = (role: string) => {
    if (role === 'user') {
      return (
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
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    } else {
      return (
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
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    }
  };

  return (
    <div
      ref={scrollRef}
      className={`flex flex-col space-y-4 p-4 overflow-y-auto ${className}`}
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`flex max-w-[80%] ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white ml-2'
                  : 'bg-gray-200 text-gray-600 mr-2'
              }`}
              aria-hidden="true"
            >
              {getMessageIcon(message.role)}
            </div>
            <div
              className={`px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="text-sm">
                {formatContent(message.content)}
              </div>
              {message.model_id && (
                <div className="text-xs mt-1 opacity-70">
                  {message.model_id}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Streaming message */}
      {streamingContent && (
        <div className="flex justify-start">
          <div className="flex flex-row max-w-[80%]">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 mr-2 flex items-center justify-center"
              aria-hidden="true"
            >
              {getMessageIcon('assistant')}
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800">
              <div className="text-sm">
                {formatContent(streamingContent)}
                <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && !streamingContent && (
        <div className="flex justify-start">
          <div className="flex flex-row max-w-[80%]">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 mr-2 flex items-center justify-center"
              aria-hidden="true"
            >
              {getMessageIcon('assistant')}
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};