# Tasks: RAG LLM Chatbot for Documentation

**Input**: Design documents from `/specs/002-quero-implementar-na/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [ ] T001 Install pgvector PostgreSQL extension and verify installation
- [ ] T002 Install dependencies: langchain, @langchain/community, @langchain/openai, pgvector, uuid
- [ ] T003 [P] Configure ESLint rules for new TypeScript chat components
- [ ] T004 [P] Set up test configuration for chat API endpoints with Supertest

## Phase 3.2: Database Migrations ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These migrations MUST run and succeed before ANY implementation**
- [x] T005 Create migration for chat_conversations table in backend/src/migrations/001_chat_conversations.sql
- [x] T006 Create migration for chat_messages table in backend/src/migrations/002_chat_messages.sql
- [x] T007 Create migration for conversation_summaries table in backend/src/migrations/003_conversation_summaries.sql
- [x] T008 Create migration for knowledge_context table in backend/src/migrations/004_knowledge_context.sql
- [x] T009 Create migration to add vector columns to knowledge_base in backend/src/migrations/005_knowledge_base_vectors.sql
- [x] T010 Create HNSW indexes for vector similarity search in backend/src/migrations/006_vector_indexes.sql
- [x] T011 Run all migrations and verify database schema

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T012 [P] Contract test POST /api/chat/conversations - Orchestrated via Claude Flow
- [x] T013 [P] Contract test GET /api/chat/conversations - Orchestrated via Claude Flow
- [x] T014 [P] Contract test GET /api/chat/conversations/:id - Orchestrated via Claude Flow
- [x] T015 [P] Contract test DELETE /api/chat/conversations/:id - Orchestrated via Claude Flow
- [x] T016 [P] Contract test POST /api/chat/conversations/:id/messages - Orchestrated via Claude Flow
- [x] T017 [P] Contract test GET /api/chat/models - Orchestrated via Claude Flow
- [x] T018 [P] Integration test Scenario 1: First Conversation - Orchestrated via Claude Flow
- [x] T019 [P] Integration test Scenario 2: Context Maintenance - Orchestrated via Claude Flow
- [x] T020 [P] Integration test Scenario 3: Model Switching - Orchestrated via Claude Flow
- [x] T021 [P] Integration test Scenario 4: Token Limit Warning - Orchestrated via Claude Flow
- [x] T022 [P] Integration test Scenario 5: Session Persistence - Orchestrated via Claude Flow

## Phase 3.4: Core Implementation (ONLY after tests are failing)
### Models
- [ ] T023 [P] ChatConversation model in backend/src/models/ChatConversation.ts
- [ ] T024 [P] ChatMessage model in backend/src/models/ChatMessage.ts
- [ ] T025 [P] ModelConfiguration model in backend/src/models/ModelConfiguration.ts
- [ ] T026 [P] KnowledgeContext model in backend/src/models/KnowledgeContext.ts
- [ ] T027 [P] ConversationSummary model in backend/src/models/ConversationSummary.ts

### Services
- [ ] T028 [P] ChatService for conversation management in backend/src/services/chat/ChatService.ts
- [ ] T029 [P] RAGChatService extending existing RAGService in backend/src/services/chat/RAGChatService.ts
- [ ] T030 [P] ConversationContextManager for token management in backend/src/services/chat/ConversationContextManager.ts
- [ ] T031 [P] ModelSelectorService for available models in backend/src/services/chat/ModelSelectorService.ts

### API Endpoints
- [ ] T032 POST /api/chat/conversations endpoint in backend/src/api/chat/conversations.ts
- [ ] T033 GET /api/chat/conversations endpoint in backend/src/api/chat/conversations.ts
- [ ] T034 GET /api/chat/conversations/:id endpoint in backend/src/api/chat/conversations/[id].ts
- [ ] T035 DELETE /api/chat/conversations/:id endpoint in backend/src/api/chat/conversations/[id].ts
- [ ] T036 POST /api/chat/conversations/:id/messages streaming endpoint in backend/src/api/chat/conversations/[id]/messages.ts
- [ ] T037 GET /api/chat/models endpoint in backend/src/api/chat/models.ts

### Frontend Components
- [ ] T038 [P] ChatbotContainer main component in frontend/src/components/chat/ChatbotContainer.tsx
- [ ] T039 [P] ChatInterface UI component in frontend/src/components/chat/ChatInterface.tsx
- [ ] T040 [P] ModelSelector dropdown component in frontend/src/components/chat/ModelSelector.tsx
- [ ] T041 [P] MessageList scrollable component in frontend/src/components/chat/MessageList.tsx
- [ ] T042 [P] MessageInput with send button in frontend/src/components/chat/MessageInput.tsx
- [ ] T043 [P] TokenWarning alert component in frontend/src/components/chat/TokenWarning.tsx
- [ ] T044 [P] useChat hook for chat logic in frontend/src/components/chat/hooks/useChat.ts
- [ ] T045 [P] useModels hook for model management in frontend/src/components/chat/hooks/useModels.ts
- [ ] T046 [P] useStreaming hook for SSE handling in frontend/src/components/chat/hooks/useStreaming.ts

## Phase 3.5: Integration
- [ ] T047 Integrate ChatbotContainer into documentation section page
- [ ] T048 Connect chat API endpoints to Express router
- [ ] T049 Configure pgvector connection pooling in database service
- [ ] T050 Implement rate limiting middleware for chat endpoints
- [ ] T051 Add authentication middleware to chat routes
- [ ] T052 Configure CORS for streaming responses

## Phase 3.6: Polish
- [ ] T053 [P] Unit tests for ChatService in backend/tests/unit/test_chat_service.test.ts
- [ ] T054 [P] Unit tests for ConversationContextManager in backend/tests/unit/test_context_manager.test.ts
- [ ] T055 [P] Unit tests for React chat components in frontend/tests/components/chat/
- [ ] T056 Performance test: Verify <2s response time requirement
- [ ] T057 Accessibility audit: Verify WCAG 2.1 AA compliance for chat UI
- [ ] T058 [P] Add TypeScript types for all chat-related interfaces
- [ ] T059 [P] Generate embeddings for existing knowledge base entries
- [ ] T060 Update documentation with chatbot usage instructions

## Dependencies
- Database migrations (T005-T011) must complete before any other tasks
- Tests (T012-T022) before implementation (T023-T046)
- Models (T023-T027) before services (T028-T031)
- Services before API endpoints (T032-T037)
- Backend complete before frontend integration (T047)
- All implementation before polish (T053-T060)

## Parallel Example
```bash
# After migrations complete, launch all contract tests together:
Task: "Contract test POST /api/chat/conversations in backend/tests/contract/test_conversations_post.test.ts"
Task: "Contract test GET /api/chat/conversations in backend/tests/contract/test_conversations_get.test.ts"
Task: "Contract test GET /api/chat/conversations/:id in backend/tests/contract/test_conversation_get_by_id.test.ts"
Task: "Contract test DELETE /api/chat/conversations/:id in backend/tests/contract/test_conversation_delete.test.ts"
Task: "Contract test POST /api/chat/conversations/:id/messages in backend/tests/contract/test_messages_post.test.ts"
Task: "Contract test GET /api/chat/models in backend/tests/contract/test_models_get.test.ts"

