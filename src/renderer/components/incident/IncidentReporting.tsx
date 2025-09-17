import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Textarea, Switch, Badge, Separator, Alert, AlertDescription,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Checkbox, DatePicker, Progress, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui';
import {
  FileText, Download, Mail, Calendar, Clock, Filter, Settings,
  BarChart3, PieChart, TrendingUp, Users, Target, AlertCircle,
  Save, Upload, Eye, Edit, Trash2, Plus, RefreshCw, Send,
  FileSpreadsheet, FilePdf, FileJson, Image, Share2, Copy,
  ChevronDown, ChevronRight, Info, CheckCircle, ExternalLink
} from 'lucide-react';

// Types for reporting
interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  templateType: 'incident_summary' | 'sla_report' | 'team_performance' | 'trend_analysis' | 'custom';
  queryTemplate: string;
  parameters: ReportParameter[];
  outputFormats: ('csv' | 'pdf' | 'json' | 'excel' | 'png')[];
  scheduleConfig?: ScheduleConfig;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'select' | 'boolean';
  label: string;
  required: boolean;
  defaultValue?: any;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  recipients: string[];
  nextRun?: Date;
}

interface ReportExecution {
  id: string;
  templateId: string;
  templateName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  outputFormat: string;
  outputPath?: string;
  fileSize?: number;
  executionTime?: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
}

interface ReportData {
  columns: string[];
  rows: any[][];
  metadata: {
    totalRows: number;
    generatedAt: Date;
    parameters: Record<string, any>;
    executionTime: number;
  };
}

interface IncidentReportingProps {
  onTemplateCreate?: (template: Omit<ReportTemplate, 'id' | 'createdAt' | 'usageCount'>) => void;
  onTemplateUpdate?: (templateId: string, updates: Partial<ReportTemplate>) => void;
  onTemplateDelete?: (templateId: string) => void;
  onReportGenerate?: (templateId: string, parameters: Record<string, any>, format: string) => void;
  onReportSchedule?: (templateId: string, schedule: ScheduleConfig) => void;
  templates?: ReportTemplate[];
  executions?: ReportExecution[];
}

// Pre-defined report templates
const DEFAULT_TEMPLATES: Omit<ReportTemplate, 'id' | 'createdAt' | 'usageCount'>[] = [
  {
    name: 'Daily Incident Summary',
    description: 'Daily summary of incident metrics and activity',
    templateType: 'incident_summary',
    queryTemplate: `
      SELECT
        DATE(created_at) as date,
        category,
        severity,
        COUNT(*) as incident_count,
        COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_count,
        AVG(resolution_time_hours) as avg_resolution_time,
        COUNT(CASE WHEN sla_breach = 1 THEN 1 END) as sla_breaches
      FROM incidents
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY DATE(created_at), category, severity
      ORDER BY date DESC, category, severity
    `,
    parameters: [
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'end_date', type: 'date', label: 'End Date', required: true }
    ],
    outputFormats: ['csv', 'pdf', 'excel'],
    isPublic: true,
    createdBy: 'system'
  },
  {
    name: 'SLA Compliance Report',
    description: 'Detailed SLA compliance metrics by team and category',
    templateType: 'sla_report',
    queryTemplate: `
      SELECT
        assigned_team,
        category,
        severity,
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN sla_breach = 0 THEN 1 END) as sla_met,
        COUNT(CASE WHEN sla_breach = 1 THEN 1 END) as sla_missed,
        ROUND(COUNT(CASE WHEN sla_breach = 0 THEN 1 END) * 100.0 / COUNT(*), 2) as compliance_percentage,
        AVG(resolution_time_hours) as avg_resolution_time,
        AVG(response_time_hours) as avg_response_time
      FROM incidents
      WHERE created_at >= ? AND created_at <= ?
        AND status IN ('resolved', 'closed')
        AND assigned_team IS NOT NULL
      GROUP BY assigned_team, category, severity
      ORDER BY assigned_team, compliance_percentage DESC
    `,
    parameters: [
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'end_date', type: 'date', label: 'End Date', required: true }
    ],
    outputFormats: ['csv', 'pdf', 'excel'],
    isPublic: true,
    createdBy: 'system'
  },
  {
    name: 'Team Performance Analysis',
    description: 'Individual and team performance metrics',
    templateType: 'team_performance',
    queryTemplate: `
      SELECT
        assigned_team,
        assigned_to,
        COUNT(*) as total_assigned,
        COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved,
        ROUND(COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) * 100.0 / COUNT(*), 2) as resolution_rate,
        AVG(resolution_time_hours) as avg_resolution_time,
        COUNT(CASE WHEN sla_breach = 0 AND status IN ('resolved', 'closed') THEN 1 END) as sla_met,
        SUM(escalation_count) as total_escalations
      FROM incidents
      WHERE created_at >= ? AND created_at <= ?
        AND assigned_to IS NOT NULL
      GROUP BY assigned_team, assigned_to
      ORDER BY assigned_team, resolution_rate DESC
    `,
    parameters: [
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'end_date', type: 'date', label: 'End Date', required: true },
      { name: 'team_filter', type: 'select', label: 'Team (Optional)', required: false,
        options: ['All Teams', 'Mainframe Core', 'Database Team', 'Network Operations', 'Security Team'] }
    ],
    outputFormats: ['csv', 'pdf', 'excel'],
    isPublic: true,
    createdBy: 'system'
  },
  {
    name: 'Monthly Trend Analysis',
    description: 'Monthly trends in incident volume, resolution time, and categories',
    templateType: 'trend_analysis',
    queryTemplate: `
      SELECT
        strftime('%Y-%m', created_at) as month,
        category,
        COUNT(*) as incident_count,
        AVG(resolution_time_hours) as avg_resolution_time,
        COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_count,
        COUNT(CASE WHEN sla_breach = 1 THEN 1 END) as sla_breaches,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_incidents
      FROM incidents
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY strftime('%Y-%m', created_at), category
      ORDER BY month DESC, incident_count DESC
    `,
    parameters: [
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'end_date', type: 'date', label: 'End Date', required: true }
    ],
    outputFormats: ['csv', 'pdf', 'excel', 'png'],
    isPublic: true,
    createdBy: 'system'
  }
];

