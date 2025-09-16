/**
 * Mainframe Tokenizer Unit Tests
 * Tests for mainframe-specific text tokenization
 */

const { MainframeTokenizer } = require('../../../src/services/search/mainframe-tokenizer');

describe('Mainframe Tokenizer', () => {
  let tokenizer;

  beforeEach(() => {
    tokenizer = new MainframeTokenizer({
      preserveAcronyms: true,
      customTerms: [
        'JCL', 'COBOL', 'CICS', 'IMS', 'DB2', 'z/OS', 'MVS', 'TSO', 'ISPF',
        'SDSF', 'RACF', 'VSAM', 'QSAM', 'BDAM', 'GDG', 'PDS', 'PDSE'
      ],
      datasetPatterns: true,
      stemming: true
    });
  });

  describe('Basic Tokenization', () => {
    test('should tokenize simple text', () => {
      const text = 'JCL programming on mainframe systems';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toEqual(['JCL', 'programming', 'on', 'mainframe', 'systems']);
    });

    test('should handle punctuation correctly', () => {
      const text = 'JCL, COBOL, and CICS programming.';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toEqual(['JCL', 'COBOL', 'and', 'CICS', 'programming']);
    });

    test('should preserve case for acronyms', () => {
      const text = 'jcl COBOL Cics programming';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('JCL');  // Should normalize to uppercase
      expect(tokens).toContain('COBOL');
      expect(tokens).toContain('CICS');
    });

    test('should handle mixed case content', () => {
      const text = 'Job Control Language (JCL) and COBOL Programming';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('Job');
      expect(tokens).toContain('Control');
      expect(tokens).toContain('Language');
      expect(tokens).toContain('JCL');
      expect(tokens).toContain('COBOL');
      expect(tokens).toContain('Programming');
    });
  });

  describe('Mainframe-Specific Terms', () => {
    test('should preserve mainframe acronyms', () => {
      const text = 'Using JCL with COBOL on z/OS systems via TSO/ISPF';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('JCL');
      expect(tokens).toContain('COBOL');
      expect(tokens).toContain('z/OS');
      expect(tokens).toContain('TSO/ISPF');
    });

    test('should handle dataset naming conventions', () => {
      const text = 'Copy SYS1.PROCLIB to USER.TEST.DATA.SET';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('SYS1.PROCLIB');
      expect(tokens).toContain('USER.TEST.DATA.SET');
    });

    test('should recognize common mainframe file types', () => {
      const text = 'Load members from PDS and PDSE libraries';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('PDS');
      expect(tokens).toContain('PDSE');
      expect(tokens).toContain('libraries');
    });

    test('should handle GDG notation', () => {
      const text = 'Process GDG.BASE(+1) and GDG.BASE(0)';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('GDG.BASE(+1)');
      expect(tokens).toContain('GDG.BASE(0)');
    });

    test('should recognize VSAM and access method terms', () => {
      const text = 'VSAM KSDS with QSAM and BDAM access';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('VSAM');
      expect(tokens).toContain('KSDS');
      expect(tokens).toContain('QSAM');
      expect(tokens).toContain('BDAM');
    });
  });

  describe('Special Character Handling', () => {
    test('should handle forward slashes in system names', () => {
      const text = 'z/OS and OS/390 systems';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('z/OS');
      expect(tokens).toContain('OS/390');
    });

    test('should handle hyphens in compound terms', () => {
      const text = 'batch-processing and real-time systems';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('batch-processing');
      expect(tokens).toContain('real-time');
    });

    test('should handle underscores in identifiers', () => {
      const text = 'PROC_NAME and DATA_SET_NAME variables';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('PROC_NAME');
      expect(tokens).toContain('DATA_SET_NAME');
    });

    test('should handle dollar signs in JCL variables', () => {
      const text = 'Use &SYSUID and $JOBNAME variables';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('&SYSUID');
      expect(tokens).toContain('$JOBNAME');
    });
  });

  describe('Stemming and Normalization', () => {
    test('should stem common programming terms', () => {
      const text = 'programming programmer programmed programs';
      const tokens = tokenizer.tokenize(text);
      const stems = tokenizer.stem(tokens);

      // Should reduce to similar stems
      const uniqueStems = [...new Set(stems)];
      expect(uniqueStems.length).toBeLessThan(tokens.length);
    });

    test('should not stem mainframe acronyms', () => {
      const text = 'JCL JCLs programming programs';
      const tokens = tokenizer.tokenize(text);
      const stems = tokenizer.stem(tokens);

      expect(stems).toContain('JCL');
      expect(stems).toContain('JCLs'); // Plurals of acronyms should be preserved
    });

    test('should normalize common variations', () => {
      const variations = [
        'Job Control Language',
        'job control language',
        'JOB CONTROL LANGUAGE'
      ];

      variations.forEach(text => {
        const tokens = tokenizer.tokenize(text);
        expect(tokens).toContain('Job');
        expect(tokens).toContain('Control');
        expect(tokens).toContain('Language');
      });
    });
  });

  describe('Context-Aware Tokenization', () => {
    test('should recognize JCL statement patterns', () => {
      const text = '//JOBNAME JOB (ACCT),\'Description\',CLASS=A';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('//JOBNAME');
      expect(tokens).toContain('JOB');
      expect(tokens).toContain('CLASS=A');
    });

    test('should handle COBOL division names', () => {
      const text = 'IDENTIFICATION DIVISION. PROGRAM-ID. HELLO.';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('IDENTIFICATION');
      expect(tokens).toContain('DIVISION');
      expect(tokens).toContain('PROGRAM-ID');
    });

    test('should recognize SQL/DB2 keywords', () => {
      const text = 'SELECT * FROM DB2.TABLE WHERE COLUMN = :HOST-VAR';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('SELECT');
      expect(tokens).toContain('FROM');
      expect(tokens).toContain('DB2.TABLE');
      expect(tokens).toContain(':HOST-VAR');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle empty input', () => {
      const tokens = tokenizer.tokenize('');
      expect(tokens).toEqual([]);
    });

    test('should handle null input', () => {
      const tokens = tokenizer.tokenize(null);
      expect(tokens).toEqual([]);
    });

    test('should handle very long tokens', () => {
      const longToken = 'A'.repeat(1000);
      const text = `Short ${longToken} tokens`;
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('Short');
      expect(tokens).toContain(longToken);
      expect(tokens).toContain('tokens');
    });

    test('should handle special characters only', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toEqual([]);
    });

    test('should handle numbers and alphanumeric', () => {
      const text = 'JCL123 STEP01 DATA2024 VERSION1.2';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('JCL123');
      expect(tokens).toContain('STEP01');
      expect(tokens).toContain('DATA2024');
      expect(tokens).toContain('VERSION1.2');
    });
  });

  describe('Custom Term Recognition', () => {
    test('should recognize custom business terms', () => {
      const customTokenizer = new MainframeTokenizer({
        customTerms: ['PAYROLL', 'BILLING', 'INVENTORY', 'CUST-MASTER']
      });

      const text = 'Process PAYROLL and BILLING using CUST-MASTER file';
      const tokens = customTokenizer.tokenize(text);

      expect(tokens).toContain('PAYROLL');
      expect(tokens).toContain('BILLING');
      expect(tokens).toContain('CUST-MASTER');
    });

    test('should handle overlapping term definitions', () => {
      const text = 'JCL job control language programming';
      const tokens = tokenizer.tokenize(text);

      // Should recognize both the acronym and expanded form
      expect(tokens).toContain('JCL');
      expect(tokens).toContain('job');
      expect(tokens).toContain('control');
      expect(tokens).toContain('language');
    });
  });

  describe('Integration with Search', () => {
    test('should produce tokens suitable for FTS5 queries', () => {
      const text = 'How to use JCL for batch processing on z/OS mainframe systems?';
      const tokens = tokenizer.tokenize(text);

      // Tokens should be clean for FTS5 matching
      tokens.forEach(token => {
        expect(token).toMatch(/^[a-zA-Z0-9\.\-\/\_\&\$\:]+$/);
      });
    });

    test('should preserve query-relevant information', () => {
      const queries = [
        'JCL programming',
        'z/OS systems',
        'COBOL batch processing',
        'SYS1.PROCLIB dataset'
      ];

      queries.forEach(query => {
        const tokens = tokenizer.tokenize(query);
        expect(tokens.length).toBeGreaterThan(0);

        // Should preserve the essential search terms
        if (query.includes('JCL')) expect(tokens).toContain('JCL');
        if (query.includes('z/OS')) expect(tokens).toContain('z/OS');
        if (query.includes('COBOL')) expect(tokens).toContain('COBOL');
        if (query.includes('SYS1.PROCLIB')) expect(tokens).toContain('SYS1.PROCLIB');
      });
    });
  });
});