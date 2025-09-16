/**
 * TypeSafetyReporter - Comprehensive reporting and analysis for TypeScript type safety
 * Provides detailed reporting, metrics, and analysis for type validation results
 */

import { TypeCheckResult } from './TypeChecker';
import { PropValidationResult } from './PropValidator';
import { GenericTestResult, GenericTestReport } from './GenericTypeTestRunner';
import { InterfaceValidationResult, InterfaceValidationReport } from './InterfaceValidator';

export interface TypeSafetyReport {
  summary: TypeSafetySummary;
  typeChecking: TypeCheckingReport;
  propValidation: PropValidationReport;
  genericTesting: GenericTestingReport;
  interfaceValidation: InterfaceValidationReport;
  recommendations: TypeSafetyRecommendation[];
  metrics: TypeSafetyMetrics;
  trends: TypeSafetyTrends;
}

export interface TypeSafetySummary {
  overallScore: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warningCount: number;
  errorCount: number;
  coverageScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface TypeCheckingReport {
  basicTypeChecks: number;
  advancedTypeChecks: number;
  unionTypeChecks: number;
  intersectionTypeChecks: number;
  conditionalTypeChecks: number;
  templateLiteralChecks: number;
  assignabilityChecks: number;
  successRate: number;
}

export interface PropValidationReport {
  componentCount: number;
  propCount: number;
  requiredPropsValidated: number;
  optionalPropsValidated: number;
  eventHandlerValidation: number;
  refValidation: number;
  childrenValidation: number;
  successRate: number;
}

export interface GenericTestingReport {
  constraintTests: number;
  instantiationTests: number;
  varianceTests: number;
  mappedTypeTests: number;
  conditionalGenericTests: number;
  higherOrderTests: number;
  complexityScore: number;
  successRate: number;
}

export interface TypeSafetyRecommendation {
  id: string;
  category: 'TYPE_SAFETY' | 'PERFORMANCE' | 'MAINTAINABILITY' | 'TESTING';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  impact: string;
  solution: string;
  codeExample?: string;
  relatedFiles?: string[];
}

export interface TypeSafetyMetrics {
  typeComplexity: number;
  genericUsage: number;
  interfaceComplexity: number;
  anyTypeUsage: number;
  unknownTypeUsage: number;
  assertionUsage: number;
  typeGuardUsage: number;
  strictModeCompliance: number;
}

export interface TypeSafetyTrends {
  historicalData: TypeSafetyDataPoint[];
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
  projectedScore: number;
  keyIndicators: TrendIndicator[];
}

export interface TypeSafetyDataPoint {
  timestamp: string;
  overallScore: number;
  errorCount: number;
  warningCount: number;
  testCount: number;
}

export interface TrendIndicator {
  metric: string;
  change: number;
  direction: 'UP' | 'DOWN' | 'STABLE';
  significance: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ReportConfig {
  includeDetails: boolean;
  includeRecommendations: boolean;
  includeTrends: boolean;
  includeCodeExamples: boolean;
  format: 'JSON' | 'HTML' | 'MARKDOWN' | 'PDF';
  outputPath?: string;
}

/**
 * Comprehensive type safety reporting and analysis utility
 */
export class TypeSafetyReporter {
  private historicalData: TypeSafetyDataPoint[] = [];
  private config: ReportConfig;

  constructor(config: Partial<ReportConfig> = {}) {
    this.config = {
      includeDetails: true,
      includeRecommendations: true,
      includeTrends: false,
      includeCodeExamples: true,
      format: 'JSON',
      ...config
    };
  }

