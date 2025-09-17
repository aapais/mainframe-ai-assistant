import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, Area, AreaChart
} from 'recharts';
import {
  Card, CardContent, CardHeader, CardTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Badge, Progress, Button, DatePicker
} from '@/components/ui';
import { Calendar, Download, Filter, TrendingUp, TrendingDown, AlertTriangle, Clock, Users, Target } from 'lucide-react';

// Types for incident analytics
interface IncidentMetrics {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  avgMTTR: number;
  avgResponseTime: number;
  slaCompliance: number;
  trendsData: TrendData[];
  categoryDistribution: CategoryData[];
  teamPerformance: TeamPerformanceData[];
  severityBreakdown: SeverityData[];
  weeklyTrends: WeeklyTrendData[];
  monthlyTrends: MonthlyTrendData[];
}

interface TrendData {
  date: string;
  newIncidents: number;
  resolvedIncidents: number;
  mttr: number;
  slaBreaches: number;
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
  avgResolutionTime: number;
  slaCompliance: number;
}

interface TeamPerformanceData {
  team: string;
  member?: string;
  totalIncidents: number;
  resolvedIncidents: number;
  avgResolutionTime: number;
  slaCompliance: number;
  resolutionRate: number;
}

interface SeverityData {
  severity: string;
  count: number;
  percentage: number;
  color: string;
}

interface WeeklyTrendData {
  week: string;
  incidents: number;
  mttr: number;
  slaCompliance: number;
}

interface MonthlyTrendData {
  month: string;
  incidents: number;
  mttr: number;
  slaCompliance: number;
  categories: { [key: string]: number };
}

interface IncidentAnalyticsProps {
  timeRange: '7d' | '30d' | '90d' | 'custom';
  onTimeRangeChange: (range: '7d' | '30d' | '90d' | 'custom') => void;
  customDateRange?: { start: Date; end: Date };
  onCustomDateRangeChange?: (range: { start: Date; end: Date }) => void;
}

// Color schemes for charts
const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
};

const CATEGORY_COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#10b981'
];

const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  danger: '#ef4444',
  muted: '#6b7280'
};

