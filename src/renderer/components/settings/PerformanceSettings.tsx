/**
 * Performance Settings Component
 * Manages application performance, caching, and optimization settings
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
  Zap,
  Database,
  Clock,
  MemoryStick,
  HardDrive,
  Wifi,
  RefreshCw,
  TrendingUp,
  Activity,
  Settings,
  Monitor,
  Gauge,
  Server,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  Cpu,
  Download,
  Upload,
  Timer,
  FileText,
  Search
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

interface PerformanceConfig {
  searchDebounceMs: number;
  maxConcurrentRequests: number;
  cacheSize: number;
  enableOfflineMode: boolean;
  syncSettings: boolean;
  backgroundSync: boolean;
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  // Additional performance settings
  lazyLoading: boolean;
  imageOptimization: boolean;
  preloadData: boolean;
  batchRequests: boolean;
  memoryOptimization: boolean;
  resourceLimits: {
    maxMemoryUsage: number; // MB
    maxCpuUsage: number; // percentage
    maxStorageUsage: number; // MB
  };
}

const PerformanceSettings: React.FC = () => {
  const { performance } = usePerformanceSettings();
  const { updatePerformance } = useSettingsActions();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'cache' | 'requests' | 'optimization' | 'monitoring'>('cache');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const [config, setConfig] = useState<PerformanceConfig>({
    searchDebounceMs: performance.searchDebounceMs,
    maxConcurrentRequests: performance.maxConcurrentRequests,
    cacheSize: performance.cacheSize,
    enableOfflineMode: performance.enableOfflineMode,
    syncSettings: performance.syncSettings,
    backgroundSync: performance.backgroundSync,
    compressionLevel: performance.compressionLevel,
    logLevel: performance.logLevel,
    lazyLoading: true,
    imageOptimization: true,
    preloadData: false,
    batchRequests: true,
    memoryOptimization: true,
    resourceLimits: {
      maxMemoryUsage: 512,
      maxCpuUsage: 80,
      maxStorageUsage: 1024
    }
  });

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleConfigChange = useCallback(<K extends keyof PerformanceConfig>(
    key: K,
    value: PerformanceConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResourceLimitChange = useCallback((limit: keyof PerformanceConfig['resourceLimits'], value: number) => {
    setConfig(prev => ({
      ...prev,
      resourceLimits: {
        ...prev.resourceLimits,
        [limit]: value
      }
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePerformance({
        searchDebounceMs: config.searchDebounceMs,
        maxConcurrentRequests: config.maxConcurrentRequests,
        cacheSize: config.cacheSize,
        enableOfflineMode: config.enableOfflineMode,
        syncSettings: config.syncSettings,
        backgroundSync: config.backgroundSync,
        compressionLevel: config.compressionLevel,
        logLevel: config.logLevel
      });

      showNotification('success', 'Performance settings saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save performance settings');
      console.error('Performance settings save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      searchDebounceMs: 300,
      maxConcurrentRequests: 5,
      cacheSize: 100,
      enableOfflineMode: false,
      syncSettings: true,
      backgroundSync: true,
      compressionLevel: 'medium',
      logLevel: 'info',
      lazyLoading: true,
      imageOptimization: true,
      preloadData: false,
      batchRequests: true,
      memoryOptimization: true,
      resourceLimits: {
        maxMemoryUsage: 512,
        maxCpuUsage: 80,
        maxStorageUsage: 1024
      }
    });
    showNotification('success', 'Performance settings reset to defaults');
  };

  const getPerformanceScore = () => {
    let score = 0;
    if (config.cacheSize >= 100) score += 20;
    if (config.compressionLevel !== 'none') score += 15;
    if (config.lazyLoading) score += 15;
    if (config.batchRequests) score += 15;
    if (config.memoryOptimization) score += 15;
    if (config.maxConcurrentRequests <= 5) score += 10;
    if (config.searchDebounceMs >= 200) score += 10;
    return Math.min(score, 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return accentureTheme.success;
    if (score >= 60) return accentureTheme.warning;
    return accentureTheme.error;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Performance Settings
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Optimize application performance, caching, and resource usage
        </p>
      </div>

      {/* Performance Score */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: accentureTheme.accent }}>
                <TrendingUp className="w-8 h-8" style={{ color: accentureTheme.primary }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Performance Score</h3>
                <p className="text-sm text-gray-600">Based on current optimization settings</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: getScoreColor(getPerformanceScore()) }}>
                {getPerformanceScore()}/100
              </div>
              <p className="text-sm text-gray-600">Optimization Level</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          { id: 'cache', label: 'Cache & Storage', icon: Database },
          { id: 'requests', label: 'Network & Requests', icon: Wifi },
          { id: 'optimization', label: 'Optimization', icon: Zap },
          { id: 'monitoring', label: 'Monitoring & Limits', icon: Monitor }
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

      {/* Cache & Storage Tab */}
      {activeTab === 'cache' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Cache Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="cacheSize" className="text-sm font-medium mb-2">Cache Size (MB)</Label>
                <Input
                  id="cacheSize"
                  type="number"
                  min="10"
                  max="1000"
                  value={config.cacheSize}
                  onChange={(e) => handleConfigChange('cacheSize', parseInt(e.target.value))}
                  icon={<HardDrive className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Maximum cache size in megabytes (10-1000)</p>
              </div>

              <div>
                <Label htmlFor="compressionLevel" className="text-sm font-medium mb-2">Compression Level</Label>
                <select
                  id="compressionLevel"
                  value={config.compressionLevel}
                  onChange={(e) => handleConfigChange('compressionLevel', e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="none">None (Faster)</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (Slower but smaller)</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">Higher compression saves space but uses more CPU</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Enable Offline Mode</span>
                    <p className="text-xs text-gray-600">Cache data for offline access</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enableOfflineMode}
                    onChange={(e) => handleConfigChange('enableOfflineMode', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Background Sync</span>
                    <p className="text-xs text-gray-600">Sync data in the background</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.backgroundSync}
                    onChange={(e) => handleConfigChange('backgroundSync', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
              <CardTitle className="flex items-center">
                <MemoryStick className="w-5 h-5 mr-2" />
                Memory Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Memory Optimization</span>
                    <p className="text-xs text-gray-600">Automatically manage memory usage</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.memoryOptimization}
                    onChange={(e) => handleConfigChange('memoryOptimization', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Lazy Loading</span>
                    <p className="text-xs text-gray-600">Load content only when needed</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.lazyLoading}
                    onChange={(e) => handleConfigChange('lazyLoading', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Image Optimization</span>
                    <p className="text-xs text-gray-600">Compress and optimize images</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.imageOptimization}
                    onChange={(e) => handleConfigChange('imageOptimization', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Preload Data</span>
                    <p className="text-xs text-gray-600">Load frequently used data in advance</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.preloadData}
                    onChange={(e) => handleConfigChange('preloadData', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Network & Requests Tab */}
      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.success, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Wifi className="w-5 h-5 mr-2" />
                Network Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="maxConcurrentRequests" className="text-sm font-medium mb-2">Max Concurrent Requests</Label>
                <Input
                  id="maxConcurrentRequests"
                  type="number"
                  min="1"
                  max="20"
                  value={config.maxConcurrentRequests}
                  onChange={(e) => handleConfigChange('maxConcurrentRequests', parseInt(e.target.value))}
                  icon={<Upload className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Maximum number of simultaneous network requests (1-20)</p>
              </div>

              <div>
                <Label htmlFor="searchDebounceMs" className="text-sm font-medium mb-2">Search Debounce (ms)</Label>
                <Input
                  id="searchDebounceMs"
                  type="number"
                  min="0"
                  max="5000"
                  value={config.searchDebounceMs}
                  onChange={(e) => handleConfigChange('searchDebounceMs', parseInt(e.target.value))}
                  icon={<Search className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Delay before triggering search requests (0-5000ms)</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Batch Requests</span>
                    <p className="text-xs text-gray-600">Combine multiple requests into batches</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.batchRequests}
                    onChange={(e) => handleConfigChange('batchRequests', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Sync Settings</span>
                    <p className="text-xs text-gray-600">Synchronize settings across devices</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.syncSettings}
                    onChange={(e) => handleConfigChange('syncSettings', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.warning, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Request Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Timer className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                  <h4 className="text-lg font-medium">Current Settings Impact</h4>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: accentureTheme.primary }}>
                        {config.searchDebounceMs}ms
                      </div>
                      <p className="text-xs text-gray-600">Search Delay</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: accentureTheme.secondary }}>
                        {config.maxConcurrentRequests}
                      </div>
                      <p className="text-xs text-gray-600">Max Parallel</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Performance Tips:</h5>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Lower debounce = faster search, more requests</li>
                    <li>• Fewer concurrent requests = less server load</li>
                    <li>• Batch requests reduce network overhead</li>
                    <li>• Background sync keeps data fresh</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Optimization Tab */}
      {activeTab === 'optimization' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Performance Optimization
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-3">Rendering Optimization</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Lazy Loading</span>
                      <p className="text-xs text-gray-600">Load components on demand</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.lazyLoading}
                      onChange={(e) => handleConfigChange('lazyLoading', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Image Optimization</span>
                      <p className="text-xs text-gray-600">Compress and optimize images</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.imageOptimization}
                      onChange={(e) => handleConfigChange('imageOptimization', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-3">Data Management</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Preload Data</span>
                      <p className="text-xs text-gray-600">Cache frequently used data</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.preloadData}
                      onChange={(e) => handleConfigChange('preloadData', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Batch Requests</span>
                      <p className="text-xs text-gray-600">Combine multiple API calls</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.batchRequests}
                      onChange={(e) => handleConfigChange('batchRequests', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-3">System Optimization</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Memory Optimization</span>
                      <p className="text-xs text-gray-600">Manage memory usage</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.memoryOptimization}
                      onChange={(e) => handleConfigChange('memoryOptimization', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Background Sync</span>
                      <p className="text-xs text-gray-600">Sync data in background</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.backgroundSync}
                      onChange={(e) => handleConfigChange('backgroundSync', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring & Limits Tab */}
      {activeTab === 'monitoring' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.error, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Gauge className="w-5 h-5 mr-2" />
                Resource Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="maxMemoryUsage" className="text-sm font-medium mb-2">Max Memory Usage (MB)</Label>
                <Input
                  id="maxMemoryUsage"
                  type="number"
                  min="128"
                  max="2048"
                  value={config.resourceLimits.maxMemoryUsage}
                  onChange={(e) => handleResourceLimitChange('maxMemoryUsage', parseInt(e.target.value))}
                  icon={<MemoryStick className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Maximum memory usage before cleanup (128-2048 MB)</p>
              </div>

              <div>
                <Label htmlFor="maxCpuUsage" className="text-sm font-medium mb-2">Max CPU Usage (%)</Label>
                <Input
                  id="maxCpuUsage"
                  type="number"
                  min="50"
                  max="100"
                  value={config.resourceLimits.maxCpuUsage}
                  onChange={(e) => handleResourceLimitChange('maxCpuUsage', parseInt(e.target.value))}
                  icon={<Cpu className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Maximum CPU usage threshold (50-100%)</p>
              </div>

              <div>
                <Label htmlFor="maxStorageUsage" className="text-sm font-medium mb-2">Max Storage Usage (MB)</Label>
                <Input
                  id="maxStorageUsage"
                  type="number"
                  min="256"
                  max="4096"
                  value={config.resourceLimits.maxStorageUsage}
                  onChange={(e) => handleResourceLimitChange('maxStorageUsage', parseInt(e.target.value))}
                  icon={<HardDrive className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Maximum storage usage for cache and temp files</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.success, color: 'white' }}>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Logging & Debug
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="logLevel" className="text-sm font-medium mb-2">Log Level</Label>
                <select
                  id="logLevel"
                  value={config.logLevel}
                  onChange={(e) => handleConfigChange('logLevel', e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="debug">Debug (Verbose)</option>
                  <option value="info">Info (Normal)</option>
                  <option value="warn">Warning (Important)</option>
                  <option value="error">Error (Critical only)</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">Level of detail in application logs</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-sm mb-3">Current Resource Usage</h5>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Memory</span>
                      <span>45% of {config.resourceLimits.maxMemoryUsage}MB</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>CPU</span>
                      <span>32% of {config.resourceLimits.maxCpuUsage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '32%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Storage</span>
                      <span>67% of {config.resourceLimits.maxStorageUsage}MB</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '67%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
          {isSaving ? 'Saving...' : 'Save Performance Settings'}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Performance Optimization
        </p>
      </div>
    </div>
  );
};

export default PerformanceSettings;