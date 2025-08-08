# Company Matching API

API for the Veridion coding challenge. Scrapes websites, stores company data, and matches queries.

## How to run it

```bash
npm install
npm start
```

It'll check if you have data, scrape websites if you don't (takes about 10 minutes), start Elasticsearch, and run the API on port 3000.

## What I built

### Step 1: Data extraction

#### 1.1 The scraping part
Had to scrape 997 websites from the CSV file. Used Puppeteer because it handles modern websites better than other scrapers. Set it to run 15 pages at once so it doesn't take forever.

Got these data points:
- Phone numbers (found on about 60% of sites)
- Social media links (about 70% of sites)  
- Addresses (about 40% of sites)

Some sites failed because they block bots, timeout, or just don't have the data.

#### 1.2 Data analysis
- Crawled 900+ out of 997 websites (around 90% success rate)
- Phone extraction worked pretty well, addresses not so much
- Social media was easier to find than expected

#### 1.3 Scaling
Made it run in under 10 minutes by:
- Running multiple browsers at once (15 concurrent)
- Reusing browser instances instead of creating new ones
- Smart timeouts so slow sites don't hold everything up
- Retry logic for flaky connections

### Step 2: Data storage and querying

#### 2.1 Storing the data
Merged the scraped data with the company names CSV file. Stored everything in Elasticsearch because it's good at fuzzy matching and handles typos well.

#### 2.2 The API
Built endpoints that take company name, website, phone, or Facebook profile and try to find the best match.

Matching logic:
- Exact website domain matches get the highest score
- Facebook URLs get a big boost if they match exactly
- Company names use fuzzy matching (handles typos and variations)
- Everything gets scored 0-100, highest score wins

## API endpoints

**Single match:**
```bash
POST /api/match
{
  "name": "SteppIR",
  "website": "steppir.com"
}
```

**Batch matching:**
```bash
POST /api/batch-match
{
  "companies": [
      {
        "name": "SteppIR", 
        "website": "steppir.com"
      },
      {
        "name": "Test Company", 
        "phone": "+1234567890"
      }
    ]
}
```

**Health check:**
```bash
GET /health
```

## Test results

Used the provided test CSV file. Gets about 95% match rate. Most matches score pretty high (80+ points). Response time is usually under 100ms.

## How it works

```
main.js - starts everything
src/
  api/ - REST endpoints
  services/ - scraper and search stuff  
  scripts/ - scraper and indexer scripts
  config/ - browser settings
data/ - input files
temp/ - generated files
```

## Configuration

You can tweak settings in the .env file:
- SCRAPER_CONCURRENCY: how many pages to scrape at once
- INDEX_BATCH_SIZE: how many records to index at once
- PORT: API port

## Tech choices

- **Puppeteer**: Best for scraping modern websites, handles JavaScript
- **Elasticsearch**: Built for search and fuzzy matching
- **Express**: Simple web framework
- **Docker**: Makes Elasticsearch setup easier

## Why this approach?

Tried a few different things:

1. **Domain matching first**: Website URLs are the most reliable identifier
2. **Social media boost**: Facebook URLs are pretty unique
3. **Fuzzy company names**: Companies have lots of name variations
4. **Scoring system**: Better than just yes/no matching

## Issues I ran into

- Some websites block scrapers completely or are just no longer available
- Phone number formats are inconsistent
- Company names have tons of variations (Inc, LLC, Corp, etc.)
- Addresses are formatted differently everywhere
- Some sites are just really slow

## If this was production scale

For billions of records like Veridion:
- Elasticsearch cluster with multiple nodes
- Distributed scraping across multiple machines with high concurrency
- Better caching (Redis)
- Machine learning for better matching
- More sophisticated deduplication

## Running individual parts

```bash
npm run scrape     # just run the scraper
npm run reindex    # reindex data
npm run clean      # delete temp files
npm test          # run API tests
```

The scraper takes about 10 minutes for all 997 sites. The API usually responds in under 100ms. Match rate on the test data is around 95%.

Honestly, the hardest part was dealing with all the different ways websites structure their contact info. Some put phone numbers in images, some hide them behind JavaScript, some don't have them at all. This required tens of tests of the entire scraper to see what would work in bulk and fit every single website and also not get detected and blocked.
