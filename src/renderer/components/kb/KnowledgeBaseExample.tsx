import React, { useState } from 'react';
import { ComprehensiveKnowledgeBase } from './ComprehensiveKnowledgeBase';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { BookOpen, FileText, Search, Star, TrendingUp } from 'lucide-react';

/**
 * Example implementation of the Comprehensive Knowledge Base
 *
 * This example demonstrates how to integrate the KB component with:
 * - Custom import/export handlers
 * - Navigation integration
 * - Statistics dashboard
 * - User settings persistence
 * - Event tracking and analytics
 */
export const KnowledgeBaseExample: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Example handlers for KB operations
  const handleCreateEntry = () => {
    setShowCreateModal(true);
    console.log('Creating new KB entry...');
  };

  const handleImport = (file: File) => {
    console.log('Importing file:', file.name);

    // Example file processing
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validate and import data
        if (Array.isArray(data) && data.length > 0) {
          console.log(`Importing ${data.length} entries...`);
          // Handle import logic here
        } else {
          alert('Invalid file format. Please select a valid JSON file.');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    console.log(`Exporting as ${format}...`);

    // Example export logic
    switch (format) {
      case 'json':
        // Export as JSON
        console.log('Exporting JSON format...');
        break;
      case 'csv':
        // Export as CSV
        console.log('Exporting CSV format...');
        break;
      case 'pdf':
        // Export as PDF report
        console.log('Generating PDF report...');
        break;
    }
  };

  const handleNavigateToEntry = (entryId: string) => {
    console.log('Navigating to entry:', entryId);
    // Example: router.push(`/kb/entry/${entryId}`);
  };

  return (
    <div className="knowledge-base-example">
      {/* Header with example navigation */}
      <div className="example-header">
        <div className="example-header__content">
          <h1 className="example-header__title">
            <BookOpen size={24} />
            Mainframe Knowledge Base
          </h1>
          <p className="example-header__description">
            Comprehensive repository of mainframe error solutions, troubleshooting guides,
            and technical documentation for IBM z/OS environments.
          </p>
        </div>

        <div className="example-header__actions">
          <Button
            onClick={() => setShowStatsModal(true)}
            variant="secondary"
            size="small"
          >
            <TrendingUp size={16} />
            Statistics
          </Button>

          <Button
            onClick={() => setShowImportModal(true)}
            variant="secondary"
            size="small"
          >
            <FileText size={16} />
            Import Data
          </Button>
        </div>
      </div>

      {/* Main Knowledge Base Component */}
      <ComprehensiveKnowledgeBase
        onCreateEntry={handleCreateEntry}
        onImport={handleImport}
        onExport={handleExport}
        onNavigateToEntry={handleNavigateToEntry}
        enableAdvancedFeatures={true}
        maxDisplayEntries={100}
        className="example-kb"
      />

      {/* Create Entry Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New KB Entry"
        size="large"
      >
        <div className="create-entry-form">
          <div className="form-section">
            <label htmlFor="entry-title" className="form-label">
              Title *
            </label>
            <Input
              id="entry-title"
              type="text"
              placeholder="Enter a descriptive title for the issue..."
              className="form-input"
            />
          </div>

          <div className="form-section">
            <label htmlFor="entry-category" className="form-label">
              Category *
            </label>
            <select id="entry-category" className="form-select">
              <option value="">Select category...</option>
              <option value="JCL">JCL</option>
              <option value="VSAM">VSAM</option>
              <option value="DB2">DB2</option>
              <option value="CICS">CICS</option>
              <option value="IMS">IMS</option>
              <option value="Batch">Batch</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-section">
            <label htmlFor="entry-problem" className="form-label">
              Problem Description *
            </label>
            <textarea
              id="entry-problem"
              rows={6}
              placeholder="Describe the problem, error messages, symptoms, and context..."
              className="form-textarea"
            />
          </div>

          <div className="form-section">
            <label htmlFor="entry-solution" className="form-label">
              Solution *
            </label>
            <textarea
              id="entry-solution"
              rows={8}
              placeholder="Provide step-by-step solution, code examples, and resolution steps..."
              className="form-textarea"
            />
          </div>

          <div className="form-section">
            <label htmlFor="entry-tags" className="form-label">
              Tags
            </label>
            <Input
              id="entry-tags"
              type="text"
              placeholder="Enter tags separated by commas (e.g., ABEND, S0C7, COBOL)..."
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <Button
              onClick={() => setShowCreateModal(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Handle form submission
                console.log('Creating new entry...');
                setShowCreateModal(false);
              }}
              variant="primary"
            >
              Create Entry
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Knowledge Base Data"
      >
        <div className="import-modal">
          <div className="import-section">
            <h3>Supported Formats</h3>
            <ul className="format-list">
              <li>
                <strong>JSON:</strong> Structured KB entries with full metadata
              </li>
              <li>
                <strong>CSV:</strong> Basic entry data (title, problem, solution, category)
              </li>
            </ul>
          </div>

          <div className="import-section">
            <h3>Sample JSON Structure</h3>
            <pre className="code-example">
{`[
  {
    "title": "S0C7 Data Exception Error",
    "problem": "ABEND occurred during processing...",
    "solution": "1. Check input data validation...",
    "category": "Batch",
    "tags": ["S0C7", "ABEND", "COBOL"]
  }
]`}
            </pre>
          </div>

          <div className="import-actions">
            <input
              type="file"
              accept=".json,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                  setShowImportModal(false);
                }
              }}
              className="file-input"
            />
          </div>
        </div>
      </Modal>

      {/* Statistics Modal */}
      <Modal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        title="Knowledge Base Statistics"
        size="large"
      >
        <div className="stats-modal">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">156</div>
              <div className="stat-label">Total Entries</div>
              <div className="stat-trend">+12 this month</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">89%</div>
              <div className="stat-label">Average Success Rate</div>
              <div className="stat-trend">+3% vs last month</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">1,247</div>
              <div className="stat-label">Total Usage</div>
              <div className="stat-trend">+156 this week</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">23</div>
              <div className="stat-label">Recent Updates</div>
              <div className="stat-trend">Last 7 days</div>
            </div>
          </div>

          <div className="category-breakdown">
            <h3>Category Distribution</h3>
            <div className="category-list">
              <div className="category-item">
                <span className="category-name">JCL</span>
                <div className="category-bar">
                  <div className="category-fill" style={{ width: '35%' }}></div>
                </div>
                <span className="category-count">54 entries</span>
              </div>
              <div className="category-item">
                <span className="category-name">VSAM</span>
                <div className="category-bar">
                  <div className="category-fill" style={{ width: '28%' }}></div>
                </div>
                <span className="category-count">44 entries</span>
              </div>
              <div className="category-item">
                <span className="category-name">DB2</span>
                <div className="category-bar">
                  <div className="category-fill" style={{ width: '22%' }}></div>
                </div>
                <span className="category-count">34 entries</span>
              </div>
              <div className="category-item">
                <span className="category-name">CICS</span>
                <div className="category-bar">
                  <div className="category-fill" style={{ width: '15%' }}></div>
                </div>
                <span className="category-count">24 entries</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <style jsx>{`
        .knowledge-base-example {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--color-background-subtle);
        }

        .example-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 2rem;
          background: var(--color-background);
          border-bottom: 1px solid var(--color-border);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .example-header__content {
          flex: 1;
        }

        .example-header__title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 0 0 0.5rem 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .example-header__description {
          margin: 0;
          color: var(--color-text-secondary);
          line-height: 1.5;
          max-width: 600px;
        }

        .example-header__actions {
          display: flex;
          gap: 0.75rem;
        }

        .example-kb {
          flex: 1;
          overflow: hidden;
        }

        .create-entry-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 0.5rem 0;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-weight: 500;
          color: var(--color-text-primary);
          font-size: 0.875rem;
        }

        .form-input,
        .form-select,
        .form-textarea {
          padding: 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: var(--color-background);
          color: var(--color-text-primary);
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 2px var(--color-primary-subtle);
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
          font-family: inherit;
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
        }

        .import-modal {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .import-section h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .format-list {
          margin: 0;
          padding-left: 1.25rem;
          color: var(--color-text-secondary);
        }

        .format-list li {
          margin-bottom: 0.5rem;
        }

        .code-example {
          background: var(--color-muted);
          padding: 1rem;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          overflow-x: auto;
          border: 1px solid var(--color-border);
        }

        .file-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px dashed var(--color-border);
          border-radius: 0.375rem;
          cursor: pointer;
          background: var(--color-background-subtle);
        }

        .stats-modal {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .stat-card {
          padding: 1.5rem;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          text-align: center;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-weight: 500;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .stat-trend {
          font-size: 0.75rem;
          color: var(--color-success);
        }

        .category-breakdown h3 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .category-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .category-item {
          display: grid;
          grid-template-columns: 80px 1fr 80px;
          align-items: center;
          gap: 1rem;
        }

        .category-name {
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .category-bar {
          height: 8px;
          background: var(--color-muted);
          border-radius: 4px;
          overflow: hidden;
        }

        .category-fill {
          height: 100%;
          background: var(--color-primary);
          transition: width 0.3s ease;
        }

        .category-count {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          text-align: right;
        }

        @media (max-width: 768px) {
          .example-header {
            flex-direction: column;
            gap: 1rem;
            padding: 1rem;
          }

          .example-header__actions {
            align-self: stretch;
            justify-content: center;
          }

          .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .category-item {
            grid-template-columns: 60px 1fr 60px;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
};