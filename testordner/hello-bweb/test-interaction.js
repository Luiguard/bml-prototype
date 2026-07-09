const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });

    const viewerHtml = fs.readFileSync('bweb-engine.html', 'utf8').replace('dist/hello.bweb', `tests/output/10-dom-api.bweb`);
    const tmpViewerPath = path.join(__dirname, `tmp-viewer-10-interaction.html`);
    fs.writeFileSync(tmpViewerPath, viewerHtml);
    
    console.log("Loading page...");
    await page.goto(`file://${tmpViewerPath}`);
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Initial state screenshot...");
    await page.screenshot({ path: 'tests/output/10-dom-api-initial.png' });
    
    // Simulate click on Tab 2
    // We need to trigger the pointerdown on the canvas at the coordinates of Tab 2.
    // Let's assume Tab 1 is at ~40px, Tab 2 is next to it. Tab 1 width is ~80px.
    // Let's click at x=150, y=100
    console.log("Clicking Tab 2...");
    await page.mouse.click(150, 95);
    await new Promise(r => setTimeout(r, 500));
    
    console.log("State after click screenshot...");
    await page.screenshot({ path: 'tests/output/10-dom-api-clicked.png' });
    
    // Click counter btn
    console.log("Clicking counter btn...");
    await page.mouse.click(150, 160);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'tests/output/10-dom-api-counter.png' });
    
    await browser.close();
    fs.unlinkSync(tmpViewerPath);
    console.log("Done.");
})();
