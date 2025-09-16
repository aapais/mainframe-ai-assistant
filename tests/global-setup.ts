import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Responsive Test Suite Global Setup');
  
  // Create test result directories
  const testResultDirs = [
    'test-results/responsive-html-report',
    'test-results/responsive-output',
    'test-results/visual-baselines',
    'test-results/performance-reports',
    'test-results/accessibility-reports',
  ];
  
  testResultDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
  
  // Setup browser for pre-test checks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Check if the development server is responding
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
    console.log(`🔍 Checking if server is available at ${baseURL}`);
    
    const response = await page.goto(baseURL, { waitUntil: 'networkidle' });
    
    if (!response || response.status() !== 200) {
      throw new Error(`Server not responding correctly. Status: ${response?.status()}`);
    }
    
    console.log('✅ Server is responding correctly');
    
    // Check for essential elements
    const essentialSelectors = [
      'main, [role="main"]',
      'nav, [role="navigation"]',
      'header, [role="banner"]',
    ];
    
    for (const selector of essentialSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        console.log(`✅ Found essential element: ${selector}`);
      } else {
        console.warn(`⚠️  Missing essential element: ${selector}`);
      }
    }
    
    // Create baseline screenshots if they don't exist
    const baselineDir = 'test-results/visual-baselines/baseline';
    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
      
      const viewports = [
        { width: 375, height: 667, name: 'mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1366, height: 768, name: 'desktop' },
      ];
      
      console.log('📸 Creating baseline screenshots...');
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForLoadState('networkidle');
        
        const screenshotPath = path.join(baselineDir, `homepage-${viewport.name}.png`);
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true,
          animations: 'disabled'
        });
        
        console.log(`📸 Created baseline: homepage-${viewport.name}.png`);
      }
    }
    
    // Setup performance monitoring
    console.log('⚡ Setting up performance monitoring');
    
    await page.evaluate(() => {
      // Add performance tracking script
      const script = document.createElement('script');
      script.textContent = `
        window.performanceData = {
          startTime: performance.now(),
          marks: [],
          measures: []
        };
        
        // Custom performance marking
        window.markPerformance = function(name) {
          performance.mark(name);
          window.performanceData.marks.push({
            name: name,
            time: performance.now()
          });
        };
        
        // Mark initial load
        window.markPerformance('global-setup-complete');
      `;
      document.head.appendChild(script);
    });
    
    console.log('✅ Performance monitoring setup complete');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  // Setup test configuration
  const testConfig = {
    startTime: new Date().toISOString(),
    baseURL: config.projects[0].use?.baseURL || 'http://localhost:3000',
    projects: config.projects.map(p => p.name),
    testEnvironment: {
      ci: !!process.env.CI,
      node: process.version,
      platform: process.platform
    }
  };
  
  // Save test configuration
  const configPath = 'test-results/test-config.json';
  fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
  console.log(`💾 Test configuration saved to ${configPath}`);
  
  console.log('🎉 Global setup completed successfully');
  console.log(`📊 Running ${config.projects.length} test projects`);
  console.log('🔄 Starting responsive test execution...');
}

export default globalSetup;
