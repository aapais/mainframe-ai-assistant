import { useCallback, useEffect, useState } from 'react';

// Define types for IPC communication
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SearchResult {
  id: number;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  severity: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

// Custom hook for IPC communication
export const useIPC = () => {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && 'electronAPI' in window);
  }, []);

  const invoke = useCallback(
    async <T = any>(channel: string, ...args: any[]): Promise<IPCResponse<T>> => {
      if (!isElectron) {
        console.warn('Not running in Electron environment');
        return { success: false, error: 'Not in Electron environment' };
      }

      try {
        const response = await (window as any).electronAPI.invoke(channel, ...args);
        return response;
      } catch (error) {
        console.error('IPC Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown IPC error',
        };
      }
    },
    [isElectron]
  );

  return { invoke, isElectron };
};

// Custom hook for knowledge base operations
export const useKnowledgeBase = () => {
  const { invoke } = useIPC();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!query.trim()) return [];

      setLoading(true);
      setError(null);

      try {
        const response = await invoke<SearchResult[]>('search-kb', query);

        if (response.success && response.data) {
          return response.data;
        } else {
          throw new Error(response.error || 'Search failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        console.error('Search error:', err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [invoke]
  );

  const addEntry = useCallback(
    async (entry: Omit<SearchResult, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke('add-kb-entry', entry);

        if (!response.success) {
          throw new Error(response.error || 'Failed to add entry');
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add entry';
        setError(errorMessage);
        console.error('Add entry error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [invoke]
  );

  const updateEntry = useCallback(
    async (id: number, entry: Partial<SearchResult>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke('update-kb-entry', id, entry);

        if (!response.success) {
          throw new Error(response.error || 'Failed to update entry');
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update entry';
        setError(errorMessage);
        console.error('Update entry error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [invoke]
  );

  const deleteEntry = useCallback(
    async (id: number): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke('delete-kb-entry', id);

        if (!response.success) {
          throw new Error(response.error || 'Failed to delete entry');
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete entry';
        setError(errorMessage);
        console.error('Delete entry error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [invoke]
  );

  return {
    search,
    addEntry,
    updateEntry,
    deleteEntry,
    loading,
    error,
    clearError: () => setError(null),
  };
};
