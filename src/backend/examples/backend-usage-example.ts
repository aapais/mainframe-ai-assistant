/**
 * Search Backend Service Usage Example
 * Demonstrates how to integrate the search backend into your Electron application
 */

import { app, BrowserWindow } from 'electron';
import { createSearchBackend, SearchBackendService } from '../SearchBackendService';
import path from 'path';

class MainframeApp {
  private searchBackend?: SearchBackendService;
  private mainWindow?: BrowserWindow;

  async initialize(): Promise<void> {
    console.log('🚀 Starting Mainframe KB Assistant...');

    try {
      // Initialize search backend with custom configuration
      this.searchBackend = createSearchBackend({
        database: {
          path: path.join(app.getPath('userData'), 'knowledge-base.db'),
        },
        search: {
          maxResults: 50,
          defaultTimeout: 3000,
          enableAI: true,
          geminiApiKey: process.env.GEMINI_API_KEY,
        },
        performance: {
          enableMetrics: true,
          metricsRetentionDays: 30,
          historyRetentionDays: 90,
        },
      });

      // Initialize the backend services
      await this.searchBackend.initialize();

      // Check backend health
      const health = await this.searchBackend.healthCheck();
      console.log('Backend health:', health);

      console.log('✅ Search backend initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize search backend:', error);
      app.quit();
    }
  }

  async createWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js'),
      },
    });

    // Load your renderer
    await this.mainWindow.loadFile('dist/renderer/index.html');

    console.log('✅ Main window created');
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down application...');

    try {
      if (this.searchBackend) {
        await this.searchBackend.shutdown();
        console.log('✅ Search backend shut down');
      }

      if (this.mainWindow) {
        this.mainWindow.close();
      }
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }

    console.log('👋 Application shut down complete');
  }

  async demonstrateUsage(): Promise<void> {
    if (!this.searchBackend) {
      console.error('Backend not initialized');
      return;
    }

    try {
      console.log('\n📊 Backend Status:');
      const status = await this.searchBackend.getStatus();
      console.log(JSON.stringify(status, null, 2));

      console.log('\n📈 Performance Metrics:');
      const metrics = await this.searchBackend.getMetrics('1h');
      console.log('Total searches:', metrics.overview.totalSearches);
      console.log('Average response time:', metrics.overview.avgResponseTime, 'ms');
      console.log('Success rate:', (metrics.overview.successRate * 100).toFixed(1), '%');

      // Demonstrate direct service access (for advanced usage)
      const services = this.searchBackend.getServices();

      if (services.searchApiService && services.historyService) {
        console.log('\n🔍 Testing search functionality:');

        // Execute a test search
        const searchResult = await services.searchApiService.executeSearch({
          query: 'VSAM error',
          limit: 5,
          offset: 0,
          useAI: false, // Disable AI for this test
        });

        console.log('Search results:', searchResult.results.length);
        console.log('Response time:', searchResult.timing.totalTime, 'ms');

        // Get search history
        const history = await services.historyService.getHistory({
          limit: 10,
          offset: 0,
          timeframe: 24, // 24 hours
        });

        console.log('Recent searches:', history.entries.length);
      }

      // Demonstrate autocomplete
      if (services.autocompleteService) {
        console.log('\n✨ Testing autocomplete:');

        const suggestions = await services.autocompleteService.getAutocompleteSuggestions({
          query: 'JCL',
          limit: 5,
        });

        console.log(
          'Suggestions for "JCL":',
          suggestions.map(s => s.text)
        );
      }

      // Cache statistics
      if (services.cache) {
        console.log('\n💾 Cache statistics:');
        const cacheStats = services.cache.getStats();
        console.log('Overall hit rate:', (cacheStats.overall.overallHitRate * 100).toFixed(1), '%');
        console.log(
          'Memory usage:',
          (cacheStats.overall.memoryUsage / 1024 / 1024).toFixed(1),
          'MB'
        );
      }
    } catch (error) {
      console.error('❌ Error demonstrating usage:', error);
    }
  }
}

// Application lifecycle
const mainframeApp = new MainframeApp();

app.whenReady().then(async () => {
  try {
    await mainframeApp.initialize();
    await mainframeApp.createWindow();

    // Run demo after a short delay
    setTimeout(() => {
      mainframeApp.demonstrateUsage().catch(console.error);
    }, 2000);
  } catch (error) {
    console.error('Application initialization failed:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    mainframeApp.shutdown().finally(() => {
      app.quit();
    });
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await mainframeApp.createWindow();
  }
});

// Graceful shutdown
app.on('before-quit', async event => {
  event.preventDefault();
  await mainframeApp.shutdown();
  app.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🔄 Received SIGINT, shutting down gracefully...');
  await mainframeApp.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
  await mainframeApp.shutdown();
  process.exit(0);
});

export default mainframeApp;
