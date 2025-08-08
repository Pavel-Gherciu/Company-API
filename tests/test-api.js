const fs = require('fs');
const path = require('path');

class APITester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
  }

  async start() {
    console.log('Testing API at http://localhost:3000\n');
    console.log('Make sure server is running: npm start\n');
  }

  async loadTestData() {
    try {
      const csvPath = path.join(__dirname, '..', 'data', 'API-input-sample.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',');
      
      const testCases = lines.slice(1).map(line => {
        const values = line.split(',');
        const rawData = {};
        headers.forEach((header, index) => {
          rawData[header.trim()] = values[index] ? values[index].trim() : undefined;
        });
        
        return this.mapCsvToApiFormat(rawData);
      });

      const validTestCases = testCases.filter(testCase => 
        testCase.name || testCase.phone || testCase.website || testCase.facebook
      );

      console.log(`Found ${validTestCases.length} test cases in CSV\n`);
      return validTestCases;
    } catch (error) {
      console.error('Failed to load test data:', error.message);
      return [];
    }
  }

  mapCsvToApiFormat(csvData) {
    const apiData = {};
    
    if (csvData['input name'] && csvData['input name'].trim() !== '') {
      apiData.name = csvData['input name'].trim();
    }
    
    if (csvData['input phone'] && csvData['input phone'].trim() !== '') {
      apiData.phone = csvData['input phone'].trim();
    }
    
    if (csvData['input website'] && csvData['input website'].trim() !== '') {
      let website = csvData['input website'].trim();
      website = website.replace('https://https//', 'https://');
      website = website.replace(/\/about-us$/, '');
      website = website.replace(/\/index\.html.*$/, '');
      website = website.replace(/^https?:\/\//, '');
      website = website.replace(/^www\./, '');
      if (!['google.com', 'www.google.com'].includes(website)) {
        apiData.website = website;
      }
    }
    
    if (csvData['input_facebook'] && csvData['input_facebook'].trim() !== '') {
      let facebook = csvData['input_facebook'].trim();
      if (facebook.includes('facebook.com/')) {
        facebook = facebook.replace('https://www.facebook.com/', 'facebook.com/');
        facebook = facebook.replace('https://facebook.com/', 'facebook.com/');
        apiData.facebook = facebook;
      }
    }
    
    return apiData;
  }

  async testSingleMatch(testCase, index) {
    try {
      const response = await fetch(`${this.baseUrl}/api/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase)
      });

      const result = await response.json();
      
      console.log(`Test ${index + 1}:`);
      console.log(`   Input: ${JSON.stringify(testCase)}`);
      
      if (result.success && result.bestMatch) {
        console.log(`   FOUND:`);
        console.log(`      ${result.bestMatch.companyCommercialName}`);
        console.log(`      ${result.bestMatch.domain}`);
        console.log(`      Score: ${result.bestMatch.score}`);
        console.log(`      Total matches: ${result.matches.length}`);
        
        // Show contact info if available
        const contactInfo = [];
        if (result.bestMatch.phone) contactInfo.push(`Phone: ${result.bestMatch.phone}`);
        if (result.bestMatch.socialMedia) {
          const social = Array.isArray(result.bestMatch.socialMedia) 
            ? result.bestMatch.socialMedia[0] 
            : result.bestMatch.socialMedia;
          contactInfo.push(`Social: ${social.substring(0, 50)}...`);
        }
        if (result.bestMatch.address) contactInfo.push(`Address: ${result.bestMatch.address.substring(0, 50)}...`);
        
        if (contactInfo.length > 0) {
          console.log(`      Contact: ${contactInfo.join(' | ')}`);
        }
        
        return { found: true, score: result.bestMatch.score, processingTime: 0 };
      } else {
        console.log(`   NOT FOUND`);
        return { found: false, score: 0, processingTime: 0 };
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
      return { found: false, score: 0, processingTime: 0, error: error.message };
    } finally {
      console.log('');
    }
  }

  async testBatchMatching(testCases) {
    try {
      console.log('Testing batch API...\n');
      
      const response = await fetch(`${this.baseUrl}/api/batch-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companies: testCases })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Batch results:');
        console.log(`   Total queries: ${result.total}`);
        console.log(`   Found matches: ${result.results.filter(r => r.bestMatch).length}`);
        console.log(`   Success rate: ${((result.results.filter(r => r.bestMatch).length / result.total) * 100).toFixed(1)}%\n`);
        
        return result;
      } else {
        console.log('Batch failed:', result.error);
        return null;
      }
    } catch (error) {
      console.log('Batch error:', error.message);
      return null;
    }
  }

  async testAPIHealth() {
    try {
      console.log('Checking API health...\n');
      
      const response = await fetch(`${this.baseUrl}/health`);
      const result = await response.json();
      
      if (response.ok) {
        console.log('API is up:');
        console.log(`   Status: ${result.status}`);
        console.log(`   Time: ${result.timestamp}\n`);
      } else {
        console.log('API health check failed:', result.error);
      }
    } catch (error) {
      console.log('Health check error:', error.message);
    }
  }

  calculateAccuracyMetrics(results) {
    const matches = results.filter(r => r.found);
    const totalQueries = results.length;
    
    if (matches.length === 0) {
      return {
        matchRate: 0,
        averageScore: 0,
        highConfidenceMatches: 0,
        accuracyDistribution: { high: 0, medium: 0, low: 0 }
      };
    }

    const averageScore = matches.reduce((sum, r) => sum + r.score, 0) / matches.length;
    const highConfidenceMatches = matches.filter(r => r.score > 80).length;
    
    const accuracyDistribution = {
      high: matches.filter(r => r.score > 80).length,
      medium: matches.filter(r => r.score > 50 && r.score <= 80).length,
      low: matches.filter(r => r.score <= 50).length
    };

    return {
      matchRate: (matches.length / totalQueries) * 100,
      averageScore: Math.round(averageScore * 100) / 100,
      highConfidenceMatches: (highConfidenceMatches / totalQueries) * 100,
      accuracyDistribution
    };
  }

  generateReport(results, metrics, batchResult) {
    console.log('TEST RESULTS');
    console.log('='.repeat(40));
    console.log();
    
    console.log('MATCH STATS:');
    console.log(`   Overall success rate: ${metrics.matchRate.toFixed(1)}%`);
    console.log(`   High confidence matches: ${metrics.highConfidenceMatches.toFixed(1)}%`);
    console.log(`   Average score: ${metrics.averageScore}`);
    console.log();
    
    console.log('SCORE BREAKDOWN:');
    console.log(`   High (>80): ${metrics.accuracyDistribution.high} matches`);
    console.log(`   Medium (50-80): ${metrics.accuracyDistribution.medium} matches`);
    console.log(`   Low (<50): ${metrics.accuracyDistribution.low} matches`);
    console.log();
    
    if (batchResult && batchResult.summary) {
      console.log('PERFORMANCE:');
      console.log(`   Processing time: N/A`);
      console.log(`   Avg time per query: N/A`);
      console.log(`   Queries/sec: N/A`);
      console.log();
    }
    
    console.log('DETAILS:');
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    console.log(`   Total tests: ${results.length}`);
    console.log(`   Found: ${results.filter(r => r.found).length}`);
    console.log(`   Not found: ${results.filter(r => !r.found).length}`);
    console.log(`   Errors: ${results.filter(r => r.error).length}`);
    console.log(`   Avg response time: ${Math.round(totalProcessingTime / results.length)}ms`);
    console.log();
    
    console.log('NOTES:');
    if (metrics.matchRate < 70) {
      console.log('   - Match rate could be better');
      console.log('   - Consider improving fuzzy matching');
    } else if (metrics.matchRate < 90) {
      console.log('   - Decent match rate');
      console.log('   - Fine-tune scoring if needed');
    } else {
      console.log('   - Good match rate');
    }
    
    if (metrics.averageScore < 60) {
      console.log('   - Average confidence is low');
      console.log('   - Review scoring algorithm');
    }
    
    console.log();
    console.log('='.repeat(40));
  }
}

async function runComprehensiveTest() {
  const tester = new APITester();
  
  try {
    // Start the API server
    await tester.start();
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test API health
    await tester.testAPIHealth();
    
    // Load test data
    const testCases = await tester.loadTestData();
    
    if (testCases.length === 0) {
      console.log('No test data available. Exiting...');
      return;
    }
    
    // Test individual matching
    console.log('Testing single match API...\n');
    const individualResults = [];
    
    for (let i = 0; i < testCases.length; i++) {
      const result = await tester.testSingleMatch(testCases[i], i);
      individualResults.push(result);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Test batch matching
    const batchResult = await tester.testBatchMatching(testCases);
    
    // Calculate metrics
    const metrics = tester.calculateAccuracyMetrics(individualResults);
    
    // Generate comprehensive report
    tester.generateReport(individualResults, metrics, batchResult);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    console.log('\nAPI Server stopped');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runComprehensiveTest().catch(console.error);
}

module.exports = { APITester, runComprehensiveTest };
