const puppeteer = require('puppeteer');
const path = require('path');

async function takeScreenshot() {
  let browser;
  try {
    console.log('🚀 Iniciando Puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport for desktop
    await page.setViewport({ width: 1280, height: 720 });

    console.log('📱 Navegando para http://localhost:3001...');
    await page.goto('http://localhost:3001', {
      waitUntil: 'networkidle0',
      timeout: 10000
    });

    // Wait a bit for any animations/loading
    await page.waitForTimeout(2000);

    // Take screenshot of homepage
    console.log('📸 Capturando screenshot da homepage...');
    await page.screenshot({
      path: './screenshots/homepage.png',
      fullPage: true
    });

    // Try to click on Incidents button if it exists
    try {
      const incidentsButton = await page.$('button:has-text("Incidents"), a:has-text("Incidents"), *[data-testid*="incident"]');
      if (incidentsButton) {
        console.log('🎯 Clicando no botão de Incidentes...');
        await incidentsButton.click();
        await page.waitForTimeout(2000);

        console.log('📸 Capturando screenshot da página de incidentes...');
        await page.screenshot({
          path: './screenshots/incidents-page.png',
          fullPage: true
        });
      } else {
        console.log('⚠️ Botão de Incidentes não encontrado');
      }
    } catch (e) {
      console.log('⚠️ Erro ao tentar navegar para incidentes:', e.message);
    }

    console.log('✅ Screenshots capturados com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao capturar screenshots:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Create screenshots directory
require('fs').mkdirSync('./screenshots', { recursive: true });

takeScreenshot();