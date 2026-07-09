        
        const dirEntries = [];
        
        if (data.bibLen > 0) {
            dirEntries.push({ id: 4, offset: off + 5, len: data.bibLen });
            ou[off++] = 4;
            ov.setUint32(off, data.bibLen); off += 4;
            ou.set(data.bibData, off); off += data.bibLen;
        }
        
        dirEntries.push({ id: 8, offset: off + 5, len: payloadSize });
        ou[off++] = 8; // BPG
        ov.setUint32(off, payloadSize); off += 4;
        ou[off++] = 0x42; ou[off++] = 0x50; ou[off++] = 0x47; ou[off++] = 0x01; // BPG\x01
        ov.setUint16(off, urlBytes.length); off += 2;
        ou.set(urlBytes, off); off += urlBytes.length;
        ou[off++] = data.bexBuf ? 4 : 3;
        
        ou[off++] = 1; ov.setUint32(off, data.bmlData.length); off += 4; ou.set(data.bmlData, off); off += data.bmlData.length;
        ou[off++] = 2; ov.setUint32(off, data.bdtBuf.byteLength); off += 4; ou.set(new Uint8Array(data.bdtBuf), off); off += data.bdtBuf.byteLength;
        ou[off++] = 3; ov.setUint32(off, data.blbBuf.byteLength); off += 4; ou.set(new Uint8Array(data.blbBuf), off); off += data.blbBuf.byteLength;
        if (data.bexBuf) { ou[off++] = 7; ov.setUint32(off, data.bexBuf.byteLength); off += 4; ou.set(new Uint8Array(data.bexBuf), off); off += data.bexBuf.byteLength; }

        const actualDirOffset = off;
        ov.setUint32(headerDirOffsetPos, actualDirOffset);
        ov.setUint16(off, dirEntries.length); off += 2;
        for (const entry of dirEntries) {
            ou[off++] = entry.id;
            ov.setUint32(off, entry.offset); off += 4;
            ov.setUint32(off, entry.len); off += 4;
        }

        lastBweb = out;
        await renderBinary(out);
        document.getElementById('btnDownload').style.display='';
        showSuccessModal(lastBweb.byteLength, bdtNodes ? bdtNodes.length : 0);
    } catch(err) {
        alert("Fehler bei der Konvertierung: " + err);
    }
});

document.getElementById('btnFolderUpload').addEventListener('click', () => {
    document.getElementById('folderInput').click();
});

document.getElementById('folderInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    await compileFilesList(files);
    e.target.value = '';
});

// Recursive Directory Reader via HTML5 File System API
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
                    if (batch.length === 0) {
                        resolve(allEntries);
                    } else {
                        allEntries.push(...batch);
                        readBatch();
                    }
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

// Robust Folder Compiler with Regex Path-Mapping and BPG Architecture
async function compileFilesList(files) {
    const htmlFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    const globalExtractedImages = [];
    const assetFiles = files.filter(f => !f.name.endsWith('.html') && !f.name.endsWith('.htm'));
    
    if (htmlFiles.length === 0) {
        alert("Keine HTML Dateien im Ordner gefunden!");
        return;
    }

    // Sort index to be first, prioritizing root index.html
    htmlFiles.sort((a,b) => {
        const aPath = a.customRelativePath || a.webkitRelativePath || a.name;
        const bPath = b.customRelativePath || b.webkitRelativePath || b.name;
        const aDepth = (aPath.match(/\//g) || []).length;
        const bDepth = (bPath.match(/\//g) || []).length;

        if (a.name === 'index.html' || a.name === 'index.htm') {
            if (b.name !== 'index.html' && b.name !== 'index.htm') return -1;
            return aDepth - bDepth;
        }
        if (b.name === 'index.html' || b.name === 'index.htm') return 1;
        return aDepth - bDepth;
    });

    const btn = document.getElementById('btnFolderUpload');
    const oldText = btn.textContent;
    btn.textContent = 'Lese lokale Dateien...';
    btn.disabled = true;

    showLoader("Ordner-Kompilierung", "Analysiere hochgeladene Ordner-Struktur...");
    updateLoader(5, "Scanne Dateien...", `Gefunden: ${htmlFiles.length} Seiten, ${assetFiles.length} Assets.`);

    try {
        const fileDataMap = {};
        let readCount = 0;
        
        // 1. Process Non-HTML Assets
        for (const file of assetFiles) {
            readCount++;
            const pct = Math.round(5 + (readCount / assetFiles.length) * 15);
            updateLoader(pct, `Lese ${file.name}...`, `Verarbeite Asset: ${file.name}`);

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
                pathParts.shift(); // Remove root folder (e.g., 'mediclean-pro/')
                relativePath = pathParts.join('/');
            }
            
            fileDataMap[relativePath] = dataUrl;
            fileDataMap[file.name] = dataUrl;
        }

        // 2. Process HTML Pages into BPG Blocks
        const bpgBlocks = [];