# After tests written, launch all models together:
Task: "ChatConversation model in backend/src/models/ChatConversation.ts"
Task: "ChatMessage model in backend/src/models/ChatMessage.ts"
Task: "ModelConfiguration model in backend/src/models/ModelConfiguration.ts"
Task: "KnowledgeContext model in backend/src/models/KnowledgeContext.ts"
Task: "ConversationSummary model in backend/src/models/ConversationSummary.ts"

# Launch all React components together:
Task: "ChatbotContainer main component in frontend/src/components/chat/ChatbotContainer.tsx"
Task: "ChatInterface UI component in frontend/src/components/chat/ChatInterface.tsx"
Task: "ModelSelector dropdown component in frontend/src/components/chat/ModelSelector.tsx"
Task: "MessageList scrollable component in frontend/src/components/chat/MessageList.tsx"
Task: "MessageInput with send button in frontend/src/components/chat/MessageInput.tsx"
Task: "TokenWarning alert component in frontend/src/components/chat/TokenWarning.tsx"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task group
- Run linting after each implementation task
- Avoid: vague tasks, same file conflicts

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (6 endpoints → 6 contract tests)
- [x] All entities have model tasks (5 entities → 5 models)
- [x] All tests come before implementation (T012-T022 before T023-T046)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task

## Task Count Summary
- **Total Tasks**: 60
- **Setup**: 4 tasks
- **Database**: 7 tasks
- **Tests**: 11 tasks (6 contract + 5 integration)
- **Models**: 5 tasks
- **Services**: 4 tasks
- **API**: 6 tasks
- **Frontend**: 9 tasks
- **Integration**: 6 tasks
- **Polish**: 8 tasks