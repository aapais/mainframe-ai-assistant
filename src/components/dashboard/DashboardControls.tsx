import React, { useState } from 'react';
import { DashboardConfig } from '../../types/performance';

interface DashboardControlsProps {
  config: DashboardConfig;
  onConfigChange: (newConfig: Partial<DashboardConfig>) => void;
  isConnected: boolean;
}

export const DashboardControls: React.FC<DashboardControlsProps> = ({
  config,
  onConfigChange,
  isConnected
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleMetricsChange = (metrics: string[]) => {
    onConfigChange({ metrics });
  };

  const availableMetrics = [
    { id: 'response_time', label: 'Response Time' },
    { id: 'throughput', label: 'Throughput' },
    { id: 'memory_usage', label: 'Memory Usage' },
    { id: 'cpu_usage', label: 'CPU Usage' },
    { id: 'error_rate', label: 'Error Rate' },
    { id: 'cache_hit_rate', label: 'Cache Hit Rate' },
    { id: 'disk_io', label: 'Disk I/O' },
    { id: 'network_io', label: 'Network I/O' },
    { id: 'active_connections', label: 'Active Connections' },
    { id: 'queue_depth', label: 'Queue Depth' }
  ];

  return (
    <div className="dashboard-controls">
      {/* Quick Controls */}
      <div className="quick-controls">
        {/* Time Range Selector */}
        <div className="control-group">
          <label>Time Range:</label>
          <select
            value={config.timeRange}
            onChange={(e) => onConfigChange({ timeRange: e.target.value as any })}
            className="time-range-select"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Layout Selector */}
        <div className="control-group">
          <label>Layout:</label>
          <div className="layout-buttons">
            <button
              className={`layout-btn ${config.layout === 'grid' ? 'active' : ''}`}
              onClick={() => onConfigChange({ layout: 'grid' })}
              title="Grid Layout"
            >
              ⊞
            </button>
            <button
              className={`layout-btn ${config.layout === 'list' ? 'active' : ''}`}
              onClick={() => onConfigChange({ layout: 'list' })}
              title="List Layout"
            >
              ☰
            </button>
            <button
              className={`layout-btn ${config.layout === 'compact' ? 'active' : ''}`}
              onClick={() => onConfigChange({ layout: 'compact' })}
              title="Compact Layout"
            >
              ▢
            </button>
          </div>
        </div>

        {/* Realtime Toggle */}
        <div className="control-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={config.enableRealtime}
              onChange={(e) => onConfigChange({ enableRealtime: e.target.checked })}
              className="realtime-toggle"
            />
            <span className="toggle-slider"></span>
            Real-time
          </label>
        </div>

        {/* Refresh Interval */}
        {!config.enableRealtime && (
          <div className="control-group">
            <label>Refresh:</label>
            <select
              value={config.refreshInterval}
              onChange={(e) => onConfigChange({ refreshInterval: Number(e.target.value) })}
              className="refresh-select"
            >
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
              <option value={300000}>5m</option>
            </select>
          </div>
        )}

        {/* Settings Button */}
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Dashboard Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Advanced Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h4>Dashboard Settings</h4>
            <button
              className="close-settings"
              onClick={() => setShowSettings(false)}
            >
              ×
            </button>
          </div>

          <div className="settings-content">
            {/* Metrics Selection */}
            <div className="settings-section">
              <h5>Displayed Metrics</h5>
              <div className="metrics-grid">
                {availableMetrics.map(metric => (
                  <label key={metric.id} className="metric-checkbox">
                    <input
                      type="checkbox"
                      checked={config.metrics.includes(metric.id)}
                      onChange={(e) => {
                        const newMetrics = e.target.checked
                          ? [...config.metrics, metric.id]
                          : config.metrics.filter(m => m !== metric.id);
                        handleMetricsChange(newMetrics);
                      }}
                    />
                    <span className="checkbox-label">{metric.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div className="settings-section">
              <h5>Theme</h5>
              <div className="theme-buttons">
                <button
                  className={`theme-btn ${config.theme === 'light' ? 'active' : ''}`}
                  onClick={() => onConfigChange({ theme: 'light' })}
                >
                  ☀️ Light
                </button>
                <button
                  className={`theme-btn ${config.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => onConfigChange({ theme: 'dark' })}
                >
                  🌙 Dark
                </button>
                <button
                  className={`theme-btn ${config.theme === 'auto' ? 'active' : ''}`}
                  onClick={() => onConfigChange({ theme: 'auto' })}
                >
                  🔄 Auto
                </button>
              </div>
            </div>

            {/* Alerts Configuration */}
            <div className="settings-section">
              <h5>Alerts & Notifications</h5>
              <div className="alert-settings">
                <label className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={config.alertsEnabled}
                    onChange={(e) => onConfigChange({ alertsEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                  Enable Alerts
                </label>
              </div>
            </div>

            {/* Connection Status */}
            <div className="settings-section">
              <h5>Connection Status</h5>
              <div className="connection-info">
                <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                  <span className="status-indicator">
                    {isConnected ? '🟢' : '🔴'}
                  </span>
                  <span className="status-text">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {config.enableRealtime && (
                  <div className="realtime-status">
                    <span className="realtime-indicator">⚡</span>
                    <span>Real-time updates enabled</span>
                  </div>
                )}
              </div>
            </div>

            {/* Export/Import */}
            <div className="settings-section">
              <h5>Configuration</h5>
              <div className="config-actions">
                <button
                  className="export-btn"
                  onClick={() => {
                    const configJson = JSON.stringify(config, null, 2);
                    const blob = new Blob([configJson], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'dashboard-config.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  📥 Export Config
                </button>

                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const importedConfig = JSON.parse(event.target?.result as string);
                          onConfigChange(importedConfig);
                        } catch (error) {
                          console.error('Failed to import config:', error);
                          alert('Invalid configuration file');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  style={{ display: 'none' }}
                  id="config-import"
                />
                <label htmlFor="config-import" className="import-btn">
                  📤 Import Config
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard-controls {
          position: relative;
        }

        .quick-controls {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .control-group label {
          color: var(--text-secondary);
          font-weight: 500;
          white-space: nowrap;
        }

        .time-range-select, .refresh-select {
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 0.875rem;
          min-width: 120px;
        }

        .layout-buttons {
          display: flex;
          gap: 0.25rem;
        }

        .layout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 1rem;
        }

        .layout-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
        }

        .layout-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .realtime-toggle {
          display: none;
        }

        .toggle-slider {
          position: relative;
          width: 40px;
          height: 20px;
          background: var(--border-color);
          border-radius: 20px;
          transition: background 0.2s ease;
        }

        .toggle-slider::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }

        .realtime-toggle:checked + .toggle-slider {
          background: var(--color-primary);
        }

        .realtime-toggle:checked + .toggle-slider::before {
          transform: translateX(20px);
        }

        .settings-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 1.1rem;
        }

        .settings-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
          transform: rotate(90deg);
        }

        .settings-panel {
          position: absolute;
          top: 100%;
          right: 0;
          width: 400px;
          max-width: 90vw;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          margin-top: 0.5rem;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .settings-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .close-settings {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 1.5rem;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-settings:hover {
          color: var(--text-primary);
        }

        .settings-content {
          max-height: 60vh;
          overflow-y: auto;
          padding: 1rem 1.25rem;
        }

        .settings-section {
          margin-bottom: 1.5rem;
        }

        .settings-section:last-child {
          margin-bottom: 0;
        }

        .settings-section h5 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
        }

        .metric-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .metric-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }

        .checkbox-label {
          color: var(--text-primary);
        }

        .theme-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .theme-btn {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.875rem;
        }

        .theme-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
        }

        .theme-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .alert-settings {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .setting-toggle {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .setting-toggle input[type="checkbox"] {
          display: none;
        }

        .connection-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .connection-status.connected .status-text {
          color: var(--color-success);
        }

        .connection-status.disconnected .status-text {
          color: var(--color-error);
        }

        .realtime-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--color-primary);
        }

        .config-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .export-btn, .import-btn {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.875rem;
          text-decoration: none;
          display: inline-block;
        }

        .export-btn:hover, .import-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
        }
      `}</style>
    </div>
  );
};

export default DashboardControls;