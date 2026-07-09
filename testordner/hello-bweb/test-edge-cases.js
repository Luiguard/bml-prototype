const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files', '--disable-web-security'] });
    const pageDOM = await browser.newPage();
    await pageDOM.setViewport({ width: 800, height: 600 });
    
    console.log("Loading Native DOM...");
    await pageDOM.goto(`file://${__dirname}/tests/edge-cases/13-edge-cases.html`, { waitUntil: 'networkidle0' });
    await pageDOM.screenshot({ path: '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/13-edge_dom.png' });
    
    const pageBWEB = await browser.newPage();
    await pageBWEB.setViewport({ width: 800, height: 600 });
    console.log("Loading BWEB Engine...");
    await pageBWEB.goto(`file://${__dirname}/bweb-engine.html?file=dist/13-edge.bweb`, { waitUntil: 'networkidle0' });
    
    // Give engine time to parse all chunks
    await new Promise(r => setTimeout(r, 1000));
    await pageBWEB.screenshot({ path: '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/13-edge_bweb.png' });
    
    console.log("Screenshots captured.");
    await browser.close();
})();
