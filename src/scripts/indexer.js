require('../config/config');
const DataIndexer = require('../data/indexer');

async function index() {
  const indexer = new DataIndexer();
  
  try {
    await indexer.index();
  } catch (error) {
    console.error('Indexing failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  index();
}

module.exports = { DataIndexer };
