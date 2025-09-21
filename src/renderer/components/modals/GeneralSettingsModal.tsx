/**
 * General Settings Modal Component
 * A dedicated modal for general application settings
 */

import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose
} from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Settings,
  User,
  Palette,
  Bell,
  Globe,
  Monitor,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Check,
  Save
} from 'lucide-react';

interface GeneralSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GeneralSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    email: boolean;
    desktop: boolean;
    sound: boolean;
  };
  display: {
    density: 'comfortable' | 'compact';
    animations: boolean;
  };
  userProfile: {
    name: string;
    email: string;
  };
}

const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({
  open,
  onOpenChange
}) => {
  const [settings, setSettings] = useState<GeneralSettings>({
    theme: 'light',
    language: 'en',
    notifications: {
      email: true,
      desktop: true,
      sound: false
    },
    display: {
      density: 'comfortable',
      animations: true
    },
    userProfile: {
      name: 'User',
      email: 'user@company.com'
    }
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      setHasChanges(true);
      return newSettings;
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <ModalContent size="2xl" className="max-h-[90vh] flex flex-col">
        {/* Header */}
        <ModalHeader className="flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <ModalTitle>General Settings</ModalTitle>
              <p className="text-sm text-gray-600 mt-1">
                Configure your basic application preferences
              </p>
            </div>
          </div>
          <ModalClose />
        </ModalHeader>

        {/* Body */}
        <ModalBody className="flex-1 overflow-y-auto">
          <div className="space-y-8">
            {/* User Profile Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">User Profile</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <Input
                    type="text"
                    value={settings.userProfile.name}
                    onChange={(e) => updateSettings('userProfile.name', e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={settings.userProfile.email}
                    onChange={(e) => updateSettings('userProfile.email', e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
              </div>
            </div>

            {/* Appearance Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Palette className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Appearance</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Theme Preference
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'light', label: 'Light', icon: Sun },
                      { key: 'dark', label: 'Dark', icon: Moon },
                      { key: 'system', label: 'System', icon: Monitor }
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => updateSettings('theme', key)}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                          settings.theme === key
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-2" />
                        <div className="text-sm font-medium">{label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Display Density
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'comfortable', label: 'Comfortable', description: 'More space between elements' },
                      { key: 'compact', label: 'Compact', description: 'Fit more content on screen' }
                    ].map(({ key, label, description }) => (
                      <button
                        key={key}
                        onClick={() => updateSettings('display.density', key)}
                        className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                          settings.display.density === key
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">{label}</div>
                        <div className="text-xs text-gray-600">{description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Animations</label>
                    <p className="text-xs text-gray-600">Enable smooth transitions and animations</p>
                  </div>
                  <button
                    onClick={() => updateSettings('display.animations', !settings.display.animations)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      settings.display.animations ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        settings.display.animations ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Bell className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email Notifications', description: 'Receive updates via email' },
                  { key: 'desktop', label: 'Desktop Notifications', description: 'Show system notifications' },
                  { key: 'sound', label: 'Sound Alerts', description: 'Play sounds for notifications' }
                ].map(({ key, label, description }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {key === 'sound' && (
                        settings.notifications.sound ? 
                          <Volume2 className="w-4 h-4 text-gray-600" /> : 
                          <VolumeX className="w-4 h-4 text-gray-600" />
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-700">{label}</label>
                        <p className="text-xs text-gray-600">{description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateSettings(`notifications.${key}`, !settings.notifications[key as keyof typeof settings.notifications])}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                        settings.notifications[key as keyof typeof settings.notifications] ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          settings.notifications[key as keyof typeof settings.notifications] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Language & Region Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Language & Region</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSettings('language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Zone
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="EST">Eastern Time (GMT-5)</option>
                    <option value="PST">Pacific Time (GMT-8)</option>
                    <option value="CET">Central European Time (GMT+1)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>

        {/* Footer */}
        <ModalFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              {saved && (
                <div className="flex items-center space-x-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  <span>Settings saved successfully!</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex items-center space-x-2 ${
                  hasChanges ? 'bg-purple-600 hover:bg-purple-700' : ''
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default GeneralSettingsModal;