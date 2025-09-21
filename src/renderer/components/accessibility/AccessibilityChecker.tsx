/**
 * Accessibility Checker Component
 *
 * A development tool for testing and validating ARIA implementations in real-time.
 * This component can be conditionally rendered in development mode to help ensure
 * accessibility compliance.
 */

import React, { useState, useEffect, useRef } from 'react';
import { AccessibilityTester, AriaUtils } from '../../utils/accessibility';

interface AccessibilityCheckerProps {
  target?: HTMLElement | null;
  enabled?: boolean;
  showInline?: boolean;
  onIssuesFound?: (issues: AccessibilityIssues) => void;
}

interface AccessibilityIssues {
  errors: Array<{ type: string; message: string; element: HTMLElement }>;
  warnings: Array<{ type: string; message: string; element: HTMLElement }>;
  score: number;
}

export const AccessibilityChecker: React.FC<AccessibilityCheckerProps> = ({
  target,
  enabled = process.env.NODE_ENV === 'development',
  showInline = false,
  onIssuesFound,
}) => {
  const [issues, setIssues] = useState<AccessibilityIssues | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Run accessibility audit
  const runAudit = () => {
    const element = target || document.body;
    const audit = AccessibilityTester.audit(element);
    const issues = {
      errors: audit.errors,
      warnings: audit.warnings,
      score: audit.score,
    };

    setIssues(issues);
    onIssuesFound?.(issues);
  };

  // Auto-check periodically
  useEffect(() => {
    if (!enabled || !autoCheck) return;

    runAudit(); // Initial check

    intervalRef.current = setInterval(runAudit, 5000); // Check every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, autoCheck, target]);

  // Handle element highlighting
  const highlightElement = (element: HTMLElement) => {
    // Remove existing highlights
    document.querySelectorAll('.a11y-highlight').forEach(el => {
      el.classList.remove('a11y-highlight');
    });

    // Add highlight to target element
    element.classList.add('a11y-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Remove highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('a11y-highlight');
    }, 3000);
  };

  // Generate element selector for debugging
  const getElementSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      selector += `.${element.className.split(' ').join('.')}`;
    }

    return selector;
  };

  if (!enabled) return null;

  const ScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
    const getScoreClass = (score: number) => {
      if (score >= 90) return 'score-excellent';
      if (score >= 70) return 'score-good';
      return 'score-poor';
    };

    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 bg-opacity-10 text-sm font-semibold rounded">
        <div className={`w-3 h-3 rounded-full ${getScoreClass(score)}`} style={{backgroundColor: score >= 90 ? '#4ade80' : score >= 70 ? '#fbbf24' : '#ef4444'}} />
        {score.toFixed(1)}/100
      </div>
    );
  };

  const IssueItem: React.FC<{
    issue: { type: string; message: string; element: HTMLElement };
    severity: 'error' | 'warning';
  }> = ({ issue, severity }) => (
    <div
      className={`p-2 mb-1 cursor-pointer text-xs ${
        severity === 'error' ? 'a11y-error' : 'a11y-warning'
      } rounded-r`}
      onClick={() => highlightElement(issue.element)}
      title="Click to highlight element"
    >
      <div className={`font-semibold ${severity === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
        {severity === 'error' ? '❌' : '⚠️'} {issue.type}
      </div>
      <div className="mt-1 text-gray-700">
        {issue.message}
      </div>
      <div className="mt-1 text-xs text-gray-500 font-mono">
        {getElementSelector(issue.element)}
      </div>
    </div>
  );

  const InlineReport: React.FC = () => (
    <div className="floating-top-right container-narrow scrollable-y bg-white border-2 border-gray-300 rounded-lg shadow-lg text-sm">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold">A11y Report</span>
          {issues && <ScoreIndicator score={issues.score} />}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoCheck(!autoCheck)}
            className={`btn btn-xs ${autoCheck ? 'btn-primary' : 'btn-outline-secondary'}`}
          >
            Auto {autoCheck ? 'On' : 'Off'}
          </button>
          <button
            onClick={runAudit}
            className="btn btn-xs btn-success"
          >
            Check
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="modal-btn-close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-3">
        {!issues ? (
          <div>Click "Check" to run accessibility audit</div>
        ) : (
          <>
            {issues.errors.length > 0 && (
              <div className="mb-4">
                <div className="font-semibold mb-2 text-red-600">
                  Errors ({issues.errors.length})
                </div>
                {issues.errors.map((error, index) => (
                  <IssueItem key={index} issue={error} severity="error" />
                ))}
              </div>
            )}

            {issues.warnings.length > 0 && (
              <div>
                <div className="font-semibold mb-2 text-yellow-600">
                  Warnings ({issues.warnings.length})
                </div>
                {issues.warnings.map((warning, index) => (
                  <IssueItem key={index} issue={warning} severity="warning" />
                ))}
              </div>
            )}

            {issues.errors.length === 0 && issues.warnings.length === 0 && (
              <div className="text-center text-success font-semibold">
                ✅ No accessibility issues found!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const FloatingButton: React.FC = () => (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={`btn-fab center-content text-white text-2xl ${
        issues && (issues.errors.length > 0 || issues.warnings.length > 0)
          ? 'bg-error'
          : 'bg-success'
      }`}
      title="Accessibility Checker"
      aria-label="Toggle accessibility checker"
    >
      ♿
    </button>
  );

  return (
    <>
      <style>
        {`
          .a11y-highlight {
            outline: 3px solid #3b82f6 !important;
            outline-offset: 2px !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
            transition: all 0.3s ease !important;
          }
        `}
      </style>

      {showInline ? (
        <>
          <FloatingButton />
          {isOpen && <InlineReport />}
        </>
      ) : (
        issues && (
          <div className="floating-bottom-right p-3 bg-white border-2 border-gray-300 rounded-lg shadow-lg text-sm flex items-center gap-3">
            <ScoreIndicator score={issues.score} />
            <div>
              {issues.errors.length > 0 && (
                <span className="text-red-600 font-semibold">
                  {issues.errors.length} errors
                </span>
              )}
              {issues.errors.length > 0 && issues.warnings.length > 0 && (
                <span className="text-gray-500">, </span>
              )}
              {issues.warnings.length > 0 && (
                <span className="text-yellow-600 font-semibold">
                  {issues.warnings.length} warnings
                </span>
              )}
              {issues.errors.length === 0 && issues.warnings.length === 0 && (
                <span className="text-success font-semibold">
                  All good!
                </span>
              )}
            </div>
          </div>
        )
      )}
    </>
  );
};

// Hook for using accessibility checker in components
export const useAccessibilityChecker = (element?: HTMLElement | null) => {
  const [issues, setIssues] = useState<AccessibilityIssues | null>(null);

  const checkAccessibility = () => {
    if (!element) return;

    const audit = AccessibilityTester.audit(element);
    setIssues({
      errors: audit.errors,
      warnings: audit.warnings,
      score: audit.score,
    });
  };

  return {
    issues,
    checkAccessibility,
    hasErrors: issues ? issues.errors.length > 0 : false,
    hasWarnings: issues ? issues.warnings.length > 0 : false,
    score: issues?.score || 0,
  };
};

export default AccessibilityChecker;