import React, { useState, useEffect } from 'react';
import { useAICosts } from '../../hooks/useAICosts';
import { CostAlert } from '../../../types/cost';

interface CostAlertBannerProps {
  className?: string;
  position?: 'top' | 'bottom';
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const CostAlertBanner: React.FC<CostAlertBannerProps> = ({
  className = '',
  position = 'top',
  autoHide = false,
  autoHideDelay = 5000
}) => {
  const { alerts, dismissAlert, updateLimit } = useAICosts();
  const [visibleAlerts, setVisibleAlerts] = useState<CostAlert[]>([]);
  const [showIncreaseLimitModal, setShowIncreaseLimitModal] = useState<CostAlert | null>(null);

  useEffect(() => {
    setVisibleAlerts(alerts.filter(alert => !alert.dismissed));
  }, [alerts]);

  useEffect(() => {
    if (autoHide && visibleAlerts.length > 0) {
      const timer = setTimeout(() => {
        visibleAlerts.forEach(alert => {
          dismissAlert(alert.id);
        });
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [visibleAlerts, autoHide, autoHideDelay, dismissAlert]);

  const handleDismiss = (alertId: string) => {
    dismissAlert(alertId);
  };

  const handleIncreaseLimit = (alert: CostAlert) => {
    setShowIncreaseLimitModal(alert);
  };

  const handleViewDetails = (alert: CostAlert) => {
    // Navigate to cost details page or open modal
    console.log('View details for alert:', alert);
  };

  const getSeverityStyles = (severity: CostAlert['severity']) => {
    switch (severity) {
      case 'danger':
        return {
          container: 'bg-red-50 border-red-200 shadow-red-100',
          text: 'text-red-800',
          icon: 'text-red-500',
          button: 'bg-red-100 text-red-700 hover:bg-red-200'
        };
      case 'warning':
      default:
        return {
          container: 'bg-yellow-50 border-yellow-200 shadow-yellow-100',
          text: 'text-yellow-800',
          icon: 'text-yellow-500',
          button: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
        };
    }
  };

  const getSeverityIcon = (severity: CostAlert['severity']) => {
    switch (severity) {
      case 'danger':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
      default:
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  const positionClasses = position === 'top' ? 'top-4' : 'bottom-4';

  return (
    <>
      <div className={`fixed left-4 right-4 ${positionClasses} z-50 space-y-3 ${className}`}>
        {visibleAlerts.map((alert, index) => {
          const styles = getSeverityStyles(alert.severity);
          return (
            <div
              key={alert.id}
              className={`
                ${styles.container} border rounded-lg shadow-lg
                transform transition-all duration-500 ease-out
                animate-in slide-in-from-top-2 fade-in-0
                backdrop-blur-sm
              `}
              style={{
                animationDelay: `${index * 100}ms`
              }}
            >
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className={`${styles.icon} flex-shrink-0 mt-0.5`}>
                    {getSeverityIcon(alert.severity)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`${styles.text} font-medium text-sm`}>
                          {alert.message}
                        </p>
                        <div className="mt-2 flex items-center space-x-2">
                          <div className={`${styles.text} text-xs opacity-75`}>
                            {alert.percentage}% of limit used
                          </div>
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                alert.severity === 'danger' ? 'bg-red-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${Math.min(alert.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Close Button */}
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className={`${styles.text} hover:opacity-75 transition-opacity ml-4 flex-shrink-0`}
                        aria-label="Dismiss alert"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleIncreaseLimit(alert)}
                        className={`${styles.button} px-3 py-1 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          alert.severity === 'danger' ? 'focus:ring-red-500' : 'focus:ring-yellow-500'
                        }`}
                      >
                        Increase Limit
                      </button>
                      <button
                        onClick={() => handleViewDetails(alert)}
                        className={`${styles.button} px-3 py-1 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          alert.severity === 'danger' ? 'focus:ring-red-500' : 'focus:ring-yellow-500'
                        }`}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Increase Limit Modal */}
      {showIncreaseLimitModal && (
        <IncreaseLimitModal
          alert={showIncreaseLimitModal}
          onClose={() => setShowIncreaseLimitModal(null)}
          onConfirm={updateLimit}
        />
      )}
    </>
  );
};

interface IncreaseLimitModalProps {
  alert: CostAlert;
  onClose: () => void;
  onConfirm: (type: 'daily' | 'monthly', amount: number) => Promise<void>;
}

const IncreaseLimitModal: React.FC<IncreaseLimitModalProps> = ({
  alert,
  onClose,
  onConfirm
}) => {
  const [limitType, setLimitType] = useState<'daily' | 'monthly'>('daily');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    setLoading(true);
    try {
      await onConfirm(limitType, Number(amount));
      onClose();
    } catch (error) {
      console.error('Failed to update limit:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Increase Cost Limit
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limit Type
              </label>
              <select
                value={limitType}
                onChange={(e) => setLimitType(e.target.value as 'daily' | 'monthly')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A100FF] focus:border-transparent"
              >
                <option value="daily">Daily Limit</option>
                <option value="monthly">Monthly Limit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Limit Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A100FF] focus:border-transparent"
                placeholder="Enter new limit..."
                required
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !amount}
                className="px-4 py-2 text-sm font-medium text-white bg-[#A100FF] rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Limit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CostAlertBanner;