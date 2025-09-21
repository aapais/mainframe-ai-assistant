import { test, expect, Page, BrowserContext } from '@playwright/test';

// E2E Test for Complete Incident Lifecycle
// Tests the full incident management workflow from creation to closure

interface IncidentTestData {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  assignedTeam: string;
  assignee?: string;
}

class IncidentManagementPage {
  constructor(private page: Page) {}

  async navigateToIncidents() {
    await this.page.click('[data-testid="navigation-incidents"]');
    await this.page.waitForSelector('[data-testid="incident-dashboard"]');
  }

  async createIncident(data: IncidentTestData) {
    await this.page.click('[data-testid="create-incident-button"]');
    await this.page.waitForSelector('[data-testid="incident-creation-form"]');

    await this.page.fill('[data-testid="incident-title"]', data.title);
    await this.page.fill('[data-testid="incident-description"]', data.description);
    await this.page.selectOption('[data-testid="incident-priority"]', data.priority);
    await this.page.selectOption('[data-testid="incident-category"]', data.category);
    await this.page.selectOption('[data-testid="incident-team"]', data.assignedTeam);

    if (data.assignee) {
      await this.page.selectOption('[data-testid="incident-assignee"]', data.assignee);
    }

    await this.page.click('[data-testid="create-incident-submit"]');
    await this.page.waitForSelector('[data-testid="incident-created-notification"]');

    // Extract incident ID from notification or URL
    const incidentId = await this.page.getAttribute('[data-testid="incident-id"]', 'data-value');
    return incidentId;
  }

  async searchIncident(incidentId: string) {
    await this.page.fill('[data-testid="incident-search"]', incidentId);
    await this.page.press('[data-testid="incident-search"]', 'Enter');
    await this.page.waitForSelector(`[data-testid="incident-item-${incidentId}"]`);
  }

  async openIncidentDetails(incidentId: string) {
    await this.page.click(`[data-testid="incident-item-${incidentId}"]`);
    await this.page.waitForSelector('[data-testid="incident-details-panel"]');
  }

  async updateIncidentStatus(newStatus: string, comment?: string) {
    await this.page.click('[data-testid="update-status-button"]');
    await this.page.waitForSelector('[data-testid="status-update-modal"]');

    await this.page.selectOption('[data-testid="new-status-select"]', newStatus);

    if (comment) {
      await this.page.fill('[data-testid="status-comment"]', comment);
    }

    await this.page.click('[data-testid="confirm-status-update"]');
    await this.page.waitForSelector('[data-testid="status-updated-notification"]');
  }

  async assignIncident(assignee: string) {
    await this.page.click('[data-testid="assign-incident-button"]');
    await this.page.waitForSelector('[data-testid="assignment-modal"]');

    await this.page.selectOption('[data-testid="assignee-select"]', assignee);
    await this.page.click('[data-testid="confirm-assignment"]');
    await this.page.waitForSelector('[data-testid="incident-assigned-notification"]');
  }

  async addComment(comment: string) {
    await this.page.fill('[data-testid="comment-input"]', comment);
    await this.page.click('[data-testid="add-comment-button"]');
    await this.page.waitForSelector('[data-testid="comment-added-notification"]');
  }

  async resolveIncident(resolutionType: string, resolutionDescription: string) {
    await this.page.click('[data-testid="resolve-incident-button"]');
    await this.page.waitForSelector('[data-testid="resolution-modal"]');

    await this.page.selectOption('[data-testid="resolution-type"]', resolutionType);
    await this.page.fill('[data-testid="resolution-description"]', resolutionDescription);
    await this.page.click('[data-testid="confirm-resolution"]');
    await this.page.waitForSelector('[data-testid="incident-resolved-notification"]');
  }

  async closeIncident() {
    await this.page.click('[data-testid="close-incident-button"]');
    await this.page.waitForSelector('[data-testid="close-confirmation-modal"]');

    await this.page.click('[data-testid="confirm-closure"]');
    await this.page.waitForSelector('[data-testid="incident-closed-notification"]');
  }

  async verifyIncidentStatus(expectedStatus: string) {
    const statusElement = this.page.locator('[data-testid="incident-status-badge"]');
    await expect(statusElement).toHaveText(expectedStatus);
  }

  async verifyIncidentTimeline(expectedEvents: string[]) {
    await this.page.click('[data-testid="view-timeline-button"]');
    await this.page.waitForSelector('[data-testid="incident-timeline"]');

    for (const event of expectedEvents) {
      await expect(this.page.locator(`[data-testid="timeline-event"]:has-text("${event}")`)).toBeVisible();
    }
  }

