require('dotenv').config();

class Config {
  constructor() {
    // Elasticsearch Configuration
    this.elasticsearch = {
      host: process.env.ELASTICSEARCH_HOST || 'localhost',
      port: parseInt(process.env.ELASTICSEARCH_PORT) || 9200,
      indexName: process.env.ELASTICSEARCH_INDEX_NAME || 'companies',
      url: `http://${process.env.ELASTICSEARCH_HOST || 'localhost'}:${process.env.ELASTICSEARCH_PORT || 9200}`
    };

    // API Server Configuration
    this.api = {
      port: parseInt(process.env.API_PORT) || 3000,
      host: process.env.API_HOST || 'localhost'
    };

    // Docker Configuration
    this.docker = {
      composeFile: process.env.DOCKER_COMPOSE_FILE || 'docker-compose.yml',
      elasticsearchImage: process.env.ELASTICSEARCH_DOCKER_IMAGE || 'docker.elastic.co/elasticsearch/elasticsearch:8.11.0'
    };

    // Scoring Configuration
    this.scoring = {
      boosts: {
        exactDomain: parseFloat(process.env.BOOST_EXACT_DOMAIN) || 8.0,
        partialDomain: parseFloat(process.env.BOOST_PARTIAL_DOMAIN) || 6.0,
        socialExact: parseFloat(process.env.BOOST_SOCIAL_EXACT) || 25.0,
        socialWildcard: parseFloat(process.env.BOOST_SOCIAL_WILDCARD) || 20.0,
        socialProtocolAgnostic: parseFloat(process.env.BOOST_SOCIAL_PROTOCOL_AGNOSTIC) || 20.0,
        socialDomainInferenceExact: parseFloat(process.env.BOOST_SOCIAL_DOMAIN_INFERENCE_EXACT) || 8.0,
        socialDomainInferenceWildcard: parseFloat(process.env.BOOST_SOCIAL_DOMAIN_INFERENCE_WILDCARD) || 7.0,
        socialFuzzy: parseFloat(process.env.BOOST_SOCIAL_FUZZY) || 10.0,
        nameCommercial: parseFloat(process.env.BOOST_NAME_COMMERCIAL) || 2.0,
        nameLegal: parseFloat(process.env.BOOST_NAME_LEGAL) || 1.5,
        phone: parseFloat(process.env.BOOST_PHONE) || 1.5
      }
    };

    // File Paths
    this.paths = {
      scrapedData: process.env.SCRAPED_DATA_PATH || 'temp/scrape-results.json',
      mergedData: process.env.MERGED_DATA_PATH || 'temp/merged-company-data.json',
      companyCsv: process.env.COMPANY_CSV_PATH || 'data/sample-websites-company-names.csv'
    };

    // Search Configuration
    this.search = {
      defaultSize: parseInt(process.env.DEFAULT_SEARCH_SIZE) || 10,
      minimumShouldMatch: parseInt(process.env.MINIMUM_SHOULD_MATCH) || 1
    };
  }

  // Helper methods
  getElasticsearchUrl() {
    return this.elasticsearch.url;
  }

  getApiUrl() {
    return `http://${this.api.host}:${this.api.port}`;
  }

  getBoost(boostType) {
    return this.scoring.boosts[boostType] || 1.0;
  }

  getPath(pathType) {
    return this.paths[pathType];
  }
}

module.exports = new Config();
