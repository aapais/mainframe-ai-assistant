import React, { useState, useEffect, useMemo } from 'react';
import { PerformanceBudget } from '../../types/performance';

interface PerformanceBudgetsProps {
  performanceService: any;
  team?: string;
  onBudgetCreate?: (budget: PerformanceBudget) => void;
  onBudgetUpdate?: (budget: PerformanceBudget) => void;
}

interface BudgetItemProps {
  budget: PerformanceBudget;
  onEdit: () => void;
  onCheck: () => void;
}

interface BudgetFormProps {
  budget?: PerformanceBudget;
  onSave: (budget: Omit<PerformanceBudget, 'id' | 'lastCheck'>) => void;
  onCancel: () => void;
}

const BudgetForm: React.FC<BudgetFormProps> = ({ budget, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: budget?.name || '',
    environment: budget?.environment || 'production',
    team: budget?.team || '',
    metrics: budget?.metrics || [{ metricName: '', threshold: 0, unit: '' }]
  });

  const handleMetricChange = (index: number, field: string, value: any) => {
    const newMetrics = [...formData.metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };
    setFormData({ ...formData, metrics: newMetrics });
  };

  const addMetric = () => {
    setFormData({
      ...formData,
      metrics: [...formData.metrics, { metricName: '', threshold: 0, unit: '' }]
    });
  };

  const removeMetric = (index: number) => {
    const newMetrics = formData.metrics.filter((_, i) => i !== index);
    setFormData({ ...formData, metrics: newMetrics });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      environment: formData.environment,
      team: formData.team,
      metrics: formData.metrics.filter(m => m.metricName && m.threshold),
      status: 'passing'
    });
  };

  const metricOptions = [
    { value: 'response_time', label: 'Response Time', units: ['ms', 's'] },
    { value: 'throughput', label: 'Throughput', units: ['rps', 'ops/sec'] },
    { value: 'memory_usage', label: 'Memory Usage', units: ['MB', 'GB', '%'] },
    { value: 'cpu_usage', label: 'CPU Usage', units: ['%'] },
    { value: 'error_rate', label: 'Error Rate', units: ['%'] },
    { value: 'cache_hit_rate', label: 'Cache Hit Rate', units: ['%'] },
    { value: 'disk_io', label: 'Disk I/O', units: ['MB/s', 'ops/sec'] },
    { value: 'network_io', label: 'Network I/O', units: ['MB/s', 'packets/sec'] }
  ];

  return (
    <div className="budget-form-overlay">
      <div className="budget-form">
        <div className="form-header">
          <h3>{budget ? 'Edit' : 'Create'} Performance Budget</h3>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-group">
              <label>Budget Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Homepage Performance Budget"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Environment</label>
                <select
                  value={formData.environment}
                  onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>

              <div className="form-group">
                <label>Team</label>
                <input
                  type="text"
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  placeholder="e.g., Frontend Team"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h4>Performance Metrics</h4>
              <button type="button" onClick={addMetric} className="add-metric-btn">
                + Add Metric
              </button>
            </div>

            <div className="metrics-list">
              {formData.metrics.map((metric, index) => (
                <div key={index} className="metric-row">
                  <div className="metric-fields">
                    <div className="field-group">
                      <label>Metric</label>
                      <select
                        value={metric.metricName}
                        onChange={(e) => handleMetricChange(index, 'metricName', e.target.value)}
                        required
                      >
                        <option value="">Select Metric</option>
                        {metricOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label>Threshold</label>
                      <input
                        type="number"
                        value={metric.threshold}
                        onChange={(e) => handleMetricChange(index, 'threshold', Number(e.target.value))}
                        placeholder="0"
                        min="0"
                        step="0.1"
                        required
                      />
                    </div>

                    <div className="field-group">
                      <label>Unit</label>
                      <select
                        value={metric.unit}
                        onChange={(e) => handleMetricChange(index, 'unit', e.target.value)}
                        required
                      >
                        <option value="">Select Unit</option>
                        {metric.metricName && metricOptions
                          .find(opt => opt.value === metric.metricName)?.units
                          .map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {formData.metrics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMetric(index)}
                      className="remove-metric-btn"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn">
              {budget ? 'Update' : 'Create'} Budget
            </button>
          </div>
        </form>

        <style jsx>{`
          .budget-form-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .budget-form {
            background: var(--bg-primary);
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }

          .form-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-secondary);
          }

          .form-header h3 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
          }

          .close-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 1.5rem;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }

          .close-btn:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
          }

          form {
            padding: 1.5rem;
          }

          .form-section {
            margin-bottom: 2rem;
          }

          .form-section:last-of-type {
            margin-bottom: 1rem;
          }

          .form-group {
            margin-bottom: 1rem;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }

          .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
          }

          .form-group input, .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 0.875rem;
          }

          .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: var(--color-primary);
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          }

          .section-header h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
          }

          .add-metric-btn {
            padding: 0.5rem 0.75rem;
            background: var(--color-primary);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .add-metric-btn:hover {
            background: var(--color-primary-dark);
          }

          .metrics-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .metric-row {
            display: flex;
            align-items: flex-end;
            gap: 1rem;
            padding: 1rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
          }

          .metric-fields {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            gap: 1rem;
            flex: 1;
          }

          .field-group {
            display: flex;
            flex-direction: column;
          }

          .field-group label {
            margin-bottom: 0.5rem;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-secondary);
          }

          .field-group input, .field-group select {
            padding: 0.5rem;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: 0.875rem;
          }

          .remove-metric-btn {
            width: 32px;
            height: 32px;
            border: 1px solid var(--color-error);
            border-radius: 4px;
            background: var(--bg-primary);
            color: var(--color-error);
            cursor: pointer;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .remove-metric-btn:hover {
            background: var(--color-error);
            color: white;
          }

          .form-actions {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            padding-top: 1rem;
            border-top: 1px solid var(--border-color);
          }

          .cancel-btn, .save-btn {
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
          }

          .cancel-btn {
            background: var(--bg-secondary);
            color: var(--text-secondary);
            border: 1px solid var(--border-color);
          }

          .cancel-btn:hover {
            background: var(--bg-tertiary);
          }

          .save-btn {
            background: var(--color-primary);
            color: white;
            border: 1px solid var(--color-primary);
          }

          .save-btn:hover {
            background: var(--color-primary-dark);
          }
        `}</style>
      </div>
    </div>
  );
};

const BudgetItem: React.FC<BudgetItemProps> = ({ budget, onEdit, onCheck }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passing': return '#10b981';
      case 'failing': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passing': return '✅';
      case 'failing': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  };

  const formatLastCheck = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 24 * 60) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={`budget-item status-${budget.status}`}>
      <div className="budget-header">
        <div className="budget-main">
          <div className="budget-status">
            <span className="status-icon">{getStatusIcon(budget.status)}</span>
            <span className="status-text" style={{ color: getStatusColor(budget.status) }}>
              {budget.status.toUpperCase()}
            </span>
          </div>

          <div className="budget-info">
            <h4 className="budget-name">{budget.name}</h4>
            <div className="budget-meta">
              <span className="budget-env">{budget.environment}</span>
              <span className="budget-team">{budget.team}</span>
              <span className="budget-metrics">{budget.metrics.length} metrics</span>
            </div>
          </div>
        </div>

        <div className="budget-actions">
          <span className="last-check">
            Last check: {formatLastCheck(budget.lastCheck)}
          </span>
          <div className="action-buttons">
            <button onClick={onCheck} className="check-btn" title="Run Budget Check">
              🔄
            </button>
            <button onClick={onEdit} className="edit-btn" title="Edit Budget">
              ✏️
            </button>
          </div>
        </div>
      </div>

      <div className="budget-metrics">
        {budget.metrics.map((metric, index) => (
          <div key={index} className="metric-item">
            <span className="metric-name">{metric.metricName}</span>
            <span className="metric-threshold">
              ≤ {metric.threshold} {metric.unit}
            </span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .budget-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 4px solid ${getStatusColor(budget.status)};
          border-radius: 8px;
          margin-bottom: 1rem;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .budget-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .budget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem;
        }

        .budget-main {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .budget-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 100px;
        }

        .status-icon {
          font-size: 1.2rem;
        }

        .status-text {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .budget-info {
          flex: 1;
        }

        .budget-name {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .budget-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .budget-env {
          background: var(--bg-tertiary);
          padding: 0.2rem 0.4rem;
          border-radius: 12px;
          text-transform: capitalize;
        }

        .budget-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .last-check {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .check-btn, .edit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-primary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.9rem;
        }

        .check-btn:hover {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .edit-btn:hover {
          background: var(--color-warning);
          color: white;
          border-color: var(--color-warning);
        }

        .budget-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
        }

        .metric-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .metric-name {
          color: var(--text-primary);
          font-weight: 500;
          text-transform: capitalize;
        }

        .metric-threshold {
          color: var(--text-secondary);
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};

export const PerformanceBudgets: React.FC<PerformanceBudgetsProps> = ({
  performanceService,
  team,
  onBudgetCreate,
  onBudgetUpdate
}) => {
  const [budgets, setBudgets] = useState<PerformanceBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<PerformanceBudget | null>(null);
  const [filter, setFilter] = useState<'all' | 'passing' | 'failing' | 'warning'>('all');

  useEffect(() => {
    loadBudgets();
  }, [performanceService, team]);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const data = await performanceService.getBudgets(team);
      setBudgets(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load budgets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = useMemo(() => {
    if (filter === 'all') return budgets;
    return budgets.filter(budget => budget.status === filter);
  }, [budgets, filter]);

  const budgetStats = useMemo(() => {
    return budgets.reduce((stats, budget) => {
      stats.total = (stats.total || 0) + 1;
      stats[budget.status] = (stats[budget.status] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
  }, [budgets]);

  const handleCreateBudget = async (budgetData: Omit<PerformanceBudget, 'id' | 'lastCheck'>) => {
    try {
      const newBudget = await performanceService.createBudget(budgetData);
      setBudgets(prev => [newBudget, ...prev]);
      setShowForm(false);
      onBudgetCreate?.(newBudget);
    } catch (err) {
      console.error('Failed to create budget:', err);
      setError(err.message);
    }
  };

  const handleUpdateBudget = async (budgetData: Omit<PerformanceBudget, 'id' | 'lastCheck'>) => {
    if (!editingBudget) return;

    try {
      const updatedBudget = { ...editingBudget, ...budgetData };
      setBudgets(prev => prev.map(b => b.id === editingBudget.id ? updatedBudget : b));
      setEditingBudget(null);
      setShowForm(false);
      onBudgetUpdate?.(updatedBudget);
    } catch (err) {
      console.error('Failed to update budget:', err);
      setError(err.message);
    }
  };

  const handleCheckBudget = async (budgetId: string) => {
    try {
      const updatedBudgets = await performanceService.checkBudgets();
      const updatedBudget = updatedBudgets.find(b => b.id === budgetId);
      if (updatedBudget) {
        setBudgets(prev => prev.map(b => b.id === budgetId ? updatedBudget : b));
      }
    } catch (err) {
      console.error('Failed to check budget:', err);
      setError(err.message);
    }
  };

  const handleCheckAllBudgets = async () => {
    try {
      const updatedBudgets = await performanceService.checkBudgets();
      setBudgets(updatedBudgets);
    } catch (err) {
      console.error('Failed to check all budgets:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="performance-budgets loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading performance budgets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-budgets">
      <div className="budgets-header">
        <h2>Performance Budgets</h2>

        <div className="budget-stats">
          <div className="stat-item">
            <span className="stat-value">{budgetStats.total || 0}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item passing">
            <span className="stat-value">{budgetStats.passing || 0}</span>
            <span className="stat-label">Passing</span>
          </div>
          <div className="stat-item failing">
            <span className="stat-value">{budgetStats.failing || 0}</span>
            <span className="stat-label">Failing</span>
          </div>
          <div className="stat-item warning">
            <span className="stat-value">{budgetStats.warning || 0}</span>
            <span className="stat-label">Warning</span>
          </div>
        </div>
      </div>

      <div className="budgets-controls">
        <div className="filter-controls">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All Budgets</option>
            <option value="passing">Passing Only</option>
            <option value="failing">Failing Only</option>
            <option value="warning">Warning Only</option>
          </select>
        </div>

        <div className="action-controls">
          <button onClick={handleCheckAllBudgets} className="check-all-btn">
            🔄 Check All
          </button>
          <button onClick={() => setShowForm(true)} className="create-btn">
            + Create Budget
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="budgets-list">
        {filteredBudgets.length === 0 ? (
          <div className="no-budgets">
            <span className="no-budgets-icon">💰</span>
            <h3>No performance budgets found</h3>
            <p>Create your first performance budget to start monitoring your application's performance against defined thresholds.</p>
            <button onClick={() => setShowForm(true)} className="create-first-btn">
              Create First Budget
            </button>
          </div>
        ) : (
          filteredBudgets.map(budget => (
            <BudgetItem
              key={budget.id}
              budget={budget}
              onEdit={() => {
                setEditingBudget(budget);
                setShowForm(true);
              }}
              onCheck={() => handleCheckBudget(budget.id)}
            />
          ))
        )}
      </div>

      {showForm && (
        <BudgetForm
          budget={editingBudget}
          onSave={editingBudget ? handleUpdateBudget : handleCreateBudget}
          onCancel={() => {
            setShowForm(false);
            setEditingBudget(null);
          }}
        />
      )}

      <style jsx>{`
        .performance-budgets {
          background: var(--bg-primary);
          border-radius: 8px;
          overflow: hidden;
        }

        .budgets-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .budgets-header h2 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .budget-stats {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--bg-tertiary);
          border-radius: 8px;
          min-width: 80px;
        }

        .stat-item.passing {
          background: #f0fdf4;
          color: #10b981;
        }

        .stat-item.failing {
          background: #fef2f2;
          color: #ef4444;
        }

        .stat-item.warning {
          background: #fffbeb;
          color: #f59e0b;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }

        .budgets-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }

        .filter-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .filter-controls label {
          color: var(--text-secondary);
          font-weight: 500;
        }

        .filter-controls select {
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .action-controls {
          display: flex;
          gap: 0.75rem;
        }

        .check-all-btn, .create-btn {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .check-all-btn {
          background: var(--bg-primary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .check-all-btn:hover {
          background: var(--bg-secondary);
          border-color: var(--color-primary);
        }

        .create-btn {
          background: var(--color-primary);
          color: white;
          border: 1px solid var(--color-primary);
        }

        .create-btn:hover {
          background: var(--color-primary-dark);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          background: #fef2f2;
          color: #ef4444;
          border-bottom: 1px solid var(--border-color);
        }

        .error-banner button {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 1.2rem;
          margin-left: auto;
        }

        .budgets-list {
          padding: 1.5rem;
          max-height: 800px;
          overflow-y: auto;
        }

        .no-budgets {
          text-align: center;
          padding: 3rem 2rem;
          color: var(--text-secondary);
        }

        .no-budgets-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .no-budgets h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-primary);
          font-size: 1.25rem;
        }

        .no-budgets p {
          margin: 0 0 1.5rem 0;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .create-first-btn {
          padding: 0.75rem 1.5rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--border-color);
          border-top: 4px solid var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PerformanceBudgets;