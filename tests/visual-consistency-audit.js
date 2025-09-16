/**
 * Visual Consistency Audit Tool
 *
 * Automated tool to analyze CSS files and detect visual inconsistencies
 * across the design system. Validates typography, spacing, colors, and patterns.
 *
 * @version 1.0.0
 * @author Visual Consistency Specialist
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

class VisualConsistencyAuditor {
  constructor() {
    this.results = {
      typography: { issues: [], patterns: new Map() },
      spacing: { issues: [], patterns: new Map() },
      colors: { issues: [], patterns: new Map() },
      breakpoints: { issues: [], patterns: new Map() },
      animations: { issues: [], patterns: new Map() },
      inconsistencies: [],
      score: 0
    };

    // Define expected patterns
    this.expectedPatterns = {
      typography: {
        scale: [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60],
        lineHeights: [1, 1.25, 1.375, 1.5, 1.625, 2],
        fontWeights: [100, 200, 300, 400, 500, 600, 700, 800, 900]
      },
      spacing: {
        scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128],
        tolerance: 2 // pixels
      },
      colors: {
        properties: ['color', 'background-color', 'border-color', 'fill', 'stroke'],
        maxVariants: 50 // Maximum unique colors before flagging as inconsistent
      },
      breakpoints: {
        expected: [640, 768, 1024, 1280, 1536],
        tolerance: 16 // pixels
      },
      animations: {
        durations: [0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1.0],
        easings: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']
      }
    };
  }

  /**
   * Audit all CSS files in the project
   */
  async auditProject(projectPath) {
    const cssFiles = this.findCSSFiles(projectPath);
    console.log(`🔍 Found ${cssFiles.length} CSS files to audit`);

    for (const file of cssFiles) {
      await this.auditFile(file);
    }

    this.calculateScore();
    return this.generateReport();
  }

  /**
   * Find all CSS files in the project
   */
  findCSSFiles(dir) {
    const cssFiles = [];
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);

      if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
        cssFiles.push(...this.findCSSFiles(fullPath));
      } else if (file.isFile() && file.name.endsWith('.css')) {
        cssFiles.push(fullPath);
      }
    }

    return cssFiles;
  }

  /**
   * Audit a single CSS file
   */
  async auditFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const ast = postcss.parse(content);

      this.auditTypography(ast, filePath);
      this.auditSpacing(ast, filePath);
      this.auditColors(ast, filePath);
      this.auditBreakpoints(ast, filePath);
      this.auditAnimations(ast, filePath);

    } catch (error) {
      console.error(`Error auditing ${filePath}:`, error.message);
    }
  }

  /**
   * Audit typography consistency
   */
  auditTypography(ast, filePath) {
    const fontSizes = new Set();
    const lineHeights = new Set();
    const fontWeights = new Set();
    const fontFamilies = new Set();

    ast.walkDecls(decl => {
      switch (decl.prop) {
        case 'font-size':
          const fontSize = this.extractPixelValue(decl.value);
          if (fontSize) {
            fontSizes.add(fontSize);
            this.results.typography.patterns.set(decl.value, (this.results.typography.patterns.get(decl.value) || 0) + 1);

            // Check if font size follows expected scale
            if (!this.isInScale(fontSize, this.expectedPatterns.typography.scale, 2)) {
              this.results.typography.issues.push({
                file: filePath,
                line: decl.source?.start?.line,
                property: 'font-size',
                value: decl.value,
                issue: 'Font size not in expected scale',
                expected: this.expectedPatterns.typography.scale
              });
            }
          }
          break;

        case 'line-height':
          const lineHeight = parseFloat(decl.value);
          if (!isNaN(lineHeight)) {
            lineHeights.add(lineHeight);

            if (!this.isInScale(lineHeight, this.expectedPatterns.typography.lineHeights, 0.1)) {
              this.results.typography.issues.push({
                file: filePath,
                line: decl.source?.start?.line,
                property: 'line-height',
                value: decl.value,
                issue: 'Line height not in expected scale',
                expected: this.expectedPatterns.typography.lineHeights
              });
            }
          }
          break;

        case 'font-weight':
          const fontWeight = parseInt(decl.value) || decl.value;
          fontWeights.add(fontWeight);

          if (typeof fontWeight === 'number' && !this.expectedPatterns.typography.fontWeights.includes(fontWeight)) {
            this.results.typography.issues.push({
              file: filePath,
              line: decl.source?.start?.line,
              property: 'font-weight',
              value: decl.value,
              issue: 'Font weight not standard',
              expected: this.expectedPatterns.typography.fontWeights
            });
          }
          break;

        case 'font-family':
          fontFamilies.add(decl.value);
          break;
      }
    });

    // Check for too many variations
    if (fontSizes.size > 15) {
      this.results.typography.issues.push({
        file: filePath,
        issue: 'Too many font size variations',
        count: fontSizes.size,
        recommended: '≤ 15 variations'
      });
    }
  }

  /**
   * Audit spacing consistency
   */
  auditSpacing(ast, filePath) {
    const spacingValues = new Set();
    const spacingProperties = ['margin', 'padding', 'gap', 'top', 'right', 'bottom', 'left'];

    ast.walkDecls(decl => {
      if (spacingProperties.some(prop => decl.prop.includes(prop))) {
        const values = decl.value.split(/\s+/);

        values.forEach(value => {
          const pixelValue = this.extractPixelValue(value);
          if (pixelValue !== null) {
            spacingValues.add(pixelValue);
            this.results.spacing.patterns.set(value, (this.results.spacing.patterns.get(value) || 0) + 1);

            // Check if spacing follows expected scale
            if (!this.isInScale(pixelValue, this.expectedPatterns.spacing.scale, this.expectedPatterns.spacing.tolerance)) {
              this.results.spacing.issues.push({
                file: filePath,
                line: decl.source?.start?.line,
                property: decl.prop,
                value: value,
                issue: 'Spacing not in expected scale',
                expected: this.expectedPatterns.spacing.scale
              });
            }
          }
        });
      }
    });

    // Check for too many spacing variations
    if (spacingValues.size > 20) {
      this.results.spacing.issues.push({
        file: filePath,
        issue: 'Too many spacing variations',
        count: spacingValues.size,
        recommended: '≤ 20 variations'
      });
    }
  }

  /**
   * Audit color consistency
   */
  auditColors(ast, filePath) {
    const colors = new Set();

    ast.walkDecls(decl => {
      if (this.expectedPatterns.colors.properties.includes(decl.prop)) {
        const colorValues = this.extractColors(decl.value);

        colorValues.forEach(color => {
          colors.add(color);
          this.results.colors.patterns.set(color, (this.results.colors.patterns.get(color) || 0) + 1);
        });
      }
    });

    // Check for too many color variations
    if (colors.size > this.expectedPatterns.colors.maxVariants) {
      this.results.colors.issues.push({
        file: filePath,
        issue: 'Too many color variations',
        count: colors.size,
        recommended: `≤ ${this.expectedPatterns.colors.maxVariants} variations`
      });
    }

    // Check for hardcoded colors vs CSS variables
    ast.walkDecls(decl => {
      if (this.expectedPatterns.colors.properties.includes(decl.prop)) {
        if (this.isHardcodedColor(decl.value) && !decl.value.includes('var(')) {
          this.results.colors.issues.push({
            file: filePath,
            line: decl.source?.start?.line,
            property: decl.prop,
            value: decl.value,
            issue: 'Hardcoded color instead of CSS variable',
            recommendation: 'Use CSS variables for consistent theming'
          });
        }
      }
    });
  }

  /**
   * Audit breakpoint consistency
   */
  auditBreakpoints(ast, filePath) {
    const breakpoints = new Set();

    ast.walkAtRules(rule => {
      if (rule.name === 'media') {
        const matches = rule.params.match(/(\d+)px/g);
        if (matches) {
          matches.forEach(match => {
            const value = parseInt(match);
            breakpoints.add(value);

            // Check if breakpoint is in expected list
            if (!this.isInScale(value, this.expectedPatterns.breakpoints.expected, this.expectedPatterns.breakpoints.tolerance)) {
              this.results.breakpoints.issues.push({
                file: filePath,
                line: rule.source?.start?.line,
                value: value,
                issue: 'Breakpoint not in standard scale',
                expected: this.expectedPatterns.breakpoints.expected
              });
            }
          });
        }
      }
    });
  }

  /**
   * Audit animation consistency
   */
  auditAnimations(ast, filePath) {
    const durations = new Set();
    const easings = new Set();

    ast.walkDecls(decl => {
      if (decl.prop.includes('transition') || decl.prop.includes('animation')) {
        // Extract duration
        const durationMatch = decl.value.match(/(\d*\.?\d+)s/);
        if (durationMatch) {
          const duration = parseFloat(durationMatch[1]);
          durations.add(duration);

          if (!this.isInScale(duration, this.expectedPatterns.animations.durations, 0.05)) {
            this.results.animations.issues.push({
              file: filePath,
              line: decl.source?.start?.line,
              property: decl.prop,
              value: decl.value,
              issue: 'Animation duration not in recommended scale',
              expected: this.expectedPatterns.animations.durations
            });
          }
        }

        // Extract easing
        this.expectedPatterns.animations.easings.forEach(easing => {
          if (decl.value.includes(easing)) {
            easings.add(easing);
          }
        });
      }
    });
  }

  /**
   * Check if a value is within an expected scale
   */
  isInScale(value, scale, tolerance = 0) {
    return scale.some(scaleValue => Math.abs(value - scaleValue) <= tolerance);
  }

  /**
   * Extract pixel value from CSS value
   */
  extractPixelValue(value) {
    if (typeof value !== 'string') return null;

    // Handle px values
    const pxMatch = value.match(/^(\d*\.?\d+)px$/);
    if (pxMatch) return parseFloat(pxMatch[1]);

    // Handle rem values (assume 16px base)
    const remMatch = value.match(/^(\d*\.?\d+)rem$/);
    if (remMatch) return parseFloat(remMatch[1]) * 16;

    return null;
  }

  /**
   * Extract colors from CSS value
   */
  extractColors(value) {
    const colors = [];

    // RGB/RGBA
    const rgbMatches = value.match(/rgba?\([^)]+\)/g);
    if (rgbMatches) colors.push(...rgbMatches);

    // Hex colors
    const hexMatches = value.match(/#[0-9a-fA-F]{3,8}/g);
    if (hexMatches) colors.push(...hexMatches);

    // HSL/HSLA
    const hslMatches = value.match(/hsla?\([^)]+\)/g);
    if (hslMatches) colors.push(...hslMatches);

    // Named colors (basic check)
    const namedColors = ['red', 'green', 'blue', 'white', 'black', 'yellow', 'orange', 'purple', 'pink', 'gray', 'brown'];
    namedColors.forEach(color => {
      if (value.includes(color)) colors.push(color);
    });

    return colors;
  }

  /**
   * Check if a color is hardcoded
   */
  isHardcodedColor(value) {
    return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/.test(value.trim());
  }

  /**
   * Calculate overall consistency score
   */
  calculateScore() {
    const categories = ['typography', 'spacing', 'colors', 'breakpoints', 'animations'];
    let totalIssues = 0;
    let totalChecks = 0;

    categories.forEach(category => {
      const issues = this.results[category].issues.length;
      const patterns = this.results[category].patterns.size || 1;

      totalIssues += issues;
      totalChecks += patterns;
    });

    // Score from 0-100, where 100 is perfect consistency
    this.results.score = Math.max(0, Math.min(100, 100 - (totalIssues / totalChecks) * 100));
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const report = {
      summary: {
        score: this.results.score,
        totalIssues: Object.values(this.results).reduce((sum, category) =>
          sum + (category.issues ? category.issues.length : 0), 0),
        categories: {
          typography: this.results.typography.issues.length,
          spacing: this.results.spacing.issues.length,
          colors: this.results.colors.issues.length,
          breakpoints: this.results.breakpoints.issues.length,
          animations: this.results.animations.issues.length
        }
      },
      details: this.results,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Typography recommendations
    if (this.results.typography.issues.length > 0) {
      recommendations.push({
        category: 'Typography',
        priority: 'high',
        title: 'Standardize Typography Scale',
        description: 'Use a consistent typographic scale based on mathematical ratios',
        actions: [
          'Define a base font size (16px recommended)',
          'Use a consistent scale ratio (1.25 Major Third or 1.618 Golden Ratio)',
          'Implement CSS custom properties for font sizes',
          'Create utility classes for consistent typography'
        ]
      });
    }

    // Spacing recommendations
    if (this.results.spacing.issues.length > 0) {
      recommendations.push({
        category: 'Spacing',
        priority: 'high',
        title: 'Implement Consistent Spacing System',
        description: 'Use a 4px or 8px base grid system for all spacing',
        actions: [
          'Define spacing scale in CSS custom properties',
          'Use spacing utilities instead of arbitrary values',
          'Implement consistent gap values in grid/flexbox layouts',
          'Create spacing documentation for team reference'
        ]
      });
    }

    // Color recommendations
    if (this.results.colors.issues.length > 0) {
      recommendations.push({
        category: 'Colors',
        priority: 'medium',
        title: 'Establish Color System',
        description: 'Create a systematic approach to color usage',
        actions: [
          'Define color palette with CSS custom properties',
          'Create semantic color tokens (primary, secondary, etc.)',
          'Implement dark mode support with color variables',
          'Remove hardcoded color values'
        ]
      });
    }

    // Breakpoint recommendations
    if (this.results.breakpoints.issues.length > 0) {
      recommendations.push({
        category: 'Breakpoints',
        priority: 'medium',
        title: 'Standardize Breakpoint System',
        description: 'Use consistent breakpoints across all components',
        actions: [
          'Define standard breakpoints (640px, 768px, 1024px, 1280px, 1536px)',
          'Create mixins or utilities for responsive design',
          'Document breakpoint strategy for team',
          'Remove arbitrary breakpoint values'
        ]
      });
    }

    // Animation recommendations
    if (this.results.animations.issues.length > 0) {
      recommendations.push({
        category: 'Animations',
        priority: 'low',
        title: 'Optimize Animation System',
        description: 'Create consistent timing and easing for better UX',
        actions: [
          'Define animation duration scale (0.1s, 0.2s, 0.3s, etc.)',
          'Use consistent easing functions',
          'Implement reduced motion support',
          'Create animation utilities'
        ]
      });
    }

    return recommendations;
  }
}

module.exports = VisualConsistencyAuditor;

// CLI usage
if (require.main === module) {
  const auditor = new VisualConsistencyAuditor();
  const projectPath = process.argv[2] || process.cwd();

  auditor.auditProject(projectPath)
    .then(report => {
      console.log('\n📊 Visual Consistency Audit Report');
      console.log('==================================');
      console.log(`Score: ${report.summary.score.toFixed(1)}/100`);
      console.log(`Total Issues: ${report.summary.totalIssues}`);
      console.log('\nIssues by Category:');
      Object.entries(report.summary.categories).forEach(([category, count]) => {
        console.log(`  ${category}: ${count} issues`);
      });

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach((rec, index) => {
          console.log(`\n${index + 1}. ${rec.title} (${rec.priority} priority)`);
          console.log(`   ${rec.description}`);
        });
      }

      // Write detailed report to file
      fs.writeFileSync('visual-consistency-report.json', JSON.stringify(report, null, 2));
      console.log('\n📄 Detailed report saved to visual-consistency-report.json');
    })
    .catch(error => {
      console.error('Audit failed:', error);
      process.exit(1);
    });
}