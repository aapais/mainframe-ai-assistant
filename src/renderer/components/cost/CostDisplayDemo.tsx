import React from 'react';
import { CostDisplay, CostLimitBar, CostAlertBanner, DailyCostSummary } from './index';
import { CostLimit } from '../../../types/cost';

/**
 * Demo component showcasing all Cost Display components
 * This can be used for testing and development purposes
 */
export const CostDisplayDemo: React.FC = () => {
  // Mock limits for demonstration
  const mockDailyLimit: CostLimit = {
    daily: 20,
    monthly: 300,
    current: 16.5,
    type: 'daily'
  };

  const mockMonthlyLimit: CostLimit = {
    daily: 20,
    monthly: 300,
    current: 245.89,
    type: 'monthly'
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Cost Tracking Components</h1>
          <p className="text-gray-600">
            Comprehensive cost display components for real-time AI usage monitoring.
          </p>
        </div>

        {/* Alert Banner Demo */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Cost Alert Banner</h2>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <p className="text-gray-600 mb-4">
              Alert banners automatically appear when cost limits are approached or exceeded.
            </p>
            <CostAlertBanner position="top" />
          </div>
        </section>

        {/* Cost Display Variants */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Cost Display Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Compact Size</h3>
              <CostDisplay size="compact" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Normal Size</h3>
              <CostDisplay size="normal" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Detailed Size</h3>
              <CostDisplay size="detailed" />
            </div>
          </div>
        </section>

        {/* Cost Limit Bars */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Cost Limit Bars</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-700 mb-4">Daily Limit (82% used)</h3>
              <CostLimitBar limit={mockDailyLimit} height="md" />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-700 mb-4">Monthly Limit (78% used)</h3>
              <CostLimitBar limit={mockMonthlyLimit} height="md" />
            </div>
          </div>

          {/* Different Heights */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 mb-4">Different Bar Heights</h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Small Height</p>
                <CostLimitBar limit={mockDailyLimit} height="sm" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Medium Height</p>
                <CostLimitBar limit={mockDailyLimit} height="md" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Large Height</p>
                <CostLimitBar limit={mockDailyLimit} height="lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Daily Cost Summary */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Daily Cost Summary</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <DailyCostSummary showComparison={true} expandable={true} />
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium text-gray-700 mb-4">Features</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Real-time cost breakdown by operation type</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Day-over-day comparison with percentage change</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Average cost per operation analysis</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Expandable detailed yesterday comparison</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Operation-specific icons and categorization</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Integration Example */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Complete Integration Example</h2>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <CostDisplay size="normal" />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <CostLimitBar limit={mockDailyLimit} height="md" />
                <CostLimitBar limit={mockMonthlyLimit} height="md" />
              </div>
            </div>
          </div>
        </section>

        {/* Component Usage */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Usage Instructions</h2>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="prose max-w-none">
              <h3 className="text-lg font-medium text-gray-900">Implementation</h3>
              <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
{`import {
  CostDisplay,
  CostLimitBar,
  CostAlertBanner,
  DailyCostSummary
} from './renderer/components/cost';

// Basic usage
<CostDisplay size="normal" showTrend={true} />
<CostAlertBanner position="top" />
<DailyCostSummary showComparison={true} expandable={true} />

// With cost limit
const dailyLimit = { daily: 20, monthly: 300, current: 16.5, type: 'daily' };
<CostLimitBar limit={dailyLimit} height="md" animated={true} />`}
              </pre>

              <h3 className="text-lg font-medium text-gray-900 mt-6">Features</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Real-time cost tracking with IPC communication</li>
                <li>Responsive design with Accenture branding (#A100FF)</li>
                <li>Smooth animations and transitions</li>
                <li>Comprehensive error handling and loading states</li>
                <li>TypeScript support with full type safety</li>
                <li>Dismissible alerts with persistent memory</li>
                <li>Configurable components with multiple sizes and variants</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CostDisplayDemo;