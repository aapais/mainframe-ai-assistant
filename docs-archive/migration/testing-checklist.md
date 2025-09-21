# Unified Schema Migration Testing Checklist

## Pre-Migration Testing Phase

### Environment Setup
- [ ] **Backup Verification**
  - [ ] Full database backup created
  - [ ] Backup file integrity verified (checksum)
  - [ ] Backup restoration tested on separate environment
  - [ ] Application data export completed

- [ ] **Staging Environment**
  - [ ] Identical staging environment prepared
  - [ ] Same application version deployed
  - [ ] Same data volume as production
  - [ ] Network and security configurations match

### Data Integrity Baseline
- [ ] **Pre-Migration Data Counts**
  - [ ] Record count: `SELECT COUNT(*) FROM kb_entries`
  - [ ] Record count: `SELECT COUNT(*) FROM incidents`
  - [ ] Record count: `SELECT COUNT(*) FROM kb_tags`
  - [ ] Record count: `SELECT COUNT(*) FROM incident_relationships`
  - [ ] Record count: `SELECT COUNT(*) FROM usage_metrics`

- [ ] **Data Quality Checks**
  - [ ] No NULL values in required fields
  - [ ] All foreign key relationships valid
  - [ ] Text encoding verification (UTF-8)
  - [ ] JSON field validation where applicable
  - [ ] Date/timestamp format consistency

### Performance Baseline
- [ ] **Query Performance Metrics**
  ```sql
  -- Test these queries and record execution times
  .timer on
  SELECT * FROM kb_entries WHERE category = 'DB2' LIMIT 10;
  SELECT * FROM incidents WHERE status = 'aberto' LIMIT 10;
  SELECT * FROM kb_fts WHERE kb_fts MATCH 'database error';
  ```
- [ ] **Search Performance**
  - [ ] FTS5 search response time (target: <100ms)
  - [ ] Category filtering performance
  - [ ] Tag-based search performance

### Application Functionality Baseline
- [ ] **Knowledge Base Operations**
  - [ ] Create new KB entry
  - [ ] Update existing KB entry
  - [ ] Delete KB entry
  - [ ] Search KB entries
  - [ ] Tag management
  - [ ] Export functionality

- [ ] **Incident Management Operations**
  - [ ] Create new incident
  - [ ] Update incident status
  - [ ] Assign incident to team/user
  - [ ] Add comments to incident
  - [ ] Close/resolve incident
  - [ ] Search incidents

## Migration Testing Phase

### Data Migration Validation
- [ ] **Migration Script Execution**
  - [ ] Data migration script runs without errors
  - [ ] All transformation functions execute correctly
  - [ ] No data loss during migration
  - [ ] All constraints satisfied in unified table

- [ ] **Data Transformation Accuracy**
  - [ ] KB entries properly mapped to unified format
  - [ ] Incidents properly mapped to unified format
  - [ ] All fields correctly transformed
  - [ ] JSON data preserved and accessible
  - [ ] Relationships maintained

- [ ] **Record Count Verification**
  ```sql
  -- Verify no data loss
  SELECT
    (SELECT COUNT(*) FROM kb_entries_backup) + (SELECT COUNT(*) FROM incidents_backup) as expected,
    (SELECT COUNT(*) FROM unified_entries_staging) as actual;
  ```

### Schema Switch Validation
- [ ] **Atomic Switch Process**
  - [ ] Schema switch transaction completes successfully
  - [ ] No intermediate state visible to users
  - [ ] All indexes created successfully
  - [ ] All triggers created successfully
  - [ ] All views created successfully

- [ ] **Backward Compatibility**
  - [ ] Legacy `kb_entries` view returns correct data
  - [ ] Legacy `incidents` view returns correct data
  - [ ] Existing API endpoints continue working
  - [ ] No breaking changes for existing queries

## Post-Migration Testing Phase

### Data Integrity Verification
- [ ] **Complete Data Validation**
  ```sql
  -- Verify all data migrated correctly
  SELECT entry_type, COUNT(*) FROM unified_entries GROUP BY entry_type;
  SELECT COUNT(*) FROM unified_tags;
  SELECT COUNT(*) FROM unified_relationships;
  ```

