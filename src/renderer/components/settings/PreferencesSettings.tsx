/**
 * Preferences Settings Component
 * Manages user interface preferences, themes, and application behavior
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../ui/Card';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import {
  Palette,
  Monitor,
  Smartphone,
  Sun,
  Moon,
  Settings,
  Bell,
  Globe,
  Clock,
  Type,
  Zap,
  Volume2,
  VolumeX,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Eye,
  Accessibility,
  Languages,
  Calendar
} from 'lucide-react';
import { useUIPreferences, useNotificationSettings, useSettingsActions } from '../../contexts/SettingsContext';

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

interface PreferencesFormData {
  theme: 'light' | 'dark' | 'system' | 'high-contrast';
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  fontFamily: 'system' | 'monospace' | 'serif';
  density: 'comfortable' | 'compact' | 'spacious';
  language: string;
  timeFormat: '12h' | '24h';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  numberFormat: 'US' | 'EU' | 'UK';
  animations: boolean;
  reducedMotion: boolean;
  sounds: boolean;
  notifications: boolean;
  autoSave: boolean;
  confirmActions: boolean;
  showTooltips: boolean;
  compactMode: boolean;
}

const PreferencesSettings: React.FC = () => {
  const { ui } = useUIPreferences();
  const { notifications } = useNotificationSettings();
  const { updateUI, updateNotifications } = useSettingsActions();
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState<PreferencesFormData>({
    theme: ui.theme,
    fontSize: ui.fontSize,
    fontFamily: ui.fontFamily,
    density: ui.density,
    language: ui.language,
    timeFormat: ui.timeFormat,
    dateFormat: ui.dateFormat,
    numberFormat: ui.numberFormat,
    animations: ui.animations.enabled,
    reducedMotion: ui.animations.reducedMotion,
    sounds: notifications.sound,
    notifications: notifications.enabled,
    autoSave: true, // This would come from app settings
    confirmActions: true,
    showTooltips: true,
    compactMode: false
  });

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleInputChange = useCallback((field: keyof PreferencesFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update UI preferences
      await updateUI({
        theme: formData.theme,
        fontSize: formData.fontSize,
        fontFamily: formData.fontFamily,
        density: formData.density,
        language: formData.language,
        timeFormat: formData.timeFormat,
        dateFormat: formData.dateFormat,
        numberFormat: formData.numberFormat,
        animations: {
          enabled: formData.animations,
          reducedMotion: formData.reducedMotion,
          duration: ui.animations.duration
        }
      });

      // Update notification preferences
      await updateNotifications({
        enabled: formData.notifications,
        sound: formData.sounds
      });

      showNotification('success', 'Preferences updated successfully');
    } catch (error) {
      showNotification('error', 'Failed to update preferences');
      console.error('Preferences update error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      theme: 'system',
      fontSize: 'medium',
      fontFamily: 'system',
      density: 'comfortable',
      language: 'en',
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY',
      numberFormat: 'US',
      animations: true,
      reducedMotion: false,
      sounds: false,
      notifications: true,
      autoSave: true,
      confirmActions: true,
      showTooltips: true,
      compactMode: false
    });
    showNotification('success', 'Preferences reset to defaults');
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />;
      case 'dark': return <Moon className="w-4 h-4" />;
      case 'system': return <Monitor className="w-4 h-4" />;
      case 'high-contrast': return <Eye className="w-4 h-4" />;
      default: return <Palette className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Preferences Settings
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Customize your application experience and interface preferences
        </p>
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
            {notification.type === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'warning' && <AlertCircle className="w-5 h-5 mr-2" />}
            {notification.message}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance */}
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Palette className="w-5 h-5 mr-2" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">Theme</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                  { id: 'high-contrast', label: 'High Contrast', icon: Eye }
                ].map(theme => {
                  const IconComponent = theme.icon;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleInputChange('theme', theme.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.theme === theme.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <IconComponent className="w-4 h-4" />
                        <span className="text-sm font-medium">{theme.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="fontSize" className="text-sm font-medium mb-2">Font Size</Label>
              <select
                id="fontSize"
                value={formData.fontSize}
                onChange={(e) => handleInputChange('fontSize', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="x-large">Extra Large</option>
              </select>
            </div>

            <div>
              <Label htmlFor="fontFamily" className="text-sm font-medium mb-2">Font Family</Label>
              <select
                id="fontFamily"
                value={formData.fontFamily}
                onChange={(e) => handleInputChange('fontFamily', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="system">System Default</option>
                <option value="monospace">Monospace</option>
                <option value="serif">Serif</option>
              </select>
            </div>

            <div>
              <Label htmlFor="density" className="text-sm font-medium mb-2">Interface Density</Label>
              <select
                id="density"
                value={formData.density}
                onChange={(e) => handleInputChange('density', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Localization */}
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Globe className="w-5 h-5 mr-2" />
              Localization
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="language" className="text-sm font-medium mb-2">Language</Label>
              <select
                id="language"
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="en">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <div>
              <Label htmlFor="timeFormat" className="text-sm font-medium mb-2">Time Format</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleInputChange('timeFormat', '12h')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.timeFormat === '12h'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <Clock className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-sm font-medium">12 Hour</span>
                    <p className="text-xs text-gray-600">2:30 PM</p>
                  </div>
                </button>
                <button
                  onClick={() => handleInputChange('timeFormat', '24h')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.timeFormat === '24h'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <Clock className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-sm font-medium">24 Hour</span>
                    <p className="text-xs text-gray-600">14:30</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="dateFormat" className="text-sm font-medium mb-2">Date Format</Label>
              <select
                id="dateFormat"
                value={formData.dateFormat}
                onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="numberFormat" className="text-sm font-medium mb-2">Number Format</Label>
              <select
                id="numberFormat"
                value={formData.numberFormat}
                onChange={(e) => handleInputChange('numberFormat', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="US">US (1,234.56)</option>
                <option value="EU">EU (1.234,56)</option>
                <option value="UK">UK (1,234.56)</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Behavior & Experience */}
      <Card className="border-0 shadow-lg">
        <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Behavior & Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 mb-3">Animation & Motion</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Enable Animations</span>
                    <p className="text-xs text-gray-600">Smooth transitions and effects</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.animations}
                    onChange={(e) => handleInputChange('animations', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Reduced Motion</span>
                    <p className="text-xs text-gray-600">Minimize animation for accessibility</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.reducedMotion}
                    onChange={(e) => handleInputChange('reducedMotion', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 mb-3">Notifications & Sounds</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Enable Notifications</span>
                    <p className="text-xs text-gray-600">Show system notifications</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notifications}
                    onChange={(e) => handleInputChange('notifications', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Sound Effects</span>
                    <p className="text-xs text-gray-600">Play sounds for actions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sounds}
                    onChange={(e) => handleInputChange('sounds', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 mb-3">Interface Options</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Auto-save</span>
                    <p className="text-xs text-gray-600">Automatically save changes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoSave}
                    onChange={(e) => handleInputChange('autoSave', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Confirm Actions</span>
                    <p className="text-xs text-gray-600">Ask before destructive actions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.confirmActions}
                    onChange={(e) => handleInputChange('confirmActions', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Show Tooltips</span>
                    <p className="text-xs text-gray-600">Display helpful tooltips</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.showTooltips}
                    onChange={(e) => handleInputChange('showTooltips', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Application Preferences
        </p>
      </div>
    </div>
  );
};

export default PreferencesSettings;