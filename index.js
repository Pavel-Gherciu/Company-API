const ScraperService = require('./src/services/scraperService');
const { readWebsitesFromCsv, saveResults } = require('./src/utils/fileUtils');


const CONFIG = {
  csvFilePath: 'data/sample-websites.csv',
  concurrency: 15,
  outputBaseName: 'scrape-results'
};

async function main() {
  // start timing
  const startTime = Date.now();
  
  try {
    console.log('Starting Web Scraper for Company Information');
    console.log('=' .repeat(60));
    
    // read websites from CSV
    console.log(`Reading websites from: ${CONFIG.csvFilePath}`);
    const sites = await readWebsitesFromCsv(CONFIG.csvFilePath);
    
    if (sites.length === 0) {
      console.error('No websites found in CSV file');
      process.exit(1);
    }
    
    // init scraper service
    console.log('Initializing scraper service...');
    const scraper = new ScraperService({ 
      concurrency: CONFIG.concurrency 
    });
    
    await scraper.initialize();
    
    try {
      // process all websites
      console.log(`Processing ${sites.length} websites...`);
      const results = await scraper.processWebsites(sites);
      
      // display statistics
      scraper.displayStatistics(results, startTime);
      
      // save results
      console.log('\n Saving results...');
      await saveResults(results, CONFIG.outputBaseName);
      
      console.log('\n Scraping completed successfully!');
      
    } finally {
      // always close the scraper service
      await scraper.close();
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// run the main function
if (require.main === module) {
  main();
}

module.exports = { main, CONFIG };
  
