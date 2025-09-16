/**
 * Metrics Chart Component
 * Reusable chart component for displaying performance metrics
 */

import React from 'react';

interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface MetricsChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'bar' | 'area';
  yAxisLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  data,
  type,
  yAxisLabel,
  height = 200,
  showGrid = true,
  showLegend = false
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const getBarHeight = (value: number) => {
    return ((value - minValue) / range) * (height - 40);
  };

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(1);
  };

  const defaultColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
  ];

  const renderBarChart = () => {
    const barWidth = Math.max(40, (100 - (data.length - 1) * 8) / data.length);

    return (
      <div className="relative" style={{ height }}>
        {/* Grid lines */}
        {showGrid && (
          <div className="absolute inset-0">
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <div
                key={ratio}
                className="absolute w-full border-t border-gray-200"
                style={{ bottom: `${ratio * (height - 40) + 20}px` }}
              />
            ))}
          </div>
        )}

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue(maxValue * 0.75)}</span>
          <span>{formatValue(maxValue * 0.5)}</span>
          <span>{formatValue(maxValue * 0.25)}</span>
          <span>{formatValue(minValue)}</span>
        </div>

        {/* Bars */}
        <div className="flex items-end justify-center h-full pl-12 pr-4 pb-5">
          {data.map((point, index) => {
            const barHeight = getBarHeight(point.value);
            const color = point.color || defaultColors[index % defaultColors.length];

            return (
              <div
                key={point.name}
                className="flex flex-col items-center mx-1"
                style={{ width: `${barWidth}%` }}
              >
                <div
                  className="w-full rounded-t transition-all duration-300 hover:opacity-80 relative group"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: color,
                    minHeight: '2px'
                  }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {point.name}: {point.value.toFixed(1)}
                    {yAxisLabel && ` ${yAxisLabel.replace(/[()]/g, '')}`}
                  </div>
                </div>
                <span className="text-xs text-gray-600 mt-1 truncate w-full text-center">
                  {point.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Y-axis label */}
        {yAxisLabel && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-gray-500 whitespace-nowrap">
            {yAxisLabel}
          </div>
        )}
      </div>
    );
  };

  const renderLineChart = () => {
    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((point.value - minValue) / range) * 100;
      return { x, y, ...point };
    });

    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return (
      <div className="relative" style={{ height }}>
        {/* Grid lines */}
        {showGrid && (
          <svg className="absolute inset-0 w-full h-full">
            {[25, 50, 75].map((y) => (
              <line
                key={y}
                x1="10%"
                y1={`${y}%`}
                x2="90%"
                y2={`${y}%`}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            ))}
          </svg>
        )}

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue(maxValue * 0.75)}</span>
          <span>{formatValue(maxValue * 0.5)}</span>
          <span>{formatValue(maxValue * 0.25)}</span>
          <span>{formatValue(minValue)}</span>
        </div>

        {/* Line chart */}
        <svg className="w-full h-full pl-12 pr-4">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>

          <path
            d={pathData}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={`${point.x}%`}
              cy={`${point.y}%`}
              r="4"
              fill={point.color || '#3B82F6'}
              className="hover:r-6 transition-all cursor-pointer"
            >
              <title>{`${point.name}: ${point.value.toFixed(1)}`}</title>
            </circle>
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between px-12 pt-2">
          {data.map((point, index) => (
            <span key={index} className="text-xs text-gray-600 truncate">
              {point.name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderAreaChart = () => {
    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((point.value - minValue) / range) * 100;
      return { x, y, ...point };
    });

    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const areaData = `${pathData} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

    return (
      <div className="relative" style={{ height }}>
        {/* Grid lines */}
        {showGrid && (
          <svg className="absolute inset-0 w-full h-full">
            {[25, 50, 75].map((y) => (
              <line
                key={y}
                x1="10%"
                y1={`${y}%`}
                x2="90%"
                y2={`${y}%`}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            ))}
          </svg>
        )}

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue(maxValue * 0.75)}</span>
          <span>{formatValue(maxValue * 0.5)}</span>
          <span>{formatValue(maxValue * 0.25)}</span>
          <span>{formatValue(minValue)}</span>
        </div>

        {/* Area chart */}
        <svg className="w-full h-full pl-12 pr-4">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          <path
            d={areaData}
            fill="url(#areaGradient)"
          />

          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={`${point.x}%`}
              cy={`${point.y}%`}
              r="3"
              fill="#3B82F6"
              className="hover:r-5 transition-all cursor-pointer"
            >
              <title>{`${point.name}: ${point.value.toFixed(1)}`}</title>
            </circle>
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between px-12 pt-2">
          {data.map((point, index) => (
            <span key={index} className="text-xs text-gray-600 truncate">
              {point.name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {type === 'bar' && renderBarChart()}
      {type === 'line' && renderLineChart()}
      {type === 'area' && renderAreaChart()}

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center mt-4 space-x-4">
          {data.map((point, index) => (
            <div key={point.name} className="flex items-center space-x-1">
              <div
                className="w-3 h-3 rounded"
                style={{
                  backgroundColor: point.color || defaultColors[index % defaultColors.length]
                }}
              />
              <span className="text-xs text-gray-600">{point.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};