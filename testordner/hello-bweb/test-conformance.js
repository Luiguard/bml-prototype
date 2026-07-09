const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const PNG = require('pngjs').PNG;

const URLs = [
    { name: 'example', url: 'https://example.com' },
    { name: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Web_browser' },
    { name: 'todomvc', url: 'https://todomvc.com/examples/vanillajs/' }
];

const OUTPUT_DIR = '/home/benjamin/.gemini/antigravity-ide/brain/e8635374-d478-462b-b437-6c990d2a287a/conformance';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
    const pixelmatch = (await import('pixelmatch')).default;
    const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files', '--disable-web-security'] });

    for (const site of URLs) {
        console.log(`\nTesting ${site.name} (${site.url})`);
        
        let domImgPath, bwebImgPath;

        try {
            const pageDOM = await browser.newPage();
            await pageDOM.setViewport({ width: 1024, height: 768 });
            
            console.log(`  [DOM] Loading URL...`);
            await pageDOM.goto(site.url, { waitUntil: 'networkidle0', timeout: 30000 });
            
            // disable animations/transitions to prevent unstable diffs
            await pageDOM.addStyleTag({content: '* { transition: none !important; animation: none !important; }'});
            await new Promise(r => setTimeout(r, 1000));
            
            domImgPath = path.join(OUTPUT_DIR, `${site.name}_dom.png`);
            await pageDOM.screenshot({ path: domImgPath });
            
            const domA11y = await pageDOM.accessibility.snapshot();
            fs.writeFileSync(path.join(OUTPUT_DIR, `${site.name}_dom_a11y.json`), JSON.stringify(domA11y, null, 2));
            
            await pageDOM.close();

            console.log(`  [BWEB] Compiling...`);
            const bwebFile = `dist/${site.name}.bweb`;
            execSync(`node bwebc.js build ${site.url} ${bwebFile}`, { stdio: 'pipe' });

            console.log(`  [BWEB] Rendering Engine...`);
            const pageBWEB = await browser.newPage();
            await pageBWEB.setViewport({ width: 1024, height: 768 });
            
            const engineUrl = `file://${__dirname}/bweb-engine.html?file=${bwebFile}`;
            await pageBWEB.goto(engineUrl, { waitUntil: 'networkidle0' });
            
            // Wait for streams and rendering to finish
            await new Promise(r => setTimeout(r, 3000)); 
            
            bwebImgPath = path.join(OUTPUT_DIR, `${site.name}_bweb.png`);
            await pageBWEB.screenshot({ path: bwebImgPath });
            
            const bwebA11y = await pageBWEB.accessibility.snapshot();
            fs.writeFileSync(path.join(OUTPUT_DIR, `${site.name}_bweb_a11y.json`), JSON.stringify(bwebA11y, null, 2));

            await pageBWEB.close();

            console.log(`  [DIFF] Calculating Pixel Match...`);
            const img1 = PNG.sync.read(fs.readFileSync(domImgPath));
            const img2 = PNG.sync.read(fs.readFileSync(bwebImgPath));
            const { width, height } = img1;
            const diff = new PNG({ width, height });
            const diffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
            fs.writeFileSync(path.join(OUTPUT_DIR, `${site.name}_diff.png`), PNG.sync.write(diff));
            
            const matchPercent = (100 - (diffPixels / (width * height)) * 100).toFixed(2);
            console.log(`  [RESULT] Pixel Match: ${matchPercent}%`);

        } catch (e) {
            console.error(`  [ERROR] Failed to test ${site.name}:`, e.message);
        }
    }

    await browser.close();
    console.log('\nConformance Suite finished.');
})();
