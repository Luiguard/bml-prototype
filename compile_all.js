const fs = require('fs');
const path = require('path');
const { buildBweb } = require('./bweb-converter/compiler/bwebc-core');

const inputDir = '/home/benjamin/projects/mediclean-pro';
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.html') && !f.includes('test') && !f.includes('polyfill') && !f.includes('sitemap'));

(async () => {
    for (const file of files) {
        const bwebFile = file.replace('.html', '.bweb');
        const outPath = path.join(inputDir, bwebFile);
        console.log(`Compiling ${file} to ${bwebFile}...`);
        try {
            await buildBweb(inputDir, outPath, file);
        } catch (e) {
            console.error(`Failed to compile ${file}:`, e.message);
        }
    }
    console.log("Done compiling all!");
    process.exit(0);
})();
