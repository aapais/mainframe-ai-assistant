/**
 * useStreaming Hook
 * Handles Server-Sent Events for streaming responses
 */

import { useState, useCallback, useRef } from 'react';

export interface StreamEvent {
  type: 'start' | 'content' | 'done' | 'error';
  content?: string;
  error?: string;
  message_id?: string;
}

export const useStreaming = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const decoderRef = useRef(new TextDecoder());
  const bufferRef = useRef('');

  const parseSSEMessage = (message: string): StreamEvent | null => {
    try {
      const lines = message.split('\n');
      let event = '';
      let data = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          data = line.slice(5).trim();
        }
      }

      if (event && data) {
        const parsedData = JSON.parse(data);
        return {
          type: parsedData.type || event,
          ...parsedData
        };
      }
    } catch (err) {
      console.error('Failed to parse SSE message:', err);
    }
    return null;
  };

  const startStreaming = useCallback(async (stream: ReadableStream<Uint8Array>) => {
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    try {
      const reader = stream.getReader();
      readerRef.current = reader;
      bufferRef.current = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        const chunk = decoderRef.current.decode(value, { stream: true });
        bufferRef.current += chunk;

        // Process complete messages
        const messages = bufferRef.current.split('\n\n');
        bufferRef.current = messages.pop() || '';

        for (const message of messages) {
          if (message.trim()) {
            const event = parseSSEMessage(message);

            if (event) {
              switch (event.type) {
                case 'start':
                  // Streaming started
                  break;

                case 'content':
                  if (event.content) {
                    setStreamingContent(prev => prev + event.content);
                  }
                  break;

                case 'done':
                  // Streaming completed
                  setIsStreaming(false);
                  break;

                case 'error':
                  setError(event.error || 'Streaming error occurred');
                  setIsStreaming(false);
                  break;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming error:', err);
      setError(err.message || 'Failed to stream response');
    } finally {
      setIsStreaming(false);
      readerRef.current = null;
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(console.error);
      readerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearStreamingContent = useCallback(() => {
    setStreamingContent('');
    setError(null);
  }, []);

  return {
    isStreaming,
    streamingContent,
    error,
    startStreaming,
    stopStreaming,
    clearStreamingContent
  };
};