import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Textarea, Switch, Badge, Separator, Alert, AlertDescription,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Progress, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui';
import {
  Bot, Settings, Zap, Brain, Target, Users, AlertTriangle, CheckCircle,
  Play, Pause, Edit, Trash2, Plus, Eye, Clock, TrendingUp,
  Cpu, FileText, Mail, Bell, Workflow, GitBranch, Filter,
  Save, RefreshCw, Info, Warning, ChevronRight, ChevronDown
} from 'lucide-react';

// Types for automation
interface AutomationRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'auto_assign' | 'auto_categorize' | 'auto_escalate' | 'auto_close' | 'notification';
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  priority: number;
  successCount: number;
  failureCount: number;
  lastExecuted?: Date;
  createdAt: Date;
  createdBy: string;
}

interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

interface RuleAction {
  type: 'assign_to' | 'set_category' | 'set_severity' | 'set_priority' | 'add_tag' | 'escalate' | 'send_notification' | 'close_incident' | 'link_kb';
  parameters: Record<string, any>;
}

interface AICategorizationResult {
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
  keywords: string[];
  similarIncidents: string[];
}

interface AutomationMetrics {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  categoriesProcessed: number;
  assignmentsAutomated: number;
  escalationsTriggered: number;
  notificationsSent: number;
}

interface IncidentAutomationProps {
  onRuleCreate?: (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'successCount' | 'failureCount'>) => void;
  onRuleUpdate?: (ruleId: string, updates: Partial<AutomationRule>) => void;
  onRuleDelete?: (ruleId: string) => void;
  onRuleExecute?: (ruleId: string, incidentIds: string[]) => void;
  rules?: AutomationRule[];
  metrics?: AutomationMetrics;
}

// Rule type configurations
const RULE_TYPES = [
  {
    value: 'auto_assign',
    label: 'Auto Assignment',
    description: 'Automatically assign incidents to teams or individuals',
    icon: Users,
    color: '#3b82f6'
  },
  {
    value: 'auto_categorize',
    label: 'Auto Categorization',
    description: 'Automatically categorize incidents using AI',
    icon: Target,
    color: '#10b981'
  },
  {
    value: 'auto_escalate',
    label: 'Auto Escalation',
    description: 'Automatically escalate incidents based on criteria',
    icon: TrendingUp,
    color: '#f59e0b'
  },
  {
    value: 'auto_close',
    label: 'Auto Close',
    description: 'Automatically close resolved incidents',
    icon: CheckCircle,
    color: '#22c55e'
  },
  {
    value: 'notification',
    label: 'Notifications',
    description: 'Send notifications based on incident events',
    icon: Bell,
    color: '#8b5cf6'
  }
];

const CONDITION_FIELDS = [
  { value: 'title', label: 'Title', type: 'text' },
  { value: 'description', label: 'Description', type: 'text' },
  { value: 'category', label: 'Category', type: 'select', options: ['JCL', 'DB2', 'CICS', 'Batch', 'VSAM', 'Network', 'Security'] },
  { value: 'severity', label: 'Severity', type: 'select', options: ['critical', 'high', 'medium', 'low'] },
  { value: 'status', label: 'Status', type: 'select', options: ['open', 'in_progress', 'resolved', 'closed'] },
  { value: 'assigned_team', label: 'Assigned Team', type: 'text' },
  { value: 'assigned_to', label: 'Assigned To', type: 'text' },
  { value: 'age_hours', label: 'Age (hours)', type: 'number' },
  { value: 'escalation_count', label: 'Escalation Count', type: 'number' },
  { value: 'tags', label: 'Tags', type: 'text' }
];

const ACTION_TYPES = [
  { value: 'assign_to', label: 'Assign To', parameters: ['assignee'] },
  { value: 'assign_to_team', label: 'Assign To Team', parameters: ['team'] },
  { value: 'set_category', label: 'Set Category', parameters: ['category'] },
  { value: 'set_severity', label: 'Set Severity', parameters: ['severity'] },
  { value: 'set_priority', label: 'Set Priority', parameters: ['priority'] },
  { value: 'add_tag', label: 'Add Tag', parameters: ['tag'] },
  { value: 'escalate', label: 'Escalate', parameters: ['escalate_to', 'reason'] },
  { value: 'send_notification', label: 'Send Notification', parameters: ['recipients', 'template'] },
  { value: 'close_incident', label: 'Close Incident', parameters: ['resolution_type', 'resolution'] },
  { value: 'link_kb', label: 'Link KB Entry', parameters: ['kb_entry_id'] }
];

