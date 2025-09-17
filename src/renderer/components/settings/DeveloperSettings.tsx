/**
 * Developer Settings Component
 * Manages development tools, debugging options, and API configuration
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Code,
  Terminal,
  Bug,
  Database,
  Server,
  Globe,
  Key,
  Monitor,
  FileText,
  Settings,
  Eye,
  EyeOff,
  Play,
  Pause,
  Square,
  RefreshCw,
  Download,
  Upload,
  Copy,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Zap,
  Activity,
  Clock,
  Search,
  Filter
} from 'lucide-react';
import { usePerformanceSettings, useSettingsActions } from '../../contexts/SettingsContext';

// Accenture theme colors
const accentureTheme = {
  primary: '#A100FF',
  secondary: '#7F39FB',
  accent: '#E8D5FF',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  border: '#E0E0E0',
  success: '#00B050',
  warning: '#FF8C00',
  error: '#E74C3C'
};

interface DeveloperConfig {
  debugMode: boolean;
  verboseLogging: boolean;
  showDevTools: boolean;
  enableHotReload: boolean;
  apiEndpoints: {
    development: string;
    staging: string;
    production: string;
    current: 'development' | 'staging' | 'production';
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableFile: boolean;
    maxFileSize: number; // MB
    retainDays: number;
  };
  performance: {
    enableProfiler: boolean;
    trackRenders: boolean;
    trackMemory: boolean;
    sampleRate: number; // percentage
  };
  features: {
    experimentalFeatures: boolean;
    betaFeatures: boolean;
    mockData: boolean;
    skipValidation: boolean;
  };
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  component?: string;
  data?: any;
}

const DeveloperSettings: React.FC = () => {
  const { performance } = usePerformanceSettings();
  const { updatePerformance } = useSettingsActions();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'debug' | 'api' | 'logging' | 'tools'>('debug');
  const [isLogging, setIsLogging] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const [config, setConfig] = useState<DeveloperConfig>({
    debugMode: false,
    verboseLogging: false,
    showDevTools: false,
    enableHotReload: true,
    apiEndpoints: {
      development: 'http://localhost:3001/api',
      staging: 'https://staging-api.accenture-ai.com/api',
      production: 'https://api.accenture-ai.com/api',
      current: 'development'
    },
    logging: {
      level: performance.logLevel,
      enableConsole: true,
      enableFile: false,
      maxFileSize: 10,
      retainDays: 7
    },
    performance: {
      enableProfiler: false,
      trackRenders: false,
      trackMemory: false,
      sampleRate: 10
    },
    features: {
      experimentalFeatures: false,
      betaFeatures: false,
      mockData: false,
      skipValidation: false
    }
  });

  // Mock log entries for demonstration
  const [logEntries] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 30),
      level: 'info',
      message: 'Application started successfully',
      component: 'App'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60),
      level: 'debug',
      message: 'API request to /search completed',
      component: 'SearchService',
      data: { duration: 142, status: 200 }
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 1000 * 120),
      level: 'warn',
      message: 'Rate limit warning: 80% of quota used',
      component: 'RateLimiter'
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 1000 * 300),
      level: 'error',
      message: 'Failed to connect to external API',
      component: 'ExternalService',
      data: { error: 'TIMEOUT', endpoint: '/ai/chat' }
    }
  ]);

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleConfigChange = useCallback(<K extends keyof DeveloperConfig>(
    key: K,
    value: DeveloperConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApiEndpointChange = useCallback((endpoint: keyof DeveloperConfig['apiEndpoints'], value: string) => {
    setConfig(prev => ({
      ...prev,
      apiEndpoints: {
        ...prev.apiEndpoints,
        [endpoint]: value
      }
    }));
  }, []);

  const handleLoggingChange = useCallback((setting: keyof DeveloperConfig['logging'], value: any) => {
    setConfig(prev => ({
      ...prev,
      logging: {
        ...prev.logging,
        [setting]: value
      }
    }));
  }, []);

  const handlePerformanceChange = useCallback((setting: keyof DeveloperConfig['performance'], value: any) => {
    setConfig(prev => ({
      ...prev,
      performance: {
        ...prev.performance,
        [setting]: value
      }
    }));
  }, []);

  const handleFeatureChange = useCallback((feature: keyof DeveloperConfig['features'], value: boolean) => {
    setConfig(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: value
      }
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePerformance({
        logLevel: config.logging.level
      });

      showNotification('success', 'Developer settings saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save developer settings');
      console.error('Developer settings save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      debugMode: false,
      verboseLogging: false,
      showDevTools: false,
      enableHotReload: true,
      apiEndpoints: {
        development: 'http://localhost:3001/api',
        staging: 'https://staging-api.accenture-ai.com/api',
        production: 'https://api.accenture-ai.com/api',
        current: 'development'
      },
      logging: {
        level: 'info',
        enableConsole: true,
        enableFile: false,
        maxFileSize: 10,
        retainDays: 7
      },
      performance: {
        enableProfiler: false,
        trackRenders: false,
        trackMemory: false,
        sampleRate: 10
      },
      features: {
        experimentalFeatures: false,
        betaFeatures: false,
        mockData: false,
        skipValidation: false
      }
    });
    showNotification('success', 'Developer settings reset to defaults');
  };

  const handleTestEndpoint = async (endpoint: string) => {
    try {
      showNotification('info', 'Testing endpoint connection...');
      // Mock API test
      await new Promise(resolve => setTimeout(resolve, 1000));
      showNotification('success', `Successfully connected to ${endpoint}`);
    } catch (error) {
      showNotification('error', `Failed to connect to ${endpoint}`);
    }
  };

  const handleCopyLogs = () => {
    const logsText = logEntries.map(entry => 
      `[${entry.timestamp.toISOString()}] ${entry.level.toUpperCase()}: ${entry.message}${entry.component ? ` (${entry.component})` : ''}`
    ).join('\n');
    
    navigator.clipboard.writeText(logsText);
    showNotification('success', 'Logs copied to clipboard');
  };

  const handleClearLogs = () => {
    showNotification('success', 'Log history cleared');
  };

  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'debug': return 'text-blue-600';
      case 'info': return 'text-green-600';
      case 'warn': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Developer Settings
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Development tools, debugging options, and API configuration
        </p>
      </div>

      {/* Development Mode Warning */}
      {config.debugMode && (
        <div className="p-4 rounded-lg border-l-4 bg-yellow-50 border-yellow-500">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Development Mode Active</h4>
              <p className="text-sm text-yellow-700">Debug features are enabled. This may impact performance.</p>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg border-l-4 ${
          notification.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
          notification.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
          notification.type === 'info' ? 'bg-blue-50 border-blue-500 text-blue-700' :
          'bg-red-50 border-red-500 text-red-700'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 mr-2" />}
            {notification.type === 'info' && <Info className="w-5 h-5 mr-2" />}
            {notification.message}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-white rounded-lg p-1 overflow-x-auto shadow-sm">
        {[
          { id: 'debug', label: 'Debug & Tools', icon: Bug },
          { id: 'api', label: 'API Endpoints', icon: Server },
          { id: 'logging', label: 'Logging & Monitoring', icon: FileText },
          { id: 'tools', label: 'Development Tools', icon: Code }
        ].map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-4 py-2 rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              style={{
                backgroundColor: activeTab === tab.id ? accentureTheme.primary : 'transparent'
              }}
            >
              <IconComponent className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Debug & Tools Tab */}
      {activeTab === 'debug' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Bug className="w-5 h-5 mr-2" />
                Debug Options
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Debug Mode</span>
                    <p className="text-xs text-gray-600">Enable comprehensive debugging features</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.debugMode}
                    onChange={(e) => handleConfigChange('debugMode', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Verbose Logging</span>
                    <p className="text-xs text-gray-600">Detailed logging for troubleshooting</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.verboseLogging}
                    onChange={(e) => handleConfigChange('verboseLogging', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Show Dev Tools</span>
                    <p className="text-xs text-gray-600">Display developer tools in interface</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showDevTools}
                    onChange={(e) => handleConfigChange('showDevTools', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Hot Reload</span>
                    <p className="text-xs text-gray-600">Automatically reload on code changes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enableHotReload}
                    onChange={(e) => handleConfigChange('enableHotReload', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Experimental Features</span>
                    <p className="text-xs text-gray-600">Enable experimental functionality</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.features.experimentalFeatures}
                    onChange={(e) => handleFeatureChange('experimentalFeatures', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Beta Features</span>
                    <p className="text-xs text-gray-600">Access beta features before release</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.features.betaFeatures}
                    onChange={(e) => handleFeatureChange('betaFeatures', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Mock Data</span>
                    <p className="text-xs text-gray-600">Use mock data for testing</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.features.mockData}
                    onChange={(e) => handleFeatureChange('mockData', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Skip Validation</span>
                    <p className="text-xs text-gray-600">Bypass input validation for testing</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.features.skipValidation}
                    onChange={(e) => handleFeatureChange('skipValidation', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Endpoints Tab */}
      {activeTab === 'api' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.success, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2" />
              API Endpoint Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">Current Environment</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['development', 'staging', 'production'] as const).map(env => (
                    <button
                      key={env}
                      onClick={() => handleApiEndpointChange('current', env)}
                      className={`p-3 rounded-lg border-2 transition-all capitalize ${
                        config.apiEndpoints.current === env
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {(['development', 'staging', 'production'] as const).map(env => (
                  <div key={env} className="space-y-2">
                    <Label htmlFor={env} className="text-sm font-medium capitalize">
                      {env} Endpoint
                    </Label>
                    <div className="flex space-x-2">
                      <Input
                        id={env}
                        type="url"
                        value={config.apiEndpoints[env]}
                        onChange={(e) => handleApiEndpointChange(env, e.target.value)}
                        placeholder={`https://${env}-api.example.com/api`}
                        className="flex-1"
                        icon={<Globe className="w-4 h-4" />}
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleTestEndpoint(config.apiEndpoints[env])}
                        className="px-3"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-3">Current Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Active Environment:</span>
                    <span className="font-medium capitalize text-purple-600">
                      {config.apiEndpoints.current}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current URL:</span>
                    <code className="text-xs bg-white px-2 py-1 rounded">
                      {config.apiEndpoints[config.apiEndpoints.current]}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logging & Monitoring Tab */}
      {activeTab === 'logging' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.warning, color: 'white' }}>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Logging Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="logLevel" className="text-sm font-medium mb-2">Log Level</Label>
                <select
                  id="logLevel"
                  value={config.logging.level}
                  onChange={(e) => handleLoggingChange('level', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="debug">Debug (Most Verbose)</option>
                  <option value="info">Info (Normal)</option>
                  <option value="warn">Warning (Important)</option>
                  <option value="error">Error (Critical Only)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="maxFileSize" className="text-sm font-medium mb-2">Max Log File Size (MB)</Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  min="1"
                  max="100"
                  value={config.logging.maxFileSize}
                  onChange={(e) => handleLoggingChange('maxFileSize', parseInt(e.target.value))}
                  icon={<Database className="w-4 h-4" />}
                />
              </div>

              <div>
                <Label htmlFor="retainDays" className="text-sm font-medium mb-2">Retain Logs (days)</Label>
                <Input
                  id="retainDays"
                  type="number"
                  min="1"
                  max="90"
                  value={config.logging.retainDays}
                  onChange={(e) => handleLoggingChange('retainDays', parseInt(e.target.value))}
                  icon={<Clock className="w-4 h-4" />}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Console Logging</span>
                    <p className="text-xs text-gray-600">Output logs to browser console</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.logging.enableConsole}
                    onChange={(e) => handleLoggingChange('enableConsole', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">File Logging</span>
                    <p className="text-xs text-gray-600">Save logs to file system</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.logging.enableFile}
                    onChange={(e) => handleLoggingChange('enableFile', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Live Log Viewer
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLogging(!isLogging)}
                    className="text-white hover:bg-white/20"
                  >
                    {isLogging ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLogs}
                    className="text-white hover:bg-white/20"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearLogs}
                    className="text-white hover:bg-white/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="bg-black text-green-400 font-mono text-xs h-64 overflow-y-auto p-4">
                {logEntries.map(entry => (
                  <div key={entry.id} className="mb-1">
                    <span className="text-gray-500">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`ml-2 uppercase ${getLogLevelColor(entry.level)}`}>
                      [{entry.level}]
                    </span>
                    {entry.component && (
                      <span className="text-blue-400 ml-2">
                        {entry.component}:
                      </span>
                    )}
                    <span className="ml-2">{entry.message}</span>
                    {entry.data && (
                      <div className="text-yellow-400 ml-8 mt-1">
                        {JSON.stringify(entry.data, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Development Tools Tab */}
      {activeTab === 'tools' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.error, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Code className="w-5 h-5 mr-2" />
              Performance Profiling
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-3">Profiling Options</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Enable Profiler</span>
                      <p className="text-xs text-gray-600">Track component performance</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.performance.enableProfiler}
                      onChange={(e) => handlePerformanceChange('enableProfiler', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Track Renders</span>
                      <p className="text-xs text-gray-600">Monitor component re-renders</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.performance.trackRenders}
                      onChange={(e) => handlePerformanceChange('trackRenders', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Track Memory</span>
                      <p className="text-xs text-gray-600">Monitor memory usage</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.performance.trackMemory}
                      onChange={(e) => handlePerformanceChange('trackMemory', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sampleRate" className="text-sm font-medium mb-2">Sample Rate (%)</Label>
                  <Input
                    id="sampleRate"
                    type="number"
                    min="1"
                    max="100"
                    value={config.performance.sampleRate}
                    onChange={(e) => handlePerformanceChange('sampleRate', parseInt(e.target.value))}
                    icon={<Monitor className="w-4 h-4" />}
                  />
                  <p className="text-xs text-gray-600 mt-1">Percentage of operations to profile</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Developer Tools</h4>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => showNotification('info', 'Opening React DevTools...')}
                  >
                    <Terminal className="w-4 h-4 mr-2" />
                    Open React DevTools
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => showNotification('info', 'Opening Performance Monitor...')}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Performance Monitor
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => showNotification('info', 'Opening Network Inspector...')}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Network Inspector
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => showNotification('info', 'Exporting debug data...')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Debug Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSaving}
          className="flex items-center"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: accentureTheme.primary }}
          className="text-white flex items-center"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Developer Settings'}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Developer Tools
        </p>
      </div>
    </div>
  );
};

export default DeveloperSettings;