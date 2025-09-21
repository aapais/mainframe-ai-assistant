// Jest setup para testes de interface de pesquisa

// Configurar timeouts globais
jest.setTimeout(60000);

// Configurações de console
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filtrar erros conhecidos do Puppeteer/Chrome
  const errorMessage = args.join(' ');

  const ignoredErrors = [
    'Download the React DevTools',
    'Warning: ReactDOM.render is deprecated',
    'Failed to load resource',
    'net::ERR_INTERNET_DISCONNECTED'
  ];

  const shouldIgnore = ignoredErrors.some(ignored =>
    errorMessage.includes(ignored)
  );

  if (!shouldIgnore) {
    originalConsoleError.apply(console, args);
  }
};

// Global test helpers
global.waitForElement = async (page, selector, timeout = 5000) => {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    return false;
  }
};

global.takeScreenshot = async (page, name) => {
  const screenshotsDir = require('path').join(__dirname, 'screenshots');
  const fs = require('fs');

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const filename = `${timestamp}-${name}.png`;

  await page.screenshot({
    path: require('path').join(screenshotsDir, filename),
    fullPage: true
  });

  return filename;
};

global.checkForOverlaps = async (page) => {
  return await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('.dropdown, .menu, .popover, [role="menu"]'));
    const overlaps = [];

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const rect1 = elements[i].getBoundingClientRect();
        const rect2 = elements[j].getBoundingClientRect();

        // Verificar se há sobreposição
        const overlap = !(
          rect1.right < rect2.left ||
          rect2.right < rect1.left ||
          rect1.bottom < rect2.top ||
          rect2.bottom < rect1.top
        );

        if (overlap && rect1.width > 0 && rect1.height > 0 && rect2.width > 0 && rect2.height > 0) {
          overlaps.push({
            element1: {
              className: elements[i].className,
              rect: rect1,
              zIndex: window.getComputedStyle(elements[i]).zIndex
            },
            element2: {
              className: elements[j].className,
              rect: rect2,
              zIndex: window.getComputedStyle(elements[j]).zIndex
            }
          });
        }
      }
    }

    return overlaps;
  });
};

console.log('🧪 Jest setup carregado para testes da interface de pesquisa');