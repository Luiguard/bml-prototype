const fs = require('fs');
const file = '/home/benjamin/projects/bml-prototype/bweb-converter/compiler/html-css-extractor.js';
let code = fs.readFileSync(file, 'utf-8');
if (!code.includes('setJavaScriptEnabled')) {
    code = code.replace(
        'const page = await browser.newPage();',
        'const page = await browser.newPage();\n        await page.setJavaScriptEnabled(false);'
    );
    fs.writeFileSync(file, code);
}
