const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');

const path = 'css/style.v3.css';
const dataUrl = 'data:text/css;base64,TEST_DATA_URL';
const escapedPath = path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');

const newHtml = indexHtml.replace(regex, `$1${dataUrl}$2`);

console.log("Original match:");
const match = indexHtml.match(new RegExp(`.{0,30}${escapedPath}.{0,30}`));
console.log(match ? match[0] : "Not found");

console.log("\nReplaced match:");
const newMatch = newHtml.match(/.{0,30}TEST_DATA_URL.{0,30}/);
console.log(newMatch ? newMatch[0] : "Not found");
