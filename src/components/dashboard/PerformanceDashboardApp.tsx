import React, { useState, useEffect } from 'react';
import { RealTimeDashboard } from './RealTimeDashboard';
import { RegressionAnalysis } from '../regression/RegressionAnalysis';
import { PerformanceBudgets } from '../budgets/PerformanceBudgets';
import { DashboardConfig } from '../../types/performance';

interface PerformanceDashboardAppProps {
  performanceService: any;
  initialTab?: 'dashboard' | 'regression' | 'budgets';
  className?: string;
}

export const PerformanceDashboardApp: React.FC<PerformanceDashboardAppProps> = ({
  performanceService,
  initialTab = 'dashboard',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({
    refreshInterval: 5000,
    timeRange: '1h',
    metrics: ['response_time', 'throughput', 'memory_usage', 'error_rate'],
    layout: 'grid',
    theme: 'light',
    enableRealtime: true,
    alertsEnabled: true
  });

  // Load saved configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await performanceService.getDashboardConfig();
        setDashboardConfig(savedConfig);
      } catch (error) {
        console.warn('Failed to load dashboard config, using defaults:', error);
      }
    };

    loadConfig();
  }, [performanceService]);

  const tabs = [
    {
      id: 'dashboard',
      label: 'Real-time Dashboard',
      icon: '📊',
      description: 'Live performance metrics and alerts'
    },
    {
      id: 'regression',
      label: 'Regression Analysis',
      icon: '📉',
      description: 'Performance regression detection and analysis'
    },
    {
      id: 'budgets',
      label: 'Performance Budgets',
      icon: '💰',
      description: 'Performance budget monitoring and management'
    }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <RealTimeDashboard
            performanceService={performanceService}
            initialConfig={dashboardConfig}
            className="dashboard-content"
          />
        );

      case 'regression':
        return (
          <RegressionAnalysis
            performanceService={performanceService}
            timeRange={dashboardConfig.timeRange}
            metrics={dashboardConfig.metrics}
            onRegressionSelect={(regression) => {
              console.log('Regression selected:', regression);
              // Could navigate to detailed view or show modal
            }}
          />
        );

      case 'budgets':
        return (
          <PerformanceBudgets
            performanceService={performanceService}
            onBudgetCreate={(budget) => {
              console.log('Budget created:', budget);
              // Could show success notification
            }}
            onBudgetUpdate={(budget) => {
              console.log('Budget updated:', budget);
              // Could show success notification
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`performance-dashboard-app ${dashboardConfig.theme} ${className}`}>
      {/* App Header */}
      <div className="app-header">
        <div className="header-content">
          <div className="app-title">
            <h1>Performance Monitoring Center</h1>
            <p>Real-time performance monitoring, regression analysis, and budget management</p>
          </div>

          <div className="app-meta">
            <div className="theme-indicator">
              {dashboardConfig.theme === 'light' ? '☀️' : dashboardConfig.theme === 'dark' ? '🌙' : '🔄'}
            </div>
            <div className="realtime-indicator">
              {dashboardConfig.enableRealtime ? '⚡ Real-time' : '🔄 Polling'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="tab-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              title={tab.description}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="app-content">
        {renderActiveTab()}
      </div>

      {/* App Footer */}
      <div className="app-footer">
        <div className="footer-content">
          <div className="footer-stats">
            <span>Performance monitoring powered by advanced analytics</span>
          </div>
          <div className="footer-links">
            <button
              onClick={() => window.open('/docs/performance-monitoring', '_blank')}
              className="footer-link"
            >
              📖 Documentation
            </button>
            <button
              onClick={() => window.open('/api/performance/health', '_blank')}
              className="footer-link"
            >
              🔍 API Health
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .performance-dashboard-app {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
        }

        .performance-dashboard-app.light {
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
          --bg-tertiary: #f1f5f9;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --border-color: #e2e8f0;
          --color-primary: #3b82f6;
          --color-primary-dark: #2563eb;
          --color-success: #10b981;
          --color-warning: #f59e0b;
          --color-error: #ef4444;
        }

        .performance-dashboard-app.dark {
          --bg-primary: #0f172a;
          --bg-secondary: #1e293b;
          --bg-tertiary: #334155;
          --text-primary: #f8fafc;
          --text-secondary: #cbd5e1;
          --border-color: #475569;
          --color-primary: #60a5fa;
          --color-primary-dark: #3b82f6;
          --color-success: #34d399;
          --color-warning: #fbbf24;
          --color-error: #f87171;
        }

        .performance-dashboard-app.auto {
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
          --bg-tertiary: #f1f5f9;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --border-color: #e2e8f0;
          --color-primary: #3b82f6;
          --color-primary-dark: #2563eb;
          --color-success: #10b981;
          --color-warning: #f59e0b;
          --color-error: #ef4444;
        }

        @media (prefers-color-scheme: dark) {
          .performance-dashboard-app.auto {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --border-color: #475569;
            --color-primary: #60a5fa;
            --color-primary-dark: #3b82f6;
            --color-success: #34d399;
            --color-warning: #fbbf24;
            --color-error: #f87171;
          }
        }

        .app-header {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
        }

        .app-title h1 {
          margin: 0 0 0.25rem 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .app-title p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .app-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .theme-indicator, .realtime-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-tertiary);
          border-radius: 20px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .tab-navigation {
          display: flex;
          padding: 0 2rem;
          gap: 0.25rem;
          background: var(--bg-primary);
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: none;
          border: none;
          border-radius: 8px 8px 0 0;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.875rem;
          font-weight: 500;
          position: relative;
        }

        .tab-button:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        .tab-button.active {
          color: var(--color-primary);
          background: var(--bg-primary);
          border-bottom: 2px solid var(--color-primary);
        }

        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-primary);
        }

        .tab-icon {
          font-size: 1rem;
        }

        .tab-label {
          white-space: nowrap;
        }

        .app-content {
          flex: 1;
          padding: 2rem;
          overflow: auto;
        }

        .dashboard-content {
          height: 100%;
        }

        .app-footer {
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          padding: 1rem 2rem;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-stats {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .footer-links {
          display: flex;
          gap: 1rem;
        }

        .footer-link {
          background: none;
          border: none;
          color: var(--color-primary);
          cursor: pointer;
          font-size: 0.8rem;
          text-decoration: underline;
        }

        .footer-link:hover {
          color: var(--color-primary-dark);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
            padding: 1rem;
          }

          .app-meta {
            order: -1;
            align-self: stretch;
            justify-content: space-between;
          }

          .tab-navigation {
            padding: 0 1rem;
            overflow-x: auto;
            white-space: nowrap;
          }

          .tab-button {
            flex-shrink: 0;
          }

          .app-content {
            padding: 1rem;
          }

          .footer-content {
            flex-direction: column;
            gap: 0.75rem;
            align-items: center;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .app-title h1 {
            font-size: 1.5rem;
          }

          .tab-button .tab-label {
            display: none;
          }

          .tab-button {
            padding: 0.75rem;
          }
        }

        /* Print Styles */
        @media print {
          .app-header, .app-footer {
            display: none;
          }

          .app-content {
            padding: 0;
          }

          .performance-dashboard-app {
            background: white;
            color: black;
          }
        }

        /* High Contrast Mode */
        @media (prefers-contrast: high) {
          .performance-dashboard-app {
            --border-color: #000000;
            --text-secondary: #000000;
          }

          .tab-button.active {
            background: #000000;
            color: #ffffff;
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .tab-button,
          .footer-link {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

export default PerformanceDashboardApp;