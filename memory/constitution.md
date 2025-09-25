# Mainframe AI Assistant Constitution

## Core Principles

### I. User-Centric Design
Every feature must directly serve the end user's mainframe analysis and AI assistance needs. Features without clear user value are rejected. UI/UX must be intuitive for mainframe professionals.

### II. Data Privacy & Security (NON-NEGOTIABLE)
All user data remains local by default. Any external API calls must be explicitly consented to. PostgreSQL database connections must use secure authentication. No sensitive mainframe data transmitted without encryption.

### III. Test-First Development (NON-NEGOTIABLE)
TDD mandatory: Tests written → User approved → Tests fail → Then implement. Red-Green-Refactor cycle strictly enforced. Every API endpoint must have contract tests.

### IV. Cross-Platform Compatibility
Support Windows, macOS, and Linux environments. Electron app must work consistently across platforms. Database connections must work in both local and containerized environments.

### V. Performance & Reliability
Response times <2s for all AI assistant queries. Database queries optimized for large datasets. Error handling must be comprehensive with user-friendly messages. Offline functionality for core features.

## Technical Standards

### Architecture Requirements
- Backend API using Node.js/Express
- PostgreSQL database with connection pooling
- Frontend using modern JavaScript (ES6+)
- Electron for desktop application packaging
- RESTful API design principles

### Integration Requirements
- OpenAI API integration with rate limiting
- Google Generative AI (Gemini) support
- JWT-based authentication system
- File upload handling with validation
- Comprehensive logging system

### Quality Gates
- Minimum 80% test coverage
- All endpoints must have API documentation
- Security audit for authentication flows
- Performance testing for database operations
- Cross-browser compatibility testing

## Development Workflow

### Code Review Process
- All PRs require approval from maintainer
- Security-related changes require additional review
- Database schema changes must be documented
- Breaking API changes require version bump

### Documentation Requirements
- API endpoints documented with examples
- Database schema changes logged
- User-facing features require help documentation
- Architecture decisions recorded in ADR format

## Governance

Constitution supersedes all other practices. Amendments require documentation, approval, and migration plan. All development must verify compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2025-09-25 | **Last Amended**: 2025-09-25