export const IncidentAnalytics: React.FC<IncidentAnalyticsProps> = ({
  timeRange,
  onTimeRangeChange,
  customDateRange,
  onCustomDateRangeChange
}) => {
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'trends' | 'teams' | 'categories'>('overview');

  // Mock data service - replace with actual API calls
  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Simulate API call with realistic incident data
      const mockMetrics: IncidentMetrics = {
        totalIncidents: 1247,
        openIncidents: 89,
        resolvedIncidents: 1158,
        avgMTTR: 18.5, // hours
        avgResponseTime: 2.3, // hours
        slaCompliance: 87.2, // percentage

        trendsData: generateTrendData(),
        categoryDistribution: generateCategoryData(),
        teamPerformance: generateTeamData(),
        severityBreakdown: generateSeverityData(),
        weeklyTrends: generateWeeklyTrends(),
        monthlyTrends: generateMonthlyTrends()
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, customDateRange, selectedCategory, selectedTeam]);

  // Generate mock data functions
  const generateTrendData = (): TrendData[] => {
    const data: TrendData[] = [];
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      data.push({
        date: date.toISOString().split('T')[0],
        newIncidents: Math.floor(Math.random() * 25) + 10,
        resolvedIncidents: Math.floor(Math.random() * 20) + 8,
        mttr: Math.round((Math.random() * 30 + 10) * 10) / 10,
        slaBreaches: Math.floor(Math.random() * 5)
      });
    }
    return data;
  };

  const generateCategoryData = (): CategoryData[] => [
    { category: 'JCL', count: 324, percentage: 26.0, avgResolutionTime: 15.2, slaCompliance: 89.1 },
    { category: 'DB2', count: 287, percentage: 23.0, avgResolutionTime: 22.4, slaCompliance: 84.3 },
    { category: 'CICS', count: 198, percentage: 15.9, avgResolutionTime: 18.7, slaCompliance: 91.2 },
    { category: 'Batch', count: 156, percentage: 12.5, avgResolutionTime: 16.8, slaCompliance: 87.5 },
    { category: 'VSAM', count: 134, percentage: 10.7, avgResolutionTime: 20.1, slaCompliance: 85.8 },
    { category: 'Network', count: 89, percentage: 7.1, avgResolutionTime: 25.3, slaCompliance: 79.2 },
    { category: 'Security', count: 59, percentage: 4.7, avgResolutionTime: 28.6, slaCompliance: 76.3 }
  ];

  const generateTeamData = (): TeamPerformanceData[] => [
    { team: 'Mainframe Core', totalIncidents: 445, resolvedIncidents: 398, avgResolutionTime: 17.2, slaCompliance: 89.4, resolutionRate: 89.4 },
    { team: 'Database Team', totalIncidents: 287, resolvedIncidents: 258, avgResolutionTime: 21.8, slaCompliance: 85.7, resolutionRate: 89.9 },
    { team: 'Network Operations', totalIncidents: 198, resolvedIncidents: 176, avgResolutionTime: 24.1, slaCompliance: 78.3, resolutionRate: 88.9 },
    { team: 'Security Team', totalIncidents: 134, resolvedIncidents: 119, avgResolutionTime: 26.7, slaCompliance: 76.1, resolutionRate: 88.8 },
    { team: 'Application Support', totalIncidents: 183, resolvedIncidents: 167, avgResolutionTime: 19.4, slaCompliance: 87.2, resolutionRate: 91.3 }
  ];

  const generateSeverityData = (): SeverityData[] => [
    { severity: 'Critical', count: 67, percentage: 5.4, color: SEVERITY_COLORS.critical },
    { severity: 'High', count: 234, percentage: 18.8, color: SEVERITY_COLORS.high },
    { severity: 'Medium', count: 612, percentage: 49.1, color: SEVERITY_COLORS.medium },
    { severity: 'Low', count: 334, percentage: 26.8, color: SEVERITY_COLORS.low }
  ];

  const generateWeeklyTrends = (): WeeklyTrendData[] => {
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      const weekStr = `Week ${52 - i}`;

      weeks.push({
        week: weekStr,
        incidents: Math.floor(Math.random() * 50) + 80,
        mttr: Math.round((Math.random() * 10 + 15) * 10) / 10,
        slaCompliance: Math.round((Math.random() * 15 + 80) * 10) / 10
      });
    }
    return weeks;
  };

  const generateMonthlyTrends = (): MonthlyTrendData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => ({
      month,
      incidents: Math.floor(Math.random() * 200) + 300,
      mttr: Math.round((Math.random() * 8 + 16) * 10) / 10,
      slaCompliance: Math.round((Math.random() * 12 + 82) * 10) / 10,
      categories: {
        JCL: Math.floor(Math.random() * 80) + 60,
        DB2: Math.floor(Math.random() * 70) + 50,
        CICS: Math.floor(Math.random() * 50) + 30,
        Batch: Math.floor(Math.random() * 40) + 25,
        Other: Math.floor(Math.random() * 30) + 20
      }
    }));
  };

  // Calculated metrics
  const calculatedMetrics = useMemo(() => {
    if (!metrics) return null;

    const mttrTrend = metrics.trendsData.length > 1 ?
      ((metrics.trendsData[metrics.trendsData.length - 1].mttr - metrics.trendsData[0].mttr) / metrics.trendsData[0].mttr) * 100 : 0;

    const incidentTrend = metrics.trendsData.length > 1 ?
      ((metrics.trendsData[metrics.trendsData.length - 1].newIncidents - metrics.trendsData[0].newIncidents) / metrics.trendsData[0].newIncidents) * 100 : 0;

    return {
      mttrTrend: Math.round(mttrTrend * 10) / 10,
      incidentTrend: Math.round(incidentTrend * 10) / 10,
      resolutionRate: Math.round((metrics.resolvedIncidents / metrics.totalIncidents) * 100),
      avgDaily: Math.round(metrics.totalIncidents / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90))
    };
  }, [metrics, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (!metrics || !calculatedMetrics) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Failed to load analytics data</p>
        <Button onClick={fetchAnalyticsData} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Incident Analytics</h2>

        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="JCL">JCL</SelectItem>
              <SelectItem value="DB2">DB2</SelectItem>
              <SelectItem value="CICS">CICS</SelectItem>
              <SelectItem value="Batch">Batch</SelectItem>
              <SelectItem value="VSAM">VSAM</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalIncidents.toLocaleString()}</p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  {calculatedMetrics.incidentTrend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                  )}
                  {Math.abs(calculatedMetrics.incidentTrend)}% vs previous period
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg MTTR</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.avgMTTR}h</p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  {calculatedMetrics.mttrTrend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-red-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-500 mr-1" />
                  )}
                  {Math.abs(calculatedMetrics.mttrTrend)}% vs previous period
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SLA Compliance</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.slaCompliance}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${metrics.slaCompliance}%` }}
                  />
                </div>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
                <p className="text-2xl font-bold text-gray-900">{calculatedMetrics.resolutionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.resolvedIncidents} of {metrics.totalIncidents} resolved
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Users className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Incident Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(date) => new Date(date).toLocaleDateString()} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="newIncidents"
                      stroke={CHART_COLORS.primary}
                      name="New Incidents"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="resolvedIncidents"
                      stroke={CHART_COLORS.secondary}
                      name="Resolved"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.severityBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ severity, percentage }) => `${severity}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {metrics.severityBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* MTTR Trends */}
            <Card>
              <CardHeader>
                <CardTitle>MTTR Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics.trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(date) => new Date(date).toLocaleDateString()} />
                    <Area
                      type="monotone"
                      dataKey="mttr"
                      stroke={CHART_COLORS.accent}
                      fill={CHART_COLORS.accent}
                      fillOpacity={0.3}
                      name="MTTR (hours)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* SLA Compliance by Category */}
            <Card>
              <CardHeader>
                <CardTitle>SLA Compliance by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.categoryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="slaCompliance" fill={CHART_COLORS.secondary} name="SLA Compliance %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.weeklyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="incidents" fill={CHART_COLORS.primary} name="Incidents" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="mttr"
                      stroke={CHART_COLORS.danger}
                      name="MTTR (hours)"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Volume Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Volume Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="incidents" fill={CHART_COLORS.primary} name="Total Incidents" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Team</th>
                      <th className="text-center p-2">Total Incidents</th>
                      <th className="text-center p-2">Resolved</th>
                      <th className="text-center p-2">Resolution Rate</th>
                      <th className="text-center p-2">Avg MTTR</th>
                      <th className="text-center p-2">SLA Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.teamPerformance.map((team, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{team.team}</td>
                        <td className="text-center p-2">{team.totalIncidents}</td>
                        <td className="text-center p-2">{team.resolvedIncidents}</td>
                        <td className="text-center p-2">
                          <Badge variant={team.resolutionRate >= 90 ? 'success' : team.resolutionRate >= 80 ? 'warning' : 'destructive'}>
                            {team.resolutionRate}%
                          </Badge>
                        </td>
                        <td className="text-center p-2">{team.avgResolutionTime}h</td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center">
                            <Progress value={team.slaCompliance} className="w-16 h-2 mr-2" />
                            <span className="text-xs">{team.slaCompliance}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Incident Volume by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.categoryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLORS.primary} name="Incidents" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Performance Matrix */}
            <Card>
              <CardHeader>
                <CardTitle>Category Performance Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={metrics.categoryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="avgResolutionTime" name="Avg Resolution Time (hours)" />
                    <YAxis dataKey="slaCompliance" name="SLA Compliance %" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter dataKey="count" fill={CHART_COLORS.accent} />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Category Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Category</th>
                      <th className="text-center p-2">Count</th>
                      <th className="text-center p-2">Percentage</th>
                      <th className="text-center p-2">Avg Resolution Time</th>
                      <th className="text-center p-2">SLA Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.categoryDistribution.map((category, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{category.category}</td>
                        <td className="text-center p-2">{category.count}</td>
                        <td className="text-center p-2">{category.percentage}%</td>
                        <td className="text-center p-2">{category.avgResolutionTime}h</td>
                        <td className="text-center p-2">
                          <Badge variant={category.slaCompliance >= 85 ? 'success' : category.slaCompliance >= 75 ? 'warning' : 'destructive'}>
                            {category.slaCompliance}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IncidentAnalytics;