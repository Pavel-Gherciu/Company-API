const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function readWebsitesFromCsv(filePath) {
  const sites = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const url = row.url || row.website || row.domain || Object.values(row)[0];
        if (url) {
          let formattedUrl = url.trim();
          if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = 'https://' + formattedUrl;
          }
          sites.push(formattedUrl);
        }
      })
      .on('end', () => {
        console.log(`Found ${sites.length} websites in CSV file`);
        resolve(sites);
      })
      .on('error', reject);
  });
}

function saveResultsAsJson(filePath, results) {
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
}

function transformResultsForCsv(results) {
  return results.map(result => {
    let domain;
    try {
      const urlObj = new URL(result.url);
      domain = urlObj.hostname;
    } catch {
      domain = result.url;
    }

    let contactPageInfo = 'No';
    if (result.contactPageFoundInfo) {
      const foundItems = [];
      if (result.contactPageFoundInfo.phone) foundItems.push('Phone');
      if (result.contactPageFoundInfo.socialMedia) foundItems.push('Social');
      if (result.contactPageFoundInfo.address) foundItems.push('Address');
      contactPageInfo = foundItems.length > 0 ? foundItems.join(', ') : 'No';
    }

    return {
      domain: domain,
      phone: result.phone || '',
      socialMedia: result.socialMedia || '',
      address: result.address || '',
      visitedContactPage: result.visitedContactPage ? 'Yes' : 'No',
      foundInScript: result.foundInScript ? 'Yes' : 'No',
      contactPageFoundInfo: contactPageInfo,
      status: result.success ? 'SUCCESS' : `ERROR: ${result.reason}`
    };
  });
}

async function saveResultsAsCsv(filePath, results) {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'domain', title: 'domain' },
      { id: 'phone', title: 'phone' },
      { id: 'socialMedia', title: 'social_media' },
      { id: 'address', title: 'address' },
      { id: 'visitedContactPage', title: 'visited_contact_page' },
      { id: 'foundInScript', title: 'found_in_script' },
      { id: 'contactPageFoundInfo', title: 'contact_page_found_info' },
      { id: 'status', title: 'status' }
    ]
  });

  const csvData = transformResultsForCsv(results);
  await csvWriter.writeRecords(csvData);
}

async function saveResults(results, baseName = 'scrape-results') {
  // Save to temp folder
  const tempDir = path.join(__dirname, '..', '..', 'temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const jsonPath = path.join(tempDir, `${baseName}.json`);
  const csvPath = path.join(tempDir, `${baseName}.csv`);
  
  // Save as JSON
  saveResultsAsJson(jsonPath, results);
  
  // Save as CSV
  await saveResultsAsCsv(csvPath, results);
  
  console.log(`Results saved to temp/${baseName}.csv and temp/${baseName}.json`);
}

async function readCompanyNamesFromCsv(filePath) {
  const companies = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        companies.push({
          domain: row.domain,
          companyCommercialName: row.company_commercial_name,
          companyLegalName: row.company_legal_name,
          companyAllAvailableNames: row.company_all_available_names
        });
      })
      .on('end', () => {
        console.log(`Found ${companies.length} companies in CSV file`);
        resolve(companies);
      })
      .on('error', reject);
  });
}

function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix for better matching
  } catch {
    return url.replace(/^www\./, '');
  }
}

