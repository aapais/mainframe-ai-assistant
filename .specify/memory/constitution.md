<!--
Sync Impact Report
==================
Version Change: 0.0.0 → 1.0.0
- Initial constitution creation
- Added 7 core principles aligned with banking system requirements
- Added technology standards section
- Added development workflow section
- Added quality gates section

Templates Requiring Updates:
✅ plan-template.md - Constitution Check gates aligned
✅ spec-template.md - Requirements sections aligned
✅ tasks-template.md - Task categories aligned
✅ constitution.md command - References updated

Follow-up TODOs:
- TODO(RATIFICATION_DATE): Set to project kickoff date when confirmed
-->

# Accenture Mainframe AI Assistant Constitution

## Core Principles

### I. Banking System Mission-First
The core mission is banking system incident resolution with AI assistance.
Every feature must directly support mainframe operations teams in managing
incidents, searching knowledge bases, and leveraging AI-powered solutions
for faster problem resolution. No feature should be added that doesn't
serve this primary mission.

### II. Fixed Technology Stack
The technology stack is non-negotiable: Next.js 14 + Electron 33 +
PostgreSQL + Node.js/Express. This stack has been carefully selected for
enterprise requirements and MUST NOT be changed without formal
architecture review and documented justification.

### III. PostgreSQL Database Standards
All data operations MUST use PostgreSQL with connection pooling and
secure authentication. Database access must be encrypted, use prepared
statements for security, and implement proper connection management to
prevent resource leaks.

### IV. Security-First Architecture
Local-first data storage with encrypted PostgreSQL connections is mandatory.
All AI operations require explicit user consent with transparent cost
tracking. User credentials and sensitive data must be encrypted at rest
and in transit. No telemetry or data leaves the organization without
explicit approval.

### V. Quality Assurance Standards
Test-Driven Development (TDD) is mandatory with 85% minimum code coverage.
All endpoints must respond in less than 2 seconds. Performance benchmarks
must be run before each release. Code review is required for all changes.

### VI. Accessibility Compliance
WCAG 2.1 AA compliance is non-negotiable for all UI components. The
application must be fully functional offline, support complete keyboard
navigation, provide proper ARIA labels, and include high contrast themes.
Screen reader compatibility must be tested regularly.

### VII. Development Process Standards
Claude Flow orchestration for complex features is required. Parallel
operations must be used when possible to maximize efficiency. PostgreSQL
query optimization is mandatory for all database operations. All
development must follow the Spec Kit workflow for requirements management.

## Technology Standards

### Approved Stack
- **Frontend**: Next.js 14 with App Router + React 18
- **Desktop**: Electron 33 with secure IPC communication
- **Database**: PostgreSQL with connection pooling
- **Backend**: Node.js + Express.js
- **Testing**: Jest + React Testing Library
- **Build**: Static export optimized for Electron
- **AI Integration**: OpenAI API + Google Generative AI

### Prohibited Technologies
- No MongoDB or NoSQL databases
- No Vite or alternative bundlers
- No SQLite for production data
- No experimental frameworks
- No unapproved third-party services

## Development Workflow

### Specification Process
1. All features start with a specification document
2. Technical planning follows approved spec
3. Task breakdown before implementation
4. TDD approach with failing tests first
5. Implementation to pass tests
6. Performance validation before merge

### Code Review Requirements
- All code must be reviewed before merge
- Security review for authentication changes
- Performance review for database queries
- Accessibility review for UI changes
- Architecture review for structural changes

## Quality Gates

### Pre-Commit Checks
- ESLint must pass with no errors
- TypeScript compilation with strict mode
- Unit tests must pass with 85% coverage
- No console.log statements in production code
- No hardcoded credentials or secrets

### Pre-Release Validation
- Full test suite execution
- Performance benchmarks under 2s response time
- WCAG 2.1 AA compliance verification
- Security vulnerability scanning
- Database migration testing

### Production Monitoring
- Response time tracking
- Error rate monitoring
- Database connection pool health
- AI operation cost tracking
- User satisfaction metrics

## Governance

### Amendment Process
Constitution changes require:
1. Written proposal with justification
2. Architecture team review
3. Security team approval for security changes
4. Documented migration plan if breaking changes
5. Version increment following semantic versioning

### Compliance Review
- Weekly: Code coverage and test metrics
- Monthly: Performance benchmarks and optimization
- Quarterly: Security audit and penetration testing
- Annually: Full architecture review and tech debt assessment

### Enforcement
- Automated gates prevent non-compliant code merge
- Constitution violations block deployment
- Repeated violations require remediation plan
- Exceptions require VP-level approval with documented rationale

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2025-09-25