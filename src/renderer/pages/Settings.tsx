import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import APISettings from '../components/settings/APISettings';
import {
  Settings,
  Key,
  Database,
  Shield,
  Monitor,
  Palette,
  Bell,
  Globe
} from 'lucide-react';

// Accenture color palette
const accentureColors = {
  purple: '#A100FF',
  darkPurple: '#7F39FB',
  lightPurple: '#E8D5FF',
  gray: '#666666',
  lightGray: '#F5F5F5',
  white: '#FFFFFF'
};

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component?: React.ReactNode;
}

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('api-settings');

  const settingsSections: SettingsSection[] = [
    {
      id: 'api-settings',
      title: 'API Configuration',
      description: 'Manage AI service API keys and connections',
      icon: <Key className="w-5 h-5" />,
      component: <APISettings />
    },
    {
      id: 'database',
      title: 'Database Settings',
      description: 'Configure database connections and storage',
      icon: <Database className="w-5 h-5" />,
      component: (
        <div className="p-8 text-center text-gray-500">
          Database settings panel coming soon...
        </div>
      )
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      description: 'Security policies and privacy settings',
      icon: <Shield className="w-5 h-5" />,
      component: (
        <div className="p-8 text-center text-gray-500">
          Security settings panel coming soon...
        </div>
      )
    },
    {
      id: 'performance',
      title: 'Performance',
      description: 'Performance monitoring and optimization',
      icon: <Monitor className="w-5 h-5" />,
      component: (
        <div className="p-8 text-center text-gray-500">
          Performance settings panel coming soon...
        </div>
      )
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Theme and UI customization',
      icon: <Palette className="w-5 h-5" />,
      component: (
        <div className="p-8 text-center text-gray-500">
          Appearance settings panel coming soon...
        </div>
      )
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure notifications and alerts',
      icon: <Bell className="w-5 h-5" />,
      component: (
        <div className="p-8 text-center text-gray-500">
          Notification settings panel coming soon...
        </div>
      )
    },
    {
      id: 'general',
      title: 'General',
      description: 'General application settings',
      icon: <Globe className="w-5 h-5" />,
      component: (
        <div className="p-8 text-center text-gray-500">
          General settings panel coming soon...
        </div>
      )
    }
  ];

  const activeSettingsSection = settingsSections.find(section => section.id === activeSection);

  return (
    <div className="min-h-screen" style={{ backgroundColor: accentureColors.lightGray }}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8" style={{ color: accentureColors.purple }} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600">Configure your Accenture Mainframe AI Assistant</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg sticky top-6">
              <CardHeader style={{ backgroundColor: accentureColors.purple, color: 'white' }}>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Settings Menu
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {settingsSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors ${
                        activeSection === section.id
                          ? 'text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      style={{
                        backgroundColor: activeSection === section.id ? accentureColors.darkPurple : 'transparent'
                      }}
                    >
                      <span className={`${activeSection === section.id ? 'text-white' : 'text-gray-500'}`}>
                        {section.icon}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{section.title}</div>
                        <div className={`text-xs ${
                          activeSection === section.id ? 'text-gray-200' : 'text-gray-500'
                        }`}>
                          {section.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
            {activeSettingsSection?.component || (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="text-gray-500">
                    <Settings className="w-16 h-16 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Settings Panel</h3>
                    <p>The selected settings panel is not available.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Accenture Mainframe AI Assistant Settings
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Reset to defaults functionality
                  console.log('Reset to defaults');
                }}
              >
                Reset to Defaults
              </Button>
              <Button
                size="sm"
                style={{ backgroundColor: accentureColors.purple }}
                onClick={() => {
                  // Save all settings functionality
                  console.log('Save all settings');
                }}
              >
                Save All Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;