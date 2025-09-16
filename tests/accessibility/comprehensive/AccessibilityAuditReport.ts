/**
 * Accessibility Audit Report Generator
 * Comprehensive WCAG 2.1 AA Compliance Reporting
 *
 * This module generates detailed accessibility audit reports with:
 * - WCAG 2.1 AA compliance status
 * - Detailed violation descriptions
 * - Remediation suggestions
 * - Progress tracking
 * - Executive summary
 */

import type {
  AccessibilityTestResults,
  KeyboardTestResult,
  ScreenReaderTestResult,
  ColorContrastTestResult
} from './AccessibilityTestSuite';

export interface AccessibilityAuditReport {
  metadata: AuditMetadata;
  executiveSummary: ExecutiveSummary;
  componentResults: ComponentAuditResult[];
  wcagCompliance: WCAGComplianceReport;
  detailedFindings: DetailedFindings;
  remediationPlan: RemediationPlan;
  recommendations: Recommendation[];
  appendices: Appendices;
}

export interface AuditMetadata {
  reportDate: string;
  auditVersion: string;
  applicationName: string;
  applicationVersion: string;
  wcagVersion: string;
  wcagLevel: string;
  auditor: string;
  scope: string;
  testingMethodology: string[];
  totalComponentsTested: number;
  totalTestsRun: number;
}

export interface ExecutiveSummary {
  overallComplianceScore: number;
  complianceLevel: 'Full' | 'Substantial' | 'Partial' | 'Non-Compliant';
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  keyFindings: string[];
  businessImpact: string;
  recommendedActions: string[];
}

export interface ComponentAuditResult {
  componentName: string;
  complianceScore: number;
  status: 'Pass' | 'Conditional Pass' | 'Fail';
  testResults: {
    keyboard: boolean;
    screenReader: boolean;
    colorContrast: boolean;
    focusManagement: boolean;
    errorHandling: boolean;
  };
  violations: ViolationSummary[];
  timeToFix: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface ViolationSummary {
  wcagCriterion: string;
  level: 'A' | 'AA' | 'AAA';
  severity: 'Critical' | 'Major' | 'Minor';
  count: number;
  description: string;
  impact: string;
  effort: 'High' | 'Medium' | 'Low';
}

export interface WCAGComplianceReport {
  level: string;
  totalCriteria: number;
  passingCriteria: number;
  failingCriteria: number;
  notApplicableCriteria: number;
  compliancePercentage: number;
  criteriaDetails: WCAGCriteriaDetail[];
}

export interface WCAGCriteriaDetail {
  criterion: string;
  title: string;
  level: 'A' | 'AA' | 'AAA';
  status: 'Pass' | 'Fail' | 'Not Applicable';
  components: string[];
  description: string;
  failureReasons?: string[];
  remediationSteps?: string[];
}

export interface DetailedFindings {
  keyboardAccessibility: KeyboardAccessibilityFindings;
  screenReaderSupport: ScreenReaderFindings;
  visualDesign: VisualDesignFindings;
  contentStructure: ContentStructureFindings;
  interactionDesign: InteractionDesignFindings;
}

export interface KeyboardAccessibilityFindings {
  summary: string;
  tabOrder: TabOrderFinding[];
  focusManagement: FocusManagementFinding[];
  keyboardShortcuts: KeyboardShortcutFinding[];
  focusIndicators: FocusIndicatorFinding[];
}

export interface TabOrderFinding {
  component: string;
  issue: string;
  expectedBehavior: string;
  actualBehavior: string;
  impact: string;
  solution: string;
}

export interface FocusManagementFinding {
  component: string;
  scenario: string;
  issue: string;
  wcagReference: string;
  solution: string;
}

export interface KeyboardShortcutFinding {
  component: string;
  shortcut: string;
  issue: string;
  conflict?: string;
  solution: string;
}

export interface FocusIndicatorFinding {
  component: string;
  element: string;
  issue: string;
  contrastRatio?: number;
  requiredRatio: number;
  solution: string;
}

export interface ScreenReaderFindings {
  summary: string;
  ariaImplementation: AriaImplementationFinding[];
  landmarkStructure: LandmarkStructureFinding[];
  headingStructure: HeadingStructureFinding[];
  formLabeling: FormLabelingFinding[];
  liveRegions: LiveRegionFinding[];
  tableStructure: TableStructureFinding[];
}

export interface AriaImplementationFinding {
  component: string;
  element: string;
  issue: string;
  ariaAttribute?: string;
  expectedValue?: string;
  actualValue?: string;
  solution: string;
}

export interface LandmarkStructureFinding {
  issue: string;
  affectedComponents: string[];
  missingLandmarks?: string[];
  duplicateLandmarks?: string[];
  solution: string;
}

export interface HeadingStructureFinding {
  component: string;
  issue: string;
  currentStructure: string;
  expectedStructure: string;
  solution: string;
}

export interface FormLabelingFinding {
  component: string;
  element: string;
  issue: string;
  labelingMethod: string;
  solution: string;
}

export interface LiveRegionFinding {
  component: string;
  element: string;
  issue: string;
  expectedBehavior: string;
  solution: string;
}

export interface TableStructureFinding {
  component: string;
  issue: string;
  missingElements: string[];
  solution: string;
}

export interface VisualDesignFindings {
  summary: string;
  colorContrast: ColorContrastFinding[];
  colorUsage: ColorUsageFinding[];
  typography: TypographyFinding[];
  spacing: SpacingFinding[];
}

export interface ColorContrastFinding {
  component: string;
  element: string;
  currentRatio: number;
  requiredRatio: number;
  textSize: string;
  backgroundColor: string;
  foregroundColor: string;
  solution: string;
}

export interface ColorUsageFinding {
  component: string;
  issue: string;
  description: string;
  solution: string;
}

export interface TypographyFinding {
  component: string;
  issue: string;
  description: string;
  solution: string;
}

export interface SpacingFinding {
  component: string;
  issue: string;
  description: string;
  solution: string;
}

export interface ContentStructureFindings {
  summary: string;
  semanticMarkup: SemanticMarkupFinding[];
  alternativeText: AlternativeTextFinding[];
  linkPurpose: LinkPurposeFinding[];
}

export interface SemanticMarkupFinding {
  component: string;
  element: string;
  issue: string;
  currentMarkup: string;
  recommendedMarkup: string;
  solution: string;
}

export interface AlternativeTextFinding {
  component: string;
  element: string;
  issue: string;
  currentAlt?: string;
  recommendedAlt: string;
  solution: string;
}

export interface LinkPurposeFinding {
  component: string;
  element: string;
  issue: string;
  currentText: string;
  recommendedText: string;
  solution: string;
}

export interface InteractionDesignFindings {
  summary: string;
  errorHandling: ErrorHandlingFinding[];
  userGuidance: UserGuidanceFinding[];
  timeouts: TimeoutFinding[];
}

export interface ErrorHandlingFinding {
  component: string;
  scenario: string;
  issue: string;
  currentBehavior: string;
  expectedBehavior: string;
  solution: string;
}

export interface UserGuidanceFinding {
  component: string;
  issue: string;
  description: string;
  solution: string;
}

export interface TimeoutFinding {
  component: string;
  issue: string;
  description: string;
  solution: string;
}

export interface RemediationPlan {
  phases: RemediationPhase[];
  timeline: string;
  resources: ResourceRequirement[];
  milestones: Milestone[];
}

export interface RemediationPhase {
  phase: number;
  name: string;
  duration: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  tasks: RemediationTask[];
  dependencies: string[];
  deliverables: string[];
}

export interface RemediationTask {
  taskId: string;
  description: string;
  component: string;
  wcagCriterion: string;
  effort: 'High' | 'Medium' | 'Low';
  skillsRequired: string[];
  estimatedHours: number;
  priority: number;
}

export interface ResourceRequirement {
  role: string;
  skillLevel: 'Junior' | 'Mid' | 'Senior';
  hoursRequired: number;
  responsibilities: string[];
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: string;
  deliverables: string[];
  successCriteria: string[];
}

export interface Recommendation {
  category: 'Process' | 'Tools' | 'Training' | 'Design' | 'Development';
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  benefits: string[];
  implementation: string[];
  resources: string[];
}

export interface Appendices {
  testingMethodology: string;
  wcagGuidelines: string;
  toolsUsed: string[];
  testEnvironments: TestEnvironment[];
  glossary: GlossaryEntry[];
}

export interface TestEnvironment {
  category: string;
  details: { [key: string]: string };
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

/**
 * Accessibility Audit Report Generator Class
 */
export class AccessibilityAuditReportGenerator {
  private results: AccessibilityTestResults[];
  private metadata: Partial<AuditMetadata>;

