const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8234/converter.html', {waitUntil: 'networkidle2'});

    await page.evaluate(() => {
        document.querySelector('.html-input').value = '<h1>Test</h1><p>Hello world</p>';
    });
    await page.click('#btnGenerate');
    await new Promise(r => setTimeout(r, 2000));
    
    const opacities = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.rendered-node')).map(el => window.getComputedStyle(el).opacity);
    });
    
    console.log("Opacities: ", opacities);
    await browser.close();
})();
