/**
 * useChat Hook
 * Manages chat state and operations
 */

import { useState, useEffect, useCallback } from 'react';

export interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  model_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id?: string;
  tokens_used?: number;
  created_at: Date;
}

export interface TokenWarning {
  current_tokens: number;
  max_tokens: number;
}

export interface SendMessageOptions {
  stream?: boolean;
  model_id?: string;
}

export const useChat = (userId: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenWarning, setTokenWarning] = useState<TokenWarning | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [userId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation?.id]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/conversations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      setConversations(data.conversations);

      // Select most recent conversation if available
      if (data.conversations.length > 0 && !currentConversation) {
        setCurrentConversation(data.conversations[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      setMessages(data.messages || []);

      // Check for token warning
      if (data.approaching_limit) {
        setTokenWarning({
          current_tokens: data.token_count,
          max_tokens: data.token_limit
        });
      } else {
        setTokenWarning(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = useCallback(async (title?: string, modelId?: string) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ title, model_id: modelId })
      });

      if (!response.ok) throw new Error('Failed to create conversation');

      const conversation = await response.json();
      setConversations(prev => [conversation, ...prev]);
      setCurrentConversation(conversation);
      setMessages([]);

      return conversation;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    options: SendMessageOptions = {}
  ) => {
    if (!currentConversation) {
      throw new Error('No conversation selected');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Add user message optimistically
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversation.id,
        role: 'user',
        content,
        created_at: new Date()
      };
      setMessages(prev => [...prev, tempUserMessage]);

      const response = await fetch(
        `/api/chat/conversations/${currentConversation.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            content,
            model_id: options.model_id
          })
        }
      );

      if (!response.ok) throw new Error('Failed to send message');

      if (options.stream && response.body) {
        // Return the stream for handling by useStreaming
        return response.body;
      } else {
        const data = await response.json();

        // Replace temp message with real one and add assistant response
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempUserMessage.id);
          return [...filtered, data.user_message, data.assistant_message];
        });

        // Check for token warning
        if (data.token_warning) {
          setTokenWarning(data.token_warning);
        }

        return data.assistant_message.content;
      }
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversation]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete conversation');

      setConversations(prev => prev.filter(c => c.id !== conversationId));

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    tokenWarning,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    clearError
  };
};