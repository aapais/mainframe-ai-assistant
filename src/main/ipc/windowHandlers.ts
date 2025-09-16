/**
 * IPC Window Handlers Registration
 * Registers all IPC handlers for window management and application operations
 */

import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import path from 'path';
import { KnowledgeBaseService } from '../../services/KnowledgeBaseService';
import { GeminiService } from '../../services/GeminiService';
import { BatchProcessor } from './BatchProcessor';
import {
  BatchRequestPayload,
  BatchResponsePayload
} from '../../shared/types/BatchTypes';
import {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchQuery,
  DatabaseMetrics
} from '../../types';

// Services
let kbService: KnowledgeBaseService;
let geminiService: GeminiService | null = null;
let batchProcessor: BatchProcessor;

/**
 * Initialize services and IPC handlers
 */
export async function initializeIpcHandlers() {
  // Initialize Knowledge Base Service
  kbService = new KnowledgeBaseService();
  await kbService.initialize();

  // Initialize optional Gemini service
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      geminiService = new GeminiService({
        apiKey: geminiApiKey,
        model: 'gemini-pro',
        temperature: 0.3
      });
      console.log('Gemini AI service initialized');
    } catch (error) {
      console.warn('Failed to initialize Gemini service:', error);
      geminiService = null;
    }
  } else {
    console.warn('GEMINI_API_KEY not found - AI search will be disabled');
  }

  // Initialize Batch Processor for performance optimization
  batchProcessor = new BatchProcessor({
    // Pass database manager and cache when available
    // databaseManager: kbService.getDatabaseManager(),
    // cache: kbService.getCache(),
    maxConcurrentRequests: 10,
    defaultTimeout: 5000
  });

  // Register all IPC handlers
  registerKnowledgeBaseHandlers();
  registerSearchHandlers();
  registerSystemHandlers();
  registerWindowHandlers();
  registerBatchHandlers();
  registerApplicationHandlers();
  registerThemeHandlers();
  registerDevelopmentHandlers();

  console.log('All IPC handlers registered successfully');
}

/**
 * Knowledge Base operation handlers
 */
function registerKnowledgeBaseHandlers() {
  // Get KB entries
  ipcMain.handle('kb:get-entries', async (event, query?: SearchQuery): Promise<SearchResult[]> => {
    try {
      if (query?.query) {
        return await kbService.search(query.query, query);
      } else {
        // Return recent entries
        const result = await kbService.list({ 
          limit: query?.limit || 20, 
          sortBy: 'updated_at', 
          sortOrder: 'desc' 
        });
        return result.data.map(entry => ({
          entry,
          score: 100,
          matchType: 'exact' as const,
          highlights: []
        }));
      }
    } catch (error) {
      console.error('Failed to get KB entries:', error);
      return [];
    }
  });

  // Add new KB entry
  ipcMain.handle('kb:add-entry', async (event, entry: KBEntryInput): Promise<string> => {
    try {
      return await kbService.create(entry);
    } catch (error) {
      console.error('Failed to add KB entry:', error);
      throw error;
    }
  });

  // Update KB entry
  ipcMain.handle('kb:update-entry', async (event, id: string, updates: KBEntryUpdate): Promise<void> => {
    try {
      const success = await kbService.update(id, updates);
      if (!success) {
        throw new Error('Entry not found or update failed');
      }
    } catch (error) {
      console.error('Failed to update KB entry:', error);
      throw error;
    }
  });

  // Delete KB entry
  ipcMain.handle('kb:delete-entry', async (event, id: string): Promise<void> => {
    try {
      const success = await kbService.delete(id);
      if (!success) {
        throw new Error('Entry not found or delete failed');
      }
    } catch (error) {
      console.error('Failed to delete KB entry:', error);
      throw error;
    }
  });

  // Get single KB entry
  ipcMain.handle('kb:get-entry', async (event, id: string): Promise<KBEntry | null> => {
    try {
      return await kbService.read(id);
    } catch (error) {
      console.error('Failed to get KB entry:', error);
      return null;
    }
  });
}

/**
 * Search operation handlers
 */
