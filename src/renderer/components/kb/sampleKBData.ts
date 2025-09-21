import { KBEntry } from '../kb-entry/KBEntryCard';

export function generateSampleKBData(): KBEntry[] {
  const now = new Date();
  const getDateDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'kb-001',
      title: 'S0C7 Data Exception Error Resolution',
      problem: `S0C7 ABEND occurred in COBOL program during numeric computation.

Error Details:
- ABEND Code: S0C7 (Data Exception)
- Program: PAYROLL1
- Module: PAY-CALC
- Line: 1247

Symptoms:
1. Program terminates unexpectedly during calculation
2. Error occurs when processing employee overtime
3. SYSUDUMP shows invalid packed decimal data
4. Issue happens with specific employee records only

Root Cause:
The program attempts to perform arithmetic on a numeric field that contains invalid data (spaces, low-values, or non-numeric characters).`,

      solution: `1. Check the input data for invalid characters
   - Use DISPLAY statements to examine the field content
   - Verify data is properly initialized before use

2. Add data validation before arithmetic operations:
   //STEP1    EXEC PGM=IEFBR14
   //SYSPRINT DD SYSOUT=*

   IF NUMERIC-FIELD = SPACES OR LOW-VALUES
      MOVE ZERO TO NUMERIC-FIELD
   END-IF

   IF NUMERIC-FIELD IS NOT NUMERIC
      DISPLAY 'Invalid data in field: ' NUMERIC-FIELD
      MOVE ZERO TO NUMERIC-FIELD
   END-IF

3. Use COMP-3 (packed decimal) properly:
   - Initialize all numeric fields to zero
   - Use proper PIC clauses with sign indication
   - Validate input data from external sources

4. Add error handling:
   COMPUTE WS-RESULT = WS-AMOUNT * WS-RATE
   ON SIZE ERROR
      DISPLAY 'Computation error for employee: ' EMP-ID
      MOVE ZERO TO WS-RESULT
   END-COMPUTE

Note: Always initialize numeric fields and validate external data before arithmetic operations.`,

      category: 'Batch',
      tags: ['S0C7', 'ABEND', 'COBOL', 'numeric-data', 'validation', 'packed-decimal'],
      created_at: getDateDaysAgo(15),
      updated_at: getDateDaysAgo(3),
      usage_count: 45,
      success_count: 42,
      failure_count: 3,
      confidence_score: 0.93,
      related_entries: ['kb-002', 'kb-003'],
      code_examples: [
        `* Data validation example
IF NUMERIC-FIELD = SPACES OR LOW-VALUES
   MOVE ZERO TO NUMERIC-FIELD
END-IF`,
        `* Error handling in computation
COMPUTE WS-RESULT = WS-AMOUNT * WS-RATE
ON SIZE ERROR
   DISPLAY 'Computation error'
   MOVE ZERO TO WS-RESULT
END-COMPUTE`
      ],
      estimated_resolution_time: 15
    },

    {
      id: 'kb-002',
      title: 'S0C4 Protection Exception in CICS Transaction',
      problem: `S0C4 ABEND (Protection Exception) occurring in CICS transaction PAYM.

Error Details:
- ABEND Code: S0C4 (Protection Exception)
- Transaction: PAYM
- Program: PYMTRAN1
- CICS Message: DFHAC2206

Symptoms:
1. Transaction abends immediately after EXEC CICS READ
2. User receives "Transaction PAYM has abended" message
3. CICS logs show protection exception
4. Issue occurs with specific customer records

Environment:
- CICS 5.6
- COBOL program accessing VSAM file
- High-volume online transaction`,

      solution: `1. Check working storage alignment and initialization:
   01  WS-CUSTOMER-RECORD.
       05  CUST-ID          PIC X(10).
       05  CUST-NAME        PIC X(30).
       05  CUST-BALANCE     PIC S9(7)V99 COMP-3.

2. Verify CICS commands are properly formatted:
   EXEC CICS READ
        DATASET('CUSTFILE')
        INTO(WS-CUSTOMER-RECORD)
        RIDFLD(WS-CUSTOMER-KEY)
        LENGTH(LENGTH OF WS-CUSTOMER-RECORD)
        RESP(WS-RESP)
   END-EXEC

3. Add proper error handling:
   IF WS-RESP NOT = DFHRESP(NORMAL)
      EXEC CICS ABEND ABCODE('CUS1') END-EXEC
   END-IF

4. Check BLL (Base Locator for Linkage) usage:
   - Ensure all addressability is properly established
   - Verify SERVICE RELOAD statements if using

5. Review file definitions in FCT:
   - Verify VSAM file is properly defined
   - Check LSR pool settings
   - Ensure file is enabled and open

Warning: Always check RESP codes after CICS commands to prevent cascading errors.`,

      category: 'CICS',
      tags: ['S0C4', 'CICS', 'protection-exception', 'VSAM', 'transaction', 'memory'],
      created_at: getDateDaysAgo(20),
      updated_at: getDateDaysAgo(5),
      usage_count: 38,
      success_count: 35,
      failure_count: 3,
      confidence_score: 0.92,
      related_entries: ['kb-001', 'kb-005'],
      code_examples: [
        `EXEC CICS READ
     DATASET('CUSTFILE')
     INTO(WS-CUSTOMER-RECORD)
     RIDFLD(WS-CUSTOMER-KEY)
     LENGTH(LENGTH OF WS-CUSTOMER-RECORD)
     RESP(WS-RESP)
END-EXEC`,
        `IF WS-RESP NOT = DFHRESP(NORMAL)
   EVALUATE WS-RESP
      WHEN DFHRESP(NOTFND)
         DISPLAY 'Customer not found'
      WHEN DFHRESP(IOERR)
         DISPLAY 'I/O error occurred'
   END-EVALUATE
   EXEC CICS ABEND ABCODE('CUS1') END-EXEC
END-IF`
      ],
      estimated_resolution_time: 25
    },

    {
      id: 'kb-003',
      title: 'U4038 ABEND in VSAM File Processing',
      problem: `U4038 User ABEND encountered during VSAM file update operation.

Error Details:
- ABEND Code: U4038
- Program: CUSTUPDT
- Module: VSAM-UPDATE
- VSAM Return Code: 8
- VSAM Reason Code: 108

Symptoms:
1. Batch job fails during customer file update
2. ABEND occurs after successful READ but during REWRITE
3. Error message: "VSAM logical error"
4. Job runs successfully with smaller input files
5. No issues with file browsing utilities

Investigation Results:
- VSAM file shows no structural damage
- LISTCAT output appears normal
- Space allocation seems adequate`,

      solution: `1. Check VSAM file integrity and space:
   //STEP1    EXEC PGM=IDCAMS
   //SYSPRINT DD SYSOUT=*
   //SYSIN    DD *
      VERIFY -
         DATASET(PROD.CUSTOMER.MASTER) -
         CATALOG(MASTER.CATALOG)
   /*

2. Review record locking in program:
   - Ensure proper record lock/unlock sequence
   - Check for concurrent access issues
   - Verify COBOL file status checks

3. Add comprehensive VSAM status checking:
   READ CUSTOMER-FILE INTO WS-CUSTOMER-REC
   IF CUSTOMER-FILE-STATUS NOT = '00'
      DISPLAY 'READ error: ' CUSTOMER-FILE-STATUS
      IF CUSTOMER-FILE-STATUS = '23'
         DISPLAY 'Record not found'
      ELSE
         DISPLAY 'VSAM error occurred'
      END-IF
      GO TO ERROR-PROCESSING
   END-IF

4. Increase VSAM buffers in JCL:
   //CUSTFILE DD DSN=PROD.CUSTOMER.MASTER,DISP=SHR,
   //         AMP='BUFND=20,BUFNI=5'

5. Check for CI/CA splits and reorganize if needed:
   //REORG    EXEC PGM=IDCAMS
   //SYSIN    DD *
      REPRO -
         INFILE(DD1) -
         OUTFILE(DD2)
   /*

Important: Always backup VSAM files before reorganization.`,

      category: 'VSAM',
      tags: ['U4038', 'VSAM', 'file-processing', 'update', 'locking', 'status-codes'],
      created_at: getDateDaysAgo(10),
      updated_at: getDateDaysAgo(2),
      usage_count: 29,
      success_count: 27,
      failure_count: 2,
      confidence_score: 0.93,
      related_entries: ['kb-004', 'kb-006'],
      code_examples: [
        `VERIFY -
   DATASET(PROD.CUSTOMER.MASTER) -
   CATALOG(MASTER.CATALOG)`,
        `READ CUSTOMER-FILE INTO WS-CUSTOMER-REC
IF CUSTOMER-FILE-STATUS NOT = '00'
   EVALUATE CUSTOMER-FILE-STATUS
      WHEN '23'
         DISPLAY 'Record not found'
      WHEN '24'
         DISPLAY 'Invalid key'
      WHEN OTHER
         DISPLAY 'VSAM error: ' CUSTOMER-FILE-STATUS
   END-EVALUATE
END-IF`
      ],
      estimated_resolution_time: 30
    },

    {
      id: 'kb-004',
      title: 'JCL Error IEF450I Job Step Not Found',
      problem: `JCL job fails with IEF450I message - job step not found.

Error Details:
- Message: IEF450I JOBSTEP1 - STEP NOT FOUND
- Job: CUSTOMER1
- Step: BACKUP
- Return Code: JCL ERROR

Symptoms:
1. Job terminates before execution begins
2. JCL error occurs during job parsing
3. JESYSMSG shows IEF450I for specific step
4. Other jobs with similar JCL run successfully
5. Problem started after recent JCL modification

JCL Structure:
//CUSTOMER1 JOB CLASS=A,MSGCLASS=X
//STEP1    EXEC PGM=IEFBR14
//DD1      DD DSN=DATA.SET,DISP=SHR
//BACKUP   EXEC PGM=IEBGENER
//SYSIN    DD DUMMY`,

      solution: `1. Check JCL step naming and syntax:
   //CUSTOMER1 JOB CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID
   //STEP1    EXEC PGM=IEFBR14
   //DD1      DD DSN=DATA.SET,DISP=SHR
   //
   //BACKUP   EXEC PGM=IEBGENER
   //SYSPRINT DD SYSOUT=*
   //SYSUT1   DD DSN=INPUT.FILE,DISP=SHR
   //SYSUT2   DD DSN=BACKUP.FILE,DISP=(NEW,CATLG),
   //            UNIT=SYSDA,SPACE=(TRK,(10,5))
   //SYSIN    DD DUMMY

2. Verify JCL continuation rules:
   - Check for missing continuation characters
   - Ensure proper spacing after //
   - Verify step names are unique within job

3. Common JCL syntax errors to check:
   - Missing // at start of statement
   - Invalid characters in step names
   - Improper continuation (missing comma)
   - Step names longer than 8 characters

4. Use JCL checking utility:
   //JCLCHECK EXEC PGM=IFOX00,PARM='OBJECT,NODECK'
   //STEPLIB  DD DSN=SYS1.LINKLIB,DISP=SHR
   //SYSLIB   DD DSN=SYS1.MACLIB,DISP=SHR
   //SYSIN    DD DSN=YOUR.JCL.LIBRARY(MEMBER),DISP=SHR

5. Check for embedded control characters:
   - Copy JCL to new member to remove hidden characters
   - Verify JCL was not corrupted during transfer

Note: Step names must start in column 3 and be 1-8 characters long.`,

      category: 'JCL',
      tags: ['IEF450I', 'JCL', 'syntax-error', 'step-not-found', 'job-control'],
      created_at: getDateDaysAgo(8),
      updated_at: getDateDaysAgo(1),
      usage_count: 52,
      success_count: 49,
      failure_count: 3,
      confidence_score: 0.94,
      related_entries: ['kb-007', 'kb-008'],
      code_examples: [
        `//CUSTOMER1 JOB CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID
//STEP1    EXEC PGM=IEFBR14
//DD1      DD DSN=DATA.SET,DISP=SHR
//
//BACKUP   EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*`,
        `//JCLCHECK EXEC PGM=IFOX00,PARM='OBJECT,NODECK'
//STEPLIB  DD DSN=SYS1.LINKLIB,DISP=SHR
//SYSLIB   DD DSN=SYS1.MACLIB,DISP=SHR`
      ],
      estimated_resolution_time: 10
    },

    {
      id: 'kb-005',
      title: 'SQLCODE -803 Duplicate Key Error in DB2',
      problem: `DB2 insert operation fails with SQLCODE -803 duplicate key violation.

Error Details:
- SQLCODE: -803
- SQLSTATE: 23505
- Table: CUSTOMER_MASTER
- Index: CUST_ID_PK (Primary Key)
- Program: CUSTLOAD

Symptoms:
1. Batch load job abends on INSERT statement
2. Error occurs sporadically with certain input records
3. Table appears to have no duplicate keys when browsed
4. Same data loads successfully in test environment
5. Problem started after recent DB2 maintenance

SQL Statement:
INSERT INTO CUSTOMER_MASTER
(CUST_ID, CUST_NAME, CUST_TYPE, CREATE_DATE)
VALUES (?, ?, ?, CURRENT DATE)`,

      solution: `1. Check for existing data in table:
   SELECT CUST_ID, COUNT(*)
   FROM CUSTOMER_MASTER
   WHERE CUST_ID = 'specific-id'
   GROUP BY CUST_ID
   HAVING COUNT(*) > 1;

2. Use MERGE statement instead of INSERT for upsert logic:
   MERGE INTO CUSTOMER_MASTER AS TARGET
   USING (VALUES (?, ?, ?, CURRENT DATE)) AS SOURCE
         (CUST_ID, CUST_NAME, CUST_TYPE, CREATE_DATE)
   ON TARGET.CUST_ID = SOURCE.CUST_ID
   WHEN NOT MATCHED THEN
      INSERT (CUST_ID, CUST_NAME, CUST_TYPE, CREATE_DATE)
      VALUES (SOURCE.CUST_ID, SOURCE.CUST_NAME,
              SOURCE.CUST_TYPE, SOURCE.CREATE_DATE)
   WHEN MATCHED THEN
      UPDATE SET CUST_NAME = SOURCE.CUST_NAME,
                 CUST_TYPE = SOURCE.CUST_TYPE;

3. Add error handling in COBOL program:
   EXEC SQL
      INSERT INTO CUSTOMER_MASTER
      (CUST_ID, CUST_NAME, CUST_TYPE, CREATE_DATE)
      VALUES (:WS-CUST-ID, :WS-CUST-NAME,
              :WS-CUST-TYPE, CURRENT DATE)
   END-EXEC

   IF SQLCODE = -803
      DISPLAY 'Duplicate key for customer: ' WS-CUST-ID
      PERFORM UPDATE-EXISTING-CUSTOMER
   ELSE IF SQLCODE < 0
      DISPLAY 'SQL error: ' SQLCODE
      PERFORM ERROR-HANDLING
   END-IF

4. Check for committed vs uncommitted data:
   - Verify isolation level settings
   - Check for phantom reads
   - Review transaction boundaries

5. Analyze DB2 logs for sequence of events:
   -DSN1LOGP utility to examine log records
   -Check for timing issues with concurrent processes

Important: Consider using INSERT with WHERE NOT EXISTS for complex duplicate checking.`,

      category: 'DB2',
      tags: ['SQLCODE-803', 'DB2', 'duplicate-key', 'primary-key', 'merge', 'upsert'],
      created_at: getDateDaysAgo(12),
      updated_at: getDateDaysAgo(4),
      usage_count: 41,
      success_count: 38,
      failure_count: 3,
      confidence_score: 0.93,
      related_entries: ['kb-009', 'kb-010'],
      code_examples: [
        `MERGE INTO CUSTOMER_MASTER AS TARGET
USING (VALUES (?, ?, ?, CURRENT DATE)) AS SOURCE
      (CUST_ID, CUST_NAME, CUST_TYPE, CREATE_DATE)
ON TARGET.CUST_ID = SOURCE.CUST_ID
WHEN NOT MATCHED THEN
   INSERT (CUST_ID, CUST_NAME, CUST_TYPE, CREATE_DATE)
   VALUES (SOURCE.CUST_ID, SOURCE.CUST_NAME,
           SOURCE.CUST_TYPE, SOURCE.CREATE_DATE)`,
        `IF SQLCODE = -803
   DISPLAY 'Duplicate key for customer: ' WS-CUST-ID
   PERFORM UPDATE-EXISTING-CUSTOMER
ELSE IF SQLCODE < 0
   DISPLAY 'SQL error: ' SQLCODE
   PERFORM ERROR-HANDLING
END-IF`
      ],
      estimated_resolution_time: 20
    },

    {
      id: 'kb-006',
      title: 'IMS DL/I Status Code BA - Segment Not Found',
      problem: `IMS application receives status code BA when attempting to retrieve customer segment.

Error Details:
- Status Code: BA (Segment Not Found)
- PCB: CUSTOMER-PCB
- Segment: CUST-SEGMENT
- Program: CUSTINQ1
- Call: GU (Get Unique)

Symptoms:
1. Customer inquiry program returns "Record not found"
2. Status code BA returned consistently for specific customers
3. Database browse utilities show records exist
4. Same customer IDs work in other programs
5. Issue appeared after recent database reorganization

Call Structure:
CALL 'CBLTDLI' USING GU-FUNCTION
                     CUSTOMER-PCB
                     CUST-IO-AREA
                     CUST-SSA`,

      solution: `1. Verify SSA (Segment Search Argument) construction:
   01  CUST-SSA.
       05  FILLER           PIC X(8) VALUE 'CUSTSEG '.
       05  FILLER           PIC X VALUE '('.
       05  FILLER           PIC X(8) VALUE 'CUSTKEY '.
       05  FILLER           PIC X VALUE '='.
       05  CUST-KEY-VALUE   PIC X(10).
       05  FILLER           PIC X VALUE ')'.

2. Check key field formatting and padding:
   MOVE CUSTOMER-ID TO CUST-KEY-VALUE
   * Ensure proper padding for fixed-length keys
   IF CUSTOMER-ID < 10 CHARACTERS
      STRING CUSTOMER-ID DELIMITED BY SPACE
             SPACES DELIMITED BY SIZE
             INTO CUST-KEY-VALUE
   END-IF

3. Verify PCB status checking:
   CALL 'CBLTDLI' USING GU-FUNCTION
                        CUSTOMER-PCB
                        CUST-IO-AREA
                        CUST-SSA

   IF CUST-STATUS-CODE = SPACES
      DISPLAY 'Customer found: ' CUST-ID
   ELSE
      EVALUATE CUST-STATUS-CODE
         WHEN 'GE'
            DISPLAY 'End of database'
         WHEN 'BA'
            DISPLAY 'Segment not found for: ' CUSTOMER-ID
         WHEN 'GB'
            DISPLAY 'End of path'
         WHEN OTHER
            DISPLAY 'IMS error: ' CUST-STATUS-CODE
      END-EVALUATE
   END-IF

4. Check database organization after reorganization:
   - Verify RELOAD statistics
   - Check for missing or corrupted index pointers
   - Validate database integrity with DFSURGU0

5. Use different positioning strategies:
   * Try GN (Get Next) after positioning
   * Use qualified SSA with multiple fields
   * Consider path calls if dealing with hierarchical data

Note: BA status is normal for non-existent records - verify your search key values.`,

      category: 'IMS',
      tags: ['IMS', 'DL/I', 'status-BA', 'segment-not-found', 'SSA', 'database'],
      created_at: getDateDaysAgo(18),
      updated_at: getDateDaysAgo(6),
      usage_count: 23,
      success_count: 21,
      failure_count: 2,
      confidence_score: 0.91,
      related_entries: ['kb-011', 'kb-012'],
      code_examples: [
        `01  CUST-SSA.
    05  FILLER           PIC X(8) VALUE 'CUSTSEG '.
    05  FILLER           PIC X VALUE '('.
    05  FILLER           PIC X(8) VALUE 'CUSTKEY '.
    05  FILLER           PIC X VALUE '='.
    05  CUST-KEY-VALUE   PIC X(10).
    05  FILLER           PIC X VALUE ')'.`,
        `CALL 'CBLTDLI' USING GU-FUNCTION
                     CUSTOMER-PCB
                     CUST-IO-AREA
                     CUST-SSA

IF CUST-STATUS-CODE = SPACES
   DISPLAY 'Customer found: ' CUST-ID
ELSE
   EVALUATE CUST-STATUS-CODE
      WHEN 'BA'
         DISPLAY 'Segment not found for: ' CUSTOMER-ID
      WHEN OTHER
         DISPLAY 'IMS error: ' CUST-STATUS-CODE
   END-EVALUATE
END-IF`
      ],
      estimated_resolution_time: 25
    },

    {
      id: 'kb-007',
      title: 'JES2 Spool Full Error JCL Job Queued',
      problem: `JES2 spool space exhausted causing jobs to queue indefinitely.

Error Details:
- Message: IEF196I IEF196I IGD103I SMS WAITING FOR SPOOL SPACE
- Condition: SPOOL FULL
- System: JES2 on z/OS 2.4
- Impact: All new jobs remain queued

Symptoms:
1. Jobs submit but never start executing
2. SDSF shows jobs in INPUT queue indefinitely
3. System console displays spool full messages
4. Existing running jobs continue normally
5. Spool utilization shows 98%+ usage

Console Messages:
$HASP050 JES2 SPOOL VOLUME SPOOL1 IS FULL
IEA911E SPOOL DATA SET IS FULL`,

      solution: `1. Immediate relief - purge old jobs and output:
   $PJ,Q=PRINT,DEST=DISCARD,AGE>2
   $PJ,Q=PURGE,AGE>1
   $PO,Q=HELD,AGE>1

2. Check current spool utilization:
   $DSPL
   $D SPOOLDEF

3. Add emergency spool volume:
   $ADD VOLUME(SPOOL2)
   $S SPOOLER,VOLUME=SPOOL2

4. Increase spool allocation in JES2PARM:
   SPOOLDEF(TRACK=(1000,500),CYL=(100,50))

5. Implement automated cleanup procedures:
   //CLEANUP  JOB CLASS=A,MSGCLASS=H
   //STEP1    EXEC PGM=HASPPURGE,PARM='JOB QUEUE,AGE>2'
   //STEP2    EXEC PGM=HASPPURGE,PARM='OUTPUT QUEUE,AGE>1'

6. Set up monitoring and alerts:
   - Monitor spool usage with automated scripts
   - Set threshold alerts at 85% capacity
   - Schedule regular cleanup jobs

7. Long-term capacity planning:
   - Analyze job output retention requirements
   - Implement automated output routing to printers
   - Consider additional spool volumes

Preventive measures:
- Set job output limits: /*OUTPUT FORMS=STD,DEST=PRINT1
- Use conditional output routing
- Implement job scheduling to spread workload`,

      category: 'JCL',
      tags: ['JES2', 'spool-full', 'IEF196I', 'queue', 'capacity', 'cleanup'],
      created_at: getDateDaysAgo(5),
      updated_at: getDateDaysAgo(1),
      usage_count: 67,
      success_count: 63,
      failure_count: 4,
      confidence_score: 0.94,
      related_entries: ['kb-004', 'kb-013'],
      code_examples: [
        `$PJ,Q=PRINT,DEST=DISCARD,AGE>2
$PJ,Q=PURGE,AGE>1
$PO,Q=HELD,AGE>1`,
        `//CLEANUP  JOB CLASS=A,MSGCLASS=H
//STEP1    EXEC PGM=HASPPURGE,PARM='JOB QUEUE,AGE>2'
//STEP2    EXEC PGM=HASPPURGE,PARM='OUTPUT QUEUE,AGE>1'`,
        `SPOOLDEF(TRACK=(1000,500),CYL=(100,50))`
      ],
      estimated_resolution_time: 5
    },

    {
      id: 'kb-008',
      title: 'COBOL File Status 39 - Conflicting File Attributes',
      problem: `COBOL program fails with file status 39 when attempting to open VSAM file.

Error Details:
- File Status: 39
- File: CUSTOMER-MASTER-FILE
- Program: CUSTRPT1
- Operation: OPEN INPUT
- VSAM Type: KSDS (Key Sequenced)

Symptoms:
1. Program abends immediately on file OPEN
2. File status 39 returned consistently
3. Same file opens successfully in other programs
4. File can be browsed with utilities (IDCAMS, FILEAID)
5. Problem started after COBOL program recompilation

COBOL File Definition:
SELECT CUSTOMER-MASTER-FILE
   ASSIGN TO CUSTFILE
   ORGANIZATION IS INDEXED
   ACCESS MODE IS SEQUENTIAL
   RECORD KEY IS CUST-KEY
   FILE STATUS IS CUST-FILE-STATUS.`,

      solution: `1. Check COBOL FD and VSAM file attributes alignment:
   FD  CUSTOMER-MASTER-FILE
       RECORDING MODE IS F
       RECORD IS VARYING IN SIZE FROM 100 TO 500
       DEPENDING ON CUST-REC-LENGTH.

   * Ensure RECORDING MODE matches VSAM definition
   * Verify RECORD length matches VSAM LRECL
   * Check DEPENDING ON clause if using variable records

2. Verify JCL DD statement attributes:
   //CUSTFILE DD DSN=PROD.CUSTOMER.MASTER,DISP=SHR,
   //         AMP='BUFND=10,BUFNI=5'
   * Remove conflicting DCB parameters for VSAM
   * Ensure proper DISP parameter
   * Check AMP parameters if specified

3. Compare COBOL record definition with VSAM:
   01  CUSTOMER-RECORD.
       05  CUST-KEY         PIC X(10).
       05  CUST-NAME        PIC X(30).
       05  CUST-TYPE        PIC X(2).
       05  CUST-BALANCE     PIC S9(7)V99 COMP-3.
       05  FILLER           PIC X(50).

   * Verify key position and length match VSAM definition
   * Check for alignment issues with COMP fields
   * Ensure total record length is correct

4. Use IDCAMS to check VSAM catalog entry:
   LISTCAT ENTRIES(PROD.CUSTOMER.MASTER) ALL

   Compare with COBOL definition:
   - KEYLEN (Key Length)
   - AVGLRECL/MAXLRECL (Record Length)
   - KEYPOS (Key Position)

5. Recompile with proper VSAM copy book:
   COPY CUSTREC.
   * Ensure copy book matches current VSAM structure
   * Check for recent changes to file layout
   * Verify all programs use same copy book version

6. Test with minimal program:
   OPEN INPUT CUSTOMER-MASTER-FILE
   IF CUST-FILE-STATUS NOT = '00'
      DISPLAY 'Open failed: ' CUST-FILE-STATUS
      DISPLAY 'Check file attributes alignment'
      STOP RUN
   END-IF

Warning: File status 39 indicates fundamental mismatch between COBOL definition and actual file attributes.`,

      category: 'VSAM',
      tags: ['file-status-39', 'COBOL', 'VSAM', 'file-attributes', 'KSDS', 'mismatch'],
      created_at: getDateDaysAgo(7),
      updated_at: getDateDaysAgo(2),
      usage_count: 34,
      success_count: 31,
      failure_count: 3,
      confidence_score: 0.91,
      related_entries: ['kb-003', 'kb-014'],
      code_examples: [
        `FD  CUSTOMER-MASTER-FILE
    RECORDING MODE IS F
    RECORD IS VARYING IN SIZE FROM 100 TO 500
    DEPENDING ON CUST-REC-LENGTH.`,
        `//CUSTFILE DD DSN=PROD.CUSTOMER.MASTER,DISP=SHR,
//         AMP='BUFND=10,BUFNI=5'`,
        `LISTCAT ENTRIES(PROD.CUSTOMER.MASTER) ALL`,
        `OPEN INPUT CUSTOMER-MASTER-FILE
IF CUST-FILE-STATUS NOT = '00'
   DISPLAY 'Open failed: ' CUST-FILE-STATUS
   DISPLAY 'Check file attributes alignment'
   STOP RUN
END-IF`
      ],
      estimated_resolution_time: 20
    },

    {
      id: 'kb-009',
      title: 'DB2 Deadlock Detection SQLCODE -911',
      problem: `DB2 application encounters SQLCODE -911 deadlock during concurrent processing.

Error Details:
- SQLCODE: -911
- SQLSTATE: 40001
- Reason Code: 00C90088 (Deadlock detected)
- Program: ORDPROC1
- Tables: ORDER_HEADER, ORDER_DETAIL, INVENTORY

Symptoms:
1. Online order processing transactions fail intermittently
2. Error occurs during peak processing hours
3. Multiple users processing orders simultaneously
4. Rollback messages in DB2 log
5. Performance degradation during concurrent access

SQL Operations:
UPDATE INVENTORY SET QTY_ON_HAND = QTY_ON_HAND - ?
WHERE ITEM_ID = ?

INSERT INTO ORDER_DETAIL
(ORDER_ID, ITEM_ID, QUANTITY, PRICE)
VALUES (?, ?, ?, ?)`,

      solution: `1. Implement consistent lock ordering:
   * Always access tables in same sequence across all programs
   * Order: INVENTORY → ORDER_HEADER → ORDER_DETAIL

   BEGIN TRANSACTION;

   -- Lock inventory first
   SELECT QTY_ON_HAND
   FROM INVENTORY
   WHERE ITEM_ID = ?
   FOR UPDATE;

   -- Then update order tables
   INSERT INTO ORDER_HEADER ...;
   INSERT INTO ORDER_DETAIL ...;

   -- Finally update inventory
   UPDATE INVENTORY SET QTY_ON_HAND = QTY_ON_HAND - ?
   WHERE ITEM_ID = ?;

   COMMIT;

2. Use lock timeout and retry logic:
   EXEC SQL SET CURRENT LOCK TIMEOUT = 5 END-EXEC

   PERFORM UNTIL SUCCESS-FLAG = 'Y' OR RETRY-COUNT > 3
      EXEC SQL
         UPDATE INVENTORY
         SET QTY_ON_HAND = QTY_ON_HAND - :WS-QUANTITY
         WHERE ITEM_ID = :WS-ITEM-ID
      END-EXEC

      IF SQLCODE = -911
         ADD 1 TO RETRY-COUNT
         PERFORM RANDOM-DELAY
         EXEC SQL ROLLBACK END-EXEC
      ELSE
         MOVE 'Y' TO SUCCESS-FLAG
      END-IF
   END-PERFORM

3. Minimize transaction duration:
   * Keep transactions as short as possible
   * Avoid user interaction within transactions
   * Commit frequently in batch processing

4. Implement optimistic locking where appropriate:
   SELECT ORDER_ID, ITEM_ID, QUANTITY, VERSION_NO
   FROM ORDER_DETAIL
   WHERE ORDER_ID = ?

   UPDATE ORDER_DETAIL
   SET QUANTITY = ?, VERSION_NO = VERSION_NO + 1
   WHERE ORDER_ID = ? AND VERSION_NO = ?

   IF SQLCODE = 100
      DISPLAY 'Record was modified by another user'
      PERFORM REFRESH-AND-RETRY
   END-IF

5. Monitor deadlock frequency:
   SELECT DEADLOCKS, LOCK_TIMEOUTS, LOCK_WAITS
   FROM SYSIBM.SYSSTATS
   WHERE STATS_TIME > CURRENT TIMESTAMP - 1 HOUR

6. Consider isolation level adjustments:
   SET TRANSACTION ISOLATION LEVEL READ COMMITTED
   * Use CS (Cursor Stability) instead of RR (Repeatable Read)
   * Reduces lock duration but may affect consistency

Important: Analyze deadlock chain with DB2 traces to identify root cause access patterns.`,

      category: 'DB2',
      tags: ['SQLCODE-911', 'DB2', 'deadlock', 'concurrency', 'locking', 'retry-logic'],
      created_at: getDateDaysAgo(14),
      updated_at: getDateDaysAgo(7),
      usage_count: 48,
      success_count: 44,
      failure_count: 4,
      confidence_score: 0.92,
      related_entries: ['kb-005', 'kb-015'],
      code_examples: [
        `BEGIN TRANSACTION;

-- Lock inventory first
SELECT QTY_ON_HAND
FROM INVENTORY
WHERE ITEM_ID = ?
FOR UPDATE;

-- Then update order tables
INSERT INTO ORDER_HEADER ...;
INSERT INTO ORDER_DETAIL ...;

-- Finally update inventory
UPDATE INVENTORY SET QTY_ON_HAND = QTY_ON_HAND - ?
WHERE ITEM_ID = ?;

COMMIT;`,
        `PERFORM UNTIL SUCCESS-FLAG = 'Y' OR RETRY-COUNT > 3
   EXEC SQL
      UPDATE INVENTORY
      SET QTY_ON_HAND = QTY_ON_HAND - :WS-QUANTITY
      WHERE ITEM_ID = :WS-ITEM-ID
   END-EXEC

   IF SQLCODE = -911
      ADD 1 TO RETRY-COUNT
      PERFORM RANDOM-DELAY
      EXEC SQL ROLLBACK END-EXEC
   ELSE
      MOVE 'Y' TO SUCCESS-FLAG
   END-IF
END-PERFORM`
      ],
      estimated_resolution_time: 35
    },

    {
      id: 'kb-010',
      title: 'CICS Storage Violation ASRA ABEND',
      problem: `CICS transaction abends with ASRA (Program Check) due to storage violation.

Error Details:
- ABEND Code: ASRA
- Transaction: ORDR
- Program: ORDERENT
- Offset: +0000A45E
- PSW: 070C1000 8000A45E

Symptoms:
1. Transaction terminates unexpectedly during data entry
2. CICS console shows storage protection violation
3. Problem occurs with large order entries (>50 line items)
4. Similar transactions with smaller data sets work fine
5. Issue started after recent program enhancement

Transaction Flow:
1. User enters order header information
2. Program allocates working storage for line items
3. User enters multiple line items
4. ASRA occurs during line item processing`,

      solution: `1. Check working storage bounds:
   01  WS-ORDER-LINES.
       05  WS-LINE-COUNT    PIC 9(3) COMP-3.
       05  WS-ORDER-LINE    OCCURS 1 TO 100 TIMES
                            DEPENDING ON WS-LINE-COUNT
                            INDEXED BY LINE-IDX.
           10  WS-ITEM-ID   PIC X(10).
           10  WS-QUANTITY  PIC 9(5) COMP-3.
           10  WS-PRICE     PIC 9(7)V99 COMP-3.

2. Add bounds checking before array access:
   IF LINE-IDX <= 100 AND LINE-IDX >= 1
      MOVE ITEM-ID TO WS-ITEM-ID(LINE-IDX)
      MOVE QUANTITY TO WS-QUANTITY(LINE-IDX)
      MOVE PRICE TO WS-PRICE(LINE-IDX)
   ELSE
      EXEC CICS SEND TEXT
           FROM('Maximum 100 line items allowed')
           LENGTH(30)
           ERASE
      END-EXEC
      GO TO SEND-MAP
   END-IF

3. Use CICS storage management:
   EXEC CICS GETMAIN
        SET(POINTER(WS-ORDER-PTR))
        LENGTH(WS-STORAGE-NEEDED)
        INITIMG(LOW-VALUE)
        RESP(WS-RESP)
   END-EXEC

   IF WS-RESP = DFHRESP(NORMAL)
      SET ADDRESS OF WS-ORDER-LINES TO WS-ORDER-PTR
   ELSE
      EXEC CICS ABEND ABCODE('STRG') END-EXEC
   END-IF

4. Initialize all working storage variables:
   INITIALIZE WS-ORDER-LINES
   MOVE ZERO TO WS-LINE-COUNT
   SET LINE-IDX TO 1

5. Add defensive programming checks:
   * Validate all subscripts before use
   * Check DEPENDING ON field values
   * Initialize pointers and indexes

6. Review CICS region storage settings:
   DSALIM=2G      (Data Space Allocation Limit)
   EDSALIM=1G     (Extended Data Space Limit)
   MAXOPENTCBS=200 (Maximum open TCBs)

7. Use CICS trace for debugging:
   CETR ON,SINGLE
   * Run transaction to reproduce problem
   * Use CEDF (Execution Diagnostic Facility)
   * Check storage usage with CEMT I PROG(program-name)

Note: ASRA abends often indicate subscript out of bounds or uninitialized pointer usage.`,

      category: 'CICS',
      tags: ['ASRA', 'CICS', 'storage-violation', 'array-bounds', 'working-storage', 'debugging'],
      created_at: getDateDaysAgo(9),
      updated_at: getDateDaysAgo(3),
      usage_count: 31,
      success_count: 28,
      failure_count: 3,
      confidence_score: 0.90,
      related_entries: ['kb-002', 'kb-016'],
      code_examples: [
        `01  WS-ORDER-LINES.
    05  WS-LINE-COUNT    PIC 9(3) COMP-3.
    05  WS-ORDER-LINE    OCCURS 1 TO 100 TIMES
                         DEPENDING ON WS-LINE-COUNT
                         INDEXED BY LINE-IDX.
        10  WS-ITEM-ID   PIC X(10).
        10  WS-QUANTITY  PIC 9(5) COMP-3.
        10  WS-PRICE     PIC 9(7)V99 COMP-3.`,
        `IF LINE-IDX <= 100 AND LINE-IDX >= 1
   MOVE ITEM-ID TO WS-ITEM-ID(LINE-IDX)
   MOVE QUANTITY TO WS-QUANTITY(LINE-IDX)
   MOVE PRICE TO WS-PRICE(LINE-IDX)
ELSE
   EXEC CICS SEND TEXT
        FROM('Maximum 100 line items allowed')
        LENGTH(30)
        ERASE
   END-EXEC
   GO TO SEND-MAP
END-IF`,
        `EXEC CICS GETMAIN
     SET(POINTER(WS-ORDER-PTR))
     LENGTH(WS-STORAGE-NEEDED)
     INITIMG(LOW-VALUE)
     RESP(WS-RESP)
END-EXEC

IF WS-RESP = DFHRESP(NORMAL)
   SET ADDRESS OF WS-ORDER-LINES TO WS-ORDER-PTR
ELSE
   EXEC CICS ABEND ABCODE('STRG') END-EXEC
END-IF`
      ],
      estimated_resolution_time: 40
    },

    {
      id: 'kb-011',
      title: 'Sort Utility WER108I Error - Invalid Control Statement',
      problem: `SORT utility job fails with WER108I error due to invalid control statement syntax.

Error Details:
- Message: WER108I INVALID CONTROL STATEMENT - COLUMN 14, CARD 3
- Utility: DFSORT
- Return Code: 16
- Step: SORTCUST

Symptoms:
1. Sort job terminates during control card processing
2. WER108I message points to specific column/card
3. Similar sort jobs run successfully
4. Input file contains valid data records
5. Problem appeared after modifying sort control cards

Sort Control Cards:
//SYSIN    DD *
  SORT FIELDS=(1,10,CH,A,11,20,CH,A)
  OUTREC FIELDS=(1:1,50)
  OUTFIL FNAMES=SORTOUT,
         INCLUDE=(51,1,CH,EQ,C'A')
/*`,

      solution: `1. Check sort control statement syntax:
   SORT FIELDS=(1,10,CH,A,11,20,CH,A)
   * Verify field positions don't exceed record length
   * Check data type specifications (CH, PD, BI, etc.)
   * Ensure proper field alignment

2. Correct common syntax errors:
   //SYSIN    DD *
     SORT FIELDS=(1,10,CH,A,11,20,CH,A)
     OUTREC FIELDS=(1:1,50)
     OUTFIL FNAMES=SORTOUT,
            INCLUDE=(51,1,CH,EQ,C'A')
   /*

   * Use proper continuation for multi-line statements
   * Check comma placement and parentheses matching
   * Verify all keywords are spelled correctly

3. Validate field specifications:
   * Position: Must be within record boundaries
   * Length: Cannot be zero or negative
   * Type: Must match actual data format

   Example for packed decimal:
   SORT FIELDS=(15,5,PD,A)  * 5-byte packed field at position 15

4. Test with ICETOOL for complex sorts:
   //STEP1    EXEC PGM=ICETOOL
   //TOOLMSG  DD SYSOUT=*
   //DFSMSG   DD SYSOUT=*
   //IN       DD DSN=INPUT.FILE,DISP=SHR
   //OUT      DD DSN=OUTPUT.FILE,DISP=(NEW,CATLG),
   //            UNIT=SYSDA,SPACE=(TRK,(100,20))
   //TOOLIN   DD *
     SORT FROM(IN) TO(OUT) USING(CTL1)
   /*
   //CTL1CNTL DD *
     SORT FIELDS=(1,10,CH,A)
     INCLUDE COND=(51,1,CH,EQ,C'A')
   /*

5. Use SORTDIAG for detailed error analysis:
   //SORTCUST EXEC PGM=SORT,PARM='EQUALS,SORTDIAG'
   //SORTDIAG DD SYSOUT=*
   * Reviews control statement parsing
   * Shows memory allocation details
   * Provides performance statistics

6. Common control statement patterns:
   * Simple sort:
     SORT FIELDS=(1,10,CH,A)

   * Multi-key sort:
     SORT FIELDS=(1,5,CH,A,20,10,PD,D)

   * Copy with selection:
     SORT FIELDS=COPY
     INCLUDE COND=(1,1,CH,EQ,C'A')

   * Record reformatting:
     SORT FIELDS=(1,10,CH,A)
     OUTREC FIELDS=(1:1,10,15:20,5,25:11,5)

Note: Use DFSORT reference manual for complete syntax rules and examples.`,

      category: 'Batch',
      tags: ['WER108I', 'SORT', 'DFSORT', 'control-statement', 'syntax-error', 'utility'],
      created_at: getDateDaysAgo(6),
      updated_at: getDateDaysAgo(1),
      usage_count: 26,
      success_count: 24,
      failure_count: 2,
      confidence_score: 0.92,
      related_entries: ['kb-004', 'kb-017'],
      code_examples: [
        `//SYSIN    DD *
  SORT FIELDS=(1,10,CH,A,11,20,CH,A)
  OUTREC FIELDS=(1:1,50)
  OUTFIL FNAMES=SORTOUT,
         INCLUDE=(51,1,CH,EQ,C'A')
/*`,
        `//STEP1    EXEC PGM=ICETOOL
//TOOLMSG  DD SYSOUT=*
//DFSMSG   DD SYSOUT=*
//IN       DD DSN=INPUT.FILE,DISP=SHR
//OUT      DD DSN=OUTPUT.FILE,DISP=(NEW,CATLG),
//            UNIT=SYSDA,SPACE=(TRK,(100,20))
//TOOLIN   DD *
  SORT FROM(IN) TO(OUT) USING(CTL1)
/*
//CTL1CNTL DD *
  SORT FIELDS=(1,10,CH,A)
  INCLUDE COND=(51,1,CH,EQ,C'A')
/*`
      ],
      estimated_resolution_time: 15
    },

    {
      id: 'kb-012',
      title: 'TSO ABEND S322 Time Limit Exceeded',
      problem: `TSO session terminates with S322 ABEND due to CPU time limit exceeded.

Error Details:
- ABEND Code: S322 (Time Limit Exceeded)
- User: USERID1
- Task: Background job running under TSO
- CPU Time Used: 00:15:00 (15 minutes)
- Elapsed Time: 00:45:30

Symptoms:
1. Long-running TSO batch job abends after 15 minutes
2. S322 completion code in job output
3. Job processes large data files successfully in test
4. Production job handles larger volumes
5. Same job completes successfully when run interactively

JCL Job:
//DATAJOB  JOB (ACCT),'DATA PROCESSING',
//         CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID,
//         TIME=(0,15)
//STEP1    EXEC PGM=MYPROG
//INPUT    DD DSN=LARGE.DATA.FILE,DISP=SHR`,

      solution: `1. Increase TIME parameter in JOB statement:
   //DATAJOB  JOB (ACCT),'DATA PROCESSING',
   //         CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID,
   //         TIME=(0,30)
   * Format: TIME=(minutes,seconds) or TIME=minutes
   * Use TIME=NOLIMIT for unlimited (if allowed)
   * Consider TIME=1440 for 24-hour maximum

2. Add TIME parameter to specific job steps:
   //STEP1    EXEC PGM=MYPROG,TIME=(0,20)
   //STEP2    EXEC PGM=SORT,TIME=(0,10)
   * Step TIME overrides job TIME for that step
   * Useful for steps with different requirements

3. Optimize program performance:
   * Review I/O operations for efficiency
   * Check for unnecessary loops or recursive calls
   * Optimize SQL queries if using DB2
   * Use buffering for file operations

4. Check system TIME limits:
   * Installation default TIME values
   * Job class TIME restrictions
   * User account TIME limits

   Contact system programmer to verify:
   - JCL job class definitions
   - SMF TIME accounting settings
   - Installation exit routines

5. Monitor resource usage:
   //STEP1    EXEC PGM=MYPROG
   //SYSOUT   DD SYSOUT=*
   //STEPLIB  DD DSN=MY.LOADLIB,DISP=SHR

   Check job output for:
   - CPU time used vs. elapsed time
   - I/O counts and wait times
   - Memory usage patterns

6. Consider job scheduling alternatives:
   * Submit during off-peak hours
   * Break large job into smaller steps
   * Use job restart capabilities for long processes

7. Use conditional TIME settings:
   //DATAJOB  JOB CLASS=A,MSGCLASS=X,
   //         TIME=(,30)                /* 30 seconds default */
   //BIGSTEP  EXEC PGM=MYPROG,
   //         TIME=(0,0),               /* No limit for this step */
   //         COND=(0,NE)

8. Example of TIME parameter usage:
   TIME=5          * 5 minutes maximum
   TIME=(2,30)     * 2 minutes 30 seconds
   TIME=(0,45)     * 45 seconds
   TIME=NOLIMIT    * No time limit (if permitted)
   TIME=MAXIMUM    * Installation maximum

Important: Balance TIME limits with system resource management policies.`,

      category: 'JCL',
      tags: ['S322', 'time-limit', 'TSO', 'CPU-time', 'performance', 'JCL-TIME'],
      created_at: getDateDaysAgo(11),
      updated_at: getDateDaysAgo(4),
      usage_count: 39,
      success_count: 37,
      failure_count: 2,
      confidence_score: 0.95,
      related_entries: ['kb-004', 'kb-018'],
      code_examples: [
        `//DATAJOB  JOB (ACCT),'DATA PROCESSING',
//         CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID,
//         TIME=(0,30)`,
        `//STEP1    EXEC PGM=MYPROG,TIME=(0,20)
//STEP2    EXEC PGM=SORT,TIME=(0,10)`,
        `//BIGSTEP  EXEC PGM=MYPROG,
//         TIME=(0,0),               /* No limit for this step */
//         COND=(0,NE)`
      ],
      estimated_resolution_time: 10
    }
  ];
}