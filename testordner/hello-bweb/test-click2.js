const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    
    await page.goto('http://localhost:12345/step12-viewer.html');
    
    await page.evaluate(() => {
        window.oldDispatch = dispatch;
        window.dispatch = function(action, target) {
            console.log("Dispatched:", action, target, "clicks=", state.clicks);
            window.oldDispatch(action, target);
            console.log("After update clicks=", state.clicks);
        }
    });

    await new Promise(r => setTimeout(r, 1000));
    
    // Click on canvas!
    await page.evaluate(() => {
        const c = document.getElementById('bwebCanvas');
        const rect = c.getBoundingClientRect();
        
        // Find Tab 2 button
        // Let's just simulate click event
        const evt = new MouseEvent('click', {
            clientX: rect.left + 300,
            clientY: rect.top + 20,
            bubbles: true
        });
        c.dispatchEvent(evt);
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
        const c = document.getElementById('bwebCanvas');
        const rect = c.getBoundingClientRect();
        // Click increment
        const evt = new MouseEvent('click', {
            clientX: rect.left + 300,
            clientY: rect.top + 150,
            bubbles: true
        });
        c.dispatchEvent(evt);
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    await browser.close();
})();
