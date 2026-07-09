const fs = require('fs');
let code = fs.readFileSync('/home/benjamin/projects/mediclean-pro/bweb-converter/converter.html', 'utf8');

code = code.replace(
    /const topChildren=\[\.\.\.body\.children\];\s*const wrapDiv=doc\.createElement\('div'\);\s*for\(const c of topChildren\)wrapDiv\.appendChild\(c\.cloneNode\(true\)\);\s*serNode\(wrapDiv,-1\);/,
    "serNode(body, -1);"
);

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/bweb-converter/converter.html', code);
console.log("Fixed DOM cloning issue!");
