const text = '<link href="/css/style.v3.css?v=22">';
const path = 'css/style.v3.css';
const escapedPath = path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');
console.log(regex);
console.log(text.replace(regex, `$1DATA$2`));
