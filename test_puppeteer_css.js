const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('requestfailed', request => {
        console.error('Request failed:', request.url(), request.failure().errorText);
    });
    
    page.on('response', response => {
        if (response.url().endsWith('.css')) {
            console.log('CSS Loaded:', response.url(), response.status());
        }
    });

    await page.goto(`file:///home/benjamin/projects/mediclean-pro/service.html`, { waitUntil: 'networkidle0' });
    await browser.close();
})();
