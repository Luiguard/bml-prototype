import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

new_ui = """
document.getElementById('btnFolderUpload').addEventListener('click', () => {
    document.getElementById('folderInput').click();
});

document.getElementById('folderInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    await compileFilesList(files);
    e.target.value = '';
});

async function readEntryRecursively(entry, path = '', filesList = []) {
    if (entry.isFile) {
        const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
        });
        file.customRelativePath = path ? `${path}/${file.name}` : file.name;
        filesList.push(file);
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve) => {
            const allEntries = [];
            function readBatch() {
                dirReader.readEntries((batch) => {
                    if (batch.length === 0) resolve(allEntries);
                    else { allEntries.push(...batch); readBatch(); }
                }, () => resolve(allEntries));
            }
            readBatch();
        });
        const currentPath = path ? `${path}/${entry.name}` : entry.name;
        for (const childEntry of entries) {
            await readEntryRecursively(childEntry, currentPath, filesList);
        }
    }
    return filesList;
}

async function compileFilesList(files) {
    const htmlFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    const assetFiles = files.filter(f => !f.name.endsWith('.html') && !f.name.endsWith('.htm'));

    if (htmlFiles.length === 0) {
        alert("Keine HTML Dateien im Ordner gefunden!");
        return;
    }

    const btn = document.getElementById('btnFolderUpload');
    const oldText = btn.textContent;
    btn.textContent = 'Lese lokale Dateien...';
    btn.disabled = true;

    showLoader("Ordner-Kompilierung", "Analysiere hochgeladene Ordner-Struktur...");
    
    try {
        const fileDataMap = {};
        for (const file of assetFiles) {
            let dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });
            if (file.name.endsWith('.css')) dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:text/css;');
            else if (file.name.endsWith('.js')) dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:application/javascript;');
            else if (file.name.endsWith('.svg')) dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:image/svg+xml;');

            let relativePath = file.customRelativePath || file.webkitRelativePath || file.name;
            if (relativePath && relativePath.includes('/')) {
                const pathParts = relativePath.split('/');
                pathParts.shift(); // Remove root folder
                relativePath = pathParts.join('/');
            }
            fileDataMap[relativePath] = dataUrl;
            fileDataMap[file.name] = dataUrl;
        }

        const htmlMap = {};
        for (const file of htmlFiles) {
            let relativePath = file.customRelativePath || file.webkitRelativePath || file.name;
            if (relativePath && relativePath.includes('/')) {
                const pathParts = relativePath.split('/');
                pathParts.shift(); // Remove root folder
                relativePath = pathParts.join('/');
            }
            if(!relativePath.startsWith('/')) relativePath = '/' + relativePath;
            
            let html = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = ev => r(ev.target.result);
                reader.readAsText(file);
            });
            
            // Inline assets!
            html = html.replace(/href=["']([^"']+\.css)["']/ig, (match, p1) => {
                let cleanPath = p1.replace(/^\\.\\//, '');
                return `href="${fileDataMap[cleanPath] || fileDataMap[cleanPath.split('/').pop()] || p1}"`;
            });
            html = html.replace(/src=["']([^"']+\.js)["']/ig, (match, p1) => {
                let cleanPath = p1.replace(/^\\.\\//, '');
                return `src="${fileDataMap[cleanPath] || fileDataMap[cleanPath.split('/').pop()] || p1}"`;
            });
            html = html.replace(/src=["']([^"']+\\.(png|jpe?g|svg|webp|gif))["']/ig, (match, p1) => {
                let cleanPath = p1.replace(/^\\.\\//, '');
                return `src="${fileDataMap[cleanPath] || fileDataMap[cleanPath.split('/').pop()] || p1}"`;
            });
            
            htmlMap[relativePath] = html;
        }
        
        await clientSideConvert(htmlMap);
        
        btn.textContent = oldText;
        btn.disabled = false;
    } catch(e) {
        console.error(e);
        alert("Fehler bei der Konvertierung: " + e);
        btn.textContent = oldText;
        btn.disabled = false;
        hideLoader();
    }
}
</script>
</body>
</html>
"""

content = content.replace("</script>\n</body>\n</html>", new_ui)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Frontend logic patched.")
