/**
 * Chunked Document Processor Service
 * Processes large documents by splitting them into chunks with individual embeddings
 */

const DocumentChunker = require('../../services/document-chunker');
const MultiEmbeddingService = require('../../services/multi-embedding-service');

class ChunkedDocumentProcessor {
  constructor(db, embeddingService) {
    this.db = db;
    this.embeddingService = embeddingService;
    this.chunker = new DocumentChunker(30000, 500); // 30KB chunks with 500 char overlap
  }

  /**
   * Process a document with chunking and multiple embeddings
   * @param {object} entry - Document entry from document processor
   * @param {number} documentId - ID of the document in knowledge_base
   * @param {Array} availableProviders - Available embedding providers
   * @returns {Promise<object>} Processing results
   */
  async processDocumentWithChunks(entry, documentId, availableProviders = ['gemini']) {
    const results = {
      documentId,
      totalChunks: 0,
      successfulChunks: 0,
      failedChunks: 0,
      chunks: []
    };

    try {
      // Combine title, content, and summary for embedding
      const fullText = `${entry.title}\n\n${entry.content}\n\n${entry.summary || ''}`;

      // Determine document type for smart chunking
      let documentType = 'text';
      if (entry.source?.endsWith('.md') || entry.title?.includes('Markdown')) {
        documentType = 'markdown';
      } else if (entry.source?.match(/\.(js|py|java|cpp|cs|rb|go)$/)) {
        documentType = 'code';
      }

      console.log(`\n📄 Processing document with chunking:`);
      console.log(`  Document: ${entry.title}`);
      console.log(`  Type: ${documentType}`);
      console.log(`  Total size: ${fullText.length} chars`);

      // Create chunks
      const chunks = documentType === 'markdown'
        ? this.chunker.smartChunk(fullText, documentType)
        : this.chunker.chunkText(fullText);

      results.totalChunks = chunks.length;
      console.log(`  Generated ${chunks.length} chunks`);

      // Create chunks table if it doesn't exist
      await this.createChunksTableIfNeeded();

      // Process each chunk
      for (const chunk of chunks) {
        try {
          console.log(`\n  Processing chunk ${chunk.chunk_index + 1}/${chunks.length}`);
          console.log(`    Size: ${chunk.text.length} chars`);

          // Generate embeddings for this chunk
          const chunkEmbeddings = await this.generateChunkEmbeddings(
            chunk.text,
            availableProviders
          );

          // Store chunk with embeddings
          const chunkId = await this.storeChunk(
            documentId,
            chunk,
            chunkEmbeddings
          );

          results.successfulChunks++;
          results.chunks.push({
            id: chunkId,
            index: chunk.chunk_index,
            size: chunk.text.length,
            providers: Object.keys(chunkEmbeddings)
          });

          console.log(`    ✅ Chunk stored with embeddings from: ${Object.keys(chunkEmbeddings).join(', ')}`);

        } catch (chunkError) {
          console.error(`    ❌ Failed to process chunk ${chunk.chunk_index}:`, chunkError.message);
          results.failedChunks++;
        }
      }

      // Update main document to indicate it has chunks
      await this.updateDocumentChunkInfo(documentId, results.totalChunks);

      console.log(`\n✅ Document chunking complete:`);
      console.log(`  Total chunks: ${results.totalChunks}`);
      console.log(`  Successful: ${results.successfulChunks}`);
      console.log(`  Failed: ${results.failedChunks}`);

      return results;

    } catch (error) {
      console.error('Error in chunked document processing:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for a chunk with multiple providers
   */
  async generateChunkEmbeddings(chunkText, availableProviders) {
    const embeddingResults = {};

    for (const providerName of availableProviders) {
      try {
        this.embeddingService.config.provider = providerName;
        const embedding = await this.embeddingService.generateEmbedding(chunkText);

        if (embedding && embedding.length > 0) {
          embeddingResults[providerName] = embedding;
        }
      } catch (error) {
        console.log(`      ⚠️ ${providerName} embedding failed: ${error.message}`);
      }
    }

    return embeddingResults;
  }

  /**
   * Store a chunk with its embeddings in the database
   */
  async storeChunk(documentId, chunk, embeddings) {
    // Validate documentId
    if (!documentId) {
      throw new Error(`Invalid documentId: ${documentId}`);
    }

    // Build the INSERT query dynamically based on available embeddings
    const columns = ['document_id', 'chunk_index', 'total_chunks', 'chunk_text', 'chunk_metadata'];
    const values = [documentId, chunk.chunk_index, chunk.total_chunks, chunk.text, JSON.stringify({
      type: chunk.type || 'text',
      start_position: chunk.start_position,
      end_position: chunk.end_position,
      section_index: chunk.section_index,
      function_index: chunk.function_index
    })];

    let paramCount = 5;

    if (embeddings.openai) {
      columns.push('embedding_openai');
      values.push(JSON.stringify(embeddings.openai));
      paramCount++;
    }

    if (embeddings.gemini) {
      columns.push('embedding_gemini');
      values.push(JSON.stringify(embeddings.gemini));
      paramCount++;
    }

    if (embeddings.anthropic) {
      columns.push('embedding_anthropic');
      values.push(JSON.stringify(embeddings.anthropic));
      paramCount++;
    }

    const placeholders = values.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO document_chunks (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (document_id, chunk_index)
      DO UPDATE SET
        chunk_text = EXCLUDED.chunk_text,
        chunk_metadata = EXCLUDED.chunk_metadata,
        ${embeddings.openai ? 'embedding_openai = EXCLUDED.embedding_openai,' : ''}
        ${embeddings.gemini ? 'embedding_gemini = EXCLUDED.embedding_gemini,' : ''}
        ${embeddings.anthropic ? 'embedding_anthropic = EXCLUDED.embedding_anthropic,' : ''}
        chunk_index = EXCLUDED.chunk_index
      RETURNING id
    `.replace(/,\s*chunk_index/, ', chunk_index'); // Clean up trailing comma

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Update main document to indicate it has chunks
   */
  async updateDocumentChunkInfo(documentId, chunkCount) {
    await this.db.query(`
      UPDATE knowledge_base
      SET has_chunks = true,
          chunk_count = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [documentId, chunkCount]);
  }

  /**
   * Create chunks table if it doesn't exist
   */
  async createChunksTableIfNeeded() {
    const sqlScript = `
      -- Table for storing document chunks with individual embeddings
      CREATE TABLE IF NOT EXISTS document_chunks (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL,
          total_chunks INTEGER NOT NULL,
          chunk_text TEXT NOT NULL,
          chunk_metadata JSONB,

          -- Multi-provider embeddings for each chunk
          embedding_openai vector(1536),
          embedding_gemini vector(768),
          embedding_anthropic vector(1024),

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          -- Unique constraint to prevent duplicate chunks
          UNIQUE(document_id, chunk_index)
      );

      -- Indexes for efficient retrieval
      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON document_chunks(chunk_index);

      -- Add columns to knowledge_base if they don't exist
      ALTER TABLE knowledge_base
      ADD COLUMN IF NOT EXISTS has_chunks BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;
    `;

    try {
      await this.db.query(sqlScript);
    } catch (error) {
      // Some statements might fail if objects already exist, that's OK
      if (!error.message.includes('already exists')) {
        console.error('Error creating chunks table:', error.message);
      }
    }
  }

  /**
   * Search across document chunks using vector similarity
   */
  async searchChunks(queryEmbedding, provider = 'gemini', limit = 10) {
    const embeddingColumn = `embedding_${provider}`;

    const query = `
      SELECT
        dc.id as chunk_id,
        dc.document_id,
        dc.chunk_index,
        dc.total_chunks,
        dc.chunk_text,
        dc.chunk_metadata,
        kb.title as document_title,
        kb.source as document_source,
        1 - (dc.${embeddingColumn} <=> $1::vector) as similarity
      FROM document_chunks dc
      JOIN knowledge_base kb ON dc.document_id = kb.id
      WHERE dc.${embeddingColumn} IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [JSON.stringify(queryEmbedding), limit]);
    return result.rows;
  }
}

module.exports = ChunkedDocumentProcessor;