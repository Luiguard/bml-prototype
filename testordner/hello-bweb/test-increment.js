const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto('http://localhost:12345/step12-viewer.html');
    await new Promise(r => setTimeout(r, 1000));
    
    // Dispatch increment directly
    await page.evaluate(() => {
        dispatch('increment', null);
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Save screenshot to check
    await page.screenshot({ path: 'test-counter.png' });
    
    const textNodeValue = await page.evaluate(() => {
        let val = null;
        for(let i=0; i<bwebNodesCount; i++) {
            const n = bwebNodes[i];
            if (n.meta && n.meta['data-id'] === 'counter') {
                let cid = n.firstChildId;
                while (cid !== 0xFFFF) {
                    if (bwebNodes[cid].isText) val = bwebNodes[cid].text;
                    cid = bwebNodes[cid].nextSiblingId;
                }
            }
        }
        return val;
    });
    console.log("Counter text node value:", textNodeValue);
    
    await browser.close();
})();
