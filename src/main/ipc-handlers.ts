/**
 * IPC Handlers for Main Process
 * Simple electron IPC communication layer
 */

import { ipcMain } from 'electron';
import { KnowledgeService } from '../services/KnowledgeService';
import { SearchService } from '../services/SearchService';

let knowledgeService: KnowledgeService;
let searchService: SearchService;

export function setupIpcHandlers() {
  // Initialize services
  knowledgeService = new KnowledgeService();
  searchService = new SearchService();

  // KB Entry Operations
  ipcMain.handle('kb:search', async (_, query: string) => {
    try {
      return await searchService.search(query);
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:getEntry', async (_, id: string) => {
    try {
      return await knowledgeService.getEntry(id);
    } catch (error) {
      console.error('Get entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:addEntry', async (_, entry: any) => {
    try {
      const result = await knowledgeService.addEntry(entry);
      return { success: true, data: result };
    } catch (error) {
      console.error('Add entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:updateEntry', async (_, id: string, entry: any) => {
    try {
      const result = await knowledgeService.updateEntry(id, entry);
      return { success: true, data: result };
    } catch (error) {
      console.error('Update entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:rateEntry', async (_, id: string, successful: boolean) => {
    try {
      await knowledgeService.rateEntry(id, successful);
      return { success: true };
    } catch (error) {
      console.error('Rate entry error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('kb:getMetrics', async () => {
    try {
      const metrics = await knowledgeService.getMetrics();
      return { success: true, data: metrics };
    } catch (error) {
      console.error('Get metrics error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ IPC handlers registered successfully');
}