  /**
   * Generates a comprehensive type safety report
   */
  generateReport(
    typeCheckResults: TypeCheckResult[],
    propValidationResults: PropValidationResult[],
    genericTestResults: GenericTestResult[],
    interfaceValidationResults: InterfaceValidationResult[]
  ): TypeSafetyReport {
    const summary = this.generateSummary(
      typeCheckResults,
      propValidationResults,
      genericTestResults,
      interfaceValidationResults
    );

    const typeCheckingReport = this.generateTypeCheckingReport(typeCheckResults);
    const propValidationReport = this.generatePropValidationReport(propValidationResults);
    const genericTestingReport = this.generateGenericTestingReport(genericTestResults);
    const interfaceValidationReport = this.generateInterfaceValidationReport(interfaceValidationResults);

    const recommendations = this.generateRecommendations(
      typeCheckResults,
      propValidationResults,
      genericTestResults,
      interfaceValidationResults
    );

    const metrics = this.calculateMetrics(
      typeCheckResults,
      propValidationResults,
      genericTestResults,
      interfaceValidationResults
    );

    const trends = this.config.includeTrends ? this.analyzeTrends() : this.getEmptyTrends();

    // Store current data point for trend analysis
    this.recordDataPoint(summary);

    return {
      summary,
      typeChecking: typeCheckingReport,
      propValidation: propValidationReport,
      genericTesting: genericTestingReport,
      interfaceValidation: interfaceValidationReport,
      recommendations,
      metrics,
      trends
    };
  }

  /**
   * Exports report in specified format
   */
  async exportReport(report: TypeSafetyReport): Promise<string> {
    switch (this.config.format) {
      case 'JSON':
        return this.exportAsJSON(report);
      case 'HTML':
        return this.exportAsHTML(report);
      case 'MARKDOWN':
        return this.exportAsMarkdown(report);
      case 'PDF':
        return this.exportAsPDF(report);
      default:
        throw new Error(`Unsupported format: ${this.config.format}`);
    }
  }

  /**
   * Generates executive summary
   */
  generateExecutiveSummary(report: TypeSafetyReport): string {
    const { summary, recommendations } = report;
    const criticalIssues = recommendations.filter(r => r.priority === 'CRITICAL').length;
    const highIssues = recommendations.filter(r => r.priority === 'HIGH').length;

    return `
# TypeScript Type Safety Executive Summary

## Overall Assessment
- **Type Safety Score**: ${summary.overallScore.toFixed(1)}/100
- **Risk Level**: ${summary.riskLevel}
- **Test Success Rate**: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%

## Key Findings
- Total Tests Executed: ${summary.totalTests}
- Passed: ${summary.passedTests} | Failed: ${summary.failedTests}
- Errors: ${summary.errorCount} | Warnings: ${summary.warningCount}

## Critical Actions Required
${criticalIssues > 0 ? `- ${criticalIssues} critical issues requiring immediate attention` : '- No critical issues identified'}
${highIssues > 0 ? `- ${highIssues} high-priority issues need addressing` : '- No high-priority issues'}

## Recommendations
${recommendations.slice(0, 3).map(r => `- ${r.title}: ${r.description}`).join('\n')}
`;
  }

  /**
   * Analyzes type safety patterns and anti-patterns
   */
  analyzePatterns(
    typeCheckResults: TypeCheckResult[],
    propValidationResults: PropValidationResult[]
  ): {
    goodPatterns: string[];
    antiPatterns: string[];
    suggestions: string[];
  } {
    const goodPatterns: string[] = [];
    const antiPatterns: string[] = [];
    const suggestions: string[] = [];

    // Analyze type check patterns
    const unionTypeUsage = typeCheckResults.filter(r =>
      r.typeInfo.typeName.includes('Union')
    ).length;

    const conditionalTypeUsage = typeCheckResults.filter(r =>
      r.typeInfo.typeName.includes('Conditional')
    ).length;

    if (unionTypeUsage > 0) {
      goodPatterns.push('Effective use of union types for flexible APIs');
    }

    if (conditionalTypeUsage > 0) {
      goodPatterns.push('Advanced conditional type usage for type-safe APIs');
    }

    // Analyze prop validation patterns
    const anyTypeUsage = propValidationResults.filter(r =>
      r.expectedType === 'any'
    ).length;

    if (anyTypeUsage > propValidationResults.length * 0.1) {
      antiPatterns.push('Excessive use of "any" type reduces type safety');
      suggestions.push('Replace "any" types with specific type definitions');
    }

    const missingRequiredProps = propValidationResults.filter(r =>
      r.required && !r.passed
    ).length;

    if (missingRequiredProps > 0) {
      antiPatterns.push('Missing required props in component interfaces');
      suggestions.push('Ensure all required props have proper type definitions');
    }

    return { goodPatterns, antiPatterns, suggestions };
  }