  constructor(results: AccessibilityTestResults[], metadata: Partial<AuditMetadata> = {}) {
    this.results = results;
    this.metadata = metadata;
  }

  /**
   * Generate comprehensive accessibility audit report
   */
  generateReport(): AccessibilityAuditReport {
    const metadata = this.generateMetadata();
    const executiveSummary = this.generateExecutiveSummary();
    const componentResults = this.generateComponentResults();
    const wcagCompliance = this.generateWCAGComplianceReport();
    const detailedFindings = this.generateDetailedFindings();
    const remediationPlan = this.generateRemediationPlan();
    const recommendations = this.generateRecommendations();
    const appendices = this.generateAppendices();

    return {
      metadata,
      executiveSummary,
      componentResults,
      wcagCompliance,
      detailedFindings,
      remediationPlan,
      recommendations,
      appendices
    };
  }

  /**
   * Generate report in different formats
   */
  generateMarkdownReport(): string {
    const report = this.generateReport();
    return this.formatAsMarkdown(report);
  }

  generateHTMLReport(): string {
    const report = this.generateReport();
    return this.formatAsHTML(report);
  }

  generateJSONReport(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Private methods for generating report sections
   */
  private generateMetadata(): AuditMetadata {
    return {
      reportDate: new Date().toISOString(),
      auditVersion: '1.0.0',
      applicationName: this.metadata.applicationName || 'Mainframe KB Assistant',
      applicationVersion: this.metadata.applicationVersion || '1.0.0-mvp1',
      wcagVersion: '2.1',
      wcagLevel: 'AA',
      auditor: this.metadata.auditor || 'Automated Accessibility Validator',
      scope: 'User Interface Components',
      testingMethodology: ['Automated Testing', 'axe-core', 'Manual Testing', 'Screen Reader Testing'],
      totalComponentsTested: this.results.length,
      totalTestsRun: this.results.reduce((sum, r) => sum + r.summary.totalChecks, 0)
    };
  }

  private generateExecutiveSummary(): ExecutiveSummary {
    const totalIssues = this.results.reduce((sum, r) => sum + r.issues.length, 0);
    const criticalIssues = this.results.reduce((sum, r) => sum + r.summary.criticalIssues, 0);
    const majorIssues = this.results.reduce((sum, r) => sum + r.summary.warningIssues, 0);
    const overallScore = this.results.reduce((sum, r) => sum + r.summary.overallScore, 0) / this.results.length;

    let complianceLevel: ExecutiveSummary['complianceLevel'];
    if (overallScore >= 95) complianceLevel = 'Full';
    else if (overallScore >= 80) complianceLevel = 'Substantial';
    else if (overallScore >= 60) complianceLevel = 'Partial';
    else complianceLevel = 'Non-Compliant';

    return {
      overallComplianceScore: Math.round(overallScore),
      complianceLevel,
      totalIssues,
      criticalIssues,
      majorIssues,
      minorIssues: totalIssues - criticalIssues - majorIssues,
      keyFindings: this.generateKeyFindings(),
      businessImpact: this.generateBusinessImpact(complianceLevel, criticalIssues),
      recommendedActions: this.generateRecommendedActions(criticalIssues, majorIssues)
    };
  }

  private generateComponentResults(): ComponentAuditResult[] {
    return this.results.map(result => {
      const violations = this.groupViolationsByWCAG(result.issues);

      return {
        componentName: result.component,
        complianceScore: result.summary.overallScore,
        status: result.summary.criticalIssues === 0 ?
                (result.summary.warningIssues === 0 ? 'Pass' : 'Conditional Pass') : 'Fail',
        testResults: {
          keyboard: result.keyboardNavigation.passed,
          screenReader: result.screenReader.passed,
          colorContrast: result.colorContrast.passed,
          focusManagement: result.focusManagement.passed,
          errorHandling: result.errorHandling.passed
        },
        violations,
        timeToFix: this.estimateTimeToFix(result.issues),
        priority: result.summary.criticalIssues > 0 ? 'High' :
                 result.summary.warningIssues > 0 ? 'Medium' : 'Low'
      };
    });
  }

  private generateWCAGComplianceReport(): WCAGComplianceReport {
    const wcagCriteria = this.getWCAGCriteria();
    const criteriaDetails = wcagCriteria.map(criterion =>
      this.assessWCAGCriterion(criterion)
    );

    const passingCriteria = criteriaDetails.filter(c => c.status === 'Pass').length;
    const failingCriteria = criteriaDetails.filter(c => c.status === 'Fail').length;
    const notApplicableCriteria = criteriaDetails.filter(c => c.status === 'Not Applicable').length;

    return {
      level: 'AA',
      totalCriteria: wcagCriteria.length,
      passingCriteria,
      failingCriteria,
      notApplicableCriteria,
      compliancePercentage: Math.round((passingCriteria / (passingCriteria + failingCriteria)) * 100),
      criteriaDetails
    };
  }

  private generateDetailedFindings(): DetailedFindings {
    return {
      keyboardAccessibility: this.generateKeyboardFindings(),
      screenReaderSupport: this.generateScreenReaderFindings(),
      visualDesign: this.generateVisualDesignFindings(),
      contentStructure: this.generateContentStructureFindings(),
      interactionDesign: this.generateInteractionDesignFindings()
    };
  }

  private generateRemediationPlan(): RemediationPlan {
    const tasks = this.generateRemediationTasks();
    const phases = this.groupTasksIntoPhases(tasks);

    return {
      phases,
      timeline: this.calculateTimeline(phases),
      resources: this.calculateResourceRequirements(tasks),
      milestones: this.generateMilestones(phases)
    };
  }

  private generateRecommendations(): Recommendation[] {
    return [
      {
        category: 'Process',
        priority: 'High',
        title: 'Implement Accessibility Testing in CI/CD Pipeline',
        description: 'Integrate automated accessibility testing into the continuous integration process',
        benefits: ['Early detection of accessibility issues', 'Reduced remediation costs', 'Consistent quality'],
        implementation: ['Add axe-core to test suite', 'Set up accessibility gates', 'Train development team'],
        resources: ['DevOps Engineer', 'Accessibility Testing Tools', 'Training Materials']
      },
      {
        category: 'Tools',
        priority: 'Medium',
        title: 'Adopt Accessibility Design System',
        description: 'Create or adopt an accessibility-first design system',
        benefits: ['Consistent accessible patterns', 'Reduced development time', 'Better user experience'],
        implementation: ['Audit existing components', 'Create accessible component library', 'Document usage patterns'],
        resources: ['UX Designer', 'Frontend Developer', 'Accessibility Expert']
      },
      {
        category: 'Training',
        priority: 'High',
        title: 'Accessibility Training Program',
        description: 'Comprehensive accessibility training for design and development teams',
        benefits: ['Improved awareness', 'Better implementation', 'Proactive accessibility'],
        implementation: ['Schedule training sessions', 'Create documentation', 'Establish best practices'],
        resources: ['Accessibility Trainer', 'Training Budget', 'Time allocation']
      }
    ];
  }

  private generateAppendices(): Appendices {
    return {
      testingMethodology: 'Comprehensive automated and manual testing using industry-standard tools and methodologies',
      wcagGuidelines: 'Web Content Accessibility Guidelines (WCAG) 2.1 Level AA',
      toolsUsed: ['axe-core', 'Jest', 'React Testing Library', 'Custom Validators'],
      testEnvironments: [
        {
          category: 'Browser',
          details: {
            'Primary': 'Chrome 120+',
            'Secondary': 'Firefox 118+, Safari 17+',
            'Screen Readers': 'NVDA, JAWS, VoiceOver'
          }
        },
        {
          category: 'Operating Systems',
          details: {
            'Windows': '10, 11',
            'macOS': '13+',
            'Mobile': 'iOS 16+, Android 12+'
          }
        }
      ],
      glossary: [
        {
          term: 'ARIA',
          definition: 'Accessible Rich Internet Applications - W3C specification for making web content more accessible'
        },
        {
          term: 'Focus Management',
          definition: 'The practice of controlling where keyboard focus moves as users navigate through an interface'
        },
        {
          term: 'Screen Reader',
          definition: 'Assistive technology that reads screen content aloud for users who are blind or have low vision'
        },
        {
          term: 'WCAG',
          definition: 'Web Content Accessibility Guidelines - International standard for web accessibility'
        }
      ]
    };
  }

  /**
   * Helper methods
   */
  private generateKeyFindings(): string[] {
    const findings: string[] = [];

    const totalCritical = this.results.reduce((sum, r) => sum + r.summary.criticalIssues, 0);
    if (totalCritical > 0) {
      findings.push(`${totalCritical} critical accessibility issues identified across components`);
    }

    const keyboardIssues = this.results.filter(r => !r.keyboardNavigation.passed).length;
    if (keyboardIssues > 0) {
      findings.push(`${keyboardIssues} components have keyboard accessibility issues`);
    }

    const screenReaderIssues = this.results.filter(r => !r.screenReader.passed).length;
    if (screenReaderIssues > 0) {
      findings.push(`${screenReaderIssues} components have screen reader compatibility issues`);
    }

    const contrastIssues = this.results.filter(r => !r.colorContrast.passed).length;
    if (contrastIssues > 0) {
      findings.push(`${contrastIssues} components have color contrast violations`);
    }

    if (findings.length === 0) {
      findings.push('All tested components meet WCAG 2.1 AA accessibility requirements');
    }

    return findings;
  }

  private generateBusinessImpact(complianceLevel: string, criticalIssues: number): string {
    if (complianceLevel === 'Full') {
      return 'The application demonstrates excellent accessibility compliance, reducing legal risk and ensuring inclusive user experience.';
    } else if (complianceLevel === 'Substantial') {
      return 'The application has good accessibility foundation with minor issues that should be addressed to ensure full compliance.';
    } else if (criticalIssues > 0) {
      return 'Critical accessibility barriers present significant usability challenges for users with disabilities and pose potential legal compliance risks.';
    } else {
      return 'Accessibility improvements needed to ensure full compliance and optimal user experience for all users.';
    }
  }

  private generateRecommendedActions(criticalIssues: number, majorIssues: number): string[] {
    const actions: string[] = [];

    if (criticalIssues > 0) {
      actions.push('Immediately address all critical accessibility violations');
      actions.push('Implement keyboard navigation fixes as highest priority');
    }

    if (majorIssues > 0) {
      actions.push('Plan remediation for major accessibility issues within next sprint');
      actions.push('Review and improve screen reader support');
    }

    actions.push('Integrate accessibility testing into development workflow');
    actions.push('Provide accessibility training to development team');
    actions.push('Establish accessibility review process for new features');

    return actions;
  }

  private groupViolationsByWCAG(issues: any[]): ViolationSummary[] {
    const grouped = issues.reduce((acc, issue) => {
      const key = issue.wcagCriterion;
      if (!acc[key]) {
        acc[key] = {
          wcagCriterion: key,
          level: this.getWCAGLevel(key),
          severity: issue.severity === 'critical' ? 'Critical' :
                   issue.severity === 'warning' ? 'Major' : 'Minor',
          count: 0,
          description: this.getWCAGDescription(key),
          impact: this.getImpactDescription(issue.severity),
          effort: this.getEffortEstimate(issue.type)
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    return Object.values(grouped);
  }

  private getWCAGLevel(criterion: string): 'A' | 'AA' | 'AAA' {
    const aaCriteria = [
      '1.4.3', '1.4.11', '2.1.1', '2.1.2', '2.4.3', '2.4.7',
      '3.3.1', '3.3.2', '4.1.2', '4.1.3'
    ];

    return aaCriteria.some(c => criterion.includes(c)) ? 'AA' : 'A';
  }

  private getWCAGDescription(criterion: string): string {
    const descriptions: { [key: string]: string } = {
      '1.4.3': 'Contrast (Minimum) - Text has sufficient color contrast',
      '1.4.11': 'Non-text Contrast - UI components have sufficient contrast',
      '2.1.1': 'Keyboard - All functionality is available via keyboard',
      '2.1.2': 'No Keyboard Trap - Keyboard focus is not trapped',
      '2.4.3': 'Focus Order - Focus order is logical and intuitive',
      '2.4.7': 'Focus Visible - Keyboard focus indicator is visible',
      '3.3.1': 'Error Identification - Errors are clearly identified',
      '3.3.2': 'Labels or Instructions - Form controls have labels',
      '4.1.2': 'Name, Role, Value - UI components have accessible names',
      '4.1.3': 'Status Messages - Status messages are programmatically determinable'
    };

    return descriptions[criterion] || 'Accessibility requirement not met';
  }

  private getImpactDescription(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'Completely blocks access for users with disabilities';
      case 'warning':
        return 'Creates significant barriers and poor user experience';
      default:
        return 'May cause minor inconvenience or confusion';
    }
  }

  private getEffortEstimate(type: string): 'High' | 'Medium' | 'Low' {
    const highEffort = ['aria', 'focusTrap', 'table'];
    const mediumEffort = ['keyboard', 'form', 'image'];

    if (highEffort.includes(type)) return 'High';
    if (mediumEffort.includes(type)) return 'Medium';
    return 'Low';
  }

  private estimateTimeToFix(issues: any[]): string {
    const totalHours = issues.reduce((sum, issue) => {
      const baseHours = issue.severity === 'critical' ? 4 :
                      issue.severity === 'warning' ? 2 : 1;
      const typeMultiplier = this.getEffortEstimate(issue.type) === 'High' ? 2 :
                            this.getEffortEstimate(issue.type) === 'Medium' ? 1.5 : 1;
      return sum + (baseHours * typeMultiplier);
    }, 0);

    if (totalHours <= 8) return '1 day';
    if (totalHours <= 24) return '3 days';
    if (totalHours <= 40) return '1 week';
    return '2+ weeks';
  }

  private getWCAGCriteria(): Array<{ criterion: string; title: string; level: 'A' | 'AA' | 'AAA' }> {
    return [
      { criterion: '1.1.1', title: 'Non-text Content', level: 'A' },
      { criterion: '1.3.1', title: 'Info and Relationships', level: 'A' },
      { criterion: '1.3.2', title: 'Meaningful Sequence', level: 'A' },
      { criterion: '1.4.1', title: 'Use of Color', level: 'A' },
      { criterion: '1.4.2', title: 'Audio Control', level: 'A' },
      { criterion: '1.4.3', title: 'Contrast (Minimum)', level: 'AA' },
      { criterion: '1.4.11', title: 'Non-text Contrast', level: 'AA' },
      { criterion: '2.1.1', title: 'Keyboard', level: 'A' },
      { criterion: '2.1.2', title: 'No Keyboard Trap', level: 'A' },
      { criterion: '2.4.1', title: 'Bypass Blocks', level: 'A' },
      { criterion: '2.4.2', title: 'Page Titled', level: 'A' },
      { criterion: '2.4.3', title: 'Focus Order', level: 'A' },
      { criterion: '2.4.4', title: 'Link Purpose (In Context)', level: 'A' },
      { criterion: '2.4.7', title: 'Focus Visible', level: 'AA' },
      { criterion: '3.1.1', title: 'Language of Page', level: 'A' },
      { criterion: '3.2.1', title: 'On Focus', level: 'A' },
      { criterion: '3.2.2', title: 'On Input', level: 'A' },
      { criterion: '3.3.1', title: 'Error Identification', level: 'A' },
      { criterion: '3.3.2', title: 'Labels or Instructions', level: 'A' },
      { criterion: '4.1.1', title: 'Parsing', level: 'A' },
      { criterion: '4.1.2', title: 'Name, Role, Value', level: 'A' },
      { criterion: '4.1.3', title: 'Status Messages', level: 'AA' }
    ];
  }

  private assessWCAGCriterion(criterion: { criterion: string; title: string; level: 'A' | 'AA' | 'AAA' }): WCAGCriteriaDetail {
    const relatedIssues = this.results.flatMap(r => r.issues)
      .filter(issue => issue.wcagCriterion.includes(criterion.criterion));

    const affectedComponents = [...new Set(relatedIssues.map(issue => issue.element))];

    return {
      criterion: criterion.criterion,
      title: criterion.title,
      level: criterion.level,
      status: relatedIssues.length === 0 ? 'Pass' : 'Fail',
      components: affectedComponents,
      description: this.getWCAGDescription(criterion.criterion),
      failureReasons: relatedIssues.length > 0 ? relatedIssues.map(issue => issue.description) : undefined,
      remediationSteps: relatedIssues.length > 0 ? relatedIssues.map(issue => issue.suggestion) : undefined
    };
  }

  private generateKeyboardFindings(): KeyboardAccessibilityFindings {
    const keyboardIssues = this.results.flatMap(r =>
      r.keyboardNavigation?.issues || []
    );

    return {
      summary: `${keyboardIssues.length} keyboard accessibility issues found across ${this.results.length} components`,
      tabOrder: keyboardIssues.filter(issue => issue.type === 'tabOrder').map(issue => ({
        component: issue.element,
        issue: issue.description,
        expectedBehavior: 'Tab order should follow logical reading order',
        actualBehavior: issue.description,
        impact: 'Users cannot navigate efficiently with keyboard',
        solution: issue.suggestion
      })),
      focusManagement: keyboardIssues.filter(issue => issue.type === 'focusTrap').map(issue => ({
        component: issue.element,
        scenario: 'Focus management in modal dialogs',
        issue: issue.description,
        wcagReference: issue.wcagCriterion,
        solution: issue.suggestion
      })),
      keyboardShortcuts: keyboardIssues.filter(issue => issue.type === 'shortcut').map(issue => ({
        component: issue.element,
        shortcut: 'Various shortcuts',
        issue: issue.description,
        solution: issue.suggestion
      })),
      focusIndicators: keyboardIssues.filter(issue => issue.type === 'focusIndicator').map(issue => ({
        component: issue.element,
        element: issue.element,
        issue: issue.description,
        requiredRatio: 3.0,
        solution: issue.suggestion
      }))
    };
  }

  private generateScreenReaderFindings(): ScreenReaderFindings {
    const screenReaderIssues = this.results.flatMap(r =>
      r.screenReader?.issues || []
    );

    return {
      summary: `${screenReaderIssues.length} screen reader support issues found`,
      ariaImplementation: screenReaderIssues.filter(issue => issue.type === 'aria').map(issue => ({
        component: issue.element,
        element: issue.element,
        issue: issue.description,
        solution: issue.suggestion
      })),
      landmarkStructure: this.generateLandmarkFindings(screenReaderIssues),
      headingStructure: screenReaderIssues.filter(issue => issue.type === 'heading').map(issue => ({
        component: issue.element,
        issue: issue.description,
        currentStructure: 'Invalid heading order',
        expectedStructure: 'Sequential heading levels (h1, h2, h3...)',
        solution: issue.suggestion
      })),
      formLabeling: screenReaderIssues.filter(issue => issue.type === 'form').map(issue => ({
        component: issue.element,
        element: issue.element,
        issue: issue.description,
        labelingMethod: 'Missing or inadequate labeling',
        solution: issue.suggestion
      })),
      liveRegions: screenReaderIssues.filter(issue => issue.type === 'liveRegion').map(issue => ({
        component: issue.element,
        element: issue.element,
        issue: issue.description,
        expectedBehavior: 'Dynamic content should be announced',
        solution: issue.suggestion
      })),
      tableStructure: screenReaderIssues.filter(issue => issue.type === 'table').map(issue => ({
        component: issue.element,
        issue: issue.description,
        missingElements: ['caption', 'headers', 'scope attributes'],
        solution: issue.suggestion
      }))
    };
  }

  private generateLandmarkFindings(issues: any[]): LandmarkStructureFinding[] {
    const landmarkIssues = issues.filter(issue => issue.type === 'landmark');

    if (landmarkIssues.length === 0) return [];

    return [{
      issue: 'Landmark structure issues detected',
      affectedComponents: [...new Set(landmarkIssues.map(issue => issue.element))],
      missingLandmarks: ['main', 'navigation'],
      duplicateLandmarks: ['banner'],
      solution: 'Implement proper landmark structure with unique labels'
    }];
  }

  private generateVisualDesignFindings(): VisualDesignFindings {
    const colorContrastIssues = this.results.flatMap(r =>
      r.colorContrast?.issues || []
    );

    return {
      summary: `${colorContrastIssues.length} visual design accessibility issues found`,
      colorContrast: colorContrastIssues.filter(issue => issue.type === 'text' || issue.type === 'interactive').map(issue => ({
        component: issue.element,
        element: issue.element,
        currentRatio: issue.currentRatio,
        requiredRatio: issue.requiredRatio,
        textSize: 'Standard',
        backgroundColor: 'Various',
        foregroundColor: 'Various',
        solution: issue.suggestion
      })),
      colorUsage: [],
      typography: [],
      spacing: []
    };
  }

  private generateContentStructureFindings(): ContentStructureFindings {
    const structureIssues = this.results.flatMap(r =>
      r.screenReader?.issues?.filter(issue => issue.type === 'image') || []
    );

    return {
      summary: `${structureIssues.length} content structure issues found`,
      semanticMarkup: [],
      alternativeText: structureIssues.map(issue => ({
        component: issue.element,
        element: issue.element,
        issue: issue.description,
        recommendedAlt: 'Descriptive alternative text',
        solution: issue.suggestion
      })),
      linkPurpose: []
    };
  }

  private generateInteractionDesignFindings(): InteractionDesignFindings {
    const interactionIssues = this.results.flatMap(r =>
      r.errorHandling?.issues || []
    );

    return {
      summary: `${interactionIssues.length} interaction design issues found`,
      errorHandling: interactionIssues.map(issue => ({
        component: issue.element,
        scenario: 'Form validation',
        issue: issue.description,
        currentBehavior: 'Error not properly announced',
        expectedBehavior: 'Error message should be announced to screen readers',
        solution: issue.suggestion
      })),
      userGuidance: [],
      timeouts: []
    };
  }

  private generateRemediationTasks(): RemediationTask[] {
    const tasks: RemediationTask[] = [];
    let taskId = 1;

    this.results.forEach(result => {
      result.issues.forEach(issue => {
        tasks.push({
          taskId: `TASK-${String(taskId).padStart(3, '0')}`,
          description: issue.description,
          component: result.component,
          wcagCriterion: issue.wcagCriterion,
          effort: this.getEffortEstimate(issue.type),
          skillsRequired: this.getRequiredSkills(issue.type),
          estimatedHours: this.getEstimatedHours(issue.severity, issue.type),
          priority: issue.severity === 'critical' ? 1 :
                   issue.severity === 'warning' ? 2 : 3
        });
        taskId++;
      });
    });

    return tasks.sort((a, b) => a.priority - b.priority);
  }

  private getRequiredSkills(issueType: string): string[] {
    const skillMap: { [key: string]: string[] } = {
      'aria': ['Frontend Development', 'ARIA Specification'],
      'keyboard': ['Frontend Development', 'UX Design'],
      'form': ['Frontend Development', 'Form Validation'],
      'image': ['Content Strategy', 'UX Writing'],
      'focusIndicator': ['CSS', 'Visual Design'],
      'table': ['HTML/CSS', 'Data Presentation']
    };

    return skillMap[issueType] || ['Frontend Development'];
  }

  private getEstimatedHours(severity: string, type: string): number {
    const baseHours = severity === 'critical' ? 4 : severity === 'warning' ? 2 : 1;
    const typeMultiplier = this.getEffortEstimate(type) === 'High' ? 2 :
                          this.getEffortEstimate(type) === 'Medium' ? 1.5 : 1;
    return Math.ceil(baseHours * typeMultiplier);
  }

  private groupTasksIntoPhases(tasks: RemediationTask[]): RemediationPhase[] {
    const criticalTasks = tasks.filter(t => t.priority === 1);
    const majorTasks = tasks.filter(t => t.priority === 2);
    const minorTasks = tasks.filter(t => t.priority === 3);

    const phases: RemediationPhase[] = [];

    if (criticalTasks.length > 0) {
      phases.push({
        phase: 1,
        name: 'Critical Issues Remediation',
        duration: '1-2 weeks',
        priority: 'Critical',
        tasks: criticalTasks,
        dependencies: [],
        deliverables: ['All critical accessibility violations resolved', 'Keyboard navigation fully functional']
      });
    }

    if (majorTasks.length > 0) {
      phases.push({
        phase: 2,
        name: 'Major Issues Resolution',
        duration: '2-3 weeks',
        priority: 'High',
        tasks: majorTasks,
        dependencies: phases.length > 0 ? ['Phase 1'] : [],
        deliverables: ['Screen reader compatibility improved', 'Enhanced user experience']
      });
    }

    if (minorTasks.length > 0) {
      phases.push({
        phase: 3,
        name: 'Minor Enhancements',
        duration: '1-2 weeks',
        priority: 'Medium',
        tasks: minorTasks,
        dependencies: phases.length > 0 ? [`Phase ${phases.length}`] : [],
        deliverables: ['Full WCAG 2.1 AA compliance', 'Optimized accessibility features']
      });
    }

    return phases;
  }

  private calculateTimeline(phases: RemediationPhase[]): string {
    const totalWeeks = phases.reduce((sum, phase) => {
      const weeks = parseInt(phase.duration.split('-')[1] || phase.duration.split(' ')[0]);
      return sum + weeks;
    }, 0);

    return `${totalWeeks} weeks total`;
  }

  private calculateResourceRequirements(tasks: RemediationTask[]): ResourceRequirement[] {
    const skillHours: { [key: string]: number } = {};

    tasks.forEach(task => {
      task.skillsRequired.forEach(skill => {
        skillHours[skill] = (skillHours[skill] || 0) + task.estimatedHours;
      });
    });

    return Object.entries(skillHours).map(([skill, hours]) => ({
      role: skill,
      skillLevel: hours > 40 ? 'Senior' : hours > 20 ? 'Mid' : 'Junior',
      hoursRequired: hours,
      responsibilities: [`Implement ${skill.toLowerCase()} improvements`]
    }));
  }

  private generateMilestones(phases: RemediationPhase[]): Milestone[] {
    return phases.map((phase, index) => ({
      id: `M${index + 1}`,
      name: `${phase.name} Complete`,
      description: `All tasks in Phase ${phase.phase} completed successfully`,
      targetDate: `Week ${index * 2 + 2}`,
      deliverables: phase.deliverables,
      successCriteria: [
        'All phase tasks completed',
        'Accessibility tests passing',
        'Code review approved'
      ]
    }));
  }

  /**
   * Format output methods
   */
  private formatAsMarkdown(report: AccessibilityAuditReport): string {
    return `# Accessibility Audit Report

## Executive Summary

**Overall Compliance Score:** ${report.executiveSummary.overallComplianceScore}%
**Compliance Level:** ${report.executiveSummary.complianceLevel}
**Total Issues:** ${report.executiveSummary.totalIssues}
- Critical: ${report.executiveSummary.criticalIssues}
- Major: ${report.executiveSummary.majorIssues}
- Minor: ${report.executiveSummary.minorIssues}

### Key Findings
${report.executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n')}

### Business Impact
${report.executiveSummary.businessImpact}

### Recommended Actions
${report.executiveSummary.recommendedActions.map(action => `- ${action}`).join('\n')}

## Component Results

${report.componentResults.map(component => `
### ${component.componentName}
- **Status:** ${component.status}
- **Score:** ${component.complianceScore}%
- **Priority:** ${component.priority}
- **Time to Fix:** ${component.timeToFix}

**Test Results:**
- Keyboard: ${component.testResults.keyboard ? '✅' : '❌'}
- Screen Reader: ${component.testResults.screenReader ? '✅' : '❌'}
- Color Contrast: ${component.testResults.colorContrast ? '✅' : '❌'}
- Focus Management: ${component.testResults.focusManagement ? '✅' : '❌'}
- Error Handling: ${component.testResults.errorHandling ? '✅' : '❌'}

**Violations:**
${component.violations.map(v => `- **${v.wcagCriterion}**: ${v.description} (${v.count} instances)`).join('\n')}
`).join('\n')}

## WCAG 2.1 Compliance

**Compliance Percentage:** ${report.wcagCompliance.compliancePercentage}%
- Passing Criteria: ${report.wcagCompliance.passingCriteria}
- Failing Criteria: ${report.wcagCompliance.failingCriteria}
- Not Applicable: ${report.wcagCompliance.notApplicableCriteria}

## Remediation Plan

### Timeline: ${report.remediationPlan.timeline}

${report.remediationPlan.phases.map(phase => `
#### Phase ${phase.phase}: ${phase.name}
- **Duration:** ${phase.duration}
- **Priority:** ${phase.priority}
- **Tasks:** ${phase.tasks.length}
- **Deliverables:** ${phase.deliverables.join(', ')}
`).join('\n')}

### Resource Requirements
${report.remediationPlan.resources.map(resource => `
- **${resource.role}** (${resource.skillLevel}): ${resource.hoursRequired} hours
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.title} (${rec.priority} Priority)
**Category:** ${rec.category}

${rec.description}

**Benefits:**
${rec.benefits.map(benefit => `- ${benefit}`).join('\n')}

**Implementation:**
${rec.implementation.map(step => `- ${step}`).join('\n')}
`).join('\n')}

---

*Report generated on ${report.metadata.reportDate}*
*WCAG ${report.metadata.wcagVersion} Level ${report.metadata.wcagLevel} Compliance Assessment*
`;
  }

  private formatAsHTML(report: AccessibilityAuditReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report - ${report.metadata.applicationName}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .summary { background: #e8f5e8; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .component { border: 1px solid #ddd; margin-bottom: 20px; border-radius: 5px; overflow: hidden; }
        .component-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
        .component-body { padding: 15px; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .status-conditional { color: #ffc107; }
        .priority-high { background: #f8d7da; }
        .priority-medium { background: #fff3cd; }
        .priority-low { background: #d1ecf1; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Audit Report</h1>
        <p><strong>Application:</strong> ${report.metadata.applicationName} v${report.metadata.applicationVersion}</p>
        <p><strong>Report Date:</strong> ${new Date(report.metadata.reportDate).toLocaleDateString()}</p>
        <p><strong>Standard:</strong> WCAG ${report.metadata.wcagVersion} Level ${report.metadata.wcagLevel}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">
            <div class="metric-value">${report.executiveSummary.overallComplianceScore}%</div>
            <div class="metric-label">Overall Score</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.executiveSummary.totalIssues}</div>
            <div class="metric-label">Total Issues</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.executiveSummary.criticalIssues}</div>
            <div class="metric-label">Critical Issues</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.executiveSummary.complianceLevel}</div>
            <div class="metric-label">Compliance Level</div>
        </div>

        <h3>Key Findings</h3>
        <ul>
            ${report.executiveSummary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
        </ul>

        <h3>Business Impact</h3>
        <p>${report.executiveSummary.businessImpact}</p>
    </div>

    <h2>Component Results</h2>
    ${report.componentResults.map(component => `
        <div class="component priority-${component.priority.toLowerCase()}">
            <div class="component-header">
                <h3>${component.componentName}
                    <span class="status-${component.status.toLowerCase().replace(' ', '-')}">${component.status}</span>
                </h3>
                <p>Score: ${component.complianceScore}% | Priority: ${component.priority} | Time to Fix: ${component.timeToFix}</p>
            </div>
            <div class="component-body">
                <h4>Test Results</h4>
                <ul>
                    <li>Keyboard: <span class="${component.testResults.keyboard ? 'status-pass' : 'status-fail'}">${component.testResults.keyboard ? 'Pass' : 'Fail'}</span></li>
                    <li>Screen Reader: <span class="${component.testResults.screenReader ? 'status-pass' : 'status-fail'}">${component.testResults.screenReader ? 'Pass' : 'Fail'}</span></li>
                    <li>Color Contrast: <span class="${component.testResults.colorContrast ? 'status-pass' : 'status-fail'}">${component.testResults.colorContrast ? 'Pass' : 'Fail'}</span></li>
                    <li>Focus Management: <span class="${component.testResults.focusManagement ? 'status-pass' : 'status-fail'}">${component.testResults.focusManagement ? 'Pass' : 'Fail'}</span></li>
                    <li>Error Handling: <span class="${component.testResults.errorHandling ? 'status-pass' : 'status-fail'}">${component.testResults.errorHandling ? 'Pass' : 'Fail'}</span></li>
                </ul>

                ${component.violations.length > 0 ? `
                <h4>Violations</h4>
                <table>
                    <thead>
                        <tr>
                            <th>WCAG Criterion</th>
                            <th>Description</th>
                            <th>Count</th>
                            <th>Severity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${component.violations.map(violation => `
                        <tr>
                            <td>${violation.wcagCriterion}</td>
                            <td>${violation.description}</td>
                            <td>${violation.count}</td>
                            <td>${violation.severity}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p>No violations found.</p>'}
            </div>
        </div>
    `).join('')}

    <h2>WCAG 2.1 Compliance</h2>
    <div class="summary">
        <div class="metric">
            <div class="metric-value">${report.wcagCompliance.compliancePercentage}%</div>
            <div class="metric-label">Compliance Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.wcagCompliance.passingCriteria}</div>
            <div class="metric-label">Passing Criteria</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.wcagCompliance.failingCriteria}</div>
            <div class="metric-label">Failing Criteria</div>
        </div>
    </div>

    <h2>Remediation Plan</h2>
    <p><strong>Total Timeline:</strong> ${report.remediationPlan.timeline}</p>

    ${report.remediationPlan.phases.map(phase => `
        <h3>Phase ${phase.phase}: ${phase.name}</h3>
        <p><strong>Duration:</strong> ${phase.duration} | <strong>Priority:</strong> ${phase.priority}</p>
        <p><strong>Tasks:</strong> ${phase.tasks.length}</p>
        <p><strong>Deliverables:</strong> ${phase.deliverables.join(', ')}</p>
    `).join('')}

    <h3>Resource Requirements</h3>
    <table>
        <thead>
            <tr>
                <th>Role</th>
                <th>Skill Level</th>
                <th>Hours Required</th>
            </tr>
        </thead>
        <tbody>
            ${report.remediationPlan.resources.map(resource => `
            <tr>
                <td>${resource.role}</td>
                <td>${resource.skillLevel}</td>
                <td>${resource.hoursRequired}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Recommendations</h2>
    ${report.recommendations.map(rec => `
        <div class="component">
            <div class="component-header">
                <h3>${rec.title}</h3>
                <p><strong>Category:</strong> ${rec.category} | <strong>Priority:</strong> ${rec.priority}</p>
            </div>
            <div class="component-body">
                <p>${rec.description}</p>
                <h4>Benefits</h4>
                <ul>
                    ${rec.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
                </ul>
                <h4>Implementation</h4>
                <ul>
                    ${rec.implementation.map(step => `<li>${step}</li>`).join('')}
                </ul>
            </div>
        </div>
    `).join('')}

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
        <p>Report generated on ${new Date(report.metadata.reportDate).toLocaleDateString()}</p>
        <p>WCAG ${report.metadata.wcagVersion} Level ${report.metadata.wcagLevel} Compliance Assessment</p>
    </footer>
</body>
</html>
    `;
  }
}

export default AccessibilityAuditReportGenerator;