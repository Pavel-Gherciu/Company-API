const fs = require('fs');
const path = require('path');
const ElasticsearchService = require('../services/elasticsearchService');

class DataIndexer {
  constructor() {
    this.es = new ElasticsearchService();
    this.dataFile = 'temp/merged-company-data.json';
  }

  async index() {
    try {
      console.log('Starting data indexing...');
      
      const isConnected = await this.es.ping();
      if (!isConnected) {
        throw new Error('Cannot connect to Elasticsearch');
      }
      console.log('Connected to Elasticsearch');

      const companies = this.loadData();
      console.log(`Loaded ${companies.length} companies`);

      console.log('Setting up index...');
      await this.es.deleteIndex();
      await this.es.createIndex();
      console.log('Index setup complete');

      const validCompanies = companies.filter(company => 
        company.domain && company.companyCommercialName
      );
      
      console.log(`Indexing ${validCompanies.length} valid companies...`);

      const batchSize = parseInt(process.env.INDEX_BATCH_SIZE) || 100;
      let totalIndexed = 0;
      let totalErrors = 0;

      for (let i = 0; i < validCompanies.length; i += batchSize) {
        const batch = validCompanies.slice(i, i + batchSize);
        const result = await this.es.bulkIndex(batch);
        
        totalIndexed += result.indexed;
        totalErrors += result.errors;
        
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validCompanies.length / batchSize)}`);
        
        await new Promise(resolve => setTimeout(resolve, parseInt(process.env.INDEX_BATCH_DELAY) || 100));
      }

      console.log(`Indexing complete: ${totalIndexed} indexed, ${totalErrors} errors`);

      const stats = await this.es.getStats();
      console.log(`Index: ${stats.documentsCount} documents, ${Math.round(stats.indexSize / 1024)} KB`);

      await this.testSearch();
      console.log('Data indexing successful');

    } catch (error) {
      console.error('Indexing failed:', error.message);
      throw error;
    }
  }

  loadData() {
    const dataPath = path.join(__dirname, '../../', this.dataFile);
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${dataPath}`);
    }
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }

  async testSearch() {
    const testQueries = [
      { name: 'MAZ Auto Glass' },
      { website: 'mazautoglass.com' },
      { phone: '4156264474' }
    ];

    for (const query of testQueries) {
      try {
        const result = await this.es.search(query);
        const queryStr = Object.entries(query).map(([k, v]) => `${k}:"${v}"`).join(',');
        console.log(`Test {${queryStr}} → ${result.total} results`);
      } catch (error) {
        console.error('Test search failed:', error.message);
      }
    }
  }
}

module.exports = DataIndexer;
