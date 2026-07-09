import re

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the single loop with a three-pass loop:
# 1. Read non-CSS as Data URL, store CSS as text
# 2. Process CSS text with regex, then convert to Data URL
# 3. Process HTML files (unchanged logic)

old_loop = """        const fileDataMap = {};
        let readCount = 0;
        
        for (const file of files) {
            if (htmlFiles.includes(file)) continue; // skip htmls for inline mapping
            readCount++;
            const pct = Math.round(5 + (readCount / files.length) * 20);
            updateLoader(pct, `Lese ${file.name}...`, `Verarbeite Asset: ${file.name}`);

            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });
            
            let relativePath = file.customRelativePath;
            if (!relativePath && file.webkitRelativePath) {
                const pathParts = file.webkitRelativePath.split('/');
                pathParts.shift();
                relativePath = pathParts.join('/');
            }
            if (!relativePath) relativePath = file.name;
            fileDataMap[relativePath] = dataUrl;
            fileDataMap[file.name] = dataUrl;
        }"""

new_loop = """        const fileDataMap = {};
        const cssMap = {};
        let readCount = 0;
        
        // Pass 1: Read non-CSS assets as Data URLs, CSS as text
        for (const file of files) {
            if (htmlFiles.includes(file)) continue;
            readCount++;
            updateLoader(Math.round(5 + (readCount / files.length) * 10), `Lese ${file.name}...`, `Verarbeite Asset: ${file.name}`);

            let relativePath = file.customRelativePath;
            if (!relativePath && file.webkitRelativePath) {
                const pathParts = file.webkitRelativePath.split('/');
                pathParts.shift();
                relativePath = pathParts.join('/');
            }
            if (!relativePath) relativePath = file.name;

            if (file.name.endsWith('.css')) {
                cssMap[relativePath] = await file.text();
            } else {
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = ev => resolve(ev.target.result);
                    reader.readAsDataURL(file);
                });
                fileDataMap[relativePath] = dataUrl;
                fileDataMap[file.name] = dataUrl;
            }
        }

        // Pass 2: Inline assets into CSS and convert CSS to Data URL
        let cssCount = 0;
        for (let [cssPath, cssText] of Object.entries(cssMap)) {
            cssCount++;
            updateLoader(Math.round(15 + (cssCount / Object.keys(cssMap).length) * 5), `Inline CSS...`, `Verarbeite CSS: ${cssPath}`);
            
            for (const [assetPath, dataUrl] of Object.entries(fileDataMap)) {
                const escapedPath = assetPath.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
                const regex = new RegExp(`(["'\\\\(])(?:[.\\\\/\\\\\\\\]+)?${escapedPath}(?:\\\\?[^"'\\\\)]*)?(["'\\\\)])`, 'g');
                cssText = cssText.replace(regex, `$1${dataUrl}$2`);
            }
            
            const base64Css = btoa(unescape(encodeURIComponent(cssText)));
            const cssDataUrl = 'data:text/css;base64,' + base64Css;
            fileDataMap[cssPath] = cssDataUrl;
            fileDataMap[cssPath.split('/').pop()] = cssDataUrl;
        }"""

if old_loop in content:
    content = content.replace(old_loop, new_loop)
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: CSS inlining logic patched.")
else:
    print("FAILED: Old loop not found.")
