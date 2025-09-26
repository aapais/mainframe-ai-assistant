/**
 * Document Processor API Endpoints
 * Handles document upload and processing for knowledge base
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const DocumentProcessorWrapper = require('../services/document-processor/document-processor-wrapper');
const ChunkedDocumentProcessor = require('./services/chunked-document-processor');
const cryptoService = require('../services/crypto-service');

// Initialize document processor
const docProcessor = new DocumentProcessorWrapper();
// Initialize directories synchronously to avoid blocking router creation
try {
    fsSync.mkdirSync(path.join(__dirname, '../services/document-processor/output'), { recursive: true });
    fsSync.mkdirSync(path.join(__dirname, '../services/document-processor/temp'), { recursive: true });
    fsSync.mkdirSync(path.join(__dirname, '../../temp'), { recursive: true });
    console.log('📁 Document processor directories initialized');
} catch (error) {
    console.warn('⚠️ Document processor directory setup:', error.message);
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (docProcessor.isSupported(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${path.extname(file.originalname)}`));
        }
    }
});

// Create router
const router = express.Router();

/**
 * Get supported file extensions
 */
router.get('/supported-formats', (req, res) => {
    res.json({
        success: true,
        formats: docProcessor.getSupportedExtensions(),
        categories: {
            documents: ['.pdf', '.docx', '.doc', '.rtf', '.odt'],
            spreadsheets: ['.xlsx', '.xls', '.csv', '.tsv'],
            presentations: ['.pptx', '.ppt', '.odp'],
            images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
            text: ['.txt', '.md', '.json', '.xml', '.yaml'],
            code: ['.py', '.js', '.java', '.c', '.cpp'],
            archives: ['.zip', '.rar', '.7z', '.tar']
        }
    });
});

/**
 * Upload and preview document
 */
router.post('/preview', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Save file temporarily for preview
        const tempPath = path.join(__dirname, '../../temp', `preview_${Date.now()}_${req.file.originalname}`);
        await fs.writeFile(tempPath, req.file.buffer);

        // Get preview information
        const preview = await docProcessor.getDocumentPreview(tempPath);

        // Process document to get entries (without saving to DB)
        const entries = await docProcessor.processDocumentBuffer(
            req.file.buffer,
            req.file.originalname,
            { preview: true }
        );

        // Clean up temp file
        await fs.unlink(tempPath).catch(() => {});

        res.json({
            success: true,
            preview: {
                ...preview,
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype
            },
            entries: entries.slice(0, 5), // Send first 5 entries as preview
            totalEntries: entries.length
        });

    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Process and import document to knowledge base
 */
// Custom authentication middleware for file uploads (supports both header and FormData auth)
const authenticateUpload = (req, res, next) => {
    const { verifyToken } = require('./middleware/auth');

    // Support both Authorization header (standard) and FormData token (upload compatibility)
    const authHeader = req.headers.authorization;
    let token = null;

    // Prefer Authorization header (REST standard)
    if (authHeader) {
        token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;
        console.log('[UPLOAD AUTH] Using standard Authorization header');
    }
    // Fallback to FormData for upload compatibility
    else if (req.body && req.body.authToken) {
        token = req.body.authToken;
        console.log('[UPLOAD AUTH] Using FormData token (upload fallback)');
    }

    console.log('[UPLOAD AUTH] Full req.body:', req.body);
    console.log('[UPLOAD AUTH] Has authToken?', !!req.body?.authToken);
    console.log('[UPLOAD AUTH] Final token:', token ? token.substring(0, 20) + '...' : 'NONE');

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            details: 'Provide token via Authorization header or FormData'
        });
    }

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }

    // Attach authenticated user to request
    req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user'
    };

    console.log('[UPLOAD AUTH] User authenticated:', req.user.email);
    next();
};

router.post('/process', upload.single('document'), authenticateUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const { autoApprove = false } = req.body;

        // Process document
        const entries = await docProcessor.processDocumentBuffer(
            req.file.buffer,
            req.file.originalname
        );

        if (!entries || entries.length === 0) {
            return res.status(422).json({
                success: false,
                error: 'No content could be extracted from the document'
            });
        }

        // Generate SQL script
        const sqlScript = docProcessor.generateSQLScript(entries);

        // If auto-approve, import entries to database
        let imported = false;
        if (autoApprove === 'true' || autoApprove === true) {
            // Get database connection from the main server
            const db = req.app.locals.db;
            if (!db) {
                return res.status(500).json({
                    success: false,
                    error: 'Conexão com a base de dados não disponível'
                });
            }

            // Get user settings to retrieve API keys
            const userId = req.user?.id || req.body.userId || req.headers['x-user-id'] || 1; // Get user ID from authenticated session

            // Query API keys from dedicated api_keys table
            const keysQuery = `
                SELECT service, key_encrypted
                FROM api_keys
                WHERE user_id = $1 AND is_active = true
            `;
            const keysResult = await db.query(keysQuery, [userId]);

            // Build API keys object from results
            const apiKeys = {};
            if (keysResult.rows && keysResult.rows.length > 0) {
                keysResult.rows.forEach(row => {
                    const decrypted = cryptoService.decrypt(row.key_encrypted);
                    if (decrypted) {
                        apiKeys[row.service] = decrypted;
                    } else {
                        console.warn(`Failed to decrypt key for service ${row.service}`);
                    }
                });
            }

            // Check if any embedding-capable API key is configured
            // Note: Only OpenAI and Google Gemini support native embeddings
            if (!apiKeys.openai && !apiKeys.google) {
                return res.status(400).json({
                    success: false,
                    error: 'É obrigatória a configuração de um modelo de IA com suporte a embeddings para carregamento de documentos na Knowledge Base. Configure uma API key OpenAI ou Google Gemini nas definições.'
                });
            }

            // Create embedding service with user's API keys
            const MultiEmbeddingService = require('../services/multi-embedding-service');
            const embeddingConfig = {
                provider: null,
                openai: apiKeys.openai ? { apiKey: apiKeys.openai } : null,
                gemini: apiKeys.google ? { apiKey: apiKeys.google } : null,
                anthropic: apiKeys.anthropic ? { apiKey: apiKeys.anthropic } : null
            };

            // Try providers in order: OpenAI > Gemini > Anthropic
            // Will test each provider and fallback if one fails
            const availableProviders = [];
            if (embeddingConfig.openai) availableProviders.push('openai');
            if (embeddingConfig.gemini) availableProviders.push('gemini');
            if (embeddingConfig.anthropic) availableProviders.push('anthropic');

            // Start with the first available provider
            embeddingConfig.provider = availableProviders[0] || null;

            const embeddingService = new MultiEmbeddingService(embeddingConfig);

            if (!embeddingService) {
                return res.status(400).json({
                    success: false,
                    error: 'Falha ao inicializar serviço de embeddings. Verifique suas API keys nas definições.'
                });
            }

            try {
                for (const entry of entries) {
                    const query = `
                        INSERT INTO knowledge_base (
                            uuid, title, content, summary, category, tags,
                            confidence_score, source, metadata, created_by, created_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
                        ) ON CONFLICT (uuid) DO UPDATE SET
                            content = EXCLUDED.content,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING id
                    `;

                    const result = await db.query(query, [
                        entry.uuid,
                        entry.title,
                        entry.content,
                        entry.summary,
                        entry.category,
                        entry.tags,
                        entry.confidence_score || 0.9,
                        entry.source,
                        JSON.stringify(entry.metadata || {}),
                        entry.created_by || 'document_processor'
                    ]);

                    // Generate embeddings for ALL available providers - Multi-provider approach
                    let embeddingText = `${entry.title} ${entry.content} ${entry.summary || ''}`;

                    // Check if text exceeds API limits (36KB for Gemini)
                    const MAX_TEXT_SIZE = 35000; // Leave some buffer below 36KB

                    // Use chunking for ALL documents that exceed the API limit
                    // This ensures no content is lost - every part gets its own embedding
                    if (embeddingText.length > MAX_TEXT_SIZE) {
                        console.log(`📚 Document is large (${embeddingText.length} chars). Using chunked processing...`);

                        // Get document ID from the insert result
                        const documentId = result.rows[0].id;

                        // Initialize chunked processor
                        const chunkedProcessor = new ChunkedDocumentProcessor(db, embeddingService);

                        // Process document with chunks
                        const chunkResults = await chunkedProcessor.processDocumentWithChunks(
                            entry,
                            documentId,
                            availableProviders
                        );

                        console.log(`✅ Chunked processing complete: ${chunkResults.successfulChunks}/${chunkResults.totalChunks} chunks processed`);

                        // Skip the regular embedding generation since we've done chunked processing
                        continue;
                    }

                    const embeddingResults = {};
                    const successfulProviders = [];

                    console.log(`🚀 Generating embeddings with all available providers...`);

                    // Try to generate embeddings with ALL available providers
                    for (const providerName of availableProviders) {
                        try {
                            console.log(`🔄 Attempting embedding with ${providerName}...`);
                            embeddingService.config.provider = providerName;
                            const embedding = await embeddingService.generateEmbedding(embeddingText);

                            if (embedding && embedding.length > 0) {
                                embeddingResults[providerName] = embedding;
                                successfulProviders.push(providerName);
                                console.log(`✅ Successfully generated ${providerName} embedding (${embedding.length}D)`);
                            }
                        } catch (error) {
                            console.log(`❌ ${providerName} failed: ${error.message}`);
                            // Continue to next provider instead of stopping
                        }
                    }

                    if (successfulProviders.length === 0) {
                        throw new Error(`Falha na geração de embedding para entrada: ${entry.title}. Nenhum provedor disponível conseguiu gerar embeddings.`);
                    }

                    // Ensure the new columns exist before updating
                    try {
                        await db.query(`
                            ALTER TABLE knowledge_base
                            ADD COLUMN IF NOT EXISTS embedding_openai vector(1536),
                            ADD COLUMN IF NOT EXISTS embedding_gemini vector(768),
                            ADD COLUMN IF NOT EXISTS embedding_anthropic vector(1024),
                            ADD COLUMN IF NOT EXISTS embedding_providers TEXT[] DEFAULT '{}',
                            ADD COLUMN IF NOT EXISTS primary_embedding_provider VARCHAR(50)
                        `);
                    } catch (alterError) {
                        console.log('⚠️ Column creation skipped (may already exist)');
                    }

                    // Update with all successful embeddings
                    const updateParts = [];
                    const updateValues = [entry.uuid];
                    let paramCount = 1;

                    // Add embeddings for each successful provider
                    for (const [provider, embedding] of Object.entries(embeddingResults)) {
                        const columnName = `embedding_${provider}`;
                        updateParts.push(`${columnName} = $${++paramCount}`);
                        updateValues.push(`[${embedding.join(',')}]`);
                    }

                    // Add metadata updates
                    updateParts.push(`embedding_providers = $${++paramCount}`);
                    updateValues.push(successfulProviders);

                    updateParts.push(`primary_embedding_provider = $${++paramCount}`);
                    updateValues.push(successfulProviders[0]); // First successful provider as primary

                    // updateParts.push(`embedding_updated_at = CURRENT_TIMESTAMP`); // Column may not exist yet

                    const updateQuery = `
                        UPDATE knowledge_base
                        SET ${updateParts.join(', ')}
                        WHERE uuid = $1
                    `;

                    await db.query(updateQuery, updateValues);

                    console.log(`🎯 Updated entry with embeddings from: ${successfulProviders.join(', ')}`);
                }
                imported = true;
                console.log(`✅ Imported ${entries.length} entries to knowledge base`);
            } catch (dbError) {
                console.error('Database import error:', dbError);
                // Continue without import, return SQL for manual execution
            }
        }

        res.json({
            success: true,
            message: imported ? 'Document processed and imported successfully' : 'Document processed successfully',
            stats: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                entriesCreated: entries.length,
                imported: imported
            },
            entries: entries,
            sqlScript: !imported ? sqlScript : undefined
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Process multiple documents
 */
router.post('/process-batch', upload.array('documents', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const results = [];
        const allEntries = [];

        for (const file of req.files) {
            try {
                const entries = await docProcessor.processDocumentBuffer(
                    file.buffer,
                    file.originalname
                );

                results.push({
                    fileName: file.originalname,
                    success: true,
                    entriesCount: entries.length
                });

                allEntries.push(...entries);
            } catch (error) {
                results.push({
                    fileName: file.originalname,
                    success: false,
                    error: error.message
                });
            }
        }

        // Generate combined SQL script
        const sqlScript = docProcessor.generateSQLScript(allEntries);

        res.json({
            success: true,
            message: `Processed ${req.files.length} files`,
            results: results,
            totalEntries: allEntries.length,
            sqlScript: sqlScript
        });

    } catch (error) {
        console.error('Batch processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Import knowledge base entries directly
 */
router.post('/import-entries', async (req, res) => {
    try {
        const { entries } = req.body;

        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No entries provided'
            });
        }

        // Get database connection
        const db = req.app.locals.db;
        if (!db) {
            return res.status(503).json({
                success: false,
                error: 'Database connection not available'
            });
        }

        let imported = 0;
        const errors = [];

        for (const entry of entries) {
            try {
                const query = `
                    INSERT INTO knowledge_base (
                        uuid, title, content, summary, category, tags,
                        confidence_score, source, metadata, created_by, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
                    ) ON CONFLICT (uuid) DO UPDATE SET
                        content = EXCLUDED.content,
                        updated_at = CURRENT_TIMESTAMP
                `;

                await db.query(query, [
                    entry.uuid,
                    entry.title,
                    entry.content,
                    entry.summary,
                    entry.category,
                    entry.tags,
                    entry.confidence_score || 0.9,
                    entry.source,
                    JSON.stringify(entry.metadata || {}),
                    entry.created_by || 'document_processor'
                ]);

                imported++;
            } catch (error) {
                errors.push({
                    entry: entry.uuid,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Imported ${imported} of ${entries.length} entries`,
            imported: imported,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get processing status
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        status: 'ready',
        supportedFormats: docProcessor.getSupportedExtensions().length,
        maxFileSize: '50MB'
    });
});

module.exports = router;