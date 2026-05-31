const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8234/converter.html', {waitUntil: 'networkidle2'});

    // Wait for the page
    // Insert some html
    await page.evaluate(() => {
        document.querySelector('.html-input').value = '<h1>Test</h1><p>Hello world</p>';
    });

    // Click Generate
    await page.click('#btnGenerate');
    
    // Wait for conversion
    await new Promise(r => setTimeout(r, 2000)); //(2000);
    
    // Check background color of renderTarget
    const rtBg = await page.evaluate(() => {
        const rt = document.getElementById('renderTarget');
        return window.getComputedStyle(rt).backgroundColor;
    });
    
    console.log("renderTarget background is: " + rtBg);
    
    // Take a screenshot of the viewport element
    const rtHandle = await page.$('#renderTarget');
    await rtHandle.screenshot({path: 'renderTarget_screenshot.png'});
    
    await browser.close();
})();
