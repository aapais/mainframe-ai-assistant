import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, AlertTriangle, Info, RefreshCw, Home } from 'lucide-react';
import AuthorizationDialog from '../components/ai/AuthorizationDialog';
import OperationHistory from '../components/ai/OperationHistory';
import { AIOperation, AIPreferences, BudgetStatus, AIBudgetAlert } from '../types/ai';
import AICostCalculator from '../../utils/aiCostCalculator';

interface AITransparencyPageState {
  activeTab: 'overview' | 'operations';
  showAuthDialog: boolean;
  pendingOperation: Partial<AIOperation> | null;
  preferences: AIPreferences | null;
  alerts: AIBudgetAlert[];
  isLoading: boolean;
  error: string | null;
}

const AITransparencyPage: React.FC = () => {
  const [state, setState] = useState<AITransparencyPageState>({
    activeTab: 'overview',
    showAuthDialog: false,
    pendingOperation: null,
    preferences: null,
    alerts: [],
    isLoading: true,
    error: null,
  });

  const userId = 'current_user'; // Would come from auth context

  // Load initial data
  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // In a real app, these would be service calls
      const mockPreferences: AIPreferences = {
        userId,
        alwaysAllowProviders: ['local'],
        alwaysAllowOperations: ['search'],
        maxCostAutoApprove: 0.01,
        defaultTimeoutSeconds: 30,
        enableCostAlerts: true,
        enableUsageTracking: true,
        preferredProvider: 'openai',
        preferredModel: 'gpt-3.5-turbo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockAlerts: AIBudgetAlert[] = [
        {
          id: 1,
          userId,
          budgetId: 2,
          alertType: '80_percent',
          currentUsage: 4.25,
          budgetAmount: 5.0,
          percentageUsed: 85.0,
          acknowledged: false,
          createdAt: new Date().toISOString(),
        },
      ];

      setState(prev => ({
        ...prev,
        preferences: mockPreferences,
        alerts: mockAlerts,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load data',
        isLoading: false,
      }));
    }
  }, [userId]);

  // Example function to simulate AI operation request
  const requestAIOperation = useCallback(async (
    query: string,
    provider: 'openai' | 'claude' | 'gemini' | 'local',
    model: string,
    operationType: 'search' | 'generation' | 'analysis' | 'chat' | 'completion',
    purpose: string
  ) => {
    const estimate = AICostCalculator.getEstimate(query, provider, model, operationType, purpose);

    // Check if should auto-approve
    const shouldAutoApprove =
      state.preferences?.alwaysAllowProviders.includes(provider) &&
      state.preferences?.alwaysAllowOperations.includes(operationType) &&
      estimate.estimatedCost <= (state.preferences?.maxCostAutoApprove || 0);

    if (shouldAutoApprove) {
      // Execute operation directly
      console.log('Auto-approved operation:', { query, provider, model, operationType, purpose });
      return;
    }

    // Show authorization dialog
    setState(prev => ({
      ...prev,
      showAuthDialog: true,
      pendingOperation: {
        operationType,
        provider,
        model,
        queryText: query,
        purpose,
        estimatedCost: estimate.estimatedCost,
        tokensInput: estimate.tokenEstimate.input,
        tokensOutput: estimate.tokenEstimate.output,
        sessionId: `session_${Date.now()}`,
        userId,
      },
    }));
  }, [state.preferences]);

  const handleOperationApprove = useCallback((modifiedOperation?: Partial<AIOperation>) => {
    const operation = modifiedOperation || state.pendingOperation;
    if (operation) {
      console.log('Approved operation:', operation);
      // Execute the AI operation here

      setState(prev => ({
        ...prev,
        showAuthDialog: false,
        pendingOperation: null,
      }));
    }
  }, [state.pendingOperation]);

  const handleOperationDeny = useCallback(() => {
    console.log('Denied operation:', state.pendingOperation);
    setState(prev => ({
      ...prev,
      showAuthDialog: false,
      pendingOperation: null,
    }));
  }, [state.pendingOperation]);

  const handleAlwaysAllow = useCallback(() => {
    if (state.pendingOperation && state.preferences) {
      // Update preferences to always allow this type of operation
      const updatedPreferences: AIPreferences = {
        ...state.preferences,
        alwaysAllowProviders: state.pendingOperation.provider
          ? [...new Set([...state.preferences.alwaysAllowProviders, state.pendingOperation.provider])]
          : state.preferences.alwaysAllowProviders,
        alwaysAllowOperations: state.pendingOperation.operationType
          ? [...new Set([...state.preferences.alwaysAllowOperations, state.pendingOperation.operationType])]
          : state.preferences.alwaysAllowOperations,
      };

      setState(prev => ({
        ...prev,
        preferences: updatedPreferences,
        showAuthDialog: false,
        pendingOperation: null,
      }));

      console.log('Always allow enabled for:', state.pendingOperation);
      // Execute the operation
      console.log('Executing operation after always allow:', state.pendingOperation);
    }
  }, [state.pendingOperation, state.preferences]);

  const updatePreferences = useCallback((updates: Partial<AIPreferences>) => {
    if (state.preferences) {
      const updatedPreferences = { ...state.preferences, ...updates };
      setState(prev => ({ ...prev, preferences: updatedPreferences }));
      // In real app, save to backend
      console.log('Updated preferences:', updatedPreferences);
    }
  }, [state.preferences]);

  const TabButton: React.FC<{
    id: string;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
  }> = ({ id, label, icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading AI transparency data...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">{state.error}</p>
          <button
            onClick={loadPageData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">AI Transparency Center</h1>
            </div>

            {state.alerts.length > 0 && (
              <div className="flex items-center space-x-2 bg-red-50 text-red-800 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {state.alerts.length} budget alert{state.alerts.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 py-4">
            <TabButton
              id="overview"
              label="Overview"
              icon={<Home className="w-4 h-4" />}
              isActive={state.activeTab === 'overview'}
              onClick={() => setState(prev => ({ ...prev, activeTab: 'overview' }))}
            />
            <TabButton
              id="operations"
              label="Operations"
              icon={<Clock className="w-4 h-4" />}
              isActive={state.activeTab === 'operations'}
              onClick={() => setState(prev => ({ ...prev, activeTab: 'operations' }))}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state.activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Demo Controls */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">Demo AI Operations</h2>
              <p className="text-gray-600 mb-4">
                Test the authorization dialog with different AI operations:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => requestAIOperation(
                    'Search for mainframe batch job error patterns',
                    'openai',
                    'gpt-3.5-turbo',
                    'search',
                    'Help with debugging batch job failures'
                  )}
                  className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
                >
                  <h3 className="font-medium">Low-cost Search</h3>
                  <p className="text-sm text-gray-600">~$0.005 - Should auto-approve</p>
                </button>

                <button
                  onClick={() => requestAIOperation(
                    'Generate comprehensive documentation for this COBOL program with detailed explanations of all procedures, data structures, and business logic flows.',
                    'openai',
                    'gpt-4',
                    'generation',
                    'Create technical documentation'
                  )}
                  className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
                >
                  <h3 className="font-medium">High-cost Generation</h3>
                  <p className="text-sm text-gray-600">~$0.15 - Requires approval</p>
                </button>

                <button
                  onClick={() => requestAIOperation(
                    'Analyze this database performance issue',
                    'claude',
                    'claude-3-sonnet',
                    'analysis',
                    'Performance optimization'
                  )}
                  className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-left"
                >
                  <h3 className="font-medium">Medium-cost Analysis</h3>
                  <p className="text-sm text-gray-600">~$0.025 - Requires approval</p>
                </button>
              </div>
            </div>


            {/* Recent Operations Summary */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Operations Summary</h2>
              <OperationHistory
                userId={userId}
                maxResults={10}
                showFilters={false}
                allowExport={false}
              />
            </div>
          </div>
        )}

        {state.activeTab === 'operations' && (
          <OperationHistory
            userId={userId}
            maxResults={100}
            showFilters={true}
            allowExport={true}
          />
        )}


      </div>

      {/* Authorization Dialog */}
      {state.showAuthDialog && state.pendingOperation && (
        <AuthorizationDialog
          isOpen={state.showAuthDialog}
          operation={state.pendingOperation}
          estimatedCost={state.pendingOperation.estimatedCost || 0}
          tokensEstimate={{
            input: state.pendingOperation.tokensInput || 0,
            output: state.pendingOperation.tokensOutput || 0,
          }}
          onApprove={handleOperationApprove}
          onDeny={handleOperationDeny}
          onAlwaysAllow={handleAlwaysAllow}
          timeoutSeconds={state.preferences?.defaultTimeoutSeconds || 30}
        />
      )}
    </div>
  );
};

export default AITransparencyPage;