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
router.post('/process', upload.single('document'), async (req, res) => {
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

            // Get embedding service - MANDATORY for knowledge base uploads
            const embeddingService = req.app.locals.embeddingService;
            if (!embeddingService || !embeddingService.isAvailable()) {
                return res.status(400).json({
                    success: false,
                    error: 'É obrigatória a configuração de um modelo de IA válido para carregamento de documentos na Knowledge Base. Configure um modelo default nas definições.'
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
                            RETURNING uuid
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

                        // Generate embedding - MANDATORY for knowledge base entries
                        const embeddingText = `${entry.title} ${entry.content} ${entry.summary || ''}`;
                        const embedding = await embeddingService.generateEmbedding(embeddingText);

                        if (!embedding) {
                            throw new Error(`Falha na geração de embedding para entrada: ${entry.title}. Verifique se o modelo de IA está configurado corretamente.`);
                        }

                        // Update with embedding immediately
                        await db.query(
                            'UPDATE knowledge_base SET embedding = $1 WHERE uuid = $2',
                            [`[${embedding.join(',')}]`, entry.uuid]
                        );
                    }
                    imported = true;
                    console.log(`✅ Imported ${entries.length} entries to knowledge base`);
                } catch (dbError) {
                    console.error('Database import error:', dbError);
                    // Continue without import, return SQL for manual execution
                }
            } catch (error) {
                console.error('Document processing error:', error);
                // Continue without stopping the request
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