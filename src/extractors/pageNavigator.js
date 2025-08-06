const { TIMEOUTS } = require('../config/browser');

async function findContactPageUrl(page) {
  return await page.evaluate(() => {
    const contactSelectors = [
    'a[href*="contact"]',
    'a[href*="Contact"]',
    'a[href*="CONTACT"]',
    'a[href*="/contact"]',
    'a[href*="/contact/"]',
    'a[href*="contact.html"]',
    'a[href*="contact.php"]',
    'a[href*="contact-us"]',
    'a[href*="contactus"]',
    'a[href*="reach-us"]',
    'a[href*="get-in-touch"]',
    'a:contains("Contact")',
    'a:contains("Contact Us")',
    'a:contains("Get in Touch")',
    'a:contains("Reach Us")'
  ];

    // contact links with various patterns
    for (const selector of contactSelectors) {
      try {
        const link = document.querySelector(selector);
        if (link && link.href) {
          if (!link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
            return link.href;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // text content as alternative
    const allLinks = document.querySelectorAll('a');

    const contactLinkText = [
      'contact',
      'contact us',
      'get in touch',
      'reach us'
    ];

    for (const link of allLinks) {
      const text = link.textContent.toLowerCase().trim();
      const href = link.href;
      
      if (href && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        for (const contactText of contactLinkText) {
          if (text.includes(contactText)) {
            return href;
          }
        }
      }
    }
    
    return null;
  });
}

async function navigateToUrl(page, url, options = {}) {
  const defaultOptions = {
    waitUntil: 'networkidle0',
    timeout: TIMEOUTS.navigation
  };
  
  const navigationOptions = { ...defaultOptions, ...options };
  await page.goto(url, navigationOptions);
}

async function navigateToContactPage(page) {
  const contactPageUrl = await findContactPageUrl(page);
  
  if (contactPageUrl) {
    console.log(`Found contact page link: ${contactPageUrl}`);
    
    try {
      await navigateToUrl(page, contactPageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.contactPage
      });
      
      return contactPageUrl;
    } catch (error) {
      console.warn(`Warning: Could not navigate to contact page: ${error.message}`);
      return null;
    }
  }
  
  return null;
}

async function tryUrlWithFallback(page, url, processPage) {
  try {
    // first try with the original URL
    await navigateToUrl(page, url);
    return await processPage(page, url);
  } catch (error) {
    // if HTTPS failed and the URL starts with https, try with HTTP
    if (url.startsWith('https://')) {
      const httpUrl = url.replace('https://', 'http://');
      console.log(`HTTPS failed, retrying with HTTP: ${httpUrl}`);
      
      try {
        await navigateToUrl(page, httpUrl);
        const result = await processPage(page, httpUrl);
        // update the URL in the result to reflect the successful HTTP URL
        if (result && typeof result === 'object') {
          result.url = httpUrl;
        }
        return result;
      } catch (httpError) {
        throw new Error(`Both HTTPS and HTTP failed. HTTPS: ${error.message}, HTTP: ${httpError.message}`);
      }
    } else {
      throw error;
    }
  }
}

module.exports = {
  findContactPageUrl,
  navigateToUrl,
  navigateToContactPage,
  tryUrlWithFallback
};
