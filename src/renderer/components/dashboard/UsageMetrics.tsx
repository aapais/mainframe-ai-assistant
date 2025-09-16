import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

interface UsageMetricsProps {
  data: {
    operations: number;
    successRate: number;
    avgResponseTime: number;
    tokensUsed: number;
    costPerOperation: number;
    totalCost: number;
  };
}

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  end,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(end * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration]);

  const formatNumber = (value: number): string => {
    return value.toFixed(decimals);
  };

  return (
    <span className="tabular-nums">
      {prefix}{formatNumber(count)}{suffix}
    </span>
  );
};

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  prefix?: string;
  suffix?: string;
  decimals?: number;
  change?: {
    value: number;
    direction: 'up' | 'down';
    period: string;
  };
  size?: 'small' | 'medium' | 'large';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  prefix = '',
  suffix = '',
  decimals = 0,
  change,
  size = 'medium'
}) => {
  const colorClasses = {
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      value: 'text-purple-900'
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      value: 'text-blue-900'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      value: 'text-green-900'
    },
    yellow: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      value: 'text-yellow-900'
    },
    red: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      value: 'text-red-900'
    },
    gray: {
      bg: 'bg-gray-50',
      icon: 'text-gray-600',
      value: 'text-gray-900'
    }
  };

  const sizeClasses = {
    small: {
      container: 'p-4',
      icon: 'h-6 w-6',
      value: 'text-xl',
      title: 'text-sm'
    },
    medium: {
      container: 'p-6',
      icon: 'h-8 w-8',
      value: 'text-2xl',
      title: 'text-base'
    },
    large: {
      container: 'p-8',
      icon: 'h-10 w-10',
      value: 'text-3xl',
      title: 'text-lg'
    }
  };

  const colors = colorClasses[color];
  const sizes = sizeClasses[size];

  return (
    <div className={`${colors.bg} rounded-lg ${sizes.container} border border-gray-200 transition-all duration-300 hover:shadow-lg hover:scale-105`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`${sizes.title} font-medium text-gray-600 mb-1`}>
            {title}
          </p>
          <p className={`${sizes.value} font-bold ${colors.value} transition-all duration-500`}>
            <AnimatedCounter
              end={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              duration={1500}
            />
          </p>
          {change && (
            <div className="flex items-center mt-2 text-sm">
              <span className={`flex items-center ${
                change.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {change.direction === 'up' ? '↗' : '↘'} {Math.abs(change.value)}%
              </span>
              <span className="text-gray-500 ml-2">vs {change.period}</span>
            </div>
          )}
        </div>
        <Icon className={`${sizes.icon} ${colors.icon}`} />
      </div>
    </div>
  );
};

const UsageMetrics: React.FC<UsageMetricsProps> = ({ data }) => {
  const [previousData, setPreviousData] = useState(data);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    // Update previous data when new data comes in
    const timer = setTimeout(() => {
      setPreviousData(data);
    }, 100);

    return () => clearTimeout(timer);
  }, [data]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatTime = (milliseconds: number): string => {
    if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
    return `${(milliseconds / 1000).toFixed(1)}s`;
  };

  const getSuccessRateStatus = (rate: number) => {
    if (rate >= 95) return { color: 'green' as const, status: 'Excellent' };
    if (rate >= 90) return { color: 'blue' as const, status: 'Good' };
    if (rate >= 85) return { color: 'yellow' as const, status: 'Fair' };
    return { color: 'red' as const, status: 'Needs Attention' };
  };

  const getResponseTimeStatus = (time: number) => {
    if (time <= 1000) return { color: 'green' as const, status: 'Fast' };
    if (time <= 3000) return { color: 'blue' as const, status: 'Good' };
    if (time <= 5000) return { color: 'yellow' as const, status: 'Slow' };
    return { color: 'red' as const, status: 'Very Slow' };
  };

  const successRateStatus = getSuccessRateStatus(data.successRate);
  const responseTimeStatus = getResponseTimeStatus(data.avgResponseTime);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, direction: 'up' as const };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change >= 0 ? 'up' as const : 'down' as const
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Usage Metrics</h3>
          <p className="text-sm text-gray-600">
            Key performance indicators and operational statistics
          </p>
        </div>
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {showComparison ? 'Hide' : 'Show'} Changes
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Total Operations"
          value={data.operations}
          icon={ChartBarIcon}
          color="purple"
          size="large"
          change={showComparison ? {
            ...calculateChange(data.operations, previousData.operations),
            period: 'last update'
          } : undefined}
        />

        <MetricCard
          title="Success Rate"
          value={data.successRate}
          icon={CheckCircleIcon}
          color={successRateStatus.color}
          suffix="%"
          decimals={1}
          size="large"
          change={showComparison ? {
            ...calculateChange(data.successRate, previousData.successRate),
            period: 'last update'
          } : undefined}
        />

        <MetricCard
          title="Avg Response Time"
          value={data.avgResponseTime}
          icon={ClockIcon}
          color={responseTimeStatus.color}
          suffix="ms"
          size="large"
          change={showComparison ? {
            ...calculateChange(data.avgResponseTime, previousData.avgResponseTime),
            period: 'last update'
          } : undefined}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Tokens Used"
          value={data.tokensUsed}
          icon={CpuChipIcon}
          color="blue"
          change={showComparison ? {
            ...calculateChange(data.tokensUsed, previousData.tokensUsed),
            period: 'last update'
          } : undefined}
        />

        <MetricCard
          title="Cost per Operation"
          value={Number(data.costPerOperation.toFixed(4))}
          icon={CurrencyDollarIcon}
          color="green"
          prefix="$"
          decimals={4}
          change={showComparison ? {
            ...calculateChange(data.costPerOperation, previousData.costPerOperation),
            period: 'last update'
          } : undefined}
        />

        <MetricCard
          title="Total Cost"
          value={Number(data.totalCost.toFixed(2))}
          icon={CurrencyDollarIcon}
          color="gray"
          prefix="$"
          decimals={2}
          change={showComparison ? {
            ...calculateChange(data.totalCost, previousData.totalCost),
            period: 'last update'
          } : undefined}
        />
      </div>

      {/* Status Indicators */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h4 className="text-lg font-medium text-gray-900 mb-4">System Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                successRateStatus.color === 'green' ? 'bg-green-500' :
                successRateStatus.color === 'blue' ? 'bg-blue-500' :
                successRateStatus.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Success Rate</p>
                <p className="text-xs text-gray-600">{successRateStatus.status}</p>
              </div>
            </div>
            <span className="text-lg font-bold text-gray-900">{data.successRate.toFixed(1)}%</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                responseTimeStatus.color === 'green' ? 'bg-green-500' :
                responseTimeStatus.color === 'blue' ? 'bg-blue-500' :
                responseTimeStatus.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Response Time</p>
                <p className="text-xs text-gray-600">{responseTimeStatus.status}</p>
              </div>
            </div>
            <span className="text-lg font-bold text-gray-900">
              {formatTime(data.avgResponseTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Indicator */}
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Metrics update in real-time</span>
      </div>
    </div>
  );
};

export default UsageMetrics;