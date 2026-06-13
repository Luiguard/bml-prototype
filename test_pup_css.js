const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('requestfailed', req => console.log('FAILED:', req.url()));
    await page.goto('file:///home/benjamin/projects/mediclean-pro/service.html', { waitUntil: 'networkidle0' });
    const styles = await page.evaluate(() => {
        const el = document.querySelector('.hero');
        return el ? window.getComputedStyle(el).display : 'null';
    });
    console.log("Hero display:", styles);
    await browser.close();
})();