function registerSearchHandlers() {
  // Local search
  ipcMain.handle('search:local', async (event, query: string, options?: SearchQuery): Promise<SearchResult[]> => {
    try {
      return await kbService.search(query, options || {});
    } catch (error) {
      console.error('Local search failed:', error);
      return [];
    }
  });

  // AI-enhanced search
  ipcMain.handle('search:ai', async (event, query: string, options?: SearchQuery): Promise<SearchResult[]> => {
    try {
      if (!geminiService) {
        throw new Error('AI search service not available');
      }

      // Get local results first
      const localResults = await kbService.search(query, options || {});
      
      if (localResults.length === 0) {
        return [];
      }

      // Enhance with AI matching
      const entries = localResults.map(result => result.entry);
      const aiResults = await geminiService.findSimilar(query, entries);
      
      return aiResults.length > 0 ? aiResults : localResults;
    } catch (error) {
      console.error('AI search failed:', error);
      // Fallback to local search
      return await kbService.search(query, options || {});
    }
  });
}

/**
 * Feedback and rating handlers
 */
function registerFeedbackHandlers() {
  // Rate entry
  ipcMain.handle('feedback:rate-entry', async (event, id: string, successful: boolean, comment?: string): Promise<void> => {
    try {
      await kbService.recordUsage(id, successful);
      
      // If there's a comment, we could store it in a separate feedback table
      if (comment) {
        console.log(`Feedback for entry ${id}: ${comment}`);
        // TODO: Implement comment storage if needed
      }
    } catch (error) {
      console.error('Failed to rate entry:', error);
      throw error;
    }
  });

  // Record entry view
  ipcMain.handle('feedback:record-view', async (event, id: string): Promise<void> => {
    try {
      // Just increment usage count without affecting success/failure rates
      await kbService.recordUsage(id, true);
    } catch (error) {
      console.error('Failed to record entry view:', error);
      // Don't throw error for view recording failures
    }
  });
}

/**
 * System operation handlers
 */
