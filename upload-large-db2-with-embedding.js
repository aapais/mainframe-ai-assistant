/**
 * Upload the large DB2 guide file with embedding generation
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const DocumentProcessorWrapper = require('./src/services/document-processor/document-processor-wrapper');
const MultiEmbeddingService = require('./src/services/multi-embedding-service');
const cryptoService = require('./src/services/crypto-service');
require('dotenv').config();

async function uploadLargeDB2WithEmbedding() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'assistente_db',
    user: process.env.DB_USER || 'assistente_user',
    password: process.env.DB_PASSWORD || 'assistente2024'
  });

  try {
    await client.connect();

    console.log('🧪 Uploading Large DB2 Guide with Embeddings\n');
    console.log('═══════════════════════════════════════════\n');

    const filePath = '/mnt/c/mainframe-ai-assistant/KBaseFaQs/Guia DB2 para Desenvolvedores - Mainframer.md';

    // Get file info
    const stats = await fs.stat(filePath);
    console.log(`📄 File: Guia DB2 para Desenvolvedores - Mainframer.md`);
    console.log(`  Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)\n`);

    // Process document
    const processor = new DocumentProcessorWrapper();
    await processor.init();

    console.log('🔄 Processing document...\n');
    const entries = await processor.processDocument(filePath);

    if (entries.length === 0) {
      console.log('❌ No entries generated from document');
      return;
    }

    const entry = entries[0];

    // Get API keys for andrepais user
    const keysResult = await client.query(
      `SELECT ak.service, ak.key_encrypted
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE u.email = 'andreapais@local.local'
       AND ak.is_active = true`
    );

    const userKeys = {};
    for (const row of keysResult.rows) {
      try {
        const decryptedKey = cryptoService.decrypt(row.key_encrypted);
        userKeys[row.service] = decryptedKey;
        console.log(`✅ Found ${row.service} API key for andrepais`);
      } catch (error) {
        console.log(`❌ Failed to decrypt ${row.service} key: ${error.message}`);
      }
    }

    // Initialize embedding service with correct config structure
    const embeddingService = new MultiEmbeddingService({
      provider: 'gemini',
      gemini: {
        apiKey: userKeys.google || process.env.GOOGLE_API_KEY
      }
    });

    // Prepare embedding text with truncation
    let embeddingText = `${entry.title} ${entry.content} ${entry.summary || ''}`;
    const MAX_TEXT_SIZE = 35000;

    console.log(`\n📏 Original embedding text size: ${embeddingText.length} chars`);

    if (embeddingText.length > MAX_TEXT_SIZE) {
      console.log(`⚠️ Text too large. Truncating to ${MAX_TEXT_SIZE} chars...`);

      embeddingText = embeddingText.substring(0, MAX_TEXT_SIZE);
      const lastPeriod = embeddingText.lastIndexOf('.');
      const lastNewline = embeddingText.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);

      if (cutPoint > MAX_TEXT_SIZE * 0.8) {
        embeddingText = embeddingText.substring(0, cutPoint + 1);
      }

      console.log(`✂️ Truncated to ${embeddingText.length} chars`);
    }

    // Generate embedding
    console.log('\n🚀 Generating Google Gemini embedding...');
    try {
      const embedding = await embeddingService.generateEmbedding(embeddingText);
      console.log(`✅ Successfully generated embedding (${embedding.length}D)`);

      // Insert into database
      const insertResult = await client.query(`
        INSERT INTO knowledge_base (
          uuid, title, content, summary, category, tags,
          confidence_score, source, metadata, created_by,
          embedding_gemini
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11
        )
        ON CONFLICT (uuid) DO UPDATE SET
          content = EXCLUDED.content,
          embedding_gemini = EXCLUDED.embedding_gemini,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        entry.uuid,
        entry.title,
        entry.content,
        entry.summary,
        entry.category,
        entry.tags,
        entry.confidence_score || 0.9,
        entry.source,
        JSON.stringify(entry.metadata || {}),
        'upload_script',
        JSON.stringify(embedding)
      ]);

      console.log(`\n✅ Document uploaded successfully!`);
      console.log(`  Database ID: ${insertResult.rows[0].id}`);
      console.log(`  Title: ${entry.title}`);
      console.log(`  Embedding: Google Gemini (768D)`);
      console.log(`  Content: ${entry.content.length} chars (full content preserved)`);
      console.log(`  Embedding text: ${embeddingText.length} chars (truncated for API)`);

    } catch (error) {
      console.error('❌ Error generating embedding:', error.message);
      if (error.message.includes('payload')) {
        console.log('\n💡 The text is still too large. Consider further reducing the MAX_TEXT_SIZE limit.');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

uploadLargeDB2WithEmbedding().catch(console.error);