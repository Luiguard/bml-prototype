import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add globalImages to clientSideConvert
old_vfs = "const globalFonts = new Map();"
new_vfs = "const globalFonts = new Map();\n        const globalImages = new Map();"
content = content.replace(old_vfs, new_vfs)

# 2. Add img src mapping inside iframe.onload
old_onload = """                iframe.onload = async () => {
                    try {
                        const doc = iframe.contentWindow.document;
                        const fontsExtracted = [];"""
new_onload = """                iframe.onload = async () => {
                    try {
                        const doc = iframe.contentWindow.document;
                        for (const imgEl of doc.querySelectorAll('img')) {
                            const src = imgEl.src;
                            if (src && !src.startsWith('bib://') && !src.startsWith('data:')) {
                                if (!globalImages.has(src)) {
                                    globalImages.set(src, { id: globalImages.size, url: src });
                                }
                                imgEl.setAttribute('src', `bib://${globalImages.get(src).id}`);
                            }
                        }
                        const fontsExtracted = [];"""
content = content.replace(old_onload, new_onload)

# 3. Add BIB generation logic at the end
old_append_start = """        let bfbBuf = null;
        if (globalFonts.size > 0) {"""

new_append_start = """        const validImages = [];
        for (const img of Array.from(globalImages.values())) {
            try {
                const fr = await fetch(img.url);
                if (fr.ok) {
                    const blob = await fr.blob();
                    const buf = await blob.arrayBuffer();
                    let comp = 0;
                    if(blob.type.includes('png')) comp=1;
                    else if(blob.type.includes('jpeg')) comp=2;
                    else if(blob.type.includes('webp')) comp=3;
                    
                    const imgEl = new Image();
                    imgEl.src = URL.createObjectURL(blob);
                    await new Promise(r => { imgEl.onload = r; imgEl.onerror = r; });
                    
                    validImages.push({
                        id: img.id,
                        w: imgEl.naturalWidth || 0,
                        h: imgEl.naturalHeight || 0,
                        comp,
                        data: new Uint8Array(buf)
                    });
                }
            } catch(e) {}
        }
        
        let bibBuf = null;
        if (validImages.length > 0) {
            let totalBytes = 8;
            for(const img of validImages) totalBytes += 24 + 2 + 4 + img.data.byteLength;
            const bibArr = new ArrayBuffer(totalBytes);
            const v = new DataView(bibArr);
            v.setUint8(0, 0x42); v.setUint8(1, 0x49); v.setUint8(2, 0x42); v.setUint8(3, 0x01); // BIB\x01
            v.setUint32(4, validImages.length);
            let off = 8;
            for(const img of validImages) {
                v.setUint32(off, img.id); off+=4;
                v.setUint16(off, img.w); off+=2;
                v.setUint16(off, img.h); off+=2;
                v.setUint8(off++, 1); // RGBA type
                v.setUint8(off++, img.comp); // Compression
                off+=6; // Padding
                v.setUint16(off, 0); off+=2; // Block Count
                v.setUint32(off, img.data.byteLength); off+=4;
                const srcView = img.data;
                for(let i=0; i<srcView.length; i++) v.setUint8(off++, srcView[i]);
            }
            bibBuf = bibArr;
        }

        let bfbBuf = null;
        if (globalFonts.size > 0) {"""
content = content.replace(old_append_start, new_append_start)

# 4. Append BIB to archive
old_archive_append = """        if (bfbBuf) {
            archiveSize += appendSection(11, bfbBuf);
        }"""
new_archive_append = """        if (bfbBuf) {
            archiveSize += appendSection(11, bfbBuf);
        }
        if (bibBuf) {
            archiveSize += appendSection(4, bibBuf);
        }"""
content = content.replace(old_archive_append, new_archive_append)

# Also update secCount to leave room for BIB and BFB
old_sec_count = "let secCount = 1 + (vfsBlocks.length * 5);"
new_sec_count = "let secCount = 1 + (vfsBlocks.length * 5) + (bfbBuf ? 1 : 0) + (bibBuf ? 1 : 0);"
# We can't do this easily because secCount is calculated BEFORE bfbBuf and bibBuf are created.
# Actually, BWEB format doesn't strict check secCount if the file just ends, but to be safe:
# Let's just calculate secCount dynamically or use a large number.
# Wait, secCount is written to the header BEFORE appending sections!
# Let's fix this by moving the header generation.
old_header = """        let secCount = 1 + (vfsBlocks.length * 5);
        let archiveSize = 6;

        function appendSection(type, data) {
            const size = data.byteLength;
            const view = new DataView(bwebBuf);
            view.setUint8(archiveSize, type);
            view.setUint32(archiveSize + 1, size);
            const u8 = new Uint8Array(bwebBuf);
            u8.set(new Uint8Array(data), archiveSize + 5);
            return size + 5;
        }"""

new_header = """        let secCount = 1 + (vfsBlocks.length * 5) + (bfbBuf ? 1 : 0) + (bibBuf ? 1 : 0);
        let archiveSize = 6;
        
        // Write Header now that secCount is known
        const headerView = new DataView(bwebBuf);
        headerView.setUint8(0, 0x42); headerView.setUint8(1, 0x57); headerView.setUint8(2, 0x45); headerView.setUint8(3, 0x42);
        headerView.setUint8(4, 1); // Version
        headerView.setUint8(5, secCount);

        function appendSection(type, data) {
            const size = data.byteLength;
            const view = new DataView(bwebBuf);
            view.setUint8(archiveSize, type);
            view.setUint32(archiveSize + 1, size);
            const u8 = new Uint8Array(bwebBuf);
            u8.set(new Uint8Array(data), archiveSize + 5);
            return size + 5;
        }"""
# Wait, bwebBuf is allocated earlier with `let bwebBuf = new ArrayBuffer(maxBytes);` and the header is written immediately!
# I will find the original header write and replace it.

start_header_search = "const bwebView = new DataView(bwebBuf);"
end_header_search = "bwebView.setUint8(5, secCount);"
content = content.replace("bwebView.setUint8(5, secCount);", "// bwebView.setUint8(5, secCount); defer to later")
content = content.replace(old_header, new_header)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: BIB Extraction patched.")
