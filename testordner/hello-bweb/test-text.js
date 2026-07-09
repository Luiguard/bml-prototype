const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.setContent('<div style="width: 50px">Hello world this is a long text</div>');
    const rects = await page.evaluate(() => {
        const textNode = document.querySelector('div').firstChild;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rects = Array.from(range.getClientRects()).map(r => ({x:r.x, y:r.y, w:r.width, h:r.height}));
        return rects;
    });
    console.log(rects);
    await browser.close();
})();
