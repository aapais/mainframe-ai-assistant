import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Button, Badge, Alert, AlertDescription,
  Separator
} from '@/components/ui';
import {
  BarChart3, Network, Search, Bot, FileText, Settings,
  AlertTriangle, TrendingUp, Users, Target, Clock,
  Activity, Database, Zap, RefreshCw, Plus, Filter
} from 'lucide-react';

// Import our Phase 3 components
import IncidentAnalytics from './IncidentAnalytics';
import IncidentRelationshipViewer from './IncidentRelationshipViewer';
import AdvancedIncidentSearch from './AdvancedIncidentSearch';
import IncidentAutomation from './IncidentAutomation';
import IncidentReporting from './IncidentReporting';

// Types
interface DashboardMetrics {
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  avgMTTR: number;
  slaCompliance: number;
  automationRate: number;
  lastUpdated: Date;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  action: () => void;
  count?: number;
  color: string;
}

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  actionable?: boolean;
}

export const IncidentManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'relationships' | 'search' | 'automation' | 'reporting'>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [selectedIncidentForRelationships, setSelectedIncidentForRelationships] = useState<string>('INC-1001');
  const [loading, setLoading] = useState(true);

  // Initialize dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock metrics data
      const mockMetrics: DashboardMetrics = {
        totalIncidents: 1247,
        openIncidents: 89,
        criticalIncidents: 12,
        avgMTTR: 18.5,
        slaCompliance: 87.2,
        automationRate: 73.4,
        lastUpdated: new Date()
      };

      // Mock system alerts
      const mockAlerts: SystemAlert[] = [
        {
          id: 'alert-1',
          type: 'warning',
          title: 'SLA Breach Alert',
          message: 'Critical incident INC-1001 has exceeded SLA response time',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          actionable: true
        },
        {
          id: 'alert-2',
          type: 'success',
          title: 'Automation Success',
          message: 'AI successfully categorized 15 incidents in the last hour',
          timestamp: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
          id: 'alert-3',
          type: 'info',
          title: 'Weekly Report Ready',
          message: 'SLA compliance report for week 3 is ready for download',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          actionable: true
        }
      ];

      setMetrics(mockMetrics);
      setSystemAlerts(mockAlerts);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Quick actions configuration
  const quickActions: QuickAction[] = [
    {
      id: 'create-incident',
      label: 'Create Incident',
      description: 'Create a new incident record',
      icon: Plus,
      action: () => console.log('Create incident'),
      color: '#3b82f6'
    },
    {
      id: 'view-critical',
      label: 'Critical Incidents',
      description: 'View all critical incidents',
      icon: AlertTriangle,
      action: () => setActiveTab('search'),
      count: metrics?.criticalIncidents,
      color: '#ef4444'
    },
    {
      id: 'sla-breaches',
      label: 'SLA Breaches',
      description: 'View incidents with SLA breaches',
      icon: Clock,
      action: () => setActiveTab('search'),
      count: Math.floor((metrics?.totalIncidents || 0) * (1 - (metrics?.slaCompliance || 0) / 100)),
      color: '#f59e0b'
    },
    {
      id: 'automation-rules',
      label: 'Automation Rules',
      description: 'Manage automation rules',
      icon: Bot,
      action: () => setActiveTab('automation'),
      count: 8,
      color: '#10b981'
    },
    {
      id: 'generate-report',
      label: 'Generate Report',
      description: 'Generate incident reports',
      icon: FileText,
      action: () => setActiveTab('reporting'),
      color: '#8b5cf6'
    },
    {
      id: 'view-relationships',
      label: 'Relationships',
      description: 'View incident relationships',
      icon: Network,
      action: () => setActiveTab('relationships'),
      color: '#06b6d4'
    }
  ];

  // Handle search execution
  const handleSearch = (criteria: any) => {
    console.log('Search criteria:', criteria);
    // Implement search logic
  };

  // Handle incident selection
  const handleIncidentSelect = (incidentId: string) => {
    setSelectedIncidentForRelationships(incidentId);
    console.log('Selected incident:', incidentId);
  };

  // Get alert icon and styling
  const getAlertConfig = (type: SystemAlert['type']) => {
    switch (type) {
      case 'error':
        return { icon: AlertTriangle, className: 'text-red-600 bg-red-50 border-red-200' };
      case 'warning':
        return { icon: AlertTriangle, className: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
      case 'success':
        return { icon: TrendingUp, className: 'text-green-600 bg-green-50 border-green-200' };
      default:
        return { icon: Activity, className: 'text-blue-600 bg-blue-50 border-blue-200' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading incident management dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incident Management</h1>
          <p className="text-gray-600 mt-1">
            Advanced incident tracking, analytics, and automation platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="relationships" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Relationships
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Advanced Search
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="reporting" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reporting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.totalIncidents.toLocaleString()}</p>
                    </div>
                    <Database className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Open Incidents</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.openIncidents}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Critical</p>
                      <p className="text-2xl font-bold text-red-600">{metrics.criticalIncidents}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg MTTR</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.avgMTTR}h</p>
                    </div>
                    <Clock className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">SLA Compliance</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.slaCompliance}%</p>
                    </div>
                    <Target className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Automation Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.automationRate}%</p>
                    </div>
                    <Zap className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* System Alerts */}
          {systemAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Alerts
                  <Badge variant="secondary">{systemAlerts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {systemAlerts.map(alert => {
                  const config = getAlertConfig(alert.type);
                  return (
                    <Alert key={alert.id} className={config.className}>
                      <config.icon className="h-4 w-4" />
                      <div className="flex items-start justify-between flex-1">
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <AlertDescription className="mt-1">
                            {alert.message}
                          </AlertDescription>
                          <p className="text-xs opacity-70 mt-2">
                            {alert.timestamp.toLocaleString()}
                          </p>
                        </div>
                        {alert.actionable && (
                          <Button variant="outline" size="sm">
                            Action
                          </Button>
                        )}
                      </div>
                    </Alert>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickActions.map(action => (
                  <div
                    key={action.id}
                    className="flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={action.action}
                  >
                    <div
                      className="p-2 rounded-full"
                      style={{ backgroundColor: `${action.color}20`, color: action.color }}
                    >
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{action.label}</h4>
                        {action.count !== undefined && (
                          <Badge variant="secondary">{action.count}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { id: 'INC-1001', title: 'DB2 Connection Pool Exhaustion', severity: 'critical', time: '5 min ago' },
                    { id: 'INC-1002', title: 'JCL Step Failure in PAYROLL Job', severity: 'high', time: '12 min ago' },
                    { id: 'INC-1003', title: 'CICS Transaction ABEND-0C4', severity: 'medium', time: '18 min ago' },
                    { id: 'INC-1004', title: 'Network Timeout in Batch Process', severity: 'low', time: '25 min ago' }
                  ].map(incident => (
                    <div key={incident.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{incident.id}</p>
                        <p className="text-sm text-gray-600">{incident.title}</p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={incident.severity === 'critical' ? 'destructive' :
                                  incident.severity === 'high' ? 'warning' : 'secondary'}
                        >
                          {incident.severity}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{incident.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automation Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { action: 'Auto-assigned DB2 incident', incident: 'INC-1001', target: 'Database Team', time: '2 min ago', icon: Users },
                    { action: 'AI categorized incident', incident: 'INC-1002', target: 'JCL (95% confidence)', time: '5 min ago', icon: Bot },
                    { action: 'Escalated critical incident', incident: 'INC-1003', target: 'Manager', time: '12 min ago', icon: TrendingUp },
                    { action: 'SLA breach notification sent', incident: 'INC-1004', target: 'oncall@company.com', time: '18 min ago', icon: AlertTriangle }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <activity.icon className="h-4 w-4 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.incident} → {activity.target}</p>
                      </div>
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <IncidentAnalytics
            timeRange="30d"
            onTimeRangeChange={(range) => console.log('Time range changed:', range)}
          />
        </TabsContent>

        <TabsContent value="relationships">
          <IncidentRelationshipViewer
            incidentId={selectedIncidentForRelationships}
            onIncidentSelect={handleIncidentSelect}
            onRelationshipCreate={(relationship) => console.log('Create relationship:', relationship)}
            onRelationshipDelete={(relationshipId) => console.log('Delete relationship:', relationshipId)}
            maxDepth={3}
            showSimilarityScores={true}
          />
        </TabsContent>

        <TabsContent value="search">
          <AdvancedIncidentSearch
            onSearch={handleSearch}
            onSearchSave={(search) => console.log('Save search:', search)}
            loading={false}
          />
        </TabsContent>

        <TabsContent value="automation">
          <IncidentAutomation
            onRuleCreate={(rule) => console.log('Create rule:', rule)}
            onRuleUpdate={(ruleId, updates) => console.log('Update rule:', ruleId, updates)}
            onRuleDelete={(ruleId) => console.log('Delete rule:', ruleId)}
            onRuleExecute={(ruleId, incidentIds) => console.log('Execute rule:', ruleId, incidentIds)}
          />
        </TabsContent>

        <TabsContent value="reporting">
          <IncidentReporting
            onTemplateCreate={(template) => console.log('Create template:', template)}
            onTemplateUpdate={(templateId, updates) => console.log('Update template:', templateId, updates)}
            onTemplateDelete={(templateId) => console.log('Delete template:', templateId)}
            onReportGenerate={(templateId, parameters, format) => console.log('Generate report:', templateId, parameters, format)}
            onReportSchedule={(templateId, schedule) => console.log('Schedule report:', templateId, schedule)}
          />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Separator />
      <div className="flex items-center justify-between text-sm text-gray-600">
        <p>
          Last updated: {metrics?.lastUpdated.toLocaleString()}
        </p>
        <p>
          Phase 3: Advanced Features - Analytics, Relationships, Search, Automation & Reporting
        </p>
      </div>
    </div>
  );
};

export default IncidentManagementDashboard;