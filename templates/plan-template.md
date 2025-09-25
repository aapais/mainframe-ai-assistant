# Implementation Plan: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: Technical stack specification: "$ARGUMENTS"

## Execution Flow (main)
```
1. Parse technical stack from Input
   → If empty: ERROR "No technical approach provided"
2. Validate stack choices against Constitution
   → Check: C:\mainframe-ai-assistant\memory\constitution.md
   → If conflicts found: ERROR "Stack violates constitution"
3. Generate Architecture Overview
   → Map components to requirements from spec.md
4. Create API Design
   → Define contracts and data flows
5. Plan Database Design (if applicable)
   → Schema, relationships, migrations
6. Design UI/UX Architecture (if frontend)
   → Component structure, state management
7. List Dependencies & Packages
   → Check for security vulnerabilities
8. Define Testing Strategy
   → Unit, integration, E2E testing approach
9. Run Validation Checklist
   → Verify TDD-first approach
   → Check performance targets
10. Return: SUCCESS (ready for task generation)
```

---

## ⚡ Quick Guidelines
- 🏗️ Focus on HOW to implement (architecture, tech choices, patterns)
- 📋 Bridge business requirements → technical implementation  
- 🎯 Concrete and actionable for developers
- ⚡ Must align with constitution principles

### Constitution Compliance
Every plan MUST follow `/memory/constitution.md`:
- **Security First**: Local-first data, encrypted communications
- **Performance**: <2s response times for all interactions
- **Testing**: TDD mandatory, 80%+ coverage requirement
- **Cross-Platform**: Windows, macOS, Linux compatibility
- **Documentation**: Auto-generated, always current

---

## Architecture Overview *(mandatory)*

### System Components
```
[Component Diagram - ASCII or description]
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │ ←→ │   Backend API   │
│   [Technology]  │    │   [Technology]  │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   State Mgmt    │    │   Database      │
│   [Technology]  │    │   [Technology]  │
└─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: [Framework/Library + version + reasoning]
- **Backend**: [Runtime/Framework + version + reasoning]
- **Database**: [Type + version + reasoning]
- **Authentication**: [Method + reasoning]
- **Testing**: [Framework + tools + reasoning]
- **Build/Deploy**: [Tools + reasoning]

### Integration Points
- **External APIs**: [List with authentication methods]
- **File System**: [Required permissions and paths]
- **Network**: [Ports, protocols, security requirements]

---

## API Design *(include for backend features)*

### Endpoints
```
GET    /api/[resource]              # List all [resources]
GET    /api/[resource]/:id          # Get single [resource]
POST   /api/[resource]              # Create new [resource]
PUT    /api/[resource]/:id          # Update [resource]
DELETE /api/[resource]/:id          # Delete [resource]
```

### Request/Response Contracts
```typescript
// Example endpoint
POST /api/[resource]
Request: {
  "field1": "string",
  "field2": "number"
}
Response: {
  "id": "string",
  "field1": "string", 
  "field2": "number",
  "createdAt": "ISO-date"
}
```

### Error Handling
- **400**: Bad request format or validation errors
- **401**: Authentication required
- **403**: Insufficient permissions
- **404**: Resource not found
- **500**: Internal server error

---

## Database Design *(include if data persistence required)*

### Schema
```sql
-- Example table
CREATE TABLE [table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field1 VARCHAR(255) NOT NULL,
  field2 INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Relationships
- **[Entity1]** has many **[Entity2]**
- **[Entity2]** belongs to **[Entity1]**

### Migrations Strategy
- Use versioned migration files
- Always provide rollback scripts
- Test migrations on copy of production data

---

## UI/UX Architecture *(include for frontend features)*

### Component Hierarchy
```
App
├── Header
├── Navigation
├── MainContent
│   ├── [FeatureComponent]
│   │   ├── [SubComponent1]
│   │   └── [SubComponent2]
│   └── Footer
└── Modals/Overlays
```

### State Management
- **Local State**: Component-level using [method]
- **Shared State**: Application-level using [method]
- **Server State**: API data caching using [method]

### Responsive Design
- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: 1024px+

---

## Dependencies & Packages *(mandatory)*

### Production Dependencies
```json
{
  "dependency1": "^version",
  "dependency2": "^version"
}
```

### Development Dependencies  
```json
{
  "dev-dependency1": "^version",
  "dev-dependency2": "^version"
}
```

### Security Considerations
- All dependencies scanned for vulnerabilities
- Regular security updates scheduled
- No packages with known critical vulnerabilities

---

## Testing Strategy *(mandatory)*

### Test Pyramid
- **Unit Tests** (70%): Test individual functions/components
- **Integration Tests** (20%): Test component interactions
- **E2E Tests** (10%): Test complete user workflows

### TDD Approach
1. **Red**: Write failing test first
2. **Green**: Implement minimum code to pass
3. **Refactor**: Clean up while keeping tests passing

### Testing Tools
- **Unit**: [Framework + assertion library]
- **Integration**: [Testing approach]
- **E2E**: Puppeteer MCP integration
- **Coverage**: Minimum 80% threshold

### Test Scenarios
- Happy path testing
- Edge case validation
- Error condition handling
- Performance under load

---

## Performance & Optimization *(mandatory)*

### Performance Targets
- **Page Load**: <2s initial load
- **API Response**: <500ms average
- **Database Queries**: <100ms for simple operations
- **Bundle Size**: <500KB for critical path

### Optimization Strategy
- Code splitting for large applications
- Database query optimization
- Caching strategy (memory/disk/CDN)
- Asset minification and compression

---

## Security Considerations *(mandatory)*

### Authentication & Authorization
- [Method chosen + implementation approach]
- Session management strategy
- Password/credential security

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS prevention measures
- CSRF protection

### Infrastructure Security
- HTTPS/TLS enforcement
- Secure headers implementation
- Environment variable protection

---

## Development Workflow *(mandatory)*

### Git Strategy
- Feature branches from main
- Pull request workflow
- Automated testing on commits
- No direct commits to main

### Environment Setup
- Development environment requirements
- Local development server setup
- Environment variable configuration
- Database setup instructions

### Deployment Strategy
- [Local/staging/production approach]
- Rollback procedures
- Health check implementations

---

## Validation Checklist
*GATE: Automated checks run during main() execution*

### Constitution Compliance
- [ ] Security-first approach implemented
- [ ] Performance targets defined (<2s response)
- [ ] TDD strategy outlined
- [ ] Cross-platform compatibility ensured
- [ ] Auto-documentation planned

### Technical Quality
- [ ] All components properly architected
- [ ] API contracts well-defined
- [ ] Database design normalized
- [ ] Testing strategy comprehensive
- [ ] Dependencies security-scanned

### Implementation Readiness
- [ ] No ambiguous technical decisions
- [ ] All tools and frameworks specified
- [ ] Development workflow defined
- [ ] Performance benchmarks set
- [ ] Security measures planned

---

## Execution Status
*Updated by main() during processing*

- [ ] Technical stack parsed
- [ ] Constitution compliance verified
- [ ] Architecture designed
- [ ] API contracts defined
- [ ] Database schema planned
- [ ] UI architecture outlined
- [ ] Dependencies listed
- [ ] Testing strategy defined
- [ ] Validation checklist passed

---