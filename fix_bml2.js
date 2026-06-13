const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

polyfillHtml = polyfillHtml.replace(
    /const el = bmlNodes\[id\];/g,
    "const el = bmlNodes[id - 1]; // NodeIDs are 1-indexed from HtmlCssExtractor!"
);

polyfillHtml = polyfillHtml.replace(
    /const parentEl = bmlNodes\[parentId\];/g,
    "const parentEl = bmlNodes[parentId - 1];"
);

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Fixed BDT indexing');
