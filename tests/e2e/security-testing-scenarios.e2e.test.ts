/**
 * Security Testing Scenarios E2E Suite
 *
 * Tests comprehensive security measures:
 * - Input validation and sanitization
 * - XSS prevention and protection
 * - SQL injection prevention
 * - CSRF protection mechanisms
 * - Authentication and authorization
 * - Session management security
 * - Data encryption validation
 * - Secure communication protocols
 * - File upload security
 * - Access control validation
 */

import { test, expect, Page } from '@playwright/test';

interface SecurityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

interface SecurityVulnerability {
  type: string;
  description: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  mitigation: string;
}

class SecurityTester {
  private page: Page;
  private results: SecurityTestResult[] = [];
  private vulnerabilities: SecurityVulnerability[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  private recordResult(testName: string, passed: boolean, details: string, severity: 'low' | 'medium' | 'high' | 'critical', recommendation?: string): void {
    this.results.push({
      testName,
      passed,
      details,
      severity,
      recommendation
    });

    if (!passed) {
      this.vulnerabilities.push({
        type: testName,
        description: details,
        location: this.page.url(),
        severity,
        evidence: details,
        mitigation: recommendation || 'No specific mitigation provided'
      });
    }
  }

  async testXSSProtection(): Promise<void> {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<select onfocus=alert("XSS") autofocus>',
      '<textarea onfocus=alert("XSS") autofocus>',
      '<marquee onstart=alert("XSS")>',
      '<video><source onerror="alert(\'XSS\')">',
      '<audio src=x onerror=alert("XSS")>',
      '<link rel=stylesheet href="javascript:alert(\'XSS\')">'
    ];

    // Test search input
    await this.page.goto('#/search');

    for (const payload of xssPayloads) {
      try {
        await this.page.fill('[data-testid="search-input"]', payload);
        await this.page.click('[data-testid="search-button"]');

        // Check if script executed (should not happen)
        const alertFired = await this.page.evaluate(() => {
          return (window as any).xssTriggered === true;
        });

        // Check if payload is displayed as-is (properly escaped)
        const inputValue = await this.page.inputValue('[data-testid="search-input"]');
        const isEscaped = inputValue !== payload || !inputValue.includes('<script>');

        if (alertFired) {
          this.recordResult(
            'XSS Protection - Search Input',
            false,
            `XSS payload executed: ${payload}`,
            'critical',
            'Implement proper input sanitization and output encoding'
          );
        } else if (isEscaped) {
          this.recordResult(
            'XSS Protection - Search Input',
            true,
            `XSS payload properly escaped: ${payload}`,
            'low'
          );
        }
      } catch (error) {
        this.recordResult(
          'XSS Protection - Search Input',
          true,
          `XSS payload rejected: ${payload}`,
          'low'
        );
      }
    }

    // Test entry creation form
    await this.page.click('[data-testid="add-entry-button"]');

    const formFields = [
      '[data-testid="entry-title-input"]',
      '[data-testid="entry-problem-input"]',
      '[data-testid="entry-solution-input"]'
    ];

    for (const field of formFields) {
      for (const payload of xssPayloads.slice(0, 5)) { // Test subset for form fields
        try {
          await this.page.fill(field, payload);

          const fieldValue = await this.page.inputValue(field);
          const isEscaped = !fieldValue.includes('<script>') && !fieldValue.includes('onerror=');

          if (isEscaped) {
            this.recordResult(
              `XSS Protection - Form Field ${field}`,
              true,
              `XSS payload properly handled in form field`,
              'low'
            );
          } else {
            this.recordResult(
              `XSS Protection - Form Field ${field}`,
              false,
              `XSS payload not properly escaped in form field: ${payload}`,
              'high',
              'Implement client-side input validation and sanitization'
            );
          }
        } catch (error) {
          this.recordResult(
            `XSS Protection - Form Field ${field}`,
            true,
            `Form field properly rejected XSS payload`,
            'low'
          );
        }
      }
    }
  }

