/**
 * Node.js Wrapper for Universal Document Processor
 * Integrates Python document processor with Node.js backend
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const PDFProcessor = require('./pdf-processor-node');

class DocumentProcessorWrapper {
  constructor() {
    this.pythonScript = path.join(__dirname, 'universal_document_processor.py');
    this.outputDir = path.join(__dirname, 'output');
    this.tempDir = path.join(__dirname, 'temp');
  }

  async init() {
    // Ensure directories exist
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Process a single document file
   * @param {string} filePath - Path to the document
   * @param {object} options - Processing options
   * @returns {Promise<Array>} Array of KnowledgeBase entries
   */
  async processDocument(filePath, options = {}) {
    // Use Python processor for all files now that PyPDF2 is installed
    return new Promise((resolve, reject) => {
      const outputFile = path.join(this.outputDir, `${Date.now()}_output.json`);

      const args = [this.pythonScript, filePath, '-o', this.outputDir, '--json'];

      if (options.recursive) {
        args.push('-r');
      }

      const pythonProcess = spawn('python3', args);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', data => {
        stdout += data.toString();
        console.log(`Python stdout: ${data}`);
      });

      pythonProcess.stderr.on('data', data => {
        stderr += data.toString();
        console.error(`Python stderr: ${data}`);
      });

      pythonProcess.on('close', async code => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Read the generated JSON file
          const jsonFile = path.join(this.outputDir, 'kb_entries.json');
          const jsonData = await fs.readFile(jsonFile, 'utf8');
          const entries = JSON.parse(jsonData);

          // Clean up output file
          await fs.unlink(jsonFile).catch(() => {});

          resolve(entries);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Process document from buffer (for file uploads)
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Original filename
   * @param {object} options - Processing options
   * @returns {Promise<Array>} Array of KnowledgeBase entries
   */
  async processDocumentBuffer(buffer, filename, options = {}) {
    const tempFile = path.join(this.tempDir, `${Date.now()}_${filename}`);

    try {
      // Write buffer to temp file
      await fs.writeFile(tempFile, buffer);

      // Process the temp file
      const entries = await this.processDocument(tempFile, options);

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      return entries;
    } catch (error) {
      // Ensure temp file is cleaned up on error
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  /**
   * Extract preview information without full processing
   * @param {string} filePath - Path to the document
   * @returns {Promise<object>} Preview information
   */
  async getDocumentPreview(filePath) {
    return new Promise((resolve, reject) => {
      const pythonCode = `
import sys
sys.path.insert(0, '${__dirname}')
from universal_document_processor import (
    DocumentTypeDetector,
    BaseProcessor,
    Path
)
import json

file_path = '${filePath.replace(/'/g, "\\'")}'
doc_type = DocumentTypeDetector.detect(file_path)
processor = BaseProcessor(file_path)
metadata = processor._extract_metadata()

preview = {
    'file_name': metadata.file_name,
    'file_size': metadata.file_size,
    'file_type': doc_type.value,
    'mime_type': metadata.mime_type,
    'created_date': str(metadata.created_date) if metadata.created_date else None,
    'modified_date': str(metadata.modified_date) if metadata.modified_date else None,
    'checksum': metadata.checksum
}

print(json.dumps(preview))
`;

      const pythonProcess = spawn('python3', ['-c', pythonCode]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', data => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', data => {
        stderr += data.toString();
      });

      pythonProcess.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Failed to get preview: ${stderr}`));
          return;
        }

        try {
          const preview = JSON.parse(stdout);
          resolve(preview);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Get supported file extensions
   * @returns {Array<string>} List of supported extensions
   */
  getSupportedExtensions() {
    return [
      // Excel
      '.xlsx',
      '.xls',
      '.xlsm',
      '.csv',
      '.tsv',
      // Word
      '.docx',
      '.doc',
      '.rtf',
      '.odt',
      // PDF
      '.pdf',
      // PowerPoint
      '.pptx',
      '.ppt',
      '.odp',
      // Images
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.tiff',
      '.tif',
      '.webp',
      // Text
      '.txt',
      '.md',
      '.markdown',
      '.log',
      '.json',
      '.xml',
      '.yaml',
      '.yml',
      // Email
      '.eml',
      '.msg',
      '.mbox',
      // HTML
      '.html',
      '.htm',
      '.xhtml',
      // Code
      '.py',
      '.js',
      '.java',
      '.c',
      '.cpp',
      '.cs',
      '.php',
      '.rb',
      '.go',
      // Archives
      '.zip',
      '.rar',
      '.7z',
      '.tar',
      '.gz',
      '.bz2',
    ];
  }

  /**
   * Validate if file is supported
   * @param {string} filename - Filename to check
   * @returns {boolean} True if supported
   */
  isSupported(filename) {
    const ext = path.extname(filename).toLowerCase();
    return this.getSupportedExtensions().includes(ext);
  }

  /**
   * Process multiple files
   * @param {Array<string>} filePaths - Array of file paths
   * @param {object} options - Processing options
   * @returns {Promise<Array>} Combined array of KnowledgeBase entries
   */
  async processMultipleDocuments(filePaths, options = {}) {
    const allEntries = [];

    for (const filePath of filePaths) {
      try {
        console.log(`Processing: ${filePath}`);
        const entries = await this.processDocument(filePath, options);
        allEntries.push(...entries);
      } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        // Continue with other files
      }
    }

    return allEntries;
  }

  /**
   * Generate SQL script for database insertion
   * @param {Array} entries - KnowledgeBase entries
   * @returns {string} SQL script
   */
  generateSQLScript(entries) {
    let sql = `-- Knowledge Base Import Script
-- Generated: ${new Date().toISOString()}
-- Total Entries: ${entries.length}

BEGIN;

`;

    for (const entry of entries) {
      const title = entry.title.replace(/'/g, "''");
      const content = entry.content.replace(/'/g, "''");
      const summary = entry.summary.replace(/'/g, "''");
      const tags = `{${entry.tags.join(',')}}`;
      const metadata = JSON.stringify(entry.metadata).replace(/'/g, "''");

      sql += `INSERT INTO knowledge_base (
    uuid, title, content, summary, category, tags,
    confidence_score, source, metadata, created_by, created_at
) VALUES (
    '${entry.uuid}',
    '${title}',
    '${content}',
    '${summary}',
    '${entry.category}',
    '${tags}',
    ${entry.confidence_score},
    '${entry.source}',
    '${metadata}'::jsonb,
    '${entry.created_by}',
    CURRENT_TIMESTAMP
) ON CONFLICT (uuid) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = CURRENT_TIMESTAMP;

`;
    }

    sql += `COMMIT;
`;

    return sql;
  }
}

module.exports = DocumentProcessorWrapper;
