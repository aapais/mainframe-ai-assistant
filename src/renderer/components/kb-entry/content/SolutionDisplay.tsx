import React, { memo, useState, useMemo } from 'react';
import { CheckCircle, Code, Copy, ChevronDown, ChevronUp, FileCode, Terminal, Lightbulb, AlertTriangle } from 'lucide-react';
import styles from './SolutionDisplay.module.css';

export interface SolutionDisplayProps {
  solution: string;
  codeExamples?: string[];
  showFull?: boolean;
  onToggleView?: () => void;
  searchQuery?: string;
  onCopyCode?: (code: string) => void;
}

export const SolutionDisplay = memo(function SolutionDisplay({
  solution,
  codeExamples = [],
  showFull = false,
  onToggleView,
  searchQuery,
  onCopyCode
}: SolutionDisplayProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedExample, setExpandedExample] = useState<number | null>(null);
  
  // Parse solution into structured steps
  const parseSolutionSteps = (text: string) => {
    const lines = text.split('\n');
    const steps: Array<{ type: 'step' | 'note' | 'warning' | 'code' | 'text'; content: string; number?: string }> = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Numbered steps (1., 2., etc.)
      const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
      if (stepMatch) {
        steps.push({ type: 'step', number: stepMatch[1], content: stepMatch[2] });
        return;
      }
      
      // JCL or code blocks
      if (trimmed.startsWith('//') || trimmed.match(/^\s*(EXEC|DD|DSN=|DISP=)/)) {
        steps.push({ type: 'code', content: line });
        return;
      }
      
      // Notes and warnings
      if (trimmed.toLowerCase().startsWith('note:') || trimmed.toLowerCase().startsWith('important:')) {
        steps.push({ type: 'note', content: trimmed });
        return;
      }
      
      if (trimmed.toLowerCase().startsWith('warning:') || trimmed.toLowerCase().startsWith('caution:')) {
        steps.push({ type: 'warning', content: trimmed });
        return;
      }
      
      // Default text
      steps.push({ type: 'text', content: trimmed });
    });
    
    return steps;
  };
  
  // Highlight search terms
  const highlightText = (text: string, query?: string): React.ReactNode => {
    if (!query || query.length < 2) return text;
    
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (terms.length === 0) return text;
    
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (terms.some(term => part.toLowerCase() === term)) {
        return <mark key={index} className={styles.highlight}>{part}</mark>;
      }
      return part;
    });
  };
  
  // Handle code copy
  const handleCopyCode = (code: string, index: number) => {
    if (onCopyCode) {
      onCopyCode(code);
    } else {
      navigator.clipboard.writeText(code);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  const solutionSteps = useMemo(() => parseSolutionSteps(solution), [solution]);
  
  // Group consecutive code lines
  const groupedSteps = useMemo(() => {
    const grouped: Array<{ type: string; items: any[] }> = [];
    let currentGroup: { type: string; items: any[] } | null = null;
    
    solutionSteps.forEach(step => {
      if (step.type === 'code') {
        if (currentGroup?.type === 'code') {
          currentGroup.items.push(step);
        } else {
          currentGroup = { type: 'code', items: [step] };
          grouped.push(currentGroup);
        }
      } else {
        currentGroup = null;
        grouped.push({ type: step.type, items: [step] });
      }
    });
    
    return grouped;
  }, [solutionSteps]);
  
  // Determine if solution should be truncated
  const shouldTruncate = !showFull && solution.length > 500;
  const displayGroups = shouldTruncate ? groupedSteps.slice(0, 3) : groupedSteps;
  
  return (
    <div className={styles.container}>
      <div className={styles.stepsContainer}>
        {displayGroups.map((group, groupIndex) => {
          if (group.type === 'code') {
            const codeContent = group.items.map(item => item.content).join('\n');
            return (
              <div key={groupIndex} className={styles.codeSection}>
                <div className={styles.codeHeader}>
                  <div className={styles.codeLabel}>
                    <FileCode size={14} />
                    <span>Code Example</span>
                  </div>
                  <button
                    className={styles.copyButton}
                    onClick={() => handleCopyCode(codeContent, groupIndex)}
                    aria-label="Copy code"
                  >
                    {copiedIndex === groupIndex ? (
                      <>
                        <CheckCircle size={14} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className={styles.codeBlock}>
                  <code>{codeContent}</code>
                </pre>
              </div>
            );
          }
          
          return group.items.map((step, stepIndex) => {
            const key = `${groupIndex}-${stepIndex}`;
            
            if (step.type === 'step') {
              return (
                <div key={key} className={styles.step}>
                  <div className={styles.stepNumber}>{step.number}</div>
                  <div className={styles.stepContent}>
                    <CheckCircle className={styles.stepIcon} size={16} />
                    <span>{highlightText(step.content, searchQuery)}</span>
                  </div>
                </div>
              );
            }
            
            if (step.type === 'note') {
              return (
                <div key={key} className={styles.note}>
                  <Lightbulb className={styles.noteIcon} size={16} />
                  <span>{highlightText(step.content, searchQuery)}</span>
                </div>
              );
            }
            
            if (step.type === 'warning') {
              return (
                <div key={key} className={styles.warning}>
                  <AlertTriangle className={styles.warningIcon} size={16} />
                  <span>{highlightText(step.content, searchQuery)}</span>
                </div>
              );
            }
            
            return (
              <p key={key} className={styles.text}>
                {highlightText(step.content, searchQuery)}
              </p>
            );
          });
        })}
      </div>
      
      {/* Code Examples Section */}
      {codeExamples.length > 0 && (
        <div className={styles.examplesSection}>
          <h4 className={styles.examplesTitle}>
            <Code size={16} />
            Additional Code Examples
          </h4>
          {codeExamples.map((example, index) => (
            <div key={index} className={styles.exampleItem}>
              <div className={styles.exampleHeader}>
                <button
                  className={styles.expandButton}
                  onClick={() => setExpandedExample(expandedExample === index ? null : index)}
                  aria-expanded={expandedExample === index}
                  aria-label={`${expandedExample === index ? 'Collapse' : 'Expand'} example ${index + 1}`}
                >
                  <Terminal size={14} />
                  Example {index + 1}
                  {expandedExample === index ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button
                  className={styles.copyButton}
                  onClick={() => handleCopyCode(example, 100 + index)}
                  aria-label="Copy example code"
                >
                  {copiedIndex === 100 + index ? <CheckCircle size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {expandedExample === index && (
                <pre className={styles.exampleCode}>
                  <code>{example}</code>
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Toggle View Button */}
      {shouldTruncate && onToggleView && (
        <button className={styles.toggleButton} onClick={onToggleView}>
          {showFull ? (
            <>
              <ChevronUp size={16} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Show Full Solution
            </>
          )}
        </button>
      )}
    </div>
  );
});