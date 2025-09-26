# Data Model: RAG LLM Chatbot for Documentation

## Entity Definitions

### ChatConversation
Represents a dialogue session between user and chatbot, maintaining message history and selected model.

**Fields:**
- `id`: UUID (Primary Key) - Unique conversation identifier
- `user_id`: String (Required) - User identifier from authentication system
- `title`: String (Optional, 500 chars) - Auto-generated conversation title
- `model_id`: String (Optional, 100 chars) - Currently selected LLM model
- `created_at`: Timestamp - Conversation creation time
- `updated_at`: Timestamp - Last activity timestamp

**Validation Rules:**
- `user_id` must match authenticated user
- `title` auto-generated from first message if not provided
- `model_id` must be from available models list

**State Transitions:**
- Created → Active (on first message)
- Active → Archived (after 30 days of inactivity)
- Any → Deleted (user action)

### ChatMessage
Individual message in a conversation, including user queries and AI responses with timestamps.

**Fields:**
- `id`: UUID (Primary Key) - Unique message identifier
- `conversation_id`: UUID (Foreign Key) - Links to ChatConversation
- `role`: Enum - Message sender type ('user', 'assistant', 'system')
- `content`: Text (Required) - Message content
- `model_id`: String (Optional, 100 chars) - Model used for this response
- `tokens_used`: Integer (Optional) - Token count for this message
- `created_at`: Timestamp - Message creation time

**Validation Rules:**
- `role` must be one of: 'user', 'assistant', 'system'
- `content` cannot be empty
- `tokens_used` must be positive integer if provided
- `model_id` required for 'assistant' role messages

**State Transitions:**
- Created → Displayed
- Displayed → Summarized (when conversation exceeds token limit)

### ModelConfiguration
Active LLM model selection linked to user's API keys and corresponding embeddings.

**Fields:**
- `model_id`: String (Primary Key) - Model identifier (e.g., 'gpt-4o', 'gemini-2.0-flash')
- `provider`: String (Required) - Provider name ('openai', 'google', 'azure')
- `display_name`: String (Required) - User-friendly model name
- `embedding_dimension`: Integer (Required) - Embedding vector size
- `max_tokens`: Integer (Required) - Maximum context window
- `active`: Boolean - Whether model is currently available

**Validation Rules:**
- `embedding_dimension` must match pgvector column size
- `max_tokens` must be positive integer
- `provider` must be supported provider

**State Transitions:**
- Active → Inactive (API key expires)
- Inactive → Active (API key renewed)

### KnowledgeContext
Retrieved knowledge base entries used for RAG responses, linked to specific embeddings.

**Fields:**
- `id`: UUID (Primary Key) - Context identifier
- `message_id`: UUID (Foreign Key) - Links to ChatMessage
- `knowledge_id`: UUID (Foreign Key) - Links to knowledge_base entry
- `relevance_score`: Float (Required) - Similarity score (0-1)
- `chunk_text`: Text (Required) - Retrieved text chunk
- `metadata`: JSONB (Optional) - Additional context metadata

**Validation Rules:**
- `relevance_score` must be between 0 and 1
- `chunk_text` cannot be empty
- Only top 5 chunks per query stored

**State Transitions:**
- Created → Used (included in response)
- Created → Discarded (below threshold)

### ConversationSummary
Context summaries for token management when conversation exceeds limits.

**Fields:**
- `id`: UUID (Primary Key) - Summary identifier
- `conversation_id`: UUID (Foreign Key) - Links to ChatConversation
- `summary`: Text (Required) - Compressed conversation summary
- `message_count`: Integer (Required) - Number of messages summarized
- `tokens_saved`: Integer (Optional) - Tokens reduced by summarization
- `created_at`: Timestamp - Summary creation time

**Validation Rules:**
- `summary` must be shorter than original messages
- `message_count` must be at least 2
- `tokens_saved` must be positive if provided

**State Transitions:**
- Created → Active (replaces old messages)
- Active → Superseded (new summary created)

## Relationships

```
ChatConversation
    │
    ├──1:N──> ChatMessage
    │           │
    │           └──1:N──> KnowledgeContext
    │                        │
    │                        └──N:1──> knowledge_base (existing)
    │
    ├──1:N──> ConversationSummary
    │
    └──N:1──> ModelConfiguration
              │
              └──N:1──> api_keys (existing)
```

## Database Constraints

### Foreign Keys
- `chat_messages.conversation_id` → `chat_conversations.id` (CASCADE DELETE)
- `knowledge_context.message_id` → `chat_messages.id` (CASCADE DELETE)
- `knowledge_context.knowledge_id` → `knowledge_base.id` (SET NULL)
- `conversation_summaries.conversation_id` → `chat_conversations.id` (CASCADE DELETE)

### Indexes
- `chat_messages`: (conversation_id, created_at DESC) - Message retrieval
- `chat_conversations`: (user_id, updated_at DESC) - User's conversations
- `knowledge_context`: (message_id, relevance_score DESC) - Top contexts
- `conversation_summaries`: (conversation_id, created_at DESC) - Latest summary

### Unique Constraints
- `model_configuration`: (model_id) - One config per model
- `conversation_summaries`: (conversation_id, created_at) - One summary per timestamp

## Data Retention

### Retention Policies
- **ChatConversation**: Retained indefinitely per FR-009
- **ChatMessage**: Full messages for 30 days, then summarized
- **KnowledgeContext**: 7 days (regeneratable from embeddings)
- **ConversationSummary**: Retained with conversation

### Privacy Considerations
- User can delete entire conversations
- No PII in model configurations
- Anonymize messages before embedding generation
- Audit trail for all deletions

## Performance Considerations

### Expected Volume
- ~100 conversations per user
- ~50 messages per conversation average
- ~5 knowledge contexts per message
- Total: ~25,000 records per user

### Query Patterns
1. Get recent conversations for user (indexed)
2. Get messages for conversation (indexed)
3. Get knowledge contexts for message (indexed)
4. Vector similarity search (HNSW indexed)

### Optimization Strategies
- Partition messages table by month for large deployments
- Archive old conversations to cold storage
- Cache frequently accessed conversations in Redis
- Pre-compute embeddings for common queries