  /**
   * Calculates type complexity score
   */
  calculateTypeComplexity(typeCheckResults: TypeCheckResult[]): number {
    let complexityScore = 0;
    let totalTypes = typeCheckResults.length;

    for (const result of typeCheckResults) {
      const { typeInfo } = result;

      // Base complexity
      complexityScore += 1;

      // Generic types add complexity
      if (typeInfo.isGeneric) {
        complexityScore += 2;
      }

      // Multiple parameters increase complexity
      complexityScore += typeInfo.parameters.length * 0.5;

      // Constraints add complexity
      complexityScore += typeInfo.constraints.length * 0.3;

      // Complex type names indicate higher complexity
      if (typeInfo.typeName.includes('Conditional') ||
          typeInfo.typeName.includes('Mapped') ||
          typeInfo.typeName.includes('Intersection')) {
        complexityScore += 3;
      }
    }

    return totalTypes > 0 ? complexityScore / totalTypes : 0;
  }

  /**
   * Generates performance recommendations
   */
  generatePerformanceRecommendations(
    genericTestResults: GenericTestResult[]
  ): TypeSafetyRecommendation[] {
    const recommendations: TypeSafetyRecommendation[] = [];

    const slowTests = genericTestResults.filter(r => r.executionTime > 100);

    if (slowTests.length > 0) {
      recommendations.push({
        id: 'PERF_001',
        category: 'PERFORMANCE',
        priority: 'MEDIUM',
        title: 'Optimize Slow Type Tests',
        description: `${slowTests.length} type tests are taking longer than 100ms to execute`,
        impact: 'Slow compilation and development feedback',
        solution: 'Simplify complex generic constraints and reduce type computation depth',
        codeExample: `
// Avoid deeply nested conditional types
type Bad<T> = T extends A ? T extends B ? T extends C ? D : E : F : G;

// Prefer simpler type patterns
type Good<T> = T extends A ? SimpleType<T> : OtherType<T>;
`
      });
    }

    return recommendations;
  }

  // Private helper methods
  private generateSummary(
    typeCheckResults: TypeCheckResult[],
    propValidationResults: PropValidationResult[],
    genericTestResults: GenericTestResult[],
    interfaceValidationResults: InterfaceValidationResult[]
  ): TypeSafetySummary {
    const totalTests =
      typeCheckResults.length +
      propValidationResults.length +
      genericTestResults.length +
      interfaceValidationResults.length;

    const passedTests =
      typeCheckResults.filter(r => r.passed).length +
      propValidationResults.filter(r => r.passed).length +
      genericTestResults.filter(r => r.passed).length +
      interfaceValidationResults.filter(r => r.passed).length;

    const failedTests = totalTests - passedTests;

    const errorCount =
      typeCheckResults.reduce((sum, r) => sum + r.errors.length, 0) +
      propValidationResults.reduce((sum, r) => sum + r.errors.length, 0) +
      interfaceValidationResults.reduce((sum, r) => sum + r.errors.length, 0);

    const warningCount =
      typeCheckResults.reduce((sum, r) => sum + r.warnings.length, 0) +
      propValidationResults.reduce((sum, r) => sum + r.warnings.length, 0) +
      interfaceValidationResults.reduce((sum, r) => sum + r.warnings.length, 0);

    const overallScore = totalTests > 0 ? (passedTests / totalTests) * 100 : 100;
    const coverageScore = this.calculateCoverageScore(typeCheckResults, propValidationResults);
    const riskLevel = this.calculateRiskLevel(overallScore, errorCount, warningCount);

    return {
      overallScore,
      totalTests,
      passedTests,
      failedTests,
      warningCount,
      errorCount,
      coverageScore,
      riskLevel
    };
  }

  private generateTypeCheckingReport(typeCheckResults: TypeCheckResult[]): TypeCheckingReport {
    const basicTypeChecks = typeCheckResults.filter(r =>
      !r.typeInfo.isGeneric &&
      !r.typeInfo.typeName.includes('Union') &&
      !r.typeInfo.typeName.includes('Conditional')
    ).length;

    const unionTypeChecks = typeCheckResults.filter(r =>
      r.typeInfo.typeName.includes('Union')
    ).length;

    const conditionalTypeChecks = typeCheckResults.filter(r =>
      r.typeInfo.typeName.includes('Conditional')
    ).length;

    const passedChecks = typeCheckResults.filter(r => r.passed).length;
    const successRate = typeCheckResults.length > 0 ?
      (passedChecks / typeCheckResults.length) * 100 : 100;

    return {
      basicTypeChecks,
      advancedTypeChecks: typeCheckResults.filter(r => r.typeInfo.isGeneric).length,
      unionTypeChecks,
      intersectionTypeChecks: typeCheckResults.filter(r =>
        r.typeInfo.typeName.includes('Intersection')
      ).length,
      conditionalTypeChecks,
      templateLiteralChecks: typeCheckResults.filter(r =>
        r.typeInfo.typeName.includes('TemplateLiteral')
      ).length,
      assignabilityChecks: typeCheckResults.filter(r =>
        r.typeInfo.assignability.exactMatch !== undefined
      ).length,
      successRate
    };
  }

  private generatePropValidationReport(propValidationResults: PropValidationResult[]): PropValidationReport {
    const requiredProps = propValidationResults.filter(r => r.required);
    const optionalProps = propValidationResults.filter(r => !r.required);

    const passedValidations = propValidationResults.filter(r => r.passed).length;
    const successRate = propValidationResults.length > 0 ?
      (passedValidations / propValidationResults.length) * 100 : 100;

    // Estimate component count based on prop groupings
    const componentCount = new Set(
      propValidationResults.map(r => r.propName.split('.')[0])
    ).size;

    return {
      componentCount,
      propCount: propValidationResults.length,
      requiredPropsValidated: requiredProps.length,
      optionalPropsValidated: optionalProps.length,
      eventHandlerValidation: propValidationResults.filter(r =>
        r.propName.startsWith('on') || r.expectedType.includes('Function')
      ).length,
      refValidation: propValidationResults.filter(r =>
        r.propName === 'ref' || r.expectedType.includes('Ref')
      ).length,
      childrenValidation: propValidationResults.filter(r =>
        r.propName === 'children'
      ).length,
      successRate
    };
  }

  private generateGenericTestingReport(genericTestResults: GenericTestResult[]): GenericTestingReport {
    const passedTests = genericTestResults.filter(r => r.passed).length;
    const successRate = genericTestResults.length > 0 ?
      (passedTests / genericTestResults.length) * 100 : 100;

    const avgExecutionTime = genericTestResults.length > 0 ?
      genericTestResults.reduce((sum, r) => sum + r.executionTime, 0) / genericTestResults.length : 0;

    const complexityScore = avgExecutionTime > 50 ? 'HIGH' :
                           avgExecutionTime > 20 ? 'MEDIUM' : 'LOW';

    return {
      constraintTests: genericTestResults.filter(r =>
        r.testName.toLowerCase().includes('constraint')
      ).length,
      instantiationTests: genericTestResults.filter(r =>
        r.testName.toLowerCase().includes('instantiation')
      ).length,
      varianceTests: genericTestResults.filter(r =>
        r.testName.toLowerCase().includes('variance')
      ).length,
      mappedTypeTests: genericTestResults.filter(r =>
        r.testName.toLowerCase().includes('mapped')
      ).length,
      conditionalGenericTests: genericTestResults.filter(r =>
        r.testName.toLowerCase().includes('conditional')
      ).length,
      higherOrderTests: genericTestResults.filter(r =>
        r.testName.toLowerCase().includes('higher') ||
        r.testName.toLowerCase().includes('hoc')
      ).length,
      complexityScore: complexityScore === 'HIGH' ? 3 : complexityScore === 'MEDIUM' ? 2 : 1,
      successRate
    };
  }

