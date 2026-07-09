import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Add parseBIB and prepareGlobalBIB right before parseBWEB
new_funcs = """function parseBIB(buf) {
    const view = new DataView(buf);
    let off = 4; // skip BIB\\x01
    const count = view.getUint32(off); off+=4;
    const images = {};
    for(let i=0; i<count; i++){
        const id = view.getUint32(off); off+=4;
        const w = view.getUint16(off); off+=2;
        const h = view.getUint16(off); off+=2;
        const type = view.getUint8(off++);
        const comp = view.getUint8(off++);
        off += 6; // padding
        const bCount = view.getUint16(off); off+=2; // block count usually 0
        const pLen = view.getUint32(off); off+=4;
        const payload = new Uint8Array(buf, off, pLen);
        off += pLen;
        images[id] = {id, w, h, comp, data: payload};
    }
    return images;
}

async function prepareGlobalBIB(bibBufs) {
    window.bwebBIB = {};
    if(!bibBufs) return;
    for (const buf of bibBufs) {
        const parsed = parseBIB(buf);
        for(const [id, img] of Object.entries(parsed)) {
            if (img.comp === 0) {
                const imgData = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.w * img.h * 4), img.w, img.h);
                const tcvs = document.createElement('canvas');
                tcvs.width = img.w; tcvs.height = img.h;
                tcvs.getContext('2d').putImageData(imgData, 0, 0);
                window.bwebBIB[id] = tcvs;
            } else {
                const mime = img.comp === 1 ? 'image/png' : img.comp === 2 ? 'image/jpeg' : img.comp === 3 ? 'image/webp' : 'application/octet-stream';
                const blob = new Blob([img.data], { type: mime });
                window.bwebBIB[id] = await createImageBitmap(blob);
            }
        }
    }
}
"""
content = content.replace("function parseBWEB(buf){", new_funcs + "\nfunction parseBWEB(buf){")

# In renderBinary, call prepareGlobalBIB
old_load = "await loadPage(startPage);"
new_load = """if (sections[4]) { await prepareGlobalBIB(sections[4]); }
    await loadPage(startPage);"""
content = content.replace(old_load, new_load)

# In CanvasEngine.paintNode, add Image drawing
old_paint = """    paintNode(node) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        if(!node.isText) {
            if(s[17]) {"""
            
new_paint = """    paintNode(node) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        if(!node.isText) {
            if(s[17]) {"""

# We need to insert the image draw after background, but before children.
# Let's replace the whole paintNode block:
start_paint = "    paintNode(node) {"
end_paint = "        for(const c of node.children) this.paintNode(c);\n    }"
parts = content.split(start_paint)
pre_paint = parts[0]
post_parts = parts[1].split(end_paint)
post_paint = end_paint + end_paint.join(post_parts[1:])

replacement_paint = """    paintNode(node) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        if(!node.isText) {
            if(s[17]) {
                this.ctx.fillStyle = rgba(s[17]);
                this.ctx.fillRect(node.layout.x, node.layout.y, node.layout.w, node.layout.h);
            }
            
            // Image Support
            // Let's find out if this node is an image by looking up its BML element.
            // BML Tag 0x0B = img, 0x2B = canvas
            const el = findBMLElementForNode(node.id, currentBMLRoot);
            if (el && (el.tag === 11 || el.tag === 43)) {
                let srcAttr = null;
                if(el.attributes) srcAttr = el.attributes.find(a => a.id === 19 || a.id === 33); // 19=src, 33=data-bind
                if (srcAttr) {
                    const srcStr = new TextDecoder().decode(srcAttr.val);
                    let bibId = null;
                    if (srcStr.startsWith('bib://')) bibId = parseInt(srcStr.split('://')[1], 10);
                    else bibId = parseInt(srcStr, 10);
                    
                    if (!isNaN(bibId) && window.bwebBIB && window.bwebBIB[bibId]) {
                        this.ctx.drawImage(window.bwebBIB[bibId], node.layout.x + node.layout.pl, node.layout.y + node.layout.pt, node.layout.w - node.layout.pl - node.layout.pr, node.layout.h - node.layout.pt - node.layout.pb);
                    }
                }
            }
            
            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                this.ctx.strokeRect(node.layout.x, node.layout.y, node.layout.w, node.layout.h);
            }
        } else {
            if(node.layout.lines && node.layout.lines.length > 0) {
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px sans-serif`;
                this.ctx.textBaseline = "top";
                let lY = node.layout.y;
                for(const line of node.layout.lines) {
                    this.ctx.fillText(line, node.layout.x, lY);
                    lY += node.layout.lh;
                }
            }
        }
        
        for(const c of node.children) this.paintNode(c);
    }"""
content = pre_paint + replacement_paint + "\n" + post_paint[len(end_paint):]

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Image Linking patched.")
