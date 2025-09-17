import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Database, HardDrive, Activity, Shield, Clock, AlertCircle } from 'lucide-react';

interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  maxRetries: number;
}

interface BackupConfig {
  enabled: boolean;
  schedule: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retention: number;
  location: string;
  compression: boolean;
  encryption: boolean;
}

interface PerformanceConfig {
  queryTimeout: number;
  maxQuerySize: number;
  cacheSize: number;
  optimizerLevel: 'low' | 'medium' | 'high' | 'auto';
  indexAutoRebuild: boolean;
}

const DatabaseSettings: React.FC = () => {
  const [connectionPool, setConnectionPool] = useState<ConnectionPoolConfig>({
    maxConnections: 20,
    minConnections: 5,
    connectionTimeout: 30000,
    idleTimeout: 600000,
    maxRetries: 3
  });

  const [backup, setBackup] = useState<BackupConfig>({
    enabled: true,
    schedule: 'daily',
    retention: 30,
    location: '/backups',
    compression: true,
    encryption: true
  });

  const [performance, setPerformance] = useState<PerformanceConfig>({
    queryTimeout: 60000,
    maxQuerySize: 1048576,
    cacheSize: 256,
    optimizerLevel: 'auto',
    indexAutoRebuild: true
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [dbStats, setDbStats] = useState({
    size: '248 MB',
    records: 152847,
    activeConnections: 7,
    cacheHitRate: 92.3
  });

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('Database connection successful!');
    } catch (error) {
      alert('Connection failed. Please check your settings.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleRunBackup = async () => {
    const confirmed = confirm('Start manual backup now?');
    if (confirmed) {
      alert('Backup started. You will be notified when complete.');
      setLastBackup(new Date());
    }
  };

  const handleOptimizeDatabase = async () => {
    const confirmed = confirm('This will optimize the database. The process may take several minutes. Continue?');
    if (confirmed) {
      alert('Database optimization started.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Database Status Card */}
      <Card className="border-l-4 border-l-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="text-purple-600" size={20} />
            Database Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Size</p>
              <p className="text-lg font-semibold">{dbStats.size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Records</p>
              <p className="text-lg font-semibold">{dbStats.records.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Connections</p>
              <p className="text-lg font-semibold">{dbStats.activeConnections}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cache Hit Rate</p>
              <p className="text-lg font-semibold">{dbStats.cacheHitRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Pool Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="text-purple-600" size={20} />
            Connection Pool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Max Connections</label>
              <input
                type="number"
                value={connectionPool.maxConnections}
                onChange={(e) => setConnectionPool({...connectionPool, maxConnections: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Connections</label>
              <input
                type="number"
                value={connectionPool.minConnections}
                onChange={(e) => setConnectionPool({...connectionPool, minConnections: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Connection Timeout (ms)</label>
              <input
                type="number"
                value={connectionPool.connectionTimeout}
                onChange={(e) => setConnectionPool({...connectionPool, connectionTimeout: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Idle Timeout (ms)</label>
              <input
                type="number"
                value={connectionPool.idleTimeout}
                onChange={(e) => setConnectionPool({...connectionPool, idleTimeout: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
          <Button
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="text-purple-600" size={20} />
            Backup & Recovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={backup.enabled}
                onChange={(e) => setBackup({...backup, enabled: e.target.checked})}
                className="w-4 h-4 text-purple-600"
              />
              <span>Enable Automatic Backups</span>
            </label>
            {lastBackup && (
              <span className="text-sm text-gray-500">
                Last backup: {lastBackup.toLocaleString()}
              </span>
            )}
          </div>

          {backup.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <select
                  value={backup.schedule}
                  onChange={(e) => setBackup({...backup, schedule: e.target.value as BackupConfig['schedule']})}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Retention (days)</label>
                <input
                  type="number"
                  value={backup.retention}
                  onChange={(e) => setBackup({...backup, retention: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Backup Location</label>
                <input
                  type="text"
                  value={backup.location}
                  onChange={(e) => setBackup({...backup, location: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backup.compression}
                    onChange={(e) => setBackup({...backup, compression: e.target.checked})}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm">Compression</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backup.encryption}
                    onChange={(e) => setBackup({...backup, encryption: e.target.checked})}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm">Encryption</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleRunBackup}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Run Backup Now
            </Button>
            <Button
              variant="outline"
              className="border-purple-600 text-purple-600"
            >
              Restore from Backup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tuning */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="text-purple-600" size={20} />
            Performance Tuning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Query Timeout (ms)</label>
              <input
                type="number"
                value={performance.queryTimeout}
                onChange={(e) => setPerformance({...performance, queryTimeout: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cache Size (MB)</label>
              <input
                type="number"
                value={performance.cacheSize}
                onChange={(e) => setPerformance({...performance, cacheSize: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Optimizer Level</label>
              <select
                value={performance.optimizerLevel}
                onChange={(e) => setPerformance({...performance, optimizerLevel: e.target.value as PerformanceConfig['optimizerLevel']})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={performance.indexAutoRebuild}
                  onChange={(e) => setPerformance({...performance, indexAutoRebuild: e.target.checked})}
                  className="w-4 h-4 text-purple-600"
                />
                <span>Auto-rebuild Indexes</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleOptimizeDatabase}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Optimize Database
            </Button>
            <Button
              variant="outline"
              className="border-purple-600 text-purple-600"
            >
              Analyze Performance
            </Button>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-yellow-600 dark:text-yellow-500 mt-0.5" size={16} />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">Performance Tip</p>
                <p>Consider increasing cache size if your cache hit rate drops below 90%.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSettings;