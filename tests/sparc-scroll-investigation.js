/**
 * SPARC Specification: Dashboard Scroll Investigation
 * Puppeteer test to simulate navigation flow and capture scroll behavior
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function investigateDashboardScrollIssue() {
  let browser;
  const findings = {
    initialLoad: {},
    afterNavigation: {},
    cssProperties: {},
    jsErrors: [],
    domChanges: [],
    timestamp: new Date().toISOString()
  };

  try {
    console.log('🔍 Starting SPARC Specification: Dashboard Scroll Investigation');

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });

    const page = await browser.newPage();

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        findings.jsErrors.push({
          message: msg.text(),
          timestamp: Date.now()
        });
      }
    });

    // Step 1: Load Dashboard initially
    console.log('📊 Loading Dashboard initially...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);

    // Check initial scroll properties
    findings.initialLoad = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;

      return {
        bodyOverflow: getComputedStyle(body).overflow,
        bodyOverflowY: getComputedStyle(body).overflowY,
        bodyOverflowX: getComputedStyle(body).overflowX,
        htmlOverflow: getComputedStyle(html).overflow,
        htmlOverflowY: getComputedStyle(html).overflowY,
        htmlOverflowX: getComputedStyle(html).overflowX,
        bodyHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        scrollable: body.scrollHeight > body.clientHeight,
        hasScrollbar: window.innerHeight < document.body.scrollHeight,
        scrollTop: document.documentElement.scrollTop || document.body.scrollTop
      };
    });

    console.log('✅ Initial Dashboard scroll properties:', findings.initialLoad);

    // Step 2: Navigate to Incidents
    console.log('🚨 Navigating to Incidents page...');
    await page.click('button[aria-label="View incidents list"]');
    await page.waitForTimeout(2000);

    // Step 3: Navigate back to Dashboard
    console.log('📊 Navigating back to Dashboard...');
    await page.click('button[aria-label="View dashboard overview"]');
    await page.waitForTimeout(2000);

    // Check scroll properties after navigation
    findings.afterNavigation = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;

      return {
        bodyOverflow: getComputedStyle(body).overflow,
        bodyOverflowY: getComputedStyle(body).overflowY,
        bodyOverflowX: getComputedStyle(body).overflowX,
        htmlOverflow: getComputedStyle(html).overflow,
        htmlOverflowY: getComputedStyle(html).overflowY,
        htmlOverflowX: getComputedStyle(html).overflowX,
        bodyHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        scrollable: body.scrollHeight > body.clientHeight,
        hasScrollbar: window.innerHeight < document.body.scrollHeight,
        scrollTop: document.documentElement.scrollTop || document.body.scrollTop
      };
    });

    console.log('⚠️ After navigation scroll properties:', findings.afterNavigation);

    // Check for specific CSS changes
    findings.cssProperties = await page.evaluate(() => {
      const mainContainer = document.querySelector('.min-h-screen') || document.querySelector('main') || document.body;
      const appRoot = document.querySelector('#root') || document.querySelector('.App');

      const getElementStyles = (element, selector) => {
        if (!element) return null;
        const styles = getComputedStyle(element);
        return {
          selector,
          overflow: styles.overflow,
          overflowY: styles.overflowY,
          overflowX: styles.overflowX,
          height: styles.height,
          minHeight: styles.minHeight,
          maxHeight: styles.maxHeight,
          position: styles.position,
          display: styles.display,
          flexDirection: styles.flexDirection,
          className: element.className
        };
      };

      return {
        body: getElementStyles(document.body, 'body'),
        html: getElementStyles(document.documentElement, 'html'),
        root: getElementStyles(appRoot, '#root or .App'),
        mainContainer: getElementStyles(mainContainer, '.min-h-screen or main'),
        allScrollableElements: Array.from(document.querySelectorAll('*')).filter(el => {
          const styles = getComputedStyle(el);
          return styles.overflowY === 'scroll' || styles.overflowY === 'auto' ||
                 styles.overflow === 'scroll' || styles.overflow === 'auto';
        }).map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          overflow: getComputedStyle(el).overflow,
          overflowY: getComputedStyle(el).overflowY
        }))
      };
    });

    // Compare findings
    const scrollBehaviorChanged = JSON.stringify(findings.initialLoad) !== JSON.stringify(findings.afterNavigation);

    findings.analysis = {
      scrollBehaviorChanged,
      potentialIssues: [],
      recommendations: []
    };

    if (scrollBehaviorChanged) {
      findings.analysis.potentialIssues.push('Scroll properties differ between initial load and after navigation');

      if (findings.initialLoad.scrollable && !findings.afterNavigation.scrollable) {
        findings.analysis.potentialIssues.push('Content became non-scrollable after navigation');
      }

      if (findings.initialLoad.hasScrollbar && !findings.afterNavigation.hasScrollbar) {
        findings.analysis.potentialIssues.push('Scrollbar disappeared after navigation');
      }
    }

    // Take screenshots for visual comparison
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/dashboard-after-navigation.png',
      fullPage: true
    });

    console.log('📸 Screenshot saved: dashboard-after-navigation.png');

  } catch (error) {
    console.error('❌ Error during investigation:', error);
    findings.error = error.message;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return findings;
}

// Run the investigation
investigateDashboardScrollIssue().then(findings => {
  console.log('\n📋 SPARC SPECIFICATION FINDINGS:');
  console.log('================================');
  console.log('Initial Load Scroll Properties:', findings.initialLoad);
  console.log('After Navigation Scroll Properties:', findings.afterNavigation);
  console.log('CSS Analysis:', findings.cssProperties);
  console.log('JavaScript Errors:', findings.jsErrors);
  console.log('Analysis:', findings.analysis);

  // Save detailed findings
  fs.writeFileSync(
    '/mnt/c/mainframe-ai-assistant/tests/scroll-investigation-findings.json',
    JSON.stringify(findings, null, 2)
  );

  console.log('\n💾 Findings saved to: tests/scroll-investigation-findings.json');
}).catch(console.error);