function registerSystemHandlers() {
  // Get system metrics
  ipcMain.handle('system:get-metrics', async (): Promise<DatabaseMetrics> => {
    try {
      return await kbService.getMetrics();
    } catch (error) {
      console.error('Failed to get metrics:', error);
      // Return empty metrics
      return {
        total_entries: 0,
        searches_today: 0,
        avg_response_time: 0,
        cache_hit_rate: 0,
        storage_used_mb: 0
      };
    }
  });

  // Export KB
  ipcMain.handle('system:export-kb', async (event, suggestedPath?: string): Promise<string> => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Knowledge Base',
        defaultPath: suggestedPath || `kb-export-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Export canceled by user');
      }

      const exportData = await kbService.export();
      const fs = await import('fs/promises');
      await fs.writeFile(result.filePath, exportData, 'utf8');
      
      return result.filePath;
    } catch (error) {
      console.error('Failed to export KB:', error);
      throw error;
    }
  });

  // Import KB
  ipcMain.handle('system:import-kb', async (event, suggestedPath?: string): Promise<number> => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Knowledge Base',
        defaultPath: suggestedPath,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error('Import canceled by user');
      }

      const fs = await import('fs/promises');
      const importData = await fs.readFile(result.filePaths[0], 'utf8');
      const importResult = await kbService.import(importData);
      
      return importResult.restored;
    } catch (error) {
      console.error('Failed to import KB:', error);
      throw error;
    }
  });

  // Check database status
  ipcMain.handle('system:check-database', async (): Promise<{ connected: boolean; isEmpty: boolean }> => {
    try {
      const metrics = await kbService.getMetrics();
      return {
        connected: true,
        isEmpty: metrics.total_entries === 0
      };
    } catch (error) {
      console.error('Database check failed:', error);
      return { connected: false, isEmpty: true };
    }
  });

  // Load initial templates
  ipcMain.handle('system:load-templates', async (): Promise<void> => {
    try {
      // Load default KB entries from templates
      const templatesPath = path.join(__dirname, '../../../assets/kb-templates/initial-kb.json');
      const fs = await import('fs/promises');
      
      try {
        const templatesData = await fs.readFile(templatesPath, 'utf8');
        await kbService.import(templatesData);
        console.log('Initial KB templates loaded successfully');
      } catch (fileError) {
        console.warn('Could not load templates from file, creating basic entries');
        // Create a few basic entries programmatically
        await createBasicEntries();
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      throw error;
    }
  });

  // Check AI service availability
  ipcMain.handle('system:check-ai', async (): Promise<{ available: boolean; model?: string }> => {
    if (geminiService) {
      return { available: true, model: 'gemini-pro' };
    } else {
      return { available: false };
    }
  });
}

/**
 * Window management handlers
 */
function registerWindowHandlers() {
  // Window state operations
  ipcMain.handle('window:minimize', async (event, windowId: string): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.minimize();
    }
  });

  ipcMain.handle('window:maximize', async (event, windowId: string): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.handle('window:restore', async (event, windowId: string): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.restore();
    }
  });

  ipcMain.handle('window:focus', async (event, windowId: string): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.focus();
    }
  });

  ipcMain.handle('window:close', async (event, windowId: string): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.close();
    }
  });

  // Window state management
  ipcMain.handle('window:get-state', async (event, windowId: string): Promise<any> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      const bounds = window.getBounds();
      return {
        bounds,
        isMaximized: window.isMaximized(),
        isMinimized: window.isMinimized(),
        isFocused: window.isFocused(),
        isVisible: window.isVisible()
      };
    }
    return null;
  });

  ipcMain.handle('window:update-state', async (event, windowId: string, state: any): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && state.bounds) {
      window.setBounds(state.bounds);
    }
  });
}

/**
 * Application lifecycle handlers
 */
function registerApplicationHandlers() {
  // Close application
  ipcMain.handle('app:close', async (): Promise<void> => {
    app.quit();
  });

  // Get app version
  ipcMain.handle('app:get-version', async (): Promise<string> => {
    return app.getVersion();
  });

  // Check for updates (stub implementation)
  ipcMain.handle('app:check-updates', async (): Promise<boolean> => {
    // TODO: Implement actual update checking
    console.log('Update check requested');
    return false;
  });
}

/**
 * Theme management handlers
 */
function registerThemeHandlers() {
  let currentTheme: 'light' | 'dark' = 'light';

  // Get current theme
  ipcMain.handle('theme:get', async (): Promise<'light' | 'dark'> => {
    return currentTheme;
  });

  // Set theme
  ipcMain.handle('theme:set', async (event, theme: 'light' | 'dark'): Promise<void> => {
    currentTheme = theme;
    
    // Broadcast theme change to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('theme:changed', theme);
    });
  });
}

/**
 * Development tools handlers
 */
function registerDevelopmentHandlers() {
  // Open dev tools
  ipcMain.on('dev:open-devtools', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.webContents.openDevTools();
    }
  });
}

/**
 * Batch processing handlers for performance optimization
 */
function registerBatchHandlers() {
  // Main batch execution handler
  ipcMain.handle('ipc:execute-batch', async (event, payload: BatchRequestPayload): Promise<BatchResponsePayload> => {
    try {
      console.log(`[BatchHandler] Processing batch ${payload.batchId} with ${payload.requests.length} requests`);
      return await batchProcessor.processBatch(payload);
    } catch (error) {
      console.error('[BatchHandler] Batch processing failed:', error);
      throw error;
    }
  });

  // Batch statistics handler
  ipcMain.handle('ipc:batch-stats', async (): Promise<any> => {
    return batchProcessor.getStats();
  });

  // Clear batch statistics
  ipcMain.handle('ipc:clear-batch-stats', async (): Promise<void> => {
    batchProcessor.clearStats();
  });
}

/**
 * Create basic KB entries if templates can't be loaded
 */
async function createBasicEntries(): Promise<void> {
  const basicEntries: KBEntryInput[] = [
    {
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
      solution: '1. Verify the dataset exists using ISPF 3.4 or LISTCAT command\n2. Check the DD statement in JCL has correct DSN\n3. Ensure file is cataloged properly\n4. Verify RACF permissions using LISTDSD\n5. Check if file was deleted or renamed',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
      created_by: 'system'
    },
    {
      title: 'S0C7 - Data Exception in COBOL',
      problem: 'Program abends with S0C7 data exception during arithmetic operations.',
      solution: '1. Check for non-numeric data in numeric fields\n2. Initialize all COMP-3 fields properly\n3. Use NUMERIC test before arithmetic\n4. Add DISPLAY statements for debugging\n5. Check compile listing for data definitions',
      category: 'Batch',
      tags: ['s0c7', 'data-exception', 'numeric', 'abend', 'cobol'],
      created_by: 'system'
    },
    {
      title: 'JCL Error - Dataset Not Found (IEF212I)',
      problem: 'JCL fails with IEF212I dataset not found error',
      solution: '1. Verify dataset name spelling exactly\n2. Check if dataset exists using TSO LISTD\n3. For GDG: Verify generation exists\n4. Check dataset expiration\n5. Verify UNIT and VOL parameters if uncataloged',
      category: 'JCL',
      tags: ['jcl', 'dataset', 'not-found', 'ief212i'],
      created_by: 'system'
    }
  ];

  for (const entry of basicEntries) {
    try {
      await kbService.create(entry);
    } catch (error) {
      console.error('Failed to create basic entry:', entry.title, error);
    }
  }
}

export default initializeIpcHandlers;