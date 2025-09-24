-- Seed data for mainframe AI assistant
-- Additional sample data for testing and development

-- Insert more sample incidents for comprehensive testing
INSERT INTO incidents_enhanced (title, description, technical_area, business_area, status, priority, severity, assigned_to, reporter, metadata) VALUES
('MQ Queue Manager Not Starting', 'WebSphere MQ queue manager QMGR1 fails to start after system IPL. Error message indicates lock contention.', 'MQ', 'BANKING', 'OPEN', 'CRITICAL', 'HIGH', 'MQ_ADMIN', 'SYS_OPS', '{"qmgr": "QMGR1", "environment": "PROD", "error_code": "AMQ7047"}'),
('COBOL Program Compilation Error', 'COBOL program CUSTPROC fails to compile with SEVERE error. Undefined data names in working storage.', 'COBOL', 'FINANCE', 'IN_PROGRESS', 'MEDIUM', 'MEDIUM', 'DEV_TEAM', 'BUILD_OPS', '{"program": "CUSTPROC", "compiler": "Enterprise COBOL 6.3", "error_count": 12}'),
('TSO User Cannot Logon', 'Multiple TSO users experiencing logon failures. RACF messages indicate resource unavailable.', 'TSO', 'GOVERNMENT', 'OPEN', 'HIGH', 'HIGH', 'SECURITY_TEAM', 'HELP_DESK', '{"affected_users": 25, "racf_rc": "08", "message": "ICH408I"}'),
('ISPF Edit Session Hang', 'ISPF edit sessions hanging when processing large datasets. Users must cancel and restart.', 'ISPF', 'RETAIL', 'PENDING', 'MEDIUM', 'MEDIUM', 'TOOLS_TEAM', 'USER_SUPPORT', '{"dataset_size": "50000", "edit_mode": "BROWSE", "ispf_version": "7.4"}'),
('SMP/E Apply Failed', 'SMP/E APPLY operation failed for z/OS maintenance. Multiple CSI inconsistencies detected.', 'SMP/E', 'MANUFACTURING', 'OPEN', 'HIGH', 'CRITICAL', 'SYS_PROG', 'MAINTENANCE_TEAM', '{"fmid": "HBB77C0", "csi_zone": "TZONE", "error_count": 5}'),
('z/OS System Slow Response', 'Overall system performance degraded. High CPU utilization and increased response times observed.', 'z/OS', 'INSURANCE', 'IN_PROGRESS', 'HIGH', 'HIGH', 'PERFORMANCE_TEAM', 'MONITORING', '{"cpu_utilization": "95%", "response_time": "8.5s", "peak_users": 450}'),
('USS File System Full', 'USS file system /tmp is 100% full. Applications unable to create temporary files.', 'USS', 'TELECOMMUNICATIONS', 'RESOLVED', 'MEDIUM', 'MEDIUM', 'SYS_ADMIN', 'APP_SUPPORT', '{"filesystem": "/tmp", "size": "2GB", "usage": "100%"}'),
('RACF Password Sync Issues', 'RACF password synchronization failing with distributed systems. Users locked out.', 'RACF', 'BANKING', 'OPEN', 'CRITICAL', 'HIGH', 'SECURITY_TEAM', 'IDENTITY_MGT', '{"sync_target": "LDAP", "failed_users": 150, "error": "connection timeout"}'),
('CA-7 Job Scheduling Error', 'CA-7 scheduler not submitting jobs according to schedule. Dependencies not being honored.', 'CA-7', 'FINANCE', 'IN_PROGRESS', 'HIGH', 'HIGH', 'SCHEDULER_TEAM', 'BATCH_OPS', '{"schedule": "NIGHTLY", "missed_jobs": 8, "dependency_errors": 3}'),
('ENDEVOR Element Not Found', 'ENDEVOR promotion failing. Source elements not found in development environment.', 'ENDEVOR', 'HEALTHCARE', 'OPEN', 'MEDIUM', 'MEDIUM', 'CM_TEAM', 'DEV_LEAD', '{"element": "CUSTMOD1", "environment": "DEV", "stage": "1", "type": "COBOL"}'),
('DATACOM Database Corruption', 'DATACOM database area corruption detected during backup. Data integrity compromised.', 'DATACOM', 'GOVERNMENT', 'CRITICAL', 'CRITICAL', 'CRITICAL', 'DBA_TEAM', 'BACKUP_OPS', '{"database": "MASTER", "area": "CUST_AREA", "corruption_type": "index"}'),
('ADABAS Response Time Issues', 'ADABAS database response times severely degraded. Users experiencing timeouts.', 'ADABAS', 'INSURANCE', 'OPEN', 'HIGH', 'HIGH', 'ADABAS_TEAM', 'PERFORMANCE_MONITOR', '{"database": "001", "response_time": "12s", "active_users": 200}'),
('NATURAL Program Abend', 'NATURAL program NAT9999 abending with error NAT3050. Stack overflow detected.', 'NATURAL', 'BANKING', 'IN_PROGRESS', 'MEDIUM', 'MEDIUM', 'NATURAL_TEAM', 'APP_SUPPORT', '{"program": "NAT9999", "error": "NAT3050", "stack_size": "32K"}'),
('REXX Script Execution Error', 'REXX procedure failing in batch execution. Variable substitution errors encountered.', 'REXX', 'UTILITIES', 'OPEN', 'LOW', 'LOW', 'AUTOMATION_TEAM', 'SCRIPT_ADMIN', '{"procedure": "SYSLOG_PARSE", "error": "variable not found", "line": 47}'),
('PL/I Runtime Error', 'PL/I application encountering runtime errors. Invalid pointer operations detected.', 'PL/I', 'MANUFACTURING', 'PENDING', 'MEDIUM', 'MEDIUM', 'DEV_TEAM', 'QA_TESTER', '{"program": "INVENTORY", "error": "invalid pointer", "module": "ITEM_PROC"}'),
('WebSphere Liberty Profile Issue', 'WebSphere Liberty server not starting. Configuration errors in server.xml detected.', 'LIBERTY', 'RETAIL', 'OPEN', 'HIGH', 'MEDIUM', 'MIDDLEWARE_TEAM', 'WEB_ADMIN', '{"server": "defaultServer", "config_file": "server.xml", "port": "9080"}'),
('FTP Transfer Failures', 'FTP file transfers failing intermittently. Connection timeouts during large file transfers.', 'FTP', 'FINANCE', 'IN_PROGRESS', 'MEDIUM', 'MEDIUM', 'NETWORK_TEAM', 'FILE_ADMIN', '{"file_size": "500MB", "target_host": "REMOTE01", "timeout": "30s"}'),
('VTAM Network Connectivity', 'VTAM network experiencing intermittent connectivity issues. Sessions dropping unexpectedly.', 'VTAM', 'TELECOMMUNICATIONS', 'OPEN', 'HIGH', 'HIGH', 'NETWORK_TEAM', 'NETWORK_OPS', '{"vtam_node": "NET001", "session_type": "SNA", "drop_rate": "15%"}'),
('Storage Management Alert', 'SMS storage management reporting space shortages. Automatic migration not working.', 'SMS', 'GOVERNMENT', 'OPEN', 'MEDIUM', 'MEDIUM', 'STORAGE_TEAM', 'CAPACITY_MGT', '{"storage_group": "PRODSG1", "utilization": "92%", "migration": "disabled"}'),
('HSM Migration Issues', 'HSM (Hierarchical Storage Management) failing to migrate datasets. Tape mount errors.', 'HSM', 'INSURANCE', 'RESOLVED', 'LOW', 'LOW', 'STORAGE_TEAM', 'TAPE_OPS', '{"dataset_count": 250, "tape_errors": 5, "migration_queue": "backed_up"}');

