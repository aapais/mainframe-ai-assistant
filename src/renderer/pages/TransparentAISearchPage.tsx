/**
 * TransparentAISearchPage - Complete AI search experience with full transparency
 *
 * Demonstrates the integration of all AI transparency features:
 * - Cost estimation before execution
 * - Authorization dialog for all AI operations
 * - Real-time cost tracking during operations
 * - Operation history and audit trail
 * - Budget alerts and limits
 * - Complete transparency and user control
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AISearchTab } from '../components/search/AISearchTab';
import { CostTracker } from '../components/ai/CostTracker';
import { OperationHistory } from '../components/ai/OperationHistory';
import { aiService } from '../services/aiService';
import { KBEntry } from '../../types/services';
import { Search, Settings, DollarSign, History, BarChart3, Shield, Zap, AlertTriangle } from 'lucide-react';

interface TransparentAISearchPageState {
  entries: KBEntry[];
  isLoading: boolean;
  error: string | null;
  selectedEntry: KBEntry | null;
  showCostDashboard: boolean;
  showOperationHistory: boolean;
  showSettings: boolean;
  currentUsage: any;
  budgetAlerts: any[];
}

export const TransparentAISearchPage: React.FC = () => {
  const [state, setState] = useState<TransparentAISearchPageState>({
    entries: [],
    isLoading: true,
    error: null,
    selectedEntry: null,
    showCostDashboard: false,
    showOperationHistory: false,
    showSettings: false,
    currentUsage: null,
    budgetAlerts: []
  });

  // Load initial data
  useEffect(() => {
    const initializePage = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // Load KB entries
        const entries = await window.electronAPI?.getAllEntries?.() || [];

        // Load current usage
        const usage = aiService.getCurrentUsage();

        setState(prev => ({
          ...prev,
          entries,
          currentUsage: usage,
          isLoading: false
        }));

        // Set up event listeners
        aiService.on('budget-alert', handleBudgetAlert);
        aiService.on('operation-logged', handleOperationLogged);

      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load data',
          isLoading: false
        }));
      }
    };

    initializePage();

    return () => {
      aiService.removeAllListeners('budget-alert');
      aiService.removeAllListeners('operation-logged');
    };
  }, []);

  // Handle budget alerts
  const handleBudgetAlert = useCallback((alert: any) => {
    setState(prev => ({
      ...prev,
      budgetAlerts: [...prev.budgetAlerts, alert]
    }));
  }, []);

  // Handle operation logging
  const handleOperationLogged = useCallback((operation: any) => {
    const usage = aiService.getCurrentUsage();
    setState(prev => ({
      ...prev,
      currentUsage: usage
    }));
  }, []);

  // Entry selection handler
  const handleEntrySelect = useCallback((entry: KBEntry) => {
    setState(prev => ({ ...prev, selectedEntry: entry }));
  }, []);

  // Entry rating handler
  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    try {
      await window.electronAPI?.rateEntry?.(entryId, successful);
    } catch (error) {
      console.error('Failed to rate entry:', error);
    }
  }, []);

  // UI toggle handlers
  const toggleCostDashboard = useCallback(() => {
    setState(prev => ({ ...prev, showCostDashboard: !prev.showCostDashboard }));
  }, []);

  const toggleOperationHistory = useCallback(() => {
    setState(prev => ({ ...prev, showOperationHistory: !prev.showOperationHistory }));
  }, []);

  const toggleSettings = useCallback(() => {
    setState(prev => ({ ...prev, showSettings: !prev.showSettings }));
  }, []);

  // Clear budget alerts
  const clearBudgetAlerts = useCallback(() => {
    setState(prev => ({ ...prev, budgetAlerts: [] }));
  }, []);

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AI search interface...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Page</h2>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="transparent-ai-search-page min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">AI Search with Transparency</h1>
              <p className="text-sm text-gray-600">Complete cost and operation visibility</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Usage summary */}
            {state.currentUsage && (
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-mono">${state.currentUsage.totalCost.toFixed(4)}</span>
                  <span className="text-gray-500">total</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="font-mono">{state.currentUsage.totalOperations}</span>
                  <span className="text-gray-500">ops</span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleCostDashboard}
                className={`p-2 rounded-lg transition-colors ${
                  state.showCostDashboard
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Cost Dashboard"
              >
                <DollarSign className="w-5 h-5" />
              </button>

              <button
                onClick={toggleOperationHistory}
                className={`p-2 rounded-lg transition-colors ${
                  state.showOperationHistory
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Operation History"
              >
                <History className="w-5 h-5" />
              </button>

              <button
                onClick={toggleSettings}
                className={`p-2 rounded-lg transition-colors ${
                  state.showSettings
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Budget alerts */}
        {state.budgetAlerts.length > 0 && (
          <div className="mt-4 space-y-2">
            {state.budgetAlerts.map((alert, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3"
              >
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">Budget Alert</p>
                    <p className="text-sm text-yellow-600">
                      {alert.type} budget at {alert.percentage.toFixed(1)}%
                      (${alert.usage.toFixed(4)} of ${alert.limit.toFixed(2)})
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearBudgetAlerts}
                  className="text-yellow-600 hover:text-yellow-800 px-3 py-1 text-sm border border-yellow-300 rounded"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex flex-1">
        {/* Primary search area */}
        <div className="flex-1 p-6">
          <AISearchTab
            entries={state.entries}
            onEntrySelect={handleEntrySelect}
            onEntryRate={handleEntryRate}
            userId="current-user"
            className="bg-white rounded-lg shadow-sm border"
          />
        </div>

        {/* Transparency panels */}
        <aside className="w-96 bg-white border-l border-gray-200 p-6 space-y-6 overflow-y-auto">
          {/* Cost Dashboard */}
          {state.showCostDashboard && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-800">Cost Dashboard</h2>
              </div>
              <CostTracker
                userId="current-user"
                compact={false}
                showBudgetAlerts={true}
                refreshIntervalMs={15000}
              />
            </div>
          )}

          {/* Operation History */}
          {state.showOperationHistory && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">Operation History</h2>
              </div>
              <OperationHistory
                userId="current-user"
                operationType="search"
                limit={20}
                showCosts={true}
                compact={false}
              />
            </div>
          )}

          {/* Settings */}
          {state.showSettings && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800">AI Settings</h2>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Budget Limits</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Daily Limit:</span>
                      <span className="font-mono">${state.currentUsage?.daily.limit.toFixed(2) || '10.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Limit:</span>
                      <span className="font-mono">${state.currentUsage?.monthly.limit.toFixed(2) || '100.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Per-operation Limit:</span>
                      <span className="font-mono">$1.00</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Default Providers</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Primary Provider:</label>
                      <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude</option>
                        <option value="gemini">Gemini</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Default Model:</label>
                      <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm">
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="claude-3-sonnet">Claude-3 Sonnet</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Transparency Options</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm text-gray-600">Always show cost estimates</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm text-gray-600">Require authorization for AI operations</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm text-gray-600">Log all AI operations</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm text-gray-600">Auto-approve operations under $0.01</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transparency features showcase */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-800">Transparency Features</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Pre-search cost estimation</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Real-time operation tracking</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Complete operation history</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Budget alerts and limits</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>User authorization required</span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Selected entry details */}
      {state.selectedEntry && (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">Selected Entry</h3>
            <button
              onClick={() => setState(prev => ({ ...prev, selectedEntry: null }))}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-600">{state.selectedEntry.title}</h4>
            <p className="text-sm text-gray-600 line-clamp-3">{state.selectedEntry.problem}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Category: {state.selectedEntry.category}</span>
              <span>Success: {((state.selectedEntry.success_count / (state.selectedEntry.success_count + state.selectedEntry.failure_count)) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransparentAISearchPage;