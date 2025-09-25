'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DataSeeder = void 0;
const uuid_1 = require('uuid');
class DataSeeder {
  db;
  constructor(db) {
    this.db = db;
  }
  async seedMainframeKB() {
    console.log('🌱 Seeding mainframe knowledge base...');
    const entries = this.getMainframeEntries();
    let seeded = 0;
    let skipped = 0;
    let errors = 0;
    for (const entry of entries) {
      try {
        const existing = await this.findSimilarEntry(entry);
        if (existing) {
          console.log(`⏭️ Skipping similar entry: ${entry.title}`);
          skipped++;
          continue;
        }
        const id = await this.db.addEntry(
          {
            id: (0, uuid_1.v4)(),
            title: entry.title,
            problem: entry.problem,
            solution: entry.solution,
            category: entry.category,
            tags: entry.tags,
            severity: entry.severity || 'medium',
          },
          'system'
        );
        if (entry.estimatedSuccessRate) {
          const successCount = Math.floor(entry.estimatedSuccessRate * 10);
          const failureCount = 10 - successCount;
          await this.db.recordUsage(id, true, 'system');
          for (let i = 0; i < successCount - 1; i++) {
            await this.db.recordUsage(id, true, 'system');
          }
          for (let i = 0; i < failureCount; i++) {
            await this.db.recordUsage(id, false, 'system');
          }
        }
        console.log(`✅ Seeded: ${entry.title}`);
        seeded++;
      } catch (error) {
        console.error(`❌ Failed to seed: ${entry.title}`, error);
        errors++;
      }
    }
    console.log(`🌱 Seeding completed: ${seeded} seeded, ${skipped} skipped, ${errors} errors`);
    return { seeded, skipped, errors };
  }
  getMainframeEntries() {
    return [
      {
        title: 'VSAM Status 35 - File Not Found',
        problem:
          'Job abends with VSAM status code 35. The program cannot open the VSAM file for processing.',
        solution: `1. Verify dataset exists: Use ISPF 3.4 or TSO LISTCAT command
2. Check DD statement in JCL:
   - Verify DSN parameter is correct
   - Check spelling and case sensitivity
3. Ensure file is properly cataloged:
   - LISTCAT ENT('dataset.name') ALL
   - Check if alternate index is defined
4. Verify RACF permissions:
   - Use LISTDSD 'dataset.name'
   - Ensure READ/UPDATE access
5. Check if file was deleted or renamed recently
6. Verify correct catalog is being used (STEPCAT/JOBCAT)`,
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found', 'catalog', 'open-error'],
        severity: 'high',
        estimatedSuccessRate: 0.92,
      },
      {
        title: 'VSAM Status 37 - Space Problem',
        problem: 'VSAM file cannot extend due to space constraints, status code 37 returned.',
        solution: `1. Check space allocation:
   - LISTCAT ENT('dataset.name') ALL
   - Review SPACE parameters in allocation
2. Extend the dataset:
   - ALTER dataset.name ADDVOLUMES(volume)
   - Or ALTER dataset.name FREESPACE(ci% ca%)
3. Check volume free space:
   - Use ISMF or DCOLLECT
   - Verify secondary allocation
4. For KSDS with alternate indexes:
   - Check AIX space separately
   - May need to extend base and AIX
5. Consider reorganization if fragmented:
   - EXPORT/DELETE/DEFINE/IMPORT cycle
6. Review FREESPACE settings for future`,
        category: 'VSAM',
        tags: ['vsam', 'status-37', 'space', 'extend', 'allocation'],
        severity: 'high',
        estimatedSuccessRate: 0.88,
      },
      {
        title: 'VSAM Status 39 - Record Already Exists',
        problem: 'Attempt to add a record with duplicate key to KSDS results in status 39.',
        solution: `1. Check application logic:
   - Verify key uniqueness before INSERT
   - Use READ followed by WRITE if needed
2. Use WRITE instead of INSERT if replacement allowed
3. For batch loading:
   - Sort input file by key
   - Remove duplicates before processing
4. Check if alternate index has unique key requirement
5. Debugging steps:
   - Display the key being inserted
   - Check if record exists with same key
   - Verify key field definition matches VSAM definition`,
        category: 'VSAM',
        tags: ['vsam', 'status-39', 'duplicate-key', 'ksds', 'record-exists'],
        severity: 'medium',
        estimatedSuccessRate: 0.95,
      },
      {
        title: 'S0C7 - Data Exception in COBOL',
        problem:
          'Program abends with S0C7 data exception. Usually occurs during arithmetic operations or MOVE statements.',
        solution: `1. Check for non-numeric data in numeric fields:
   - Use NUMERIC test before arithmetic operations
   - Initialize all COMP-3 fields properly with VALUE clause
2. Common causes and fixes:
   - Uninitialized working storage: Add VALUE ZEROS
   - Bad data from input file: Validate input with IF NUMERIC
   - Incorrect REDEFINES: Check field alignments
   - Sign overpunch in zoned decimal: Use SIGN LEADING SEPARATE
3. Debugging techniques:
   - Add DISPLAY statements before arithmetic
   - Use CEDF (CICS) or TEST(COBOL) for batch
   - Check compile listing for data definitions
4. Prevention measures:
   - Use NUMPROC(NOPFD) compile option
   - Add ON SIZE ERROR clauses to arithmetic
   - Validate all input data fields
   - Initialize WORKING-STORAGE with proper VALUES`,
        category: 'Batch',
        tags: ['s0c7', 'data-exception', 'numeric', 'abend', 'cobol', 'arithmetic'],
        severity: 'critical',
        estimatedSuccessRate: 0.91,
      },
      {
        title: 'S0C4 - Protection Exception',
        problem: 'Program attempts to access protected storage area, resulting in S0C4 abend.',
        solution: `1. Check table subscripts and array bounds:
   - Verify OCCURS limits in table definitions
   - Add bounds checking before table access
   - Use SEARCH instead of direct indexing where possible
2. Working storage initialization:
   - Initialize all pointers and addresses
   - Check for null pointer references
   - Verify BASED variables have proper addressing
3. Parameter passing issues:
   - Check USING clause parameter count
   - Verify CALL statement parameter matching
   - Ensure passed areas are large enough
4. Memory overlay problems:
   - Check for REDEFINES alignment issues
   - Verify move operations don't exceed target size
   - Look for corrupted linkage section
5. Debug with:
   - Compile listing to check offsets
   - Memory dump analysis
   - Step-through debugging`,
        category: 'Batch',
        tags: ['s0c4', 'protection-exception', 'bounds', 'pointer', 'cobol'],
        severity: 'critical',
        estimatedSuccessRate: 0.87,
      },
      {
        title: 'S013 - Open Error - Member Not Found',
        problem:
          'Program abends with S013 when attempting to open a PDS member that does not exist.',
        solution: `1. Verify member exists in PDS:
   - Use ISPF 3.4 to browse PDS
   - Check member name spelling and case
2. Check DD statement:
   - Verify DSN(member) syntax is correct
   - Ensure PDS name is correct
3. For program calls:
   - Check if load module exists in STEPLIB
   - Verify member in correct load library
   - Check if alias names are used
4. Dynamic allocation issues:
   - Verify DYNAMNBR parameter if using dynamic calls
   - Check if library is in JOBLIB/STEPLIB concatenation
5. Recent changes:
   - Check if member was deleted or renamed
   - Verify backup/restore procedures`,
        category: 'Batch',
        tags: ['s013', 'open-error', 'member-not-found', 'pds', 'load-module'],
        severity: 'high',
        estimatedSuccessRate: 0.94,
      },
      {
        title: 'JCL Error - IEF212I Dataset Not Found',
        problem: 'JCL fails with IEF212I dataset not found error during job execution.',
        solution: `1. Verify dataset name accuracy:
   - Check spelling exactly (case sensitive for some systems)
   - Verify GDG generation: (0), (-1), (+1)
   - Ensure no extra spaces in DSN parameter
2. Check dataset existence:
   - TSO LISTD 'dataset.name'
   - Use ISPF 3.4 to verify
   - For tape datasets, check volume mounting
3. Catalog issues:
   - LISTCAT ENT('dataset.name')
   - Check if dataset is cataloged properly
   - Verify STEPCAT/JOBCAT if using private catalogs
4. Previous step dependency:
   - Ensure previous step created the dataset
   - Check DISP parameter on creating step
   - Verify conditional execution (COND parameter)
5. Quote handling:
   - Use DSN='USER.DATASET' for non-system datasets
   - Remove quotes for system datasets like DSN=SYS1.PARMLIB
6. Generation Data Group (GDG) specifics:
   - Verify GDG base is defined
   - Check if generation exists
   - Use proper relative generation number`,
        category: 'JCL',
        tags: ['jcl', 'dataset', 'ief212i', 'not-found', 'allocation'],
        severity: 'high',
        estimatedSuccessRate: 0.9,
      },
      {
        title: 'JCL Error - IEF244I Unable to Allocate Space',
        problem: 'Job fails with IEF244I unable to allocate space during dataset allocation.',
        solution: `1. Check SPACE parameter:
   - Increase primary/secondary allocation
   - SPACE=(TRK,(primary,secondary)) or SPACE=(CYL,(primary,secondary))
   - Consider using SPACE=(TRK,(0,1,100)) for PDS with many members
2. Volume space issues:
   - Check available space on specified volume
   - Use different UNIT or VOLUME parameter
   - Let system select volume by omitting VOLUME
3. Dataset organization and LRECL:
   - Verify LRECL and BLKSIZE are appropriate
   - Check DCB parameters match data requirements
   - Use SMS dataclas if available
4. For PDS/PDSE:
   - Increase directory blocks: SPACE=(TRK,(5,5,10))
   - Consider PDSE instead of PDS for large directories
5. Temporary datasets:
   - Use unique DSN names for temporary files
   - Consider using &&TEMP naming convention
   - Check if dataset already exists from previous run`,
        category: 'JCL',
        tags: ['jcl', 'ief244i', 'space', 'allocation', 'volume'],
        severity: 'medium',
        estimatedSuccessRate: 0.85,
      },
      {
        title: 'DB2 SQLCODE -904 - Resource Unavailable',
        problem:
          'DB2 program receives SQLCODE -904 indicating resource not available for operation.',
        solution: `1. Check database/tablespace status:
   - -DISPLAY DATABASE(dbname) SPACES(*)
   - Look for STOP, STOPP, RECP, COPY states
2. Resolve specific conditions:
   - RECP (Recovery Pending): Run IMAGE COPY utility
   - STOPP (Stop Pending): Resolve the underlying issue first
   - COPY (Copy Pending): Complete the image copy process
3. For index issues:
   - -DISPLAY DATABASE(dbname) SPACENAM(*) RESTRICT(INDEX)
   - REBUILD INDEX if needed
   - Check for RBDP (Rebuild Pending) status
4. Space-related problems:
   - Check if tablespace/indexspace is full
   - Extend the space or drop/recreate
   - Monitor space utilization trends
5. Lock/contention issues:
   - Increase IRLMRWT parameter for timeout
   - Check for long-running transactions
   - Review application commit frequency
6. Contact DBA if:
   - Issue persists after basic checks
   - Multiple applications affected
   - System-wide DB2 problems`,
        category: 'DB2',
        tags: ['db2', 'sqlcode', '-904', 'resource', 'unavailable', 'tablespace'],
        severity: 'critical',
        estimatedSuccessRate: 0.82,
      },
      {
        title: 'DB2 SQLCODE -803 - Duplicate Key',
        problem: 'Attempt to insert or update row results in duplicate key violation.',
        solution: `1. Check application logic:
   - Verify key uniqueness before INSERT
   - Use SELECT before INSERT to check existence
   - Consider UPDATE instead of INSERT if appropriate
2. For primary key violations:
   - Review key generation logic
   - Check if sequence/counter is properly managed
   - Verify timestamp-based keys account for duplicates
3. For unique index violations:
   - Identify which unique index is violated
   - Review business rules for uniqueness
   - Check if composite key logic is correct
4. Data migration issues:
   - Clean source data before loading
   - Use MERGE statement for upsert operations
   - Handle duplicates in staging area first
5. Debugging steps:
   - Display the key values being inserted
   - Query existing data with same key
   - Check if multiple threads are inserting simultaneously`,
        category: 'DB2',
        tags: ['db2', 'sqlcode', '-803', 'duplicate-key', 'unique-constraint'],
        severity: 'medium',
        estimatedSuccessRate: 0.93,
      },
      {
        title: 'CICS ASRA - Program Check Abend',
        problem: 'CICS transaction abends with ASRA (addressing exception or program check).',
        solution: `1. Identify the specific exception:
   - Check CEDF for exact offset and exception type
   - 0C4: Storage protection violation
   - 0C7: Data exception (invalid numeric data)
   - 0C1: Operation exception
2. Common causes and solutions:
   - Uninitialized pointer: Initialize all BASED variables
   - Table overflow: Add bounds checking to OCCURS tables
   - COMMAREA length mismatch: Verify passed length matches definition
   - Working storage corruption: Check for overlays and REDEFINES
3. Debugging techniques:
   - Enable CEDF for interactive debugging
   - Use CETR for trace information
   - Check EIB fields for error conditions
   - Review compile listing at failure offset
4. Storage violations:
   - Check GETMAIN/FREEMAIN pairs
   - Verify pointer arithmetic
   - Look for buffer overruns in string operations
5. Prevention:
   - Initialize WORKING-STORAGE properly
   - Use CICS HANDLE CONDITION for error handling
   - Validate all input data thoroughly
   - Test boundary conditions`,
        category: 'CICS',
        tags: ['cics', 'asra', 'abend', 'program-check', 'addressing'],
        severity: 'critical',
        estimatedSuccessRate: 0.88,
      },
      {
        title: 'CICS AICA - Transaction Timeout',
        problem: 'CICS transaction abends with AICA due to runaway task or infinite loop.',
        solution: `1. Immediate actions:
   - Check for infinite loops in program logic
   - Review recent code changes
   - Verify database/file access patterns
2. Increase timeout if legitimate:
   - Modify transaction definition (TRANCLASS)
   - Adjust DTRTOUT in SIT parameters
   - Consider batch processing for long-running tasks
3. Code optimization:
   - Add EXEC CICS DELAY between iterations
   - Break large operations into smaller chunks
   - Use EXEC CICS SUSPEND for I/O intensive operations
4. Database performance:
   - Check for missing indexes causing table scans
   - Review SQL query efficiency
   - Monitor DB2 lock waits and deadlocks
5. System monitoring:
   - Use CEMT I TASK to monitor active tasks
   - Check for resource contention
   - Review system performance metrics
6. Long-term solutions:
   - Redesign for batch processing if appropriate
   - Implement progress indicators
   - Add intermediate commits for large updates`,
        category: 'CICS',
        tags: ['cics', 'aica', 'timeout', 'runaway', 'performance'],
        severity: 'high',
        estimatedSuccessRate: 0.85,
      },
      {
        title: 'IMS U0778 - Database Not Available',
        problem:
          'IMS transaction abends with U0778 indicating database not available for processing.',
        solution: `1. Check database status:
   - /DIS DB dbname
   - Look for NOTOPEN, STOPPED, or IOPREV status
2. Start database if stopped:
   - /STA DB dbname
   - Check for any prerequisites or dependencies
3. Check for exclusive usage:
   - /DIS PROG progname
   - Verify if batch job has database allocated
   - Check for utility jobs (REORG, RECOVER)
4. Verify PSB and DBD:
   - Ensure PSB includes required database
   - Check if DBD and PSB are current versions
   - Verify ACBGEN was successful
5. Recovery situations:
   - Check if database needs recovery
   - /DBR DB dbname if recovery pending
   - Review log for any issues
6. DBRC (Database Recovery Control):
   - Verify database is properly registered
   - Check for authorization issues
   - Review RECON dataset status`,
        category: 'IMS',
        tags: ['ims', 'u0778', 'database', 'unavailable', 'status'],
        severity: 'high',
        estimatedSuccessRate: 0.89,
      },
      {
        title: 'DFSORT WER027A - Insufficient Storage',
        problem: 'DFSORT fails with WER027A insufficient storage for sort operation.',
        solution: `1. Increase region size:
   - Change REGION=0M in JCL
   - Use REGION=128M or higher for large sorts
2. Add DFSORT control statements:
   //DFSPARM DD *
   OPTION MAINSIZE=MAX
   OPTION MOSIZE=MAX
   DYNALLOC=(SYSDA,255)
   /*
3. Optimize SORTWORK allocation:
   - Provide sufficient SORTWORK datasets
   - Use high-performance devices (SSD if available)
   - //SORTWORK DD UNIT=SYSDA,SPACE=(CYL,(100,100))
4. Use memory optimization:
   - OPTION VLSHRT for variable length records
   - OPTION EQUALS to maintain sequence
   - Consider OPTION FILESZ=E for estimation
5. For very large files:
   - Split into smaller pieces
   - Use multiple sort steps
   - Consider external sorting tools
6. Monitor system resources:
   - Check available virtual storage
   - Verify REGION limits not exceeded
   - Review sort work space usage`,
        category: 'Batch',
        tags: ['sort', 'dfsort', 'wer027a', 'storage', 'memory', 'region'],
        severity: 'medium',
        estimatedSuccessRate: 0.92,
      },
      {
        title: 'VSAM VERIFY Required After Improper Close',
        problem: 'VSAM file shows "NOT AVAILABLE" status and requires VERIFY after improper close.',
        solution: `1. Run IDCAMS VERIFY:
   //VERIFY EXEC PGM=IDCAMS
   //SYSPRINT DD SYSOUT=*
   //SYSIN DD *
   VERIFY DATASET('vsam.dataset.name')
   /*
2. If VERIFY fails:
   - Try VERIFY with PURGE option
   - Consider EXPORT/IMPORT if corruption detected
   - Restore from backup if necessary
3. Check cause of improper close:
   - Review job completion codes
   - Look for system crashes or cancellations
   - Check for open/close logic in programs
4. Prevention measures:
   - Ensure proper CLOSE statements in programs
   - Use DISP=(NEW,CATLG,DELETE) appropriately
   - Implement proper error handling
5. For frequent occurrences:
   - Consider SHAREOPTIONS(3,3) temporarily
   - Review application close logic
   - Check for system stability issues
6. Alternative recovery:
   - EXPORT to sequential file
   - DELETE and DEFINE new VSAM file
   - REPRO from sequential backup`,
        category: 'VSAM',
        tags: ['vsam', 'verify', 'improper-close', 'recovery', 'idcams'],
        severity: 'medium',
        estimatedSuccessRate: 0.96,
      },
      {
        title: 'FTP Transfer Failed - EDC8128I Connection Refused',
        problem: 'FTP file transfer fails with EDC8128I connection refused error.',
        solution: `1. Verify FTP server status:
   - Check if FTP daemon is running: NETSTAT
   - Verify port 21 is listening and available
   - Confirm server is not overloaded
2. Network connectivity:
   - Test with PING to verify basic connectivity
   - Check firewall rules allow FTP traffic
   - Verify routing tables if across networks
3. FTP configuration:
   - Check FTP.DATA configuration file
   - Verify TCPIP.PROFILE settings
   - Review PORT command configuration
4. Authentication issues:
   - Verify user ID and password
   - Check if account is locked or expired
   - Review FTP access permissions
5. Alternative solutions:
   - Try passive mode: LOCSITE PASSIVE
   - Use different FTP client if available
   - Consider SFTP if security required
6. Debug steps:
   - Enable FTP tracing: TRACE FTP
   - Check SYSLOG for detailed messages
   - Use NETSTAT to check connection states`,
        category: 'Network',
        tags: ['ftp', 'edc8128i', 'connection-refused', 'tcpip', 'network'],
        severity: 'medium',
        estimatedSuccessRate: 0.87,
      },
      {
        title: 'RACF Security Violation - ICH408I',
        problem: 'User receives ICH408I insufficient authority to access resource.',
        solution: `1. Identify required access:
   - Check what resource is being accessed
   - Determine required access level (READ/UPDATE/CONTROL)
   - Review business justification
2. Grant appropriate access:
   - PERMIT 'dataset.name' ID(userid) ACCESS(READ)
   - PERMIT 'resource.name' CLASS(class) ID(userid) ACCESS(UPDATE)
   - Use groups for multiple users: CONNECT userid GROUP(groupname)
3. For dataset access:
   - Check if dataset profile exists: LISTDSD 'dataset.name'
   - Verify generic profile rules: SEARCH CLASS(DATASET)
   - Consider using UACC for common access
4. For system resources:
   - Check facility class: RLIST FACILITY resource.name
   - Grant facility access: PERMIT resource.name CLASS(FACILITY) ID(userid)
5. Verify access after granting:
   - LISTDSD 'dataset.name' AUTHUSER(userid)
   - RLIST FACILITY resource.name AUTHUSER(userid)
6. Document and approve:
   - Follow security procedures for access requests
   - Document business justification
   - Review access periodically for compliance`,
        category: 'Security',
        tags: ['racf', 'ich408i', 'security', 'authority', 'permit'],
        severity: 'high',
        estimatedSuccessRate: 0.94,
      },
      {
        title: 'JES2 Output Not Found in SDSF',
        problem: 'Job output disappears or cannot be found in SDSF output queues.',
        solution: `1. Check job status and output:
   - Use job number in SDSF: O jobnum
   - Check different output classes: O;CLASS=A (or B,C,etc.)
   - Look in held output: H
2. Verify JCL output parameters:
   - Check MSGCLASS and SYSOUT parameters
   - Verify OUTPUT statement routing
   - Review CLASS parameter on SYSOUT DD
3. Check system routing:
   - Output may be routed to different system
   - Check for remote printers or nodes
   - Verify NJE routing tables
4. Search system logs:
   - Look in SYSLOG for job messages
   - Check for JES2 routing messages
   - Review operator commands affecting output
5. Retention and purging:
   - Check output retention period
   - Verify if automatic purge occurred
   - Look in archive systems if available
6. Use extended search:
   - ISFAFD panels for advanced search
   - Search by user ID, job name patterns
   - Check different time ranges`,
        category: 'JCL',
        tags: ['jes2', 'sdsf', 'output', 'missing', 'routing'],
        severity: 'medium',
        estimatedSuccessRate: 0.91,
      },
      {
        title: 'COBOL Program Performance Degradation',
        problem: 'COBOL batch program running significantly slower than normal.',
        solution: `1. Check for changed input data:
   - Verify input file size increase
   - Look for data skew or unusual patterns
   - Check for unsorted input requiring sorts
2. Review file access patterns:
   - Monitor VSAM file splits and CI/CA splits
   - Check for missing alternate indexes
   - Review sequential vs random access efficiency
3. Database performance:
   - Check for missing or dropped indexes
   - Review SQL explain plans for table scans
   - Monitor DB2 lock waits and timeouts
4. System resource constraints:
   - Check CPU utilization and paging
   - Verify available storage and region size
   - Monitor I/O subsystem performance
5. Code optimization:
   - Review algorithm efficiency changes
   - Check for inefficient loops or nested calls
   - Consider compile option changes (OPTIMIZE)
6. Recent changes:
   - Review recent program modifications
   - Check for system software updates
   - Verify configuration changes`,
        category: 'Batch',
        tags: ['cobol', 'performance', 'slow', 'optimization', 'degradation'],
        severity: 'medium',
        estimatedSuccessRate: 0.83,
      },
    ];
  }
  async findSimilarEntry(entry) {
    const results = await this.db.search(entry.title, 3);
    return results.some(
      result =>
        result.entry.title.toLowerCase() === entry.title.toLowerCase() ||
        (result.entry.category === entry.category &&
          this.calculateSimilarity(result.entry.problem, entry.problem) > 0.8)
    );
  }
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }
  async seedSystemConfig() {
    console.log('⚙️ Seeding system configuration...');
    const configs = [
      { key: 'app_version', value: '1.0.0', type: 'string', description: 'Application version' },
      {
        key: 'search_timeout_ms',
        value: '1000',
        type: 'integer',
        description: 'Search timeout in milliseconds',
      },
      {
        key: 'max_search_results',
        value: '50',
        type: 'integer',
        description: 'Maximum search results',
      },
      {
        key: 'auto_backup_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable automatic backups',
      },
      {
        key: 'backup_retention_days',
        value: '30',
        type: 'integer',
        description: 'Backup retention period',
      },
      {
        key: 'analytics_enabled',
        value: 'true',
        type: 'boolean',
        description: 'Enable usage analytics',
      },
      {
        key: 'gemini_api_key',
        value: '',
        type: 'string',
        description: 'Gemini API key for AI features',
      },
      {
        key: 'gemini_timeout_ms',
        value: '5000',
        type: 'integer',
        description: 'Gemini API timeout',
      },
      { key: 'ui_theme', value: 'light', type: 'string', description: 'UI theme preference' },
      {
        key: 'default_category',
        value: 'Other',
        type: 'string',
        description: 'Default category for new entries',
      },
    ];
    for (const config of configs) {
      try {
        await this.db.setConfig(config.key, config.value, config.type, config.description);
      } catch (error) {
        console.error(`Failed to set config ${config.key}:`, error);
      }
    }
    console.log('✅ System configuration seeded');
  }
  async seedSearchHistory() {
    console.log('🔍 Seeding sample search history...');
    const searches = [
      'VSAM status 35',
      'S0C7 error',
      'JCL dataset not found',
      'DB2 SQLCODE -904',
      'CICS ASRA abend',
      'sort error WER027A',
      'file not found',
      'IMS database unavailable',
      'FTP connection refused',
      'RACF authority',
    ];
    for (const query of searches) {
      for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
        await this.db.logSearch(query, Math.floor(Math.random() * 10) + 1);
      }
    }
    console.log('✅ Search history seeded');
  }
  async seedAll() {
    console.log('🚀 Starting complete database seeding...');
    const kbResult = await this.seedMainframeKB();
    await this.seedSystemConfig();
    await this.seedSearchHistory();
    console.log(`🎉 Seeding completed! 
📊 Summary:
   - KB Entries: ${kbResult.seeded} seeded, ${kbResult.skipped} skipped, ${kbResult.errors} errors
   - System configuration initialized
   - Sample search history created
   
🚀 Knowledge Base is ready for use!`);
  }
  async needsSeeding() {
    const entryCount = await this.db.getEntryCount();
    return entryCount < 10;
  }
}
exports.DataSeeder = DataSeeder;
//# sourceMappingURL=DataSeeder.js.map
