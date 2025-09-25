import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { UserPreferences } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { Select } from '../../ui/Select';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Separator } from '../../ui/Separator';
import { 
  Settings, 
  Moon, 
  Sun, 
  Monitor,
  Globe,
  Clock,
  Bell,
  Mail,
  Smartphone,
  Shield,
  Eye,
  Database,
  CheckCircle,
  AlertCircle,
  Save
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface PreferencesSettingsProps {
  className?: string;
}

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'Auto', icon: Monitor }
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' }
];

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' }
];

export const PreferencesSettings: React.FC<PreferencesSettingsProps> = ({ className }) => {
  const { user, updatePreferences } = useAuth();
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/auth/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      } else {
        // Set default preferences if none exist
        setPreferences({
          theme: 'auto',
          language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          notifications: {
            email: true,
            push: false,
            security: true,
            marketing: false
          },
          privacy: {
            profileVisibility: 'private',
            activityTracking: false,
            dataCollection: false
          }
        });
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError('Failed to load preferences');
    }
  };

  const handlePreferenceChange = (key: string, value: any) => {
    setPreferences(prev => {
      const updated = { ...prev };
      
      // Handle nested objects
      if (key.includes('.')) {
        const [parentKey, childKey] = key.split('.');
        updated[parentKey as keyof UserPreferences] = {
          ...(prev[parentKey as keyof UserPreferences] as object),
          [childKey]: value
        };
      } else {
        updated[key as keyof UserPreferences] = value;
      }
      
      return updated;
    });
    
    setHasChanges(true);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await updatePreferences(preferences);
      
      setSuccess('Preferences saved successfully');
      setHasChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    loadPreferences();
    setHasChanges(false);
    setError(null);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Preferences</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customize your account settings and preferences
          </p>
        </CardHeader>
        <CardContent>
          {/* Alert Messages */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800 mb-4">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Save Actions */}
          {hasChanges && (
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg mb-6">
              <div className="flex-1">
                <p className="text-sm font-medium">You have unsaved changes</p>
                <p className="text-xs text-muted-foreground">
                  Don't forget to save your preferences
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isLoading}>
                  <Save className="w-4 h-4 mr-1" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display & Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Display & Interface</CardTitle>
          <p className="text-sm text-muted-foreground">
            Customize the look and feel of your interface
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {themes.map((theme) => {
                const IconComponent = theme.icon;
                return (
                  <button
                    key={theme.value}
                    onClick={() => handlePreferenceChange('theme', theme.value)}
                    className={cn(
                      "flex flex-col items-center space-y-2 p-3 rounded-lg border transition-colors",
                      preferences.theme === theme.value
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-muted"
                    )}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-xs font-medium">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>Language</span>
            </label>
            <Select
              value={preferences.language || 'en'}
              onValueChange={(value) => handlePreferenceChange('language', value)}
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Timezone</span>
            </label>
            <Select
              value={preferences.timezone || 'UTC'}
              onValueChange={(value) => handlePreferenceChange('timezone', value)}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notifications</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage how you receive notifications
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notifications?.email || false}
                onCheckedChange={(checked) => handlePreferenceChange('notifications.email', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notifications?.push || false}
                onCheckedChange={(checked) => handlePreferenceChange('notifications.push', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Security Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Important security and account notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notifications?.security || false}
                onCheckedChange={(checked) => handlePreferenceChange('notifications.security', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Marketing Communications</p>
                  <p className="text-xs text-muted-foreground">
                    Product updates and promotional content
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.notifications?.marketing || false}
                onCheckedChange={(checked) => handlePreferenceChange('notifications.marketing', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>Privacy</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Control your privacy and data sharing preferences
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Profile Visibility</label>
              <Select
                value={preferences.privacy?.profileVisibility || 'private'}
                onValueChange={(value) => handlePreferenceChange('privacy.profileVisibility', value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Control who can see your profile information
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Activity Tracking</p>
                  <p className="text-xs text-muted-foreground">
                    Allow tracking of your activity for analytics
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.privacy?.activityTracking || false}
                onCheckedChange={(checked) => handlePreferenceChange('privacy.activityTracking', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Data Collection</p>
                  <p className="text-xs text-muted-foreground">
                    Allow collection of usage data to improve the service
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.privacy?.dataCollection || false}
                onCheckedChange={(checked) => handlePreferenceChange('privacy.dataCollection', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button (Sticky Bottom) */}
      {hasChanges && (
        <div className="sticky bottom-6 z-10">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  You have unsaved changes
                </p>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleReset} disabled={isLoading}>
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PreferencesSettings;