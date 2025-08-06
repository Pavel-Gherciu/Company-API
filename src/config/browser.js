const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const BROWSER_CONFIG = {
  headless: 'new',
  ignoreHTTPSErrors: true,
  args: [
    '--no-sandbox', 
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--disable-field-trial-config',
    '--disable-client-side-phishing-detection',
    '--disable-blink-features=AutomationControlled',
  ]
};

const TIMEOUTS = {
  navigation: 30000,
  contactPage: 20000
};

async function launchBrowser() {
  return await puppeteer.launch(BROWSER_CONFIG);
}

async function createOptimizedPage(browser) {
  const page = await browser.newPage();
  
  // block unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'image' || resourceType === 'media') {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  await page.setDefaultNavigationTimeout(TIMEOUTS.navigation);
  
  return page;
}

async function closePage(page) {
  if (page) {
    try {
      await page.close();
    } catch (closeError) {
      console.warn(`Warning: Error closing page: ${closeError.message}`);
    }
  }
}

module.exports = {
  launchBrowser,
  createOptimizedPage,
  closePage,
  TIMEOUTS
};
