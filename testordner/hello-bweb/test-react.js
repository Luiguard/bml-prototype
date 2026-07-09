const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });

    const viewerHtml = fs.readFileSync('bweb-engine.html', 'utf8').replace('dist/hello.bweb', `11-react-app/dist/index.bweb`);
    const tmpViewerPath = path.join(__dirname, `tmp-viewer-react.html`);
    fs.writeFileSync(tmpViewerPath, viewerHtml);
    
    console.log("Loading page...");
    await page.goto(`file://${tmpViewerPath}`);
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
        const canvas = document.getElementById('bwebCanvas');
        canvas.style.boxShadow = 'none';
        document.body.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.display = 'block';
    });

    console.log("Screenshotting React BWEB...");
    await page.screenshot({ path: '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/11-react-bweb.png' });
    
    await browser.close();
    fs.unlinkSync(tmpViewerPath);
    console.log("Done.");
})();
