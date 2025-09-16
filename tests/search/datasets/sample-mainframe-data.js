/**
 * Sample Mainframe Data for Testing
 * Realistic datasets for testing FTS5 search functionality
 */

const sampleMainframeData = {
  // JCL (Job Control Language) Documentation
  jclDocuments: [
    {
      id: 'jcl_001',
      title: 'Introduction to JCL (Job Control Language)',
      content: `Job Control Language (JCL) is a scripting language used on IBM mainframe operating systems to instruct the system on how to run batch jobs or start subsystems. JCL identifies the program to be executed, the datasets to be used, and other job-related information. A JCL program contains three basic types of statements: JOB, EXEC, and DD statements.`,
      category: 'jcl',
      tags: ['jcl', 'batch', 'mainframe', 'job-control', 'z/os'],
      difficulty: 'beginner',
      lastUpdated: '2024-01-15'
    },
    {
      id: 'jcl_002',
      title: 'JCL JOB Statement Parameters',
      content: `The JOB statement identifies the beginning of a job and provides information to the operating system. Common parameters include MSGCLASS for output routing, CLASS for job priority, TIME for execution limits, and REGION for memory allocation. Example: //MYJOB JOB (ACCT),'DESCRIPTION',CLASS=A,MSGCLASS=X,TIME=(0,30),REGION=4M`,
      category: 'jcl',
      tags: ['jcl', 'job-statement', 'parameters', 'batch-processing'],
      difficulty: 'intermediate',
      lastUpdated: '2024-01-20'
    },
    {
      id: 'jcl_003',
      title: 'JCL EXEC Statement and Program Execution',
      content: `The EXEC statement identifies the program or procedure to be executed in a job step. It can execute programs (PGM=) or cataloged procedures (PROC=). Parameters can be passed using PARM=. Example: //STEP1 EXEC PGM=IEFBR14,PARM='OPTION1' or //STEP2 EXEC PROC=MYPROC`,
      category: 'jcl',
      tags: ['jcl', 'exec-statement', 'program-execution', 'procedures'],
      difficulty: 'intermediate',
      lastUpdated: '2024-01-22'
    },
    {
      id: 'jcl_004',
      title: 'JCL DD Statement and Dataset Allocation',
      content: `The DD (Data Definition) statement describes datasets used by a job step. It defines input/output files, their allocation, and disposition. Key parameters include DSN (dataset name), DISP (disposition), SPACE (allocation), and DCB (data control block). Example: //MYFILE DD DSN=USER.TEST.DATA,DISP=(NEW,CATLG),SPACE=(TRK,(10,5))`,
      category: 'jcl',
      tags: ['jcl', 'dd-statement', 'dataset', 'allocation', 'disposition'],
      difficulty: 'intermediate',
      lastUpdated: '2024-01-25'
    }
  ],

  // COBOL Programming Documentation
  cobolDocuments: [
    {
      id: 'cobol_001',
      title: 'COBOL Programming Fundamentals',
      content: `COBOL (Common Business-Oriented Language) is a compiled programming language designed for business use. A COBOL program consists of four divisions: IDENTIFICATION DIVISION, ENVIRONMENT DIVISION, DATA DIVISION, and PROCEDURE DIVISION. COBOL is widely used in mainframe environments for business applications, financial systems, and data processing.`,
      category: 'cobol',
      tags: ['cobol', 'programming', 'mainframe', 'business-language'],
      difficulty: 'beginner',
      lastUpdated: '2024-01-10'
    },
    {
      id: 'cobol_002',
      title: 'COBOL Data Division and Working Storage',
      content: `The DATA DIVISION describes the data used by the program. WORKING-STORAGE SECTION defines variables used throughout the program. Data items can be elementary (PIC 9(5)) or group items containing subordinate items. COBOL supports various data types including numeric (PIC 9), alphabetic (PIC A), and alphanumeric (PIC X) fields.`,
      category: 'cobol',
      tags: ['cobol', 'data-division', 'working-storage', 'pic-clause'],
      difficulty: 'intermediate',
      lastUpdated: '2024-01-12'
    },
    {
      id: 'cobol_003',
      title: 'COBOL File Processing and Record Handling',
      content: `COBOL provides extensive file processing capabilities. File definitions in SELECT statements specify physical files, while FD entries describe record layouts. Common file operations include OPEN, READ, WRITE, and CLOSE. Sequential, indexed, and relative file organizations are supported for different data access patterns.`,
      category: 'cobol',
      tags: ['cobol', 'file-processing', 'records', 'sequential', 'indexed'],
      difficulty: 'advanced',
      lastUpdated: '2024-01-18'
    }
  ],

  // z/OS System Documentation
  zosDocuments: [
    {
      id: 'zos_001',
      title: 'z/OS Operating System Overview',
      content: `z/OS is IBM's flagship operating system for System z mainframes. It supports high-volume transaction processing, batch operations, and data serving. z/OS provides security, reliability, and scalability for enterprise workloads. Key components include MVS, UNIX System Services, and middleware subsystems like CICS, IMS, and DB2.`,
      category: 'zos',
      tags: ['z/os', 'mainframe', 'operating-system', 'mvs', 'unix'],
      difficulty: 'beginner',
      lastUpdated: '2024-01-08'
    },
    {
      id: 'zos_002',
      title: 'z/OS Dataset Organization and Management',
      content: `z/OS supports various dataset organizations: Sequential (PS), Partitioned (PO), VSAM (KSDS, ESDS, RRDS), and GDG (Generation Data Groups). Dataset naming follows a hierarchical structure with qualifiers separated by periods. Common dataset types include libraries (PDS/PDSE), data files, and system datasets like SYS1.PROCLIB.`,
      category: 'zos',
      tags: ['z/os', 'datasets', 'vsam', 'pds', 'gdg', 'data-management'],
      difficulty: 'intermediate',
      lastUpdated: '2024-01-14'
    }
  ],

  // CICS Transaction Processing
  cicsDocuments: [
    {
      id: 'cics_001',
      title: 'CICS Transaction Server Introduction',
      content: `CICS (Customer Information Control System) is a transaction processing system for z/OS. It provides a runtime environment for online applications, managing transactions, terminal communications, and resource access. CICS applications handle high-volume, real-time business transactions with guaranteed data integrity and recovery capabilities.`,
      category: 'cics',
      tags: ['cics', 'transaction-processing', 'online', 'real-time'],
      difficulty: 'beginner',
      lastUpdated: '2024-01-16'
    },
    {
      id: 'cics_002',
      title: 'CICS Program Development and APIs',
      content: `CICS provides comprehensive APIs for application development. Common commands include EXEC CICS READ for file access, EXEC CICS SEND for terminal I/O, and EXEC CICS LINK for program-to-program communication. CICS programs can be written in COBOL, PL/I, C, or assembler language, with built-in transaction management and error handling.`,
      category: 'cics',
      tags: ['cics', 'api', 'programming', 'exec-cics', 'commands'],
      difficulty: 'advanced',
      lastUpdated: '2024-01-28'
    }
  ],

  // DB2 Database Management
  db2Documents: [
    {
      id: 'db2_001',
      title: 'DB2 for z/OS Database Management',
      content: `DB2 for z/OS is IBM's relational database management system for mainframes. It supports SQL for data manipulation and provides high availability, scalability, and security features. DB2 integrates with CICS, IMS, and batch applications, offering both online and batch data access through various interfaces including SPUFI, QMF, and embedded SQL.`,
      category: 'db2',
      tags: ['db2', 'database', 'sql', 'relational', 'z/os'],
      difficulty: 'intermediate',
      lastUpdated: '2024-01-19'
    }
  ],

  // TSO/ISPF User Interface
  tsoDocuments: [
    {
      id: 'tso_001',
      title: 'TSO/ISPF Development Environment',
      content: `TSO (Time Sharing Option) provides interactive access to z/OS. ISPF (Interactive System Productivity Facility) is a menu-driven interface for TSO that provides panels, edit sessions, and utilities. ISPF/PDF includes program development facilities with editors, compilers, and debugging tools. Common ISPF functions include dataset management, program editing, and job submission.`,
      category: 'tso',
      tags: ['tso', 'ispf', 'interactive', 'development', 'editor'],
      difficulty: 'beginner',
      lastUpdated: '2024-01-11'
    }
  ]
};

