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
    
    // Click on Tab 2 button! Tab 1 is x=101 to 301. Tab 2 is 301 to 501.
    // So x=400, y=80 should hit Tab 2.
    console.log("Clicking Tab 2...");
    await page.evaluate(() => {
        const c = document.getElementById('bwebCanvas');
        const rect = c.getBoundingClientRect();
        const evt = new MouseEvent('click', {
            clientX: rect.left + 400,
            clientY: rect.top + 20,
            bubbles: true
        });
        c.dispatchEvent(evt);
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    // Tab 2 should be active now.
    // Let's click the increment button.
    // It's in the middle of Tab 2 content. Let's try x=400, y=200
    console.log("Clicking Increment...");
    await page.evaluate(() => {
        const c = document.getElementById('bwebCanvas');
        const rect = c.getBoundingClientRect();
        const evt = new MouseEvent('click', {
            clientX: rect.left + 250,
            clientY: rect.top + 200,
            bubbles: true
        });
        c.dispatchEvent(evt);
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    await browser.close();
})();
