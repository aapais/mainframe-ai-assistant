/**
 * Mock Electron API for Web Development
 * Provides a simulated API when running in browser without Electron
 */

interface MockKBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
  usage_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  score?: number;
}

// Mock database
let mockEntries: MockKBEntry[] = [
  {
    id: '1',
    title: 'S0C4 ABEND in COBOL Program During Array Processing',
    problem: 'Program terminates with S0C4 protection exception when processing large arrays in batch job. The error occurs during array manipulation in the PROCESS-RECORDS section.',
    solution: `1. Check OCCURS clause in WORKING-STORAGE SECTION
2. Verify array subscript values stay within bounds
3. Add boundary checking in COBOL code:
   IF WS-INDEX > WS-MAX-ENTRIES
      DISPLAY 'Array boundary exceeded'
      GO TO ERROR-ROUTINE
   END-IF
4. Increase region size in JCL: //STEP01 EXEC PGM=PROGRAM,REGION=8M
5. Compile with SSRANGE option for runtime checking`,
    category: 'Functional',
    tags: ['cobol', 'array', 'abend', 'runtime-error', 's0c4'],
    usage_count: 45,
    success_count: 38,
    failure_count: 7,
    created_at: '2024-01-15T10:30:00Z',
    score: 0.95
  },
  {
    id: '2',
    title: 'JCL Job Failed with IEF450I Step Not Executed',
    problem: 'Job step not executing due to condition code check failure in previous step. Message IEF450I indicates step bypassed.',
    solution: `1. Check COND parameter in JCL step
2. Verify previous step completion codes
3. Use IF/THEN/ELSE for better control:
   //IF (STEP1.RC = 0) THEN
   //STEP2 EXEC PGM=PROGRAM2
   //ENDIF
4. Review job log for actual return codes
5. Consider using RESTART parameter`,
    category: 'JCL',
    tags: ['jcl', 'batch', 'condition-code', 'job-control'],
    usage_count: 32,
    success_count: 29,
    failure_count: 3,
    created_at: '2024-01-14T14:20:00Z',
    score: 0.88
  },
  {
    id: '3',
    title: 'DB2 SQLCODE -818 Plan/Package Timestamp Mismatch',
    problem: 'Program fails with SQLCODE -818 indicating timestamp mismatch between DBRM and plan/package.',
    solution: `1. Check bind timestamp with: SELECT * FROM SYSIBM.SYSPACKAGE WHERE NAME = 'package-name'
2. Rebind the package: BIND PACKAGE(collection.package) MEMBER(dbrm-name)
3. Verify DBRM consistency
4. Review DB2 authorization
5. Use EXPLAIN to validate access path`,
    category: 'DB2',
    tags: ['db2', 'sql', 'bind', 'timestamp', 'database'],
    usage_count: 28,
    success_count: 25,
    failure_count: 3,
    created_at: '2024-01-13T09:15:00Z',
    score: 0.92
  },
  {
    id: '4',
    title: 'VSAM File Status 93 - Record Not Available',
    problem: 'VSAM read operation returns file status 93 when attempting to access specific record. File appears to be locked or unavailable.',
    solution: `1. Verify file is not already open in another job
2. Check exclusive control with IDCAMS LISTCAT
3. Review SHAREOPTIONS setting (should be 3,3 for read)
4. Ensure proper CLOSE was issued
5. Check for ENQ contention using D GRS,RES command`,
    category: 'VSAM',
    tags: ['vsam', 'file-status', 'io-error', 'dataset'],
    usage_count: 19,
    success_count: 15,
    failure_count: 4,
    created_at: '2024-01-12T16:45:00Z',
    score: 0.79
  },
  {
    id: '5',
    title: 'CICS Transaction DFHAC2206 Program Not Found',
    problem: 'CICS transaction abends with DFHAC2206 indicating program not found in PPT.',
    solution: `1. Check program definition in CEDA: CEDA VIEW PROGRAM(program-name)
2. Verify PPT entry exists
3. Perform NEWCOPY if program was recently compiled
4. Check DFHRPL concatenation
5. Ensure program is in correct load library`,
    category: 'CICS',
    tags: ['cics', 'transaction', 'ppt', 'abend'],
    usage_count: 24,
    success_count: 22,
    failure_count: 2,
    created_at: '2024-01-11T11:30:00Z',
    score: 0.85
  }
];

// Create mock Electron API
export const createMockElectronAPI = () => {
  return {
    kb: {
      search: async (query: string) => {
        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!query) {
          return { success: true, results: mockEntries };
        }

        const lowerQuery = query.toLowerCase();
        const filtered = mockEntries.filter(entry =>
          entry.title.toLowerCase().includes(lowerQuery) ||
          entry.problem.toLowerCase().includes(lowerQuery) ||
          entry.solution.toLowerCase().includes(lowerQuery) ||
          entry.category.toLowerCase().includes(lowerQuery) ||
          entry.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );

        return { success: true, results: filtered };
      },

      addEntry: async (entryData: Omit<MockKBEntry, 'id'>) => {
        await new Promise(resolve => setTimeout(resolve, 200));

        const newEntry: MockKBEntry = {
          ...entryData,
          id: Date.now().toString(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
          created_at: new Date().toISOString(),
          score: 0.5
        };

        mockEntries.push(newEntry);
        return { success: true, entry: newEntry };
      },

      updateEntry: async (id: string, updates: Partial<MockKBEntry>) => {
        await new Promise(resolve => setTimeout(resolve, 200));

        const index = mockEntries.findIndex(e => e.id === id);
        if (index !== -1) {
          mockEntries[index] = { ...mockEntries[index], ...updates };
          return { success: true, entry: mockEntries[index] };
        }
        return { success: false, error: 'Entry not found' };
      },

      deleteEntry: async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 200));

        const index = mockEntries.findIndex(e => e.id === id);
        if (index !== -1) {
          mockEntries.splice(index, 1);
          return { success: true };
        }
        return { success: false, error: 'Entry not found' };
      }
    },

    ai: {
      authorize: async (operation: string, estimatedCost: number) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          success: true,
          authorized: estimatedCost < 0.01,
          message: estimatedCost < 0.01 ? 'Auto-approved' : 'Requires manual approval'
        };
      },

      getCostEstimate: async (operation: string, input: string) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const inputTokens = input.length / 4; // Rough estimate
        const outputTokens = 150; // Typical response
        const cost = (inputTokens * 0.00001) + (outputTokens * 0.00003);
        return {
          success: true,
          inputTokens,
          outputTokens,
          totalCost: cost,
          model: 'gemini-pro'
        };
      }
    },

    settings: {
      get: async (key: string) => {
        const settings = JSON.parse(localStorage.getItem('app-settings') || '{}');
        return settings[key];
      },

      set: async (key: string, value: any) => {
        const settings = JSON.parse(localStorage.getItem('app-settings') || '{}');
        settings[key] = value;
        localStorage.setItem('app-settings', JSON.stringify(settings));
        return { success: true };
      }
    },

    // Mock event handlers
    onThemeChange: (callback: Function) => {},
    onDatabaseStatus: (callback: Function) => {},
    onAIServiceStatus: (callback: Function) => {},
    logError: (error: any) => {
      console.error('Mock Error Log:', error);
    }
  };
};

// Initialize mock API if not in Electron
if (typeof window !== 'undefined' && !window.electronAPI) {
  (window as any).electronAPI = createMockElectronAPI();
  console.log('📱 Running in web mode with mock Electron API');
}