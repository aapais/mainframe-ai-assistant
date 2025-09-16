/**
 * DateRangeFilter - Advanced Date Range Selection Component
 *
 * Features:
 * - Calendar picker with range selection
 * - Quick date presets (last week, month, etc.)
 * - Custom date range input
 * - Date format localization
 * - Keyboard navigation
 * - Accessibility compliance
 *
 * @author Frontend Developer  
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo
} from 'react';
import {
  Calendar,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowRight
} from 'lucide-react';

// ========================
// Types & Interfaces
// ========================

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DatePreset {
  id: string;
  label: string;
  range: () => DateRange;
  icon?: React.ReactNode;
  description?: string;
}

export interface DateRangeFilterProps {
  /** Filter configuration */
  filter: {
    id: string;
    label: string;
    value: DateRange | null;
    active: boolean;
    metadata?: Record<string, any>;
  };
  /** Callback when date range changes */
  onChange: (value: DateRange | null, active: boolean) => void;
  /** Available date presets */
  presets?: DatePreset[];
  /** Date format for display */
  dateFormat?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Compact mode */
  compact?: boolean;
  /** Show time selection */
  showTime?: boolean;
  /** Custom CSS className */
  className?: string;
  /** Loading state */
  loading?: boolean;
}

// ========================
// Default Presets
// ========================

const DEFAULT_PRESETS: DatePreset[] = [
  {
    id: 'today',
    label: 'Today',
    icon: <Calendar size={14} />,
    description: 'Items from today',
    range: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { start: today, end: endOfDay };
    }
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    icon: <Calendar size={14} />,
    description: 'Items from yesterday',
    range: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endOfDay = new Date(yesterday);
      endOfDay.setHours(23, 59, 59, 999);
      return { start: yesterday, end: endOfDay };
    }
  },
  {
    id: 'last7days',
    label: 'Last 7 days',
    icon: <CalendarDays size={14} />,
    description: 'Items from the past week',
    range: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
  },
  {
    id: 'last30days',
    label: 'Last 30 days',
    icon: <CalendarDays size={14} />,
    description: 'Items from the past month',
    range: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
  },
  {
    id: 'last90days',
    label: 'Last 90 days',
    icon: <CalendarDays size={14} />,
    description: 'Items from the past 3 months',
    range: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
  },
  {
    id: 'thisMonth',
    label: 'This month',
    icon: <Calendar size={14} />,
    description: 'Items from this month',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  },
  {
    id: 'lastMonth',
    label: 'Last month',
    icon: <Calendar size={14} />,
    description: 'Items from last month',
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }
];

// ========================
// Utility Functions
// ========================

const formatDate = (date: Date | null, format: string = 'MM/dd/yyyy'): string => {
  if (!date) return '';
  
  // Simple date formatting - in a real app, use date-fns or similar
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  return format
    .replace('MM', month)
    .replace('dd', day)
    .replace('yyyy', String(year));
};

const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

const isSameDay = (date1: Date | null, date2: Date | null): boolean => {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const isDateInRange = (date: Date, start: Date | null, end: Date | null): boolean => {
  if (!start && !end) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

// ========================
// Calendar Component
// ========================

const CalendarGrid = memo<{
  currentMonth: Date;
  selectedRange: DateRange;
  onDateSelect: (date: Date) => void;
  onMonthChange: (direction: 'prev' | 'next') => void;
  minDate?: Date;
  maxDate?: Date;
  compact?: boolean;
}>(({ 
  currentMonth, 
  selectedRange, 
  onDateSelect, 
  onMonthChange, 
  minDate, 
  maxDate,
  compact = false 
}) => {
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    return days;
  }, [currentMonth]);
  
  const isDateDisabled = useCallback((date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }, [minDate, maxDate]);
  
  const isDateSelected = useCallback((date: Date) => {
    return (
      isSameDay(date, selectedRange.start) ||
      isSameDay(date, selectedRange.end) ||
      isDateInRange(date, selectedRange.start, selectedRange.end)
    );
  }, [selectedRange]);
  
  return (
    <div className="calendar-grid bg-white border border-gray-200 rounded-lg p-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange('prev')}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : ''}`}>
          {monthName}
        </h3>
        
        <button
          onClick={() => onMonthChange('next')}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      
      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div 
            key={day} 
            className={`text-center font-medium text-gray-500 ${compact ? 'text-xs py-1' : 'text-sm py-2'}`}
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isSelected = isDateSelected(date);
          const isDisabled = isDateDisabled(date);
          const isToday = isSameDay(date, new Date());
          const isRangeStart = isSameDay(date, selectedRange.start);
          const isRangeEnd = isSameDay(date, selectedRange.end);
          
          return (
            <button
              key={index}
              onClick={() => !isDisabled && onDateSelect(date)}
              disabled={isDisabled}
              className={`
                ${compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'}
                flex items-center justify-center rounded transition-colors
                ${!isCurrentMonth ? 'text-gray-400' : ''}
                ${isToday ? 'font-bold' : ''}
                ${isSelected 
                  ? (isRangeStart || isRangeEnd 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-100 text-blue-700')
                  : 'hover:bg-gray-100'
                }
                ${isDisabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-label={`Select ${formatDate(date)}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ========================
// Date Input Component
// ========================

const DateInputs = memo<{
  selectedRange: DateRange;
  onChange: (range: DateRange) => void;
  dateFormat?: string;
  showTime?: boolean;
  compact?: boolean;
}>(({ selectedRange, onChange, dateFormat = 'MM/dd/yyyy', showTime = false, compact = false }) => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  
  useEffect(() => {
    setStartInput(selectedRange.start ? formatDate(selectedRange.start, dateFormat) : '');
    setEndInput(selectedRange.end ? formatDate(selectedRange.end, dateFormat) : '');
  }, [selectedRange, dateFormat]);
  
  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartInput(value);
    
    const date = parseDate(value);
    if (date) {
      onChange({ ...selectedRange, start: date });
    }
  }, [selectedRange, onChange]);
  
  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndInput(value);
    
    const date = parseDate(value);
    if (date) {
      onChange({ ...selectedRange, end: date });
    }
  }, [selectedRange, onChange]);
  
  return (
    <div className="date-inputs space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <div className="relative">
            <input
              type="text"
              value={startInput}
              onChange={handleStartChange}
              placeholder={dateFormat}
              className={`
                w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg
                ${compact ? 'text-sm' : ''}
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
              `}
            />
            <Calendar size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        
        <div className="flex items-center pt-6">
          <ArrowRight size={16} className="text-gray-400" />
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <div className="relative">
            <input
              type="text"
              value={endInput}
              onChange={handleEndChange}
              placeholder={dateFormat}
              className={`
                w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg
                ${compact ? 'text-sm' : ''}
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
              `}
            />
            <Calendar size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>
      
      {showTime && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <div className="relative">
              <input
                type="time"
                className={`
                  w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg
                  ${compact ? 'text-sm' : ''}
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                `}
              />
              <Clock size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <div className="relative">
              <input
                type="time"
                className={`
                  w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg
                  ${compact ? 'text-sm' : ''}
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                `}
              />
              <Clock size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ========================
// Main DateRangeFilter Component
// ========================

export const DateRangeFilter = memo<DateRangeFilterProps>(({
  filter,
  onChange,
  presets = DEFAULT_PRESETS,
  dateFormat = 'MM/dd/yyyy',
  minDate,
  maxDate,
  compact = false,
  showTime = false,
  className = '',
  loading = false
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  
  const selectedRange = filter.value || { start: null, end: null };
  
  const handleDateSelect = useCallback((date: Date) => {
    let newRange: DateRange;
    
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      // Start new range
      newRange = { start: date, end: null };
    } else if (selectedRange.start && !selectedRange.end) {
      // Complete range
      if (date >= selectedRange.start) {
        newRange = { start: selectedRange.start, end: date };
      } else {
        newRange = { start: date, end: selectedRange.start };
      }
    } else {
      newRange = { start: date, end: null };
    }
    
    onChange(newRange, newRange.start !== null || newRange.end !== null);
    setActivePreset(null);
  }, [selectedRange, onChange]);
  
  const handlePresetSelect = useCallback((preset: DatePreset) => {
    const range = preset.range();
    onChange(range, true);
    setActivePreset(preset.id);
    setShowCalendar(false);
  }, [onChange]);
  
  const handleClear = useCallback(() => {
    onChange(null, false);
    setActivePreset(null);
  }, [onChange]);
  
  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  }, []);
  
  const formatRangeDisplay = useCallback(() => {
    if (!selectedRange.start && !selectedRange.end) {
      return 'Select date range';
    }
    
    if (selectedRange.start && !selectedRange.end) {
      return `From ${formatDate(selectedRange.start, dateFormat)}`;
    }
    
    if (selectedRange.start && selectedRange.end) {
      if (isSameDay(selectedRange.start, selectedRange.end)) {
        return formatDate(selectedRange.start, dateFormat);
      }
      return `${formatDate(selectedRange.start, dateFormat)} - ${formatDate(selectedRange.end, dateFormat)}`;
    }
    
    return 'Select date range';
  }, [selectedRange, dateFormat]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 text-sm">Loading date options...</span>
      </div>
    );
  }
  
  return (
    <div className={`date-range-filter ${className}`}>
      {/* Date Range Display */}
      <div className="mb-3">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className={`
            w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg
            ${compact ? 'text-sm' : ''}
            hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${selectedRange.start || selectedRange.end ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}
          `}
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-500" />
            <span>{formatRangeDisplay()}</span>
          </div>
          
          {(selectedRange.start || selectedRange.end) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              aria-label="Clear date range"
            >
              <X size={14} />
            </button>
          )}
        </button>
      </div>
      
      {/* Date Presets */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              className={`
                flex items-center gap-2 p-2 rounded-lg border text-left transition-colors
                ${compact ? 'text-xs' : 'text-sm'}
                ${activePreset === preset.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              title={preset.description}
            >
              {preset.icon}
              <span className="truncate">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Calendar and Date Inputs */}
      {showCalendar && (
        <div className="space-y-4">
          <CalendarGrid
            currentMonth={currentMonth}
            selectedRange={selectedRange}
            onDateSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
            minDate={minDate}
            maxDate={maxDate}
            compact={compact}
          />
          
          <DateInputs
            selectedRange={selectedRange}
            onChange={(range) => onChange(range, range.start !== null || range.end !== null)}
            dateFormat={dateFormat}
            showTime={showTime}
            compact={compact}
          />
        </div>
      )}
    </div>
  );
});

DateRangeFilter.displayName = 'DateRangeFilter';

export default DateRangeFilter;