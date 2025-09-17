/**
 * Profile Settings Component
 * Manages user profile information, avatar, and basic account details
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
  User,
  Mail,
  MapPin,
  Building,
  Phone,
  Calendar,
  Upload,
  Camera,
  Save,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Edit3,
  UserCheck,
  Shield
} from 'lucide-react';
import { useSettings, useSettingsActions } from '../../contexts/SettingsContext';

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

interface ProfileFormData {
  fullName: string;
  email: string;
  title: string;
  department: string;
  location: string;
  phone: string;
  bio: string;
  avatar: string;
  timezone: string;
  dateFormat: string;
  language: string;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  emailNotifications: boolean;
  activityAlerts: boolean;
}

const ProfileSettings: React.FC = () => {
  const { state } = useSettings();
  const { updateUI, updateSecurity } = useSettingsActions();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Initialize form data from settings context
  const [formData, setFormData] = useState<ProfileFormData>({
    fullName: 'John Smith', // This would come from actual user data
    email: 'john.smith@accenture.com',
    title: 'Senior AI Solutions Architect',
    department: 'Technology Innovation',
    location: 'New York, NY',
    phone: '+1 (555) 123-4567',
    bio: 'Experienced AI solutions architect specializing in mainframe modernization and intelligent automation.',
    avatar: '',
    timezone: 'America/New_York',
    dateFormat: state.settings.ui.dateFormat,
    language: state.settings.ui.language
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: state.settings.security.twoFactorAuth,
    sessionTimeout: state.settings.security.sessionTimeout,
    emailNotifications: true,
    activityAlerts: true
  });

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleInputChange = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSecurityChange = useCallback((field: keyof SecuritySettings, value: boolean | number) => {
    setSecuritySettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update UI preferences
      await updateUI({
        dateFormat: formData.dateFormat as '12h' | '24h',
        language: formData.language
      });

      // Update security settings
      await updateSecurity({
        twoFactorAuth: securitySettings.twoFactorEnabled,
        sessionTimeout: securitySettings.sessionTimeout
      });

      showNotification('success', 'Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      showNotification('error', 'Failed to update profile');
      console.error('Profile update error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('avatar', e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Profile Settings
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Manage your personal information and account preferences
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture */}
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Camera className="w-5 h-5 mr-2" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <div className="relative inline-block mb-4">
              <div
                className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mx-auto"
                style={{
                  backgroundImage: formData.avatar ? `url(${formData.avatar})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!formData.avatar && formData.fullName.split(' ').map(n => n[0]).join('')}
              </div>
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
                  <Camera className="w-4 h-4" style={{ color: accentureTheme.primary }} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{formData.fullName}</h3>
            <p className="text-sm text-gray-600">{formData.title}</p>
            <p className="text-sm text-gray-500">{formData.department}</p>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Basic Information
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="text-white hover:bg-white/20"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName" className="text-sm font-medium mb-2">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  disabled={!isEditing}
                  icon={<User className="w-4 h-4" />}
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium mb-2">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={!isEditing}
                  icon={<Mail className="w-4 h-4" />}
                />
              </div>
              <div>
                <Label htmlFor="title" className="text-sm font-medium mb-2">Job Title</Label>
                <Input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  disabled={!isEditing}
                  icon={<UserCheck className="w-4 h-4" />}
                />
              </div>
              <div>
                <Label htmlFor="department" className="text-sm font-medium mb-2">Department</Label>
                <Input
                  id="department"
                  type="text"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  disabled={!isEditing}
                  icon={<Building className="w-4 h-4" />}
                />
              </div>
              <div>
                <Label htmlFor="location" className="text-sm font-medium mb-2">Location</Label>
                <Input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={!isEditing}
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-medium mb-2">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={!isEditing}
                  icon={<Phone className="w-4 h-4" />}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="bio" className="text-sm font-medium mb-2">Bio</Label>
              <textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                disabled={!isEditing}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Tell us about yourself..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preferences */}
      <Card className="border-0 shadow-lg">
        <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Regional Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="language" className="text-sm font-medium mb-2">Language</Label>
              <select
                id="language"
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
                disabled={!isEditing}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
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
              <Label htmlFor="timezone" className="text-sm font-medium mb-2">Timezone</Label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                disabled={!isEditing}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
              >
                <option value="America/New_York">Eastern Time (UTC-5)</option>
                <option value="America/Chicago">Central Time (UTC-6)</option>
                <option value="America/Denver">Mountain Time (UTC-7)</option>
                <option value="America/Los_Angeles">Pacific Time (UTC-8)</option>
                <option value="Europe/London">London (UTC+0)</option>
                <option value="Europe/Paris">Paris (UTC+1)</option>
                <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="dateFormat" className="text-sm font-medium mb-2">Date Format</Label>
              <select
                id="dateFormat"
                value={formData.dateFormat}
                onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                disabled={!isEditing}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader style={{ backgroundColor: accentureTheme.error, color: 'white' }}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security Settings
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSecurity(!showSecurity)}
              className="text-white hover:bg-white/20"
            >
              {showSecurity ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        {showSecurity && (
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Two-Factor Authentication</h4>
                    <p className="text-xs text-gray-600">Add an extra layer of security</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.twoFactorEnabled}
                    onChange={(e) => handleSecurityChange('twoFactorEnabled', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Email Notifications</h4>
                    <p className="text-xs text-gray-600">Receive security alerts via email</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.emailNotifications}
                    onChange={(e) => handleSecurityChange('emailNotifications', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sessionTimeout" className="text-sm font-medium mb-2">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={securitySettings.sessionTimeout.toString()}
                    onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Activity Alerts</h4>
                    <p className="text-xs text-gray-600">Get notified of unusual activity</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.activityAlerts}
                    onChange={(e) => handleSecurityChange('activityAlerts', e.target.checked)}
                    disabled={!isEditing}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      {isEditing && (
        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            style={{ backgroundColor: accentureTheme.primary }}
            className="text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Profile Management
        </p>
      </div>
    </div>
  );
};

export default ProfileSettings;