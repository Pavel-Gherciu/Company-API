const fs = require('fs');
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
  // Save as JSON
  saveResultsAsJson(`${baseName}.json`, results);
  
  // Save as CSV
  await saveResultsAsCsv(`${baseName}.csv`, results);
  
  console.log(`Results saved to ${baseName}.csv and ${baseName}.json`);
}

module.exports = {
  readWebsitesFromCsv,
  saveResultsAsJson,
  saveResultsAsCsv,
  transformResultsForCsv,
  saveResults
};
