import re
with open('bweb-converter/converter.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace clientSideConvert signature
text = text.replace('async function clientSideConvert(html){', 'async function clientSideConvert(baseHtml, variantMap = {}){')

# Replace compileFilesList signature & body up to "const bweb = await clientSideConvert"
# Actually, I'll just write a script to replace the entire compileFilesList and clientSideConvert functions.

# Find boundaries
start1 = text.find('async function compileFilesList(files) {')
end1 = text.find('document.getElementById(\'btnDownload\').addEventListener', start1)

if start1 == -1 or end1 == -1:
    print("Could not find compileFilesList bounds")
    exit(1)

text1 = text[:start1]
text2 = text[end1:]

# We need to construct the new functions
new_functions = """async function compileFilesList(files) {
    const htmlFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    let indexFile = htmlFiles.find(f => f.name === 'index.html' || f.name === 'index.htm');
    if (!indexFile && htmlFiles.length > 0) indexFile = htmlFiles[0];
    if (!indexFile) {
        alert("Keine HTML-Dateien im hochgeladenen Ordner gefunden!");
        return;
    }

    const btn = document.getElementById('btnFolderUpload');
    const oldText = btn.textContent;
    btn.textContent = 'Lese lokale Dateien...';
    btn.disabled = true;

    showLoader("Ordner-Kompilierung", "Analysiere hochgeladene Ordner-Struktur...");
    updateLoader(5, "Scanne Dateien...", `Gefunden: ${files.length} Dateien in der Struktur.`);

    try {
        const fileDataMap = {};
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
        }

        // Parse all HTML files
        const htmlMap = {};
        for (const hFile of htmlFiles) {
            let relativePath = hFile.customRelativePath || hFile.webkitRelativePath || hFile.name;
            if (relativePath.includes('/')) relativePath = relativePath.split('/').slice(1).join('/');
            let content = await hFile.text();
            
            // Inline assets
            for (const [path, dataUrl] of Object.entries(fileDataMap)) {
                const escapedPath = path.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
                const regex = new RegExp(`(["'\\\\(])(?:\\\\.\\\\/)?${escapedPath}(["'\\\\)])`, 'g');
                content = content.replace(regex, `$1${dataUrl}$2`);
            }
            htmlMap[relativePath] = content;
        }

        let baseHtml = htmlMap['index.html'] || htmlMap[Object.keys(htmlMap)[0]];
        
        // Spider variants by checking hrefs in baseHtml
        const variantMap = {};
        const hrefRegex = /href=['"]([^'"]+)['"]/g;
        let match;
        while ((match = hrefRegex.exec(baseHtml)) !== null) {
            const url = match[1];
            if (url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('tel:')) continue;
            
            // If it's another html file or has query params
            const pathPart = url.split('?')[0];
            if (htmlMap[pathPart]) {
                variantMap[url] = htmlMap[pathPart];
            } else if (htmlMap[url]) {
                variantMap[url] = htmlMap[url];
            } else if (url.includes('?') && pathPart === '') {
                 // like href="?type=buero" -> applies to index.html
                 variantMap[url] = baseHtml;
            }
        }
        
        // Ensure all physical HTML files are also added as variants if they aren't the base
        for (const [path, content] of Object.entries(htmlMap)) {
            if (content !== baseHtml && !variantMap[path]) {
                variantMap[path] = content;
            }
        }

        btn.textContent = 'Kompiliere in BWEB...';
        updateLoader(50, "Kompiliere in BWEB...", `Extrahiere DOM, CSS und ${Object.keys(variantMap).length} BDU-Varianten...`);
        
        const bweb = await clientSideConvert(baseHtml, variantMap);
        
        updateLoader(90, "Rendere Binärdaten...", "Konstruiere finale BWEB Struktur...");
        lastBweb = bweb;
        await renderBinary(bweb);
        document.getElementById('btnDownload').style.display = '';
        
        updateLoader(100, "Kompilierung erfolgreich!", "Das binäre BWEB-Paket wurde erfolgreich gerendert.");
        setTimeout(hideLoader, 800);
        
        showSuccessModal(lastBweb.byteLength, bdtNodes ? bdtNodes.length : 0);
    } catch(err) {
        hideLoader();
        alert("Fehler beim Kompilieren des Ordners: " + err);
    } finally {
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

"""

start2 = text2.find('async function clientSideConvert')
end2 = text2.find('(async()=>{', start2)

if start2 == -1 or end2 == -1:
    print("Could not find clientSideConvert bounds")
    exit(1)

text3 = text2[end2:]
text2 = text2[:start2] # should be empty or just spaces/newlines usually

with open('scratch/new_client_side_convert.js', 'r') as f:
    new_convert = f.read()

final_text = text1 + new_functions + "\\n" + text2 + new_convert + "\\n" + text3

with open('bweb-converter/converter.html', 'w', encoding='utf-8') as f:
    f.write(final_text)

print("Patch applied successfully.")
