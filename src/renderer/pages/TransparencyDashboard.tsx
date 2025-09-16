import React, { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CogIcon,
  EyeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import CostChart from '../components/dashboard/CostChart';
import UsageMetrics from '../components/dashboard/UsageMetrics';
import DecisionHistory from '../components/dashboard/DecisionHistory';
import OperationTimeline from '../components/dashboard/OperationTimeline';
import AIUsageBreakdown from '../components/dashboard/AIUsageBreakdown';

interface DashboardData {
  totalCost: number;
  monthlyLimit: number;
  dailyLimit: number;
  operations: number;
  successRate: number;
  avgResponseTime: number;
  tokensUsed: number;
  costPerOperation: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

const TransparencyDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalCost: 0,
    monthlyLimit: 1000,
    dailyLimit: 50,
    operations: 0,
    successRate: 0,
    avgResponseTime: 0,
    tokensUsed: 0,
    costPerOperation: 0
  });

  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tabs = [
    {
      name: 'Overview',
      icon: EyeIcon,
      description: 'Dashboard summary and key metrics'
    },
    {
      name: 'Costs',
      icon: CurrencyDollarIcon,
      description: 'Cost analysis and spending trends'
    },
    {
      name: 'Operations',
      icon: ClockIcon,
      description: 'AI operations timeline and details'
    },
    {
      name: 'Decisions',
      icon: ChartBarIcon,
      description: 'Authorization decisions history'
    },
    {
      name: 'Settings',
      icon: CogIcon,
      description: 'Dashboard configuration'
    }
  ];

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load dashboard data via IPC
        const data = await window.electron.ipcRenderer.invoke('dashboard:loadData', {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        });

        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        console.error('Dashboard data loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();

    // Set up real-time updates
    const unsubscribe = window.electron.ipcRenderer.on('dashboard:dataUpdate', (data) => {
      setDashboardData(prevData => ({ ...prevData, ...data }));
    });

    return () => {
      unsubscribe();
    };
  }, [dateRange]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      await window.electron.ipcRenderer.invoke('dashboard:export', {
        format,
        data: dashboardData,
        dateRange,
        tab: tabs[selectedIndex].name.toLowerCase()
      });
    } catch (err) {
      console.error(`Export ${format.toUpperCase()} error:`, err);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const calculateUsagePercentage = (used: number, limit: number): number => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageStatus = (percentage: number): 'safe' | 'warning' | 'danger' => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    return 'safe';
  };

  const monthlyUsagePercentage = calculateUsagePercentage(dashboardData.totalCost, dashboardData.monthlyLimit);
  const usageStatus = getUsageStatus(monthlyUsagePercentage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transparency dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Dashboard Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  AI Transparency Dashboard
                </h1>
                <p className="mt-1 text-gray-600">
                  Complete visibility into AI usage, costs, and decisions
                </p>
              </div>

              <div className="flex items-center space-x-4">
                {/* Date Range Selector */}
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange(prev => ({
                      ...prev,
                      start: new Date(e.target.value)
                    }))}
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    value={dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange(prev => ({
                      ...prev,
                      end: new Date(e.target.value)
                    }))}
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                  />
                </div>

                {/* Export Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Cost Overview Cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Total Cost</p>
                    <p className="text-2xl font-bold">{formatCurrency(dashboardData.totalCost)}</p>
                  </div>
                  <CurrencyDollarIcon className="h-8 w-8 text-purple-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600">Monthly Limit</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(dashboardData.monthlyLimit)}
                    </p>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          usageStatus === 'danger' ? 'bg-red-500' :
                          usageStatus === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${monthlyUsagePercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {monthlyUsagePercentage.toFixed(1)}% used
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600">Daily Limit</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(dashboardData.dailyLimit)}
                    </p>
                  </div>
                  <ClockIcon className="h-8 w-8 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
          <Tab.List className="flex space-x-1 rounded-xl bg-purple-900/10 p-1">
            {tabs.map((tab, index) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `w-full rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 ${
                    selected
                      ? 'bg-white text-purple-700 shadow-lg transform scale-105'
                      : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </div>
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels className="mt-6">
            {/* Overview Panel */}
            <Tab.Panel className="space-y-6">
              <UsageMetrics data={dashboardData} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CostChart dateRange={dateRange} />
                <AIUsageBreakdown dateRange={dateRange} />
              </div>
            </Tab.Panel>

            {/* Costs Panel */}
            <Tab.Panel className="space-y-6">
              <CostChart dateRange={dateRange} detailed />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Cost per Operation</h3>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(dashboardData.costPerOperation)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Operations</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData.operations.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Tokens Used</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {dashboardData.tokensUsed.toLocaleString()}
                  </p>
                </div>
              </div>
            </Tab.Panel>

            {/* Operations Panel */}
            <Tab.Panel className="space-y-6">
              <OperationTimeline dateRange={dateRange} />
              <AIUsageBreakdown dateRange={dateRange} detailed />
            </Tab.Panel>

            {/* Decisions Panel */}
            <Tab.Panel>
              <DecisionHistory dateRange={dateRange} />
            </Tab.Panel>

            {/* Settings Panel */}
            <Tab.Panel>
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Dashboard Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Cost Limit
                    </label>
                    <input
                      type="number"
                      value={dashboardData.monthlyLimit}
                      onChange={(e) => setDashboardData(prev => ({
                        ...prev,
                        monthlyLimit: Number(e.target.value)
                      }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Daily Cost Limit
                    </label>
                    <input
                      type="number"
                      value={dashboardData.dailyLimit}
                      onChange={(e) => setDashboardData(prev => ({
                        ...prev,
                        dailyLimit: Number(e.target.value)
                      }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    Save Settings
                  </button>
                </div>
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
};

export default TransparencyDashboard;