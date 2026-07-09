const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = '/home/benjamin/projects/mediclean-pro';
const BWEBC_PATH = '/home/benjamin/projects/bml-prototype/bweb-converter/bwebc.js';
const SITEMAP_PATH = path.join(PROJECT_DIR, 'sitemap.html');

let sitemapHtml = fs.readFileSync(SITEMAP_PATH, 'utf-8');
const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+\.bweb)(\?[^"']*)?["']/g;
const bwebFiles = new Set();
let match;
while ((match = linkRegex.exec(sitemapHtml)) !== null) {
    let f = match[1];
    if (f.startsWith('/')) f = f.substring(1);
    if (!f.includes('/')) {
        bwebFiles.add(f);
    }
}
bwebFiles.add('index.bweb'); // Ensure index is built
console.log('Strict Optimized Build for:', Array.from(bwebFiles));

for (const bweb of bwebFiles) {
    const file = bweb.replace('.bweb', '.html');
    const fullPath = path.join(PROJECT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;

    console.log(`\n--- Strict Compiling ${file} ---`);
    const tempDir = path.join('/tmp', `bweb_build_${file.replace('.html', '')}`);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    // ONLY copy allowed folders
    const allowedItems = ['css', 'js', 'fonts', 'favicon.svg', 'icon-192.png'];
    for (const item of allowedItems) {
        const srcPath = path.join(PROJECT_DIR, item);
        const destPath = path.join(tempDir, item);
        if (fs.existsSync(srcPath)) {
            fs.cpSync(srcPath, destPath, { recursive: true });
        }
    }
    
    // Copy the target HTML
    fs.copyFileSync(fullPath, path.join(tempDir, 'index.html'));

    const htmlContent = fs.readFileSync(path.join(tempDir, 'index.html'), 'utf-8');
    let cssContents = '';
    const cssDir = path.join(tempDir, 'css');
    if (fs.existsSync(cssDir)) {
        const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
        for (const cf of cssFiles) {
            cssContents += fs.readFileSync(path.join(cssDir, cf), 'utf-8') + '\n';
        }
    }

    const allContent = htmlContent + '\n' + cssContents;
    const imgRegex = /images\/[a-zA-Z0-9_\-\.\/]+/g;
    const usedImages = new Set();
    let imgMatch;
    while ((imgMatch = imgRegex.exec(allContent)) !== null) {
        usedImages.add(imgMatch[0]);
    }
    
    for (const img of usedImages) {
        const srcImg = path.join(PROJECT_DIR, img);
        if (fs.existsSync(srcImg)) {
            const destImg = path.join(tempDir, img);
            fs.mkdirSync(path.dirname(destImg), { recursive: true });
            fs.copyFileSync(srcImg, destImg);
        }
    }
    
    console.log(`Copied ${usedImages.size} used images to temp dir.`);

    const outPath = path.join(PROJECT_DIR, bweb);
    
    try {
        execSync(`node ${BWEBC_PATH} build ${tempDir} ${outPath}`, { stdio: 'inherit' });
        const stats = fs.statSync(outPath);
        console.log(`Successfully compiled ${bweb} (Size: ${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (e) {
        console.error(`Failed to compile ${file}`);
    }
}
