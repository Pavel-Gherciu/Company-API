require('./src/config/config');
const { exec, spawn } = require('child_process');
const ApiServer = require('./src/api/server');

function runCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command}`);
        const { spawn } = require('child_process');
        
        // Parse command and arguments
        const [cmd, ...args] = command.split(' ');
        
        const process = spawn(cmd, args, { 
            stdio: 'inherit',  // This pipes the output to parent console
            shell: true 
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
        
        process.on('error', (error) => {
            reject(error);
        });
    });
}

async function waitForElasticsearch() {
    console.log('Waiting for Elasticsearch...');
    for (let i = 0; i < 30; i++) {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const response = await fetch('http://localhost:9200/_cluster/health');
            if (response.ok) {
                console.log('Elasticsearch is up!');
                return;
            }
        } catch (error) {
            // Keep waiting
        }
    }
    throw new Error('Elasticsearch failed to start after 60 seconds');
}

async function checkDataIndexed() {
    try {
        const response = await fetch('http://localhost:9200/companies/_count');
        const data = await response.json();
        return data.count > 0;
    } catch (error) {
        return false;
    }
}

async function checkElasticsearchRunning() {
    try {
        const response = await fetch('http://localhost:9200/_cluster/health');
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function checkScrapedData() {
    const fs = require('fs');
    const path = require('path');
    const mergedPath = path.join(__dirname, 'temp', 'merged-company-data.csv');
    
    return fs.existsSync(mergedPath);
}

async function start() {
    try {
        console.log('Starting Company API...\n');
        
        console.log('1. Checking existing data...');
        
        // Check if Elasticsearch is already running and has data
        const elasticRunning = await checkElasticsearchRunning();
        let hasIndexedData = false;
        
        if (elasticRunning) {
            console.log('   Elasticsearch running - checking for data...');
            hasIndexedData = await checkDataIndexed();
            if (hasIndexedData) {
                console.log('   Data already there - skipping setup');
                console.log('\n2. Starting server...');
                const server = new ApiServer();
                await server.start();
                return;
            }
        }
        
        // Check for merged data before starting Docker
        console.log('2. Checking merged data...');
        const hasMergedData = await checkScrapedData();
        
        if (!hasMergedData) {
            console.log('   No data found - need to scrape');
            console.log('3. Running scraper (takes a while)...');
            await runCommand('node src/scripts/scraper.js');
            console.log('   Scraping done!');
        } else {
            console.log('   Data found - skipping scrape');
        }
        
        // Now start Docker since we need to index
        console.log('4. Starting Docker...');
        await runCommand('docker-compose up -d');
        
        console.log('5. Waiting for Elasticsearch...');
        await waitForElasticsearch();
        
        console.log('6. Indexing data...');
        await runCommand('node src/scripts/indexer.js');
        console.log('   Indexing done!');
        
        console.log('7. Starting server...');
        const server = new ApiServer();
        await server.start();
    } catch (error) {
        console.error('Startup failed:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});

start();
