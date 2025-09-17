import React, { useState, useEffect, useCallback } from 'react';
import { X, Clock, DollarSign, Zap, AlertTriangle, Info, Settings, Check } from 'lucide-react';
import { AuthorizationDialogProps, AIOperation, AIProvider, AIOperationType } from '../../types/ai';

interface AuthorizationDialogState {
  timeRemaining: number;
  showAdvanced: boolean;
  modifiedOperation: Partial<AIOperation>;
  isProcessing: boolean;
}

const AuthorizationDialog: React.FC<AuthorizationDialogProps> = ({
  isOpen,
  operation,
  estimatedCost,
  tokensEstimate,
  onApprove,
  onDeny,
  onAlwaysAllow,
  timeoutSeconds = 30,
}) => {
  const [state, setState] = useState<AuthorizationDialogState>({
    timeRemaining: timeoutSeconds,
    showAdvanced: false,
    modifiedOperation: {},
    isProcessing: false,
  });

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen) return;

    setState(prev => ({ ...prev, timeRemaining: timeoutSeconds }));

    const timer = setInterval(() => {
      setState(prev => {
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          clearInterval(timer);
          onDeny(); // Auto-deny on timeout
          return prev;
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeoutSeconds, onDeny]);

  const handleApprove = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: true }));
    const finalOperation = { ...operation, ...state.modifiedOperation };
    onApprove(finalOperation);
  }, [operation, state.modifiedOperation, onApprove]);

  const handleDeny = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: true }));
    onDeny();
  }, [onDeny]);

  const handleAlwaysAllow = useCallback(() => {
    setState(prev => ({ ...prev, isProcessing: true }));
    onAlwaysAllow();
  }, [onAlwaysAllow]);

  const handleModifyOperation = useCallback((field: keyof AIOperation, value: any) => {
    setState(prev => ({
      ...prev,
      modifiedOperation: {
        ...prev.modifiedOperation,
        [field]: value,
      },
    }));
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const formatTokens = (tokens: number): string => {
    return new Intl.NumberFormat('en-US').format(tokens);
  };

  const getProviderIcon = (provider: AIProvider) => {
    const iconClass = "w-5 h-5";
    switch (provider) {
      case 'openai':
        return <div className={`${iconClass} bg-green-500 rounded`} />;
      case 'claude':
        return <div className={`${iconClass} bg-orange-500 rounded`} />;
      case 'gemini':
        return <div className={`${iconClass} bg-blue-500 rounded`} />;
      case 'local':
        return <div className={`${iconClass} bg-gray-500 rounded`} />;
      default:
        return <div className={`${iconClass} bg-gray-400 rounded`} />;
    }
  };

  const getOperationTypeIcon = (operationType: AIOperationType) => {
    switch (operationType) {
      case 'search':
        return <Zap className="w-4 h-4" />;
      case 'generation':
        return <Settings className="w-4 h-4" />;
      case 'analysis':
        return <Info className="w-4 h-4" />;
      case 'chat':
        return <Check className="w-4 h-4" />;
      case 'completion':
        return <Settings className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getCostColor = (cost: number) => {
    if (cost < 0.01) return 'text-green-600';
    if (cost < 0.05) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeColor = (time: number) => {
    if (time > 20) return 'text-green-600';
    if (time > 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">AI Operation Authorization Required</h2>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-1 ${getTimeColor(state.timeRemaining)}`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono">{state.timeRemaining}s</span>
            </div>
            <button
              onClick={handleDeny}
              className="text-white hover:text-gray-200 transition-colors"
              disabled={state.isProcessing}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Operation Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getProviderIcon(operation.provider!)}
                <div>
                  <h3 className="font-semibold text-lg capitalize">
                    {operation.provider} {operation.operationType}
                  </h3>
                  <p className="text-sm text-gray-600">{operation.model}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getOperationTypeIcon(operation.operationType!)}
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {operation.operationType}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estimated Cost:</span>
                <span className={`font-semibold ${getCostColor(estimatedCost)}`}>
                  {formatCurrency(estimatedCost)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Purpose:</span>
                <span className="font-medium">{operation.purpose}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Input Tokens:</span>
                <span className="font-mono">{formatTokens(tokensEstimate.input)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Output Tokens (est):</span>
                <span className="font-mono">{formatTokens(tokensEstimate.output)}</span>
              </div>
            </div>
          </div>

          {/* Query Preview */}
          <div>
            <h4 className="font-semibold mb-2">Query Content:</h4>
            <div className="bg-gray-100 rounded p-3 max-h-32 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {operation.queryText}
              </pre>
            </div>

            {/* Search-specific context */}
            {operation.operationType === 'search' && (
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Search Type:</span>
                  <span className="font-medium">AI-Enhanced Knowledge Base Search</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected Results:</span>
                  <span className="font-medium">10-20 relevant entries</span>
                </div>
                <div className="flex justify-between">
                  <span>Features:</span>
                  <span className="font-medium">Semantic search, explanations, highlighting</span>
                </div>
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-yellow-600" />
              <h4 className="font-semibold text-yellow-800">Cost Breakdown</h4>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Input tokens ({formatTokens(tokensEstimate.input)}):</span>
                <span>{formatCurrency((estimatedCost * tokensEstimate.input) / (tokensEstimate.input + tokensEstimate.output))}</span>
              </div>
              <div className="flex justify-between">
                <span>Output tokens ({formatTokens(tokensEstimate.output)}):</span>
                <span>{formatCurrency((estimatedCost * tokensEstimate.output) / (tokensEstimate.input + tokensEstimate.output))}</span>
              </div>
              <div className="border-t pt-1 flex justify-between font-semibold">
                <span>Total Estimated Cost:</span>
                <span className={getCostColor(estimatedCost)}>{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              onClick={() => setState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {state.showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>

            {state.showAdvanced && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modify Purpose:
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    defaultValue={operation.purpose}
                    onChange={(e) => handleModifyOperation('purpose', e.target.value)}
                    placeholder="Enter a more specific purpose..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modify Query:
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={3}
                    defaultValue={operation.queryText}
                    onChange={(e) => handleModifyOperation('queryText', e.target.value)}
                    placeholder="Modify the query if needed..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider:
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      defaultValue={operation.provider}
                      onChange={(e) => handleModifyOperation('provider', e.target.value)}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude</option>
                      <option value="gemini">Gemini</option>
                      <option value="local">Local</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model:
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      defaultValue={operation.model}
                      onChange={(e) => handleModifyOperation('model', e.target.value)}
                      placeholder="Model name..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex items-center justify-between">
          <div className="text-sm text-gray-600">
            This operation will be logged for transparency and cost tracking.
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDeny}
              disabled={state.isProcessing}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Deny
            </button>

            <button
              onClick={handleAlwaysAllow}
              disabled={state.isProcessing}
              className="px-4 py-2 text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Always Allow
            </button>

            <button
              onClick={handleApprove}
              disabled={state.isProcessing}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {state.isProcessing ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div
            className={`h-full transition-all duration-1000 ${
              state.timeRemaining > 20 ? 'bg-green-500' :
              state.timeRemaining > 10 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${(state.timeRemaining / timeoutSeconds) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default AuthorizationDialog;

