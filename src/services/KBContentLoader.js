'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KBContentLoader = void 0;
const tslib_1 = require('tslib');
const KnowledgeService_1 = require('./KnowledgeService');
const fs_1 = tslib_1.__importDefault(require('fs'));
const path_1 = tslib_1.__importDefault(require('path'));
class KBContentLoader {
  knowledgeService;
  constructor() {
    this.knowledgeService = new KnowledgeService_1.KnowledgeService();
  }
  async loadEssentialContent() {
    try {
      const metrics = await this.knowledgeService.getMetrics();
      if (metrics.totalEntries > 0) {
        console.log(`✅ KB already has ${metrics.totalEntries} entries, skipping initial load`);
        return;
      }
      console.log('🔄 Loading essential KB content...');
      const contentPath = path_1.default.join(__dirname, '../../assets/essential-kb.json');
      if (!fs_1.default.existsSync(contentPath)) {
        console.warn('⚠️ Essential KB content file not found, creating minimal entries');
        await this.createMinimalEntries();
        return;
      }
      const content = JSON.parse(fs_1.default.readFileSync(contentPath, 'utf8'));
      let loadedCount = 0;
      for (const entry of content.entries) {
        try {
          await this.knowledgeService.addEntry({
            title: entry.title,
            problem: entry.problem,
            solution: entry.solution,
            category: entry.category,
            tags: entry.tags || [],
          });
          loadedCount++;
          console.log(`✅ Loaded: ${entry.title}`);
        } catch (error) {
          console.error(`❌ Failed to load: ${entry.title}`, error);
        }
      }
      console.log(`🎉 Successfully loaded ${loadedCount}/${content.entries.length} KB entries`);
    } catch (error) {
      console.error('💥 Failed to load essential KB content:', error);
      await this.createMinimalEntries();
    }
  }
  async createMinimalEntries() {
    console.log('🔄 Creating minimal KB entries...');
    const minimalEntries = [
      {
        title: 'VSAM Status 35 - File Not Found',
        problem: 'Job abends with VSAM status code 35',
        solution:
          '1. Check if dataset exists\n2. Verify DD statement\n3. Check catalog\n4. Verify RACF access',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found'],
      },
      {
        title: 'S0C7 Data Exception',
        problem: 'Program abends with S0C7 data exception',
        solution:
          '1. Check numeric fields\n2. Initialize variables\n3. Use NUMERIC test\n4. Check data format',
        category: 'COBOL',
        tags: ['s0c7', 'data-exception', 'numeric'],
      },
      {
        title: 'JCL Dataset Not Found',
        problem: 'JCL fails with dataset not found error',
        solution:
          '1. Check dataset name spelling\n2. Verify dataset exists\n3. Check DISP parameter\n4. Verify quotes',
        category: 'JCL',
        tags: ['jcl', 'dataset', 'not-found'],
      },
    ];
    for (const entry of minimalEntries) {
      try {
        await this.knowledgeService.addEntry(entry);
        console.log(`✅ Created minimal entry: ${entry.title}`);
      } catch (error) {
        console.error(`❌ Failed to create minimal entry: ${entry.title}`, error);
      }
    }
  }
  async checkAndInitialize() {
    try {
      await this.loadEssentialContent();
    } catch (error) {
      console.error('Failed to initialize KB content:', error);
    }
  }
}
exports.KBContentLoader = KBContentLoader;
//# sourceMappingURL=KBContentLoader.js.map
