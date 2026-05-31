const fs = require('fs');
const html = fs.readFileSync('/home/benjamin/projects/mediclean-pro/index.html', 'utf8');

const paths = [
    'css/style.v3.css',
    'css/responsive_auth.css',
    'css/accessibility.css'
];

let replacedHtml = html;
for (const p of paths) {
    const escapedPath = p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');
    replacedHtml = replacedHtml.replace(regex, `$1DATA_URL_FOR_${p}$2`);
}

const matches = replacedHtml.match(/DATA_URL_FOR_[^"'\)]+/g);
console.log("Replacements found:", matches);

const originalLinks = html.match(/<link[^>]+href=["'][^"']+["']/g);
console.log("Original Links:", originalLinks);

const replacedLinks = replacedHtml.match(/<link[^>]+href=["'][^"']+["']/g);
console.log("Replaced Links:", replacedLinks);
