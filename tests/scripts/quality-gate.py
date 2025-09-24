#!/usr/bin/env python3
"""
Quality Gate Evaluation Script
Enforces quality standards and compliance requirements
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any

class QualityGate:
    def __init__(self):
        self.thresholds = {
            'minimum_coverage': float(os.getenv('MINIMUM_COVERAGE', 80)),
            'maximum_security_issues': int(os.getenv('MAXIMUM_SECURITY_ISSUES', 0)),
            'minimum_performance_score': float(os.getenv('MINIMUM_PERFORMANCE_SCORE', 85)),
            'required_compliance_score': float(os.getenv('REQUIRED_COMPLIANCE_SCORE', 95)),
            'minimum_ai_accuracy': float(os.getenv('MINIMUM_AI_ACCURACY', 85))
        }

        self.violations = []
        self.warnings = []

    def evaluate_test_coverage(self) -> bool:
        """Evaluate code coverage thresholds"""
        print("📊 Evaluating code coverage...")

        coverage_files = list(Path('.').glob('**/coverage-summary.json'))
        if not coverage_files:
            self.violations.append("No coverage data found")
            return False

        total_line_coverage = 0
        total_function_coverage = 0
        total_branch_coverage = 0
        coverage_count = 0

        for coverage_file in coverage_files:
            try:
                with open(coverage_file) as f:
                    coverage_data = json.load(f)

                if 'total' in coverage_data:
                    total_data = coverage_data['total']

                    lines = total_data.get('lines', {})
                    functions = total_data.get('functions', {})
                    branches = total_data.get('branches', {})

                    if lines.get('total', 0) > 0:
                        line_pct = (lines.get('covered', 0) / lines.get('total', 1)) * 100
                        total_line_coverage += line_pct

                    if functions.get('total', 0) > 0:
                        function_pct = (functions.get('covered', 0) / functions.get('total', 1)) * 100
                        total_function_coverage += function_pct

                    if branches.get('total', 0) > 0:
                        branch_pct = (branches.get('covered', 0) / branches.get('total', 1)) * 100
                        total_branch_coverage += branch_pct

                    coverage_count += 1

            except Exception as e:
                self.warnings.append(f"Error reading coverage file {coverage_file}: {e}")

        if coverage_count == 0:
            self.violations.append("No valid coverage data found")
            return False

        avg_line_coverage = total_line_coverage / coverage_count
        avg_function_coverage = total_function_coverage / coverage_count
        avg_branch_coverage = total_branch_coverage / coverage_count
        overall_coverage = (avg_line_coverage + avg_function_coverage + avg_branch_coverage) / 3

        print(f"  Line coverage: {avg_line_coverage:.2f}%")
        print(f"  Function coverage: {avg_function_coverage:.2f}%")
        print(f"  Branch coverage: {avg_branch_coverage:.2f}%")
        print(f"  Overall coverage: {overall_coverage:.2f}%")

        if overall_coverage < self.thresholds['minimum_coverage']:
            self.violations.append(
                f"Code coverage {overall_coverage:.2f}% is below minimum threshold of {self.thresholds['minimum_coverage']}%"
            )
            return False

        if avg_line_coverage < self.thresholds['minimum_coverage']:
            self.warnings.append(
                f"Line coverage {avg_line_coverage:.2f}% is below threshold"
            )

        return True

    def evaluate_security_issues(self) -> bool:
        """Evaluate security vulnerabilities and issues"""
        print("🔒 Evaluating security issues...")

        security_issues = 0

        # Check security audit results
        security_files = list(Path('.').glob('security-*-report.json'))
        for security_file in security_files:
            try:
                with open(security_file) as f:
                    security_data = json.load(f)

                if isinstance(security_data, list):
                    security_issues += len(security_data)
                elif isinstance(security_data, dict):
                    security_issues += len(security_data.get('vulnerabilities', []))
                    security_issues += len(security_data.get('errors', []))

            except Exception as e:
                self.warnings.append(f"Error reading security file {security_file}: {e}")

        # Check security test results
        security_results_files = list(Path('.').glob('**/security-results.json'))
        for results_file in security_results_files:
            try:
                with open(results_file) as f:
                    results_data = json.load(f)

                security_issues += results_data.get('total_issues', 0)
                security_issues += results_data.get('critical_issues', 0)

            except Exception as e:
                self.warnings.append(f"Error reading security results {results_file}: {e}")

        print(f"  Total security issues found: {security_issues}")

        if security_issues > self.thresholds['maximum_security_issues']:
            self.violations.append(
                f"Found {security_issues} security issues, maximum allowed is {self.thresholds['maximum_security_issues']}"
            )
            return False

        return True

    def evaluate_performance_metrics(self) -> bool:
        """Evaluate performance test results"""
        print("⚡ Evaluating performance metrics...")

        performance_files = list(Path('.').glob('**/performance-metrics.json'))
        if not performance_files:
            self.warnings.append("No performance metrics found")
            return True  # Don't fail if performance tests didn't run

        for perf_file in performance_files:
            try:
                with open(perf_file) as f:
                    perf_data = json.load(f)

                overall_score = perf_data.get('overall_score', 0)

                print(f"  Performance score: {overall_score}")

                if overall_score < self.thresholds['minimum_performance_score']:
                    self.violations.append(
                        f"Performance score {overall_score} is below minimum threshold of {self.thresholds['minimum_performance_score']}"
                    )
                    return False

                # Check specific metrics
                latency_p95 = perf_data.get('latency_p95', 0)
                if latency_p95 > 1000:  # 1 second
                    self.warnings.append(f"P95 latency is {latency_p95}ms (>1s)")

                throughput = perf_data.get('throughput', 0)
                if throughput < 100:  # requests per second
                    self.warnings.append(f"Throughput is {throughput} req/s (<100)")

            except Exception as e:
                self.warnings.append(f"Error reading performance file {perf_file}: {e}")

        return True

    def evaluate_compliance_requirements(self) -> bool:
        """Evaluate compliance with regulations"""
        print("📋 Evaluating compliance requirements...")

        compliance_files = list(Path('.').glob('**/*compliance*.json'))
        if not compliance_files:
            self.warnings.append("No compliance test results found")
            return True  # Don't fail if compliance tests didn't run

        compliance_scores = []

        for compliance_file in compliance_files:
            try:
                with open(compliance_file) as f:
                    compliance_data = json.load(f)

                if isinstance(compliance_data, dict):
                    score = compliance_data.get('compliance_score', 0)
                    regulation = compliance_data.get('regulation', 'unknown')

                    print(f"  {regulation} compliance: {score}%")
                    compliance_scores.append(score)

                    if score < self.thresholds['required_compliance_score']:
                        self.violations.append(
                            f"{regulation} compliance score {score}% is below required {self.thresholds['required_compliance_score']}%"
                        )

            except Exception as e:
                self.warnings.append(f"Error reading compliance file {compliance_file}: {e}")

        # Overall compliance check
        if compliance_scores:
            avg_compliance = sum(compliance_scores) / len(compliance_scores)
            print(f"  Average compliance score: {avg_compliance:.2f}%")

            if avg_compliance < self.thresholds['required_compliance_score']:
                self.violations.append(
                    f"Average compliance score {avg_compliance:.2f}% is below required {self.thresholds['required_compliance_score']}%"
                )
                return False

        return True

    def evaluate_ai_model_performance(self) -> bool:
        """Evaluate AI model accuracy and bias metrics"""
        print("🤖 Evaluating AI model performance...")

        ai_files = list(Path('.').glob('**/model-accuracy.json'))
        if not ai_files:
            self.warnings.append("No AI model accuracy data found")
            return True  # Don't fail if AI tests didn't run

        for ai_file in ai_files:
            try:
                with open(ai_file) as f:
                    ai_data = json.load(f)

                overall_accuracy = ai_data.get('overall_accuracy', 0) * 100  # Convert to percentage

                print(f"  AI model accuracy: {overall_accuracy:.2f}%")

                if overall_accuracy < self.thresholds['minimum_ai_accuracy']:
                    self.violations.append(
                        f"AI model accuracy {overall_accuracy:.2f}% is below minimum threshold of {self.thresholds['minimum_ai_accuracy']}%"
                    )
                    return False

                # Check bias metrics
                bias_score = ai_data.get('bias_score', 0)
                if bias_score > 0.2:  # Maximum 20% bias
                    self.violations.append(f"AI model bias score {bias_score:.2f} is above maximum threshold of 0.2")

                # Check fairness metrics
                fairness_score = ai_data.get('fairness_score', 1.0)
                if fairness_score < 0.8:  # Minimum 80% fairness
                    self.violations.append(f"AI model fairness score {fairness_score:.2f} is below minimum threshold of 0.8")

            except Exception as e:
                self.warnings.append(f"Error reading AI model file {ai_file}: {e}")

        return True

    def evaluate_test_results(self) -> bool:
        """Evaluate overall test results"""
        print("🧪 Evaluating test results...")

        junit_files = list(Path('.').glob('**/junit.xml'))
        if not junit_files:
            self.warnings.append("No JUnit test results found")
            return True

        total_tests = 0
        failed_tests = 0

        for junit_file in junit_files:
            try:
                import xml.etree.ElementTree as ET
                tree = ET.parse(junit_file)
                root = tree.getroot()

                tests = int(root.get('tests', 0))
                failures = int(root.get('failures', 0))
                errors = int(root.get('errors', 0))

                total_tests += tests
                failed_tests += failures + errors

            except Exception as e:
                self.warnings.append(f"Error reading JUnit file {junit_file}: {e}")

        if total_tests > 0:
            pass_rate = ((total_tests - failed_tests) / total_tests) * 100
            print(f"  Test pass rate: {pass_rate:.2f}% ({total_tests - failed_tests}/{total_tests})")

            if pass_rate < 95:  # Minimum 95% pass rate
                self.violations.append(
                    f"Test pass rate {pass_rate:.2f}% is below minimum threshold of 95%"
                )
                return False

        return True

    def generate_report(self) -> Dict[str, Any]:
        """Generate quality gate report"""
        return {
            'quality_gate_passed': len(self.violations) == 0,
            'violations': self.violations,
            'warnings': self.warnings,
            'thresholds': self.thresholds,
            'timestamp': json.dumps(None, default=str)  # Current timestamp
        }

    def run(self) -> bool:
        """Run all quality gate evaluations"""
        print("🚪 Starting Quality Gate Evaluation...")
        print(f"📊 Thresholds: {self.thresholds}")

        evaluations = [
            ("Test Results", self.evaluate_test_results),
            ("Code Coverage", self.evaluate_test_coverage),
            ("Security Issues", self.evaluate_security_issues),
            ("Performance Metrics", self.evaluate_performance_metrics),
            ("Compliance Requirements", self.evaluate_compliance_requirements),
            ("AI Model Performance", self.evaluate_ai_model_performance)
        ]

        all_passed = True

        for name, evaluation_func in evaluations:
            try:
                result = evaluation_func()
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {name}")

                if not result:
                    all_passed = False

            except Exception as e:
                print(f"❌ ERROR {name}: {e}")
                self.violations.append(f"Error evaluating {name}: {e}")
                all_passed = False

        # Generate report
        report = self.generate_report()

        # Save report
        report_file = Path('quality-gate-report.json')
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n📊 Quality Gate Summary:")
        print(f"  Status: {'✅ PASSED' if all_passed else '❌ FAILED'}")
        print(f"  Violations: {len(self.violations)}")
        print(f"  Warnings: {len(self.warnings)}")

        if self.violations:
            print(f"\n❌ Violations:")
            for violation in self.violations:
                print(f"  - {violation}")

        if self.warnings:
            print(f"\n⚠️  Warnings:")
            for warning in self.warnings:
                print(f"  - {warning}")

        # Create failure file if quality gate failed
        if not all_passed:
            failure_file = Path('quality-gate-failed.txt')
            with open(failure_file, 'w') as f:
                f.write("Quality Gate Failed\n\n")
                f.write("Violations:\n")
                for violation in self.violations:
                    f.write(f"- {violation}\n")
                f.write("\nWarnings:\n")
                for warning in self.warnings:
                    f.write(f"- {warning}\n")

        return all_passed

if __name__ == "__main__":
    quality_gate = QualityGate()
    success = quality_gate.run()
    sys.exit(0 if success else 1)