-- Insert additional knowledge base entries
INSERT INTO knowledge_base (type, technical_area, business_area, title, content, tags, difficulty_level, confidence_score, created_by) VALUES
('TROUBLESHOOTING', 'MQ', 'BANKING', 'WebSphere MQ Queue Manager Startup Issues', 'To troubleshoot MQ queue manager startup problems:

1. Check system logs for error messages
2. Verify queue manager data directory permissions
3. Check for active log issues:
   - Review active log size and allocation
   - Ensure sufficient disk space
4. Examine queue manager error logs (AMQERR01.LOG)
5. Verify lock file cleanup after abnormal shutdown
6. Check shared memory and semaphore usage

Common solutions:
- Clear lock files if present
- Restart with FORCE option if necessary
- Verify QMGR data directory ownership', ARRAY['MQ', 'queue-manager', 'startup', 'troubleshooting'], 'INTERMEDIATE', 0.92, 'MQ_EXPERT'),

('CODE_SAMPLE', 'COBOL', 'FINANCE', 'COBOL Data Definition Best Practices', 'Proper COBOL data definition techniques:

       01  CUSTOMER-RECORD.
           05  CUST-ID                 PIC X(10).
           05  CUST-NAME.
               10  FIRST-NAME          PIC X(20).
               10  LAST-NAME           PIC X(30).
           05  CUST-ADDRESS.
               10  STREET              PIC X(50).
               10  CITY                PIC X(30).
               10  STATE               PIC X(02).
               10  ZIP-CODE            PIC X(10).
           05  ACCOUNT-BALANCE         PIC S9(9)V99 COMP-3.
           05  LAST-ACTIVITY-DATE      PIC X(08).

Best practices:
- Use meaningful names
- Consistent indentation
- Appropriate data types (COMP-3 for numeric)
- Proper level numbers
- Group related fields', ARRAY['COBOL', 'data-definition', 'best-practice', 'coding-standards'], 'BEGINNER', 0.88, 'COBOL_DEVELOPER'),

('PROCEDURE', 'TSO', 'GOVERNMENT', 'TSO Logon Problem Resolution', 'Steps to resolve TSO logon issues:

1. Check RACF user profile status:
   LISTUSER userid

2. Verify TSO segment exists:
   LISTUSER userid TSO

3. Check resource availability:
   - TSO region size limits
   - LRECL and BLKSIZE parameters
   - Dataset allocations

4. Review system logs:
   - SYSLOG for system messages
   - RACF SMF records
   - TSO/E messages

5. Common fixes:
   - Reset password if expired
   - Update TSO segment parameters
   - Increase region size
   - Check PROCLIB for TSO procedure', ARRAY['TSO', 'logon', 'RACF', 'troubleshooting'], 'INTERMEDIATE', 0.90, 'SECURITY_ADMIN'),

('BEST_PRACTICE', 'ISPF', 'RETAIL', 'ISPF Performance Optimization', 'ISPF performance tuning recommendations:

1. Dataset Organization:
   - Use appropriate LRECL and BLKSIZE
   - Consider PDS/E for large libraries
   - Implement proper space allocation

2. Edit Session Optimization:
   - Use BROWSE for read-only access
   - Enable ISPF statistics for tracking
   - Limit UNDO levels for large files

3. Memory Management:
   - Increase region size if needed
   - Monitor virtual storage usage
   - Use ISPF configuration options

4. Network Considerations:
   - Optimize 3270 session parameters
   - Use local editing when possible
   - Consider ISPF Client/Server

Commands:
ISPF SETTINGS → EDIT → Performance tab
TSO ISRDDN - Dataset list utility
TSO ISPVCALL - ISPF variable services', ARRAY['ISPF', 'performance', 'optimization', 'best-practice'], 'ADVANCED', 0.85, 'TOOLS_SPECIALIST'),

('REFERENCE', 'SMP/E', 'MANUFACTURING', 'SMP/E APPLY Processing Guide', 'SMP/E APPLY command processing:

APPLY Command Syntax:
  APPLY S(sourceid)
        SELECT(sysmod-list)
        BYPASS(error-reason-list)
        CHECK
        GROUPEXTEND
        REDO

Key Parameters:
- S(sourceid): Source zone identifier
- SELECT: Specific SYSMODs to apply
- BYPASS: Skip specific error checks
- CHECK: Report what would be applied
- GROUPEXTEND: Apply all requisites
- REDO: Reapply SYSMODs

Error Resolution:
1. Review ++HOLD information
2. Check BYPASS options for acceptable risks
3. Verify target zone status
4. Review requisite SYSMODs
5. Use RESTORE for backout if needed

Common BYPASS values:
- ID: Identity check
- REQ: Requisite check
- PRE: Pre-requisite check
- SUP: Superseding SYSMOD check', ARRAY['SMP/E', 'apply', 'maintenance', 'reference'], 'ADVANCED', 0.94, 'SYSPROG'),

('TROUBLESHOOTING', 'z/OS', 'INSURANCE', 'z/OS Performance Analysis', 'z/OS system performance troubleshooting:

1. CPU Analysis:
   - Review RMF CPU reports
   - Check for CPU-bound address spaces
   - Analyze dispatch queue lengths
   - Review WLM service classes

2. Storage Analysis:
   - Monitor real storage usage
   - Check paging rates
   - Review virtual storage usage
   - Analyze storage violations

3. I/O Analysis:
   - Review device response times
   - Check for I/O bottlenecks
   - Analyze channel utilization
   - Monitor DASD response

4. Application Analysis:
   - Review transaction volumes
   - Check database performance
   - Analyze message queue depths
   - Monitor batch job performance

Tools:
- RMF (Resource Measurement Facility)
- SDSF (System Display and Search Facility)
- OMEGAMON monitoring
- WLM service reports', ARRAY['z/OS', 'performance', 'analysis', 'monitoring'], 'EXPERT', 0.96, 'PERFORMANCE_ANALYST'),

('CODE_SAMPLE', 'USS', 'TELECOMMUNICATIONS', 'USS File System Management', 'Unix System Services file system commands:

# Check file system usage
df -k /tmp
du -sk /tmp/*

# Find large files
find /tmp -type f -size +100M -exec ls -lh {} +

# Clean up temporary files
find /tmp -name "*.tmp" -mtime +7 -exec rm {} +

# Mount file system (requires appropriate authority)
mount -t HFS -o rw /dev/dsk001 /u/users

# Monitor file system
iostat 5
vmstat 5

Shell scripting example:
#!/bin/sh
# Cleanup script
LOGFILE="/var/log/cleanup.log"
THRESHOLD=90

USAGE=$(df /tmp | tail -1 | awk '\''{print $5}'\'' | sed '\''s/%//g'\'')
if [ $USAGE -gt $THRESHOLD ]; then
    echo "$(date): /tmp usage at ${USAGE}%" >> $LOGFILE
    find /tmp -type f -mtime +1 -exec rm {} +
fi', ARRAY['USS', 'filesystem', 'shell', 'administration'], 'INTERMEDIATE', 0.87, 'UNIX_ADMIN'),

('PROCEDURE', 'RACF', 'BANKING', 'RACF Password Management', 'RACF password administration procedures:

1. Password Policy Setup:
   SETROPTS PASSWORD(ALGORITHM(KDFAES) MINLENGTH(8)
            MIXEDCASE SPECIAL(2) EXPIRE(90))

2. User Password Management:
   # Set new password
   PASSWORD userid

   # Reset expired password
   ALTUSER userid PASSWORD(newpassword) NOEXPIRED

   # Check password status
   LISTUSER userid

3. Password Synchronization:
   # Enable password sync
   ALTUSER userid PASSDATE(yyyy/ddd)

   # Password history
   SETROPTS PASSWORD(HISTORY(12))

4. Emergency Access:
   # Create emergency user
   ADDUSER EMERGENCY DFLTGRP(SYS1) PASSWORD(temppass)
           SPECIAL OPERATIONS

5. Audit and Monitoring:
   # Review password violations
   SEARCH CLASS(USER) FILTER(PWDVIOL)

   # Password aging report
   LISTUSER * OMIT', ARRAY['RACF', 'password', 'security', 'administration'], 'INTERMEDIATE', 0.93, 'SECURITY_SPECIALIST'),

('TROUBLESHOOTING', 'CA-7', 'FINANCE', 'CA-7 Job Scheduling Issues', 'CA-7 scheduler problem diagnosis:

1. Check Schedule Status:
   /F CA7,STATUS,SCHD=schedule-name
   /F CA7,STATUS,JOB=job-name

2. Review Dependencies:
   /F CA7,LIST,JOB=job-name,PRED
   /F CA7,LIST,JOB=job-name,SUCC

3. Common Issues:
   - Job not submitted on time
   - Dependency not satisfied
   - Resource conflicts
   - JCL errors

4. Resolution Commands:
   # Force job submission
   /F CA7,SUB,JOB=job-name

   # Reset job status
   /F CA7,RESET,JOB=job-name

   # Hold/Release jobs
   /F CA7,HOLD,JOB=job-name
   /F CA7,RLSE,JOB=job-name

5. Monitoring:
   /F CA7,LIST,INCOMP
   /F CA7,LIST,DEMAND
   /F CA7,JLOG,JOB=job-name', ARRAY['CA-7', 'scheduling', 'jobs', 'troubleshooting'], 'ADVANCED', 0.89, 'SCHEDULER_ADMIN'),

('BEST_PRACTICE', 'ENDEVOR', 'HEALTHCARE', 'ENDEVOR Change Management', 'ENDEVOR best practices for change management:

1. Environment Structure:
   - DEV → TEST → PROD progression
   - Proper stage definitions
   - Access control by environment

2. Element Management:
   - Consistent naming conventions
   - Proper type definitions
   - Version control discipline

3. Promotion Process:
   - Use automated promotion
   - Implement approval workflows
   - Maintain promotion history

4. Package Management:
   # Create package
   ENDEVOR CREATE PACKAGE package-name

   # Add elements to package
   ENDEVOR ADD ELEMENT element-name TO PACKAGE package-name

   # Promote package
   ENDEVOR PROMOTE PACKAGE package-name

5. Reporting and Auditing:
   - Regular promotion reports
   - Element history tracking
   - Change impact analysis
   - Backup verification

6. Integration:
   - SCLM integration for build
   - CA-7 integration for scheduling
   - ISPF interface for developers', ARRAY['ENDEVOR', 'change-management', 'promotion', 'best-practice'], 'ADVANCED', 0.91, 'CM_SPECIALIST');

-- Update usage counts for some knowledge base entries
UPDATE knowledge_base SET usage_count = 15, last_used_at = CURRENT_TIMESTAMP WHERE technical_area = 'CICS';
UPDATE knowledge_base SET usage_count = 12, last_used_at = CURRENT_TIMESTAMP - INTERVAL '2 days' WHERE technical_area = 'DB2';
UPDATE knowledge_base SET usage_count = 8, last_used_at = CURRENT_TIMESTAMP - INTERVAL '1 week' WHERE technical_area = 'JCL';
UPDATE knowledge_base SET usage_count = 5, last_used_at = CURRENT_TIMESTAMP - INTERVAL '3 days' WHERE technical_area = 'IMS';

-- Create some test scenarios for complex queries
INSERT INTO incidents_enhanced (title, description, technical_area, business_area, status, priority, metadata) VALUES
('Complex Integration Issue', 'Multi-system integration failure involving CICS, DB2, and MQ components. Transaction flow disrupted across all environments.', 'CICS', 'BANKING', 'OPEN', 'CRITICAL', '{"systems": ["CICS", "DB2", "MQ"], "complexity": "high", "impact": "cross-system"}'),
('Legacy Modernization Problem', 'COBOL to Java migration causing data inconsistencies. Mixed environment creating synchronization issues.', 'JAVA', 'FINANCE', 'IN_PROGRESS', 'HIGH', '{"migration": "COBOL-to-Java", "data_issues": true, "environment": "mixed"}'),
('Disaster Recovery Test Failure', 'DR test revealed multiple system dependencies not properly documented. Recovery procedures incomplete.', 'z/OS', 'INSURANCE', 'OPEN', 'HIGH', '{"test_type": "disaster_recovery", "dependencies": "undocumented", "procedures": "incomplete"});

-- Add some performance metrics data (for testing)
COMMENT ON TABLE incidents_enhanced IS 'Contains ' || (SELECT COUNT(*) FROM incidents_enhanced) || ' incident records';
COMMENT ON TABLE knowledge_base IS 'Contains ' || (SELECT COUNT(*) FROM knowledge_base) || ' knowledge entries';

-- Analyze tables for query optimization
ANALYZE incidents_enhanced;
ANALYZE knowledge_base;