  private generateInterfaceValidationReport(
    interfaceValidationResults: InterfaceValidationResult[]
  ): InterfaceValidationReport {
    const passedInterfaces = interfaceValidationResults.filter(r => r.passed).length;
    const failedInterfaces = interfaceValidationResults.length - passedInterfaces;

    const avgConformanceScore = interfaceValidationResults.length > 0 ?
      interfaceValidationResults.reduce((sum, r) => sum + r.conformanceScore, 0) / interfaceValidationResults.length : 100;

    const errorsByType: Record<string, number> = {};
    const warningsByType: Record<string, number> = {};

    for (const result of interfaceValidationResults) {
      for (const error of result.errors) {
        errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      }
      for (const warning of result.warnings) {
        warningsByType[warning.type] = (warningsByType[warning.type] || 0) + 1;
      }
    }

    return {
      totalInterfaces: interfaceValidationResults.length,
      passedInterfaces,
      failedInterfaces,
      averageConformanceScore: avgConformanceScore,
      errorsByType,
      warningsByType,
      detailedResults: interfaceValidationResults
    };
  }

  private generateRecommendations(
    typeCheckResults: TypeCheckResult[],
    propValidationResults: PropValidationResult[],
    genericTestResults: GenericTestResult[],
    interfaceValidationResults: InterfaceValidationResult[]
  ): TypeSafetyRecommendation[] {
    const recommendations: TypeSafetyRecommendation[] = [];

    // Analyze type check results
    const failedTypeChecks = typeCheckResults.filter(r => !r.passed);
    if (failedTypeChecks.length > 0) {
      recommendations.push({
        id: 'TYPE_001',
        category: 'TYPE_SAFETY',
        priority: 'HIGH',
        title: 'Fix Type Check Failures',
        description: `${failedTypeChecks.length} type checks are failing`,
        impact: 'Potential runtime errors and reduced type safety',
        solution: 'Review and fix type definitions to ensure proper type checking'
      });
    }

    // Analyze prop validation results
    const missingRequiredProps = propValidationResults.filter(r =>
      r.required && !r.passed
    );
    if (missingRequiredProps.length > 0) {
      recommendations.push({
        id: 'PROP_001',
        category: 'TYPE_SAFETY',
        priority: 'CRITICAL',
        title: 'Missing Required Props',
        description: `${missingRequiredProps.length} required props are missing or invalid`,
        impact: 'Component functionality may be broken',
        solution: 'Ensure all required props are provided with correct types'
      });
    }

    // Add performance recommendations
    recommendations.push(...this.generatePerformanceRecommendations(genericTestResults));

    return recommendations;
  }

  private calculateMetrics(
    typeCheckResults: TypeCheckResult[],
    propValidationResults: PropValidationResult[],
    genericTestResults: GenericTestResult[],
    interfaceValidationResults: InterfaceValidationResult[]
  ): TypeSafetyMetrics {
    const typeComplexity = this.calculateTypeComplexity(typeCheckResults);

    const genericUsage = typeCheckResults.filter(r => r.typeInfo.isGeneric).length;
    const interfaceComplexity = interfaceValidationResults.reduce((sum, r) =>
      sum + r.propertyResults.length + r.methodResults.length, 0
    );

    const anyTypeUsage = propValidationResults.filter(r =>
      r.expectedType === 'any'
    ).length;

    const unknownTypeUsage = propValidationResults.filter(r =>
      r.expectedType === 'unknown'
    ).length;

    return {
      typeComplexity,
      genericUsage,
      interfaceComplexity,
      anyTypeUsage,
      unknownTypeUsage,
      assertionUsage: 0, // Would need code analysis
      typeGuardUsage: 0, // Would need code analysis
      strictModeCompliance: 95 // Placeholder
    };
  }

  private calculateCoverageScore(
    typeCheckResults: TypeCheckResult[],
    propValidationResults: PropValidationResult[]
  ): number {
    // Simplified coverage calculation
    const totalChecks = typeCheckResults.length + propValidationResults.length;
    const passedChecks =
      typeCheckResults.filter(r => r.passed).length +
      propValidationResults.filter(r => r.passed).length;

    return totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;
  }

