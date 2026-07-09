const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:12345/step12-viewer.html');
    
    // Inject some console logs into the page
    await page.evaluate(() => {
        const oldDispatch = dispatch;
        window.dispatch = function(action, target) {
            console.log("Dispatch called:", action, target);
            oldDispatch(action, target);
        };
        const oldAnimate = animate;
        let frames = 0;
        window.animate = function() {
            frames++;
            if (frames === 1) console.log("Animate running");
            oldAnimate();
        };
    });

    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Clicking Tab 2...");
    // Tab 2 button is around x=300, y=80 (approx)
    await page.mouse.click(300, 80);
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Clicking Counter...");
    // Counter button is around x=300, y=250 (approx)
    await page.mouse.click(300, 250);
    
    await new Promise(r => setTimeout(r, 1000));
    
    const state = await page.evaluate(() => window.state);
    console.log("State:", state);
    
    await browser.close();
})();
