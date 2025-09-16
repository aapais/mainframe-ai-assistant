/**
 * AccessibilityAudit Component
 *
 * This component provides a runtime accessibility audit interface
 * for monitoring and reporting WCAG 2.1 AA compliance.
 */

import React, { useState, useEffect, useRef } from 'react';
import WCAGValidator, { AccessibilityAuditResult, WCAGViolation } from '../utils/wcagValidator';

interface AccessibilityAuditProps {
  isVisible: boolean;
  onClose: () => void;
  autoRun?: boolean;
  enableRuntimeValidation?: boolean;
}

interface AuditStats {
  totalChecks: number;
  violations: number;
  passes: number;
  incomplete: number;
  lastAuditTime: Date | null;
}

const AccessibilityAudit: React.FC<AccessibilityAuditProps> = ({
  isVisible,
  onClose,
  autoRun = false,
  enableRuntimeValidation = false,
}) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<AccessibilityAuditResult | null>(null);
  const [stats, setStats] = useState<AuditStats>({
    totalChecks: 0,
    violations: 0,
    passes: 0,
    incomplete: 0,
    lastAuditTime: null,
  });
  const [selectedViolation, setSelectedViolation] = useState<WCAGViolation | null>(null);
  const [filterLevel, setFilterLevel] = useState<'all' | 'critical' | 'serious' | 'moderate'>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['violations']));
  const [runtimeValidationEnabled, setRuntimeValidationEnabled] = useState(enableRuntimeValidation);

  const wcagValidator = useRef(WCAGValidator.getInstance());

  useEffect(() => {
    if (isVisible && autoRun) {
      runAudit();
    }
  }, [isVisible, autoRun]);

  useEffect(() => {
    if (runtimeValidationEnabled) {
      wcagValidator.current.startRuntimeValidation();
    } else {
      wcagValidator.current.stopRuntimeValidation();
    }

    return () => {
      wcagValidator.current.stopRuntimeValidation();
    };
  }, [runtimeValidationEnabled]);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const results = await wcagValidator.current.auditCurrentPage();
      setAuditResults(results);

      const newStats: AuditStats = {
        totalChecks: results.violations.length + results.passes.length + results.incomplete.length,
        violations: results.violations.length,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        lastAuditTime: new Date(),
      };
      setStats(newStats);
    } catch (error) {
      console.error('Accessibility audit failed:', error);
    } finally {
      setIsAuditing(false);
    }
  };

  const getFilteredViolations = (): WCAGViolation[] => {
    if (!auditResults) return [];

    if (filterLevel === 'all') return auditResults.violations;

    return auditResults.violations.filter(violation => violation.impact === filterLevel);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const highlightElement = (violation: WCAGViolation) => {
    if (violation.element) {
      // Remove existing highlights
      document.querySelectorAll('.a11y-highlight').forEach(el => {
        el.classList.remove('a11y-highlight');
      });

      // Add highlight to element
      violation.element.classList.add('a11y-highlight');
      violation.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const removeHighlights = () => {
    document.querySelectorAll('.a11y-highlight').forEach(el => {
      el.classList.remove('a11y-highlight');
    });
  };

  const exportReport = () => {
    if (!auditResults) return;

    const report = {
      timestamp: auditResults.timestamp,
      url: auditResults.url,
      summary: auditResults.summary,
      violations: auditResults.violations.map(v => ({
        id: v.id,
        severity: v.severity,
        guideline: v.guideline,
        successCriterion: v.successCriterion,
        level: v.level,
        description: v.description,
        help: v.help,
        impact: v.impact,
        elementSelector: v.element ? getElementSelector(v.element) : null,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getElementSelector = (element: Element): string => {
    if (element.id) return `#${element.id}`;

    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    const tagName = element.tagName.toLowerCase();

    return `${tagName}${className}`;
  };

  const getSeverityColor = (severity: string, impact: string) => {
    if (severity === 'error' || impact === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (severity === 'warning' || impact === 'serious') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (impact === 'moderate') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Accessibility Audit</h2>
            <div className="text-sm text-gray-600">
              WCAG 2.1 AA Compliance
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={runtimeValidationEnabled}
                onChange={(e) => setRuntimeValidationEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Runtime Validation</span>
            </label>
            <button
              onClick={runAudit}
              disabled={isAuditing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isAuditing ? 'Auditing...' : 'Run Audit'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
              aria-label="Close audit panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {auditResults && (
          <div className="p-4 bg-gray-50 border-b">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-white p-3 rounded">
                <div className="text-2xl font-bold text-gray-900">{stats.totalChecks}</div>
                <div className="text-sm text-gray-600">Total Checks</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-2xl font-bold text-red-600">{stats.violations}</div>
                <div className="text-sm text-gray-600">Violations</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-2xl font-bold text-green-600">{stats.passes}</div>
                <div className="text-sm text-gray-600">Passes</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-2xl font-bold text-yellow-600">{stats.incomplete}</div>
                <div className="text-sm text-gray-600">Incomplete</div>
              </div>
            </div>
            {stats.lastAuditTime && (
              <div className="mt-2 text-sm text-gray-600 text-center">
                Last audit: {stats.lastAuditTime.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Results List */}
          <div className="w-1/2 border-r flex flex-col">
            {/* Filter Controls */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium">Filter by impact:</label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as any)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Issues</option>
                  <option value="critical">Critical</option>
                  <option value="serious">Serious</option>
                  <option value="moderate">Moderate</option>
                </select>
                <button
                  onClick={exportReport}
                  disabled={!auditResults}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  Export Report
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {isAuditing ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Running accessibility audit...</p>
                </div>
              ) : auditResults ? (
                <div className="p-4">
                  {/* Violations Section */}
                  <div className="mb-6">
                    <button
                      onClick={() => toggleSection('violations')}
                      className="w-full flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded"
                    >
                      <span className="font-medium text-red-800">
                        Violations ({getFilteredViolations().length})
                      </span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${
                          expandedSections.has('violations') ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedSections.has('violations') && (
                      <div className="mt-2 space-y-2">
                        {getFilteredViolations().map((violation, index) => (
                          <div
                            key={`${violation.id}-${index}`}
                            className={`p-3 border-l-4 cursor-pointer hover:bg-gray-50 ${
                              violation.impact === 'critical' ? 'border-red-500' :
                              violation.impact === 'serious' ? 'border-orange-500' :
                              violation.impact === 'moderate' ? 'border-yellow-500' : 'border-blue-500'
                            }`}
                            onClick={() => {
                              setSelectedViolation(violation);
                              highlightElement(violation);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className={`px-2 py-1 text-xs rounded border ${getSeverityColor(violation.severity, violation.impact)}`}>
                                    {violation.impact}
                                  </span>
                                  <span className="text-xs text-gray-600">{violation.level}</span>
                                </div>
                                <h4 className="font-medium text-sm">{violation.id}</h4>
                                <p className="text-sm text-gray-600 mt-1">{violation.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {getFilteredViolations().length === 0 && (
                          <div className="p-4 text-center text-gray-600">
                            No violations found for the selected filter.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Passes Section */}
                  <div className="mb-6">
                    <button
                      onClick={() => toggleSection('passes')}
                      className="w-full flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded"
                    >
                      <span className="font-medium text-green-800">
                        Passes ({auditResults.passes.length})
                      </span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${
                          expandedSections.has('passes') ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedSections.has('passes') && (
                      <div className="mt-2 space-y-1">
                        {auditResults.passes.slice(0, 10).map((pass, index) => (
                          <div key={`pass-${index}`} className="p-2 text-sm text-green-700 bg-green-50 rounded">
                            ✓ {pass.description}
                          </div>
                        ))}
                        {auditResults.passes.length > 10 && (
                          <div className="p-2 text-sm text-gray-600 text-center">
                            ... and {auditResults.passes.length - 10} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-600">
                  <p>Click "Run Audit" to analyze page accessibility</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Detail View */}
          <div className="w-1/2 flex flex-col">
            {selectedViolation ? (
              <div className="p-4 h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{selectedViolation.id}</h3>
                  <button
                    onClick={() => {
                      setSelectedViolation(null);
                      removeHighlights();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Clear selection"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs rounded border ${getSeverityColor(selectedViolation.severity, selectedViolation.impact)}`}>
                        {selectedViolation.impact}
                      </span>
                      <span className="text-sm font-medium">WCAG {selectedViolation.level}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Success Criterion</h4>
                    <p className="text-sm text-gray-700">{selectedViolation.successCriterion}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-gray-700">{selectedViolation.description}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">How to Fix</h4>
                    <p className="text-sm text-gray-700">{selectedViolation.help}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Element</h4>
                    {selectedViolation.element ? (
                      <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                        {getElementSelector(selectedViolation.element)}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No specific element</p>
                    )}
                  </div>

                  <div>
                    <a
                      href={selectedViolation.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Learn more about this rule
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-600 h-full flex items-center justify-center">
                <div>
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>Select a violation from the list to see details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add styles for element highlighting */}
      <style jsx global>{`
        .a11y-highlight {
          outline: 3px solid #ef4444 !important;
          outline-offset: 2px !important;
          background-color: rgba(239, 68, 68, 0.1) !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
        }
      `}</style>
    </div>
  );
};

export default AccessibilityAudit;