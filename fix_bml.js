const fs = require('fs');

let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

// The BMLParser is broken because the original constructor didn't get fully replaced or something.
// Let's just find "this.nodes = [];" and replace it to add the missing brace!
polyfillHtml = polyfillHtml.replace(/this\.nodes = \[\];\s*parse\(\) \{/, "this.nodes = [];\n            }\n            parse() {");

// We also need to fix the syntax error at the bottom!
// Let's check test13.js from the bottom up to make sure no syntax errors.

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Fixed BML brace');
