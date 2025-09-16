/**
 * EntryDetailLayout Example
 *
 * Comprehensive entry detail view demonstrating:
 * - Multi-panel responsive layout
 * - Code syntax highlighting integration
 * - Interactive tabbed content
 * - Collapsible sections
 * - Action panels and toolbars
 * - Related content recommendations
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ResponsiveGrid, GridItem } from '../components/Layout/ResponsiveGrid';
import { useResponsive } from '../hooks/useResponsive';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { Button } from '../components/foundation/Button';

// =========================
// TYPE DEFINITIONS
// =========================

interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  author: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
  attachments?: Attachment[];
  code_examples?: CodeExample[];
  related_entries?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimated_time: string;
  prerequisites?: string[];
}

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'code' | 'log';
  url: string;
  size: number;
}

interface CodeExample {
  id: string;
  title: string;
  language: 'cobol' | 'jcl' | 'sql' | 'shell' | 'other';
  code: string;
  description?: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  helpful_count: number;
  is_helpful?: boolean;
}

interface EntryDetailLayoutProps {
  entry: KBEntry;
  relatedEntries?: KBEntry[];
  comments?: Comment[];
  isEditable?: boolean;
  onEdit?: () => void;
  onRate?: (helpful: boolean) => void;
  onComment?: (content: string) => void;
  onRelatedClick?: (entry: KBEntry) => void;
}

// =========================
// MOCK DATA
// =========================

const MOCK_ENTRY: KBEntry = {
  id: '1',
  title: 'VSAM Status 35 - Complete Resolution Guide',
  problem: `Job abends with VSAM status code 35 during file operations. This typically occurs when:

1. The VSAM dataset cannot be found in the catalog
2. The dataset name is misspelled in the DD statement
3. The dataset has been deleted or renamed
4. Catalog issues prevent proper dataset resolution
5. Generation Data Group (GDG) references are incorrect

Common error messages include:
- IEC024I 013-18,IFG0554P,dataset-name,STEP1
- IGZ0035S The file was not found (status = 35)
- VSAM OPEN/CLOSE/READ/WRITE return code 8, reason code 168`,
  solution: `Follow these systematic troubleshooting steps:

**Step 1: Verify Dataset Existence**
Use ISPF 3.4 to browse the catalog:
- Enter dataset name (without quotes)
- Check if dataset is cataloged
- Verify dataset is not migrated (HSM)

**Step 2: Check JCL DD Statement**
Review the failing step's DD statements:
- Verify DSN= parameter spelling
- Check for proper quotes usage
- Validate GDG references (+1, 0, -1)

**Step 3: Catalog Verification**
Use LISTCAT command:
LISTCAT ENT('your.dataset.name') ALL

**Step 4: Space and Volume Issues**
Check if dataset ran out of space:
- Review secondary allocations
- Verify volume availability
- Check for VSAM CI/CA splits

**Step 5: RACF/Security Check**
Verify access permissions:
LISTDSD 'dataset.name'`,
  category: 'VSAM',
  tags: ['vsam', 'status-35', 'file-not-found', 'catalog', 'troubleshooting', 'jcl'],
  author: 'system_admin',
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-01-15T14:15:00Z',
  usage_count: 1245,
  success_count: 1156,
  failure_count: 89,
  severity: 'high',
  difficulty: 'intermediate',
  estimated_time: '15-30 minutes',
  prerequisites: ['Basic JCL knowledge', 'VSAM concepts', 'ISPF navigation'],
  attachments: [
    {
      id: 'att1',
      name: 'vsam_status_codes.pdf',
      type: 'document',
      url: '/attachments/vsam_status_codes.pdf',
      size: 1024576
    },
    {
      id: 'att2',
      name: 'sample_listcat_output.txt',
      type: 'log',
      url: '/attachments/sample_listcat.txt',
      size: 4096
    }
  ],
  code_examples: [
    {
      id: 'code1',
      title: 'JCL Example with VSAM File',
      language: 'jcl',
      code: `//STEP1    EXEC PGM=MYPROG
//VSAMFILE DD DSN=PROD.VSAM.MASTER.FILE,
//            DISP=SHR
//SYSOUT   DD SYSOUT=*
//SYSIN    DD *
  INPUT DATA HERE
/*`,
      description: 'Basic JCL setup for VSAM file access'
    },
    {
      id: 'code2',
      title: 'LISTCAT Command Example',
      language: 'other',
      code: `LISTCAT ENT('PROD.VSAM.MASTER.FILE') ALL

Expected Output:
CLUSTER ------- PROD.VSAM.MASTER.FILE
     IN-CAT --- CATALOG.PRODCAT
     HISTORY
       OWNER-IDENT--------(NULL)
       CREATION----------2025.015
       EXPIRATION--------0000.000`,
      description: 'How to verify VSAM dataset catalog information'
    },
    {
      id: 'code3',
      title: 'COBOL File Status Check',
      language: 'cobol',
      code: `01  VSAM-FILE-STATUS         PIC X(2).
88  VSAM-OK                     VALUE '00'.
88  VSAM-EOF                    VALUE '10'.
88  VSAM-FILE-NOT-FOUND         VALUE '35'.

PROCEDURE DIVISION.
    OPEN INPUT VSAM-FILE
    IF VSAM-FILE-NOT-FOUND
        DISPLAY 'ERROR: VSAM FILE NOT FOUND - STATUS 35'
        DISPLAY 'CHECK CATALOG AND JCL DD STATEMENT'
        MOVE 8 TO RETURN-CODE
        GOBACK
    END-IF.`,
      description: 'COBOL code to handle VSAM status 35 gracefully'
    }
  ],
  related_entries: ['2', '3', '4']
};

const MOCK_RELATED: KBEntry[] = [
  {
    id: '2',
    title: 'VSAM Status 37 - Space Issues',
    problem: 'VSAM file allocation problems',
    solution: 'Space management techniques',
    category: 'VSAM',
    tags: ['vsam', 'status-37', 'space'],
    author: 'admin',
    created_at: '2025-01-10T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
    usage_count: 567,
    success_count: 523,
    failure_count: 44,
    severity: 'medium',
    difficulty: 'intermediate',
    estimated_time: '10-20 minutes'
  },
  {
    id: '3',
    title: 'JCL Dataset Not Found - IEF212I',
    problem: 'Dataset not found error in JCL',
    solution: 'Dataset validation steps',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'ief212i'],
    author: 'expert',
    created_at: '2025-01-08T11:00:00Z',
    updated_at: '2025-01-08T11:00:00Z',
    usage_count: 892,
    success_count: 824,
    failure_count: 68,
    severity: 'high',
    difficulty: 'beginner',
    estimated_time: '5-15 minutes'
  }
];

const MOCK_COMMENTS: Comment[] = [
  {
    id: 'c1',
    author: 'developer_123',
    content: 'This solution worked perfectly! The LISTCAT command was exactly what I needed to identify the catalog issue.',
    created_at: '2025-01-16T09:30:00Z',
    helpful_count: 12,
    is_helpful: true
  },
  {
    id: 'c2',
    author: 'mainframe_expert',
    content: 'Great guide! I would also add checking for HSM migration status using HSEND LIST command for datasets that appear to be missing.',
    created_at: '2025-01-16T14:20:00Z',
    helpful_count: 8,
    is_helpful: true
  }
];

// =========================
// SUB-COMPONENTS
// =========================

/**
 * Entry Header Component
 * Title, metadata, and primary actions
 */
