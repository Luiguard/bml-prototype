const puppeteer = require('puppeteer');
const http = require('http');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const path = require('path');

// Serve the parent directory (mediclean-pro) so bweb-engine is accessible
const serve = serveStatic(path.join(__dirname, '..'), { 'index': ['index.html'] });

const server = http.createServer(function onRequest (req, res) {
  serve(req, res, finalhandler(req, res));
});

server.listen(3000, async () => {
    console.log("Server listening on port 3000");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://localhost:3000/bweb-converter/tests/benchmark.html');
    await page.waitForSelector('#btn-dom');
    
    console.log("Running DOM Benchmark...");
    await page.click('#btn-dom');
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Running BWEB Benchmark...");
    await page.click('#btn-bweb');
    await new Promise(r => setTimeout(r, 1000));
    
    const results = await page.$eval('#results', el => el.innerText);
    console.log("RESULTS: " + results);
    
    await browser.close();
    server.close();
});