// Output format configurations
const OUTPUT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, description: 'Comma-separated values' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel workbook' },
  { value: 'pdf', label: 'PDF', icon: FilePdf, description: 'Portable document format' },
  { value: 'json', label: 'JSON', icon: FileJson, description: 'JavaScript object notation' },
  { value: 'png', label: 'PNG', icon: Image, description: 'Chart as image' }
];

export const IncidentReporting: React.FC<IncidentReportingProps> = ({
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete,
  onReportGenerate,
  onReportSchedule,
  templates = [],
  executions = []
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'generate' | 'schedule' | 'history'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // Template creation state
  const [newTemplate, setNewTemplate] = useState<Partial<ReportTemplate>>({
    name: '',
    description: '',
    templateType: 'custom',
    queryTemplate: '',
    parameters: [],
    outputFormats: ['csv'],
    isPublic: false
  });

  // Report generation state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [reportParameters, setReportParameters] = useState<Record<string, any>>({});
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<string>('csv');
  const [isGenerating, setIsGenerating] = useState(false);

  // Schedule configuration state
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: false,
    frequency: 'weekly',
    time: '09:00',
    recipients: []
  });

  // Preview data state
  const [previewData, setPreviewData] = useState<ReportData | null>(null);

  // Mock data
  const mockTemplates: ReportTemplate[] = templates.length > 0 ? templates :
    DEFAULT_TEMPLATES.map((template, index) => ({
      ...template,
      id: `template-${index + 1}`,
      createdAt: new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000),
      usageCount: Math.floor(Math.random() * 50) + 10,
      lastUsed: index < 3 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined
    }));

  const mockExecutions: ReportExecution[] = executions.length > 0 ? executions : [
    {
      id: 'exec-001',
      templateId: 'template-1',
      templateName: 'Daily Incident Summary',
      parameters: { start_date: '2024-01-16', end_date: '2024-01-17' },
      status: 'completed',
      outputFormat: 'pdf',
      outputPath: '/reports/daily-summary-2024-01-17.pdf',
      fileSize: 245760,
      executionTime: 1250,
      createdAt: new Date('2024-01-17T09:00:00'),
      completedAt: new Date('2024-01-17T09:00:01'),
      createdBy: 'john.doe'
    },
    {
      id: 'exec-002',
      templateId: 'template-2',
      templateName: 'SLA Compliance Report',
      parameters: { start_date: '2024-01-01', end_date: '2024-01-15' },
      status: 'completed',
      outputFormat: 'excel',
      outputPath: '/reports/sla-compliance-2024-01-15.xlsx',
      fileSize: 189440,
      executionTime: 2100,
      createdAt: new Date('2024-01-16T14:30:00'),
      completedAt: new Date('2024-01-16T14:30:02'),
      createdBy: 'jane.smith'
    },
    {
      id: 'exec-003',
      templateId: 'template-3',
      templateName: 'Team Performance Analysis',
      parameters: { start_date: '2024-01-01', end_date: '2024-01-31', team_filter: 'Database Team' },
      status: 'running',
      outputFormat: 'csv',
      createdAt: new Date('2024-01-17T16:45:00'),
      createdBy: 'bob.wilson'
    }
  ];

  // Get template by ID
  const getTemplate = (templateId: string) => {
    return mockTemplates.find(t => t.id === templateId);
  };

  // Generate sample preview data
  const generatePreviewData = async (template: ReportTemplate) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const sampleData: ReportData = {
      columns: template.templateType === 'incident_summary'
        ? ['Date', 'Category', 'Severity', 'Count', 'Resolved', 'Avg Resolution Time', 'SLA Breaches']
        : template.templateType === 'sla_report'
        ? ['Team', 'Category', 'Severity', 'Total', 'SLA Met', 'SLA Missed', 'Compliance %', 'Avg Resolution', 'Avg Response']
        : template.templateType === 'team_performance'
        ? ['Team', 'Member', 'Assigned', 'Resolved', 'Resolution Rate', 'Avg Time', 'SLA Met', 'Escalations']
        : ['Month', 'Category', 'Count', 'Avg Resolution', 'Resolved', 'SLA Breaches', 'Critical'],
      rows: generateSampleRows(template.templateType),
      metadata: {
        totalRows: 15,
        generatedAt: new Date(),
        parameters: reportParameters,
        executionTime: 1250
      }
    };

    setPreviewData(sampleData);
  };

  const generateSampleRows = (templateType: string): any[][] => {
    switch (templateType) {
      case 'incident_summary':
        return [
          ['2024-01-17', 'DB2', 'High', 12, 10, 18.5, 2],
          ['2024-01-17', 'JCL', 'Medium', 8, 8, 14.2, 0],
          ['2024-01-17', 'CICS', 'Critical', 3, 2, 25.7, 1],
          ['2024-01-16', 'Network', 'Low', 5, 5, 6.8, 0],
          ['2024-01-16', 'DB2', 'Medium', 15, 13, 16.3, 1]
        ];
      case 'sla_report':
        return [
          ['Database Team', 'DB2', 'High', 45, 41, 4, 91.1, 18.5, 2.3],
          ['Mainframe Core', 'JCL', 'Medium', 62, 58, 4, 93.5, 14.2, 1.8],
          ['Network Operations', 'Network', 'Critical', 12, 9, 3, 75.0, 28.4, 3.2],
          ['Security Team', 'Security', 'Low', 8, 8, 0, 100.0, 12.1, 4.1]
        ];
      case 'team_performance':
        return [
          ['Database Team', 'john.doe', 34, 31, 91.2, 17.8, 29, 2],
          ['Database Team', 'jane.smith', 28, 26, 92.9, 16.4, 25, 1],
          ['Mainframe Core', 'bob.wilson', 41, 38, 92.7, 15.2, 36, 3],
          ['Network Operations', 'alice.brown', 19, 16, 84.2, 22.1, 14, 4]
        ];
      default:
        return [
          ['2024-01', 'DB2', 156, 18.2, 142, 8, 12],
          ['2024-01', 'JCL', 134, 15.7, 128, 4, 3],
          ['2024-01', 'CICS', 89, 19.8, 82, 6, 7],
          ['2023-12', 'DB2', 147, 17.9, 138, 6, 9]
        ];
    }
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedTemplateId || !selectedOutputFormat) return;

    setIsGenerating(true);
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      onReportGenerate?.(selectedTemplateId, reportParameters, selectedOutputFormat);

      // Show success message or download
      alert('Report generated successfully!');
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('Report generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Create template
  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.queryTemplate) return;

    const template: Omit<ReportTemplate, 'id' | 'createdAt' | 'usageCount'> = {
      name: newTemplate.name,
      description: newTemplate.description || '',
      templateType: newTemplate.templateType!,
      queryTemplate: newTemplate.queryTemplate,
      parameters: newTemplate.parameters || [],
      outputFormats: newTemplate.outputFormats || ['csv'],
      isPublic: newTemplate.isPublic || false,
      createdBy: 'current_user'
    };

    onTemplateCreate?.(template);
    setIsCreateDialogOpen(false);

    // Reset form
    setNewTemplate({
      name: '',
      description: '',
      templateType: 'custom',
      queryTemplate: '',
      parameters: [],
      outputFormats: ['csv'],
      isPublic: false
    });
  };

  // Add parameter to template
  const addParameter = () => {
    setNewTemplate(prev => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        {
          name: `param_${(prev.parameters?.length || 0) + 1}`,
          type: 'string',
          label: 'New Parameter',
          required: false
        }
      ]
    }));
  };

  // Update parameter
  const updateParameter = (index: number, updates: Partial<ReportParameter>) => {
    setNewTemplate(prev => ({
      ...prev,
      parameters: prev.parameters?.map((param, i) =>
        i === index ? { ...param, ...updates } : param
      ) || []
    }));
  };

  // Remove parameter
  const removeParameter = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index) || []
    }));
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Incident Reporting</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
          <Button onClick={() => setActiveTab('generate')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">Templates ({mockTemplates.length})</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="history">History ({mockExecutions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTemplates.map(template => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    </div>
                    <Badge variant="outline">{template.templateType.replace('_', ' ')}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Output Formats:</span>
                      <div className="flex gap-1">
                        {template.outputFormats.map(format => (
                          <Badge key={format} variant="secondary" className="text-xs">
                            {format.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Used:</span>
                      <span>{template.usageCount} times</span>
                    </div>

                    {template.lastUsed && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Last used:</span>
                        <span>{template.lastUsed.toLocaleDateString()}</span>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setActiveTab('generate');
                        }}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Generate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          generatePreviewData(template);
                          setIsPreviewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setIsScheduleDialogOpen(true);
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Schedule
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          {/* Report Generation */}
          <Card>
            <CardHeader>
              <CardTitle>Generate Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div>
                <label className="text-sm font-medium">Report Template</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-gray-600">{template.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Parameters */}
              {selectedTemplateId && (() => {
                const template = getTemplate(selectedTemplateId);
                return template?.parameters && template.parameters.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Parameters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {template.parameters.map(param => (
                        <div key={param.name}>
                          <label className="text-sm font-medium">
                            {param.label}
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {param.type === 'select' ? (
                            <Select
                              value={reportParameters[param.name] || ''}
                              onValueChange={(value) => setReportParameters(prev => ({ ...prev, [param.name]: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Select ${param.label}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {param.options?.map(option => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : param.type === 'date' ? (
                            <DatePicker
                              selected={reportParameters[param.name] ? new Date(reportParameters[param.name]) : undefined}
                              onChange={(date) => setReportParameters(prev => ({
                                ...prev,
                                [param.name]: date?.toISOString().split('T')[0]
                              }))}
                              placeholderText={`Select ${param.label}`}
                            />
                          ) : param.type === 'boolean' ? (
                            <Switch
                              checked={reportParameters[param.name] || false}
                              onCheckedChange={(checked) => setReportParameters(prev => ({ ...prev, [param.name]: checked }))}
                            />
                          ) : (
                            <Input
                              type={param.type === 'number' ? 'number' : 'text'}
                              placeholder={`Enter ${param.label}`}
                              value={reportParameters[param.name] || ''}
                              onChange={(e) => setReportParameters(prev => ({
                                ...prev,
                                [param.name]: param.type === 'number' ? parseFloat(e.target.value) : e.target.value
                              }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Output Format */}
              <div>
                <label className="text-sm font-medium">Output Format</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                  {OUTPUT_FORMATS.filter(format => {
                    const template = getTemplate(selectedTemplateId);
                    return template?.outputFormats.includes(format.value as any);
                  }).map(format => (
                    <div
                      key={format.value}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedOutputFormat === format.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedOutputFormat(format.value)}
                    >
                      <format.icon className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">{format.label}</p>
                        <p className="text-xs text-gray-600">{format.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleGenerateReport}
                  disabled={!selectedTemplateId || !selectedOutputFormat || isGenerating}
                  className="min-w-32"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          {/* Scheduled Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockTemplates.filter(t => t.scheduleConfig?.enabled).map(template => (
                  <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-gray-600">
                        {template.scheduleConfig?.frequency} at {template.scheduleConfig?.time}
                      </p>
                      <p className="text-xs text-gray-500">
                        Next run: {template.scheduleConfig?.nextRun?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">Active</Badge>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Pause className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {mockTemplates.filter(t => t.scheduleConfig?.enabled).length === 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No scheduled reports configured. Use the "Schedule" button on any template to set up automated reporting.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Execution History */}
          <Card>
            <CardHeader>
              <CardTitle>Report Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Execution Time</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockExecutions.map(execution => (
                    <TableRow key={execution.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{execution.templateName}</p>
                          <p className="text-xs text-gray-600">by {execution.createdBy}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{execution.outputFormat.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(execution.status)}</TableCell>
                      <TableCell>
                        {execution.fileSize ? formatFileSize(execution.fileSize) : '-'}
                      </TableCell>
                      <TableCell>
                        {execution.executionTime ? `${execution.executionTime}ms` : '-'}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {execution.createdAt.toLocaleDateString()}
                            </TooltipTrigger>
                            <TooltipContent>
                              {execution.createdAt.toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {execution.status === 'completed' && execution.outputPath && (
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Report Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  placeholder="Enter template name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Template Type</label>
                <Select
                  value={newTemplate.templateType}
                  onValueChange={(value) => setNewTemplate(prev => ({ ...prev, templateType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incident_summary">Incident Summary</SelectItem>
                    <SelectItem value="sla_report">SLA Report</SelectItem>
                    <SelectItem value="team_performance">Team Performance</SelectItem>
                    <SelectItem value="trend_analysis">Trend Analysis</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe what this report shows"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* SQL Query */}
            <div>
              <label className="text-sm font-medium">SQL Query Template</label>
              <Textarea
                placeholder="Enter SQL query with ? placeholders for parameters"
                value={newTemplate.queryTemplate}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, queryTemplate: e.target.value }))}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {/* Parameters */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Parameters</h4>
                <Button variant="outline" size="sm" onClick={addParameter}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Parameter
                </Button>
              </div>

              {newTemplate.parameters && newTemplate.parameters.length > 0 && (
                <div className="space-y-3">
                  {newTemplate.parameters.map((param, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-3 border rounded-lg">
                      <div>
                        <label className="text-xs font-medium">Name</label>
                        <Input
                          value={param.name}
                          onChange={(e) => updateParameter(index, { name: e.target.value })}
                          placeholder="parameter_name"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium">Label</label>
                        <Input
                          value={param.label}
                          onChange={(e) => updateParameter(index, { label: e.target.value })}
                          placeholder="Display Label"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium">Type</label>
                        <Select
                          value={param.type}
                          onValueChange={(value) => updateParameter(index, { type: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="select">Select</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={param.required}
                          onCheckedChange={(checked) => updateParameter(index, { required: !!checked })}
                        />
                        <label className="text-xs">Required</label>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeParameter(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Output Formats */}
            <div>
              <label className="text-sm font-medium">Output Formats</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                {OUTPUT_FORMATS.map(format => (
                  <div
                    key={format.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      checked={newTemplate.outputFormats?.includes(format.value as any)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewTemplate(prev => ({
                            ...prev,
                            outputFormats: [...(prev.outputFormats || []), format.value as any]
                          }));
                        } else {
                          setNewTemplate(prev => ({
                            ...prev,
                            outputFormats: prev.outputFormats?.filter(f => f !== format.value) || []
                          }));
                        }
                      }}
                    />
                    <label className="text-sm">{format.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={newTemplate.isPublic}
                onCheckedChange={(checked) => setNewTemplate(prev => ({ ...prev, isPublic: !!checked }))}
              />
              <label className="text-sm">Make this template public (visible to all users)</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>
              <Save className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Preview: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>

          {previewData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p>Generated: {previewData.metadata.generatedAt.toLocaleString()}</p>
                  <p>Execution time: {previewData.metadata.executionTime}ms</p>
                  <p>Total rows: {previewData.metadata.totalRows}</p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export Preview
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    {previewData.columns.map(column => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.map((row, index) => (
                    <TableRow key={index}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Generating preview...
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
            {previewData && (
              <Button onClick={() => {
                setIsPreviewDialogOpen(false);
                if (selectedTemplate) {
                  setSelectedTemplateId(selectedTemplate.id);
                  setActiveTab('generate');
                }
              }}>
                Generate Full Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Report: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={scheduleConfig.enabled}
                onCheckedChange={(checked) => setScheduleConfig(prev => ({ ...prev, enabled: checked }))}
              />
              <label className="text-sm font-medium">Enable scheduled execution</label>
            </div>

            {scheduleConfig.enabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Frequency</label>
                    <Select
                      value={scheduleConfig.frequency}
                      onValueChange={(value) => setScheduleConfig(prev => ({ ...prev, frequency: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Time</label>
                    <Input
                      type="time"
                      value={scheduleConfig.time}
                      onChange={(e) => setScheduleConfig(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Email Recipients</label>
                  <Textarea
                    placeholder="Enter email addresses, one per line"
                    value={scheduleConfig.recipients.join('\n')}
                    onChange={(e) => setScheduleConfig(prev => ({
                      ...prev,
                      recipients: e.target.value.split('\n').filter(email => email.trim())
                    }))}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (selectedTemplate) {
                onReportSchedule?.(selectedTemplate.id, scheduleConfig);
              }
              setIsScheduleDialogOpen(false);
            }}>
              <Calendar className="h-4 w-4 mr-2" />
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentReporting;