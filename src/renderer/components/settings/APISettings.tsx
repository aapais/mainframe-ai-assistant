import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Eye,
  EyeOff,
  TestTube,
  Save,
  Trash2,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Shield,
  Settings,
  ExternalLink,
  Copy,
  RefreshCw,
  Key,
  Database,
  Zap
} from 'lucide-react';

// Import types from main process
interface APIProvider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKeyFormat: string;
  testEndpoint: string;
  pricingInfo: {
    inputCostPer1K: number;
    outputCostPer1K: number;
    currency: string;
  };
  documentationUrl: string;
  setupInstructions: string[];
  requiredHeaders?: Record<string, string>;
}

interface APIKey {
  id: string;
  providerId: string;
  keyName: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  costThisMonth: number;
  monthlyLimit?: number;
  isSessionOnly: boolean;
}

interface APIUsageStats {
  providerId: string;
  requestCount: number;
  totalCost: number;
  lastRequest: Date;
  errorCount: number;
  averageResponseTime: number;
}

interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  statusCode?: number;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

// IPC API interface
const apiSettingsIPC = {
  getProviders: () => window.electronAPI?.invoke('api-settings:get-providers') as Promise<APIProvider[]>,
  getKeys: () => window.electronAPI?.invoke('api-settings:get-keys') as Promise<APIKey[]>,
  storeKey: (providerId: string, keyName: string, apiKey: string, isSessionOnly?: boolean, monthlyLimit?: number) =>
    window.electronAPI?.invoke('api-settings:store-key', providerId, keyName, apiKey, isSessionOnly, monthlyLimit),
  deleteKey: (keyId: string) => window.electronAPI?.invoke('api-settings:delete-key', keyId),
  testConnection: (providerId: string, apiKey: string) =>
    window.electronAPI?.invoke('api-settings:test-connection', providerId, apiKey) as Promise<ConnectionTestResult>,
  getUsageStats: (providerId?: string) =>
    window.electronAPI?.invoke('api-settings:get-usage-stats', providerId) as Promise<APIUsageStats[]>,
  importFromEnv: (envFilePath: string) =>
    window.electronAPI?.invoke('api-settings:import-from-env', envFilePath),
  exportConfiguration: () => window.electronAPI?.invoke('api-settings:export-configuration'),
  validateKeyFormat: (providerId: string, apiKey: string) =>
    window.electronAPI?.invoke('api-settings:validate-key-format', providerId, apiKey),
  updateKeyStatus: (keyId: string, isActive: boolean) =>
    window.electronAPI?.invoke('api-settings:update-key-status', keyId, isActive),
};

// Accenture color palette
const accentureColors = {
  purple: '#A100FF',
  darkPurple: '#7F39FB',
  lightPurple: '#E8D5FF',
  gray: '#666666',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  success: '#00B050',
  warning: '#FF8C00',
  error: '#E74C3C'
};

const APISettings: React.FC = () => {
  const [providers, setProviders] = useState<APIProvider[]>([]);
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [usageStats, setUsageStats] = useState<APIUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [formData, setFormData] = useState({
    keyName: '',
    apiKey: '',
    isSessionOnly: false,
    monthlyLimit: ''
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState<string>('');
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'configure' | 'usage' | 'import-export'>('configure');

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [providersData, keysData, statsData] = await Promise.all([
        apiSettingsIPC.getProviders(),
        apiSettingsIPC.getKeys(),
        apiSettingsIPC.getUsageStats()
      ]);

      setProviders(providersData || []);
      setKeys(keysData || []);
      setUsageStats(statsData || []);
    } catch (error) {
      showNotification('error', 'Failed to load API settings data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProvider || !formData.keyName || !formData.apiKey) {
      showNotification('error', 'Please fill in all required fields');
      return;
    }

    try {
      // Validate key format first
      const validation = await apiSettingsIPC.validateKeyFormat(selectedProvider, formData.apiKey);
      if (!validation.valid) {
        showNotification('error', validation.error || 'Invalid API key format');
        return;
      }

      const monthlyLimit = formData.monthlyLimit ? parseFloat(formData.monthlyLimit) : undefined;

      const result = await apiSettingsIPC.storeKey(
        selectedProvider,
        formData.keyName,
        formData.apiKey,
        formData.isSessionOnly,
        monthlyLimit
      );

      if (result.success) {
        showNotification('success', 'API key saved successfully');
        setFormData({ keyName: '', apiKey: '', isSessionOnly: false, monthlyLimit: '' });
        setSelectedProvider('');
        loadData();
      } else {
        showNotification('error', result.error || 'Failed to save API key');
      }
    } catch (error) {
      showNotification('error', 'Failed to save API key');
      console.error('Error saving key:', error);
    }
  };

  const handleTestConnection = async (providerId: string, apiKey?: string, keyId?: string) => {
    if (!apiKey && !keyId) return;

    setTesting(keyId || providerId);

    try {
      let result: ConnectionTestResult;

      if (keyId) {
        result = await window.electronAPI?.invoke('api-settings:test-stored-key', keyId);
      } else {
        result = await apiSettingsIPC.testConnection(providerId, apiKey!);
      }

      setTestResults(prev => ({
        ...prev,
        [keyId || providerId]: result
      }));

      if (result.success) {
        showNotification('success', `Connection test successful (${result.responseTime}ms)`);
      } else {
        showNotification('error', `Connection test failed: ${result.error}`);
      }
    } catch (error) {
      showNotification('error', 'Connection test failed');
      console.error('Error testing connection:', error);
    } finally {
      setTesting('');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      const result = await apiSettingsIPC.deleteKey(keyId);
      if (result.success) {
        showNotification('success', 'API key deleted successfully');
        loadData();
      } else {
        showNotification('error', result.error || 'Failed to delete API key');
      }
    } catch (error) {
      showNotification('error', 'Failed to delete API key');
      console.error('Error deleting key:', error);
    }
  };

  const handleToggleKeyStatus = async (keyId: string, isActive: boolean) => {
    try {
      const result = await apiSettingsIPC.updateKeyStatus(keyId, !isActive);
      if (result.success) {
        showNotification('success', `API key ${!isActive ? 'enabled' : 'disabled'} successfully`);
        loadData();
      } else {
        showNotification('error', result.error || 'Failed to update key status');
      }
    } catch (error) {
      showNotification('error', 'Failed to update key status');
      console.error('Error updating key status:', error);
    }
  };

  const handleImportEnv = async () => {
    try {
      // In a real implementation, you'd open a file dialog
      const filePath = prompt('Enter path to .env file:');
      if (!filePath) return;

      const result = await apiSettingsIPC.importFromEnv(filePath);
      if (result.imported > 0) {
        showNotification('success', `Imported ${result.imported} API keys`);
        loadData();
      }

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
        showNotification('warning', `Import completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      showNotification('error', 'Failed to import from .env file');
      console.error('Error importing:', error);
    }
  };

  const handleExportConfig = async () => {
    try {
      const result = await apiSettingsIPC.exportConfiguration();
      if (result.success && result.data) {
        // In a real implementation, you'd save to file
        navigator.clipboard.writeText(result.data);
        showNotification('success', 'Configuration copied to clipboard');
      } else {
        showNotification('error', result.error || 'Failed to export configuration');
      }
    } catch (error) {
      showNotification('error', 'Failed to export configuration');
      console.error('Error exporting:', error);
    }
  };

  const getProviderIcon = (providerId: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'openai': <Zap className="w-5 h-5 text-green-500" />,
      'anthropic': <Shield className="w-5 h-5 text-orange-500" />,
      'gemini': <Database className="w-5 h-5 text-blue-500" />,
      'github-copilot': <Activity className="w-5 h-5 text-gray-700" />
    };
    return iconMap[providerId] || <Key className="w-5 h-5" />;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 4
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: accentureColors.purple }} />
        <span className="ml-2 text-lg">Loading API settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-x-hidden" style={{ backgroundColor: accentureColors.lightGray }}>
      {/* Accenture Header */}
      <div className="text-center mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2" style={{ color: accentureColors.purple }}>
          API Configuration Center
        </h1>
        <p className="text-sm sm:text-base lg:text-lg px-2" style={{ color: accentureColors.gray }}>
          Secure management of AI service API keys for enterprise applications
        </p>
        <div className="flex items-center justify-center mt-2 sm:mt-4">
          <div
            className="px-3 sm:px-4 py-1 sm:py-2 rounded-full text-white text-xs sm:text-sm font-semibold"
            style={{ backgroundColor: accentureColors.purple }}
          >
            Accenture Mainframe AI Assistant
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg border-l-4 ${
          notification.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
          notification.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
          'bg-red-50 border-red-500 text-red-700'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'warning' && <AlertCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
            {notification.message}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-white rounded-lg p-1 overflow-x-auto">
        {[
          { id: 'configure', label: 'Configure APIs', icon: Settings },
          { id: 'usage', label: 'Usage & Stats', icon: Activity },
          { id: 'import-export', label: 'Import/Export', icon: Upload }
        ].map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              style={{
                backgroundColor: activeTab === tab.id ? accentureColors.purple : 'transparent'
              }}
            >
              <IconComponent className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Configure APIs Tab */}
      {activeTab === 'configure' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Add New API Key */}
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureColors.purple, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Key className="w-5 h-5 mr-2" />
                Add New API Key
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <form onSubmit={handleFormSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">API Provider</label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a provider...</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} - {provider.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Key Name</label>
                  <Input
                    type="text"
                    value={formData.keyName}
                    onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
                    placeholder="e.g., Production Key, Development Key"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">API Key</label>
                  <div className="relative">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="Enter your API key..."
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {selectedProvider && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        onClick={() => handleTestConnection(selectedProvider, formData.apiKey)}
                        disabled={!formData.apiKey || testing === selectedProvider}
                        variant="outline"
                        className="text-sm"
                      >
                        <TestTube className="w-4 h-4 mr-2" />
                        {testing === selectedProvider ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Monthly Limit (Optional)</label>
                  <Input
                    type="number"
                    value={formData.monthlyLimit}
                    onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                    placeholder="e.g., 100.00"
                    step="0.01"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="sessionOnly"
                    checked={formData.isSessionOnly}
                    onChange={(e) => setFormData({ ...formData, isSessionOnly: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="sessionOnly" className="text-sm">
                    Session only (don't save to disk)
                  </label>
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    style={{ backgroundColor: accentureColors.purple }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save API Key
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Provider Setup Instructions */}
          {selectedProvider && (
            <Card className="border-0 shadow-lg">
              <CardHeader style={{ backgroundColor: accentureColors.darkPurple, color: 'white' }}>
                <CardTitle className="flex items-center">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Setup Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {(() => {
                  const provider = providers.find(p => p.id === selectedProvider);
                  if (!provider) return null;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        {getProviderIcon(provider.id)}
                        <h3 className="font-semibold text-lg">{provider.name}</h3>
                      </div>

                      <p className="text-gray-600">{provider.description}</p>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Setup Steps:</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          {provider.setupInstructions.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2 text-blue-800">Pricing Information:</h4>
                        <div className="text-sm text-blue-700">
                          <p>Input: {formatCurrency(provider.pricingInfo.inputCostPer1K)} per 1K tokens</p>
                          <p>Output: {formatCurrency(provider.pricingInfo.outputCostPer1K)} per 1K tokens</p>
                        </div>
                      </div>

                      <Button
                        onClick={() => window.open(provider.documentationUrl, '_blank')}
                        variant="outline"
                        className="w-full"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Documentation
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stored API Keys */}
      {activeTab === 'configure' && keys.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureColors.gray, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Stored API Keys ({keys.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {keys.map(key => {
                const provider = providers.find(p => p.id === key.providerId);
                const testResult = testResults[key.id];

                return (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white"
                  >
                    <div className="flex items-center space-x-4">
                      {getProviderIcon(key.providerId)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{key.keyName}</h4>
                          <Badge variant={key.isActive ? 'success' : 'secondary'}>
                            {key.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {key.isSessionOnly && (
                            <Badge variant="warning">Session Only</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {provider?.name} • {key.maskedKey}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                          <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                          <span>Uses: {key.usageCount}</span>
                          <span>Cost: {formatCurrency(key.costThisMonth)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {testResult && (
                        <div className={`px-2 py-1 rounded text-xs ${
                          testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {testResult.success ? (
                            <span className="flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {testResult.responseTime}ms
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Failed
                            </span>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={() => handleTestConnection(key.providerId, undefined, key.id)}
                        disabled={testing === key.id}
                        variant="outline"
                        size="sm"
                      >
                        <TestTube className="w-4 h-4" />
                      </Button>

                      <Button
                        onClick={() => handleToggleKeyStatus(key.id, key.isActive)}
                        variant="outline"
                        size="sm"
                      >
                        {key.isActive ? 'Disable' : 'Enable'}
                      </Button>

                      <Button
                        onClick={() => handleDeleteKey(key.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage & Stats Tab */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Usage Statistics */}
            <Card className="border-0 shadow-lg">
              <CardHeader style={{ backgroundColor: accentureColors.success, color: 'white' }}>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Total Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold">
                  {usageStats.reduce((sum, stat) => sum + stat.requestCount, 0).toLocaleString()}
                </div>
                <p className="text-gray-600">API calls made</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader style={{ backgroundColor: accentureColors.warning, color: 'white' }}>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold">
                  {formatCurrency(usageStats.reduce((sum, stat) => sum + stat.totalCost, 0))}
                </div>
                <p className="text-gray-600">This month</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader style={{ backgroundColor: accentureColors.darkPurple, color: 'white' }}>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Avg Response
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold">
                  {Math.round(
                    usageStats.reduce((sum, stat) => sum + stat.averageResponseTime, 0) /
                    Math.max(1, usageStats.length)
                  )}ms
                </div>
                <p className="text-gray-600">Average response time</p>
              </CardContent>
            </Card>
          </div>

          {/* Provider-specific statistics */}
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureColors.gray, color: 'white' }}>
              <CardTitle>Provider Usage Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {usageStats.map(stat => {
                  const provider = providers.find(p => p.id === stat.providerId);
                  return (
                    <div key={stat.providerId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getProviderIcon(stat.providerId)}
                          <h4 className="font-medium">{provider?.name || stat.providerId}</h4>
                        </div>
                        <div className="text-sm text-gray-500">
                          Last used: {new Date(stat.lastRequest).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Requests</div>
                          <div className="font-semibold">{stat.requestCount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Cost</div>
                          <div className="font-semibold">{formatCurrency(stat.totalCost)}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Avg Response</div>
                          <div className="font-semibold">{Math.round(stat.averageResponseTime)}ms</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Error Rate</div>
                          <div className="font-semibold">
                            {stat.requestCount > 0 ?
                              `${((stat.errorCount / stat.requestCount) * 100).toFixed(1)}%` :
                              '0%'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {usageStats.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No usage statistics available yet. Start using your API keys to see data here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import/Export Tab */}
      {activeTab === 'import-export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureColors.purple, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Import Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-gray-600">
                  Import API keys from environment files or previous configurations.
                </p>

                <Button
                  onClick={handleImportEnv}
                  className="w-full"
                  style={{ backgroundColor: accentureColors.purple }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import from .env File
                </Button>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium">Security Notice</p>
                      <p>Imported keys will be encrypted and stored securely. Original files should be deleted after import.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureColors.darkPurple, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Download className="w-5 h-5 mr-2" />
                Export Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-gray-600">
                  Export configuration for backup or transfer to another instance.
                </p>

                <Button
                  onClick={handleExportConfig}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Configuration
                </Button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">Privacy Protection</p>
                      <p>Exported data contains configuration and usage statistics only. API keys are never included in exports.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accenture Footer */}
      <div className="text-center py-6 border-t mt-8">
        <p className="text-sm" style={{ color: accentureColors.gray }}>
          Accenture Mainframe AI Assistant • Secure API Management
        </p>
        <p className="text-xs mt-2" style={{ color: accentureColors.gray }}>
          All API keys are encrypted and stored securely using industry-standard practices
        </p>
      </div>
    </div>
  );
};

export default APISettings;