export const IncidentAutomation: React.FC<IncidentAutomationProps> = ({
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleExecute,
  rules = [],
  metrics
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'ai' | 'metrics'>('overview');
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [aiCategorization, setAiCategorization] = useState<AICategorizationResult | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // New rule form state
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    description: '',
    ruleType: 'auto_assign',
    conditions: [{ field: 'category', operator: 'equals', value: '', logicalOperator: 'AND' }],
    actions: [{ type: 'assign_to', parameters: {} }],
    enabled: true,
    priority: 100
  });

  // AI categorization test state
  const [testIncidentText, setTestIncidentText] = useState('');

  // Mock data for demonstration
  const mockMetrics: AutomationMetrics = {
    totalRules: rules.length || 12,
    activeRules: rules.filter(r => r.enabled).length || 8,
    totalExecutions: 1247,
    successRate: 94.2,
    avgExecutionTime: 1.3,
    categoriesProcessed: 892,
    assignmentsAutomated: 467,
    escalationsTriggered: 23,
    notificationsSent: 156,
    ...metrics
  };

  const mockRules: AutomationRule[] = rules.length > 0 ? rules : [
    {
      id: 'rule-001',
      name: 'Auto-assign DB2 incidents',
      description: 'Automatically assign DB2 incidents to database team',
      ruleType: 'auto_assign',
      conditions: [
        { field: 'category', operator: 'equals', value: 'DB2', logicalOperator: 'AND' }
      ],
      actions: [
        { type: 'assign_to_team', parameters: { team: 'Database Team' } }
      ],
      enabled: true,
      priority: 10,
      successCount: 234,
      failureCount: 3,
      lastExecuted: new Date('2024-01-17T14:30:00'),
      createdAt: new Date('2024-01-01T10:00:00'),
      createdBy: 'admin'
    },
    {
      id: 'rule-002',
      name: 'Escalate critical incidents',
      description: 'Auto-escalate critical incidents if not assigned within 30 minutes',
      ruleType: 'auto_escalate',
      conditions: [
        { field: 'severity', operator: 'equals', value: 'critical', logicalOperator: 'AND' },
        { field: 'status', operator: 'equals', value: 'open', logicalOperator: 'AND' },
        { field: 'age_hours', operator: 'greater_than', value: 0.5 }
      ],
      actions: [
        { type: 'escalate', parameters: { escalate_to: 'Manager', reason: 'Critical incident not assigned within SLA' } },
        { type: 'send_notification', parameters: { recipients: ['oncall@company.com'], template: 'critical_escalation' } }
      ],
      enabled: true,
      priority: 5,
      successCount: 12,
      failureCount: 0,
      lastExecuted: new Date('2024-01-17T16:45:00'),
      createdAt: new Date('2024-01-02T14:00:00'),
      createdBy: 'admin'
    },
    {
      id: 'rule-003',
      name: 'AI Auto-categorization',
      description: 'Use AI to automatically categorize new incidents',
      ruleType: 'auto_categorize',
      conditions: [
        { field: 'category', operator: 'equals', value: 'Other', logicalOperator: 'AND' }
      ],
      actions: [
        { type: 'set_category', parameters: { use_ai: true, confidence_threshold: 0.8 } }
      ],
      enabled: true,
      priority: 20,
      successCount: 456,
      failureCount: 28,
      lastExecuted: new Date('2024-01-17T17:15:00'),
      createdAt: new Date('2024-01-03T09:00:00'),
      createdBy: 'admin'
    }
  ];

  // AI categorization simulation
  const testAICategorization = useCallback(async () => {
    if (!testIncidentText.trim()) return;

    setIsProcessingAI(true);
    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock AI response based on keywords
      const text = testIncidentText.toLowerCase();
      let category = 'Other';
      let confidence = 0.5;
      let reasoning = 'Could not determine category with high confidence';
      let keywords: string[] = [];

      if (text.includes('db2') || text.includes('database') || text.includes('sql')) {
        category = 'DB2';
        confidence = 0.92;
        reasoning = 'Text contains database-related keywords: db2, sql';
        keywords = ['db2', 'database', 'sql'];
      } else if (text.includes('jcl') || text.includes('job') || text.includes('step')) {
        category = 'JCL';
        confidence = 0.87;
        reasoning = 'Text contains JCL-related keywords: jcl, job, step';
        keywords = ['jcl', 'job', 'step'];
      } else if (text.includes('cics') || text.includes('transaction')) {
        category = 'CICS';
        confidence = 0.85;
        reasoning = 'Text contains CICS-related keywords: cics, transaction';
        keywords = ['cics', 'transaction'];
      } else if (text.includes('network') || text.includes('connection') || text.includes('timeout')) {
        category = 'Network';
        confidence = 0.79;
        reasoning = 'Text contains network-related keywords: network, connection, timeout';
        keywords = ['network', 'connection', 'timeout'];
      } else if (text.includes('batch') || text.includes('schedule')) {
        category = 'Batch';
        confidence = 0.81;
        reasoning = 'Text contains batch processing keywords: batch, schedule';
        keywords = ['batch', 'schedule'];
      }

      const result: AICategorizationResult = {
        suggestedCategory: category,
        confidence,
        reasoning,
        keywords,
        similarIncidents: ['INC-1234', 'INC-5678', 'INC-9012']
      };

      setAiCategorization(result);
    } catch (error) {
      console.error('AI categorization failed:', error);
    } finally {
      setIsProcessingAI(false);
    }
  }, [testIncidentText]);

  // Add condition to new rule
  const addCondition = () => {
    setNewRule(prev => ({
      ...prev,
      conditions: [
        ...prev.conditions!,
        { field: 'category', operator: 'equals', value: '', logicalOperator: 'AND' }
      ]
    }));
  };

  // Add action to new rule
  const addAction = () => {
    setNewRule(prev => ({
      ...prev,
      actions: [
        ...prev.actions!,
        { type: 'assign_to', parameters: {} }
      ]
    }));
  };

  // Update condition
  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setNewRule(prev => ({
      ...prev,
      conditions: prev.conditions!.map((condition, i) =>
        i === index ? { ...condition, ...updates } : condition
      )
    }));
  };

  // Update action
  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setNewRule(prev => ({
      ...prev,
      actions: prev.actions!.map((action, i) =>
        i === index ? { ...action, ...updates } : action
      )
    }));
  };

  // Remove condition
  const removeCondition = (index: number) => {
    setNewRule(prev => ({
      ...prev,
      conditions: prev.conditions!.filter((_, i) => i !== index)
    }));
  };

  // Remove action
  const removeAction = (index: number) => {
    setNewRule(prev => ({
      ...prev,
      actions: prev.actions!.filter((_, i) => i !== index)
    }));
  };

  // Create rule
  const handleCreateRule = () => {
    if (!newRule.name || !newRule.conditions?.length || !newRule.actions?.length) return;

    const rule: Omit<AutomationRule, 'id' | 'createdAt' | 'successCount' | 'failureCount'> = {
      name: newRule.name,
      description: newRule.description || '',
      ruleType: newRule.ruleType!,
      conditions: newRule.conditions,
      actions: newRule.actions,
      enabled: newRule.enabled!,
      priority: newRule.priority!,
      createdBy: 'current_user'
    };

    onRuleCreate?.(rule);
    setIsCreateDialogOpen(false);

    // Reset form
    setNewRule({
      name: '',
      description: '',
      ruleType: 'auto_assign',
      conditions: [{ field: 'category', operator: 'equals', value: '', logicalOperator: 'AND' }],
      actions: [{ type: 'assign_to', parameters: {} }],
      enabled: true,
      priority: 100
    });
  };

  // Toggle rule enabled status
  const toggleRuleEnabled = (ruleId: string) => {
    const rule = mockRules.find(r => r.id === ruleId);
    if (rule) {
      onRuleUpdate?.(ruleId, { enabled: !rule.enabled });
    }
  };

  // Get rule type config
  const getRuleTypeConfig = (ruleType: string) => {
    return RULE_TYPES.find(rt => rt.value === ruleType);
  };

  // Render condition input
  const renderConditionInput = (condition: RuleCondition, index: number) => {
    const field = CONDITION_FIELDS.find(f => f.value === condition.field);

    switch (field?.type) {
      case 'select':
        return (
          <Select
            value={condition.value}
            onValueChange={(value) => updateCondition(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) })}
            placeholder="Enter number"
          />
        );
      default:
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            placeholder="Enter value"
          />
        );
    }
  };

  // Render action parameters
  const renderActionParameters = (action: RuleAction, index: number) => {
    const actionType = ACTION_TYPES.find(at => at.value === action.type);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {actionType?.parameters.map(param => (
          <div key={param}>
            <label className="text-sm font-medium capitalize">{param.replace('_', ' ')}</label>
            <Input
              placeholder={`Enter ${param.replace('_', ' ')}`}
              value={action.parameters[param] || ''}
              onChange={(e) => updateAction(index, {
                parameters: { ...action.parameters, [param]: e.target.value }
              })}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Incident Automation</h2>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules ({mockRules.length})</TabsTrigger>
          <TabsTrigger value="ai">AI Categorization</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Rules</p>
                    <p className="text-2xl font-bold">{mockMetrics.activeRules}</p>
                    <p className="text-xs text-gray-500">of {mockMetrics.totalRules} total</p>
                  </div>
                  <Settings className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">{mockMetrics.successRate}%</p>
                    <p className="text-xs text-gray-500">{mockMetrics.totalExecutions} executions</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">AI Categories</p>
                    <p className="text-2xl font-bold">{mockMetrics.categoriesProcessed}</p>
                    <p className="text-xs text-gray-500">auto-categorized</p>
                  </div>
                  <Brain className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Response</p>
                    <p className="text-2xl font-bold">{mockMetrics.avgExecutionTime}s</p>
                    <p className="text-xs text-gray-500">execution time</p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rule Types Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rule Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {RULE_TYPES.map(ruleType => {
                  const count = mockRules.filter(r => r.ruleType === ruleType.value).length;
                  const activeCount = mockRules.filter(r => r.ruleType === ruleType.value && r.enabled).length;

                  return (
                    <div key={ruleType.value} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-full"
                          style={{ backgroundColor: `${ruleType.color}20`, color: ruleType.color }}
                        >
                          <ruleType.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{ruleType.label}</p>
                          <p className="text-sm text-gray-600">{ruleType.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{activeCount}</p>
                        <p className="text-xs text-gray-500">of {count} active</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Auto-assigned DB2 incident</p>
                    <p className="text-xs text-gray-600">INC-1001 → Database Team</p>
                  </div>
                  <span className="text-xs text-gray-500">2 min ago</span>
                </div>

                <div className="flex items-center gap-3 p-2 bg-blue-50 rounded">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">AI categorized incident</p>
                    <p className="text-xs text-gray-600">INC-1002 → JCL (95% confidence)</p>
                  </div>
                  <span className="text-xs text-gray-500">5 min ago</span>
                </div>

                <div className="flex items-center gap-3 p-2 bg-orange-50 rounded">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Escalated critical incident</p>
                    <p className="text-xs text-gray-600">INC-1003 → Manager</p>
                  </div>
                  <span className="text-xs text-gray-500">12 min ago</span>
                </div>

                <div className="flex items-center gap-3 p-2 bg-purple-50 rounded">
                  <Bell className="h-4 w-4 text-purple-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Notification sent</p>
                    <p className="text-xs text-gray-600">SLA breach alert → oncall@company.com</p>
                  </div>
                  <span className="text-xs text-gray-500">18 min ago</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          {/* Rules List */}
          <div className="space-y-4">
            {mockRules.map(rule => {
              const ruleTypeConfig = getRuleTypeConfig(rule.ruleType);
              const successRate = rule.successCount / (rule.successCount + rule.failureCount) * 100;

              return (
                <Card key={rule.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className="p-2 rounded-full"
                          style={{ backgroundColor: `${ruleTypeConfig?.color}20`, color: ruleTypeConfig?.color }}
                        >
                          {ruleTypeConfig?.icon && <ruleTypeConfig.icon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{rule.name}</h3>
                            <Badge variant="outline">{ruleTypeConfig?.label}</Badge>
                            <Badge variant={rule.enabled ? 'success' : 'secondary'}>
                              {rule.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{rule.description}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Conditions:</span>
                              <div className="mt-1 space-y-1">
                                {rule.conditions.map((condition, index) => (
                                  <div key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {condition.field} {condition.operator} {condition.value}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="font-medium">Actions:</span>
                              <div className="mt-1 space-y-1">
                                {rule.actions.map((action, index) => (
                                  <div key={index} className="text-xs bg-blue-100 px-2 py-1 rounded">
                                    {action.type}: {Object.values(action.parameters).join(', ')}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="font-medium">Performance:</span>
                              <div className="mt-1">
                                <div className="flex items-center gap-2">
                                  <Progress value={successRate} className="flex-1 h-2" />
                                  <span className="text-xs">{Math.round(successRate)}%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {rule.successCount} successes, {rule.failureCount} failures
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Switch
                                checked={rule.enabled}
                                onCheckedChange={() => toggleRuleEnabled(rule.id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {rule.enabled ? 'Disable rule' : 'Enable rule'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => onRuleDelete?.(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          {/* AI Categorization Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Categorization Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Test Incident Description</label>
                <Textarea
                  placeholder="Enter incident title and description to test AI categorization..."
                  value={testIncidentText}
                  onChange={(e) => setTestIncidentText(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                onClick={testAICategorization}
                disabled={!testIncidentText.trim() || isProcessingAI}
              >
                {isProcessingAI ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                Analyze with AI
              </Button>

              {/* AI Results */}
              {aiCategorization && (
                <div className="mt-6 p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3">AI Analysis Results</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Suggested Category:</span>
                        <Badge>{aiCategorization.suggestedCategory}</Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Confidence:</span>
                        <div className="flex items-center gap-2">
                          <Progress value={aiCategorization.confidence * 100} className="w-20 h-2" />
                          <span className="text-sm">{Math.round(aiCategorization.confidence * 100)}%</span>
                        </div>
                      </div>

                      <div className="mb-2">
                        <span className="text-sm font-medium">Keywords Found:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiCategorization.keywords.map(keyword => (
                            <Badge key={keyword} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2">
                        <span className="text-sm font-medium">Reasoning:</span>
                        <p className="text-sm text-gray-600 mt-1">{aiCategorization.reasoning}</p>
                      </div>

                      <div>
                        <span className="text-sm font-medium">Similar Incidents:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiCategorization.similarIncidents.map(incident => (
                            <Badge key={incident} variant="outline" className="text-xs">
                              {incident}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {aiCategorization.confidence >= 0.8 && (
                    <Alert className="mt-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        High confidence categorization. This would be automatically applied.
                      </AlertDescription>
                    </Alert>
                  )}

                  {aiCategorization.confidence < 0.6 && (
                    <Alert className="mt-4">
                      <Warning className="h-4 w-4" />
                      <AlertDescription>
                        Low confidence categorization. Manual review recommended.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Confidence Threshold</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Slider
                      value={[80]}
                      onValueChange={(value) => {}}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">80%</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Minimum confidence required for automatic categorization
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Processing Mode</label>
                  <Select defaultValue="auto">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatic</SelectItem>
                      <SelectItem value="manual">Manual Review</SelectItem>
                      <SelectItem value="assisted">AI-Assisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch defaultChecked />
                <label className="text-sm">Enable continuous learning from user feedback</label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch defaultChecked />
                <label className="text-sm">Auto-suggest related KB articles</label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Assignments Automated</span>
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">{mockMetrics.assignmentsAutomated}</p>
                <p className="text-xs text-gray-500">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Escalations Triggered</span>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-2xl font-bold">{mockMetrics.escalationsTriggered}</p>
                <p className="text-xs text-gray-500">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Notifications Sent</span>
                  <Bell className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">{mockMetrics.notificationsSent}</p>
                <p className="text-xs text-gray-500">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Automation Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <p>Automation performance chart would be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Automation Rule</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Rule Name</label>
                <Input
                  placeholder="Enter rule name"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Rule Type</label>
                <Select
                  value={newRule.ruleType}
                  onValueChange={(value) => setNewRule(prev => ({ ...prev, ruleType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe what this rule does"
                value={newRule.description}
                onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Conditions</h4>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Condition
                </Button>
              </div>

              <div className="space-y-3">
                {newRule.conditions?.map((condition, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                    {index > 0 && (
                      <Select
                        value={condition.logicalOperator}
                        onValueChange={(value) => updateCondition(index, { logicalOperator: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, { field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_FIELDS.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, { operator: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="greater_than">Greater than</SelectItem>
                        <SelectItem value="less_than">Less than</SelectItem>
                        <SelectItem value="in">In</SelectItem>
                        <SelectItem value="not_in">Not in</SelectItem>
                      </SelectContent>
                    </Select>

                    {renderConditionInput(condition, index)}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCondition(index)}
                      disabled={newRule.conditions!.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Actions</h4>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Action
                </Button>
              </div>

              <div className="space-y-3">
                {newRule.actions?.map((action, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <Select
                        value={action.type}
                        onValueChange={(value) => updateAction(index, { type: value as any, parameters: {} })}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map(actionType => (
                            <SelectItem key={actionType.value} value={actionType.value}>
                              {actionType.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeAction(index)}
                        disabled={newRule.actions!.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {renderActionParameters(action, index)}
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={newRule.priority}
                  onChange={(e) => setNewRule(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                />
                <p className="text-xs text-gray-600 mt-1">Lower numbers = higher priority</p>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={newRule.enabled}
                  onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, enabled: checked }))}
                />
                <label className="text-sm">Enable rule immediately</label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRule}>
              <Save className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentAutomation;