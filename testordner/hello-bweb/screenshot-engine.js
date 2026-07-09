const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });
    
    await page.goto('file://' + __dirname + '/bweb-engine.html?file=dist/08-events-v11.bpg', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.screenshot({ path: 'engine_v11.png' });
    await browser.close();
})();
