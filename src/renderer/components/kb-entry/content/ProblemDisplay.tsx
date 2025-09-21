import React, { memo, useMemo } from 'react';
import { AlertCircle, Code, Terminal, FileWarning } from 'lucide-react';

export interface ProblemDisplayProps {
  problem: string;
  searchQuery?: string;
  truncate?: boolean;
  maxLength?: number;
  showFullContent?: boolean;
  highlightErrors?: boolean;
  showIcon?: boolean;
}

export const ProblemDisplay = memo(function ProblemDisplay({
  problem,
  searchQuery,
  truncate = false,
  maxLength = 200,
  showFullContent = true,
  highlightErrors = true,
  showIcon = true
}: ProblemDisplayProps) {
  // Highlight search terms in text
  const highlightSearchTerms = (text: string, query?: string): React.ReactNode => {
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
  
  // Extract and format error codes
  const extractErrorInfo = (text: string) => {
    const errorPatterns = [
      { pattern: /S0C\d/g, type: 'abend' },
      { pattern: /U\d{4}/g, type: 'user-abend' },
      { pattern: /IEF\d{3}[A-Z]/g, type: 'system' },
      { pattern: /VSAM STATUS \d{2}/g, type: 'vsam' },
      { pattern: /SQLCODE -?\d+/g, type: 'db2' },
      { pattern: /WER\d{3}[A-Z]/g, type: 'sort' },
      { pattern: /CEE\d{4}[A-Z]/g, type: 'le' },
      { pattern: /IGZ\d{4}[A-Z]/g, type: 'cobol' }
    ];
    
    const errors: Array<{ code: string; type: string }> = [];
    
    errorPatterns.forEach(({ pattern, type }) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          errors.push({ code: match, type });
        });
      }
    });
    
    return errors;
  };
  
  // Format problem text with structure detection
  const formatProblemText = (text: string): React.ReactNode => {
    // Check if text contains structured sections
    const lines = text.split('\n');
    const hasSteps = lines.some(line => /^\d+\./.test(line.trim()));
    const hasBullets = lines.some(line => /^[•\-\*]/.test(line.trim()));
    
    if (hasSteps || hasBullets) {
      return (
        <div className={styles.structuredContent}>
          {lines.map((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return <br key={index} />;
            
            // Numbered steps
            if (/^\d+\./.test(trimmed)) {
              return (
                <div key={index} className={styles.step}>
                  {highlightSearchTerms(trimmed, searchQuery)}
                </div>
              );
            }
            
            // Bullet points
            if (/^[•\-\*]/.test(trimmed)) {
              return (
                <div key={index} className={styles.bullet}>
                  {highlightSearchTerms(trimmed, searchQuery)}
                </div>
              );
            }
            
            // Code or technical content
            if (trimmed.startsWith('//') || trimmed.includes('DSN=') || /^\s{2,}/.test(line)) {
              return (
                <code key={index} className={styles.codeBlock}>
                  {trimmed}
                </code>
              );
            }
            
            return (
              <p key={index} className={styles.paragraph}>
                {highlightSearchTerms(trimmed, searchQuery)}
              </p>
            );
          })}
        </div>
      );
    }
    
    // Simple paragraph text
    return <p className={styles.problemText}>{highlightSearchTerms(text, searchQuery)}</p>;
  };
  
  const errors = useMemo(() => extractErrorInfo(problem), [problem]);
  const displayText = truncate && !showFullContent 
    ? problem.substring(0, maxLength) + (problem.length > maxLength ? '...' : '')
    : problem;
  
  // Determine icon based on content
  const getIcon = () => {
    if (problem.toLowerCase().includes('abend') || problem.toLowerCase().includes('error')) {
      return FileWarning;
    }
    if (problem.includes('//') || problem.includes('DSN=')) {
      return Code;
    }
    return AlertCircle;
  };
  
  const Icon = showIcon ? getIcon() : null;
  
  return (
    <div className={styles.container}>
      {showIcon && Icon && (
        <div className={styles.iconSection}>
          <Icon className={styles.icon} size={18} />
        </div>
      )}
      
      <div className={styles.content}>
        {highlightErrors && errors.length > 0 && (
          <div className={styles.errorCodes}>
            {errors.map((error, index) => (
              <span 
                key={index} 
                className={`${styles.errorCode} ${styles[error.type]}`}
                title={`Error type: ${error.type}`}
              >
                <Terminal size={10} />
                {error.code}
              </span>
            ))}
          </div>
        )}
        
        <div className={styles.textContent}>
          {formatProblemText(displayText)}
        </div>
        
        {truncate && problem.length > maxLength && !showFullContent && (
          <button className={styles.readMore} aria-label="Read more">
            Read more...
          </button>
        )}
      </div>
    </div>
  );
});