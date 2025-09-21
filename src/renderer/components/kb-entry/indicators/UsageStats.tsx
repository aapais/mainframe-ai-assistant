import React, { memo } from 'react';
import { Eye, TrendingUp, Users, BarChart3 } from 'lucide-react';

export interface UsageStatsProps {
  count: number;
  showTrend?: boolean;
  previousCount?: number;
  compact?: boolean;
  showLabel?: boolean;
  showIcon?: boolean;
  format?: 'short' | 'long';
}

export const UsageStats = memo(function UsageStats({
  count,
  showTrend = false,
  previousCount,
  compact = false,
  showLabel = true,
  showIcon = true,
  format = 'short'
}: UsageStatsProps) {
  // Format the count for display
  const formatCount = (num: number): string => {
    if (format === 'short' && num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString();
  };
  
  // Calculate trend percentage if previous count provided
  const trendPercentage = previousCount !== undefined && previousCount > 0
    ? Math.round(((count - previousCount) / previousCount) * 100)
    : null;
  
  const isIncreasing = trendPercentage !== null && trendPercentage > 0;
  const isDecreasing = trendPercentage !== null && trendPercentage < 0;
  
  // Determine usage level for styling
  const getUsageLevel = (count: number) => {
    if (count >= 100) return 'high';
    if (count >= 50) return 'medium';
    if (count >= 10) return 'low';
    return 'minimal';
  };
  
  const usageLevel = getUsageLevel(count);
  
  if (compact) {
    return (
      <div 
        className={`${styles.stats} ${styles.compact}`}
        aria-label={`Used ${count} times`}
        title={`Used ${count} times`}
      >
        <Eye size={12} className={styles.icon} />
        <span className={styles.countCompact}>{formatCount(count)}</span>
      </div>
    );
  }
  
  return (
    <div 
      className={`${styles.stats} ${styles[usageLevel]}`}
      role="group"
      aria-label={`Usage statistics: ${count} times`}
    >
      {showIcon && (
        <div className={styles.iconWrapper}>
          <Eye className={styles.mainIcon} size={16} />
        </div>
      )}
      
      <div className={styles.content}>
        {showLabel && (
          <span className={styles.label}>Used</span>
        )}
        
        <div className={styles.countWrapper}>
          <span className={styles.count}>{formatCount(count)}</span>
          <span className={styles.times}>times</span>
        </div>
        
        {showTrend && trendPercentage !== null && (
          <div className={`${styles.trend} ${isIncreasing ? styles.up : isDecreasing ? styles.down : styles.stable}`}>
            {isIncreasing && <TrendingUp size={12} />}
            {isDecreasing && <TrendingUp size={12} style={{ transform: 'rotate(180deg)' }} />}
            <span className={styles.trendValue}>
              {isIncreasing ? '+' : ''}{trendPercentage}%
            </span>
          </div>
        )}
      </div>
      
      {/* Visual representation bar */}
      <div className={styles.visualBar}>
        <div 
          className={styles.visualFill}
          style={{ 
            width: `${Math.min(100, Math.log10(count + 1) * 25)}%` 
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
});

// Additional component for detailed usage breakdown
export interface DetailedUsageStatsProps {
  totalUses: number;
  recentUses: number;
  uniqueUsers?: number;
  averagePerDay?: number;
  peakDay?: { date: Date; count: number };
}

export const DetailedUsageStats = memo(function DetailedUsageStats({
  totalUses,
  recentUses,
  uniqueUsers,
  averagePerDay,
  peakDay
}: DetailedUsageStatsProps) {
  return (
    <div className={styles.detailedStats}>
      <h4 className={styles.detailedTitle}>Usage Analytics</h4>
      
      <div className={styles.statGrid}>
        <div className={styles.statItem}>
          <Eye className={styles.statIcon} size={14} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>{totalUses.toLocaleString()}</span>
            <span className={styles.statLabel}>Total Uses</span>
          </div>
        </div>
        
        <div className={styles.statItem}>
          <TrendingUp className={styles.statIcon} size={14} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>{recentUses.toLocaleString()}</span>
            <span className={styles.statLabel}>Last 7 Days</span>
          </div>
        </div>
        
        {uniqueUsers !== undefined && (
          <div className={styles.statItem}>
            <Users className={styles.statIcon} size={14} />
            <div className={styles.statContent}>
              <span className={styles.statValue}>{uniqueUsers.toLocaleString()}</span>
              <span className={styles.statLabel}>Unique Users</span>
            </div>
          </div>
        )}
        
        {averagePerDay !== undefined && (
          <div className={styles.statItem}>
            <BarChart3 className={styles.statIcon} size={14} />
            <div className={styles.statContent}>
              <span className={styles.statValue}>{averagePerDay.toFixed(1)}</span>
              <span className={styles.statLabel}>Avg/Day</span>
            </div>
          </div>
        )}
      </div>
      
      {peakDay && (
        <div className={styles.peakInfo}>
          <span className={styles.peakLabel}>Peak Usage:</span>
          <span className={styles.peakValue}>
            {peakDay.count} uses on {peakDay.date.toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
});