  private calculateRiskLevel(
    overallScore: number,
    errorCount: number,
    warningCount: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (overallScore < 60 || errorCount > 20) return 'CRITICAL';
    if (overallScore < 80 || errorCount > 10) return 'HIGH';
    if (overallScore < 90 || errorCount > 5 || warningCount > 20) return 'MEDIUM';
    return 'LOW';
  }

  private recordDataPoint(summary: TypeSafetySummary): void {
    this.historicalData.push({
      timestamp: new Date().toISOString(),
      overallScore: summary.overallScore,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      testCount: summary.totalTests
    });

    // Keep only last 100 data points
    if (this.historicalData.length > 100) {
      this.historicalData = this.historicalData.slice(-100);
    }
  }

  private analyzeTrends(): TypeSafetyTrends {
    if (this.historicalData.length < 2) {
      return this.getEmptyTrends();
    }

    const recent = this.historicalData.slice(-10);
    const older = this.historicalData.slice(-20, -10);

    const recentAvg = recent.reduce((sum, d) => sum + d.overallScore, 0) / recent.length;
    const olderAvg = older.length > 0 ?
      older.reduce((sum, d) => sum + d.overallScore, 0) / older.length : recentAvg;

    const trendDirection = recentAvg > olderAvg + 2 ? 'IMPROVING' :
                          recentAvg < olderAvg - 2 ? 'DECLINING' : 'STABLE';

    const projectedScore = recentAvg + (recentAvg - olderAvg);

    return {
      historicalData: [...this.historicalData],
      trendDirection,
      projectedScore: Math.max(0, Math.min(100, projectedScore)),
      keyIndicators: [] // Simplified
    };
  }

  private getEmptyTrends(): TypeSafetyTrends {
    return {
      historicalData: [],
      trendDirection: 'STABLE',
      projectedScore: 0,
      keyIndicators: []
    };
  }

  private exportAsJSON(report: TypeSafetyReport): string {
    return JSON.stringify(report, null, 2);
  }

  private exportAsHTML(report: TypeSafetyReport): string {
    // HTML export implementation
    return `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScript Type Safety Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .score { font-size: 2em; font-weight: bold; color: #333; }
    .risk-low { color: green; }
    .risk-medium { color: orange; }
    .risk-high { color: red; }
    .risk-critical { color: darkred; }
  </style>
</head>
<body>
  <h1>TypeScript Type Safety Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <div class="score">Overall Score: ${report.summary.overallScore.toFixed(1)}/100</div>
    <div class="risk-${report.summary.riskLevel.toLowerCase()}">Risk Level: ${report.summary.riskLevel}</div>
    <p>Total Tests: ${report.summary.totalTests} | Passed: ${report.summary.passedTests} | Failed: ${report.summary.failedTests}</p>
  </div>
  <!-- Additional HTML content would go here -->
</body>
</html>
`;
  }

  private exportAsMarkdown(report: TypeSafetyReport): string {
    return `
# TypeScript Type Safety Report

## Summary
- **Overall Score**: ${report.summary.overallScore.toFixed(1)}/100
- **Risk Level**: ${report.summary.riskLevel}
- **Total Tests**: ${report.summary.totalTests}
- **Passed**: ${report.summary.passedTests}
- **Failed**: ${report.summary.failedTests}
- **Errors**: ${report.summary.errorCount}
- **Warnings**: ${report.summary.warningCount}

## Type Checking Report
- Basic Type Checks: ${report.typeChecking.basicTypeChecks}
- Advanced Type Checks: ${report.typeChecking.advancedTypeChecks}
- Success Rate: ${report.typeChecking.successRate.toFixed(1)}%

## Recommendations
${report.recommendations.map(r => `
### ${r.title} (${r.priority})
${r.description}

**Impact**: ${r.impact}
**Solution**: ${r.solution}
${r.codeExample ? `\n\`\`\`typescript\n${r.codeExample}\n\`\`\`` : ''}
`).join('\n')}
`;
  }

  private exportAsPDF(report: TypeSafetyReport): string {
    // PDF export would require additional libraries
    // For now, return markdown content
    return this.exportAsMarkdown(report);
  }
}

export default TypeSafetyReporter;