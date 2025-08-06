const { launchBrowser, createOptimizedPage, closePage } = require('../config/browser');
const { scrapeInfo } = require('../extractors/scraper');
const { navigateToContactPage, tryUrlWithFallback } = require('../extractors/pageNavigator');

class ScraperService {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 15;
    this.browser = null;
    this.errorCounts = new Map();
  }
  async initialize() {
    this.browser = await launchBrowser();
    console.log('Browser launched successfully');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  async processWebsite(url, index, totalCount) {
    console.log(`Starting ${index + 1}/${totalCount}: ${url}`);
    
    const processPage = async (page, currentUrl) => {
      let info = await scrapeInfo(page);
      let visitedContactPage = false;
      let contactPageInfo = null;
      let foundInScript = info.foundInScript;
      
      // if no info found on main page, try to find and navigate to contact page
      if (!info.phone && !info.socialMedia && !info.address) {
        const contactPageUrl = await navigateToContactPage(page);
        
        if (contactPageUrl) {
          visitedContactPage = true;
          
          contactPageInfo = await scrapeInfo(page);
          
          info = {
            phone: contactPageInfo.phone || info.phone,
            socialMedia: contactPageInfo.socialMedia || info.socialMedia,
            address: contactPageInfo.address || info.address,
            foundInScript: foundInScript || contactPageInfo.foundInScript
          };
          
          if (contactPageInfo.phone || contactPageInfo.socialMedia || contactPageInfo.address) {
            console.log(`Found additional info on contact page${contactPageInfo.foundInScript ? ' (from script)' : ''}`);
          }
        }
      }
      
      return { contactInfo: info, visitedContactPage, contactPageInfo, url: currentUrl };
    };

    let page;
    try {
      page = await createOptimizedPage(this.browser);
      
      const result = await tryUrlWithFallback(page, url, processPage);
      
      if (result && result.contactInfo && (result.contactInfo.phone || result.contactInfo.socialMedia || result.contactInfo.address)) {
        console.log(`${index + 1}/${totalCount} Found contact info - Phone: ${result.contactInfo.phone || 'N/A'}, Social: ${result.contactInfo.socialMedia ? 'Yes' : 'N/A'}, Address: ${result.contactInfo.address ? 'Yes' : 'N/A'}${result.visitedContactPage ? ' (visited contact page)' : ''}${result.contactInfo.foundInScript ? ' (from script)' : ''}`);
        
        return {
          url: result.url,
          phone: result.contactInfo.phone,
          socialMedia: result.contactInfo.socialMedia,
          address: result.contactInfo.address,
          visitedContactPage: result.visitedContactPage,
          foundInScript: result.contactInfo.foundInScript,
          contactPageFoundInfo: result.contactPageInfo ? {
            phone: result.contactPageInfo.phone,
            socialMedia: result.contactPageInfo.socialMedia,
            address: result.contactPageInfo.address
          } : null,
          success: true
        };
      } else {
        console.log(`${index + 1}/${totalCount} No contact information found${result && result.visitedContactPage ? ' (even after visiting contact page)' : ''}`);
        
        return {
          url,
          phone: null,
          socialMedia: null,
          address: null,
          visitedContactPage: result ? result.visitedContactPage : false,
          foundInScript: false,
          contactPageFoundInfo: null,
          success: false,
          reason: 'No contact information found'
        };
      }
    } catch (error) {
      console.error(`✗ ${index + 1}/${totalCount} Error: ${error.message}`);
      
      return {
        url,
        phone: null,
        socialMedia: null,
        address: null,
        visitedContactPage: false,
        foundInScript: false,
        contactPageFoundInfo: null,
        success: false,
        reason: error.message
      };
    } finally {
      await closePage(page);
    }
  }

  async processWebsites(sites) {
    if (!this.browser) {
      throw new Error('Scraper service not initialized. Call initialize() first.');
    }

    // pqueue for concurrency
    const { default: PQueue } = await import('p-queue');
    
    const queue = new PQueue({ concurrency: this.concurrency });
    
    const promises = sites.map((url, index) => 
      queue.add(() => this.processWebsite(url, index, sites.length))
    );
    
    console.log(`\nProcessing ${sites.length} websites with concurrency limit of ${this.concurrency}...`);
    
    const results = await Promise.all(promises);
    
    return results;
  }

  displayStatistics(results, startTime) {
    const endTime = Date.now();
    const totalTimeMs = endTime - startTime;
    const totalTimeSeconds = (totalTimeMs / 1000).toFixed(2);
    const totalTimeMinutes = (totalTimeMs / 60000).toFixed(2);
    
    const successCount = results.filter(result => result.success).length;
    const phoneCount = results.filter(result => result.phone).length;
    const socialCount = results.filter(result => result.socialMedia).length;
    const addressCount = results.filter(result => result.address).length;
    const contactPageVisitedCount = results.filter(result => result.visitedContactPage).length;
    const contactPageFoundInfoCount = results.filter(result => result.contactPageFoundInfo && 
      (result.contactPageFoundInfo.phone || result.contactPageFoundInfo.socialMedia || result.contactPageFoundInfo.address)).length;
    const scriptFoundCount = results.filter(result => result.foundInScript).length;
    const successPercentage = (successCount / results.length * 100).toFixed(2);
    
    console.log('\n----- RESULTS -----');
    console.log(`Total execution time: ${totalTimeSeconds} seconds (${totalTimeMinutes} minutes)`);
    console.log(`Total websites processed: ${results.length}`);
    console.log(`Successfully found contact info: ${successCount} (${successPercentage}%)`);
    console.log(`Phone numbers found: ${phoneCount}`);
    console.log(`Social media links found: ${socialCount}`);
    console.log(`Addresses found: ${addressCount}`);
    console.log(`Contact pages visited: ${contactPageVisitedCount}`);
    console.log(`Contact pages that provided additional info: ${contactPageFoundInfoCount}`);
    console.log(`Sites with info found in JSON-LD scripts: ${scriptFoundCount}`);
  }
}

module.exports = ScraperService;
