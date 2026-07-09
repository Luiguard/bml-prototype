const cssText = `background: url('../images/logo.png');`;
const fileDataMap = { 'images/logo.png': 'data:image/png;base64,123' };
let content = cssText;
for (const [path, dataUrl] of Object.entries(fileDataMap)) {
    const escapedPath = path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(["'\\(])(?:[.\\/\\\\]+)?${escapedPath}(?:\\?[^"'\\)]*)?(["'\\)])`, 'g');
    content = content.replace(regex, `$1${dataUrl}$2`);
}
console.log(content);
