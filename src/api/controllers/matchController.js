const ElasticsearchService = require('../../services/elasticsearchService');

class MatchController {
  constructor() {
    this.es = new ElasticsearchService();
  }

  async search(req, res) {
    try {
      const query = req.body;
      const result = await this.es.search(query);
      
      res.json({
        success: true,
        total: result.total,
        companies: result.companies
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async match(req, res) {
    try {
      const body = req.body;
      
      // Single query format
      if (!body.companies && !Array.isArray(body)) {
        const matches = await this.findMatches(body);
        return res.json({
          success: true,
          matches: matches,
          bestMatch: matches.length > 0 ? matches[0] : null
        });
      }
      
      // Array format
      const companies = body.companies || body;
      if (!Array.isArray(companies)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid input format' 
        });
      }

      const results = await this.matchMultiple(companies);
      res.json(results);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async batchMatch(req, res) {
    try {
      const { companies } = req.body;
      if (!Array.isArray(companies)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Companies must be an array' 
        });
      }

      const results = await this.processBatch(companies);
      res.json(results);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async findMatches(company) {
    const queries = this.buildQueries(company);
    const allMatches = new Map();
    
    for (const query of queries) {
      try {
        const result = await this.es.search(query);
        for (const match of result.companies) {
          const key = match.domain || match.id;
          if (!allMatches.has(key) || allMatches.get(key).score < match.score) {
            allMatches.set(key, match);
          }
        }
      } catch (error) {
        console.error('Query failed:', error.message);
      }
    }
    
    return Array.from(allMatches.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  buildQueries(company) {
    const queries = [];
    
    if (company.website || company.domain) {
      queries.push({ website: company.website || company.domain });
    }
    
    if (company.phone) {
      queries.push({ phone: company.phone });
    }
    
    if (company.name || company.companyCommercialName) {
      queries.push({ name: company.name || company.companyCommercialName });
    }
    
    if (company.facebook) {
      queries.push({ facebook: company.facebook });
    }
    
    if (company.socialMedia) {
      queries.push({ socialMedia: company.socialMedia });
    }
    
    if (company.twitter) {
      queries.push({ socialMedia: company.twitter });
    }
    
    if (company.instagram) {
      queries.push({ socialMedia: company.instagram });
    }
    
    if (company.linkedin) {
      queries.push({ socialMedia: company.linkedin });
    }
    
    return queries;
  }

  async matchMultiple(companies) {
    const results = [];
    
    for (const company of companies) {
      const matches = await this.findMatches(company);
      results.push({
        input: company,
        matches: matches,
        bestMatch: matches.length > 0 ? matches[0] : null
      });
    }
    
    return {
      success: true,
      results: results,
      total: results.length
    };
  }

  async processBatch(companies) {
    const batchSize = parseInt(process.env.MATCH_BATCH_SIZE) || 10;
    const results = [];
    
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(company => this.findMatches(company))
      );
      
      batch.forEach((company, index) => {
        results.push({
          input: company,
          matches: batchResults[index],
          bestMatch: batchResults[index].length > 0 ? batchResults[index][0] : null
        });
      });
    }
    
    return {
      success: true,
      results: results,
      total: results.length
    };
  }
}

module.exports = MatchController;
