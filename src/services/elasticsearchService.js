const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      requestTimeout: parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT) || 60000,
      pingTimeout: parseInt(process.env.ELASTICSEARCH_PING_TIMEOUT) || 3000
    });
    this.indexName = 'companies';
  }

  async ping() {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('ES connection failed:', error.message);
      return false;
    }
  }

  async createIndex() {
    try {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              domain: { type: 'keyword' },
              companyCommercialName: { type: 'text', analyzer: 'standard' },
              companyLegalName: { type: 'text', analyzer: 'standard' },
              phone: { type: 'keyword' },
              socialMedia: { type: 'keyword' },
              address: { type: 'text' }
            }
          }
        }
      });
    } catch (error) {
      if (!error.message.includes('already_exists_exception')) {
        throw error;
      }
    }
  }

  async deleteIndex() {
    try {
      await this.client.indices.delete({ index: this.indexName });
    } catch (error) {
      // Index doesn't exist, that's ok
    }
  }

  async search(query) {
    try {
      const searchBody = this.buildQuery(query);
      const response = await this.client.search({
        index: this.indexName,
        body: searchBody
      });

      return {
        total: response.hits.total.value,
        companies: response.hits.hits.map(hit => ({
          score: hit._score,
          ...hit._source
        }))
      };
    } catch (error) {
      console.error('Search failed:', error.message);
      throw error;
    }
  }

  extractDomain(socialUrl) {
    if (!socialUrl) return null;
    
    try {
      const matches = socialUrl.match(/(?:facebook|twitter|instagram|linkedin)\.com\/([^\/\?]+)/);
      if (matches && matches[1]) {
        return `${matches[1]}.com`;
      }
      
      const urlMatch = socialUrl.match(/([a-zA-Z0-9-]+)\.(com|org|net|io|co)/);
      if (urlMatch) {
        return `${urlMatch[1]}.${urlMatch[2]}`;
      }
    } catch (error) {
      console.error('Domain extraction failed:', error.message);
    }
    
    return null;
  }

  buildQuery(query) {
    const { name, website, phone, socialMedia, facebook } = query;
    const mustQueries = [];
    const shouldQueries = [];

    // Website matching with percentage-based scoring (100 = perfect match)
    if (website) {
      shouldQueries.push(
        {
          term: {
            domain: {
              value: website,
              boost: 8.0  // Should result in ~100 score for perfect domain match
            }
          }
        },
        {
          wildcard: {
            domain: {
              value: `*${website}*`,
              boost: 6.0  // Should result in ~80 score for partial domain match
            }
          }
        }
      );
    }

    if (phone) {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      shouldQueries.push(
        { wildcard: { phone: `*${phone}*` } },
        { wildcard: { phone: `*${cleanPhone}*` } }
      );
    }

    if (name) {
      shouldQueries.push(
        {
          match: {
            companyCommercialName: {
              query: name,
              fuzziness: 'AUTO',
              boost: 2.0
            }
          }
        },
        {
          match: {
            companyLegalName: {
              query: name,
              fuzziness: 'AUTO',
              boost: 1.5
            }
          }
        }
      );
    }

    const social = socialMedia || facebook;
    if (social) {
      const domain = this.extractDomain(social);
      
      // Very high priority for exact social media URL matches
      shouldQueries.push({
        terms: {
          socialMedia: [social],
          boost: 25.0
        }
      });

      // High priority for social media URL variations (with/without https, www, etc.)
      shouldQueries.push({
        wildcard: {
          socialMedia: {
            value: `*${social}*`,
            boost: 20.0 
          }
        }
      });

      //  Search for the social URL without protocol variations
      const cleanSocial = social.replace(/^https?:\/\/(www\.)?/, '');
      shouldQueries.push({
        wildcard: {
          socialMedia: {
            value: `*${cleanSocial}*`,
            boost: 20.0
          }
        }
      });

      // High priority for inferred domain matches from social media (percentage-based)
      if (domain) {
        shouldQueries.push({
          wildcard: {
            domain: {
              value: `*${domain}*`,
              boost: 7.0
            }
          }
        });
        
        shouldQueries.push({
          term: {
            domain: {
              value: domain,
              boost: 8.0
            }
          }
        });
      }

      // Medium priority for partial social media matches
      shouldQueries.push({
        match: {
          socialMedia: {
            query: social,
            boost: 10.0
          }
        }
      });
    }

    return {
      query: {
        bool: {
          must: mustQueries.length > 0 ? mustQueries : [{ match_all: {} }],
          should: shouldQueries,
          minimum_should_match: shouldQueries.length > 0 ? 1 : 0
        }
      },
      size: 10,
      sort: [{ _score: { order: 'desc' } }]
    };
  }

  async bulkIndex(companies) {
    try {
      const body = [];
      
      companies.forEach(company => {
        const transformed = this.transformData(company);
        body.push({ index: { _index: this.indexName } });
        body.push(transformed);
      });

      const response = await this.client.bulk({ body });
      
      return {
        indexed: companies.length,
        errors: response.errors ? 
          response.items.filter(item => item.index && item.index.error).length : 0
      };
    } catch (error) {
      console.error('Bulk index failed:', error.message);
      throw error;
    }
  }

  transformData(company) {
    const transformed = { ...company };
    
    if (transformed.socialMedia && typeof transformed.socialMedia === 'string') {
      transformed.socialMedia = transformed.socialMedia
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
    }
    
    return transformed;
  }

  async getStats() {
    try {
      const response = await this.client.indices.stats({ index: this.indexName });
      const indexStats = response.indices[this.indexName];
      
      return {
        indexName: this.indexName,
        documentsCount: indexStats?.total?.docs?.count || 0,
        indexSize: indexStats?.total?.store?.size_in_bytes || 0
      };
    } catch (error) {
      return {
        indexName: this.indexName,
        documentsCount: 0,
        indexSize: 0
      };
    }
  }
}

module.exports = ElasticsearchService;
