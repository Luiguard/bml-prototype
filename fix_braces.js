const fs = require('fs');

let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

// Replace the specific duplicate braces from BEXParser
polyfillHtml = polyfillHtml.replace(/return rules;\s*\}\s*\}\s*\}\s*\}/, "return rules;\n            }\n        }");

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Fixed braces');
