const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const cleanHtml = html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])(.*?)\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, '');

console.log(cleanHtml.substring(0, 500));
console.log("\n\nBODY:");
console.log(cleanHtml.match(/<body[^>]*>([\s\S]*?)<header/)[0]);