- [ ] **Cross-Reference Testing**
  - [ ] Sample KB entries match between old and new structure
  - [ ] Sample incidents match between old and new structure
  - [ ] All tags properly associated
  - [ ] Relationships correctly maintained

### Functional Testing

#### Knowledge Base Functionality
- [ ] **CRUD Operations**
  - [ ] Create new knowledge entry
    - [ ] Required fields validation
    - [ ] Category selection works
    - [ ] Problem/solution fields saved correctly
    - [ ] Tags can be added
  - [ ] Read knowledge entries
    - [ ] Individual entry display
    - [ ] List view with filtering
    - [ ] Search results display
  - [ ] Update knowledge entries
    - [ ] All fields can be modified
    - [ ] Timestamps updated correctly
    - [ ] Version history maintained
  - [ ] Delete knowledge entries
    - [ ] Soft delete (archived) works
    - [ ] Hard delete removes all references
    - [ ] Related data cleaned up

- [ ] **Search Functionality**
  - [ ] Full-text search across title/problem/solution
  - [ ] Category-based filtering
  - [ ] Tag-based filtering
  - [ ] Combined filters work correctly
  - [ ] Search performance acceptable
  - [ ] Search results ranking appropriate

- [ ] **Usage Tracking**
  - [ ] View counts increment correctly
  - [ ] Success/failure ratings work
  - [ ] Last used timestamp updates
  - [ ] Usage metrics recorded

#### Incident Management Functionality
- [ ] **CRUD Operations**
  - [ ] Create new incident
    - [ ] Required fields validation
    - [ ] Status defaults correctly
    - [ ] Reporter field populated
    - [ ] Auto-categorization works (if enabled)
  - [ ] Read incidents
    - [ ] Individual incident display
    - [ ] List view with status filtering
    - [ ] Search across incidents
  - [ ] Update incidents
    - [ ] Status changes trigger timestamp updates
    - [ ] Assignment updates work correctly
    - [ ] Comments can be added
    - [ ] Resolution tracking works
  - [ ] Delete incidents
    - [ ] Soft delete (archived) works
    - [ ] Related comments preserved/removed as appropriate

- [ ] **Workflow Operations**
  - [ ] Status transitions work correctly
  - [ ] Assignment notifications (if applicable)
  - [ ] SLA tracking functions
  - [ ] Escalation rules trigger
  - [ ] Auto-closing functionality

- [ ] **Relationship Management**
  - [ ] Related incidents can be linked
  - [ ] Duplicate detection works
  - [ ] Relationship types correctly enforced
  - [ ] Bi-directional relationships maintained

#### Unified Operations
- [ ] **Cross-Type Search**
  - [ ] Search across both KB and incidents
  - [ ] Type filtering works (`?type=knowledge`, `?type=incident`)
  - [ ] Combined results displayed correctly
  - [ ] Performance acceptable for unified search

- [ ] **Shared Features**
  - [ ] Tag management across both types
  - [ ] Category consistency maintained
  - [ ] Comments system works for both types
  - [ ] Export functionality includes both types

### API Testing
- [ ] **Existing Endpoints**
  - [ ] `/api/kb-entries` returns correct data
  - [ ] `/api/incidents` returns correct data
  - [ ] All CRUD endpoints function correctly
  - [ ] Response formats unchanged
  - [ ] Status codes appropriate

- [ ] **New Unified Endpoints**
  - [ ] `/api/entries?type=knowledge` works
  - [ ] `/api/entries?type=incident` works
  - [ ] `/api/entries` returns both types
  - [ ] Filtering and pagination work
  - [ ] Performance acceptable

### UI Testing
- [ ] **Knowledge Base Interface**
  - [ ] Entry list displays correctly
  - [ ] Create/edit forms work
  - [ ] Search interface functional
  - [ ] Details view shows all fields
  - [ ] Tag management UI works

- [ ] **Incident Management Interface**
  - [ ] Incident list displays correctly
  - [ ] Create/edit forms work
  - [ ] Status workflow UI functions
  - [ ] Assignment interface works
  - [ ] Comments interface functional

- [ ] **Unified Interface Elements**
  - [ ] Combined search works
  - [ ] Type filtering UI functional
  - [ ] Navigation between types smooth
  - [ ] No broken links or missing pages

