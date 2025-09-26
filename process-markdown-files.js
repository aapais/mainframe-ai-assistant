/**
 * Process Markdown Files and Generate Embeddings
 * This script processes MD files from the KBaseFaQs folder and adds them to the knowledge base
 */

const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Import the MultiEmbeddingService for generating embeddings
const MultiEmbeddingService = require('./src/services/multi-embedding-service');

class MarkdownProcessor {
  constructor() {
    this.dbClient = null;
    this.embeddingService = null;
  }

  async initialize() {
    // Initialize database connection
    this.dbClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'assistente_db',
      user: process.env.DB_USER || 'assistente_user',
      password: process.env.DB_PASSWORD || 'assistente2024'
    });

    await this.dbClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Initialize embedding service with API keys from environment
    const embeddingConfig = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'text-embedding-3-small',
        dimensions: 1536
      },
      google: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'embedding-001',
        dimensions: 768
      }
    };

    // Only initialize if we have at least one API key
    if (embeddingConfig.google.apiKey || embeddingConfig.openai.apiKey) {
      this.embeddingService = new MultiEmbeddingService(embeddingConfig);
      console.log('✅ Embedding service initialized');

      if (embeddingConfig.google.apiKey) {
        console.log('   - Google Gemini: Available');
      }
      if (embeddingConfig.openai.apiKey) {
        console.log('   - OpenAI: Available');
      }
    } else {
      console.log('⚠️  No API keys found in environment variables');
      console.log('   Please set GEMINI_API_KEY or OPENAI_API_KEY');
    }
  }

  /**
   * Process a single Markdown file
   */
  async processMarkdownFile(filePath) {
    try {
      const fileName = path.basename(filePath);
      console.log(`\n📄 Processing: ${fileName}`);

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      console.log(`   Size: ${(content.length / 1024).toFixed(2)} KB`);

      // Extract title from first H1 or filename
      let title = fileName.replace('.md', '');
      const h1Match = content.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
      }

      // Check if document already exists
      const existingDoc = await this.dbClient.query(
        'SELECT id, embedding_gemini FROM knowledge_base WHERE title = $1',
        [title]
      );

      if (existingDoc.rows.length > 0) {
        console.log(`   ⚠️  Document already exists (ID: ${existingDoc.rows[0].id})`);

        // Check if it has embeddings
        if (!existingDoc.rows[0].embedding_gemini) {
          console.log('   ⚡ No embeddings found, generating...');
          await this.updateEmbeddings(existingDoc.rows[0].id, content);
        } else {
          console.log('   ✅ Embeddings already exist');
        }
        return;
      }

      // Generate hash for duplicate detection
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      // Prepare document data
      const documentData = {
        title: title,
        content: content,
        category: 'Documentation',
        tags: this.extractTags(content),
        metadata: {
          source_file: fileName,
          file_type: 'markdown',
          processed_at: new Date().toISOString(),
          char_count: content.length,
          word_count: content.split(/\s+/).length
        }
      };

      // Insert into database
      const insertQuery = `
        INSERT INTO knowledge_base (
          title,
          content,
          category,
          tags,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
      `;

      const result = await this.dbClient.query(insertQuery, [
        documentData.title,
        documentData.content,
        documentData.category,
        documentData.tags,
        JSON.stringify(documentData.metadata)
      ]);

      const docId = result.rows[0].id;
      console.log(`   ✅ Inserted with ID: ${docId}`);

      // Generate embeddings if service is available
      if (this.embeddingService) {
        await this.updateEmbeddings(docId, content);
      } else {
        console.log('   ⚠️  Skipping embeddings (no API keys)');
      }

      return docId;
    } catch (error) {
      console.error(`   ❌ Error processing ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate and update embeddings for a document
   */
  async updateEmbeddings(docId, content) {
    try {
      let embeddingGenerated = false;

      // Try Gemini first (preferred)
      if (process.env.GEMINI_API_KEY) {
        try {
          console.log('   🔵 Generating Gemini embedding...');
          const embedding = await this.embeddingService.generateEmbedding(content, {
            provider: 'gemini',
            model: 'embedding-001'
          });

          if (embedding && embedding.length > 0) {
            // Update database with embedding
            await this.dbClient.query(
              `UPDATE knowledge_base
               SET embedding_gemini = $1::vector,
                   primary_embedding_provider = 'gemini',
                   embedding_providers = array_append(
                     COALESCE(embedding_providers, '{}'),
                     'gemini'
                   ),
                   updated_at = NOW()
               WHERE id = $2`,
              [`[${embedding.join(',')}]`, docId]
            );
            console.log('   ✅ Gemini embedding saved');
            embeddingGenerated = true;
          }
        } catch (error) {
          console.log(`   ⚠️  Gemini embedding failed: ${error.message}`);
        }
      }

      // Try OpenAI if Gemini failed or unavailable
      if (!embeddingGenerated && process.env.OPENAI_API_KEY) {
        try {
          console.log('   🟢 Generating OpenAI embedding...');
          const embedding = await this.embeddingService.generateEmbedding(content, {
            provider: 'openai',
            model: 'text-embedding-3-small'
          });

          if (embedding && embedding.length > 0) {
            await this.dbClient.query(
              `UPDATE knowledge_base
               SET embedding_openai = $1::vector,
                   primary_embedding_provider = COALESCE(primary_embedding_provider, 'openai'),
                   embedding_providers = array_append(
                     COALESCE(embedding_providers, '{}'),
                     'openai'
                   ),
                   updated_at = NOW()
               WHERE id = $2`,
              [`[${embedding.join(',')}]`, docId]
            );
            console.log('   ✅ OpenAI embedding saved');
            embeddingGenerated = true;
          }
        } catch (error) {
          console.log(`   ⚠️  OpenAI embedding failed: ${error.message}`);
        }
      }

      if (!embeddingGenerated) {
        console.log('   ❌ No embeddings could be generated');
      }
    } catch (error) {
      console.error('   ❌ Error generating embeddings:', error.message);
    }
  }

  /**
   * Extract tags from Markdown content
   */
  extractTags(content) {
    const tags = [];

    // Extract headers as tags
    const headers = content.match(/^#{1,3}\s+(.+)$/gm) || [];
    headers.forEach(header => {
      const tag = header.replace(/^#+\s+/, '').toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
      if (tag && tag.length > 2) {
        tags.push(tag);
      }
    });

    // Extract technical terms
    const techTerms = ['cobol', 'cics', 'db2', 'mainframe', 'jcl', 'vsam',
                       'ims', 'sql', 'batch', 'online', 'transação', 'dataset'];
    techTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        tags.push(term);
      }
    });

    return [...new Set(tags)].slice(0, 10); // Return unique tags, max 10
  }

  /**
   * Process all MD files in a directory
   */
  async processDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(f => f.toLowerCase().endsWith('.md'));

      console.log(`\n📂 Found ${mdFiles.length} Markdown files in ${dirPath}\n`);

      for (const file of mdFiles) {
        const filePath = path.join(dirPath, file);
        await this.processMarkdownFile(filePath);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('\n✅ All files processed successfully!');
    } catch (error) {
      console.error('❌ Error processing directory:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.dbClient) {
      await this.dbClient.end();
    }
  }
}

// Main execution
async function main() {
  const processor = new MarkdownProcessor();

  try {
    console.log('🚀 Starting Markdown File Processor\n');
    console.log('═══════════════════════════════════════════');

    await processor.initialize();

    // Process the KBaseFaQs directory
    const kbasePath = path.join(__dirname, 'KBaseFaQs');

    // Check if directory exists
    try {
      await fs.access(kbasePath);
      await processor.processDirectory(kbasePath);
    } catch (error) {
      console.log(`\n⚠️  Directory not found: ${kbasePath}`);
      console.log('Creating example with existing MD files...\n');

      // Process individual files if directory doesn't exist
      const individualFiles = [
        'KBaseFaQs/Guia DB2 para Desenvolvedores - Mainframer.md',
        'KBaseFaQs/Manual de Troubleshooting CICS.md',
        'KBaseFaQs/Padrões de Desenvolvimento COBOL.md'
      ];

      for (const file of individualFiles) {
        const filePath = path.join(__dirname, file);
        try {
          await fs.access(filePath);
          await processor.processMarkdownFile(filePath);
        } catch (err) {
          console.log(`   Skipping ${file}: Not found`);
        }
      }
    }

    // Show summary
    const summary = await processor.dbClient.query(`
      SELECT
        COUNT(*) as total_docs,
        COUNT(CASE WHEN category = 'Documentation' THEN 1 END) as markdown_docs,
        COUNT(embedding_gemini) as with_gemini,
        COUNT(embedding_openai) as with_openai
      FROM knowledge_base
      WHERE category = 'Documentation'
    `);

    console.log('\n═══════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`Total Markdown documents: ${summary.rows[0].markdown_docs}`);
    console.log(`With Gemini embeddings: ${summary.rows[0].with_gemini}`);
    console.log(`With OpenAI embeddings: ${summary.rows[0].with_openai}`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await processor.cleanup();
    console.log('\n👋 Process completed');
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MarkdownProcessor;