/**
 * useChat Hook - JavaScript version
 * Manages chat state and operations
 */

function useChat(userId) {
  const [conversations, setConversations] = React.useState([]);
  const [currentConversation, setCurrentConversation] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [tokenWarning, setTokenWarning] = React.useState(null);

  // Load conversations on mount
  React.useEffect(() => {
    loadConversations();
  }, [userId]);

  // Load messages when conversation changes
  React.useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation?.id]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/chat/conversations', {
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

  const loadMessages = async (conversationId) => {
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

  const createConversation = React.useCallback(async (title, modelId) => {
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

  const selectConversation = React.useCallback((conversation) => {
    setCurrentConversation(conversation);
  }, []);

  const sendMessage = React.useCallback(async (
    content,
    options = {}
  ) => {
    if (!currentConversation) {
      throw new Error('No conversation selected');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Add user message optimistically
      const tempUserMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversation.id,
        role: 'user',
        content,
        created_at: new Date()
      };
      setMessages(prev => [...prev, tempUserMessage]);

      // Get API keys from localStorage
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      const apiKeys = {
        openai_api_key: settings.apiKey || settings.openai_api_key,
        gemini_api_key: settings.geminiApiKey || settings.gemini_api_key || settings.google_generative_ai_key
      };

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
            model_id: options.model_id,
            ...apiKeys  // Include API keys in the request
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
      setError(err.message);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversation]);

  const deleteConversation = React.useCallback(async (conversationId) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete conversation');

      // Remove from list
      setConversations(prev => prev.filter(c => c.id !== conversationId));

      // Clear current if it was deleted
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [currentConversation]);

  const switchModel = React.useCallback(async (modelId) => {
    if (!currentConversation) return;

    try {
      const response = await fetch(
        `/api/chat/conversations/${currentConversation.id}/model`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ model_id: modelId })
        }
      );

      if (!response.ok) throw new Error('Failed to switch model');

      const updated = await response.json();
      setCurrentConversation(updated);

      // Update in conversations list
      setConversations(prev =>
        prev.map(c => c.id === updated.id ? updated : c)
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [currentConversation]);

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    tokenWarning,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    switchModel
  };
}

// Export for use in components
window.useChat = useChat;