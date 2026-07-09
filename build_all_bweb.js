const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = '/home/benjamin/projects/mediclean-pro';
const BWEBC_PATH = '/home/benjamin/projects/bml-prototype/bweb-converter/bwebc.js';
const SITEMAP_PATH = path.join(PROJECT_DIR, 'sitemap.html');

// Read sitemap to find target html files
let sitemapHtml = fs.readFileSync(SITEMAP_PATH, 'utf-8');
const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+\.html)(\?[^"']*)?["']/g;
const htmlFiles = new Set();
let match;
while ((match = linkRegex.exec(sitemapHtml)) !== null) {
    let f = match[1];
    if (f.startsWith('/')) f = f.substring(1);
    if (!f.includes('/')) {
        htmlFiles.add(f);
    }
}

console.log('Found HTML files to compile:', Array.from(htmlFiles));

for (const file of htmlFiles) {
    const fullPath = path.join(PROJECT_DIR, file);
    if (!fs.existsSync(fullPath)) continue;

    console.log(`Compiling ${file}...`);
    
    // We modify bwebc-core.js temporarily using sed to target this specific HTML file!
    const coreJsPath = '/home/benjamin/projects/bml-prototype/bweb-converter/compiler/bwebc-core.js';
    const originalCore = fs.readFileSync(coreJsPath, 'utf-8');
    
    // Replace the line that finds the main HTML to specifically target our file
    const patchedCore = originalCore.replace(
        /let mainHtmlRel = Object\.keys\(vfsManifest\.files\)\.find\(f => f\.endsWith\('\.html'\)\);/g,
        `let mainHtmlRel = Object.keys(vfsManifest.files).find(f => f === '${file}');`
    );
    fs.writeFileSync(coreJsPath, patchedCore);

    const outName = file.replace('.html', '.bweb');
    const outPath = path.join(PROJECT_DIR, outName);
    
    try {
        execSync(`node ${BWEBC_PATH} build ${PROJECT_DIR} ${outPath}`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to compile ${file}`);
    }

    // Restore original core
    fs.writeFileSync(coreJsPath, originalCore);

    // Update sitemap.html to link to the new .bweb via polyfill or directly
    // Assuming the user wants direct links to .bweb files
    sitemapHtml = sitemapHtml.replace(new RegExp(`href=["']/?${file}(\\?[^"']*)?["']`, 'g'), `href="/${outName}$1"`);
}

fs.writeFileSync(SITEMAP_PATH, sitemapHtml);
console.log('sitemap.html updated successfully.');