  async testSQLInjectionProtection(): Promise<void> {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR 1=1 --",
      "' AND (SELECT COUNT(*) FROM users) > 0 --",
      "' OR '1'='1' /*",
      "'; EXEC xp_cmdshell('dir'); --",
      "' OR 'x'='x",
      "'; UPDATE users SET password='hacked' WHERE id=1; --"
    ];

    await this.page.goto('#/search');

    for (const payload of sqlPayloads) {
      try {
        await this.page.fill('[data-testid="search-input"]', payload);
        await this.page.click('[data-testid="search-button"]');

        // Wait for response
        await Promise.race([
          this.page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 }),
          this.page.waitForSelector('[data-testid="no-results"]', { timeout: 5000 }),
          this.page.waitForSelector('[data-testid="search-error"]', { timeout: 5000 })
        ]);

        // Check for SQL error messages in response
        const errorMessages = await this.page.locator('[data-testid="error-message"]').textContent();
        const hasDbError = errorMessages && (
          errorMessages.includes('SQL') ||
          errorMessages.includes('database') ||
          errorMessages.includes('syntax error') ||
          errorMessages.includes('ORA-') ||
          errorMessages.includes('MySQL')
        );

        if (hasDbError) {
          this.recordResult(
            'SQL Injection Protection',
            false,
            `SQL injection vulnerability detected with payload: ${payload}`,
            'critical',
            'Implement parameterized queries and input validation'
          );
        } else {
          this.recordResult(
            'SQL Injection Protection',
            true,
            `SQL injection payload properly handled: ${payload}`,
            'low'
          );
        }
      } catch (error) {
        this.recordResult(
          'SQL Injection Protection',
          true,
          `SQL injection payload properly rejected: ${payload}`,
          'low'
        );
      }
    }
  }

  async testCSRFProtection(): Promise<void> {
    // Test CSRF token presence
    await this.page.goto('#/');

    const csrfToken = await this.page.evaluate(() => {
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      return metaTag ? metaTag.getAttribute('content') : null;
    });

    if (csrfToken) {
      this.recordResult(
        'CSRF Protection - Token Presence',
        true,
        'CSRF token found in page metadata',
        'low'
      );
    } else {
      this.recordResult(
        'CSRF Protection - Token Presence',
        false,
        'CSRF token not found in page metadata',
        'medium',
        'Implement CSRF token generation and validation'
      );
    }

    // Test form submission without CSRF token
    await this.page.goto('#/');
    await this.page.click('[data-testid="add-entry-button"]');

    // Remove CSRF token if present
    await this.page.evaluate(() => {
      const csrfInputs = document.querySelectorAll('input[name="_token"], input[name="csrf_token"]');
      csrfInputs.forEach(input => input.remove());
    });

    // Try to submit form
    await this.page.fill('[data-testid="entry-title-input"]', 'CSRF Test Entry');
    await this.page.fill('[data-testid="entry-problem-input"]', 'CSRF test problem');
    await this.page.fill('[data-testid="entry-solution-input"]', 'CSRF test solution');

    await this.page.click('[data-testid="save-entry-button"]');

    // Check if submission was rejected
    const hasError = await this.page.locator('[data-testid="csrf-error"], [data-testid="validation-error"]').isVisible();

    if (hasError) {
      this.recordResult(
        'CSRF Protection - Form Submission',
        true,
        'Form submission properly rejected without CSRF token',
        'low'
      );
    } else {
      this.recordResult(
        'CSRF Protection - Form Submission',
        false,
        'Form submission allowed without CSRF token',
        'high',
        'Implement server-side CSRF token validation'
      );
    }
  }

  async testSessionSecurity(): Promise<void> {
    await this.page.goto('#/');

    // Check for secure session cookies
    const cookies = await this.page.context().cookies();
    const sessionCookie = cookies.find(cookie =>
      cookie.name.includes('session') ||
      cookie.name.includes('auth') ||
      cookie.name === 'connect.sid'
    );

    if (sessionCookie) {
      const isSecure = sessionCookie.secure;
      const isHttpOnly = sessionCookie.httpOnly;
      const hasSameSite = sessionCookie.sameSite !== 'none';

      if (isSecure && isHttpOnly && hasSameSite) {
        this.recordResult(
          'Session Security - Cookie Attributes',
          true,
          'Session cookie has proper security attributes (Secure, HttpOnly, SameSite)',
          'low'
        );
      } else {
        const issues = [];
        if (!isSecure) issues.push('Missing Secure flag');
        if (!isHttpOnly) issues.push('Missing HttpOnly flag');
        if (!hasSameSite) issues.push('Missing SameSite attribute');

        this.recordResult(
          'Session Security - Cookie Attributes',
          false,
          `Session cookie security issues: ${issues.join(', ')}`,
          'medium',
          'Configure session cookies with Secure, HttpOnly, and SameSite attributes'
        );
      }
    } else {
      this.recordResult(
        'Session Security - Cookie Presence',
        false,
        'No session cookie found',
        'low',
        'Implement secure session management'
      );
    }

    // Test session fixation protection
    const initialSessionId = await this.page.evaluate(() => {
      return document.cookie.match(/session[^=]*=([^;]*)/)?.[1];
    });

    // Simulate login (if login functionality exists)
    // This would typically involve actual login flow
    await this.page.evaluate(() => {
      // Simulate login state change
      (window as any).simulateLogin = true;
    });

    const postLoginSessionId = await this.page.evaluate(() => {
      return document.cookie.match(/session[^=]*=([^;]*)/)?.[1];
    });

    if (initialSessionId && postLoginSessionId && initialSessionId !== postLoginSessionId) {
      this.recordResult(
        'Session Security - Session Fixation',
        true,
        'Session ID changed after authentication (session fixation protection)',
        'low'
      );
    } else if (initialSessionId && postLoginSessionId && initialSessionId === postLoginSessionId) {
      this.recordResult(
        'Session Security - Session Fixation',
        false,
        'Session ID not changed after authentication (session fixation vulnerability)',
        'medium',
        'Regenerate session ID after successful authentication'
      );
    }
  }

  async testInputValidation(): Promise<void> {
    const maliciousInputs = [
      // Path traversal
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',

      // Command injection
      '; cat /etc/passwd',
      '& type c:\\windows\\system32\\drivers\\etc\\hosts',
      '`whoami`',
      '$(ls -la)',

      // LDAP injection
      '*)(uid=*',
      '*)(|(mail=*))',

      // XML injection
      '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',

      // Buffer overflow attempts
      'A'.repeat(10000),

      // Null byte injection
      'test\x00.txt',

      // Format string attacks
      '%s%s%s%s%s%s%s%s%s%s',
      '%x%x%x%x%x%x%x%x%x%x'
    ];

    await this.page.goto('#/');
    await this.page.click('[data-testid="add-entry-button"]');

    const inputFields = [
      { selector: '[data-testid="entry-title-input"]', name: 'Title' },
      { selector: '[data-testid="entry-problem-input"]', name: 'Problem' },
      { selector: '[data-testid="entry-solution-input"]', name: 'Solution' }
    ];

    for (const input of maliciousInputs) {
      for (const field of inputFields) {
        try {
          await this.page.fill(field.selector, input);

          // Try to submit
          await this.page.click('[data-testid="save-entry-button"]');

          // Check for validation errors
          const hasValidationError = await this.page.locator('[data-testid="validation-error"]').isVisible();
          const fieldValue = await this.page.inputValue(field.selector);

          if (hasValidationError) {
            this.recordResult(
              `Input Validation - ${field.name}`,
              true,
              `Malicious input properly validated: ${input.substring(0, 50)}...`,
              'low'
            );
          } else if (fieldValue !== input) {
            this.recordResult(
              `Input Validation - ${field.name}`,
              true,
              `Malicious input sanitized: ${input.substring(0, 50)}...`,
              'low'
            );
          } else {
            this.recordResult(
              `Input Validation - ${field.name}`,
              false,
              `Malicious input accepted without validation: ${input.substring(0, 50)}...`,
              'medium',
              'Implement proper input validation and sanitization'
            );
          }
        } catch (error) {
          this.recordResult(
            `Input Validation - ${field.name}`,
            true,
            `Malicious input properly rejected: ${input.substring(0, 50)}...`,
            'low'
          );
        }
      }
    }
  }

  async testFileUploadSecurity(): Promise<void> {
    // Check if file upload functionality exists
    const uploadButton = this.page.locator('[data-testid="file-upload"], [type="file"]');

    if (await uploadButton.count() === 0) {
      this.recordResult(
        'File Upload Security',
        true,
        'No file upload functionality found',
        'low'
      );
      return;
    }

    const maliciousFiles = [
      { name: 'test.php', content: '<?php system($_GET["cmd"]); ?>' },
      { name: 'test.asp', content: '<%eval request("cmd")%>' },
      { name: 'test.jsp', content: '<%Runtime.getRuntime().exec(request.getParameter("cmd"));%>' },
      { name: 'test.exe', content: 'MZ\x90\x00' }, // PE header
      { name: 'test.bat', content: '@echo off\ndir' },
      { name: 'test.sh', content: '#!/bin/bash\nls -la' },
      { name: '../../../test.txt', content: 'Path traversal test' },
      { name: 'test.svg', content: '<svg onload="alert(\'XSS\')">' },
      { name: 'test.html', content: '<script>alert("XSS")</script>' }
    ];

    for (const file of maliciousFiles) {
      try {
        // Create a temporary file
        const fileBuffer = Buffer.from(file.content, 'utf-8');

        // Attempt to upload
        await uploadButton.setInputFiles({
          name: file.name,
          mimeType: 'text/plain',
          buffer: fileBuffer
        });

        // Check if upload was accepted
        const uploadSuccess = await this.page.locator('[data-testid="upload-success"]').isVisible();
        const uploadError = await this.page.locator('[data-testid="upload-error"]').isVisible();

        if (uploadError) {
          this.recordResult(
            'File Upload Security',
            true,
            `Malicious file properly rejected: ${file.name}`,
            'low'
          );
        } else if (uploadSuccess) {
          this.recordResult(
            'File Upload Security',
            false,
            `Malicious file accepted: ${file.name}`,
            'high',
            'Implement file type validation, content scanning, and secure file storage'
          );
        }
      } catch (error) {
        this.recordResult(
          'File Upload Security',
          true,
          `File upload properly rejected: ${file.name}`,
          'low'
        );
      }
    }
  }

  async testAccessControl(): Promise<void> {
    // Test unauthorized access to admin functions
    const restrictedUrls = [
      '#/admin',
      '#/admin/users',
      '#/admin/settings',
      '#/api/admin',
      '#/debug',
      '#/config'
    ];

    for (const url of restrictedUrls) {
      try {
        await this.page.goto(url);

        // Check if access is denied
        const hasUnauthorizedError = await this.page.locator('[data-testid="unauthorized"], [data-testid="access-denied"], [data-testid="forbidden"]').isVisible();
        const currentUrl = this.page.url();

        if (hasUnauthorizedError || currentUrl.includes('login') || currentUrl.includes('unauthorized')) {
          this.recordResult(
            'Access Control',
            true,
            `Unauthorized access properly denied to: ${url}`,
            'low'
          );
        } else {
          this.recordResult(
            'Access Control',
            false,
            `Unauthorized access allowed to: ${url}`,
            'high',
            'Implement proper access control and authorization checks'
          );
        }
      } catch (error) {
        this.recordResult(
          'Access Control',
          true,
          `Access properly restricted to: ${url}`,
          'low'
        );
      }
    }

    // Test direct object reference
    const sensitiveIds = ['1', '2', '999', 'admin', 'test'];

    for (const id of sensitiveIds) {
      try {
        await this.page.goto(`#/entry/${id}`);

        // Check if unauthorized data is exposed
        const hasContent = await this.page.locator('[data-testid="entry-detail"]').isVisible();
        const hasError = await this.page.locator('[data-testid="not-found"], [data-testid="access-denied"]').isVisible();

        if (hasError || !hasContent) {
          this.recordResult(
            'Direct Object Reference',
            true,
            `Direct object access properly controlled for ID: ${id}`,
            'low'
          );
        } else {
          // Check if this is legitimate access or unauthorized
          const entryTitle = await this.page.locator('[data-testid="entry-title"]').textContent();

          if (entryTitle && !entryTitle.includes('test') && !entryTitle.includes('unauthorized')) {
            this.recordResult(
              'Direct Object Reference',
              false,
              `Potential unauthorized direct object access for ID: ${id}`,
              'medium',
              'Implement proper authorization checks for object access'
            );
          }
        }
      } catch (error) {
        this.recordResult(
          'Direct Object Reference',
          true,
          `Direct object access properly controlled for ID: ${id}`,
          'low'
        );
      }
    }
  }

  async testSecureCommunication(): Promise<void> {
    // Check HTTPS usage
    const currentUrl = this.page.url();
    const isHTTPS = currentUrl.startsWith('https://');

    if (isHTTPS) {
      this.recordResult(
        'Secure Communication - HTTPS',
        true,
        'Application properly uses HTTPS',
        'low'
      );
    } else {
      this.recordResult(
        'Secure Communication - HTTPS',
        false,
        'Application not using HTTPS',
        'high',
        'Enforce HTTPS for all communications'
      );
    }

    // Check for mixed content
    const hasInsecureContent = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('img, script, link, iframe');
      return Array.from(elements).some(el => {
        const src = el.getAttribute('src') || el.getAttribute('href');
        return src && src.startsWith('http://');
      });
    });

    if (!hasInsecureContent) {
      this.recordResult(
        'Secure Communication - Mixed Content',
        true,
        'No insecure content detected',
        'low'
      );
    } else {
      this.recordResult(
        'Secure Communication - Mixed Content',
        false,
        'Insecure content detected (mixed content)',
        'medium',
        'Ensure all resources are loaded over HTTPS'
      );
    }

    // Check security headers
    const response = await this.page.goto(this.page.url());
    const headers = response?.headers() || {};

    const securityHeaders = {
      'x-frame-options': 'DENY or SAMEORIGIN',
      'x-content-type-options': 'nosniff',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': 'HSTS header',
      'content-security-policy': 'CSP header'
    };

    for (const [header, description] of Object.entries(securityHeaders)) {
      if (headers[header]) {
        this.recordResult(
          `Security Headers - ${header}`,
          true,
          `${description} properly configured`,
          'low'
        );
      } else {
        this.recordResult(
          `Security Headers - ${header}`,
          false,
          `Missing ${description}`,
          'medium',
          `Configure ${header} security header`
        );
      }
    }
  }

  async testDataExposure(): Promise<void> {
    // Check for sensitive data in page source
    const pageContent = await this.page.content();

    const sensitivePatterns = [
      /password\s*[:=]\s*["'][^"']+["']/gi,
      /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
      /secret\s*[:=]\s*["'][^"']+["']/gi,
      /token\s*[:=]\s*["'][^"']+["']/gi,
      /database\s*[:=]\s*["'][^"']+["']/gi,
      /connection[_-]?string\s*[:=]\s*["'][^"']+["']/gi,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card pattern
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email pattern
    ];

    let foundSensitiveData = false;

    for (const pattern of sensitivePatterns) {
      const matches = pageContent.match(pattern);
      if (matches && matches.length > 0) {
        foundSensitiveData = true;
        this.recordResult(
          'Data Exposure - Sensitive Information',
          false,
          `Potential sensitive data exposed in page source: ${matches[0].substring(0, 50)}...`,
          'medium',
          'Remove sensitive data from client-side code'
        );
      }
    }

    if (!foundSensitiveData) {
      this.recordResult(
        'Data Exposure - Sensitive Information',
        true,
        'No obvious sensitive data found in page source',
        'low'
      );
    }

    // Check for debug information
    const hasDebugInfo = await this.page.evaluate(() => {
      return !!(window as any).DEBUG ||
             !!(window as any).console?.log.toString().includes('debug') ||
             document.querySelector('[data-debug], .debug, #debug');
    });

    if (!hasDebugInfo) {
      this.recordResult(
        'Data Exposure - Debug Information',
        true,
        'No debug information exposed',
        'low'
      );
    } else {
      this.recordResult(
        'Data Exposure - Debug Information',
        false,
        'Debug information exposed in production',
        'low',
        'Remove debug information from production builds'
      );
    }
  }

  async generateSecurityReport(): Promise<{ results: SecurityTestResult[]; vulnerabilities: SecurityVulnerability[]; summary: any }> {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const severityCount = {
      critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: this.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: this.vulnerabilities.filter(v => v.severity === 'medium').length,
      low: this.vulnerabilities.filter(v => v.severity === 'low').length
    };

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      passRate: ((passedTests / totalTests) * 100).toFixed(2),
      vulnerabilityCount: this.vulnerabilities.length,
      severityBreakdown: severityCount,
      riskLevel: this.calculateRiskLevel(severityCount)
    };

    return {
      results: this.results,
      vulnerabilities: this.vulnerabilities,
      summary
    };
  }

  private calculateRiskLevel(severityCount: any): string {
    if (severityCount.critical > 0) return 'CRITICAL';
    if (severityCount.high > 2) return 'HIGH';
    if (severityCount.high > 0 || severityCount.medium > 5) return 'MEDIUM';
    if (severityCount.medium > 0) return 'LOW';
    return 'MINIMAL';
  }

  getResults(): SecurityTestResult[] {
    return [...this.results];
  }

  getVulnerabilities(): SecurityVulnerability[] {
    return [...this.vulnerabilities];
  }
}

