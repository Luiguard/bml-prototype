const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(`
        <div id="parent" style="opacity: 0;">
            <div id="child" style="opacity: 1;">Hello</div>
            <div id="child2">World</div>
        </div>
    `);
    
    const op1 = await page.$eval('#child', el => window.getComputedStyle(el).opacity);
    const op2 = await page.$eval('#child2', el => window.getComputedStyle(el).opacity);
    
    console.log("Child 1 opacity:", op1);
    console.log("Child 2 opacity:", op2);
    
    await browser.close();
})();