// Sample search queries for testing
const sampleQueries = [
  // Basic single-term queries
  'JCL',
  'COBOL',
  'mainframe',
  'z/OS',
  'CICS',
  'DB2',
  'dataset',
  'programming',
  'batch',
  'transaction',

  // Multi-term queries
  'JCL programming',
  'COBOL mainframe',
  'z/OS datasets',
  'CICS transaction processing',
  'DB2 database management',
  'batch job control',
  'mainframe development',
  'TSO ISPF editor',

  // Phrase queries
  '"Job Control Language"',
  '"transaction processing"',
  '"data division"',
  '"working storage"',
  '"dataset allocation"',
  '"program execution"',

  // Boolean queries
  'JCL AND COBOL',
  'mainframe OR z/OS',
  'CICS AND transaction',
  'programming AND (JCL OR COBOL)',
  'dataset NOT temporary',
  '(batch OR online) AND processing',

  // Complex queries
  'JCL job statement parameters',
  'COBOL file processing records',
  'z/OS dataset organization VSAM',
  'CICS program development API',
  'DB2 SQL data manipulation',
  'TSO ISPF development environment',

  // Wildcard queries
  'program*',
  'data*',
  'process*',
  'system*',

  // Field-specific queries (if supported)
  'title:JCL',
  'category:cobol',
  'tags:mainframe'
];

