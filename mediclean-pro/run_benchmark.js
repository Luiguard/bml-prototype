const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Inject the benchmark HTML
    const htmlPath = path.join(__dirname, 'bweb-converter/tests/benchmark.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // We need to serve this so modules work, or we can just load the file:// URI
    await page.goto('file://' + htmlPath);
    
    // Wait for everything to load
    await page.waitForSelector('#btn-dom');
    
    console.log("Running DOM Benchmark...");
    await page.click('#btn-dom');
    await page.waitForTimeout(500); // Give it time to render and update text
    
    console.log("Running BWEB Benchmark...");
    await page.click('#btn-bweb');
    await page.waitForTimeout(500);
    
    const results = await page.$eval('#results', el => el.innerText);
    console.log("RESULTS: " + results);
    
    await browser.close();
})();
