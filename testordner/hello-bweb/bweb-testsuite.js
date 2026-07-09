const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch').default;
const fs = require('fs');
const { PNG } = require('pngjs');
const path = require('path');
const { execSync } = require('child_process');

const testsDir = path.join(__dirname, 'tests/layout');
const outputDir = path.join(__dirname, 'tests/output');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
    const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.html'));

    console.log(`Starte Test-Suite für ${files.length} Edge-Cases...`);

    for (const file of files) {
        const name = file.replace('.html', '');
        console.log(`\n--- Test: ${name} ---`);
        
        const htmlPath = path.join(testsDir, file);
        const bwebPath = path.join(outputDir, `${name}.bweb`);
        const domScreenshotPath = path.join(outputDir, `${name}_dom.png`);
        const bwebScreenshotPath = path.join(outputDir, `${name}_bweb.png`);
        const diffScreenshotPath = path.join(outputDir, `${name}_diff.png`);

        // 1. Screenshot DOM
        const pageDOM = await browser.newPage();
        await pageDOM.setViewport({ width: 800, height: 800 });
        await pageDOM.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
        await pageDOM.screenshot({ path: domScreenshotPath });
        await pageDOM.close();

        // 2. Compile BWEB
        execSync(`node bwebc.js build "${htmlPath}" "${bwebPath}"`, { stdio: 'ignore' });
        
        // 3. Screenshot BWEB Viewer
        const pageBWEB = await browser.newPage();
        await pageBWEB.setViewport({ width: 800, height: 800 });
        // Create an ad-hoc viewer for this file
        const viewerHtml = fs.readFileSync('bweb-engine.html', 'utf8').replace('dist/hello.bweb', `tests/output/${name}.bweb`);
        const tmpViewerPath = path.join(__dirname, `tmp-viewer-${name}.html`);
        fs.writeFileSync(tmpViewerPath, viewerHtml);
        
        await pageBWEB.goto(`file://${tmpViewerPath}`);
        await new Promise(r => setTimeout(r, 500)); // wait for load
        
        // Hide canvas box shadow for exact comparison
        await pageBWEB.evaluate(() => {
            const canvas = document.getElementById('bwebCanvas');
            canvas.style.boxShadow = 'none';
            // Align canvas exactly top left
            document.body.style.padding = '0';
            document.body.style.margin = '0';
            document.body.style.display = 'block';
        });
        
        await pageBWEB.screenshot({ path: bwebScreenshotPath });
        await pageBWEB.close();
        fs.unlinkSync(tmpViewerPath);

        // 4. Pixelmatch
        const img1 = PNG.sync.read(fs.readFileSync(domScreenshotPath));
        const img2 = PNG.sync.read(fs.readFileSync(bwebScreenshotPath));
        const { width, height } = img1;
        const diff = new PNG({ width, height });

        const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
        fs.writeFileSync(diffScreenshotPath, PNG.sync.write(diff));

        console.log(`Ergebnis ${name}: ${numDiffPixels} abweichende Pixel.`);
        if (numDiffPixels < 1000) {
            console.log(`✅ ${name} bestanden!`);
        } else {
            console.log(`❌ ${name} fehlgeschlagen!`);
        }
    }

    await browser.close();
    console.log("\nGolden-Files unter /tests/output/ gespeichert.");
})();
