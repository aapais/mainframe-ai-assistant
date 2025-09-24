#!/usr/bin/env python3
"""
Comprehensive Test Report Generator
Aggregates all test results and generates detailed reports
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET
from typing import Dict, List, Any
import subprocess

class TestReportGenerator:
    def __init__(self):
        self.base_dir = Path.cwd()
        self.report_dir = self.base_dir / "test-reports"
        self.coverage_dir = self.base_dir / "coverage-summary"

        # Create report directories
        self.report_dir.mkdir(exist_ok=True)
        self.coverage_dir.mkdir(exist_ok=True)

        self.test_results = {
            'unit': {},
            'integration': {},
            'performance': {},
            'security': {},
            'compliance': {},
            'ai_models': {},
            'e2e': {}
        }

        self.coverage_data = {}
        self.quality_metrics = {}

    def collect_test_results(self):
        """Collect all test results from artifact downloads"""
        print("📊 Collecting test results...")

        # Unit test results
        self._collect_unit_test_results()

        # Integration test results
        self._collect_integration_test_results()

        # Performance test results
        self._collect_performance_test_results()

        # Security test results
        self._collect_security_test_results()

        # Compliance test results
        self._collect_compliance_test_results()

        # AI model test results
        self._collect_ai_model_test_results()

        # E2E test results
        self._collect_e2e_test_results()

    def _collect_unit_test_results(self):
        """Collect unit test results and coverage"""
        unit_dirs = list(Path('.').glob('unit-test-results-*'))

        for unit_dir in unit_dirs:
            node_version = unit_dir.name.split('-')[-1]

            # Read Jest results
            jest_file = unit_dir / 'reports' / 'junit.xml'
            if jest_file.exists():
                results = self._parse_junit_xml(jest_file)
                self.test_results['unit'][node_version] = results

            # Read coverage data
            coverage_file = unit_dir / 'coverage' / 'coverage-summary.json'
            if coverage_file.exists():
                with open(coverage_file) as f:
                    coverage = json.load(f)
                    self.coverage_data[f'unit_{node_version}'] = coverage

    def _collect_integration_test_results(self):
        """Collect integration test results"""
        integration_dir = Path('integration-test-results')

        if integration_dir.exists():
            junit_file = integration_dir / 'reports' / 'junit.xml'
            if junit_file.exists():
                self.test_results['integration'] = self._parse_junit_xml(junit_file)

            coverage_file = integration_dir / 'coverage' / 'coverage-summary.json'
            if coverage_file.exists():
                with open(coverage_file) as f:
                    self.coverage_data['integration'] = json.load(f)

    def _collect_performance_test_results(self):
        """Collect performance test results"""
        perf_dir = Path('performance-test-results')

        if perf_dir.exists():
            # Performance metrics
            metrics_file = perf_dir / 'reports' / 'performance-metrics.json'
            if metrics_file.exists():
                with open(metrics_file) as f:
                    self.test_results['performance'] = json.load(f)

            # Benchmark results
            benchmark_file = perf_dir / 'benchmarks' / 'benchmark-results.json'
            if benchmark_file.exists():
                with open(benchmark_file) as f:
                    self.quality_metrics['performance'] = json.load(f)

    def _collect_security_test_results(self):
        """Collect security test results"""
        security_dir = Path('security-test-results')

        if security_dir.exists():
            # Security test results
            security_file = security_dir / 'reports' / 'security-results.json'
            if security_file.exists():
                with open(security_file) as f:
                    self.test_results['security'] = json.load(f)

        # Audit results
        audit_files = list(Path('.').glob('security-*-report.json'))
        for audit_file in audit_files:
            audit_type = audit_file.name.split('-')[1]
            with open(audit_file) as f:
                if 'security_audits' not in self.test_results:
                    self.test_results['security_audits'] = {}
                self.test_results['security_audits'][audit_type] = json.load(f)

    def _collect_compliance_test_results(self):
        """Collect compliance test results"""
        compliance_dir = Path('compliance-test-results')

        if compliance_dir.exists():
            # LGPD results
            lgpd_file = compliance_dir / 'reports' / 'lgpd-compliance.json'
            if lgpd_file.exists():
                with open(lgpd_file) as f:
                    self.test_results['compliance']['lgpd'] = json.load(f)

            # SOX results
            sox_file = compliance_dir / 'reports' / 'sox-compliance.json'
            if sox_file.exists():
                with open(sox_file) as f:
                    self.test_results['compliance']['sox'] = json.load(f)

            # BACEN results
            bacen_file = compliance_dir / 'reports' / 'bacen-compliance.json'
            if bacen_file.exists():
                with open(bacen_file) as f:
                    self.test_results['compliance']['bacen'] = json.load(f)

    def _collect_ai_model_test_results(self):
        """Collect AI model test results"""
        ai_dir = Path('ai-model-test-results')

        if ai_dir.exists():
            # Model accuracy results
            accuracy_file = ai_dir / 'reports' / 'model-accuracy.json'
            if accuracy_file.exists():
                with open(accuracy_file) as f:
                    self.test_results['ai_models']['accuracy'] = json.load(f)

            # Bias detection results
            bias_file = ai_dir / 'reports' / 'bias-detection.json'
            if bias_file.exists():
                with open(bias_file) as f:
                    self.test_results['ai_models']['bias'] = json.load(f)

            # Model performance metrics
            perf_file = ai_dir / 'model-metrics' / 'performance-metrics.json'
            if perf_file.exists():
                with open(perf_file) as f:
                    self.test_results['ai_models']['performance'] = json.load(f)

    def _collect_e2e_test_results(self):
        """Collect E2E test results"""
        e2e_dir = Path('e2e-test-results')

        if e2e_dir.exists():
            # Playwright results
            results_file = e2e_dir / 'test-results' / 'results.json'
            if results_file.exists():
                with open(results_file) as f:
                    self.test_results['e2e'] = json.load(f)

    def _parse_junit_xml(self, xml_file: Path) -> Dict[str, Any]:
        """Parse JUnit XML results"""
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()

            results = {
                'total_tests': int(root.get('tests', 0)),
                'passed_tests': int(root.get('tests', 0)) - int(root.get('failures', 0)) - int(root.get('errors', 0)),
                'failed_tests': int(root.get('failures', 0)),
                'error_tests': int(root.get('errors', 0)),
                'skipped_tests': int(root.get('skipped', 0)),
                'execution_time': float(root.get('time', 0)),
                'test_suites': []
            }

            for testsuite in root.findall('testsuite'):
                suite_data = {
                    'name': testsuite.get('name'),
                    'tests': int(testsuite.get('tests', 0)),
                    'failures': int(testsuite.get('failures', 0)),
                    'errors': int(testsuite.get('errors', 0)),
                    'time': float(testsuite.get('time', 0))
                }
                results['test_suites'].append(suite_data)

            return results
        except Exception as e:
            print(f"Error parsing {xml_file}: {e}")
            return {}

    def calculate_overall_metrics(self):
        """Calculate overall quality metrics"""
        print("📈 Calculating overall metrics...")

        overall_metrics = {
            'test_summary': self._calculate_test_summary(),
            'coverage_summary': self._calculate_coverage_summary(),
            'quality_score': self._calculate_quality_score(),
            'compliance_score': self._calculate_compliance_score(),
            'security_score': self._calculate_security_score(),
            'ai_performance_score': self._calculate_ai_performance_score()
        }

        return overall_metrics

    def _calculate_test_summary(self) -> Dict[str, Any]:
        """Calculate overall test summary"""
        total_tests = 0
        passed_tests = 0
        failed_tests = 0

        for test_type, results in self.test_results.items():
            if isinstance(results, dict):
                if 'total_tests' in results:
                    total_tests += results.get('total_tests', 0)
                    passed_tests += results.get('passed_tests', 0)
                    failed_tests += results.get('failed_tests', 0)
                elif isinstance(results, dict):
                    for sub_result in results.values():
                        if isinstance(sub_result, dict) and 'total_tests' in sub_result:
                            total_tests += sub_result.get('total_tests', 0)
                            passed_tests += sub_result.get('passed_tests', 0)
                            failed_tests += sub_result.get('failed_tests', 0)

        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'pass_rate': round(pass_rate, 2)
        }

    def _calculate_coverage_summary(self) -> Dict[str, Any]:
        """Calculate overall coverage summary"""
        total_lines = 0
        covered_lines = 0
        total_functions = 0
        covered_functions = 0
        total_branches = 0
        covered_branches = 0

        for coverage_type, coverage in self.coverage_data.items():
            if 'total' in coverage:
                total_data = coverage['total']
                total_lines += total_data.get('lines', {}).get('total', 0)
                covered_lines += total_data.get('lines', {}).get('covered', 0)
                total_functions += total_data.get('functions', {}).get('total', 0)
                covered_functions += total_data.get('functions', {}).get('covered', 0)
                total_branches += total_data.get('branches', {}).get('total', 0)
                covered_branches += total_data.get('branches', {}).get('covered', 0)

        line_coverage = (covered_lines / total_lines * 100) if total_lines > 0 else 0
        function_coverage = (covered_functions / total_functions * 100) if total_functions > 0 else 0
        branch_coverage = (covered_branches / total_branches * 100) if total_branches > 0 else 0

        return {
            'line_coverage': round(line_coverage, 2),
            'function_coverage': round(function_coverage, 2),
            'branch_coverage': round(branch_coverage, 2),
            'overall_coverage': round((line_coverage + function_coverage + branch_coverage) / 3, 2)
        }

    def _calculate_quality_score(self) -> float:
        """Calculate overall quality score"""
        scores = []

        # Test pass rate (40% weight)
        test_summary = self._calculate_test_summary()
        scores.append(test_summary['pass_rate'] * 0.4)

        # Coverage score (30% weight)
        coverage_summary = self._calculate_coverage_summary()
        scores.append(coverage_summary['overall_coverage'] * 0.3)

        # Performance score (20% weight)
        if 'performance' in self.quality_metrics:
            perf_score = self.quality_metrics['performance'].get('overall_score', 75)
            scores.append(perf_score * 0.2)
        else:
            scores.append(75 * 0.2)  # Default score

        # Security score (10% weight)
        security_score = self._calculate_security_score()
        scores.append(security_score * 0.1)

        return round(sum(scores), 2)

    def _calculate_compliance_score(self) -> float:
        """Calculate compliance score"""
        compliance_scores = []

        if 'compliance' in self.test_results:
            compliance_data = self.test_results['compliance']

            # LGPD compliance
            if 'lgpd' in compliance_data:
                lgpd_score = compliance_data['lgpd'].get('compliance_score', 90)
                compliance_scores.append(lgpd_score)

            # SOX compliance
            if 'sox' in compliance_data:
                sox_score = compliance_data['sox'].get('compliance_score', 90)
                compliance_scores.append(sox_score)

            # BACEN compliance
            if 'bacen' in compliance_data:
                bacen_score = compliance_data['bacen'].get('compliance_score', 90)
                compliance_scores.append(bacen_score)

        return round(sum(compliance_scores) / len(compliance_scores), 2) if compliance_scores else 90

    def _calculate_security_score(self) -> float:
        """Calculate security score"""
        security_issues = 0
        total_checks = 0

        if 'security' in self.test_results:
            security_data = self.test_results['security']
            security_issues = security_data.get('total_issues', 0)
            total_checks = security_data.get('total_checks', 100)

        if 'security_audits' in self.test_results:
            for audit_type, audit_data in self.test_results['security_audits'].items():
                if isinstance(audit_data, dict):
                    security_issues += len(audit_data.get('vulnerabilities', []))
                    total_checks += audit_data.get('total_checks', 50)

        # Security score: 100 - (issues/checks * 100)
        security_score = max(0, 100 - (security_issues / total_checks * 100)) if total_checks > 0 else 100
        return round(security_score, 2)

    def _calculate_ai_performance_score(self) -> float:
        """Calculate AI model performance score"""
        if 'ai_models' not in self.test_results:
            return 85  # Default score

        ai_data = self.test_results['ai_models']
        scores = []

        # Accuracy score
        if 'accuracy' in ai_data:
            accuracy = ai_data['accuracy'].get('overall_accuracy', 0.85)
            scores.append(accuracy * 100)

        # Bias score (inverted - lower bias is better)
        if 'bias' in ai_data:
            bias_score = ai_data['bias'].get('fairness_score', 0.9)
            scores.append(bias_score * 100)

        # Performance score
        if 'performance' in ai_data:
            perf_score = ai_data['performance'].get('latency_score', 85)
            scores.append(perf_score)

        return round(sum(scores) / len(scores), 2) if scores else 85

    def generate_html_report(self, metrics: Dict[str, Any]):
        """Generate comprehensive HTML report"""
        print("📄 Generating HTML report...")

        html_template = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Incident Resolution System - Test Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; padding: 30px; }
        .metric-card { background: #f8f9fa; border-radius: 8px; padding: 20px; border-left: 4px solid #007bff; }
        .metric-card h3 { margin: 0 0 10px 0; color: #333; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-subtitle { color: #666; font-size: 0.9em; margin-top: 5px; }
        .section { padding: 30px; border-top: 1px solid #eee; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .test-card { background: #f8f9fa; border-radius: 8px; padding: 20px; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .compliance-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .compliance-table th, .compliance-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .compliance-table th { background: #f8f9fa; font-weight: bold; }
        .footer { background: #333; color: white; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Incident Resolution System</h1>
            <p>Comprehensive Test Report - {timestamp}</p>
            <p>Build: {build_id} | Commit: {commit_sha}</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <h3>🧪 Test Results</h3>
                <div class="metric-value">{test_pass_rate}%</div>
                <div class="metric-subtitle">{total_tests} tests executed</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {test_pass_rate}%"></div>
                </div>
            </div>

            <div class="metric-card">
                <h3>📊 Code Coverage</h3>
                <div class="metric-value">{overall_coverage}%</div>
                <div class="metric-subtitle">Lines, Functions, Branches</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {overall_coverage}%"></div>
                </div>
            </div>

            <div class="metric-card">
                <h3>🏆 Quality Score</h3>
                <div class="metric-value">{quality_score}</div>
                <div class="metric-subtitle">Overall system quality</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {quality_score}%"></div>
                </div>
            </div>

            <div class="metric-card">
                <h3>🔒 Security Score</h3>
                <div class="metric-value">{security_score}</div>
                <div class="metric-subtitle">Security assessment</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {security_score}%"></div>
                </div>
            </div>

            <div class="metric-card">
                <h3>📋 Compliance Score</h3>
                <div class="metric-value">{compliance_score}</div>
                <div class="metric-subtitle">LGPD, SOX, BACEN</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {compliance_score}%"></div>
                </div>
            </div>

            <div class="metric-card">
                <h3>🤖 AI Performance</h3>
                <div class="metric-value">{ai_performance_score}</div>
                <div class="metric-subtitle">Model accuracy & bias</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {ai_performance_score}%"></div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📈 Test Suite Results</h2>
            <div class="test-grid">
                {test_suite_cards}
            </div>
        </div>

        <div class="section">
            <h2>📋 Compliance Status</h2>
            <table class="compliance-table">
                <thead>
                    <tr>
                        <th>Regulation</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Critical Issues</th>
                    </tr>
                </thead>
                <tbody>
                    {compliance_rows}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>Generated by AI Incident Resolution System Test Suite</p>
            <p>For questions, contact the DevOps team</p>
        </div>
    </div>
</body>
</html>
        """

        # Format template
        formatted_html = html_template.format(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
            build_id=os.getenv('GITHUB_RUN_ID', 'local'),
            commit_sha=os.getenv('GITHUB_SHA', 'unknown')[:8],
            test_pass_rate=metrics['test_summary']['pass_rate'],
            total_tests=metrics['test_summary']['total_tests'],
            overall_coverage=metrics['coverage_summary']['overall_coverage'],
            quality_score=metrics['quality_score'],
            security_score=metrics['security_score'],
            compliance_score=metrics['compliance_score'],
            ai_performance_score=metrics['ai_performance_score'],
            test_suite_cards=self._generate_test_suite_cards(),
            compliance_rows=self._generate_compliance_rows()
        )

        # Write HTML report
        html_file = self.report_dir / 'comprehensive-test-report.html'
        with open(html_file, 'w') as f:
            f.write(formatted_html)

        print(f"✅ HTML report generated: {html_file}")

    def _generate_test_suite_cards(self) -> str:
        """Generate test suite cards HTML"""
        cards = []

        test_suites = [
            ('Unit Tests', 'unit', '🧪'),
            ('Integration Tests', 'integration', '🔗'),
            ('Performance Tests', 'performance', '⚡'),
            ('Security Tests', 'security', '🔒'),
            ('Compliance Tests', 'compliance', '📋'),
            ('AI Model Tests', 'ai_models', '🤖'),
            ('E2E Tests', 'e2e', '🎯')
        ]

        for name, key, icon in test_suites:
            if key in self.test_results:
                result = self.test_results[key]
                if isinstance(result, dict) and 'total_tests' in result:
                    status_class = 'status-pass' if result.get('failed_tests', 0) == 0 else 'status-fail'
                    status_text = 'PASSED' if result.get('failed_tests', 0) == 0 else 'FAILED'

                    card = f"""
                    <div class="test-card">
                        <h3>{icon} {name}</h3>
                        <p>Status: <span class="{status_class}">{status_text}</span></p>
                        <p>Tests: {result.get('total_tests', 0)} | Passed: {result.get('passed_tests', 0)} | Failed: {result.get('failed_tests', 0)}</p>
                        <p>Duration: {result.get('execution_time', 0):.2f}s</p>
                    </div>
                    """
                    cards.append(card)

        return ''.join(cards)

    def _generate_compliance_rows(self) -> str:
        """Generate compliance table rows HTML"""
        rows = []

        compliance_data = [
            ('LGPD', 'lgpd'),
            ('SOX', 'sox'),
            ('BACEN', 'bacen')
        ]

        for name, key in compliance_data:
            if 'compliance' in self.test_results and key in self.test_results['compliance']:
                data = self.test_results['compliance'][key]
                score = data.get('compliance_score', 90)
                status = 'COMPLIANT' if score >= 95 else 'NON-COMPLIANT' if score < 80 else 'NEEDS REVIEW'
                status_class = 'status-pass' if score >= 95 else 'status-fail' if score < 80 else 'status-warning'
                critical_issues = data.get('critical_issues', 0)

                row = f"""
                <tr>
                    <td>{name}</td>
                    <td><span class="{status_class}">{status}</span></td>
                    <td>{score}%</td>
                    <td>{critical_issues}</td>
                </tr>
                """
                rows.append(row)

        return ''.join(rows)

    def generate_summary_markdown(self, metrics: Dict[str, Any]):
        """Generate summary markdown for PR comments"""
        print("📝 Generating summary markdown...")

        summary = f"""
# Test Results Summary

## 📊 Overall Metrics
- **Quality Score**: {metrics['quality_score']}/100
- **Test Pass Rate**: {metrics['test_summary']['pass_rate']}% ({metrics['test_summary']['passed_tests']}/{metrics['test_summary']['total_tests']} tests)
- **Code Coverage**: {metrics['coverage_summary']['overall_coverage']}%
- **Security Score**: {metrics['security_score']}/100
- **Compliance Score**: {metrics['compliance_score']}/100
- **AI Performance**: {metrics['ai_performance_score']}/100

## 🧪 Test Suite Results
| Suite | Status | Tests | Pass Rate |
|-------|---------|-------|-----------|
"""

        for test_type, results in self.test_results.items():
            if isinstance(results, dict) and 'total_tests' in results:
                status = "✅ PASS" if results.get('failed_tests', 0) == 0 else "❌ FAIL"
                pass_rate = (results.get('passed_tests', 0) / results.get('total_tests', 1)) * 100
                summary += f"| {test_type.title()} | {status} | {results.get('total_tests', 0)} | {pass_rate:.1f}% |\n"

        summary += f"""
## 🔍 Coverage Breakdown
- **Line Coverage**: {metrics['coverage_summary']['line_coverage']}%
- **Function Coverage**: {metrics['coverage_summary']['function_coverage']}%
- **Branch Coverage**: {metrics['coverage_summary']['branch_coverage']}%

## 📋 Compliance Status
"""

        compliance_data = self.test_results.get('compliance', {})
        for regulation in ['lgpd', 'sox', 'bacen']:
            if regulation in compliance_data:
                score = compliance_data[regulation].get('compliance_score', 90)
                status = "✅" if score >= 95 else "⚠️" if score >= 80 else "❌"
                summary += f"- **{regulation.upper()}**: {status} {score}%\n"

        # Write summary file
        summary_file = self.report_dir / 'summary.md'
        with open(summary_file, 'w') as f:
            f.write(summary)

        print(f"✅ Summary markdown generated: {summary_file}")

    def run(self):
        """Run the complete report generation process"""
        print("🚀 Starting comprehensive test report generation...")

        try:
            # Collect all test results
            self.collect_test_results()

            # Calculate metrics
            metrics = self.calculate_overall_metrics()

            # Generate reports
            self.generate_html_report(metrics)
            self.generate_summary_markdown(metrics)

            # Save metrics as JSON
            metrics_file = self.report_dir / 'test-metrics.json'
            with open(metrics_file, 'w') as f:
                json.dump({
                    'metrics': metrics,
                    'test_results': self.test_results,
                    'coverage_data': self.coverage_data,
                    'timestamp': datetime.now().isoformat()
                }, f, indent=2)

            print("✅ Test report generation completed successfully!")
            print(f"📁 Reports available in: {self.report_dir}")

            return True

        except Exception as e:
            print(f"❌ Error generating test report: {e}")
            return False

if __name__ == "__main__":
    generator = TestReportGenerator()
    success = generator.run()
    sys.exit(0 if success else 1)