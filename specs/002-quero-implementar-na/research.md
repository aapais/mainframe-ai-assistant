# Research: RAG LLM Chatbot for Documentation

## Executive Summary
Research confirms feasibility of implementing a RAG chatbot using existing infrastructure with PostgreSQL pgvector for embeddings, multi-provider LLM support through existing services, and Next.js/Electron integration.

## Key Decisions

### 1. RAG Framework Selection
**Decision**: Extend existing RAGService.js with LangChain.js for orchestration
**Rationale**: Current codebase already has MultiEmbeddingService and RAGService foundations. LangChain provides mature RAG patterns without full rewrite.
**Alternatives considered**: Vercel AI SDK (too much refactoring), custom implementation (reinventing wheel)

### 2. Vector Storage Approach
**Decision**: PostgreSQL with pgvector extension using HNSW indexing
**Rationale**: Aligns with constitution requirement for PostgreSQL-only, provides fast similarity search, integrates with existing database
**Alternatives considered**: Separate vector DB (violates constitution), in-memory search (doesn't scale)

### 3. Conversation Management Strategy
**Decision**: Sliding window with PostgreSQL persistence and summarization
**Rationale**: Handles token limits elegantly, persists across sessions per requirements, maintains context efficiently
**Alternatives considered**: Full history (token limit issues), session-only storage (loses persistence requirement)

### 4. Multi-Provider Integration
**Decision**: Extend existing MultiEmbeddingService pattern
**Rationale**: Code already supports OpenAI/Gemini/Azure, follows established patterns, minimal refactoring
**Alternatives considered**: New service layer (duplication), third-party unified API (unnecessary dependency)

### 5. UI Integration Approach
**Decision**: React component in documentation section with streaming responses
**Rationale**: Consistent with existing UI patterns, provides real-time feedback, maintains accessibility standards
**Alternatives considered**: Popup modal (poor UX), separate page (breaks documentation flow)

## Technical Specifications

### Database Schema Extensions
```sql
-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversation storage
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    model_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Message history
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_id VARCHAR(100),
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Context summaries for token management
CREATE TABLE conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    message_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversations_user ON chat_conversations(user_id, updated_at DESC);
```

### Embedding Storage Enhancement
```sql
-- Modify existing knowledge_base table to support vector search
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding_openai vector(1536),
ADD COLUMN IF NOT EXISTS embedding_gemini vector(768),
ADD COLUMN IF NOT EXISTS embedding_metadata JSONB;

-- Create HNSW indexes for each provider
CREATE INDEX idx_kb_embedding_openai ON knowledge_base
USING hnsw (embedding_openai vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_kb_embedding_gemini ON knowledge_base
USING hnsw (embedding_gemini vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### API Endpoints Structure
```
POST /api/chat/conversations - Create new conversation
GET  /api/chat/conversations/:id - Get conversation with messages
POST /api/chat/conversations/:id/messages - Send message (streaming)
GET  /api/chat/models - Get available models for user
DELETE /api/chat/conversations/:id - Delete conversation
```

### Component Architecture
```
frontend/src/components/chat/
├── ChatbotContainer.tsx       # Main container with state management
├── ChatInterface.tsx          # Chat UI with message display
├── ModelSelector.tsx          # LLM model dropdown
├── MessageList.tsx            # Scrollable message history (max 5 visible)
├── MessageInput.tsx           # Input with send button
├── TokenWarning.tsx           # Token limit warning component
└── hooks/
    ├── useChat.ts            # Chat logic and API calls
    ├── useModels.ts          # Available models hook
    └── useStreaming.ts       # SSE streaming handler
```

## Implementation Considerations

### Performance Optimizations
1. **Connection Pooling**: Use pg-pool with 20 max connections
2. **Embedding Cache**: 24-hour TTL as per existing pattern
3. **Batch Processing**: Process embeddings in batches of 10
4. **Response Streaming**: Use Server-Sent Events for real-time responses

### Security Requirements
1. **API Key Validation**: Check active status before each request
2. **SQL Injection Prevention**: Use parameterized queries only
3. **XSS Protection**: Sanitize all chat messages
4. **Rate Limiting**: 60 requests per minute per user

### Accessibility Features
1. **ARIA Labels**: All chat components properly labeled
2. **Keyboard Navigation**: Tab through all interactive elements
3. **Screen Reader**: Announce new messages
4. **High Contrast**: Support theme switching

### Token Management Strategy
```typescript
// Token limits by provider
const TOKEN_LIMITS = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gemini-2.0-flash': 1000000,
  'gemini-1.5-pro': 2000000
};

// Warning threshold at 80% capacity
const WARNING_THRESHOLD = 0.8;

// Summarization trigger at 90% capacity
const SUMMARIZATION_THRESHOLD = 0.9;
```

## Risk Mitigation

### Identified Risks
1. **pgvector Installation**: May require database admin privileges
   - Mitigation: Coordinate with DBA team early
2. **Token Cost Overruns**: Heavy usage could exceed budget
   - Mitigation: Implement cost tracking and limits
3. **Response Latency**: RAG retrieval + generation could exceed 2s
   - Mitigation: Optimize indexes, implement caching
4. **Embedding Sync**: Existing knowledge base lacks embeddings
   - Mitigation: Background job to generate embeddings

## Dependencies to Install
```json
{
  "dependencies": {
    "langchain": "^0.3.0",
    "@langchain/community": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "pgvector": "^3.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^10.0.0"
  }
}
```

## Migration Path
1. Install pgvector extension on PostgreSQL
2. Run schema migrations for new tables
3. Generate embeddings for existing knowledge base
4. Implement chat API endpoints
5. Build React components
6. Integration testing with multiple providers
7. Performance testing and optimization

## Conclusion
The research confirms that implementing a RAG chatbot is feasible using the existing technology stack and patterns. The approach leverages current MultiEmbeddingService and RAGService implementations while adding PostgreSQL pgvector for efficient similarity search and proper conversation management.