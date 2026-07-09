import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add BFB Parsing and FontFace loading to renderBinary
old_render = """    if (sections[9]) {
        const tocView = new Uint8Array(sections[9]);
        if (tocView[0]===0x56 && tocView[1]===0x46 && tocView[2]===0x53 && tocView[3]===0x01) {"""

new_render = """    if (sections[11]) { // BFB
        for (const chunk of sections[11]) {
            const v = new DataView(chunk);
            if (v.getUint8(0)===0x42 && v.getUint8(1)===0x46 && v.getUint8(2)===0x53) {
                let off = 4;
                const cnt = v.getUint32(off); off+=4;
                for (let i=0; i<cnt; i++) {
                    const id = v.getUint16(off); off+=2;
                    const flen = v.getUint8(off++);
                    const family = new TextDecoder().decode(new Uint8Array(chunk, off, flen)); off+=flen;
                    const weight = v.getUint16(off); off+=2;
                    const style = v.getUint8(off++);
                    const fmt = v.getUint8(off++);
                    const pLen = v.getUint32(off); off+=4;
                    const data = new Uint8Array(chunk, off, pLen); off+=pLen;
                    
                    try {
                        const font = new FontFace(family, data, { weight: weight.toString(), style: style===1?'italic':'normal' });
                        document.fonts.add(font);
                        await font.load();
                    } catch(e) { console.error('Font load error:', e); }
                }
            }
        }
    }
    
    if (sections[9]) {
        const tocView = new Uint8Array(sections[9]);
        if (tocView[0]===0x56 && tocView[1]===0x46 && tocView[2]===0x53 && tocView[3]===0x01) {"""

content = content.replace(old_render, new_render)

# 2. Add secType 11 to parseBWEB
old_parse = """            } else if (secType === 10 && currentVfs) {
                currentVfs.blbMobile = chunk;
                sections.vfs.push(currentVfs);
                currentVfs = null;
            } else {"""
new_parse = """            } else if (secType === 10 && currentVfs) {
                currentVfs.blbMobile = chunk;
                sections.vfs.push(currentVfs);
                currentVfs = null;
            } else if (secType === 11) {
                if(!sections[11]) sections[11] = [];
                sections[11].push(chunk);
            } else {"""
content = content.replace(old_parse, new_parse)

# 3. Implement Font Extraction in clientSideConvert
old_snap = """                iframe.onload = async () => {
                    try {
                        const doc = iframe.contentWindow.document;"""
new_snap = """                iframe.onload = async () => {
                    try {
                        const doc = iframe.contentWindow.document;
                        const fontsExtracted = [];
                        try {
                            for (const sheet of iframe.contentWindow.document.styleSheets) {
                                try {
                                    for (const rule of sheet.cssRules) {
                                        if (rule instanceof CSSFontFaceRule) {
                                            const family = rule.style.fontFamily.replace(/['"]/g, '');
                                            const srcMatch = rule.style.src.match(/url\\(['"]?(.*?)['"]?\\)/);
                                            if (srcMatch) {
                                                const url = srcMatch[1];
                                                let weight = 400;
                                                if(rule.style.fontWeight === 'bold') weight = 700;
                                                else if(parseInt(rule.style.fontWeight)) weight = parseInt(rule.style.fontWeight);
                                                const style = rule.style.fontStyle === 'italic' ? 1 : 0;
                                                fontsExtracted.push({ family, url, weight, style });
                                            }
                                        }
                                    }
                                } catch(e) {}
                            }
                        } catch(e) {}
"""
content = content.replace(old_snap, new_snap)

# Make snapshotSinglePage return fontsExtracted
old_res = "res({ bml: bmlData, bdt: bdtBuf, blbDesktop, blbTablet, blbMobile });"
new_res = "res({ bml: bmlData, bdt: bdtBuf, blbDesktop, blbTablet, blbMobile, fontsExtracted });"
content = content.replace(old_res, new_res)

# In clientSideConvert, after the loop, fetch the fonts and build BFB
old_loop_end = """        for(const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blbDesktop);
            archiveSize += appendSection(8, vfs.blbTablet);
            archiveSize += appendSection(10, vfs.blbMobile);
        }"""
new_loop_end = """        
        let bfbBuf = null;
        if (globalFonts.size > 0) {
            const fontList = Array.from(globalFonts.values());
            let totalFontBytes = 0;
            for(const f of fontList) {
                try {
                    const fr = await fetch(f.url);
                    if(fr.ok) {
                        f.data = await fr.arrayBuffer();
                        totalFontBytes += f.data.byteLength;
                    }
                } catch(e) {}
            }
            
            const validFonts = fontList.filter(f => f.data);
            if (validFonts.length > 0) {
                const bfbSize = 8 + validFonts.reduce((acc, f) => acc + 2 + 1 + f.family.length + 2 + 1 + 1 + 4 + f.data.byteLength, 0);
                const bfbArr = new ArrayBuffer(bfbSize);
                const v = new DataView(bfbArr);
                v.setUint8(0, 0x42); v.setUint8(1, 0x46); v.setUint8(2, 0x53); v.setUint8(3, 0x01); // BFS\x01
                v.setUint32(4, validFonts.length);
                let off = 8;
                for(let i=0; i<validFonts.length; i++) {
                    const f = validFonts[i];
                    v.setUint16(off, i); off += 2;
                    const famBytes = new TextEncoder().encode(f.family);
                    v.setUint8(off++, famBytes.length);
                    for(const b of famBytes) v.setUint8(off++, b);
                    v.setUint16(off, f.weight); off += 2;
                    v.setUint8(off++, f.style);
                    v.setUint8(off++, 0); // format woff2=0
                    v.setUint32(off, f.data.byteLength); off += 4;
                    const srcView = new Uint8Array(f.data);
                    for(const b of srcView) v.setUint8(off++, b);
                }
                bfbBuf = bfbArr;
            }
        }

        for(const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blbDesktop);
            archiveSize += appendSection(8, vfs.blbTablet);
            archiveSize += appendSection(10, vfs.blbMobile);
        }
        if (bfbBuf) {
            archiveSize += appendSection(11, bfbBuf);
        }"""
content = content.replace(old_loop_end, new_loop_end)

# Also we need to collect globalFonts
old_vfs = "const vfsBlocks = [];"
new_vfs = "const vfsBlocks = [];\n        const globalFonts = new Map();"
content = content.replace(old_vfs, new_vfs)

old_push = """            if(snap) {
                vfsBlocks.push(snap);
            }"""
new_push = """            if(snap) {
                vfsBlocks.push(snap);
                if (snap.fontsExtracted) {
                    for(const f of snap.fontsExtracted) globalFonts.set(f.url, f);
                }
            }"""
content = content.replace(old_push, new_push)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: BFB Font support patched.")
