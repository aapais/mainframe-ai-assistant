/**
 * MVP1 Requirement Validator
 * 
 * Validates that all MVP1 Knowledge Base Assistant requirements are satisfied
 * based on test results, implementation evidence, and success criteria.
 * 
 * MVP1 Requirements from project documentation:
 * - Knowledge Base CRUD operations
 * - Search functionality with <1s response time
 * - Basic UI with zero training requirement
 * - Data persistence with SQLite
 * - Error handling and recovery
 * - Offline capability
 * - Template-based solutions
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface MVP1Requirements {
  functional: FunctionalRequirement[];
  nonFunctional: NonFunctionalRequirement[];
  technical: TechnicalRequirement[];
  usability: UsabilityRequirement[];
}

export interface FunctionalRequirement {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  acceptance: AcceptanceCriteria[];
  testSuites: string[];
  evidence: string[];
}

export interface NonFunctionalRequirement {
  id: string;
  name: string;
  description: string;
  threshold: any;
  measurement: string;
  testSuites: string[];
  evidence: string[];
}

export interface TechnicalRequirement {
  id: string;
  name: string;
  description: string;
  implementation: string[];
  verification: string[];
  testSuites: string[];
}

export interface UsabilityRequirement {
  id: string;
  name: string;
  description: string;
  criteria: string[];
  testSuites: string[];
  evidence: string[];
}

export interface AcceptanceCriteria {
  description: string;
  satisfied: boolean;
  evidence: string[];
  testResults?: any[];
}

export interface ValidationResult {
  passed: boolean;
  completeness: number;
  satisfiedRequirements: string[];
  missingRequirements: string[];
  partialRequirements: string[];
  critical: {
    total: number;
    satisfied: number;
    missing: string[];
  };
  functional: RequirementValidation;
  nonFunctional: RequirementValidation;
  technical: RequirementValidation;
  usability: RequirementValidation;
  details: Record<string, RequirementDetails>;
  recommendations: string[];
}

export interface RequirementValidation {
  total: number;
  satisfied: number;
  partial: number;
  missing: number;
  percentage: number;
  details: RequirementDetails[];
}

export interface RequirementDetails {
  id: string;
  name: string;
  status: 'satisfied' | 'partial' | 'missing';
  evidence: string[];
  testResults: TestEvidence[];
  gaps: string[];
  recommendations: string[];
}

export interface TestEvidence {
  suite: string;
  tests: number;
  passed: number;
  failed: number;
  relevant: boolean;
  contribution: number; // 0-1 how much this test contributes to requirement
}

export class MVP1Validator {
  private requirements: MVP1Requirements;

  constructor() {
    this.requirements = this.defineMVP1Requirements();
  }

  async validateRequirements(testResults: any[]): Promise<ValidationResult> {
    console.log('🎯 Validating MVP1 requirements against test results...');

    const functional = await this.validateFunctionalRequirements(testResults);
    const nonFunctional = await this.validateNonFunctionalRequirements(testResults);
    const technical = await this.validateTechnicalRequirements(testResults);
    const usability = await this.validateUsabilityRequirements(testResults);

    const allRequirements = [
      ...this.requirements.functional,
      ...this.requirements.nonFunctional,
      ...this.requirements.technical,
      ...this.requirements.usability
    ];

    const allValidations = [
      ...functional.details,
      ...nonFunctional.details,
      ...technical.details,
      ...usability.details
    ];

    const satisfiedCount = allValidations.filter(v => v.status === 'satisfied').length;
    const partialCount = allValidations.filter(v => v.status === 'partial').length;
    const missingCount = allValidations.filter(v => v.status === 'missing').length;

    const satisfiedRequirements = allValidations
      .filter(v => v.status === 'satisfied')
      .map(v => v.id);
    
    const missingRequirements = allValidations
      .filter(v => v.status === 'missing')
      .map(v => v.id);
    
    const partialRequirements = allValidations
      .filter(v => v.status === 'partial')
      .map(v => v.id);

    const criticalRequirements = allRequirements.filter(r => r.priority === 'critical');
    const satisfiedCritical = criticalRequirements.filter(r => 
      satisfiedRequirements.includes(r.id)
    );

    const completeness = (satisfiedCount / allRequirements.length) * 100;
    const passed = missingCount === 0 && satisfiedCritical.length === criticalRequirements.length;

    const details: Record<string, RequirementDetails> = {};
    allValidations.forEach(validation => {
      details[validation.id] = validation;
    });

    const result: ValidationResult = {
      passed,
      completeness,
      satisfiedRequirements,
      missingRequirements,
      partialRequirements,
      critical: {
        total: criticalRequirements.length,
        satisfied: satisfiedCritical.length,
        missing: criticalRequirements
          .filter(r => !satisfiedRequirements.includes(r.id))
          .map(r => r.id)
      },
      functional,
      nonFunctional,
      technical,
      usability,
      details,
      recommendations: this.generateRecommendations(allValidations)
    };

    // Log validation results
    this.logValidationResults(result);

    return result;
  }

  private defineMVP1Requirements(): MVP1Requirements {
    return {
      functional: [
        {
          id: 'MVP1-F001',
          name: 'Knowledge Base Entry Management',
          description: 'Users can create, read, update, and delete knowledge base entries',
          priority: 'critical',
          acceptance: [
            {
              description: 'User can add new KB entry with title, problem, solution, category, and tags',
              satisfied: false,
              evidence: []
            },
            {
              description: 'User can view existing KB entries with all details',
              satisfied: false,
              evidence: []
            },
            {
              description: 'User can edit existing KB entries',
              satisfied: false,
              evidence: []
            },
            {
              description: 'User can delete KB entries with confirmation',
              satisfied: false,
              evidence: []
            }
          ],
          testSuites: ['components-unit', 'services-integration', 'flows-integration', 'user-workflows-e2e'],
          evidence: []
        },
        {
          id: 'MVP1-F002',
          name: 'Knowledge Base Search',
          description: 'Users can search KB entries using full-text search with intelligent matching',
          priority: 'critical',
          acceptance: [
            {
              description: 'Full-text search across title, problem, and solution fields',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Category-based filtering',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Tag-based search',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Search results ranked by relevance and usage',
              satisfied: false,
              evidence: []
            },
            {
              description: 'AI-powered semantic matching (optional, with fallback)',
              satisfied: false,
              evidence: []
            }
          ],
          testSuites: ['services-unit', 'database-integration', 'search-performance'],
          evidence: []
        },
        {
          id: 'MVP1-F003',
          name: 'Template-Based Solutions',
          description: 'System provides pre-built templates for common mainframe issues',
          priority: 'high',
          acceptance: [
            {
              description: 'At least 30 initial KB entries covering common mainframe issues',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Templates organized by category (JCL, VSAM, DB2, Batch, Functional)',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Templates include step-by-step solutions',
              satisfied: false,
              evidence: []
            }
          ],
          testSuites: ['database-integration', 'components-integration'],
          evidence: []
        },
        {
          id: 'MVP1-F004',
          name: 'Usage Tracking and Metrics',
          description: 'System tracks usage and effectiveness of KB entries',
          priority: 'medium',
          acceptance: [
            {
              description: 'Track usage count per entry',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Record success/failure feedback',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Calculate success rate per entry',
              satisfied: false,
              evidence: []
            },
            {
              description: 'Display basic metrics dashboard',
              satisfied: false,
              evidence: []
            }
          ],
          testSuites: ['services-integration', 'database-integration'],
          evidence: []
        }
      ],

      nonFunctional: [
        {
          id: 'MVP1-NF001',
          name: 'Search Performance',
          description: 'Search operations must complete within acceptable time limits',
          threshold: { maxAvgResponseTime: 1000, maxP95ResponseTime: 2000 },
          measurement: 'Response time in milliseconds',
          testSuites: ['search-performance', 'load-testing'],
          evidence: []
        },
        {
          id: 'MVP1-NF002',
          name: 'Application Startup Time',
          description: 'Application must start quickly for good user experience',
          threshold: { maxStartupTime: 5000 },
          measurement: 'Time from launch to usable state in milliseconds',
          testSuites: ['performance', 'e2e'],
          evidence: []
        },
        {
          id: 'MVP1-NF003',
          name: 'Memory Usage',
          description: 'Application must have reasonable memory footprint',
          threshold: { maxMemoryUsage: 512, maxMemoryGrowth: 100 },
          measurement: 'Memory usage in MB',
          testSuites: ['memory-performance', 'load-testing'],
          evidence: []
        },
        {
          id: 'MVP1-NF004',
          name: 'Data Persistence Reliability',
          description: 'Data must be reliably stored and retrieved without corruption',
          threshold: { maxDataLoss: 0, minReliability: 99.9 },
          measurement: 'Percentage of successful data operations',
          testSuites: ['database-integration', 'reliability-stress', 'error-handling'],
          evidence: []
        }
      ],

      technical: [
        {
          id: 'MVP1-T001',
          name: 'Electron Desktop Application',
          description: 'Application must be packaged as cross-platform desktop app',
          implementation: ['Electron framework', 'React UI', 'Node.js backend'],
          verification: ['Packaged executable', 'Cross-platform compatibility'],
          testSuites: ['e2e', 'components-integration']
        },
        {
          id: 'MVP1-T002',
          name: 'SQLite Local Database',
          description: 'Use SQLite for local data storage with full-text search',
          implementation: ['SQLite database', 'FTS5 extension', 'better-sqlite3 driver'],
          verification: ['Database schema', 'FTS index', 'CRUD operations'],
          testSuites: ['database-unit', 'database-integration']
        },
        {
          id: 'MVP1-T003',
          name: 'Offline Capability',
          description: 'Core functionality must work without internet connection',
          implementation: ['Local database', 'Local search', 'Offline-first design'],
          verification: ['Offline test scenarios', 'Network disconnection handling'],
          testSuites: ['offline-testing', 'error-handling']
        },
        {
          id: 'MVP1-T004',
          name: 'AI Integration (Optional)',
          description: 'Optional AI integration with graceful fallback',
          implementation: ['Gemini API integration', 'Fallback mechanisms', 'Error handling'],
          verification: ['API integration tests', 'Fallback scenarios'],
          testSuites: ['services-integration', 'error-handling']
        }
      ],

      usability: [
        {
          id: 'MVP1-U001',
          name: 'Zero Training Interface',
          description: 'Interface must be intuitive requiring no training',
          criteria: [
            'Clear navigation and labeling',
            'Consistent UI patterns',
            'Helpful tooltips and hints',
            'Obvious primary actions'
          ],
          testSuites: ['accessibility', 'components-integration', 'user-workflows-e2e'],
          evidence: []
        },
        {
          id: 'MVP1-U002',
          name: 'Accessibility Compliance',
          description: 'Application must be accessible to users with disabilities',
          criteria: [
            'Keyboard navigation support',
            'Screen reader compatibility',
            'Sufficient color contrast',
            'Focus indicators'
          ],
          testSuites: ['accessibility'],
          evidence: []
        },
        {
          id: 'MVP1-U003',
          name: 'Responsive Design',
          description: 'UI must adapt to different screen sizes and resolutions',
          criteria: [
            'Responsive layouts',
            'Readable at different zoom levels',
            'Proper scaling on high-DPI displays'
          ],
          testSuites: ['responsive', 'components-integration'],
          evidence: []
        }
      ]
    };
  }

  private async validateFunctionalRequirements(testResults: any[]): Promise<RequirementValidation> {
    const details: RequirementDetails[] = [];

    for (const requirement of this.requirements.functional) {
      const relevantResults = testResults.filter(result => 
        requirement.testSuites.some(suite => result.suite.includes(suite))
      );

      const testEvidence = relevantResults.map(result => ({
        suite: result.suite,
        tests: result.passed + result.failed + result.skipped,
        passed: result.passed,
        failed: result.failed,
        relevant: true,
        contribution: this.calculateContribution(requirement, result)
      }));

      const status = this.determineRequirementStatus(requirement, testEvidence);
      const evidence = this.extractEvidence(requirement, testEvidence);
      const gaps = this.identifyGaps(requirement, testEvidence);

      details.push({
        id: requirement.id,
        name: requirement.name,
        status,
        evidence,
        testResults: testEvidence,
        gaps,
        recommendations: this.generateRequirementRecommendations(requirement, status, gaps)
      });
    }

    return this.summarizeValidation(details);
  }

  private async validateNonFunctionalRequirements(testResults: any[]): Promise<RequirementValidation> {
    const details: RequirementDetails[] = [];

    for (const requirement of this.requirements.nonFunctional) {
      const relevantResults = testResults.filter(result => 
        requirement.testSuites.some(suite => result.suite.includes(suite))
      );

      const testEvidence = relevantResults.map(result => ({
        suite: result.suite,
        tests: result.passed + result.failed + result.skipped,
        passed: result.passed,
        failed: result.failed,
        relevant: true,
        contribution: this.calculateContribution(requirement, result)
      }));

      const status = this.determineNonFunctionalStatus(requirement, testEvidence);
      const evidence = this.extractNonFunctionalEvidence(requirement, testEvidence);
      const gaps = this.identifyNonFunctionalGaps(requirement, testEvidence);

      details.push({
        id: requirement.id,
        name: requirement.name,
        status,
        evidence,
        testResults: testEvidence,
        gaps,
        recommendations: this.generateRequirementRecommendations(requirement, status, gaps)
      });
    }

    return this.summarizeValidation(details);
  }

  private async validateTechnicalRequirements(testResults: any[]): Promise<RequirementValidation> {
    const details: RequirementDetails[] = [];

    for (const requirement of this.requirements.technical) {
      const relevantResults = testResults.filter(result => 
        requirement.testSuites.some(suite => result.suite.includes(suite))
      );

      const testEvidence = relevantResults.map(result => ({
        suite: result.suite,
        tests: result.passed + result.failed + result.skipped,
        passed: result.passed,
        failed: result.failed,
        relevant: true,
        contribution: this.calculateContribution(requirement, result)
      }));

      const status = this.determineTechnicalStatus(requirement, testEvidence);
      const evidence = this.extractTechnicalEvidence(requirement, testEvidence);
      const gaps = this.identifyTechnicalGaps(requirement, testEvidence);

      details.push({
        id: requirement.id,
        name: requirement.name,
        status,
        evidence,
        testResults: testEvidence,
        gaps,
        recommendations: this.generateRequirementRecommendations(requirement, status, gaps)
      });
    }

    return this.summarizeValidation(details);
  }

  private async validateUsabilityRequirements(testResults: any[]): Promise<RequirementValidation> {
    const details: RequirementDetails[] = [];

    for (const requirement of this.requirements.usability) {
      const relevantResults = testResults.filter(result => 
        requirement.testSuites.some(suite => result.suite.includes(suite))
      );

      const testEvidence = relevantResults.map(result => ({
        suite: result.suite,
        tests: result.passed + result.failed + result.skipped,
        passed: result.passed,
        failed: result.failed,
        relevant: true,
        contribution: this.calculateContribution(requirement, result)
      }));

      const status = this.determineUsabilityStatus(requirement, testEvidence);
      const evidence = this.extractUsabilityEvidence(requirement, testEvidence);
      const gaps = this.identifyUsabilityGaps(requirement, testEvidence);

      details.push({
        id: requirement.id,
        name: requirement.name,
        status,
        evidence,
        testResults: testEvidence,
        gaps,
        recommendations: this.generateRequirementRecommendations(requirement, status, gaps)
      });
    }

    return this.summarizeValidation(details);
  }

  private calculateContribution(requirement: any, testResult: any): number {
    // Calculate how much a test result contributes to satisfying a requirement
    // This is simplified - in practice would be more sophisticated
    const successRate = testResult.passed / (testResult.passed + testResult.failed + testResult.skipped);
    
    // Higher contribution for critical requirements
    const priorityMultiplier = requirement.priority === 'critical' ? 1.0 : 
                              requirement.priority === 'high' ? 0.8 : 
                              requirement.priority === 'medium' ? 0.6 : 0.4;

    return successRate * priorityMultiplier;
  }

  private determineRequirementStatus(requirement: FunctionalRequirement, testEvidence: TestEvidence[]): 'satisfied' | 'partial' | 'missing' {
    if (testEvidence.length === 0) return 'missing';

    const avgContribution = testEvidence.reduce((sum, evidence) => sum + evidence.contribution, 0) / testEvidence.length;
    const hasFailedTests = testEvidence.some(evidence => evidence.failed > 0);

    if (avgContribution >= 0.8 && !hasFailedTests) return 'satisfied';
    if (avgContribution >= 0.5) return 'partial';
    return 'missing';
  }

  private determineNonFunctionalStatus(requirement: NonFunctionalRequirement, testEvidence: TestEvidence[]): 'satisfied' | 'partial' | 'missing' {
    if (testEvidence.length === 0) return 'missing';

    // Non-functional requirements are more binary - either they meet thresholds or they don't
    const hasFailedTests = testEvidence.some(evidence => evidence.failed > 0);
    const avgContribution = testEvidence.reduce((sum, evidence) => sum + evidence.contribution, 0) / testEvidence.length;

    if (!hasFailedTests && avgContribution >= 0.9) return 'satisfied';
    if (avgContribution >= 0.6) return 'partial';
    return 'missing';
  }

  private determineTechnicalStatus(requirement: TechnicalRequirement, testEvidence: TestEvidence[]): 'satisfied' | 'partial' | 'missing' {
    if (testEvidence.length === 0) return 'missing';

    const hasFailedTests = testEvidence.some(evidence => evidence.failed > 0);
    const avgContribution = testEvidence.reduce((sum, evidence) => sum + evidence.contribution, 0) / testEvidence.length;

    if (!hasFailedTests && avgContribution >= 0.8) return 'satisfied';
    if (avgContribution >= 0.5) return 'partial';
    return 'missing';
  }

  private determineUsabilityStatus(requirement: UsabilityRequirement, testEvidence: TestEvidence[]): 'satisfied' | 'partial' | 'missing' {
    if (testEvidence.length === 0) return 'missing';

    const hasFailedTests = testEvidence.some(evidence => evidence.failed > 0);
    const avgContribution = testEvidence.reduce((sum, evidence) => sum + evidence.contribution, 0) / testEvidence.length;

    if (!hasFailedTests && avgContribution >= 0.8) return 'satisfied';
    if (avgContribution >= 0.6) return 'partial';
    return 'missing';
  }

  private extractEvidence(requirement: FunctionalRequirement, testEvidence: TestEvidence[]): string[] {
    const evidence: string[] = [];
    
    testEvidence.forEach(test => {
      if (test.passed > 0) {
        evidence.push(`${test.suite}: ${test.passed}/${test.tests} tests passed`);
      }
      if (test.failed > 0) {
        evidence.push(`${test.suite}: ${test.failed} tests failed`);
      }
    });

    return evidence;
  }

  private extractNonFunctionalEvidence(requirement: NonFunctionalRequirement, testEvidence: TestEvidence[]): string[] {
    const evidence: string[] = [];
    
    testEvidence.forEach(test => {
      evidence.push(`${test.suite}: Performance/reliability validation`);
      if (test.failed > 0) {
        evidence.push(`${test.suite}: ${test.failed} performance threshold violations`);
      }
    });

    return evidence;
  }

  private extractTechnicalEvidence(requirement: TechnicalRequirement, testEvidence: TestEvidence[]): string[] {
    const evidence: string[] = [];
    
    testEvidence.forEach(test => {
      evidence.push(`${test.suite}: Technical implementation verified`);
    });

    return evidence;
  }

  private extractUsabilityEvidence(requirement: UsabilityRequirement, testEvidence: TestEvidence[]): string[] {
    const evidence: string[] = [];
    
    testEvidence.forEach(test => {
      evidence.push(`${test.suite}: Usability criteria validated`);
    });

    return evidence;
  }

  private identifyGaps(requirement: FunctionalRequirement, testEvidence: TestEvidence[]): string[] {
    const gaps: string[] = [];
    
    // Check if all required test suites are present
    for (const requiredSuite of requirement.testSuites) {
      const hasEvidence = testEvidence.some(evidence => evidence.suite.includes(requiredSuite));
      if (!hasEvidence) {
        gaps.push(`Missing test coverage for ${requiredSuite}`);
      }
    }

    // Check acceptance criteria
    requirement.acceptance.forEach(criteria => {
      if (!criteria.satisfied) {
        gaps.push(`Acceptance criteria not met: ${criteria.description}`);
      }
    });

    return gaps;
  }

  private identifyNonFunctionalGaps(requirement: NonFunctionalRequirement, testEvidence: TestEvidence[]): string[] {
    const gaps: string[] = [];
    
    // Check for failed performance tests
    testEvidence.forEach(test => {
      if (test.failed > 0) {
        gaps.push(`Performance thresholds not met in ${test.suite}`);
      }
    });

    return gaps;
  }

  private identifyTechnicalGaps(requirement: TechnicalRequirement, testEvidence: TestEvidence[]): string[] {
    const gaps: string[] = [];
    
    // Check implementation verification
    requirement.verification.forEach(verification => {
      gaps.push(`Verify: ${verification}`);
    });

    return gaps;
  }

  private identifyUsabilityGaps(requirement: UsabilityRequirement, testEvidence: TestEvidence[]): string[] {
    const gaps: string[] = [];
    
    // Check criteria satisfaction
    requirement.criteria.forEach(criteria => {
      const hasEvidence = testEvidence.some(test => test.passed > 0);
      if (!hasEvidence) {
        gaps.push(`Usability criteria not verified: ${criteria}`);
      }
    });

    return gaps;
  }

  private generateRequirementRecommendations(requirement: any, status: string, gaps: string[]): string[] {
    const recommendations: string[] = [];

    if (status === 'missing') {
      recommendations.push(`Implement ${requirement.name} functionality`);
      recommendations.push('Add comprehensive test coverage');
    } else if (status === 'partial') {
      recommendations.push(`Complete ${requirement.name} implementation`);
      recommendations.push('Address failing tests and gaps');
    }

    // Add specific recommendations based on gaps
    if (gaps.length > 0) {
      recommendations.push(`Address identified gaps: ${gaps.slice(0, 2).join(', ')}${gaps.length > 2 ? ' and others' : ''}`);
    }

    return recommendations;
  }

  private summarizeValidation(details: RequirementDetails[]): RequirementValidation {
    const satisfied = details.filter(d => d.status === 'satisfied').length;
    const partial = details.filter(d => d.status === 'partial').length;
    const missing = details.filter(d => d.status === 'missing').length;
    const total = details.length;

    return {
      total,
      satisfied,
      partial,
      missing,
      percentage: total > 0 ? (satisfied / total) * 100 : 0,
      details
    };
  }

  private generateRecommendations(allValidations: RequirementDetails[]): string[] {
    const recommendations: string[] = [];

    const missingCritical = allValidations.filter(v => 
      v.status === 'missing' && 
      this.isCriticalRequirement(v.id)
    );

    if (missingCritical.length > 0) {
      recommendations.push('🔴 Critical: Implement missing critical requirements immediately');
      recommendations.push(`Focus on: ${missingCritical.map(r => r.name).join(', ')}`);
    }

    const partialRequirements = allValidations.filter(v => v.status === 'partial');
    if (partialRequirements.length > 0) {
      recommendations.push('🟡 Complete partially implemented requirements');
    }

    const missingTests = allValidations.filter(v => 
      v.testResults.length === 0 || 
      v.testResults.every(t => t.passed === 0)
    );

    if (missingTests.length > 0) {
      recommendations.push('📝 Add comprehensive test coverage for validation');
    }

    return recommendations;
  }

  private isCriticalRequirement(id: string): boolean {
    const allRequirements = [
      ...this.requirements.functional,
      ...this.requirements.nonFunctional,
      ...this.requirements.technical,
      ...this.requirements.usability
    ];

    const requirement = allRequirements.find(r => r.id === id);
    return requirement?.priority === 'critical';
  }

  private logValidationResults(result: ValidationResult): void {
    console.log(`\n🎯 MVP1 VALIDATION RESULTS:`);
    console.log(`   Overall: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Completeness: ${result.completeness.toFixed(1)}%`);
    console.log(`   Requirements: ${result.satisfiedRequirements.length}/${result.satisfiedRequirements.length + result.missingRequirements.length + result.partialRequirements.length}`);

    if (result.critical.missing.length > 0) {
      console.log(`   🔴 Missing Critical: ${result.critical.missing.join(', ')}`);
    }

    console.log(`\n📋 BREAKDOWN:`);
    console.log(`   Functional: ${result.functional.satisfied}/${result.functional.total} (${result.functional.percentage.toFixed(1)}%)`);
    console.log(`   Non-Functional: ${result.nonFunctional.satisfied}/${result.nonFunctional.total} (${result.nonFunctional.percentage.toFixed(1)}%)`);
    console.log(`   Technical: ${result.technical.satisfied}/${result.technical.total} (${result.technical.percentage.toFixed(1)}%)`);
    console.log(`   Usability: ${result.usability.satisfied}/${result.usability.total} (${result.usability.percentage.toFixed(1)}%)`);

    if (result.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      result.recommendations.forEach(rec => console.log(`   ${rec}`));
    }
  }

  async generateDetailedReport(result: ValidationResult, outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = outputPath || path.join(process.cwd(), 'reports', `mvp1-validation-${timestamp}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      validation: result,
      requirements: this.requirements,
      metadata: {
        generator: 'MVP1Validator',
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 MVP1 validation report saved: ${reportPath}`);

    return reportPath;
  }

  getMVP1Requirements(): MVP1Requirements {
    return JSON.parse(JSON.stringify(this.requirements)); // Deep copy
  }

  static createValidationTemplate(): ValidationResult {
    return {
      passed: false,
      completeness: 0,
      satisfiedRequirements: [],
      missingRequirements: [],
      partialRequirements: [],
      critical: {
        total: 0,
        satisfied: 0,
        missing: []
      },
      functional: {
        total: 0,
        satisfied: 0,
        partial: 0,
        missing: 0,
        percentage: 0,
        details: []
      },
      nonFunctional: {
        total: 0,
        satisfied: 0,
        partial: 0,
        missing: 0,
        percentage: 0,
        details: []
      },
      technical: {
        total: 0,
        satisfied: 0,
        partial: 0,
        missing: 0,
        percentage: 0,
        details: []
      },
      usability: {
        total: 0,
        satisfied: 0,
        partial: 0,
        missing: 0,
        percentage: 0,
        details: []
      },
      details: {},
      recommendations: []
    };
  }
}

export default MVP1Validator;