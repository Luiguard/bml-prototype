const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

polyfillHtml = polyfillHtml.replace(
    /sections\[type\] = chunk;/g,
    "sections[type] = chunk; console.log('Parsed section', type, 'len', chunk.byteLength);"
);

polyfillHtml = polyfillHtml.replace(
    /const bmlBuf=sections\[1\];/,
    "const bmlBuf=sections[1]; console.log('BML buffer exists:', !!bmlBuf);"
);

polyfillHtml = polyfillHtml.replace(
    /rootEl=parser\.parseNode\(\);/,
    "rootEl=parser.parseNode(); console.log('Parsed root node:', rootEl);"
);

polyfillHtml = polyfillHtml.replace(
    /if\(rootEl\)\{\s*target\.appendChild\(rootEl\);\s*\}/,
    "if(rootEl){ target.appendChild(rootEl); console.log('Appended to target'); } else { console.log('rootEl is null!'); }"
);

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Added debug logs');
