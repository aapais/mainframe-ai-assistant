import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ZoomInIcon,
  ZoomOutIcon,
  CalendarIcon,
  InformationCircleIcon,
  PlayIcon,
  PauseIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';

interface TimelineOperation {
  id: string;
  timestamp: string;
  operation: string;
  operationType: 'kb_query' | 'kb_create' | 'kb_update' | 'kb_delete' | 'analysis' | 'generation';
  status: 'success' | 'failure' | 'timeout' | 'pending';
  duration: number;
  cost: number;
  tokens?: number;
  details?: string;
}

interface OperationTimelineProps {
  dateRange: {
    start: Date;
    end: Date;
  };
}

type ZoomLevel = 'hour' | 'day' | 'week';

const OperationTimeline: React.FC<OperationTimelineProps> = ({ dateRange }) => {
  const [operations, setOperations] = useState<TimelineOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<TimelineOperation | null>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredOperation, setHoveredOperation] = useState<TimelineOperation | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadOperations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await window.electron.ipcRenderer.invoke('dashboard:getOperationTimeline', {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        });

        setOperations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load operation timeline');
        console.error('Operation timeline loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadOperations();

    // Set up real-time updates
    const unsubscribe = window.electron.ipcRenderer.on('dashboard:newOperation', (operation: TimelineOperation) => {
      setOperations(prev => [...prev, operation].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ));
    });

    return () => {
      unsubscribe();
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [dateRange]);

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = new Date(prev.getTime() + getTimeIncrement());
          if (next > dateRange.end) {
            setIsPlaying(false);
            return dateRange.end;
          }
          return next;
        });
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, dateRange.end]);

  const getTimeIncrement = (): number => {
    switch (zoomLevel) {
      case 'hour': return 60 * 1000; // 1 minute
      case 'day': return 60 * 60 * 1000; // 1 hour
      case 'week': return 24 * 60 * 60 * 1000; // 1 day
      default: return 60 * 60 * 1000;
    }
  };

  const timelineData = useMemo(() => {
    const totalDuration = dateRange.end.getTime() - dateRange.start.getTime();
    const timelineWidth = 100; // percentage

    return operations.map(op => {
      const opTime = new Date(op.timestamp).getTime();
      const position = ((opTime - dateRange.start.getTime()) / totalDuration) * timelineWidth;

      return {
        ...op,
        position: Math.max(0, Math.min(100, position))
      };
    });
  }, [operations, dateRange]);

  const currentTimePosition = useMemo(() => {
    const totalDuration = dateRange.end.getTime() - dateRange.start.getTime();
    return ((currentTime.getTime() - dateRange.start.getTime()) / totalDuration) * 100;
  }, [currentTime, dateRange]);

  const visibleOperations = useMemo(() => {
    if (!isPlaying) return timelineData;

    return timelineData.filter(op =>
      new Date(op.timestamp).getTime() <= currentTime.getTime()
    );
  }, [timelineData, currentTime, isPlaying]);

  const getOperationColor = (operationType: string, status: string): string => {
    const baseColors = {
      kb_query: '#3B82F6',      // blue
      kb_create: '#10B981',     // green
      kb_update: '#F59E0B',     // yellow
      kb_delete: '#EF4444',     // red
      analysis: '#8B5CF6',      // purple
      generation: '#6366F1'     // indigo
    };

    const opacity = status === 'success' ? '1' :
                   status === 'failure' ? '0.7' :
                   status === 'timeout' ? '0.5' : '0.3';

    return `${baseColors[operationType as keyof typeof baseColors] || '#6B7280'}${Math.round(parseFloat(opacity) * 255).toString(16).padStart(2, '0')}`;
  };

  const formatTime = (date: Date): string => {
    switch (zoomLevel) {
      case 'hour':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      case 'day':
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      case 'week':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      default:
        return date.toLocaleString();
    }
  };

  const getTimelineMarkers = (): Date[] => {
    const markers: Date[] = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    let current = new Date(start);

    switch (zoomLevel) {
      case 'hour':
        // Show hour markers
        current.setMinutes(0, 0, 0);
        while (current <= end) {
          markers.push(new Date(current));
          current.setHours(current.getHours() + 1);
        }
        break;
      case 'day':
        // Show day markers
        current.setHours(0, 0, 0, 0);
        while (current <= end) {
          markers.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        break;
      case 'week':
        // Show week markers
        current.setHours(0, 0, 0, 0);
        current.setDate(current.getDate() - current.getDay()); // Start of week
        while (current <= end) {
          markers.push(new Date(current));
          current.setDate(current.getDate() + 7);
        }
        break;
    }

    return markers;
  };

  const handleZoomIn = () => {
    if (zoomLevel === 'week') setZoomLevel('day');
    else if (zoomLevel === 'day') setZoomLevel('hour');
  };

  const handleZoomOut = () => {
    if (zoomLevel === 'hour') setZoomLevel('day');
    else if (zoomLevel === 'day') setZoomLevel('week');
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentTime(dateRange.start);
      setIsPlaying(true);
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

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-gray-200 rounded w-48"></div>
            <div className="flex space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded w-20"></div>
              ))}
            </div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border border-red-200">
        <div className="text-center text-red-600">
          <InformationCircleIcon className="h-12 w-12 mx-auto mb-4" />
          <p className="font-semibold">Error loading operation timeline</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Operation Timeline</h3>
          <p className="text-sm text-gray-600">
            Visual timeline of AI operations with interactive playback
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {isPlaying ? (
              <PauseIcon className="h-4 w-4 mr-1" />
            ) : (
              <PlayIcon className="h-4 w-4 mr-1" />
            )}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={handleZoomOut}
            disabled={zoomLevel === 'week'}
            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ZoomOutIcon className="h-4 w-4" />
          </button>

          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
            {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)}
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoomLevel === 'hour'}
            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ZoomInIcon className="h-4 w-4" />
          </button>

          <button
            onClick={() => setCurrentTime(dateRange.end)}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowsPointingOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative">
        {/* Time markers */}
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          {getTimelineMarkers().slice(0, 10).map((marker, index) => (
            <div key={index} className="flex-1 text-center">
              {formatTime(marker)}
            </div>
          ))}
        </div>

        {/* Timeline Track */}
        <div
          ref={timelineRef}
          className="relative h-32 bg-gray-100 rounded-lg overflow-hidden"
          style={{ minHeight: '128px' }}
        >
          {/* Timeline background grid */}
          <div className="absolute inset-0">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-gray-200"
                style={{ left: `${(i / 9) * 100}%` }}
              />
            ))}
          </div>

          {/* Current time indicator */}
          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 transition-all duration-100"
              style={{ left: `${currentTimePosition}%` }}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
            </div>
          )}

          {/* Operations */}
          {visibleOperations.map((operation, index) => (
            <div
              key={operation.id}
              className="absolute transform -translate-y-1/2 cursor-pointer transition-all duration-200 hover:scale-110"
              style={{
                left: `${operation.position}%`,
                top: `${30 + (index % 3) * 20}px`,
                zIndex: hoveredOperation?.id === operation.id ? 15 : 10
              }}
              onMouseEnter={() => setHoveredOperation(operation)}
              onMouseLeave={() => setHoveredOperation(null)}
              onClick={() => setSelectedOperation(operation)}
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{
                  backgroundColor: getOperationColor(operation.operationType, operation.status)
                }}
              ></div>

              {/* Operation pulse animation for real-time operations */}
              {new Date(operation.timestamp).getTime() > Date.now() - 5000 && (
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{
                    backgroundColor: getOperationColor(operation.operationType, operation.status)
                  }}
                ></div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
          {[
            { type: 'kb_query', label: 'Query', color: '#3B82F6' },
            { type: 'kb_create', label: 'Create', color: '#10B981' },
            { type: 'kb_update', label: 'Update', color: '#F59E0B' },
            { type: 'kb_delete', label: 'Delete', color: '#EF4444' },
            { type: 'analysis', label: 'Analysis', color: '#8B5CF6' },
            { type: 'generation', label: 'Generation', color: '#6366F1' }
          ].map(({ type, label, color }) => (
            <div key={type} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              ></div>
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredOperation && (
          <div className="absolute z-30 bg-black text-white px-3 py-2 rounded-lg text-sm pointer-events-none transform -translate-x-1/2 -translate-y-full"
               style={{
                 left: `${hoveredOperation.position}%`,
                 top: '0px'
               }}>
            <div className="font-semibold">{hoveredOperation.operation}</div>
            <div className="text-xs opacity-75">
              {formatTime(new Date(hoveredOperation.timestamp))}
            </div>
            <div className="text-xs">
              {formatCurrency(hoveredOperation.cost)} • {formatDuration(hoveredOperation.duration)}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-purple-600 font-medium">Total Operations</p>
          <p className="text-2xl font-bold text-purple-900">{operations.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-600 font-medium">Success Rate</p>
          <p className="text-2xl font-bold text-green-900">
            {((operations.filter(op => op.status === 'success').length / operations.length) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-600 font-medium">Avg Duration</p>
          <p className="text-2xl font-bold text-blue-900">
            {formatDuration(operations.reduce((sum, op) => sum + op.duration, 0) / operations.length)}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-medium">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(operations.reduce((sum, op) => sum + op.cost, 0))}
          </p>
        </div>
      </div>

      {/* Operation Details Modal */}
      {selectedOperation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Operation Details</h3>
                <button
                  onClick={() => setSelectedOperation(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Operation</label>
                  <p className="text-sm text-gray-900">{selectedOperation.operation}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: getOperationColor(selectedOperation.operationType, selectedOperation.status) + '20',
                          color: getOperationColor(selectedOperation.operationType, selectedOperation.status)
                        }}>
                    {selectedOperation.operationType.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="text-sm text-gray-900">{selectedOperation.status.toUpperCase()}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Timestamp</label>
                  <p className="text-sm text-gray-900">{formatTime(new Date(selectedOperation.timestamp))}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Duration</label>
                    <p className="text-sm text-gray-900">{formatDuration(selectedOperation.duration)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Cost</label>
                    <p className="text-sm text-gray-900">{formatCurrency(selectedOperation.cost)}</p>
                  </div>
                </div>

                {selectedOperation.tokens && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tokens</label>
                    <p className="text-sm text-gray-900">{selectedOperation.tokens.toLocaleString()}</p>
                  </div>
                )}

                {selectedOperation.details && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Details</label>
                    <p className="text-sm text-gray-900">{selectedOperation.details}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationTimeline;