const fs = require('fs');
const file = '/home/benjamin/projects/bml-prototype/bweb-converter/compiler/bwebc-core.js';
let code = fs.readFileSync(file, 'utf-8');
code = code.replace(
    /let mainHtmlRel = Object\.keys\(vfsManifest\.files\)\.find\(f => f === '[a-z_\-]+\.html'\);/g,
    "let mainHtmlRel = Object.keys(vfsManifest.files).find(f => f.endsWith('.html'));"
);
fs.writeFileSync(file, code);
