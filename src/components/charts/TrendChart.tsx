import React, { useMemo, useState } from 'react';
import { PerformanceMetric, ChartConfig } from '../../types/performance';

interface TrendChartProps {
  metrics: PerformanceMetric[];
  timeRange: string;
  selectedMetrics: string[];
  chartConfig: ChartConfig;
  height?: number;
  onMetricToggle?: (metric: string) => void;
}

interface ChartPoint {
  timestamp: number;
  [key: string]: number;
}

interface ChartSeries {
  name: string;
  data: number[];
  color: string;
  visible: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  metrics,
  timeRange,
  selectedMetrics,
  chartConfig,
  height = 400,
  onMetricToggle
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    new Set(selectedMetrics)
  );

  // Process metrics into chart data
  const chartData = useMemo(() => {
    if (!metrics.length) return { points: [], series: [], timestamps: [] };

    // Group metrics by timestamp and aggregate
    const timeGroups = new Map<number, Record<string, number[]>>();

    metrics.forEach(metric => {
      const timeKey = Math.floor(metric.timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000); // 5-minute buckets

      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, {});
      }

      const group = timeGroups.get(timeKey)!;
      if (!group[metric.metric]) {
        group[metric.metric] = [];
      }

      group[metric.metric].push(metric.value);
    });

    // Convert to chart points
    const timestamps = Array.from(timeGroups.keys()).sort();
    const points: ChartPoint[] = timestamps.map(timestamp => {
      const group = timeGroups.get(timestamp)!;
      const point: ChartPoint = { timestamp };

      selectedMetrics.forEach(metricName => {
        const values = group[metricName] || [];
        if (values.length > 0) {
          // Apply aggregation
          switch (chartConfig.aggregation) {
            case 'avg':
              point[metricName] = values.reduce((a, b) => a + b, 0) / values.length;
              break;
            case 'sum':
              point[metricName] = values.reduce((a, b) => a + b, 0);
              break;
            case 'min':
              point[metricName] = Math.min(...values);
              break;
            case 'max':
              point[metricName] = Math.max(...values);
              break;
            case 'p95':
              const sorted95 = values.sort((a, b) => a - b);
              point[metricName] = sorted95[Math.floor(sorted95.length * 0.95)];
              break;
            case 'p99':
              const sorted99 = values.sort((a, b) => a - b);
              point[metricName] = sorted99[Math.floor(sorted99.length * 0.99)];
              break;
            default:
              point[metricName] = values[values.length - 1]; // Latest
          }
        }
      });

      return point;
    });

    // Create series
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
    ];

    const series: ChartSeries[] = selectedMetrics.map((metricName, index) => ({
      name: metricName,
      data: points.map(p => p[metricName] || 0),
      color: colors[index % colors.length],
      visible: visibleMetrics.has(metricName)
    }));

    return { points, series, timestamps };
  }, [metrics, selectedMetrics, chartConfig.aggregation, visibleMetrics]);

  // Calculate chart dimensions and scales
  const chartDimensions = useMemo(() => {
    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
    const width = 800;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Calculate scales
    const visibleSeries = chartData.series.filter(s => s.visible);
    const allValues = visibleSeries.flatMap(s => s.data).filter(v => !isNaN(v));

    const minValue = allValues.length ? Math.min(...allValues) : 0;
    const maxValue = allValues.length ? Math.max(...allValues) : 100;
    const valueRange = maxValue - minValue;

    const yMin = Math.max(0, minValue - valueRange * 0.1);
    const yMax = maxValue + valueRange * 0.1;

    return {
      margin,
      width,
      chartWidth,
      chartHeight,
      yMin,
      yMax,
      xScale: (index: number) => (index / Math.max(1, chartData.timestamps.length - 1)) * chartWidth,
      yScale: (value: number) => chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight
    };
  }, [chartData, height, visibleMetrics]);

  const handleMetricToggle = (metricName: string) => {
    const newVisible = new Set(visibleMetrics);
    if (newVisible.has(metricName)) {
      newVisible.delete(metricName);
    } else {
      newVisible.add(metricName);
    }
    setVisibleMetrics(newVisible);
    onMetricToggle?.(metricName);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1h' || timeRange === '6h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatValue = (value: number, metricName: string) => {
    if (metricName.includes('time') || metricName.includes('latency')) {
      return value < 1000 ? `${value.toFixed(0)}ms` : `${(value / 1000).toFixed(2)}s`;
    }
    if (metricName.includes('memory') || metricName.includes('size')) {
      return value < 1024 ? `${value.toFixed(1)}MB` : `${(value / 1024).toFixed(2)}GB`;
    }
    if (metricName.includes('rate') || metricName.includes('percent')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines = [];
    const { chartHeight, yMin, yMax, yScale } = chartDimensions;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const value = yMin + (yMax - yMin) * (i / 5);
      const y = yScale(value);
      lines.push(
        <g key={`grid-h-${i}`}>
          <line
            x1={0}
            y1={y}
            x2={chartDimensions.chartWidth}
            y2={y}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
          <text
            x={-10}
            y={y + 4}
            textAnchor="end"
            fontSize="12"
            fill="#6b7280"
          >
            {value.toFixed(1)}
          </text>
        </g>
      );
    }

    // Vertical grid lines
    const timeStep = Math.max(1, Math.floor(chartData.timestamps.length / 6));
    for (let i = 0; i < chartData.timestamps.length; i += timeStep) {
      const x = chartDimensions.xScale(i);
      lines.push(
        <g key={`grid-v-${i}`}>
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={chartHeight}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
          <text
            x={x}
            y={chartHeight + 20}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
          >
            {formatTimestamp(chartData.timestamps[i])}
          </text>
        </g>
      );
    }

    return lines;
  }, [chartDimensions, chartData.timestamps]);

  // Generate chart paths
  const chartPaths = useMemo(() => {
    return chartData.series
      .filter(series => series.visible && series.data.length > 0)
      .map(series => {
        const pathData = series.data
          .map((value, index) => {
            const x = chartDimensions.xScale(index);
            const y = chartDimensions.yScale(value);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ');

        return (
          <g key={series.name}>
            {/* Area fill (if area chart) */}
            {chartConfig.type === 'area' && (
              <path
                d={`${pathData} L ${chartDimensions.xScale(series.data.length - 1)} ${chartDimensions.chartHeight} L ${chartDimensions.xScale(0)} ${chartDimensions.chartHeight} Z`}
                fill={series.color}
                fillOpacity={0.2}
              />
            )}

            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke={series.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Data points */}
            {series.data.map((value, index) => (
              <circle
                key={index}
                cx={chartDimensions.xScale(index)}
                cy={chartDimensions.yScale(value)}
                r={hoveredPoint === index ? 6 : 3}
                fill={series.color}
                stroke="white"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(index)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}
          </g>
        );
      });
  }, [chartData.series, chartDimensions, chartConfig.type, hoveredPoint]);

  return (
    <div className="trend-chart">
      <div className="chart-header">
        <h3>Performance Trends</h3>
        <div className="chart-controls">
          <div className="aggregation-selector">
            <label>Aggregation:</label>
            <select
              value={chartConfig.aggregation}
              onChange={(e) => {
                // Handle aggregation change
                console.log('Aggregation changed:', e.target.value);
              }}
            >
              <option value="avg">Average</option>
              <option value="sum">Sum</option>
              <option value="min">Minimum</option>
              <option value="max">Maximum</option>
              <option value="p95">95th Percentile</option>
              <option value="p99">99th Percentile</option>
            </select>
          </div>
        </div>
      </div>

      <div className="chart-legend">
        {chartData.series.map(series => (
          <div
            key={series.name}
            className={`legend-item ${series.visible ? 'visible' : 'hidden'}`}
            onClick={() => handleMetricToggle(series.name)}
          >
            <div
              className="legend-color"
              style={{ backgroundColor: series.color }}
            />
            <span className="legend-label">{series.name}</span>
          </div>
        ))}
      </div>

      <div className="chart-container">
        <svg
          width={chartDimensions.width}
          height={height}
          style={{ overflow: 'visible' }}
        >
          <g transform={`translate(${chartDimensions.margin.left}, ${chartDimensions.margin.top})`}>
            {/* Grid */}
            {gridLines}

            {/* Chart paths */}
            {chartPaths}

            {/* Hover tooltip */}
            {hoveredPoint !== null && (
              <g transform={`translate(${chartDimensions.xScale(hoveredPoint)}, 0)`}>
                <line
                  y1={0}
                  y2={chartDimensions.chartHeight}
                  stroke="#6b7280"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <rect
                  x={10}
                  y={10}
                  width={150}
                  height={chartData.series.filter(s => s.visible).length * 20 + 30}
                  fill="white"
                  stroke="#e5e7eb"
                  rx={4}
                />
                <text x={15} y={30} fontSize="12" fontWeight="bold" fill="#374151">
                  {formatTimestamp(chartData.timestamps[hoveredPoint])}
                </text>
                {chartData.series
                  .filter(s => s.visible)
                  .map((series, index) => (
                    <text
                      key={series.name}
                      x={15}
                      y={50 + index * 20}
                      fontSize="12"
                      fill={series.color}
                    >
                      {series.name}: {formatValue(series.data[hoveredPoint], series.name)}
                    </text>
                  ))}
              </g>
            )}
          </g>
        </svg>
      </div>

      <style jsx>{`
        .trend-chart {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .chart-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
        }

        .chart-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .aggregation-selector {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .aggregation-selector label {
          color: var(--text-secondary);
        }

        .aggregation-selector select {
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .legend-item:hover {
          background: var(--bg-tertiary);
        }

        .legend-item.hidden {
          opacity: 0.5;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .legend-label {
          font-size: 0.875rem;
          color: var(--text-primary);
          text-transform: capitalize;
        }

        .chart-container {
          display: flex;
          justify-content: center;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};

export default TrendChart;