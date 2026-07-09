const text = '<link href="/css/style.v3.css?v=22">';
const escapedPath = 'style\\.v3\\.css';
const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');
console.log(text.replace(regex, `$1DATA$2`));
