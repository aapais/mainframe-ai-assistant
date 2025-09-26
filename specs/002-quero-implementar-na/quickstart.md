# Quickstart: RAG LLM Chatbot

## Prerequisites
- PostgreSQL with pgvector extension installed
- Active API keys configured in the system
- Node.js 18+ and npm installed
- Access to documentation section

## Setup Instructions

### 1. Database Setup
```bash
# Install pgvector extension (requires admin privileges)
psql -U postgres -d mainframe_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations to create chat tables
npm run migrate:chat

# Generate embeddings for existing knowledge base
npm run embeddings:generate
```

### 2. Configure API Keys
1. Navigate to Settings → AI Configuration
2. Add API keys for desired LLM providers:
   - OpenAI: `sk-...` format
   - Google Gemini: `AIza...` format
3. Ensure at least one key is marked as Active

### 3. Start Development Server
```bash
# Install dependencies
npm install

# Start the application
npm run dev

# In another terminal, start Electron
npm run electron:dev
```

## Testing Scenarios

### Scenario 1: First Conversation
1. Open the application and navigate to Documentation section
2. Click the chat icon in the bottom-right corner
3. Select an LLM model from the dropdown (only active models shown)
4. Type: "What is the process for resolving mainframe incidents?"
5. Verify the chatbot:
   - Searches knowledge base
   - Returns relevant information
   - Displays response in real-time

### Scenario 2: Context Maintenance
1. Continue from Scenario 1
2. Type: "Can you provide more details about the escalation process?"
3. Verify the chatbot:
   - Understands "escalation process" refers to previous context
   - Provides relevant follow-up information
   - Maintains conversation flow

### Scenario 3: Model Switching
1. During an active conversation
2. Click the model selector dropdown
3. Choose a different LLM model
4. Send a new message
5. Verify:
   - Model switch is successful
   - New responses use selected model
   - Conversation history remains intact

### Scenario 4: Token Limit Warning
1. Have a lengthy conversation (10+ messages)
2. Continue adding messages
3. Verify:
   - Warning appears when approaching token limit
   - Older messages are summarized automatically
   - Conversation continues seamlessly

### Scenario 5: Session Persistence
1. Have a conversation with multiple messages
2. Close the application
3. Reopen and navigate to Documentation → Chat
4. Verify:
   - Previous conversation is restored
   - Can continue from where left off
   - History shows last 5 messages

## Validation Checklist

### Functional Requirements
- [ ] Chat interface accessible from documentation section (FR-001)
- [ ] Only shows models with active API keys (FR-002)
- [ ] RAG retrieval returns relevant results (FR-003)
- [ ] Conversation context maintained (FR-004)
- [ ] Uses correct embeddings for selected model (FR-005)
- [ ] Can switch between models (FR-006)
- [ ] API key validation before each request (FR-007)
- [ ] Clear feedback when no results found (FR-008)
- [ ] Conversations persist across sessions (FR-009)
- [ ] Token limit warning displayed (FR-010)
- [ ] Maximum 5 messages visible in history (FR-011)
- [ ] Single chat window interface (FR-012)

### Performance Requirements
- [ ] Response time under 2 seconds
- [ ] Smooth scrolling in message list
- [ ] No UI freezing during generation
- [ ] Efficient memory usage

### Accessibility Requirements
- [ ] Keyboard navigation works
- [ ] Screen reader announces new messages
- [ ] ARIA labels present on all controls
- [ ] High contrast mode supported

## Troubleshooting

### Issue: "No models available"
**Solution**: Check that API keys are configured and marked as Active in Settings

### Issue: "Failed to retrieve knowledge"
**Solution**: Verify embeddings are generated: `npm run embeddings:check`

### Issue: "Conversation not persisting"
**Solution**: Check PostgreSQL connection and that migrations ran successfully

### Issue: "Response time exceeds 2 seconds"
**Solution**:
1. Check PostgreSQL indexes: `npm run db:check-indexes`
2. Verify embedding cache is working
3. Consider reducing retrieval chunk size

## API Testing with cURL

### Create Conversation
```bash
curl -X POST http://localhost:3000/api/chat/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Test Conversation"}'
```

### Send Message (Streaming)
```bash
curl -X POST http://localhost:3000/api/chat/conversations/CONVERSATION_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content": "Hello, chatbot!"}' \
  --no-buffer
```

### Get Available Models
```bash
curl http://localhost:3000/api/chat/models \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Development Tips

### Enable Debug Logging
```bash
export DEBUG=chat:*
npm run dev
```

### Monitor Token Usage
```sql
SELECT
  model_id,
  SUM(tokens_used) as total_tokens,
  AVG(tokens_used) as avg_tokens
FROM chat_messages
WHERE role = 'assistant'
GROUP BY model_id;
```

### Test Embedding Search
```sql
SELECT
  content,
  embedding_openai <=> (SELECT embedding_openai FROM knowledge_base LIMIT 1) as distance
FROM knowledge_base
ORDER BY distance
LIMIT 5;
```

## Next Steps
1. Customize chat UI styling to match brand
2. Add export conversation feature
3. Implement conversation search
4. Add user feedback collection
5. Set up monitoring dashboard