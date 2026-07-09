const puppeteer = require('puppeteer');
const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/subfolder', apiLimiter, express.static('/home/benjamin/projects/testordner'));

const server = app.listen(8081, async () => {
    console.log("Server running on http://localhost:8081/subfolder/");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        console.log(`[PAGE ${msg.type().toUpperCase()}]`, msg.text());
    });

    // Simulate Extension Injection
    await page.evaluateOnNewDocument(() => {
        window.__BWEB_NATIVE_ACTIVE__ = true;
    });

    console.log("Navigating to index.html...");
    await page.goto('http://localhost:8081/subfolder/index.html', {waitUntil: 'networkidle2'});

    console.log("Waiting for BWEB to render...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Print all links
    await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        console.log(`Found ${links.length} links in DOM`);
        
        const datenschutzLink = links.find(a => a.href && a.href.includes('datenschutz'));
        if(datenschutzLink) {
            console.log("Found datenschutz. Clicking!");
            datenschutzLink.click();
        } else {
            console.log("Datenschutz link NOT FOUND!");
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("URL after click:", await page.url());
    
    // Check if there's any cookie banner remaining
    const bannerVisible = await page.evaluate(() => {
        return !!document.getElementById('gdpr-consent-banner');
    });
    console.log("Cookie Banner visible:", bannerVisible);

    await browser.close();
    server.close();
});
