import React, { useState, useRef, useEffect } from 'react';
import { DocumentTextIcon, CodeBracketIcon, PhotoIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import SnippetHighlighter from './SnippetHighlighter';
import { smartCodeTruncation } from './SmartTruncation';

interface RichMediaPreviewProps {
  content: string;
  type: 'text' | 'code' | 'markdown' | 'json' | 'xml' | 'image' | 'table';
  metadata?: {
    filename?: string;
    language?: string;
    size?: number;
  };
  searchTerms?: string[];
  maxHeight?: number;
  className?: string;
}

const RichMediaPreview: React.FC<RichMediaPreviewProps> = ({
  content,
  type,
  metadata,
  searchTerms = [],
  maxHeight = 300,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const getLanguageFromFilename = (filename?: string): string => {
    if (!filename) return metadata?.language || 'text';

    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'sh': 'bash',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown'
    };

    return languageMap[ext || ''] || ext || 'text';
  };

  const renderCodePreview = () => {
    const language = getLanguageFromFilename(metadata?.filename);
    const maxLines = Math.floor(maxHeight / 20); // Approximate line height
    const truncatedCode = smartCodeTruncation(content, maxLines, searchTerms);
    const isTruncated = truncatedCode !== content;

    return (
      <div className="code-preview">
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 border-b text-sm">
          <CodeBracketIcon className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-700">{language}</span>
          {isTruncated && (
            <span className="text-gray-500">({content.split('\n').length} lines total)</span>
          )}
        </div>
        <div className="overflow-auto" style={{ maxHeight: maxHeight - 40 }}>
          <pre className="p-3 text-sm bg-gray-50">
            <code className={`language-${language}`}>
              <SnippetHighlighter
                content={truncatedCode}
                searchTerms={searchTerms}
                className="block"
              />
            </code>
          </pre>
        </div>
        {isTruncated && (
          <div className="px-3 py-2 bg-gray-100 border-t text-sm text-gray-600">
            Content truncated - {content.split('\n').length - truncatedCode.split('\n').length} more lines
          </div>
        )}
      </div>
    );
  };

  const renderJsonPreview = () => {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      const lines = formatted.split('\n');
      const maxLines = Math.floor(maxHeight / 20);

      const previewContent = isJsonExpanded || lines.length <= maxLines
        ? formatted
        : lines.slice(0, maxLines).join('\n') + '\n...';

      return (
        <div className="json-preview">
          <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b text-sm">
            <div className="flex items-center space-x-2">
              <DocumentTextIcon className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-blue-700">JSON</span>
              <span className="text-blue-600">({Object.keys(parsed).length} keys)</span>
            </div>
            {lines.length > maxLines && (
              <button
                onClick={() => setIsJsonExpanded(!isJsonExpanded)}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                {isJsonExpanded ? 'Collapse' : 'Expand'}
              </button>
            )}
          </div>
          <div className="overflow-auto" style={{ maxHeight: maxHeight - 40 }}>
            <pre className="p-3 text-sm bg-gray-50">
              <code className="language-json">
                <SnippetHighlighter
                  content={previewContent}
                  searchTerms={searchTerms}
                  className="block"
                />
              </code>
            </pre>
          </div>
        </div>
      );
    } catch (error) {
      return (
        <div className="json-preview">
          <div className="px-3 py-2 bg-red-50 border-b text-sm">
            <span className="text-red-600">Invalid JSON</span>
          </div>
          <div className="p-3 text-sm bg-gray-50 text-gray-600">
            {content.slice(0, 200)}...
          </div>
        </div>
      );
    }
  };

  const renderXmlPreview = () => {
    const lines = content.split('\n');
    const maxLines = Math.floor(maxHeight / 20);
    const truncatedContent = lines.length > maxLines
      ? lines.slice(0, maxLines).join('\n') + '\n...'
      : content;

    return (
      <div className="xml-preview">
        <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 border-b text-sm">
          <CodeBracketIcon className="h-4 w-4 text-green-500" />
          <span className="font-medium text-green-700">XML</span>
          {lines.length > maxLines && (
            <span className="text-green-600">({lines.length} lines total)</span>
          )}
        </div>
        <div className="overflow-auto" style={{ maxHeight: maxHeight - 40 }}>
          <pre className="p-3 text-sm bg-gray-50">
            <code className="language-xml">
              <SnippetHighlighter
                content={truncatedContent}
                searchTerms={searchTerms}
                className="block"
              />
            </code>
          </pre>
        </div>
      </div>
    );
  };

  const renderMarkdownPreview = () => {
    const lines = content.split('\n');
    const maxLines = Math.floor(maxHeight / 20);
    const truncatedContent = lines.length > maxLines
      ? lines.slice(0, maxLines).join('\n')
      : content;

    return (
      <div className="markdown-preview">
        <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 border-b text-sm">
          <DocumentTextIcon className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-purple-700">Markdown</span>
        </div>
        <div
          className="overflow-auto prose prose-sm max-w-none p-3"
          style={{ maxHeight: maxHeight - 40 }}
        >
          <SnippetHighlighter
            content={truncatedContent}
            searchTerms={searchTerms}
            className="whitespace-pre-wrap"
          />
        </div>
      </div>
    );
  };

  const renderImagePreview = () => {
    if (imageError) {
      return (
        <div className="image-preview flex items-center justify-center bg-gray-100" style={{ height: maxHeight }}>
          <div className="text-center text-gray-500">
            <PhotoIcon className="h-12 w-12 mx-auto mb-2" />
            <p>Unable to load image</p>
          </div>
        </div>
      );
    }

    return (
      <div className="image-preview">
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 border-b text-sm">
          <PhotoIcon className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-700">Image</span>
          {metadata?.filename && (
            <span className="text-gray-600">{metadata.filename}</span>
          )}
        </div>
        <div
          className="flex items-center justify-center bg-gray-50"
          style={{ height: maxHeight - 40 }}
        >
          <img
            src={content}
            alt={metadata?.filename || 'Preview'}
            className="max-w-full max-h-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      </div>
    );
  };

  const renderTablePreview = () => {
    const lines = content.split('\n').filter(line => line.trim());
    const maxRows = Math.floor((maxHeight - 80) / 32); // Approximate row height
    const truncatedLines = lines.length > maxRows ? lines.slice(0, maxRows) : lines;

    // Try to parse as CSV/TSV
    const delimiter = content.includes('\t') ? '\t' : ',';
    const rows = truncatedLines.map(line => line.split(delimiter));
    const maxCols = Math.max(...rows.map(row => row.length));

    return (
      <div className="table-preview">
        <div className="flex items-center space-x-2 px-3 py-2 bg-indigo-50 border-b text-sm">
          <TableCellsIcon className="h-4 w-4 text-indigo-500" />
          <span className="font-medium text-indigo-700">Table</span>
          <span className="text-indigo-600">({rows.length} rows, {maxCols} columns)</span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: maxHeight - 40 }}>
          <table className="min-w-full text-sm">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 border-b border-gray-200 max-w-xs truncate">
                      <SnippetHighlighter
                        content={cell}
                        searchTerms={searchTerms}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lines.length > truncatedLines.length && (
          <div className="px-3 py-2 bg-gray-100 border-t text-sm text-gray-600">
            {lines.length - truncatedLines.length} more rows...
          </div>
        )}
      </div>
    );
  };

  const renderPreview = () => {
    switch (type) {
      case 'code':
        return renderCodePreview();
      case 'json':
        return renderJsonPreview();
      case 'xml':
        return renderXmlPreview();
      case 'markdown':
        return renderMarkdownPreview();
      case 'image':
        return renderImagePreview();
      case 'table':
        return renderTablePreview();
      default:
        return (
          <div className="p-3 prose prose-sm max-w-none">
            <SnippetHighlighter
              content={content}
              searchTerms={searchTerms}
              className="whitespace-pre-wrap"
            />
          </div>
        );
    }
  };

  return (
    <div
      ref={previewRef}
      className={`rich-media-preview border rounded-lg overflow-hidden ${className}`}
      data-testid={`rich-media-${type}`}
    >
      {renderPreview()}
    </div>
  );
};

export default RichMediaPreview;