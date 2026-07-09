import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix 1: BIBParser
    content = content.replace(
        "if(dataLen!==w*h*4)throw new Error(`BIB: dataLen ${dataLen} != erwartete ${w*h*4} Bytes`);",
        "if(comp === 0 && dataLen!==w*h*4)throw new Error(`BIB: dataLen ${dataLen} != erwartete ${w*h*4} Bytes`);"
    )

    # Fix 2: applyBIB
    apply_bib_old = """async function applyBIB(rootEl, images) {
    const promises = [];
    function traverse(el) {
        if (el.tagName === 'CANVAS') {
            const bibIdRaw = el.getAttribute('data-bib-id') || el.getAttribute('src');
            if (bibIdRaw && bibIdRaw.startsWith('bib://')) {
                const id = parseInt(bibIdRaw.split('://')[1], 10);
                const img = images[id];
                if (img) {
                    const ctx = el.getContext('2d');
                    const imgData = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.w * img.h * 4), img.w, img.h);
                    ctx.putImageData(imgData, 0, 0);
                }
            }
        }
        for (const child of el.children) traverse(child);
    }
    traverse(rootEl);
    await Promise.all(promises);
}"""

    apply_bib_new = """async function applyBIB(rootEl, images) {
    const promises = [];
    function traverse(el) {
        if (el.tagName === 'CANVAS') {
            const bibIdRaw = el.getAttribute('data-bib-id') || el.getAttribute('src');
            if (bibIdRaw && bibIdRaw.startsWith('bib://')) {
                const id = parseInt(bibIdRaw.split('://')[1], 10);
                const img = images[id];
                if (img) {
                    promises.push((async () => {
                        const ctx = el.getContext('2d');
                        if (img.comp === 0) {
                            const imgData = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.w * img.h * 4), img.w, img.h);
                            ctx.putImageData(imgData, 0, 0);
                        } else {
                            const mime = img.comp === 1 ? 'image/png' : img.comp === 2 ? 'image/jpeg' : img.comp === 3 ? 'image/webp' : 'application/octet-stream';
                            const blob = new Blob([img.data], { type: mime });
                            const bitmap = await createImageBitmap(blob);
                            ctx.drawImage(bitmap, 0, 0);
                        }
                    })());
                }
            }
        }
        for (const child of el.children) traverse(child);
    }
    traverse(rootEl);
    await Promise.all(promises);
}"""
    content = content.replace(apply_bib_old, apply_bib_new)
    
    # Check if applyBIB was replaced
    if "const mime = img.comp" not in content:
        print(f"Warning: applyBIB not replaced in {filepath}!")

    # Fix 3: TAG_REV
    content = content.replace(
        "0xFE:'div',0xFF:'div'}",
        "0xFD:'#text',0xFE:'div',0xFF:'div'}"
    )

    # Fix 4: comp flag in clientSideConvert
    content = content.replace("h.setUint8(9,0);", "h.setUint8(9,1);")

    # Fix 5: attachRouter trailing slash
    router_old = """            targetUrl = baseParts.join('/');
        } else {
            targetUrl = targetUrl.substring(1);
        }

        if (pagesMap[targetUrl]) {"""
    
    router_new = """            targetUrl = baseParts.join('/');
        } else {
            targetUrl = targetUrl.substring(1);
        }
        if (targetUrl.endsWith('/')) {
            targetUrl = targetUrl.substring(0, targetUrl.length - 1);
        }
        if (targetUrl === '') targetUrl = 'index.html';

        if (pagesMap[targetUrl]) {"""
    content = content.replace(router_old, router_new)
    
    with open(filepath, 'w') as f:
        f.write(content)

patch_file('bweb-converter/converter.html')
patch_file('bweb-converter/content.js')
patch_file('bweb-converter/polyfill.html')
print("Patched successfully.")
