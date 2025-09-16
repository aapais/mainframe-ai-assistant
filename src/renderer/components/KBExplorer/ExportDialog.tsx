/**
 * ExportDialog Component
 *
 * A comprehensive export dialog with multiple format options:
 * - CSV export with configurable columns and delimiters
 * - JSON export with formatting options
 * - PDF export with custom templates
 * - Excel export with multiple sheets
 * - Print-friendly HTML export
 * - Field selection and customization
 * - Preview capabilities
 * - Progress tracking for large exports
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { KBEntry } from '../../../types/services';

// =====================
// Types & Interfaces
// =====================

export interface ExportDialogProps {
  entries: KBEntry[];
  onExport: (format: ExportFormat, options: ExportOptions) => Promise<void>;
  onClose: () => void;
  defaultFormat?: ExportFormat;
  className?: string;
}

export type ExportFormat = 'csv' | 'json' | 'pdf' | 'excel' | 'html';

export interface ExportOptions {
  format: ExportFormat;
  fields: (keyof KBEntry)[];
  includeHeaders: boolean;
  filename?: string;
  csvOptions?: {
    delimiter: string;
    quoteChar: string;
    escapeChar: string;
    includeUTF8BOM: boolean;
  };
  jsonOptions?: {
    indent: number;
    minified: boolean;
  };
  pdfOptions?: {
    pageSize: 'A4' | 'Letter' | 'A3';
    orientation: 'portrait' | 'landscape';
    includeMetadata: boolean;
    template: 'simple' | 'detailed' | 'compact';
  };
  excelOptions?: {
    sheetName: string;
    includeFilters: boolean;
    autoWidth: boolean;
  };
  htmlOptions?: {
    includeStyles: boolean;
    responsive: boolean;
    includeSearch: boolean;
  };
}

interface FieldOption {
  key: keyof KBEntry;
  label: string;
  description?: string;
  required?: boolean;
}

// =====================
// Constants
// =====================

const EXPORT_FORMATS: { value: ExportFormat; label: string; icon: string; description: string }[] = [
  {
    value: 'csv',
    label: 'CSV',
    icon: '📊',
    description: 'Comma-separated values for spreadsheets',
  },
  {
    value: 'json',
    label: 'JSON',
    icon: '🔧',
    description: 'Structured data for applications',
  },
  {
    value: 'pdf',
    label: 'PDF',
    icon: '📄',
    description: 'Formatted document for printing',
  },
  {
    value: 'excel',
    label: 'Excel',
    icon: '📈',
    description: 'Microsoft Excel workbook',
  },
  {
    value: 'html',
    label: 'HTML',
    icon: '🌐',
    description: 'Web page for sharing',
  },
];

const FIELD_OPTIONS: FieldOption[] = [
  { key: 'id', label: 'ID', description: 'Unique identifier', required: true },
  { key: 'title', label: 'Title', description: 'Entry title', required: true },
  { key: 'problem', label: 'Problem', description: 'Problem description' },
  { key: 'solution', label: 'Solution', description: 'Solution steps' },
  { key: 'category', label: 'Category', description: 'Entry category' },
  { key: 'tags', label: 'Tags', description: 'Associated tags' },
  { key: 'usage_count', label: 'Usage Count', description: 'Times used' },
  { key: 'success_count', label: 'Success Count', description: 'Successful uses' },
  { key: 'failure_count', label: 'Failure Count', description: 'Failed uses' },
  { key: 'created_at', label: 'Created Date', description: 'Creation date' },
  { key: 'updated_at', label: 'Updated Date', description: 'Last modified date' },
  { key: 'created_by', label: 'Created By', description: 'Author' },
];

const DEFAULT_CSV_OPTIONS = {
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"',
  includeUTF8BOM: true,
};

const DEFAULT_JSON_OPTIONS = {
  indent: 2,
  minified: false,
};

const DEFAULT_PDF_OPTIONS = {
  pageSize: 'A4' as const,
  orientation: 'portrait' as const,
  includeMetadata: true,
  template: 'detailed' as const,
};

const DEFAULT_EXCEL_OPTIONS = {
  sheetName: 'KB Entries',
  includeFilters: true,
  autoWidth: true,
};

const DEFAULT_HTML_OPTIONS = {
  includeStyles: true,
  responsive: true,
  includeSearch: true,
};

// =====================
// Sub-components
// =====================

const FormatSelector: React.FC<{
  selectedFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
}> = ({ selectedFormat, onFormatChange }) => (
  <div className="space-y-3">
    <label className="text-sm font-medium text-gray-700">Export Format</label>
    <div className="grid grid-cols-2 gap-3">
      {EXPORT_FORMATS.map(format => (
        <button
          key={format.value}
          type="button"
          onClick={() => onFormatChange(format.value)}
          className={`
            p-3 text-left border rounded-lg transition-colors
            ${selectedFormat === format.value
              ? 'border-blue-500 bg-blue-50 text-blue-900'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-lg">{format.icon}</span>
            <span className="font-medium">{format.label}</span>
          </div>
          <p className="text-xs text-gray-600">{format.description}</p>
        </button>
      ))}
    </div>
  </div>
);

const FieldSelector: React.FC<{
  selectedFields: (keyof KBEntry)[];
  onFieldsChange: (fields: (keyof KBEntry)[]) => void;
}> = ({ selectedFields, onFieldsChange }) => {
  const handleFieldToggle = useCallback((field: keyof KBEntry) => {
    const fieldOption = FIELD_OPTIONS.find(f => f.key === field);
    if (fieldOption?.required) return; // Don't allow toggling required fields

    if (selectedFields.includes(field)) {
      onFieldsChange(selectedFields.filter(f => f !== field));
    } else {
      onFieldsChange([...selectedFields, field]);
    }
  }, [selectedFields, onFieldsChange]);

  const handleSelectAll = useCallback(() => {
    const allFields = FIELD_OPTIONS.map(f => f.key);
    onFieldsChange(allFields);
  }, [onFieldsChange]);

  const handleSelectNone = useCallback(() => {
    const requiredFields = FIELD_OPTIONS.filter(f => f.required).map(f => f.key);
    onFieldsChange(requiredFields);
  }, [onFieldsChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Fields to Export</label>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleSelectNone}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Select None
          </button>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
        <div className="p-3 space-y-2">
          {FIELD_OPTIONS.map(field => {
            const isSelected = selectedFields.includes(field.key);
            const isRequired = field.required;

            return (
              <label
                key={field.key}
                className={`flex items-start space-x-3 p-2 rounded ${
                  isRequired ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleFieldToggle(field.key)}
                  disabled={isRequired}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm ${isRequired ? 'font-medium text-gray-700' : 'text-gray-900'}`}>
                      {field.label}
                    </span>
                    {isRequired && (
                      <span className="text-xs text-red-500 font-medium">Required</span>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        {selectedFields.length} of {FIELD_OPTIONS.length} fields selected
      </div>
    </div>
  );
};

const CSVOptions: React.FC<{
  options: typeof DEFAULT_CSV_OPTIONS;
  onChange: (options: typeof DEFAULT_CSV_OPTIONS) => void;
}> = ({ options, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-sm font-medium text-gray-700">CSV Options</h4>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Delimiter</label>
        <select
          value={options.delimiter}
          onChange={(e) => onChange({ ...options, delimiter: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value=",">Comma (,)</option>
          <option value=";">Semicolon (;)</option>
          <option value="\t">Tab</option>
          <option value="|">Pipe (|)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Quote Character</label>
        <select
          value={options.quoteChar}
          onChange={(e) => onChange({ ...options, quoteChar: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={'"'}>Double Quote (")</option>
          <option value="'">Single Quote (')</option>
        </select>
      </div>
    </div>
    <label className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={options.includeUTF8BOM}
        onChange={(e) => onChange({ ...options, includeUTF8BOM: e.target.checked })}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <span className="text-sm text-gray-700">Include UTF-8 BOM</span>
    </label>
  </div>
);

const PDFOptions: React.FC<{
  options: typeof DEFAULT_PDF_OPTIONS;
  onChange: (options: typeof DEFAULT_PDF_OPTIONS) => void;
}> = ({ options, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-sm font-medium text-gray-700">PDF Options</h4>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Page Size</label>
        <select
          value={options.pageSize}
          onChange={(e) => onChange({ ...options, pageSize: e.target.value as any })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
          <option value="A3">A3</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Orientation</label>
        <select
          value={options.orientation}
          onChange={(e) => onChange({ ...options, orientation: e.target.value as any })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>
    </div>
    <div>
      <label className="block text-xs text-gray-600 mb-1">Template</label>
      <select
        value={options.template}
        onChange={(e) => onChange({ ...options, template: e.target.value as any })}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="simple">Simple</option>
        <option value="detailed">Detailed</option>
        <option value="compact">Compact</option>
      </select>
    </div>
    <label className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={options.includeMetadata}
        onChange={(e) => onChange({ ...options, includeMetadata: e.target.checked })}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <span className="text-sm text-gray-700">Include metadata</span>
    </label>
  </div>
);

// =====================
// Main Component
// =====================

export const ExportDialog: React.FC<ExportDialogProps> = ({
  entries,
  onExport,
  onClose,
  defaultFormat = 'csv',
  className = '',
}) => {
  // =====================
  // State Management
  // =====================

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);
  const [selectedFields, setSelectedFields] = useState<(keyof KBEntry)[]>(() =>
    FIELD_OPTIONS.filter(f => f.required || ['title', 'problem', 'solution', 'category'].includes(f.key)).map(f => f.key)
  );
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Format-specific options
  const [csvOptions, setCsvOptions] = useState(DEFAULT_CSV_OPTIONS);
  const [jsonOptions, setJsonOptions] = useState(DEFAULT_JSON_OPTIONS);
  const [pdfOptions, setPdfOptions] = useState(DEFAULT_PDF_OPTIONS);
  const [excelOptions, setExcelOptions] = useState(DEFAULT_EXCEL_OPTIONS);
  const [htmlOptions, setHtmlOptions] = useState(DEFAULT_HTML_OPTIONS);

  const formRef = useRef<HTMLFormElement>(null);

  // =====================
  // Computed Values
  // =====================

  const defaultFilename = useMemo(() => {
    const date = new Date().toISOString().split('T')[0];
    const count = entries.length;
    return `kb-entries-${count}-${date}`;
  }, [entries.length]);

  const exportOptions: ExportOptions = useMemo(() => {
    const baseOptions = {
      format: selectedFormat,
      fields: selectedFields,
      includeHeaders,
      filename: filename.trim() || defaultFilename,
    };

    switch (selectedFormat) {
      case 'csv':
        return { ...baseOptions, csvOptions };
      case 'json':
        return { ...baseOptions, jsonOptions };
      case 'pdf':
        return { ...baseOptions, pdfOptions };
      case 'excel':
        return { ...baseOptions, excelOptions };
      case 'html':
        return { ...baseOptions, htmlOptions };
      default:
        return baseOptions;
    }
  }, [selectedFormat, selectedFields, includeHeaders, filename, defaultFilename, csvOptions, jsonOptions, pdfOptions, excelOptions, htmlOptions]);

  const canExport = useMemo(() => {
    return selectedFields.length > 0 && entries.length > 0 && !isExporting;
  }, [selectedFields.length, entries.length, isExporting]);

  // =====================
  // Event Handlers
  // =====================

  const handleExport = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canExport) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      await onExport(selectedFormat, exportOptions);

      clearInterval(progressInterval);
      setExportProgress(100);

      // Close dialog after brief delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);
      // Show error notification
    }
  }, [canExport, selectedFormat, exportOptions, onExport, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // =====================
  // Render
  // =====================

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Export Knowledge Base</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Export {entries.length} {entries.length === 1 ? 'entry' : 'entries'} in your preferred format
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form ref={formRef} onSubmit={handleExport} className="space-y-6">
            {/* Format Selection */}
            <FormatSelector
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />

            {/* Field Selection */}
            <FieldSelector
              selectedFields={selectedFields}
              onFieldsChange={setSelectedFields}
            />

            {/* General Options */}
            <div className="space-y-4">
              <div>
                <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-1">
                  Filename (optional)
                </label>
                <div className="flex">
                  <input
                    id="filename"
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder={defaultFilename}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-sm text-gray-500">
                    .{selectedFormat}
                  </span>
                </div>
              </div>

              {selectedFormat !== 'json' && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={includeHeaders}
                    onChange={(e) => setIncludeHeaders(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Include column headers</span>
                </label>
              )}
            </div>

            {/* Format-specific Options */}
            {selectedFormat === 'csv' && (
              <CSVOptions options={csvOptions} onChange={setCsvOptions} />
            )}

            {selectedFormat === 'pdf' && (
              <PDFOptions options={pdfOptions} onChange={setPdfOptions} />
            )}

            {selectedFormat === 'json' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">JSON Options</h4>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!jsonOptions.minified}
                      onChange={(e) => setJsonOptions({ ...jsonOptions, minified: !e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Pretty print</span>
                  </label>
                  {!jsonOptions.minified && (
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-600">Indent:</label>
                      <select
                        value={jsonOptions.indent}
                        onChange={(e) => setJsonOptions({ ...jsonOptions, indent: parseInt(e.target.value) })}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={2}>2 spaces</option>
                        <option value={4}>4 spaces</option>
                        <option value={0}>Tab</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Export Summary</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Format: <span className="font-medium">{selectedFormat.toUpperCase()}</span></div>
                <div>Entries: <span className="font-medium">{entries.length}</span></div>
                <div>Fields: <span className="font-medium">{selectedFields.length}</span></div>
                <div>Filename: <span className="font-medium">{filename || defaultFilename}.{selectedFormat}</span></div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {isExporting && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;