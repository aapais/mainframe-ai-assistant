/**
 * Security Settings Component
 * Manages authentication, privacy, and security preferences
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
  Shield,
  Lock,
  Key,
  Eye,
  EyeOff,
  Smartphone,
  Fingerprint,
  Timer,
  UserCheck,
  AlertTriangle,
  Clock,
  Database,
  FileText,
  Activity,
  Settings,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Info,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  Upload,
  Globe,
  Wifi,
  Server
} from 'lucide-react';
import { useSecuritySettings, useSettingsActions } from '../../contexts/SettingsContext';

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

interface SecurityConfig {
  sessionTimeout: number;
  requireAuth: boolean;
  encryptLocalStorage: boolean;
  clearOnClose: boolean;
  allowRememberMe: boolean;
  twoFactorAuth: boolean;
  biometricAuth: boolean;
  secureMode: boolean;
  auditLog: boolean;
  // Additional security settings
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    maxAge: number; // days
  };
  loginAttempts: {
    maxAttempts: number;
    lockoutDuration: number; // minutes
    resetAfter: number; // hours
  };
  dataProtection: {
    enableEncryption: boolean;
    encryptionLevel: 'basic' | 'standard' | 'advanced';
    autoBackup: boolean;
    dataRetention: number; // days
  };
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'settings_change';
  timestamp: Date;
  details: string;
  ipAddress: string;
  userAgent: string;
}

const SecuritySettings: React.FC = () => {
  const { security } = useSecuritySettings();
  const { updateSecurity } = useSettingsActions();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'authentication' | 'privacy' | 'audit' | 'policies'>('authentication');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const [config, setConfig] = useState<SecurityConfig>({
    sessionTimeout: security.sessionTimeout,
    requireAuth: security.requireAuth,
    encryptLocalStorage: security.encryptLocalStorage,
    clearOnClose: security.clearOnClose,
    allowRememberMe: security.allowRememberMe,
    twoFactorAuth: security.twoFactorAuth,
    biometricAuth: security.biometricAuth,
    secureMode: security.secureMode,
    auditLog: security.auditLog,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      maxAge: 90
    },
    loginAttempts: {
      maxAttempts: 5,
      lockoutDuration: 15,
      resetAfter: 24
    },
    dataProtection: {
      enableEncryption: true,
      encryptionLevel: 'standard',
      autoBackup: true,
      dataRetention: 365
    }
  });

  // Mock security events for demonstration
  const [securityEvents] = useState<SecurityEvent[]>([
    {
      id: '1',
      type: 'login',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      details: 'Successful login',
      ipAddress: '192.168.1.100',
      userAgent: 'Chrome 120.0'
    },
    {
      id: '2',
      type: 'settings_change',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      details: 'Security settings updated',
      ipAddress: '192.168.1.100',
      userAgent: 'Chrome 120.0'
    },
    {
      id: '3',
      type: 'failed_login',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      details: 'Failed login attempt',
      ipAddress: '10.0.0.15',
      userAgent: 'Unknown'
    }
  ]);

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleConfigChange = useCallback(<K extends keyof SecurityConfig>(
    key: K,
    value: SecurityConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePasswordPolicyChange = useCallback((policy: keyof SecurityConfig['passwordPolicy'], value: any) => {
    setConfig(prev => ({
      ...prev,
      passwordPolicy: {
        ...prev.passwordPolicy,
        [policy]: value
      }
    }));
  }, []);

  const handleLoginAttemptsChange = useCallback((setting: keyof SecurityConfig['loginAttempts'], value: number) => {
    setConfig(prev => ({
      ...prev,
      loginAttempts: {
        ...prev.loginAttempts,
        [setting]: value
      }
    }));
  }, []);

  const handleDataProtectionChange = useCallback((setting: keyof SecurityConfig['dataProtection'], value: any) => {
    setConfig(prev => ({
      ...prev,
      dataProtection: {
        ...prev.dataProtection,
        [setting]: value
      }
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSecurity({
        sessionTimeout: config.sessionTimeout,
        requireAuth: config.requireAuth,
        encryptLocalStorage: config.encryptLocalStorage,
        clearOnClose: config.clearOnClose,
        allowRememberMe: config.allowRememberMe,
        twoFactorAuth: config.twoFactorAuth,
        biometricAuth: config.biometricAuth,
        secureMode: config.secureMode,
        auditLog: config.auditLog
      });

      showNotification('success', 'Security settings saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save security settings');
      console.error('Security settings save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      sessionTimeout: 60,
      requireAuth: false,
      encryptLocalStorage: true,
      clearOnClose: false,
      allowRememberMe: true,
      twoFactorAuth: false,
      biometricAuth: false,
      secureMode: false,
      auditLog: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: false,
        maxAge: 90
      },
      loginAttempts: {
        maxAttempts: 5,
        lockoutDuration: 15,
        resetAfter: 24
      },
      dataProtection: {
        enableEncryption: true,
        encryptionLevel: 'standard',
        autoBackup: true,
        dataRetention: 365
      }
    });
    showNotification('success', 'Security settings reset to defaults');
  };

  const getSecurityScore = () => {
    let score = 0;
    if (config.twoFactorAuth) score += 25;
    if (config.encryptLocalStorage) score += 20;
    if (config.sessionTimeout <= 30) score += 15;
    if (config.passwordPolicy.minLength >= 12) score += 15;
    if (config.passwordPolicy.requireSymbols) score += 10;
    if (config.auditLog) score += 10;
    if (config.secureMode) score += 5;
    return Math.min(score, 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return accentureTheme.success;
    if (score >= 60) return accentureTheme.warning;
    return accentureTheme.error;
  };

  const getEventIcon = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'login': return <UserCheck className="w-4 h-4 text-green-600" />;
      case 'logout': return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'failed_login': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'password_change': return <Key className="w-4 h-4 text-orange-600" />;
      case 'settings_change': return <Settings className="w-4 h-4 text-purple-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Security Settings
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Configure authentication, privacy, and security policies
        </p>
      </div>

      {/* Security Score */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: accentureTheme.accent }}>
                <Shield className="w-8 h-8" style={{ color: accentureTheme.primary }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Security Score</h3>
                <p className="text-sm text-gray-600">Based on current security configuration</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: getScoreColor(getSecurityScore()) }}>
                {getSecurityScore()}/100
              </div>
              <p className="text-sm text-gray-600">Security Level</p>
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
          { id: 'authentication', label: 'Authentication', icon: Lock },
          { id: 'privacy', label: 'Privacy & Data', icon: Eye },
          { id: 'policies', label: 'Security Policies', icon: FileText },
          { id: 'audit', label: 'Audit & Monitoring', icon: Activity }
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

      {/* Authentication Tab */}
      {activeTab === 'authentication' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Authentication Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Require Authentication</span>
                    <p className="text-xs text-gray-600">Force users to authenticate before access</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.requireAuth}
                    onChange={(e) => handleConfigChange('requireAuth', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Two-Factor Authentication</span>
                    <p className="text-xs text-gray-600">Add extra security with 2FA</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.twoFactorAuth}
                    onChange={(e) => handleConfigChange('twoFactorAuth', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Biometric Authentication</span>
                    <p className="text-xs text-gray-600">Use fingerprint or face recognition</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.biometricAuth}
                    onChange={(e) => handleConfigChange('biometricAuth', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Remember Me</span>
                    <p className="text-xs text-gray-600">Allow users to stay logged in</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.allowRememberMe}
                    onChange={(e) => handleConfigChange('allowRememberMe', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sessionTimeout" className="text-sm font-medium mb-2">Session Timeout (minutes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="5"
                  max="480"
                  value={config.sessionTimeout}
                  onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                  icon={<Timer className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Automatically log out after inactivity (5-480 minutes)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Login Security
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="maxAttempts" className="text-sm font-medium mb-2">Max Login Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min="3"
                  max="10"
                  value={config.loginAttempts.maxAttempts}
                  onChange={(e) => handleLoginAttemptsChange('maxAttempts', parseInt(e.target.value))}
                  icon={<Key className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Number of failed attempts before lockout</p>
              </div>

              <div>
                <Label htmlFor="lockoutDuration" className="text-sm font-medium mb-2">Lockout Duration (minutes)</Label>
                <Input
                  id="lockoutDuration"
                  type="number"
                  min="5"
                  max="60"
                  value={config.loginAttempts.lockoutDuration}
                  onChange={(e) => handleLoginAttemptsChange('lockoutDuration', parseInt(e.target.value))}
                  icon={<Clock className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">How long to lock account after max attempts</p>
              </div>

              <div>
                <Label htmlFor="resetAfter" className="text-sm font-medium mb-2">Reset Counter After (hours)</Label>
                <Input
                  id="resetAfter"
                  type="number"
                  min="1"
                  max="48"
                  value={config.loginAttempts.resetAfter}
                  onChange={(e) => handleLoginAttemptsChange('resetAfter', parseInt(e.target.value))}
                  icon={<RefreshCw className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Reset failed attempt counter after this time</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Privacy & Data Tab */}
      {activeTab === 'privacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.success, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                Data Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Encrypt Local Storage</span>
                    <p className="text-xs text-gray-600">Encrypt data stored locally</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.encryptLocalStorage}
                    onChange={(e) => handleConfigChange('encryptLocalStorage', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Clear Data on Close</span>
                    <p className="text-xs text-gray-600">Clear sensitive data when app closes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.clearOnClose}
                    onChange={(e) => handleConfigChange('clearOnClose', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Enable Auto Backup</span>
                    <p className="text-xs text-gray-600">Automatically backup important data</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.dataProtection.autoBackup}
                    onChange={(e) => handleDataProtectionChange('autoBackup', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="encryptionLevel" className="text-sm font-medium mb-2">Encryption Level</Label>
                <select
                  id="encryptionLevel"
                  value={config.dataProtection.encryptionLevel}
                  onChange={(e) => handleDataProtectionChange('encryptionLevel', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="basic">Basic (AES-128)</option>
                  <option value="standard">Standard (AES-256)</option>
                  <option value="advanced">Advanced (AES-256 + RSA)</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">Higher levels provide better security but may impact performance</p>
              </div>

              <div>
                <Label htmlFor="dataRetention" className="text-sm font-medium mb-2">Data Retention (days)</Label>
                <Input
                  id="dataRetention"
                  type="number"
                  min="30"
                  max="3650"
                  value={config.dataProtection.dataRetention}
                  onChange={(e) => handleDataProtectionChange('dataRetention', parseInt(e.target.value))}
                  icon={<Calendar className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">How long to keep data before automatic deletion</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.warning, color: 'white' }}>
              <CardTitle className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Privacy Options
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Secure Mode</span>
                    <p className="text-xs text-gray-600">Enhanced security with restricted features</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.secureMode}
                    onChange={(e) => handleConfigChange('secureMode', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Audit Logging</span>
                    <p className="text-xs text-gray-600">Log all security-related activities</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.auditLog}
                    onChange={(e) => handleConfigChange('auditLog', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-medium text-sm mb-3">Current Security Status</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Encryption:</span>
                    <span className="font-medium">{config.dataProtection.encryptionLevel.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session Timeout:</span>
                    <span className="font-medium">{config.sessionTimeout} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2FA Status:</span>
                    <span className={`font-medium ${config.twoFactorAuth ? 'text-green-600' : 'text-red-600'}`}>
                      {config.twoFactorAuth ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audit Log:</span>
                    <span className={`font-medium ${config.auditLog ? 'text-green-600' : 'text-red-600'}`}>
                      {config.auditLog ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Policies Tab */}
      {activeTab === 'policies' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Password & Security Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-3">Password Requirements</h4>
                <div>
                  <Label htmlFor="minLength" className="text-sm font-medium mb-2">Minimum Length</Label>
                  <Input
                    id="minLength"
                    type="number"
                    min="6"
                    max="32"
                    value={config.passwordPolicy.minLength}
                    onChange={(e) => handlePasswordPolicyChange('minLength', parseInt(e.target.value))}
                    icon={<Key className="w-4 h-4" />}
                  />
                </div>

                <div>
                  <Label htmlFor="maxAge" className="text-sm font-medium mb-2">Password Max Age (days)</Label>
                  <Input
                    id="maxAge"
                    type="number"
                    min="30"
                    max="365"
                    value={config.passwordPolicy.maxAge}
                    onChange={(e) => handlePasswordPolicyChange('maxAge', parseInt(e.target.value))}
                    icon={<Clock className="w-4 h-4" />}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 mb-3">Character Requirements</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Require Uppercase Letters</span>
                    <input
                      type="checkbox"
                      checked={config.passwordPolicy.requireUppercase}
                      onChange={(e) => handlePasswordPolicyChange('requireUppercase', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Require Lowercase Letters</span>
                    <input
                      type="checkbox"
                      checked={config.passwordPolicy.requireLowercase}
                      onChange={(e) => handlePasswordPolicyChange('requireLowercase', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Require Numbers</span>
                    <input
                      type="checkbox"
                      checked={config.passwordPolicy.requireNumbers}
                      onChange={(e) => handlePasswordPolicyChange('requireNumbers', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Require Special Characters</span>
                    <input
                      type="checkbox"
                      checked={config.passwordPolicy.requireSymbols}
                      onChange={(e) => handlePasswordPolicyChange('requireSymbols', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium text-gray-900 mb-4">Password Strength Example</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm space-y-2">
                  <div className="flex items-center space-x-2">
                    <span>Example password:</span>
                    <code className="bg-white px-2 py-1 rounded text-purple-600">
                      {config.passwordPolicy.requireSymbols ? 'MyP@ssw0rd!' : 'MyPassword123'}
                    </code>
                  </div>
                  <div className="text-xs text-gray-600">
                    Must be at least {config.passwordPolicy.minLength} characters with{' '}
                    {config.passwordPolicy.requireUppercase && 'uppercase letters, '}
                    {config.passwordPolicy.requireLowercase && 'lowercase letters, '}
                    {config.passwordPolicy.requireNumbers && 'numbers, '}
                    {config.passwordPolicy.requireSymbols && 'special characters, '}
                    and expires after {config.passwordPolicy.maxAge} days.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit & Monitoring Tab */}
      {activeTab === 'audit' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.error, color: 'white' }}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Security Event Log
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {securityEvents.map(event => (
                <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium capitalize">
                        {event.type.replace('_', ' ')}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {event.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{event.details}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>IP: {event.ipAddress}</span>
                      <span>Agent: {event.userAgent}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">12</div>
                  <p className="text-sm text-gray-600">Successful Logins (24h)</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">3</div>
                  <p className="text-sm text-gray-600">Failed Attempts (24h)</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">5</div>
                  <p className="text-sm text-gray-600">Setting Changes (7d)</p>
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
          {isSaving ? 'Saving...' : 'Save Security Settings'}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Security & Privacy
        </p>
      </div>
    </div>
  );
};

export default SecuritySettings;