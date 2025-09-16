import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import styles from './SuccessRateIndicator.module.css';

export interface SuccessRateIndicatorProps {
  rate: number; // 0-100
  showLabel?: boolean;
  showTrend?: boolean;
  previousRate?: number;
  compact?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const SuccessRateIndicator = memo(function SuccessRateIndicator({
  rate,
  showLabel = false,
  showTrend = false,
  previousRate,
  compact = false,
  size = 'medium'
}: SuccessRateIndicatorProps) {
  // Determine status based on rate
  const getStatus = (rate: number) => {
    if (rate >= 80) return 'excellent';
    if (rate >= 60) return 'good';
    if (rate >= 40) return 'fair';
    return 'poor';
  };
  
  const status = getStatus(rate);
  
  // Calculate trend if previous rate provided
  const trend = previousRate !== undefined 
    ? rate > previousRate ? 'up' : rate < previousRate ? 'down' : 'stable'
    : null;
  
  // Select appropriate icon
  const getIcon = () => {
    if (status === 'excellent') return CheckCircle;
    if (status === 'good') return CheckCircle;
    if (status === 'fair') return AlertCircle;
    return XCircle;
  };
  
  const Icon = getIcon();
  
  // Get trend icon
  const getTrendIcon = () => {
    if (trend === 'up') return TrendingUp;
    if (trend === 'down') return TrendingDown;
    return Minus;
  };
  
  const TrendIcon = showTrend && trend ? getTrendIcon() : null;
  
  if (compact) {
    return (
      <div 
        className={`${styles.indicator} ${styles.compact} ${styles[status]}`}
        aria-label={`Success rate: ${rate}%`}
        title={`Success rate: ${rate}%`}
      >
        <Icon size={14} />
        <span className={styles.rateCompact}>{rate}%</span>
      </div>
    );
  }
  
  return (
    <div 
      className={`${styles.indicator} ${styles[size]} ${styles[status]}`}
      role="meter"
      aria-valuenow={rate}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Success rate: ${rate}%`}
    >
      <div className={styles.visual}>
        <div className={styles.iconWrapper}>
          <Icon className={styles.icon} size={size === 'small' ? 16 : size === 'large' ? 24 : 20} />
        </div>
        
        <div className={styles.progressRing}>
          <svg 
            className={styles.progressSvg}
            viewBox="0 0 36 36"
            aria-hidden="true"
          >
            <circle
              className={styles.progressBg}
              cx="18"
              cy="18"
              r="16"
              fill="none"
              strokeWidth="2"
            />
            <circle
              className={styles.progressFill}
              cx="18"
              cy="18"
              r="16"
              fill="none"
              strokeWidth="2"
              strokeDasharray={`${rate} 100`}
              strokeDashoffset="25"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <div className={styles.rateText}>
            <span className={styles.rateValue}>{rate}</span>
            <span className={styles.ratePercent}>%</span>
          </div>
        </div>
      </div>
      
      {showLabel && (
        <div className={styles.labelSection}>
          <span className={styles.label}>Success Rate</span>
          {showTrend && TrendIcon && (
            <div className={`${styles.trend} ${styles[trend]}`}>
              <TrendIcon size={12} />
              {previousRate !== undefined && (
                <span className={styles.trendValue}>
                  {Math.abs(rate - previousRate)}%
                </span>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className={styles.statusBar}>
        <div 
          className={styles.statusFill}
          style={{ width: `${rate}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
});