### Performance Testing
- [ ] **Query Performance**
  - [ ] Individual record retrieval (<50ms)
  - [ ] List queries with filtering (<200ms)
  - [ ] Search queries (<500ms)
  - [ ] Complex joined queries (<1s)

- [ ] **Load Testing**
  - [ ] 100 concurrent users supported
  - [ ] Response times remain acceptable under load
  - [ ] No database locking issues
  - [ ] Memory usage stable

- [ ] **Search Performance**
  - [ ] FTS5 search maintains performance
  - [ ] Large result sets handled efficiently
  - [ ] Faceted search performs well
  - [ ] Auto-complete remains responsive

### Integration Testing
- [ ] **External System Integration**
  - [ ] Authentication system works
  - [ ] Any API integrations function
  - [ ] Export/import processes work
  - [ ] Backup systems recognize new structure

- [ ] **Internal System Integration**
  - [ ] Audit logging captures changes
  - [ ] Notification systems work
  - [ ] Reporting systems function
  - [ ] Caching systems updated

## Security Testing
- [ ] **Access Control**
  - [ ] User permissions enforced
  - [ ] Role-based access works
  - [ ] Data isolation maintained
  - [ ] Admin functions protected

- [ ] **Data Security**
  - [ ] SQL injection prevention
  - [ ] XSS protection maintained
  - [ ] Input validation working
  - [ ] Sensitive data properly handled

## User Acceptance Testing
- [ ] **End-User Workflows**
  - [ ] Knowledge base contributors can create/edit entries
  - [ ] Incident reporters can submit incidents
  - [ ] Support team can manage incidents
  - [ ] Search users can find information
  - [ ] Administrators can manage system

- [ ] **Business Process Validation**
  - [ ] All business rules enforced
  - [ ] Workflow processes maintained
  - [ ] Reporting requirements met
  - [ ] Compliance requirements satisfied

## Rollback Testing
- [ ] **Rollback Procedure**
  - [ ] Rollback script executes successfully
  - [ ] Original table structure restored
  - [ ] Data integrity maintained after rollback
  - [ ] Application functions normally after rollback

- [ ] **Rollback Validation**
  - [ ] All original functionality restored
  - [ ] Performance returns to baseline
  - [ ] No data corruption
  - [ ] All integrations work

## Long-term Monitoring
- [ ] **24-Hour Monitoring**
  - [ ] No critical errors in logs
  - [ ] Performance metrics stable
  - [ ] User feedback positive
  - [ ] No data inconsistencies

- [ ] **1-Week Monitoring**
  - [ ] System stability maintained
  - [ ] Performance trends positive
  - [ ] No cumulative issues
  - [ ] User adoption successful

## Test Documentation
- [ ] **Test Results**
  - [ ] All test cases documented
  - [ ] Performance metrics recorded
  - [ ] Issues identified and resolved
  - [ ] Sign-off from stakeholders

- [ ] **Lessons Learned**
  - [ ] Migration process improvements noted
  - [ ] Performance optimization opportunities
  - [ ] User training needs identified
  - [ ] Future enhancement priorities

## Sign-off Checklist
- [ ] **Technical Team Sign-off**
  - [ ] Database administrator approval
  - [ ] Application developer approval
  - [ ] System administrator approval
  - [ ] Quality assurance approval

- [ ] **Business Team Sign-off**
  - [ ] Product owner approval
  - [ ] End-user representative approval
  - [ ] Support team approval
  - [ ] Management approval

## Success Criteria
- [ ] **Zero Data Loss**: All records successfully migrated
- [ ] **Performance Maintained**: Query times within 10% of baseline
- [ ] **Functionality Preserved**: All features work as before
- [ ] **User Acceptance**: 95% user satisfaction
- [ ] **System Stability**: 99.9% uptime in first week
- [ ] **Rollback Capability**: Tested and available for 30 days

---

**Testing Sign-off:**
- [ ] Lead Developer: _________________ Date: _________
- [ ] QA Manager: _________________ Date: _________
- [ ] Database Administrator: _________________ Date: _________
- [ ] Product Owner: _________________ Date: _________

**Migration Authorization:**
- [ ] IT Manager: _________________ Date: _________
- [ ] Project Sponsor: _________________ Date: _________