async function mergeScrapedDataWithCompanyNames(scrapedDataPath, companyNamesPath, outputPath) {
  try {
    // Read scraped data
    const scrapedData = JSON.parse(fs.readFileSync(scrapedDataPath, 'utf8'));
    console.log(`Loaded ${scrapedData.length} scraped records`);
    
    // Read company names data
    const companyData = await readCompanyNamesFromCsv(companyNamesPath);
    console.log(`Loaded ${companyData.length} company records`);
    
    // Create a map for faster lookup
    const companyMap = new Map();
    companyData.forEach(company => {
      const domain = company.domain.replace(/^www\./, '');
      companyMap.set(domain, company);
    });
    
    // Merge the data
    const mergedData = scrapedData.map(scraped => {
      const domain = extractDomainFromUrl(scraped.url);
      const companyInfo = companyMap.get(domain);
      
      return {
        domain: domain,
        companyCommercialName: companyInfo?.companyCommercialName || '',
        companyLegalName: companyInfo?.companyLegalName || '',
        companyAllAvailableNames: companyInfo?.companyAllAvailableNames || '',
        phone: scraped.phone || '',
        socialMedia: scraped.socialMedia || '',
        address: scraped.address || ''
      };
    });
    
    // Save merged data as JSON
    const jsonOutputPath = outputPath.replace('.csv', '.json');
    saveResultsAsJson(jsonOutputPath, mergedData);
    
    // Save merged data as CSV
    await saveMergedDataAsCsv(outputPath, mergedData);
    
    // Generate statistics
    const stats = generateMergeStatistics(mergedData, scrapedData);
    console.log('\n=== MERGE STATISTICS ===');
    console.log(`Total scraped records: ${stats.totalScrapedRecords}`);
    console.log(`Total company records: ${stats.totalCompanyRecords}`);
    console.log(`Successfully merged records: ${stats.mergedRecords}`);
    console.log(`Records with phone: ${stats.recordsWithPhone}`);
    console.log(`Records with social media: ${stats.recordsWithSocialMedia}`);
    console.log(`Records with address: ${stats.recordsWithAddress}`);
    console.log(`Records with any contact info: ${stats.recordsWithAnyContact}`);
    console.log(`Phone fill rate: ${stats.phoneFillRate}%`);
    console.log(`Social media fill rate: ${stats.socialMediaFillRate}%`);
    console.log(`Address fill rate: ${stats.addressFillRate}%`);
    
    console.log(`\nMerged data saved to ${outputPath} and ${jsonOutputPath}`);
    return mergedData;
    
  } catch (error) {
    console.error('Error merging data:', error);
    throw error;
  }
}

async function saveMergedDataAsCsv(filePath, mergedData) {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'domain', title: 'domain' },
      { id: 'companyCommercialName', title: 'company_commercial_name' },
      { id: 'companyLegalName', title: 'company_legal_name' },
      { id: 'companyAllAvailableNames', title: 'company_all_available_names' },
      { id: 'phone', title: 'phone' },
      { id: 'socialMedia', title: 'social_media' },
      { id: 'address', title: 'address' }
    ]
  });

  const csvData = mergedData.map(record => ({
    domain: record.domain,
    companyCommercialName: record.companyCommercialName,
    companyLegalName: record.companyLegalName,
    companyAllAvailableNames: record.companyAllAvailableNames,
    phone: record.phone,
    socialMedia: record.socialMedia,
    address: record.address
  }));

  await csvWriter.writeRecords(csvData);
}

function generateMergeStatistics(mergedData, originalScrapedData) {
  const recordsWithPhone = mergedData.filter(record => record.phone && record.phone.trim() !== '').length;
  const recordsWithSocialMedia = mergedData.filter(record => record.socialMedia && record.socialMedia.trim() !== '').length;
  const recordsWithAddress = mergedData.filter(record => record.address && record.address.trim() !== '').length;
  const recordsWithAnyContact = mergedData.filter(record => 
    (record.phone && record.phone.trim() !== '') || 
    (record.socialMedia && record.socialMedia.trim() !== '') || 
    (record.address && record.address.trim() !== '')
  ).length;
  
  return {
    totalScrapedRecords: originalScrapedData.length,
    totalCompanyRecords: mergedData.length,
    mergedRecords: mergedData.length,
    recordsWithPhone,
    recordsWithSocialMedia,
    recordsWithAddress,
    recordsWithAnyContact,
    phoneFillRate: ((recordsWithPhone / mergedData.length) * 100).toFixed(2),
    socialMediaFillRate: ((recordsWithSocialMedia / mergedData.length) * 100).toFixed(2),
    addressFillRate: ((recordsWithAddress / mergedData.length) * 100).toFixed(2)
  };
}

module.exports = {
  readWebsitesFromCsv,
  saveResultsAsJson,
  saveResultsAsCsv,
  transformResultsForCsv,
  saveResults,
  readCompanyNamesFromCsv,
  mergeScrapedDataWithCompanyNames,
  saveMergedDataAsCsv,
  generateMergeStatistics,
  extractDomainFromUrl
};
