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
    const getScoreColor = (score: number) => {
      if (score >= 90) return '#4ade80'; // green-400
      if (score >= 70) return '#fbbf24'; // yellow-400
      return '#ef4444'; // red-500
    };

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
          fontWeight: '600',
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getScoreColor(score),
          }}
        />
        {score.toFixed(1)}/100
      </div>
    );
  };

  const IssueItem: React.FC<{
    issue: { type: string; message: string; element: HTMLElement };
    severity: 'error' | 'warning';
  }> = ({ issue, severity }) => (
    <div
      style={{
        padding: '8px',
        marginBottom: '4px',
        borderLeft: `4px solid ${severity === 'error' ? '#ef4444' : '#fbbf24'}`,
        backgroundColor: severity === 'error' ? '#fef2f2' : '#fffbeb',
        borderRadius: '0 4px 4px 0',
        fontSize: '13px',
        cursor: 'pointer',
      }}
      onClick={() => highlightElement(issue.element)}
      title="Click to highlight element"
    >
      <div style={{ fontWeight: '600', color: severity === 'error' ? '#dc2626' : '#d97706' }}>
        {severity === 'error' ? '❌' : '⚠️'} {issue.type}
      </div>
      <div style={{ marginTop: '4px', color: '#374151' }}>
        {issue.message}
      </div>
      <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
        {getElementSelector(issue.element)}
      </div>
    </div>
  );

  const InlineReport: React.FC = () => (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '300px',
        maxHeight: '80vh',
        overflowY: 'auto',
        backgroundColor: 'white',
        border: '2px solid #d1d5db',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
        fontSize: '14px',
      }}
    >
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '600' }}>A11y Report</span>
          {issues && <ScoreIndicator score={issues.score} />}
        </div>
        <div>
          <button
            onClick={() => setAutoCheck(!autoCheck)}
            style={{
              padding: '4px 8px',
              marginRight: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: autoCheck ? '#3b82f6' : 'white',
              color: autoCheck ? 'white' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Auto {autoCheck ? 'On' : 'Off'}
          </button>
          <button
            onClick={runAudit}
            style={{
              padding: '4px 8px',
              marginRight: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Check
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: '4px 8px',
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        {!issues ? (
          <div>Click "Check" to run accessibility audit</div>
        ) : (
          <>
            {issues.errors.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                  Errors ({issues.errors.length})
                </div>
                {issues.errors.map((error, index) => (
                  <IssueItem key={index} issue={error} severity="error" />
                ))}
              </div>
            )}

            {issues.warnings.length > 0 && (
              <div>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#d97706' }}>
                  Warnings ({issues.warnings.length})
                </div>
                {issues.warnings.map((warning, index) => (
                  <IssueItem key={index} issue={warning} severity="warning" />
                ))}
              </div>
            )}

            {issues.errors.length === 0 && issues.warnings.length === 0 && (
              <div style={{ textAlign: 'center', color: '#10b981', fontWeight: '600' }}>
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
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: issues && (issues.errors.length > 0 || issues.warnings.length > 0)
          ? '#ef4444'
          : '#10b981',
        color: 'white',
        fontSize: '24px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}
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
          <div
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              padding: '12px',
              backgroundColor: 'white',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 9999,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ScoreIndicator score={issues.score} />
            <div>
              {issues.errors.length > 0 && (
                <span style={{ color: '#dc2626', fontWeight: '600' }}>
                  {issues.errors.length} errors
                </span>
              )}
              {issues.errors.length > 0 && issues.warnings.length > 0 && (
                <span style={{ color: '#6b7280' }}>, </span>
              )}
              {issues.warnings.length > 0 && (
                <span style={{ color: '#d97706', fontWeight: '600' }}>
                  {issues.warnings.length} warnings
                </span>
              )}
              {issues.errors.length === 0 && issues.warnings.length === 0 && (
                <span style={{ color: '#10b981', fontWeight: '600' }}>
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