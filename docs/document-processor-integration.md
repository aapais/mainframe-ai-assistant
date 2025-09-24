# Document Processor Integration

This document describes the integration of the universal document processor with the PostgreSQL backend server.

## Overview

The document processor integration allows users to:
- Upload documents in various formats (PDF, Word, Excel, PowerPoint, images, etc.)
- Automatically extract content and create knowledge base entries
- Generate vector embeddings for semantic search
- Store processed content in the PostgreSQL knowledge base

## Components

### 1. Database Schema (`src/database/init-knowledge-base.sql`)
- Creates `knowledge_base` table with proper constraints
- Includes vector embedding support (if pgvector is available)
- Implements full-text search with Portuguese language support
- Automatic search vector updates via triggers

### 2. Document Processor Wrapper (`src/services/document-processor/document-processor-wrapper.js`)
- Node.js wrapper for the Python document processor
- Handles file processing, temporary file management
- Generates SQL scripts for database insertion
- Supports batch processing and preview functionality

### 3. API Routes (`src/backend/document-processor-api.js`)
- `/api/documents/supported-formats` - Get supported file formats
- `/api/documents/preview` - Preview document processing results
- `/api/documents/process` - Process and import documents
- `/api/documents/process-batch` - Process multiple documents
- `/api/documents/import-entries` - Import knowledge base entries directly
- `/api/documents/status` - Check processor status

### 4. Knowledge Base API Routes (in `postgresql-only-server.js`)
- `/api/knowledge` - CRUD operations for knowledge base entries
- `/api/knowledge/search` - Text and vector search
- `/api/knowledge/categories` - Get available categories

## Features

### Supported File Formats
- **Documents**: PDF, Word (.docx, .doc), RTF, ODT
- **Spreadsheets**: Excel (.xlsx, .xls), CSV, TSV
- **Presentations**: PowerPoint (.pptx, .ppt), ODP
- **Images**: JPG, PNG, GIF, BMP, TIFF, WebP
- **Text**: TXT, Markdown, JSON, XML, YAML
- **Code**: Python, JavaScript, Java, C/C++, C#, PHP, Ruby, Go
- **Archives**: ZIP, RAR, 7Z, TAR, GZ
- **Email**: EML, MSG, MBOX
- **Web**: HTML, HTM, XHTML

### Automatic Processing
1. **Content Extraction**: Text, metadata, and structure extraction
2. **Intelligent Chunking**: Content split into manageable knowledge base entries
3. **Category Classification**: Automatic categorization based on content
4. **Embedding Generation**: Vector embeddings for semantic search (if OpenAI API key is configured)
5. **Full-text Indexing**: Portuguese language search optimization

### Search Capabilities
- **Text Search**: Full-text search with ranking
- **Vector Search**: Semantic similarity search using embeddings
- **Category Filtering**: Filter by document categories
- **Metadata Search**: Search within document metadata

## Configuration

### Environment Variables
```bash
# Required for database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mainframe_ai
POSTGRES_USER=mainframe_user
POSTGRES_PASSWORD=your_secure_password_123

# Optional for vector search
OPENAI_API_KEY=your_openai_api_key

# Server configuration
PORT=3001
```

### Dependencies
- `multer` - File upload handling
- `uuid` - Unique identifier generation
- Python 3 with required libraries (see universal_document_processor.py)

## Usage

### 1. Start the Server
```bash
node src/backend/postgresql-only-server.js
```

### 2. Upload Documents
```bash
# Preview document processing
curl -X POST http://localhost:3001/api/documents/preview \
  -F "document=@your-file.pdf"

# Process and import document
curl -X POST http://localhost:3001/api/documents/process \
  -F "document=@your-file.pdf" \
  -F "autoApprove=true"
```

### 3. Search Knowledge Base
```bash
# Text search
curl "http://localhost:3001/api/knowledge/search?query=your+search+terms"

# Vector search (if embeddings enabled)
curl "http://localhost:3001/api/knowledge/search?query=your+search+terms&useVector=true"
```

## API Endpoints

### Document Processing

#### POST `/api/documents/preview`
Preview document processing without importing.
- **Body**: FormData with `document` file
- **Response**: Preview information and sample entries

#### POST `/api/documents/process`
Process and optionally import document.
- **Body**: FormData with `document` file and optional `autoApprove=true`
- **Response**: Processing results and optional SQL script

#### POST `/api/documents/process-batch`
Process multiple documents simultaneously.
- **Body**: FormData with multiple `documents[]` files
- **Response**: Batch processing results

### Knowledge Base

#### GET `/api/knowledge`
Get knowledge base entries with pagination.
- **Query**: `category`, `limit`, `offset`

#### GET `/api/knowledge/search`
Search knowledge base entries.
- **Query**: `query`, `category`, `useVector`

#### POST `/api/knowledge`
Create new knowledge base entry.

#### PUT `/api/knowledge/:uuid`
Update existing knowledge base entry.

#### DELETE `/api/knowledge/:uuid`
Delete knowledge base entry.

## Testing

Run the integration test:
```bash
node tests/test-document-processor.js
```

The test verifies:
- Server health and connectivity
- Document processor availability
- Knowledge base functionality
- Database schema initialization

## Troubleshooting

### Common Issues

1. **Python Dependencies Missing**
   - Install required Python libraries
   - Ensure Python 3 is available in PATH

2. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check environment variables
   - Ensure database and user exist

3. **Vector Search Not Working**
   - Install pgvector extension: `CREATE EXTENSION vector;`
   - Configure OpenAI API key
   - Check embedding service initialization

4. **File Upload Errors**
   - Check file size limits (50MB default)
   - Verify file format is supported
   - Ensure temp directories exist

### Logs and Debugging

The server provides detailed logging for:
- Database operations
- Document processing steps
- Embedding generation
- Error conditions

Monitor the console output for diagnostic information.

## Security Considerations

- File uploads are limited to 50MB
- Only supported file types are allowed
- Temporary files are automatically cleaned up
- SQL injection protection via parameterized queries
- CORS headers configured for cross-origin requests

## Performance Optimization

- Database indexes on commonly searched fields
- Vector similarity search with IVFFlat index
- Efficient file streaming for large uploads
- Automatic cleanup of temporary files
- Connection pooling for database operations

## Future Enhancements

- Support for additional file formats
- Batch processing optimization
- Real-time processing status
- Document versioning
- Advanced metadata extraction
- Custom embedding models
- Distributed processing