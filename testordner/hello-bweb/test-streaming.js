const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });

    console.log("Loading page...");
    // we use a timestamp so it fetches the new page
    await page.goto(`file://${__dirname}/bweb-engine.html`);
    
    // Check performance
    await new Promise(r => setTimeout(r, 100));
    await page.screenshot({ path: '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/12-stream-1-bml.png' });
    console.log("Screenshot 1: Text-only (BML)");

    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/12-stream-2-blb.png' });
    console.log("Screenshot 2: Full Layout (BLB)");
    
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/12-stream-3-bib.png' });
    console.log("Screenshot 3: Media Loaded (BIB)");
    
    // Benchmark DOM version
    await page.goto(`file://${__dirname}/12-benchmark.html`);
    await new Promise(r => setTimeout(r, 500));
    const results = await page.evaluate(() => {
        const start = performance.now();
        document.body.offsetHeight; // Force reflow
        return performance.now() - start;
    });
    console.log(`Native DOM Reflow/Layout took: ${results.toFixed(2)} ms`);

    await browser.close();
    console.log("Done.");
})();