const EntryHeader: React.FC<{
  entry: KBEntry;
  isEditable: boolean;
  onEdit?: () => void;
}> = ({ entry, isEditable, onEdit }) => {
  const { device } = useResponsive();

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getSeverityColor = useCallback((severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  }, []);

  const getDifficultyColor = useCallback((difficulty: string) => {
    const colors = {
      beginner: 'bg-blue-100 text-blue-800',
      intermediate: 'bg-purple-100 text-purple-800',
      advanced: 'bg-indigo-100 text-indigo-800',
      expert: 'bg-red-100 text-red-800'
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  }, []);

  const successRate = useMemo(() => {
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? Math.round((entry.success_count / total) * 100) : 0;
  }, [entry.success_count, entry.failure_count]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <ResponsiveGrid
        cols={{ xs: 1, md: 1 }}
        gap="md"
      >
        {/* Title and Actions */}
        <GridItem>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {entry.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getSeverityColor(entry.severity)}`}>
                      {entry.severity.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getDifficultyColor(entry.difficulty)}`}>
                      {entry.difficulty}
                    </span>
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800">
                      {entry.category}
                    </span>
                  </div>
                </div>
                {!device.isMobile && (
                  <div className="flex items-center space-x-2">
                    {isEditable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={onEdit}
                        className="flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                        </svg>
                        Share
                      </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </GridItem>

        {/* Metadata Grid */}
        <GridItem>
          <ResponsiveGrid
            cols={{ xs: 2, sm: 4, lg: 6 }}
            gap="md"
            className="pt-4 border-t border-gray-200"
          >
            <GridItem>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{entry.usage_count}</div>
                <div className="text-xs text-gray-600">Views</div>
              </div>
            </GridItem>

            <GridItem>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{successRate}%</div>
                <div className="text-xs text-gray-600">Success Rate</div>
              </div>
            </GridItem>

            <GridItem>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{entry.estimated_time}</div>
                <div className="text-xs text-gray-600">Est. Time</div>
              </div>
            </GridItem>

            <GridItem>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">{entry.author}</div>
                <div className="text-xs text-gray-600">Author</div>
              </div>
            </GridItem>

            <GridItem>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">
                  {formatDate(entry.created_at).split(',')[0]}
                </div>
                <div className="text-xs text-gray-600">Created</div>
              </div>
            </GridItem>

            <GridItem>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900">
                  {formatDate(entry.updated_at).split(',')[0]}
                </div>
                <div className="text-xs text-gray-600">Updated</div>
              </div>
            </GridItem>
          </ResponsiveGrid>
        </GridItem>

        {/* Tags */}
        <GridItem>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 cursor-pointer transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </GridItem>

        {/* Prerequisites */}
        {entry.prerequisites && entry.prerequisites.length > 0 && (
          <GridItem>
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Prerequisites:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {entry.prerequisites.map((prereq, index) => (
                  <li key={index}>{prereq}</li>
                ))}
              </ul>
            </div>
          </GridItem>
        )}
      </ResponsiveGrid>
    </div>
  );
};

/**
 * Tabbed Content Component
 * Main content with tabs for different sections
 */
const TabbedContent: React.FC<{
  entry: KBEntry;
  onRate?: (helpful: boolean) => void;
}> = ({ entry, onRate }) => {
  const [activeTab, setActiveTab] = useState('problem');
  const { device } = useResponsive();

  const tabs = [
    { id: 'problem', label: 'Problem', icon: '⚠️' },
    { id: 'solution', label: 'Solution', icon: '✅' },
    { id: 'code', label: 'Code Examples', icon: '💻', count: entry.code_examples?.length || 0 },
    { id: 'attachments', label: 'Files', icon: '📎', count: entry.attachments?.length || 0 }
  ];

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50">
        <nav className="flex space-x-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'problem' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Problem Description
            </h3>
            <div className="prose prose-sm max-w-none">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm font-sans">
                  {entry.problem}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'solution' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Solution Steps
            </h3>
            <div className="prose prose-sm max-w-none">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm font-sans">
                  {entry.solution}
                </pre>
              </div>
            </div>

            {/* Rating Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900">
                  Was this solution helpful?
                </h4>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRate?.(true)}
                    className="flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    Helpful
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRate?.(false)}
                    className="flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                    Not Helpful
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Code Examples
            </h3>

            {entry.code_examples && entry.code_examples.length > 0 ? (
              <div className="space-y-6">
                {entry.code_examples.map((example, index) => (
                  <div key={example.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{example.title}</h4>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded uppercase font-mono">
                          {example.language}
                        </span>
                      </div>
                      {example.description && (
                        <p className="text-sm text-gray-600 mt-1">{example.description}</p>
                      )}
                    </div>
                    <div className="bg-gray-900 p-4 overflow-x-auto">
                      <pre className="text-green-400 text-sm font-mono whitespace-pre">
                        <code>{example.code}</code>
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <h4 className="mt-2 text-lg font-medium text-gray-900">No Code Examples</h4>
                <p className="mt-1 text-sm text-gray-500">Code examples will appear here when available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attachments & Files
            </h3>

            {entry.attachments && entry.attachments.length > 0 ? (
              <div className="grid gap-4">
                {entry.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        attachment.type === 'image' ? 'bg-green-100' :
                        attachment.type === 'document' ? 'bg-blue-100' :
                        attachment.type === 'code' ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        {attachment.type === 'image' && '🖼️'}
                        {attachment.type === 'document' && '📄'}
                        {attachment.type === 'code' && '💻'}
                        {attachment.type === 'log' && '📝'}
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{attachment.name}</h4>
                      <p className="text-sm text-gray-500">
                        {attachment.type.toUpperCase()} • {formatFileSize(attachment.size)}
                      </p>
                    </div>
                    <div className="ml-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <h4 className="mt-2 text-lg font-medium text-gray-900">No Attachments</h4>
                <p className="mt-1 text-sm text-gray-500">Files and attachments will appear here when available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Related Entries Sidebar
 * Shows related knowledge base entries
 */
const RelatedEntriesSidebar: React.FC<{
  entries: KBEntry[];
  onEntryClick?: (entry: KBEntry) => void;
}> = ({ entries, onEntryClick }) => {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Entries</h3>
        <div className="text-center py-8">
          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No related entries found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Entries</h3>
      <div className="space-y-4">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onEntryClick?.(entry)}
          >
            <h4 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
              {entry.title}
            </h4>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-100 rounded">{entry.category}</span>
              <span>{Math.round((entry.success_count / (entry.success_count + entry.failure_count)) * 100)}% helpful</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Comments Section
 * User comments and feedback
 */
const CommentsSection: React.FC<{
  comments: Comment[];
  onComment?: (content: string) => void;
}> = ({ comments, onComment }) => {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onComment?.(newComment);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, onComment]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Comments ({comments.length})
      </h3>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your experience with this solution..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {comment.author.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">{comment.author}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>{comment.helpful_count}</span>
              </div>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed">{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================

/**
 * EntryDetailLayout Example
 *
 * Comprehensive entry detail layout with responsive panels
 */
export const EntryDetailLayout: React.FC<EntryDetailLayoutProps> = ({
  entry = MOCK_ENTRY,
  relatedEntries = MOCK_RELATED,
  comments = MOCK_COMMENTS,
  isEditable = true,
  onEdit,
  onRate,
  onComment,
  onRelatedClick
}) => {
  const { device, breakpoint } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useResizeObserver(containerRef);

  const handleRate = useCallback((helpful: boolean) => {
    console.log('Rating:', helpful);
    onRate?.(helpful);
  }, [onRate]);

  const handleComment = useCallback((content: string) => {
    console.log('New comment:', content);
    onComment?.(content);
  }, [onComment]);

  const handleRelatedClick = useCallback((relatedEntry: KBEntry) => {
    console.log('Related entry clicked:', relatedEntry.id);
    onRelatedClick?.(relatedEntry);
  }, [onRelatedClick]);

  return (
    <div ref={containerRef} className="space-y-6" data-testid="entry-detail-layout">
      {/* Entry Header */}
      <EntryHeader
        entry={entry}
        isEditable={isEditable}
        onEdit={onEdit}
      />

      {/* Main Content Grid */}
      <ResponsiveGrid
        cols={{ xs: 1, lg: 3 }}
        gap="lg"
        className="items-start"
      >
        {/* Main Content */}
        <GridItem colSpan={{ xs: 1, lg: 2 }}>
          <div className="space-y-6">
            {/* Tabbed Content */}
            <TabbedContent entry={entry} onRate={handleRate} />

            {/* Comments Section */}
            <CommentsSection comments={comments} onComment={handleComment} />
          </div>
        </GridItem>

        {/* Sidebar */}
        <GridItem>
          <div className="space-y-6">
            {/* Related Entries */}
            <RelatedEntriesSidebar
              entries={relatedEntries}
              onEntryClick={handleRelatedClick}
            />
          </div>
        </GridItem>
      </ResponsiveGrid>

      {/* Debug Info */}
      <div className="text-xs text-gray-500 p-4 bg-gray-50 rounded-lg">
        <ResponsiveGrid cols={{ xs: 2, sm: 4 }} gap="sm">
          <GridItem>
            <strong>Device:</strong> {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}
          </GridItem>
          <GridItem>
            <strong>Breakpoint:</strong> {breakpoint}
          </GridItem>
          <GridItem>
            <strong>Container:</strong> {dimensions?.width || 0}×{dimensions?.height || 0}px
          </GridItem>
          <GridItem>
            <strong>Entry ID:</strong> {entry.id}
          </GridItem>
        </ResponsiveGrid>
      </div>
    </div>
  );
};

export default EntryDetailLayout;