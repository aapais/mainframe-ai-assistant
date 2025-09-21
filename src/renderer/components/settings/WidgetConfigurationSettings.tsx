/**
 * Widget Configuration Settings Component
 * Manages dashboard widget visibility, positioning, and customization
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
  Layout,
  BarChart3,
  Activity,
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  FileText,
  Settings,
  Eye,
  EyeOff,
  Move,
  Resize,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Grid,
  Maximize2,
  Minimize2,
  MoreVertical,
  Filter
} from 'lucide-react';
import { useDashboardPreferences, useSettingsActions } from '../../contexts/SettingsContext';
import FloatingWidgetSettings from './FloatingWidgetSettings';

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

interface WidgetConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'analytics' | 'performance' | 'financial' | 'productivity' | 'system';
  enabled: boolean;
  position: { x: number; y: number; w: number; h: number };
  settings: {
    refreshInterval?: number;
    showHeader?: boolean;
    showFooter?: boolean;
    theme?: 'default' | 'minimal' | 'compact';
    dataSource?: string;
    filters?: Record<string, any>;
  };
  required?: boolean;
}

const availableWidgets: WidgetConfig[] = [
  {
    id: 'search-stats',
    title: 'Search Statistics',
    description: 'Overview of search activity and performance metrics',
    icon: <BarChart3 className="w-5 h-5" />,
    category: 'analytics',
    enabled: true,
    position: { x: 0, y: 0, w: 6, h: 4 },
    settings: {
      refreshInterval: 30000,
      showHeader: true,
      theme: 'default'
    }
  },
  {
    id: 'cost-tracker',
    title: 'Cost Tracker',
    description: 'Monitor API usage costs and budget alerts',
    icon: <DollarSign className="w-5 h-5" />,
    category: 'financial',
    enabled: true,
    position: { x: 6, y: 0, w: 6, h: 4 },
    settings: {
      refreshInterval: 60000,
      showHeader: true,
      theme: 'default'
    },
    required: true
  },
  {
    id: 'recent-searches',
    title: 'Recent Searches',
    description: 'List of recent search queries and results',
    icon: <Clock className="w-5 h-5" />,
    category: 'productivity',
    enabled: true,
    position: { x: 0, y: 4, w: 12, h: 6 },
    settings: {
      refreshInterval: 10000,
      showHeader: true,
      theme: 'compact'
    }
  },
  {
    id: 'performance-monitor',
    title: 'Performance Monitor',
    description: 'System performance metrics and health status',
    icon: <Activity className="w-5 h-5" />,
    category: 'performance',
    enabled: false,
    position: { x: 0, y: 10, w: 8, h: 5 },
    settings: {
      refreshInterval: 5000,
      showHeader: true,
      theme: 'default'
    }
  },
  {
    id: 'user-activity',
    title: 'User Activity',
    description: 'Active users and session information',
    icon: <Users className="w-5 h-5" />,
    category: 'analytics',
    enabled: false,
    position: { x: 8, y: 10, w: 4, h: 5 },
    settings: {
      refreshInterval: 30000,
      showHeader: true,
      theme: 'minimal'
    }
  },
  {
    id: 'trends-analysis',
    title: 'Trends Analysis',
    description: 'Usage trends and pattern analysis',
    icon: <TrendingUp className="w-5 h-5" />,
    category: 'analytics',
    enabled: false,
    position: { x: 0, y: 15, w: 6, h: 4 },
    settings: {
      refreshInterval: 300000,
      showHeader: true,
      theme: 'default'
    }
  },
  {
    id: 'schedule-overview',
    title: 'Schedule Overview',
    description: 'Upcoming tasks and maintenance schedules',
    icon: <Calendar className="w-5 h-5" />,
    category: 'productivity',
    enabled: false,
    position: { x: 6, y: 15, w: 6, h: 4 },
    settings: {
      refreshInterval: 60000,
      showHeader: true,
      theme: 'default'
    }
  },
  {
    id: 'reports-summary',
    title: 'Reports Summary',
    description: 'Summary of generated reports and analytics',
    icon: <FileText className="w-5 h-5" />,
    category: 'productivity',
    enabled: false,
    position: { x: 0, y: 19, w: 12, h: 3 },
    settings: {
      refreshInterval: 120000,
      showHeader: true,
      theme: 'compact'
    }
  }
];

const WidgetConfigurationSettings: React.FC = () => {
  const { dashboard } = useDashboardPreferences();
  const { updateDashboard } = useSettingsActions();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(availableWidgets);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const categories = [
    { id: 'all', label: 'All Widgets', count: widgets.length },
    { id: 'analytics', label: 'Analytics', count: widgets.filter(w => w.category === 'analytics').length },
    { id: 'financial', label: 'Financial', count: widgets.filter(w => w.category === 'financial').length },
    { id: 'performance', label: 'Performance', count: widgets.filter(w => w.category === 'performance').length },
    { id: 'productivity', label: 'Productivity', count: widgets.filter(w => w.category === 'productivity').length },
    { id: 'system', label: 'System', count: widgets.filter(w => w.category === 'system').length }
  ];

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleWidgetToggle = useCallback((widgetId: string) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, enabled: !widget.enabled }
        : widget
    ));
  }, []);

  const handleWidgetSettingChange = useCallback((widgetId: string, setting: string, value: any) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { 
            ...widget, 
            settings: { 
              ...widget.settings, 
              [setting]: value 
            }
          }
        : widget
    ));
  }, []);

  const handlePositionChange = useCallback((widgetId: string, position: { x: number; y: number; w: number; h: number }) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, position }
        : widget
    ));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const enabledWidgets = widgets.filter(w => w.enabled).map(widget => ({
        id: widget.id,
        enabled: widget.enabled,
        position: widget.position,
        settings: widget.settings
      }));

      await updateDashboard({
        widgets: enabledWidgets
      });

      showNotification('success', 'Widget configuration saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save widget configuration');
      console.error('Widget configuration save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setWidgets(availableWidgets);
    showNotification('success', 'Widget configuration reset to defaults');
  };

  const filteredWidgets = selectedCategory === 'all' 
    ? widgets 
    : widgets.filter(widget => widget.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analytics': return <BarChart3 className="w-4 h-4" />;
      case 'financial': return <DollarSign className="w-4 h-4" />;
      case 'performance': return <Activity className="w-4 h-4" />;
      case 'productivity': return <Clock className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      default: return <Grid className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Widget Configuration
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Customize your dashboard widgets and layout preferences
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Filter */}
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedCategory === category.id
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category.id)}
                      <span className="text-sm font-medium">{category.label}</span>
                    </div>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                      {category.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Widget List */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Layout className="w-5 h-5 mr-2" />
                  Available Widgets
                </div>
                <span className="text-sm">
                  {widgets.filter(w => w.enabled).length} of {widgets.length} enabled
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {filteredWidgets.map(widget => (
                  <div
                    key={widget.id}
                    className={`p-4 border rounded-lg transition-all ${
                      widget.enabled 
                        ? 'border-purple-200 bg-purple-50' 
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`p-2 rounded-lg ${
                            widget.enabled ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            {widget.icon}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-lg font-medium text-gray-900">{widget.title}</h4>
                            {widget.required && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{widget.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>Category: {widget.category}</span>
                            <span>Size: {widget.position.w}x{widget.position.h}</span>
                            <span>Refresh: {widget.settings.refreshInterval ? `${widget.settings.refreshInterval / 1000}s` : 'Manual'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={widget.enabled}
                          onChange={() => !widget.required && handleWidgetToggle(widget.id)}
                          disabled={widget.required}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    {/* Widget Settings */}
                    {widget.enabled && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs font-medium mb-1">Refresh Interval (ms)</Label>
                            <Input
                              type="number"
                              value={widget.settings.refreshInterval || 30000}
                              onChange={(e) => handleWidgetSettingChange(widget.id, 'refreshInterval', parseInt(e.target.value))}
                              min="1000"
                              step="1000"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1">Theme</Label>
                            <select
                              value={widget.settings.theme || 'default'}
                              onChange={(e) => handleWidgetSettingChange(widget.id, 'theme', e.target.value)}
                              className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="default">Default</option>
                              <option value="minimal">Minimal</option>
                              <option value="compact">Compact</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1">Width</Label>
                            <Input
                              type="number"
                              value={widget.position.w}
                              onChange={(e) => handlePositionChange(widget.id, {
                                ...widget.position,
                                w: parseInt(e.target.value)
                              })}
                              min="1"
                              max="12"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1">Height</Label>
                            <Input
                              type="number"
                              value={widget.position.h}
                              onChange={(e) => handlePositionChange(widget.id, {
                                ...widget.position,
                                h: parseInt(e.target.value)
                              })}
                              min="1"
                              max="20"
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 mt-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={widget.settings.showHeader !== false}
                              onChange={(e) => handleWidgetSettingChange(widget.id, 'showHeader', e.target.checked)}
                              className="w-3 h-3 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-600">Show Header</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={widget.settings.showFooter === true}
                              onChange={(e) => handleWidgetSettingChange(widget.id, 'showFooter', e.target.checked)}
                              className="w-3 h-3 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-600">Show Footer</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Widget Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
          <CardTitle className="flex items-center">
            <Maximize2 className="w-5 h-5 mr-2" />
            Floating Cost Widget
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <FloatingWidgetSettings
            showAdvanced={true}
            allowReset={true}
            onSettingsChange={(settings) => {
              showNotification('success', 'Floating widget settings updated');
            }}
          />
        </CardContent>
      </Card>

      {/* Layout Preview */}
      <Card className="border-0 shadow-lg">
        <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
          <CardTitle className="flex items-center">
            <Grid className="w-5 h-5 mr-2" />
            Layout Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="bg-gray-100 rounded-lg p-4 min-h-64">
            <div className="text-center text-gray-500 py-8">
              <Layout className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Dashboard Layout Preview</p>
              <p className="text-sm">Visual representation of your widget layout will appear here</p>
              <div className="mt-4 grid grid-cols-12 gap-2 max-w-md mx-auto">
                {widgets.filter(w => w.enabled).map(widget => (
                  <div
                    key={widget.id}
                    className="bg-purple-200 rounded p-2 text-xs text-center flex items-center justify-center"
                    style={{
                      gridColumn: `span ${widget.position.w}`,
                      minHeight: `${widget.position.h * 20}px`
                    }}
                  >
                    {widget.title.split(' ')[0]}
                  </div>
                ))}
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
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Widget Configuration
        </p>
      </div>
    </div>
  );
};

export default WidgetConfigurationSettings;