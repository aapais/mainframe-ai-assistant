import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface SearchResult {
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

class SimpleKnowledgeBaseService {
  private entries: SearchResult[] = [];
  private dataPath: string;

  constructor() {
    // Initialize in-memory data store
    const memoryDir = path.join(__dirname, '..', '..', 'memory');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    this.dataPath = path.join(memoryDir, 'knowledge-entries.json');
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        this.entries = JSON.parse(data);
        console.log(`✅ Loaded ${this.entries.length} knowledge base entries`);
      } else {
        console.log('📝 No existing knowledge base data found');
        this.entries = [];
      }
    } catch (error) {
      console.error('❌ Error loading knowledge base data:', error);
      this.entries = [];
    }
  }

  private saveData() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.entries, null, 2));
      console.log(`💾 Saved ${this.entries.length} knowledge base entries`);
    } catch (error) {
      console.error('❌ Error saving knowledge base data:', error);
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const startTime = Date.now();

      if (!query || query.trim().length === 0) {
        return this.entries.slice(0, 20); // Return first 20 entries if no query
      }

      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

      // Simple text-based search
      const results = this.entries.filter(entry => {
        const searchableText = `${entry.title} ${entry.problem} ${entry.solution} ${entry.category} ${entry.tags.join(' ')}`.toLowerCase();

        return searchTerms.some(term => searchableText.includes(term));
      });

      // Sort by relevance (number of matching terms)
      const scoredResults = results.map(entry => {
        const searchableText = `${entry.title} ${entry.problem} ${entry.solution} ${entry.category} ${entry.tags.join(' ')}`.toLowerCase();
        let score = 0;

        searchTerms.forEach(term => {
          const titleMatches = (entry.title.toLowerCase().match(new RegExp(term, 'g')) || []).length;
          const problemMatches = (entry.problem.toLowerCase().match(new RegExp(term, 'g')) || []).length;
          const solutionMatches = (entry.solution.toLowerCase().match(new RegExp(term, 'g')) || []).length;

          score += titleMatches * 3; // Title matches are more important
          score += problemMatches * 2;
          score += solutionMatches * 1;
        });

        return { entry, score };
      });

      const sortedResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(result => result.entry);

      const endTime = Date.now();
      console.log(`Search completed in ${endTime - startTime}ms, found ${sortedResults.length} results`);

      return sortedResults;

    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async addEntry(entry: Omit<SearchResult, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const newId = Math.max(...this.entries.map(e => e.id), 0) + 1;
      const now = new Date().toISOString();

      const newEntry: SearchResult = {
        id: newId,
        title: entry.title,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category,
        tags: entry.tags || [],
        severity: entry.severity || 'medium',
        created_at: now,
        updated_at: now
      };

      this.entries.push(newEntry);
      this.saveData();

      return newId;

    } catch (error) {
      console.error('Add entry error:', error);
      throw error;
    }
  }

  async updateEntry(id: number, updates: Partial<SearchResult>): Promise<boolean> {
    try {
      const entryIndex = this.entries.findIndex(entry => entry.id === id);

      if (entryIndex === -1) {
        return false;
      }

      const entry = this.entries[entryIndex];
      const updatedEntry = {
        ...entry,
        ...updates,
        id: entry.id, // Preserve original ID
        created_at: entry.created_at, // Preserve creation date
        updated_at: new Date().toISOString()
      };

      this.entries[entryIndex] = updatedEntry;
      this.saveData();

      return true;

    } catch (error) {
      console.error('Update entry error:', error);
      throw error;
    }
  }

  async deleteEntry(id: number): Promise<boolean> {
    try {
      const entryIndex = this.entries.findIndex(entry => entry.id === id);

      if (entryIndex === -1) {
        return false;
      }

      this.entries.splice(entryIndex, 1);
      this.saveData();

      return true;

    } catch (error) {
      console.error('Delete entry error:', error);
      throw error;
    }
  }

  getStats() {
    const categoryStats: { [key: string]: number } = {};
    const severityStats: { [key: string]: number } = {};

    this.entries.forEach(entry => {
      categoryStats[entry.category] = (categoryStats[entry.category] || 0) + 1;
      severityStats[entry.severity] = (severityStats[entry.severity] || 0) + 1;
    });

    return {
      total: this.entries.length,
      categories: categoryStats,
      severities: severityStats,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Initialize service
const kbService = new SimpleKnowledgeBaseService();

// Register IPC handlers
export function registerSimpleIPCHandlers() {
  // Search knowledge base
  ipcMain.handle('search-kb', async (event, query: string) => {
    try {
      const results = await kbService.search(query);
      return { success: true, data: results };
    } catch (error) {
      console.error('IPC search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  });

  // Add knowledge base entry
  ipcMain.handle('add-kb-entry', async (event, entry: Omit<SearchResult, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = await kbService.addEntry(entry);
      return { success: true, data: id };
    } catch (error) {
      console.error('IPC add entry error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Add entry failed'
      };
    }
  });

  // Update knowledge base entry
  ipcMain.handle('update-kb-entry', async (event, id: number, updates: Partial<SearchResult>) => {
    try {
      const success = await kbService.updateEntry(id, updates);
      return { success, data: success };
    } catch (error) {
      console.error('IPC update entry error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update entry failed'
      };
    }
  });

  // Delete knowledge base entry
  ipcMain.handle('delete-kb-entry', async (event, id: number) => {
    try {
      const success = await kbService.deleteEntry(id);
      return { success, data: success };
    } catch (error) {
      console.error('IPC delete entry error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete entry failed'
      };
    }
  });

  // Get knowledge base statistics
  ipcMain.handle('get-kb-stats', async (event) => {
    try {
      const stats = kbService.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('IPC get stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get stats failed'
      };
    }
  });

  console.log('✅ Simple IPC handlers registered');
}