  async verifyNotificationSent(notificationType: string) {
    await this.page.click('[data-testid="notifications-panel"]');
    await expect(this.page.locator(`[data-testid="notification-${notificationType}"]`)).toBeVisible();
  }

  async filterIncidentsByStatus(status: string) {
    await this.page.selectOption('[data-testid="status-filter"]', status);
    await this.page.waitForLoadState('networkidle');
  }

  async verifyMetricsUpdate(metric: string, expectedValue: string) {
    await this.page.click('[data-testid="dashboard-tab"]');
    const metricElement = this.page.locator(`[data-testid="metric-${metric}"]`);
    await expect(metricElement).toContainText(expectedValue);
  }
}

test.describe('Incident Management E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;
  let incidentPage: IncidentManagementPage;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    incidentPage = new IncidentManagementPage(page);

    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Complete Incident Lifecycle', () => {
    let incidentId: string;

    const testIncident: IncidentTestData = {
      title: 'Database Performance Issue',
      description: 'Slow query responses affecting user experience',
      priority: 'high',
      category: 'Database',
      assignedTeam: 'Database Team',
      assignee: 'john.doe'
    };

    test('should create a new incident successfully', async () => {
      await incidentPage.navigateToIncidents();

      incidentId = await incidentPage.createIncident(testIncident);

      expect(incidentId).toBeTruthy();
      expect(incidentId).toMatch(/^INC-\d+/);

      // Verify incident appears in the list
      await incidentPage.searchIncident(incidentId);
      await expect(page.locator(`[data-testid="incident-item-${incidentId}"]`)).toBeVisible();
    });

    test('should display correct incident details', async () => {
      await incidentPage.openIncidentDetails(incidentId);

      // Verify all details are correctly displayed
      await expect(page.locator('[data-testid="incident-title"]')).toContainText(testIncident.title);
      await expect(page.locator('[data-testid="incident-description"]')).toContainText(testIncident.description);
      await expect(page.locator('[data-testid="incident-priority"]')).toContainText(testIncident.priority);
      await expect(page.locator('[data-testid="incident-category"]')).toContainText(testIncident.category);
      await expect(page.locator('[data-testid="incident-assignee"]')).toContainText(testIncident.assignee!);

      // Verify initial status
      await incidentPage.verifyIncidentStatus('New');
    });

    test('should update incident status to In Progress', async () => {
      await incidentPage.updateIncidentStatus('in_progress', 'Starting investigation of the database issue');

      // Verify status update
      await incidentPage.verifyIncidentStatus('In Progress');

      // Verify comment was added
      await expect(page.locator('[data-testid="latest-comment"]')).toContainText('Starting investigation');

      // Verify timeline event
      await incidentPage.verifyIncidentTimeline([
        'Incident Created',
        'Status changed to In Progress'
      ]);
    });

    test('should add comments and updates during investigation', async () => {
      await incidentPage.addComment('Identified slow query in user authentication module');
      await incidentPage.addComment('Working with database admin to optimize indexes');

      // Verify comments appear in chronological order
      const comments = page.locator('[data-testid="comment-item"]');
      await expect(comments).toHaveCount(3); // Initial status comment + 2 new comments
    });

    test('should handle incident escalation if needed', async () => {
      // Simulate escalation by updating priority
      await page.click('[data-testid="escalate-incident-button"]');
      await page.waitForSelector('[data-testid="escalation-modal"]');

      await page.selectOption('[data-testid="new-priority"]', 'critical');
      await page.fill('[data-testid="escalation-reason"]', 'Issue affects multiple systems');
      await page.click('[data-testid="confirm-escalation"]');

      // Verify escalation
      await expect(page.locator('[data-testid="incident-priority"]')).toContainText('critical');
      await incidentPage.verifyNotificationSent('escalation');
    });

    test('should resolve the incident with solution details', async () => {
      await incidentPage.resolveIncident(
        'fixed',
        'Optimized database indexes and updated query performance. Issue resolved.'
      );

      // Verify resolution
      await incidentPage.verifyIncidentStatus('Resolved');

      // Verify resolution details are displayed
      await expect(page.locator('[data-testid="resolution-type"]')).toContainText('Fixed');
      await expect(page.locator('[data-testid="resolution-description"]'))
        .toContainText('Optimized database indexes');

      // Verify timeline includes resolution
      await incidentPage.verifyIncidentTimeline([
        'Incident Created',
        'Status changed to In Progress',
        'Priority escalated to Critical',
        'Incident Resolved'
      ]);
    });

    test('should verify SLA compliance and metrics', async () => {
      // Check that resolution time is recorded
      await expect(page.locator('[data-testid="resolution-time"]')).toBeVisible();

      // Verify SLA status
      const slaStatus = page.locator('[data-testid="sla-status"]');
      await expect(slaStatus).toBeVisible();

      // Navigate to dashboard to check metrics update
      await incidentPage.verifyMetricsUpdate('resolved-incidents', '1');
    });

    test('should close the incident after verification', async () => {
      await incidentPage.closeIncident();

      // Verify closure
      await incidentPage.verifyIncidentStatus('Closed');

      // Verify closure timestamp
      await expect(page.locator('[data-testid="closed-at"]')).toBeVisible();

      // Verify final timeline
      await incidentPage.verifyIncidentTimeline([
        'Incident Created',
        'Status changed to In Progress',
        'Priority escalated to Critical',
        'Incident Resolved',
        'Incident Closed'
      ]);
    });

    test('should verify incident appears in reports and analytics', async () => {
      await page.click('[data-testid="reports-tab"]');

      // Check incident appears in recent resolutions
      await expect(page.locator(`[data-testid="resolved-incident-${incidentId}"]`)).toBeVisible();

      // Check metrics are updated
      await expect(page.locator('[data-testid="total-incidents-metric"]')).toContainText('1');
      await expect(page.locator('[data-testid="resolved-incidents-metric"]')).toContainText('1');
    });
  });

  test.describe('Incident Queue Management', () => {
    test('should filter incidents by status', async () => {
      await incidentPage.navigateToIncidents();

      // Create multiple test incidents with different statuses
      const incidents = [
        { ...testIncident, title: 'Active Incident 1', priority: 'medium' as const },
        { ...testIncident, title: 'Active Incident 2', priority: 'low' as const }
      ];

      for (const incident of incidents) {
        await incidentPage.createIncident(incident);
      }

      // Filter by active status
      await incidentPage.filterIncidentsByStatus('active');

      // Verify only active incidents are shown
      const activeIncidents = page.locator('[data-testid^="incident-item-"]');
      await expect(activeIncidents).toHaveCount(2);
    });

    test('should sort incidents by priority', async () => {
      await page.click('[data-testid="sort-by-priority"]');

      // Verify incidents are sorted by priority (critical first)
      const firstIncident = page.locator('[data-testid^="incident-item-"]').first();
      await expect(firstIncident.locator('[data-testid="priority-badge"]')).toContainText('critical');
    });

    test('should search incidents by title and description', async () => {
      await page.fill('[data-testid="incident-search"]', 'database');
      await page.press('[data-testid="incident-search"]', 'Enter');

      // Verify search results contain database-related incidents
      const searchResults = page.locator('[data-testid^="incident-item-"]');
      await expect(searchResults.first()).toContainText('Database');
    });
  });

  test.describe('Team Collaboration Features', () => {
    let collaborationIncidentId: string;

    test('should create incident for team collaboration testing', async () => {
      await incidentPage.navigateToIncidents();

      collaborationIncidentId = await incidentPage.createIncident({
        title: 'Multi-team Network Issue',
        description: 'Network connectivity issues affecting multiple services',
        priority: 'high',
        category: 'Network',
        assignedTeam: 'Infrastructure'
      });
    });

    test('should reassign incident to different team member', async () => {
      await incidentPage.openIncidentDetails(collaborationIncidentId);

      await incidentPage.assignIncident('jane.smith');

      // Verify reassignment
      await expect(page.locator('[data-testid="incident-assignee"]')).toContainText('jane.smith');

      // Verify notification sent to new assignee
      await incidentPage.verifyNotificationSent('assignment');
    });

    test('should add multiple stakeholders to incident', async () => {
      await page.click('[data-testid="add-stakeholder-button"]');
      await page.selectOption('[data-testid="stakeholder-select"]', 'bob.johnson');
      await page.click('[data-testid="confirm-add-stakeholder"]');

      // Verify stakeholder added
      await expect(page.locator('[data-testid="stakeholders-list"]')).toContainText('bob.johnson');
    });

    test('should coordinate with multiple teams through comments', async () => {
      await incidentPage.addComment('@database-team: Please check if database connections are affected');
      await incidentPage.addComment('@network-team: Need assistance with routing table analysis');

      // Verify team mentions are highlighted
      await expect(page.locator('[data-testid="team-mention"]')).toHaveCount(2);

      // Verify notifications sent to mentioned teams
      await incidentPage.verifyNotificationSent('mention');
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle creation of multiple incidents efficiently', async () => {
      await incidentPage.navigateToIncidents();

      const startTime = Date.now();

      // Create 10 incidents rapidly
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        incidentPage.createIncident({
          title: `Load Test Incident ${i + 1}`,
          description: `Performance test incident number ${i + 1}`,
          priority: 'medium',
          category: 'Testing',
          assignedTeam: 'QA'
        })
      );

      await Promise.all(createPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);

      // Verify all incidents were created
      await page.reload();
      await page.fill('[data-testid="incident-search"]', 'Load Test');
      await page.press('[data-testid="incident-search"]', 'Enter');

      const loadTestIncidents = page.locator('[data-testid^="incident-item-"]');
      await expect(loadTestIncidents).toHaveCount(10);
    });

    test('should maintain responsiveness with large incident list', async () => {
      // Navigate to incidents list with many items
      await incidentPage.navigateToIncidents();

      // Measure time to load dashboard
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="incident-dashboard"]');
      const loadTime = Date.now() - startTime;

      // Should load within 2 seconds even with many incidents
      expect(loadTime).toBeLessThan(2000);

      // Test scrolling performance
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Should remain responsive during scrolling
      await expect(page.locator('[data-testid="incident-list"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/incidents/**', route => {
        route.abort('failed');
      });

      await incidentPage.navigateToIncidents();

      try {
        await incidentPage.createIncident({
          title: 'Network Error Test',
          description: 'Test incident during network failure',
          priority: 'medium',
          category: 'Test',
          assignedTeam: 'QA'
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify error message is displayed
      await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-notification"]'))
        .toContainText('Unable to create incident');

      // Remove network failure simulation
      await page.unroute('**/api/incidents/**');
    });

    test('should validate form inputs properly', async () => {
      await incidentPage.navigateToIncidents();

      await page.click('[data-testid="create-incident-button"]');

      // Try to submit empty form
      await page.click('[data-testid="create-incident-submit"]');

      // Verify validation errors
      await expect(page.locator('[data-testid="title-error"]')).toContainText('Title is required');
      await expect(page.locator('[data-testid="description-error"]')).toContainText('Description is required');
    });

    test('should handle concurrent status updates', async () => {
      // Create incident for concurrent update testing
      const concurrentTestId = await incidentPage.createIncident({
        title: 'Concurrent Update Test',
        description: 'Testing concurrent status updates',
        priority: 'medium',
        category: 'Test',
        assignedTeam: 'QA'
      });

      await incidentPage.openIncidentDetails(concurrentTestId);

      // Simulate concurrent updates by opening multiple tabs
      const newPage = await context.newPage();
      const secondIncidentPage = new IncidentManagementPage(newPage);

      await newPage.goto('http://localhost:3000');
      await secondIncidentPage.navigateToIncidents();
      await secondIncidentPage.openIncidentDetails(concurrentTestId);

      // Update status from first tab
      await incidentPage.updateIncidentStatus('in_progress', 'First update');

      // Try to update from second tab
      await secondIncidentPage.updateIncidentStatus('blocked', 'Second update');

      // Verify conflict handling
      await expect(newPage.locator('[data-testid="conflict-warning"]'))
        .toContainText('Incident has been updated by another user');

      await newPage.close();
    });
  });

  test.describe('Accessibility Testing', () => {
    test('should be keyboard navigable', async () => {
      await incidentPage.navigateToIncidents();

      // Test keyboard navigation through incident list
      await page.press('body', 'Tab');
      await page.press('body', 'Tab');
      await page.press('body', 'Enter'); // Should open first incident

      await expect(page.locator('[data-testid="incident-details-panel"]')).toBeVisible();

      // Test keyboard navigation in forms
      await page.press('body', 'Tab');
      await page.press('body', 'Space'); // Should trigger action button

      // Verify keyboard accessibility
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should have proper ARIA labels and screen reader support', async () => {
      await incidentPage.navigateToIncidents();

      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="incident-list"]')).toHaveAttribute('role', 'list');
      await expect(page.locator('[data-testid="create-incident-button"]'))
        .toHaveAttribute('aria-label', 'Create new incident');

      // Check for screen reader announcements
      await page.click('[data-testid="create-incident-button"]');
      await expect(page.locator('[aria-live="polite"]')).toContainText('Create incident form opened');
    });
  });
});