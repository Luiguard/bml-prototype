const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.setContent('<img src="assets/test.png">');
    const attr = await page.evaluate(() => {
        const img = document.querySelector('img');
        return {
            srcProp: img.src,
            srcAttr: img.getAttribute('src')
        };
    });
    console.log(attr);
    await browser.close();
})();
