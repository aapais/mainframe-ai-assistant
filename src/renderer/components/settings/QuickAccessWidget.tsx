/**
 * Quick Access Widget Component for Settings Menu
 *
 * Features:
 * - Always visible at the top of Settings
 * - Shows critical status items (API Keys, Budget, Theme)
 * - Uses Accenture purple (#A100FF) for accents
 * - Fully responsive design
 * - Integrates with SettingsContext
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  DollarSign,
  Moon,
  Sun,
  Monitor,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Zap,
  Eye,
  EyeOff,
  Palette
} from 'lucide-react';
import { useSettings, useAPIKeys, useCostTracking, useUIPreferences } from '../../contexts/SettingsContext';

// ============================================================================
// INTERFACES
// ============================================================================

interface QuickStatusItem {
  id: string;
  label: string;
  value: string | number;
  status: 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactNode;
  action?: () => void;
  tooltip?: string;
}

interface BudgetProgress {
  used: number;
  total: number;
  percentage: number;
  daysRemaining: number;
}

interface APIKeyStatus {
  total: number;
  active: number;
  missing: number;
  hasErrors: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACCENTURE_COLORS = {
  purple: '#A100FF',
  darkPurple: '#8000CC',
  lightPurple: '#B833FF',
  gray: '#666666',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  success: '#28A745',
  warning: '#FFC107',
  error: '#DC3545',
  info: '#17A2B8'
};

const THEME_ICONS = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
  system: <Monitor className="w-4 h-4" />,
  'high-contrast': <Eye className="w-4 h-4" />
};

const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  'high-contrast': 'High Contrast'
};

// ============================================================================
// COMPONENT
// ============================================================================

const QuickAccessWidget: React.FC = () => {
  const { state } = useSettings();
  const { apiKeys } = useAPIKeys();
  const { costTracking } = useCostTracking();
  const { ui, updateUI } = useUIPreferences();

  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute for budget calculations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const apiKeyStatus: APIKeyStatus = React.useMemo(() => {
    const total = apiKeys.length;
    const active = apiKeys.filter(key => key.isActive).length;
    const missing = total === 0 ? 2 : Math.max(0, 2 - active); // Assume we need at least 2 keys
    const hasErrors = apiKeys.some(key => !key.isActive);

    return { total, active, missing, hasErrors };
  }, [apiKeys]);

  const budgetProgress: BudgetProgress = React.useMemo(() => {
    const used = apiKeys.reduce((sum, key) => sum + key.costThisMonth, 0);
    const total = costTracking.monthlyBudget || 100;
    const percentage = Math.min(100, (used / total) * 100);

    // Calculate days remaining in month
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.max(0, lastDay.getDate() - now.getDate());

    return { used, total, percentage, daysRemaining };
  }, [apiKeys, costTracking.monthlyBudget, currentTime]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleThemeToggle = async () => {
    const themes: Array<'light' | 'dark' | 'system' | 'high-contrast'> = ['light', 'dark', 'system', 'high-contrast'];
    const currentIndex = themes.indexOf(ui.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    await updateUI({ theme: nextTheme });
  };

  const getBudgetStatusColor = (): string => {
    if (budgetProgress.percentage >= 90) return ACCENTURE_COLORS.error;
    if (budgetProgress.percentage >= 75) return ACCENTURE_COLORS.warning;
    return ACCENTURE_COLORS.success;
  };

  const getAPIKeyStatusColor = (): string => {
    if (apiKeyStatus.missing > 0) return ACCENTURE_COLORS.error;
    if (apiKeyStatus.hasErrors) return ACCENTURE_COLORS.warning;
    return ACCENTURE_COLORS.success;
  };

  // ============================================================================
  // STATUS ITEMS
  // ============================================================================

  const statusItems: QuickStatusItem[] = [
    {
      id: 'api-keys',
      label: 'API Keys',
      value: apiKeyStatus.missing > 0
        ? `${apiKeyStatus.missing} missing`
        : `${apiKeyStatus.active}/${apiKeyStatus.total} active`,
      status: apiKeyStatus.missing > 0 ? 'error' : apiKeyStatus.hasErrors ? 'warning' : 'success',
      icon: <Key className="w-4 h-4" />,
      tooltip: apiKeyStatus.missing > 0
        ? 'Some API keys are missing or inactive'
        : 'All API keys are configured and active'
    },
    {
      id: 'budget',
      label: 'Monthly Budget',
      value: `$${budgetProgress.used.toFixed(2)}/$${budgetProgress.total}`,
      status: budgetProgress.percentage >= 90 ? 'error' :
             budgetProgress.percentage >= 75 ? 'warning' : 'success',
      icon: <DollarSign className="w-4 h-4" />,
      action: () => setShowBudgetDetails(!showBudgetDetails),
      tooltip: `${budgetProgress.percentage.toFixed(1)}% of monthly budget used`
    },
    {
      id: 'theme',
      label: 'Theme',
      value: THEME_LABELS[ui.theme],
      status: 'info',
      icon: THEME_ICONS[ui.theme],
      action: handleThemeToggle,
      tooltip: 'Click to cycle through themes'
    }
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="quick-access-widget">
      {/* Main Widget Container */}
      <div
        className="bg-white rounded-lg shadow-lg border-2 mb-6 overflow-hidden"
        style={{ borderColor: ACCENTURE_COLORS.purple }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${ACCENTURE_COLORS.purple} 0%, ${ACCENTURE_COLORS.darkPurple} 100%)`,
            color: 'white'
          }}
        >
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Quick Access</h3>
          </div>
          <div className="text-sm opacity-90">
            Status Dashboard
          </div>
        </div>

        {/* Status Items */}
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statusItems.map((item) => (
              <div
                key={item.id}
                className={`relative p-3 rounded-lg border transition-all duration-200 ${
                  item.action ? 'cursor-pointer hover:shadow-md' : ''
                }`}
                style={{
                  borderColor: item.status === 'error' ? ACCENTURE_COLORS.error :
                              item.status === 'warning' ? ACCENTURE_COLORS.warning :
                              item.status === 'success' ? ACCENTURE_COLORS.success :
                              ACCENTURE_COLORS.info,
                  backgroundColor: item.status === 'error' ? `${ACCENTURE_COLORS.error}08` :
                                  item.status === 'warning' ? `${ACCENTURE_COLORS.warning}08` :
                                  item.status === 'success' ? `${ACCENTURE_COLORS.success}08` :
                                  `${ACCENTURE_COLORS.info}08`
                }}
                onClick={item.action}
                title={item.tooltip}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="p-1.5 rounded-full"
                      style={{
                        backgroundColor: item.status === 'error' ? ACCENTURE_COLORS.error :
                                        item.status === 'warning' ? ACCENTURE_COLORS.warning :
                                        item.status === 'success' ? ACCENTURE_COLORS.success :
                                        ACCENTURE_COLORS.info,
                        color: 'white'
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {typeof item.value === 'string' ? item.value : item.value.toString()}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center">
                    {item.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {item.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                    {item.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    {item.status === 'info' && item.action && <Zap className="w-4 h-4 text-blue-500" />}
                  </div>
                </div>

                {/* Budget Progress Bar */}
                {item.id === 'budget' && (
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Usage</span>
                      <span className="text-xs font-medium" style={{ color: getBudgetStatusColor() }}>
                        {budgetProgress.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, budgetProgress.percentage)}%`,
                          backgroundColor: getBudgetStatusColor()
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Expanded Budget Details */}
          {showBudgetDetails && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800">Budget Details</h4>
                <button
                  onClick={() => setShowBudgetDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Spent</div>
                  <div className="font-semibold">${budgetProgress.used.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Remaining</div>
                  <div className="font-semibold">${(budgetProgress.total - budgetProgress.used).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Days Left</div>
                  <div className="font-semibold">{budgetProgress.daysRemaining}</div>
                </div>
                <div>
                  <div className="text-gray-500">Daily Avg</div>
                  <div className="font-semibold">
                    ${(budgetProgress.used / Math.max(1, 30 - budgetProgress.daysRemaining)).toFixed(2)}
                  </div>
                </div>
              </div>

              {budgetProgress.percentage > 80 && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium">Budget Alert</div>
                    <div>You're approaching your monthly limit. Consider reviewing API usage.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  className="text-xs px-3 py-1 rounded-full border transition-colors hover:shadow-sm"
                  style={{
                    borderColor: ACCENTURE_COLORS.purple,
                    color: ACCENTURE_COLORS.purple,
                    backgroundColor: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = ACCENTURE_COLORS.purple;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = ACCENTURE_COLORS.purple;
                  }}
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State Overlay */}
      {state.isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="flex items-center space-x-2">
            <div
              className="w-4 h-4 border-2 border-transparent rounded-full animate-spin"
              style={{
                borderTopColor: ACCENTURE_COLORS.purple,
                borderRightColor: ACCENTURE_COLORS.purple
              }}
            />
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .quick-access-widget {
          position: relative;
        }

        @media (max-width: 640px) {
          .quick-access-widget .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 1024px) {
          .quick-access-widget .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .quick-access-widget button:focus {
          outline: 2px solid ${ACCENTURE_COLORS.purple};
          outline-offset: 2px;
        }

        .quick-access-widget [title]:hover::after {
          content: attr(title);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 1000;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .quick-access-widget * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (prefers-color-scheme: dark) {
          .quick-access-widget .bg-white {
            background-color: #2d2d2d;
            color: #e5e5e5;
          }

          .quick-access-widget .bg-gray-50 {
            background-color: #404040;
          }

          .quick-access-widget .border-gray-200 {
            border-color: #555;
          }

          .quick-access-widget .text-gray-700 {
            color: #b0b0b0;
          }

          .quick-access-widget .text-gray-500 {
            color: #888;
          }
        }
      `}</style>
    </div>
  );
};

export default QuickAccessWidget;