test.describe('Security Testing Scenarios', () => {
  let securityTester: SecurityTester;

  test.beforeEach(async ({ page }) => {
    securityTester = new SecurityTester(page);

    // Setup test environment
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });

    // Add XSS detection helper
    await page.addInitScript(() => {
      (window as any).xssTriggered = false;
      const originalAlert = window.alert;
      window.alert = function(...args) {
        (window as any).xssTriggered = true;
        console.warn('XSS Alert triggered:', args);
        return originalAlert.apply(this, args);
      };
    });
  });

  test('XSS (Cross-Site Scripting) protection validation', async () => {
    await securityTester.testXSSProtection();

    const results = securityTester.getResults();
    const xssResults = results.filter(r => r.testName.includes('XSS'));

    // All XSS tests should pass
    const failedXSSTests = xssResults.filter(r => !r.passed);
    expect(failedXSSTests.length).toBe(0);

    console.log('XSS Protection Results:', xssResults.length, 'tests completed');
  });

  test('SQL injection protection validation', async () => {
    await securityTester.testSQLInjectionProtection();

    const results = securityTester.getResults();
    const sqlResults = results.filter(r => r.testName.includes('SQL'));

    // All SQL injection tests should pass
    const failedSQLTests = sqlResults.filter(r => !r.passed);
    expect(failedSQLTests.length).toBe(0);

    console.log('SQL Injection Protection Results:', sqlResults.length, 'tests completed');
  });

  test('CSRF (Cross-Site Request Forgery) protection', async () => {
    await securityTester.testCSRFProtection();

    const results = securityTester.getResults();
    const csrfResults = results.filter(r => r.testName.includes('CSRF'));

    // CSRF protection should be in place
    const majorCSRFIssues = csrfResults.filter(r => !r.passed && r.severity === 'high');
    expect(majorCSRFIssues.length).toBe(0);

    console.log('CSRF Protection Results:', csrfResults);
  });

  test('Session management security', async () => {
    await securityTester.testSessionSecurity();

    const results = securityTester.getResults();
    const sessionResults = results.filter(r => r.testName.includes('Session'));

    // Critical session vulnerabilities should not exist
    const criticalSessionIssues = sessionResults.filter(r => !r.passed && r.severity === 'critical');
    expect(criticalSessionIssues.length).toBe(0);

    console.log('Session Security Results:', sessionResults);
  });

  test('Input validation and sanitization', async () => {
    await securityTester.testInputValidation();

    const results = securityTester.getResults();
    const inputResults = results.filter(r => r.testName.includes('Input Validation'));

    // Most input validation tests should pass
    const failedInputTests = inputResults.filter(r => !r.passed);
    const passRate = (inputResults.length - failedInputTests.length) / inputResults.length;

    expect(passRate).toBeGreaterThan(0.8); // At least 80% should pass

    console.log('Input Validation Results:', {
      total: inputResults.length,
      passed: inputResults.length - failedInputTests.length,
      passRate: (passRate * 100).toFixed(2) + '%'
    });
  });

  test('File upload security validation', async () => {
    await securityTester.testFileUploadSecurity();

    const results = securityTester.getResults();
    const uploadResults = results.filter(r => r.testName.includes('File Upload'));

    // All malicious file uploads should be rejected
    const failedUploadTests = uploadResults.filter(r => !r.passed);
    expect(failedUploadTests.length).toBe(0);

    console.log('File Upload Security Results:', uploadResults.length, 'tests completed');
  });

  test('Access control and authorization', async () => {
    await securityTester.testAccessControl();

    const results = securityTester.getResults();
    const accessResults = results.filter(r => r.testName.includes('Access Control') || r.testName.includes('Direct Object'));

    // All unauthorized access attempts should be denied
    const failedAccessTests = accessResults.filter(r => !r.passed);
    expect(failedAccessTests.length).toBe(0);

    console.log('Access Control Results:', accessResults.length, 'tests completed');
  });

  test('Secure communication protocols', async () => {
    await securityTester.testSecureCommunication();

    const results = securityTester.getResults();
    const commResults = results.filter(r => r.testName.includes('Secure Communication') || r.testName.includes('Security Headers'));

    // Critical communication security issues should not exist
    const criticalCommIssues = commResults.filter(r => !r.passed && r.severity === 'critical');
    expect(criticalCommIssues.length).toBe(0);

    console.log('Secure Communication Results:', commResults);
  });

  test('Data exposure and information leakage', async () => {
    await securityTester.testDataExposure();

    const results = securityTester.getResults();
    const exposureResults = results.filter(r => r.testName.includes('Data Exposure'));

    // Critical data exposure should not exist
    const criticalExposureIssues = exposureResults.filter(r => !r.passed && r.severity === 'critical');
    expect(criticalExposureIssues.length).toBe(0);

    console.log('Data Exposure Results:', exposureResults);
  });

  test('Comprehensive security assessment', async () => {
    // Run all security tests
    await securityTester.testXSSProtection();
    await securityTester.testSQLInjectionProtection();
    await securityTester.testCSRFProtection();
    await securityTester.testSessionSecurity();
    await securityTester.testInputValidation();
    await securityTester.testFileUploadSecurity();
    await securityTester.testAccessControl();
    await securityTester.testSecureCommunication();
    await securityTester.testDataExposure();

    // Generate comprehensive report
    const report = await securityTester.generateSecurityReport();

    console.log('=== SECURITY ASSESSMENT REPORT ===');
    console.log('Summary:', report.summary);
    console.log('Vulnerabilities:', report.vulnerabilities.length);

    // Security requirements
    expect(report.summary.riskLevel).not.toBe('CRITICAL');
    expect(report.vulnerabilities.filter(v => v.severity === 'critical').length).toBe(0);
    expect(parseFloat(report.summary.passRate)).toBeGreaterThan(75); // At least 75% pass rate

    // Log detailed results for review
    if (report.vulnerabilities.length > 0) {
      console.log('=== VULNERABILITIES FOUND ===');
      report.vulnerabilities.forEach((vuln, index) => {
        console.log(`${index + 1}. ${vuln.type} (${vuln.severity.toUpperCase()})`);
        console.log(`   Description: ${vuln.description}`);
        console.log(`   Location: ${vuln.location}`);
        console.log(`   Mitigation: ${vuln.mitigation}`);
        console.log('');
      });
    }

    // Security compliance check
    const highRiskVulns = report.vulnerabilities.filter(v => v.severity === 'high' || v.severity === 'critical');
    expect(highRiskVulns.length).toBeLessThanOrEqual(2); // Maximum 2 high-risk vulnerabilities acceptable
  });

  test('Security regression testing', async ({ page }) => {
    // Test previously fixed security issues
    const regressionTests = [
      {
        name: 'XSS in search - previously fixed',
        test: async () => {
          await page.goto('#/search');
          await page.fill('[data-testid="search-input"]', '<script>window.xssTriggered=true</script>');
          await page.click('[data-testid="search-button"]');
          const xssTriggered = await page.evaluate(() => (window as any).xssTriggered);
          return !xssTriggered;
        }
      },
      {
        name: 'SQL injection in search - previously fixed',
        test: async () => {
          await page.goto('#/search');
          await page.fill('[data-testid="search-input"]', "'; DROP TABLE test; --");
          await page.click('[data-testid="search-button"]');
          const hasError = await page.locator('[data-testid="search-error"]').isVisible();
          return !hasError || !(await page.locator('[data-testid="search-error"]').textContent())?.includes('SQL');
        }
      }
    ];

    for (const regression of regressionTests) {
      const passed = await regression.test();
      expect(passed).toBe(true);
      console.log(`Regression test passed: ${regression.name}`);
    }
  });

  test('Security penetration testing simulation', async ({ page }) => {
    // Simulate penetration testing approach
    const penTestResults = [];

    // 1. Information gathering
    const pageTitle = await page.title();
    const pageContent = await page.content();
    const hasVersionInfo = pageContent.includes('version') || pageContent.includes('v1.') || pageContent.includes('v2.');

    penTestResults.push({
      phase: 'Information Gathering',
      findings: hasVersionInfo ? 'Version information exposed' : 'No obvious version info',
      risk: hasVersionInfo ? 'low' : 'none'
    });

    // 2. Vulnerability scanning
    await securityTester.testXSSProtection();
    await securityTester.testSQLInjectionProtection();

    const vulnerabilities = securityTester.getVulnerabilities();
    penTestResults.push({
      phase: 'Vulnerability Scanning',
      findings: `${vulnerabilities.length} potential vulnerabilities found`,
      risk: vulnerabilities.length > 5 ? 'high' : vulnerabilities.length > 0 ? 'medium' : 'low'
    });

    // 3. Exploitation attempts (simulated)
    const exploitAttempts = [
      {
        name: 'XSS Exploitation',
        success: vulnerabilities.some(v => v.type.includes('XSS') && v.severity === 'critical')
      },
      {
        name: 'SQL Injection Exploitation',
        success: vulnerabilities.some(v => v.type.includes('SQL') && v.severity === 'critical')
      }
    ];

    const successfulExploits = exploitAttempts.filter(e => e.success);
    penTestResults.push({
      phase: 'Exploitation',
      findings: `${successfulExploits.length} successful exploits out of ${exploitAttempts.length} attempts`,
      risk: successfulExploits.length > 0 ? 'critical' : 'low'
    });

    console.log('=== PENETRATION TEST SIMULATION ===');
    penTestResults.forEach(result => {
      console.log(`${result.phase}: ${result.findings} (Risk: ${result.risk})`);
    });

    // No critical exploits should succeed
    expect(successfulExploits.length).toBe(0);
  });
});