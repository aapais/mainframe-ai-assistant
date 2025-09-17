/**
 * Layout Settings Component
 * Manages dashboard layout options, grid configurations, and display preferences
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
  Grid,
  Columns,
  Rows,
  Monitor,
  Smartphone,
  Tablet,
  Maximize2,
  Minimize2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoreHorizontal,
  MoreVertical,
  Square,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Settings,
  Sidebar,
  PanelLeftOpen,
  PanelRightOpen,
  Eye,
  EyeOff
} from 'lucide-react';
import { useDashboardPreferences, useUIPreferences, useSettingsActions } from '../../contexts/SettingsContext';

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

interface LayoutConfig {
  layout: 'grid' | 'list' | 'compact' | 'masonry';
  gridColumns: number;
  gridGap: number;
  sidebarPosition: 'left' | 'right' | 'hidden';
  sidebarWidth: number;
  headerHeight: number;
  footerVisible: boolean;
  density: 'comfortable' | 'compact' | 'spacious';
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  responsive: boolean;
  autoLayout: boolean;
}

const defaultLayouts = {
  grid: {
    name: 'Grid Layout',
    description: 'Organized grid with equal-sized widgets',
    icon: <Grid className="w-6 h-6" />,
    preview: 'grid-preview'
  },
  list: {
    name: 'List Layout',
    description: 'Vertical list with full-width widgets',
    icon: <Rows className="w-6 h-6" />,
    preview: 'list-preview'
  },
  compact: {
    name: 'Compact Layout',
    description: 'Dense layout with smaller widgets',
    icon: <Square className="w-6 h-6" />,
    preview: 'compact-preview'
  },
  masonry: {
    name: 'Masonry Layout',
    description: 'Dynamic layout with varied widget sizes',
    icon: <Layout className="w-6 h-6" />,
    preview: 'masonry-preview'
  }
};

const LayoutSettings: React.FC = () => {
  const { dashboard } = useDashboardPreferences();
  const { ui } = useUIPreferences();
  const { updateDashboard, updateUI } = useSettingsActions();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'grid' | 'sidebar' | 'responsive'>('layout');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    layout: dashboard.layout,
    gridColumns: 12,
    gridGap: 16,
    sidebarPosition: ui.sidebarPosition,
    sidebarWidth: 280,
    headerHeight: 64,
    footerVisible: true,
    density: ui.density,
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1280
    },
    responsive: true,
    autoLayout: dashboard.compactMode
  });

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleConfigChange = useCallback(<K extends keyof LayoutConfig>(
    key: K,
    value: LayoutConfig[K]
  ) => {
    setLayoutConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleBreakpointChange = useCallback((breakpoint: keyof LayoutConfig['breakpoints'], value: number) => {
    setLayoutConfig(prev => ({
      ...prev,
      breakpoints: {
        ...prev.breakpoints,
        [breakpoint]: value
      }
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update dashboard preferences
      await updateDashboard({
        layout: layoutConfig.layout,
        compactMode: layoutConfig.autoLayout
      });

      // Update UI preferences
      await updateUI({
        sidebarPosition: layoutConfig.sidebarPosition,
        density: layoutConfig.density
      });

      showNotification('success', 'Layout settings saved successfully');
    } catch (error) {
      showNotification('error', 'Failed to save layout settings');
      console.error('Layout settings save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLayoutConfig({
      layout: 'grid',
      gridColumns: 12,
      gridGap: 16,
      sidebarPosition: 'left',
      sidebarWidth: 280,
      headerHeight: 64,
      footerVisible: true,
      density: 'comfortable',
      breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1280
      },
      responsive: true,
      autoLayout: false
    });
    showNotification('success', 'Layout settings reset to defaults');
  };

  const renderLayoutPreview = (layoutType: string) => {
    const baseClasses = "w-full h-32 rounded-lg border-2 transition-all duration-200";
    const selectedClasses = "border-purple-500 bg-purple-50";
    const defaultClasses = "border-gray-200 bg-gray-50 hover:border-gray-300";
    
    const isSelected = layoutConfig.layout === layoutType;
    const classes = `${baseClasses} ${isSelected ? selectedClasses : defaultClasses}`;

    switch (layoutType) {
      case 'grid':
        return (
          <div className={classes}>
            <div className="p-3 h-full">
              <div className="grid grid-cols-3 gap-2 h-full">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
        );
      case 'list':
        return (
          <div className={classes}>
            <div className="p-3 h-full flex flex-col space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`h-4 rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
        );
      case 'compact':
        return (
          <div className={classes}>
            <div className="p-2 h-full">
              <div className="grid grid-cols-4 gap-1 h-full">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
        );
      case 'masonry':
        return (
          <div className={classes}>
            <div className="p-3 h-full">
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`} />
                <div className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'} row-span-2`} />
                <div className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`} />
                <div className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'} row-span-2`} />
                <div className={`rounded ${isSelected ? 'bg-purple-200' : 'bg-gray-200'}`} />
              </div>
            </div>
          </div>
        );
      default:
        return <div className={classes} />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6" style={{ backgroundColor: accentureTheme.background }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: accentureTheme.primary }}>
          Layout Settings
        </h1>
        <p className="text-base" style={{ color: accentureTheme.textSecondary }}>
          Configure dashboard layout, grid options, and responsive behavior
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

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-white rounded-lg p-1 overflow-x-auto shadow-sm">
        {[
          { id: 'layout', label: 'Layout Type', icon: Layout },
          { id: 'grid', label: 'Grid Options', icon: Grid },
          { id: 'sidebar', label: 'Sidebar', icon: Sidebar },
          { id: 'responsive', label: 'Responsive', icon: Monitor }
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

      {/* Layout Type Tab */}
      {activeTab === 'layout' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.primary, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Layout className="w-5 h-5 mr-2" />
              Dashboard Layout Type
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(defaultLayouts).map(([key, layout]) => (
                <div key={key} className="space-y-3">
                  <button
                    onClick={() => handleConfigChange('layout', key as any)}
                    className="w-full text-left"
                  >
                    {renderLayoutPreview(key)}
                  </button>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      {layout.icon}
                      <h3 className="text-lg font-medium">{layout.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{layout.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Auto Layout</h4>
                  <p className="text-xs text-gray-600">Automatically arrange widgets for optimal space usage</p>
                </div>
                <input
                  type="checkbox"
                  checked={layoutConfig.autoLayout}
                  onChange={(e) => handleConfigChange('autoLayout', e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Options Tab */}
      {activeTab === 'grid' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.secondary, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Grid className="w-5 h-5 mr-2" />
              Grid Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="gridColumns" className="text-sm font-medium mb-2">Grid Columns</Label>
                <Input
                  id="gridColumns"
                  type="number"
                  min="6"
                  max="24"
                  value={layoutConfig.gridColumns}
                  onChange={(e) => handleConfigChange('gridColumns', parseInt(e.target.value))}
                  icon={<Columns className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Number of columns in the grid system (6-24)</p>
              </div>

              <div>
                <Label htmlFor="gridGap" className="text-sm font-medium mb-2">Grid Gap (px)</Label>
                <Input
                  id="gridGap"
                  type="number"
                  min="0"
                  max="32"
                  value={layoutConfig.gridGap}
                  onChange={(e) => handleConfigChange('gridGap', parseInt(e.target.value))}
                  icon={<Move className="w-4 h-4" />}
                />
                <p className="text-xs text-gray-600 mt-1">Space between grid items in pixels</p>
              </div>

              <div>
                <Label htmlFor="density" className="text-sm font-medium mb-2">Interface Density</Label>
                <select
                  id="density"
                  value={layoutConfig.density}
                  onChange={(e) => handleConfigChange('density', e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="spacious">Spacious</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">Overall spacing and padding density</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <h4 className="text-lg font-medium mb-4">Grid Preview</h4>
              <div className="bg-gray-100 rounded-lg p-4 min-h-32">
                <div 
                  className="grid gap-2 h-full"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(layoutConfig.gridColumns, 12)}, 1fr)`,
                    gap: `${layoutConfig.gridGap / 4}px`
                  }}
                >
                  {[...Array(Math.min(layoutConfig.gridColumns, 12))].map((_, i) => (
                    <div key={i} className="bg-purple-200 rounded h-8 flex items-center justify-center text-xs">
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sidebar Tab */}
      {activeTab === 'sidebar' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.text, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Sidebar className="w-5 h-5 mr-2" />
              Sidebar Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Sidebar Position</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'left', label: 'Left', icon: PanelLeftOpen },
                      { value: 'right', label: 'Right', icon: PanelRightOpen },
                      { value: 'hidden', label: 'Hidden', icon: EyeOff }
                    ].map(position => {
                      const IconComponent = position.icon;
                      return (
                        <button
                          key={position.value}
                          onClick={() => handleConfigChange('sidebarPosition', position.value as any)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            layoutConfig.sidebarPosition === position.value
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <IconComponent className="w-5 h-5" />
                            <span className="text-sm font-medium">{position.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {layoutConfig.sidebarPosition !== 'hidden' && (
                  <div>
                    <Label htmlFor="sidebarWidth" className="text-sm font-medium mb-2">Sidebar Width (px)</Label>
                    <Input
                      id="sidebarWidth"
                      type="number"
                      min="200"
                      max="400"
                      value={layoutConfig.sidebarWidth}
                      onChange={(e) => handleConfigChange('sidebarWidth', parseInt(e.target.value))}
                      icon={<Resize className="w-4 h-4" />}
                    />
                    <p className="text-xs text-gray-600 mt-1">Width of the sidebar in pixels (200-400)</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="headerHeight" className="text-sm font-medium mb-2">Header Height (px)</Label>
                  <Input
                    id="headerHeight"
                    type="number"
                    min="48"
                    max="96"
                    value={layoutConfig.headerHeight}
                    onChange={(e) => handleConfigChange('headerHeight', parseInt(e.target.value))}
                    icon={<Rows className="w-4 h-4" />}
                  />
                  <p className="text-xs text-gray-600 mt-1">Height of the main header in pixels</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Show Footer</h4>
                    <p className="text-xs text-gray-600">Display footer at bottom of layout</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={layoutConfig.footerVisible}
                    onChange={(e) => handleConfigChange('footerVisible', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-4">Layout Preview</h4>
                <div className="bg-gray-100 rounded-lg p-4 h-64 relative overflow-hidden">
                  {/* Header */}
                  <div 
                    className="bg-purple-200 rounded mb-2"
                    style={{ height: `${(layoutConfig.headerHeight / 400) * 100}%` }}
                  >
                    <div className="p-2 text-xs text-center">Header</div>
                  </div>
                  
                  <div className="flex h-full">
                    {/* Sidebar */}
                    {layoutConfig.sidebarPosition !== 'hidden' && (
                      <div 
                        className={`bg-purple-300 rounded mr-2 ${
                          layoutConfig.sidebarPosition === 'right' ? 'order-2 ml-2 mr-0' : ''
                        }`}
                        style={{ width: `${(layoutConfig.sidebarWidth / 1200) * 100}%` }}
                      >
                        <div className="p-2 text-xs text-center">Sidebar</div>
                      </div>
                    )}
                    
                    {/* Main Content */}
                    <div className="flex-1 bg-purple-100 rounded">
                      <div className="p-2 text-xs text-center">Main Content</div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  {layoutConfig.footerVisible && (
                    <div className="bg-purple-200 rounded mt-2 h-6">
                      <div className="p-1 text-xs text-center">Footer</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Responsive Tab */}
      {activeTab === 'responsive' && (
        <Card className="border-0 shadow-lg">
          <CardHeader style={{ backgroundColor: accentureTheme.warning, color: 'white' }}>
            <CardTitle className="flex items-center">
              <Monitor className="w-5 h-5 mr-2" />
              Responsive Breakpoints
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Enable Responsive Layout</h4>
                  <p className="text-xs text-gray-600">Automatically adjust layout based on screen size</p>
                </div>
                <input
                  type="checkbox"
                  checked={layoutConfig.responsive}
                  onChange={(e) => handleConfigChange('responsive', e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
              </div>

              {layoutConfig.responsive && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="mobileBp" className="text-sm font-medium mb-2">Mobile Breakpoint</Label>
                    <Input
                      id="mobileBp"
                      type="number"
                      min="320"
                      max="1024"
                      value={layoutConfig.breakpoints.mobile}
                      onChange={(e) => handleBreakpointChange('mobile', parseInt(e.target.value))}
                      icon={<Smartphone className="w-4 h-4" />}
                    />
                    <p className="text-xs text-gray-600 mt-1">Maximum width for mobile layout (px)</p>
                  </div>

                  <div>
                    <Label htmlFor="tabletBp" className="text-sm font-medium mb-2">Tablet Breakpoint</Label>
                    <Input
                      id="tabletBp"
                      type="number"
                      min="768"
                      max="1440"
                      value={layoutConfig.breakpoints.tablet}
                      onChange={(e) => handleBreakpointChange('tablet', parseInt(e.target.value))}
                      icon={<Tablet className="w-4 h-4" />}
                    />
                    <p className="text-xs text-gray-600 mt-1">Maximum width for tablet layout (px)</p>
                  </div>

                  <div>
                    <Label htmlFor="desktopBp" className="text-sm font-medium mb-2">Desktop Breakpoint</Label>
                    <Input
                      id="desktopBp"
                      type="number"
                      min="1024"
                      max="2560"
                      value={layoutConfig.breakpoints.desktop}
                      onChange={(e) => handleBreakpointChange('desktop', parseInt(e.target.value))}
                      icon={<Monitor className="w-4 h-4" />}
                    />
                    <p className="text-xs text-gray-600 mt-1">Minimum width for desktop layout (px)</p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t">
                <h4 className="text-lg font-medium mb-4">Responsive Preview</h4>
                <div className="space-y-4">
                  {[
                    { device: 'Mobile', width: layoutConfig.breakpoints.mobile, icon: Smartphone },
                    { device: 'Tablet', width: layoutConfig.breakpoints.tablet, icon: Tablet },
                    { device: 'Desktop', width: layoutConfig.breakpoints.desktop, icon: Monitor }
                  ].map(({ device, width, icon: Icon }) => (
                    <div key={device} className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 w-24">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{device}</span>
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-lg h-8 relative overflow-hidden">
                        <div 
                          className="bg-purple-400 h-full rounded-lg transition-all duration-300"
                          style={{ width: `${Math.min((width / 1920) * 100, 100)}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                          {width}px
                        </span>
                      </div>
                    </div>
                  ))}
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
          {isSaving ? 'Saving...' : 'Save Layout Settings'}
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t">
        <p className="text-sm" style={{ color: accentureTheme.textSecondary }}>
          Accenture Mainframe AI Assistant • Layout Configuration
        </p>
      </div>
    </div>
  );
};

export default LayoutSettings;