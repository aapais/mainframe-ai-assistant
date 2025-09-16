/**
 * Statistical Analysis Utilities
 * Advanced statistical methods for performance analysis
 */

class StatisticalAnalysis {
  constructor() {
    this.CONFIDENCE_LEVELS = {
      '90%': 1.645,
      '95%': 1.96,
      '99%': 2.576
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  correlation(x, y) {
    if (x.length !== y.length || x.length === 0) {
      throw new Error('Arrays must have the same non-zero length');
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Perform t-test for two independent samples
   */
  tTest(sample1, sample2, alpha = 0.05) {
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    if (n1 < 2 || n2 < 2) {
      throw new Error('Samples must have at least 2 observations each');
    }

    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const var1 = this.variance(sample1);
    const var2 = this.variance(sample2);

    // Welch's t-test (unequal variances)
    const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
    const tStatistic = (mean1 - mean2) / pooledSE;

    // Degrees of freedom using Welch-Satterthwaite equation
    const df = Math.pow(var1 / n1 + var2 / n2, 2) / 
               (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

    const pValue = this.tDistributionPValue(Math.abs(tStatistic), df);
    const isSignificant = pValue < alpha;

    return {
      tStatistic,
      degreesOfFreedom: df,
      pValue,
      isSignificant,
      effectSize: this.cohensD(sample1, sample2),
      confidenceInterval: this.confidenceInterval(mean1 - mean2, pooledSE, df, alpha)
    };
  }

  /**
   * Calculate Cohen's d (effect size)
   */
  cohensD(sample1, sample2) {
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const var1 = this.variance(sample1);
    const var2 = this.variance(sample2);
    
    const pooledStdDev = Math.sqrt(((sample1.length - 1) * var1 + (sample2.length - 1) * var2) / 
                                   (sample1.length + sample2.length - 2));
    
    return (mean1 - mean2) / pooledStdDev;
  }

  /**
   * Mann-Whitney U test (non-parametric alternative to t-test)
   */
  mannWhitneyU(sample1, sample2) {
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    // Combine and rank all observations
    const combined = [...sample1.map(x => ({ value: x, group: 1 })), 
                      ...sample2.map(x => ({ value: x, group: 2 }))];
    
    combined.sort((a, b) => a.value - b.value);
    
    // Assign ranks (handle ties)
    let currentRank = 1;
    for (let i = 0; i < combined.length; i++) {
      const tieStart = i;
      while (i < combined.length - 1 && combined[i].value === combined[i + 1].value) {
        i++;
      }
      const tieEnd = i;
      const averageRank = (currentRank + currentRank + (tieEnd - tieStart)) / 2;
      
      for (let j = tieStart; j <= tieEnd; j++) {
        combined[j].rank = averageRank;
      }
      
      currentRank += (tieEnd - tieStart) + 1;
    }
    
    // Calculate U statistics
    const R1 = combined.filter(x => x.group === 1).reduce((sum, x) => sum + x.rank, 0);
    const U1 = R1 - (n1 * (n1 + 1)) / 2;
    const U2 = n1 * n2 - U1;
    
    const U = Math.min(U1, U2);
    
    // Normal approximation for large samples
    if (n1 > 20 || n2 > 20) {
      const meanU = (n1 * n2) / 2;
      const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
      const zScore = (U - meanU) / stdU;
      const pValue = 2 * (1 - this.standardNormalCDF(Math.abs(zScore)));
      
      return {
        U1,
        U2,
        U,
        zScore,
        pValue,
        isSignificant: pValue < 0.05
      };
    }
    
    return {
      U1,
      U2,
      U,
      // For small samples, would need exact distribution tables
      pValue: null,
      isSignificant: null
    };
  }

  /**
   * Kolmogorov-Smirnov test for distribution comparison
   */
  kolmogorovSmirnov(sample1, sample2) {
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    const sorted1 = [...sample1].sort((a, b) => a - b);
    const sorted2 = [...sample2].sort((a, b) => a - b);
    
    // Create combined sorted array of unique values
    const allValues = [...new Set([...sorted1, ...sorted2])].sort((a, b) => a - b);
    
    let maxDifference = 0;
    
    for (const value of allValues) {
      const cdf1 = sorted1.filter(x => x <= value).length / n1;
      const cdf2 = sorted2.filter(x => x <= value).length / n2;
      const difference = Math.abs(cdf1 - cdf2);
      
      if (difference > maxDifference) {
        maxDifference = difference;
      }
    }
    
    // Critical value approximation
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));
    const isSignificant = maxDifference > criticalValue;
    
    return {
      dStatistic: maxDifference,
      criticalValue,
      isSignificant,
      pValue: this.ksDistributionPValue(maxDifference, n1, n2)
    };
  }

  /**
   * CUSUM (Cumulative Sum) change point detection
   */
  cusum(data, targetMean, threshold = 1) {
    const changePoints = [];
    let cumsum = 0;
    let cusumNeg = 0;
    
    for (let i = 0; i < data.length; i++) {
      const deviation = data[i] - targetMean;
      
      cumsum = Math.max(0, cumsum + deviation - threshold);
      cusumNeg = Math.min(0, cusumNeg + deviation + threshold);
      
      if (cumsum > 0 || cusumNeg < 0) {
        changePoints.push({
          index: i,
          value: data[i],
          cumsum,
          cusumNeg,
          detected: true
        });
      }
    }
    
    return {
      changePoints,
      hasChange: changePoints.length > 0,
      totalChanges: changePoints.length
    };
  }

  /**
   * Autocorrelation function
   */
  autocorrelation(data, maxLag = Math.floor(data.length / 4)) {
    const n = data.length;
    const mean = this.mean(data);
    const variance = this.variance(data);
    const autocorr = [];
    
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (data[i] - mean) * (data[i + lag] - mean);
      }
      autocorr[lag] = sum / ((n - lag) * variance);
    }
    
    return autocorr;
  }

  /**
   * Seasonal decomposition (simplified)
   */
  seasonalDecomposition(data, period) {
    if (data.length < 2 * period) {
      throw new Error('Data length must be at least twice the period');
    }
    
    const n = data.length;
    const trend = new Array(n);
    const seasonal = new Array(period).fill(0);
    const residual = new Array(n);
    
    // Calculate trend using moving average
    const halfPeriod = Math.floor(period / 2);
    for (let i = halfPeriod; i < n - halfPeriod; i++) {
      let sum = 0;
      for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
        sum += data[j];
      }
      trend[i] = sum / period;
    }
    
    // Calculate seasonal component
    const seasonalSums = new Array(period).fill(0);
    const seasonalCounts = new Array(period).fill(0);
    
    for (let i = 0; i < n; i++) {
      if (trend[i] !== undefined) {
        const seasonIndex = i % period;
        seasonalSums[seasonIndex] += data[i] - trend[i];
        seasonalCounts[seasonIndex]++;
      }
    }
    
    for (let i = 0; i < period; i++) {
      if (seasonalCounts[i] > 0) {
        seasonal[i] = seasonalSums[i] / seasonalCounts[i];
      }
    }
    
    // Calculate residual
    for (let i = 0; i < n; i++) {
      const seasonIndex = i % period;
      residual[i] = data[i] - (trend[i] || 0) - seasonal[seasonIndex];
    }
    
    return {
      trend,
      seasonal,
      residual,
      seasonalPattern: seasonal
    };
  }

  /**
   * Outlier detection using IQR method
   */
  detectOutliersIQR(data, multiplier = 1.5) {
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;
    
    const outliers = [];
    const normal = [];
    
    data.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outliers.push({ index, value, type: value < lowerBound ? 'low' : 'high' });
      } else {
        normal.push({ index, value });
      }
    });
    
    return {
      outliers,
      normal,
      bounds: { lower: lowerBound, upper: upperBound },
      statistics: { q1, q3, iqr }
    };
  }

  /**
   * Outlier detection using Modified Z-Score
   */
  detectOutliersModifiedZScore(data, threshold = 3.5) {
    const median = this.median(data);
    const mad = this.medianAbsoluteDeviation(data);
    
    const outliers = [];
    const normal = [];
    
    data.forEach((value, index) => {
      const modifiedZScore = 0.6745 * (value - median) / mad;
      
      if (Math.abs(modifiedZScore) > threshold) {
        outliers.push({ 
          index, 
          value, 
          modifiedZScore,
          type: modifiedZScore > 0 ? 'high' : 'low'
        });
      } else {
        normal.push({ index, value, modifiedZScore });
      }
    });
    
    return {
      outliers,
      normal,
      threshold,
      statistics: { median, mad }
    };
  }

  /**
   * Bootstrap confidence interval
   */
  bootstrapConfidenceInterval(data, statistic = this.mean, numSamples = 1000, alpha = 0.05) {
    const bootstrapStats = [];
    
    for (let i = 0; i < numSamples; i++) {
      const sample = this.bootstrapSample(data);
      bootstrapStats.push(statistic(sample));
    }
    
    bootstrapStats.sort((a, b) => a - b);
    
    const lowerIndex = Math.floor((alpha / 2) * numSamples);
    const upperIndex = Math.floor((1 - alpha / 2) * numSamples);
    
    return {
      lower: bootstrapStats[lowerIndex],
      upper: bootstrapStats[upperIndex],
      original: statistic(data),
      bootstrapStats
    };
  }

  /**
   * Generate bootstrap sample
   */
  bootstrapSample(data) {
    const n = data.length;
    const sample = [];
    
    for (let i = 0; i < n; i++) {
      const randomIndex = Math.floor(Math.random() * n);
      sample.push(data[randomIndex]);
    }
    
    return sample;
  }

  // Basic statistical functions
  
  mean(data) {
    return data.reduce((sum, value) => sum + value, 0) / data.length;
  }

  median(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    return n % 2 === 0 
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  }

  variance(data) {
    const mean = this.mean(data);
    return data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (data.length - 1);
  }

  standardDeviation(data) {
    return Math.sqrt(this.variance(data));
  }

  medianAbsoluteDeviation(data) {
    const median = this.median(data);
    const deviations = data.map(value => Math.abs(value - median));
    return this.median(deviations);
  }

  skewness(data) {
    const n = data.length;
    const mean = this.mean(data);
    const stdDev = this.standardDeviation(data);
    
    const sum = data.reduce((acc, value) => {
      return acc + Math.pow((value - mean) / stdDev, 3);
    }, 0);
    
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  kurtosis(data) {
    const n = data.length;
    const mean = this.mean(data);
    const stdDev = this.standardDeviation(data);
    
    const sum = data.reduce((acc, value) => {
      return acc + Math.pow((value - mean) / stdDev, 4);
    }, 0);
    
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - 
           (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  percentile(data, p) {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  confidenceInterval(mean, standardError, degreesOfFreedom, alpha = 0.05) {
    const tValue = this.tDistributionCriticalValue(degreesOfFreedom, alpha / 2);
    const margin = tValue * standardError;
    
    return {
      lower: mean - margin,
      upper: mean + margin,
      margin
    };
  }

  // Approximation functions for statistical distributions
  
  standardNormalCDF(x) {
    // Approximation of standard normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  erf(x) {
    // Approximation of error function
    const a = 0.3275911;
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    
    const t = 1 / (1 + a * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  tDistributionPValue(t, df) {
    // Simplified approximation for t-distribution p-value
    // For production use, consider using a proper statistical library
    if (df > 30) {
      return 2 * (1 - this.standardNormalCDF(Math.abs(t)));
    }
    
    // Very rough approximation for small df
    const normalApprox = 2 * (1 - this.standardNormalCDF(Math.abs(t)));
    const correction = 1 + (t * t) / (4 * df);
    return Math.min(1, normalApprox * correction);
  }

  tDistributionCriticalValue(df, alpha) {
    // Simplified approximation
    if (df > 30) {
      return this.CONFIDENCE_LEVELS[`${Math.round((1 - alpha) * 100)}%`] || 1.96;
    }
    
    // Rough approximation for small df
    const zValue = this.CONFIDENCE_LEVELS[`${Math.round((1 - alpha) * 100)}%`] || 1.96;
    return zValue * (1 + (zValue * zValue) / (4 * df));
  }

  ksDistributionPValue(dStatistic, n1, n2) {
    // Simplified approximation for KS test p-value
    const n = (n1 * n2) / (n1 + n2);
    const lambda = dStatistic * Math.sqrt(n);
    
    // Asymptotic approximation
    if (lambda > 1) {
      return 2 * Math.exp(-2 * lambda * lambda);
    }
    
    return 1 - 2 * lambda * lambda;
  }

  /**
   * Comprehensive statistical summary
   */
  describe(data) {
    if (data.length === 0) {
      throw new Error('Data array cannot be empty');
    }
    
    const sorted = [...data].sort((a, b) => a - b);
    
    return {
      count: data.length,
      mean: this.mean(data),
      median: this.median(data),
      mode: this.mode(data),
      min: Math.min(...data),
      max: Math.max(...data),
      range: Math.max(...data) - Math.min(...data),
      variance: this.variance(data),
      standardDeviation: this.standardDeviation(data),
      skewness: this.skewness(data),
      kurtosis: this.kurtosis(data),
      percentiles: {
        p25: this.percentile(data, 25),
        p50: this.percentile(data, 50),
        p75: this.percentile(data, 75),
        p90: this.percentile(data, 90),
        p95: this.percentile(data, 95),
        p99: this.percentile(data, 99)
      }
    };
  }

  mode(data) {
    const frequency = {};
    let maxFreq = 0;
    let modes = [];
    
    data.forEach(value => {
      frequency[value] = (frequency[value] || 0) + 1;
      if (frequency[value] > maxFreq) {
        maxFreq = frequency[value];
        modes = [value];
      } else if (frequency[value] === maxFreq && !modes.includes(value)) {
        modes.push(value);
      }
    });
    
    return modes.length === Object.keys(frequency).length ? null : modes;
  }
}

module.exports = StatisticalAnalysis;