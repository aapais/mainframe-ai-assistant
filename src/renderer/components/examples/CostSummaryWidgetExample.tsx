/**
 * Cost Summary Widget Example - TASK-005 Implementation
 *
 * Example component demonstrating how to use the Cost Summary Widget
 * in different dashboard layouts and configurations
 */

import React, { useState } from 'react';
import { CostSummaryWidget } from '../dashboard';
import { SettingsProvider } from '../../contexts/SettingsContext';

// ============================================================================
// EXAMPLE COMPONENT
// ============================================================================

const CostSummaryWidgetExample: React.FC = () => {
  const [showCompactGrid, setShowCompactGrid] = useState(true);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);

  return (
    <SettingsProvider>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg border p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Cost Summary Widget Examples
            </h1>
            <p className="text-gray-600 mb-4">
              Demonstration of the Cost Summary Dashboard Widget in various configurations
            </p>

            {/* Controls */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showCompactGrid}
                  onChange={(e) => setShowCompactGrid(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Show Compact Grid Layout
                </span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={realTimeUpdates}
                  onChange={(e) => setRealTimeUpdates(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enable Real-time Updates
                </span>
              </label>
            </div>
          </div>

          {/* Compact Grid Layout */}
          {showCompactGrid && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Compact Dashboard Grid
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Standard Compact Widget */}
                <CostSummaryWidget
                  userId="user1"
                  compact={true}
                  realTimeUpdates={realTimeUpdates}
                  updateInterval={10000}
                  showDetailedMetrics={true}
                  enableQuickActions={true}
                  onAIToggle={(enabled) => console.log('AI Operations:', enabled)}
                  onModalOpen={() => console.log('Modal opened')}
                  onModalClose={() => console.log('Modal closed')}
                />

                {/* Minimal Compact Widget */}
                <CostSummaryWidget
                  userId="user2"
                  compact={true}
                  realTimeUpdates={realTimeUpdates}
                  updateInterval={15000}
                  showDetailedMetrics={false}
                  enableQuickActions={false}
                  className="border-2 border-blue-200"
                />

                {/* Quick Actions Focused Widget */}
                <CostSummaryWidget
                  userId="user3"
                  compact={true}
                  realTimeUpdates={realTimeUpdates}
                  updateInterval={5000}
                  showDetailedMetrics={true}
                  enableQuickActions={true}
                  className="border-2 border-green-200"
                />
              </div>
            </div>
          )}

          {/* Full-Width Layout */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Full-Width Dashboard Layout
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Standard Full Widget */}
              <CostSummaryWidget
                userId="user4"
                compact={false}
                realTimeUpdates={realTimeUpdates}
                updateInterval={20000}
                showDetailedMetrics={true}
                enableQuickActions={true}
                className="col-span-1"
              />

              {/* Detailed Widget */}
              <div className="space-y-4">
                <CostSummaryWidget
                  userId="user5"
                  compact={true}
                  realTimeUpdates={realTimeUpdates}
                  updateInterval={30000}
                  showDetailedMetrics={true}
                  enableQuickActions={true}
                  className="border-2 border-purple-200"
                />

                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Widget Features
                  </h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Real-time cost tracking and updates</li>
                    <li>• Visual budget progress indicators</li>
                    <li>• Alert status monitoring</li>
                    <li>• Quick action buttons (pause AI, refresh)</li>
                    <li>• Click to expand to full modal</li>
                    <li>• Integration with SettingsContext</li>
                    <li>• Responsive design for different layouts</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Single Widget Showcase */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Featured Widget - All Features Enabled
            </h2>
            <div className="max-w-md mx-auto">
              <CostSummaryWidget
                userId="featured"
                compact={true}
                realTimeUpdates={realTimeUpdates}
                updateInterval={5000}
                showDetailedMetrics={true}
                enableQuickActions={true}
                className="shadow-lg border-2 border-blue-300"
                onAIToggle={(enabled) => {
                  console.log('Featured widget AI toggle:', enabled);
                  alert(`AI Operations ${enabled ? 'Enabled' : 'Disabled'}`);
                }}
                onModalOpen={() => {
                  console.log('Featured widget modal opened');
                }}
                onModalClose={() => {
                  console.log('Featured widget modal closed');
                }}
              />
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-800 mb-2">
              Usage Instructions
            </h3>
            <div className="text-blue-600 text-sm space-y-2">
              <p>
                <strong>Click any widget</strong> to expand it into a full cost management modal
                with detailed settings, charts, and export capabilities.
              </p>
              <p>
                <strong>Quick Actions:</strong> Use the "Pause AI" button to immediately stop AI operations,
                or "Refresh" to manually update cost data.
              </p>
              <p>
                <strong>Alert Status:</strong> The colored badge shows budget status - normal (green),
                caution (yellow), warning (orange), critical (red), or exceeded (dark red).
              </p>
              <p>
                <strong>Real-time Updates:</strong> When enabled, widgets automatically refresh
                cost data at the specified intervals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SettingsProvider>
  );
};

export default CostSummaryWidgetExample;