// Expected search results for testing ranking accuracy
const expectedRankings = {
  'JCL': ['jcl_001', 'jcl_002', 'jcl_003', 'jcl_004'],
  'COBOL': ['cobol_001', 'cobol_002', 'cobol_003'],
  'JCL programming': ['jcl_001', 'jcl_002', 'jcl_003'],
  '"Job Control Language"': ['jcl_001', 'jcl_002'],
  'mainframe development': ['cobol_001', 'zos_001', 'tso_001'],
  'transaction processing': ['cics_001', 'cics_002', 'zos_001']
};

// Performance test datasets
const performanceTestData = {
  // Large corpus for performance testing
  generateLargeCorpus: (size) => {
    const templates = [
      'Document about {term1} and {term2} programming on mainframe systems',
      'Guide to {term1} development using {term2} and {term3}',
      'Tutorial for {term1} {term2} integration in z/OS environment',
      'Advanced {term1} techniques for {term2} applications',
      'Best practices for {term1} and {term2} on mainframe platforms'
    ];

    const terms = [
      'JCL', 'COBOL', 'CICS', 'IMS', 'DB2', 'z/OS', 'MVS', 'TSO', 'ISPF',
      'SDSF', 'RACF', 'VSAM', 'batch', 'online', 'transaction', 'dataset',
      'programming', 'development', 'application', 'system'
    ];

    return Array.from({ length: size }, (_, i) => {
      const template = templates[i % templates.length];
      const term1 = terms[Math.floor(Math.random() * terms.length)];
      const term2 = terms[Math.floor(Math.random() * terms.length)];
      const term3 = terms[Math.floor(Math.random() * terms.length)];

      const content = template
        .replace('{term1}', term1)
        .replace('{term2}', term2)
        .replace('{term3}', term3);

      return {
        id: `perf_doc_${i}`,
        title: `Performance Test Document ${i}`,
        content: content,
        category: 'performance',
        tags: [term1.toLowerCase(), term2.toLowerCase()],
        difficulty: ['beginner', 'intermediate', 'advanced'][i % 3],
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    });
  }
};

module.exports = {
  sampleMainframeData,
  sampleQueries,
  expectedRankings,
  performanceTestData
};