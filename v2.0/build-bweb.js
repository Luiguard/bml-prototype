const puppeteer = require('puppeteer');
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node build-bweb.js <path-to-folder> [output-file]');
    process.exit(1);
}

const inputDir = path.resolve(args[0]);
if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error(`Error: ${inputDir} is not a valid directory.`);
    process.exit(1);
}

const outputFile = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), 'website.bweb');

// Find all HTML files
function getHtmlFiles(dir, base = '') {
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.posix.join(base, file);
        if (fs.statSync(fullPath).isDirectory()) results = results.concat(getHtmlFiles(fullPath, relPath));
        else if (file.endsWith('.html')) results.push(relPath);
    }
    return results;
}

const htmlFiles = getHtmlFiles(inputDir);
if (htmlFiles.length === 0) { console.error(`Error: No .html files found in ${inputDir}`); process.exit(1); }
console.log(`[INFO] Found ${htmlFiles.length} HTML pages to process.`);

const app = express();
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiLimiter);
app.use(express.static(inputDir));

const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`[INFO] Local server running on http://localhost:${port}`);

    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        const interceptedAssets = {};
        page.on('response', async (response) => {
            const type = response.request().resourceType();
            if (type === 'font' || type === 'image' || type === 'media') {
                try {
                    const buffer = await response.buffer();
                    interceptedAssets[response.url()] = buffer;
                } catch(e) {}
            }
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        console.log(`[INFO] Processing ${htmlFiles[0]}...`);
        await page.goto(`http://localhost:${port}/${htmlFiles[0]}`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 500));
        console.log('[INFO] Injecting Serializer...');

        const bwebData = await page.evaluate(async () => {
            const enc = new TextEncoder();
            function colorToU32(c) {
                const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (!m) return 0;
                const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255;
                return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
            }

            const TAG_FWD = {'div':1,'p':2,'span':3,'a':4,'button':5,'img':6,'input':7,'form':8,'ul':9,'li':10,'h1':11,'h2':12,'h3':13,'h4':14,'h5':15,'h6':16,'canvas':17,'svg':18,'header':19,'footer':20,'section':21,'nav':22,'main':23,'aside':24,'article':25,'figure':26,'figcaption':27,'table':28,'thead':29,'tbody':30,'tr':31,'td':32,'th':33,'textarea':34};
            const ATTR_FWD = {'id':1,'class':2,'href':3,'src':4,'alt':5,'type':6,'value':7,'name':8,'placeholder':9,'disabled':10,'checked':11,'required':12,'readonly':13,'maxlength':14,'minlength':15,'min':16,'max':17,'step':18,'pattern':19,'title':20,'target':21,'rel':22,'style':23,'role':24,'aria-label':25,'aria-hidden':26};
            const SKIP_TAGS = new Set(['script','style','noscript','template','iframe','object','embed','applet','link','meta','base','head','source','track','slot']);

            const globalImages = new Map();
            const allEls = document.body.querySelectorAll('*');
            for (const el of allEls) {
                for (const pseudo of ['::before', '::after']) {
                    const ps = window.getComputedStyle(el, pseudo);
                    const content = ps.content;
                    if (!content || content === 'none' || content === 'normal') continue;
                    const pNode = document.createElement('span');
                    pNode.setAttribute('data-pseudo', pseudo);
                    pNode.style.cssText = `display:${ps.display};position:${ps.position};width:${ps.width};height:${ps.height};background-color:${ps.backgroundColor};background-image:${ps.backgroundImage};color:${ps.color};font-size:${ps.fontSize};font-weight:${ps.fontWeight};font-family:${ps.fontFamily};top:${ps.top};left:${ps.left};right:${ps.right};bottom:${ps.bottom};border-radius:${ps.borderRadius};opacity:${ps.opacity};z-index:${ps.zIndex};overflow:hidden;pointer-events:none;`;
                    const textContent = content.replace(/^["']|["']$/g, '');
                    if (textContent && textContent !== '""' && textContent !== "''") pNode.textContent = textContent;
                    if (pseudo === '::before') el.insertBefore(pNode, el.firstChild);
                    else el.appendChild(pNode);
                }
            }
            
            for (const imgEl of document.querySelectorAll('img')) {
                const src = imgEl.src;
                if (src && !src.startsWith('bib://')) {
                    if (!globalImages.has(src)) globalImages.set(src, { id: globalImages.size, url: src });
                }
            }

            const bmlBuf = [];
            const flatNodes = [];

            function serNode(el, parentIdx) {
                if (el.nodeType === 3) {
                    const originalText = el.textContent;
                    if (!originalText.trim()) return;
                    const parentStyle = window.getComputedStyle(el.parentElement);
                    let t = originalText;
                    if (parentStyle.textTransform === 'uppercase') t = t.toUpperCase();
                    else if (parentStyle.textTransform === 'lowercase') t = t.toLowerCase();

                    const range = document.createRange();
                    let lines = [], currentLineText = "", currentLineRect = null, lastY = null;

                    for (let i = 0; i < originalText.length; i++) {
                        try { range.setStart(el, i); range.setEnd(el, i + 1); } catch(e) { continue; }
                        const rects = range.getClientRects();
                        if (rects.length === 0) continue;
                        const rect = rects[0];
                        if (lastY === null) {
                            lastY = rect.y; currentLineText = t[i]; currentLineRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
                        } else if (Math.abs(rect.y - lastY) > rect.height * 0.5) {
                            lines.push({ text: currentLineText.trim(), rect: currentLineRect });
                            lastY = rect.y; currentLineText = t[i]; currentLineRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
                        } else {
                            currentLineText += t[i];
                            currentLineRect.w = (rect.x + rect.width) - currentLineRect.x;
                            currentLineRect.h = Math.max(currentLineRect.h, rect.height);
                        }
                    }
                    if (currentLineText.trim()) lines.push({ text: currentLineText.trim(), rect: currentLineRect });
                    if (lines.length === 0) return;

                    for (const line of lines) {
                        if (!line.text) continue;
                        const myIdx = flatNodes.length;
                        flatNodes.push({ isVirtualText: true, parentNode: el.parentElement, rect: line.rect, text: line.text, tag: 253, parentIdx, children: [], id: myIdx });
                        if (parentIdx >= 0) flatNodes[parentIdx].children.push(myIdx);

                        const textBytes = enc.encode(line.text + " ");
                        bmlBuf.push(253, 0, 0, 0); // tag=253 (#text)
                        bmlBuf.push((textBytes.length >> 8) & 0xFF, textBytes.length & 0xFF);
                        for (const b of textBytes) bmlBuf.push(b);
                    }
                    return;
                }
                
                if (el.nodeType !== 1) return;
                let tag = el.tagName ? el.tagName.toLowerCase() : 'div';
                if (SKIP_TAGS.has(tag)) return;
                if (tag === 'svg') tag = 'img';
                
                const myIdx = flatNodes.length;
                flatNodes.push({ node: el, tag: TAG_FWD[tag] || 255, parentIdx, children: [], id: myIdx, meta: {} });
                if (parentIdx >= 0) flatNodes[parentIdx].children.push(myIdx);
                
                const attrs = [];
                let meta = {};
                if (el.onclick || el.hasAttribute('onclick') || tag === 'button' || tag === 'a') meta['event_click'] = true;
                if (el.onmouseenter || el.hasAttribute('onmouseenter')) meta['event_hover'] = true;

                if (el.tagName && el.tagName.toLowerCase() === 'svg') {
                    const s = new XMLSerializer().serializeToString(el);
                    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;
                    attrs.push({id: ATTR_FWD['src'] || 19, val: enc.encode(dataUrl)});
                }

                for (const a of el.attributes) {
                    if (el.tagName && el.tagName.toLowerCase() === 'img' && a.name === 'src') {
                        if(globalImages.has(a.value)) attrs.push({id: ATTR_FWD['src'] || 19, val: enc.encode(`bib://${globalImages.get(a.value).id}`)});
                        else if(a.value.startsWith('data:image/svg')) attrs.push({id: ATTR_FWD['src'] || 19, val: enc.encode(a.value)});
                        continue;
                    }
                    const n = a.name.toLowerCase();
                    if (ATTR_FWD[n]) attrs.push({ id: ATTR_FWD[n], val: enc.encode(a.value) });
                    else if (n.startsWith('data-')) attrs.push({ id: 254, name: enc.encode(n), val: enc.encode(a.value) });
                    
                    if (n.startsWith('data-') || n.startsWith('aria-')) meta[n] = a.value || 'true';
                }
                if (Object.keys(meta).length > 0) flatNodes[myIdx].meta = meta;
                
                const computedStyle = window.getComputedStyle(el);
                let fSize = parseInt(computedStyle.fontSize);
                if (!isNaN(fSize)) attrs.push({ id: 254, name: enc.encode('fontSize'), val: enc.encode(fSize.toString()) });
                let align = computedStyle.textAlign;
                if (align && align !== 'start' && align !== 'left') attrs.push({ id: 254, name: enc.encode('textAlign'), val: enc.encode(align) });
                
                bmlBuf.push(flatNodes[myIdx].tag, attrs.length, 0, 0, 0, 0, 0, 0); 
                for (const a of attrs) {
                    bmlBuf.push(a.id);
                    if (a.id === 254) { bmlBuf.push(a.name.length); for (const b of a.name) bmlBuf.push(b); }
                    bmlBuf.push((a.val.length >> 8) & 0xFF, a.val.length & 0xFF);
                    for (const b of a.val) bmlBuf.push(b);
                }
                if (el.tagName && el.tagName.toLowerCase() !== 'svg') {
                    for (const c of el.childNodes) serNode(c, myIdx);
                }
            }

            serNode(document.body, -1);

            const depths = new Int32Array(flatNodes.length);
            for (let i = 0; i < flatNodes.length; i++) {
                let d = 0, p = flatNodes[i].parentIdx;
                while (p !== -1) { d++; p = flatNodes[p].parentIdx; }
                depths[i] = d;
            }
            const bdtBuf = new ArrayBuffer(flatNodes.length * 16);
            const bdtView = new DataView(bdtBuf);
            for (let i = 0; i < flatNodes.length; i++) {
                const n = flatNodes[i], off = i * 16;
                bdtView.setUint32(off, n.id);
                bdtView.setUint16(off + 4, n.parentIdx === -1 ? 0xFFFF : n.parentIdx);
                const siblings = n.parentIdx === -1 ? [0] : flatNodes[n.parentIdx].children;
                const myPos = siblings.indexOf(i);
                bdtView.setUint16(off + 6, myPos < siblings.length - 1 ? siblings[myPos + 1] : 0xFFFF);
                bdtView.setUint16(off + 8, n.children.length ? n.children[n.children.length - 1] : 0xFFFF);
                bdtView.setUint16(off + 10, myPos > 0 ? siblings[myPos - 1] : 0xFFFF);
                bdtView.setUint8(off + 12, n.isVirtualText ? 1 : 0);
                bdtView.setUint8(off + 13, n.tag);
                bdtView.setUint8(off + 14, depths[i]);
            }

            const blbBuf = new ArrayBuffer(flatNodes.length * 50);
            const blbView = new DataView(blbBuf);
            let off = 0;
            for (let i = 0; i < flatNodes.length; i++) {
                const fn = flatNodes[i];
                if (fn.isVirtualText) {
                    const style = window.getComputedStyle(fn.parentNode);
                    const fg = colorToU32(style.color);
                    blbView.setFloat32(off, fn.rect.x); blbView.setFloat32(off + 4, fn.rect.y);
                    blbView.setFloat32(off + 8, fn.rect.w); blbView.setFloat32(off + 12, fn.rect.h);
                    blbView.setUint8(off + 41, (fg >> 24) & 0xFF); blbView.setUint8(off + 42, (fg >> 16) & 0xFF);
                    blbView.setUint8(off + 43, (fg >> 8) & 0xFF); blbView.setUint8(off + 44, fg & 0xFF);
                    let zIndex = parseInt(style.zIndex); blbView.setInt16(off + 47, isNaN(zIndex) ? 0 : zIndex);
                    off += 50; continue;
                }
                const n = fn.node, rect = n.getBoundingClientRect(), style = window.getComputedStyle(n);
                let blbFlags = 0;
                if (style.overflow === 'hidden') blbFlags |= 0x04;
                if (style.overflow === 'scroll' || style.overflow === 'auto') blbFlags |= 0x08;
                if (style.display === 'flex' || style.display === 'grid') blbFlags |= 0x02;

                const bg = colorToU32(style.backgroundColor), fg = colorToU32(style.color);
                blbView.setFloat32(off, rect.x); blbView.setFloat32(off + 4, rect.y);
                blbView.setFloat32(off + 8, rect.width); blbView.setFloat32(off + 12, rect.height);
                blbView.setFloat32(off + 16, parseFloat(style.paddingTop) || 0); blbView.setFloat32(off + 20, parseFloat(style.paddingRight) || 0);
                blbView.setFloat32(off + 24, parseFloat(style.paddingBottom) || 0); blbView.setFloat32(off + 28, parseFloat(style.paddingLeft) || 0);
                blbView.setUint8(off + 32, Math.min(255, parseFloat(style.borderTopWidth) || 0)); blbView.setUint8(off + 33, Math.min(255, parseFloat(style.borderRightWidth) || 0));
                blbView.setUint8(off + 34, Math.min(255, parseFloat(style.borderBottomWidth) || 0)); blbView.setUint8(off + 35, Math.min(255, parseFloat(style.borderLeftWidth) || 0));
                blbView.setUint8(off + 36, style.borderStyle.includes('dashed') ? 2 : (style.borderStyle.includes('solid') ? 1 : 0));
                blbView.setUint8(off + 37, (bg >> 24) & 0xFF); blbView.setUint8(off + 38, (bg >> 16) & 0xFF); blbView.setUint8(off + 39, (bg >> 8) & 0xFF); blbView.setUint8(off + 40, bg & 0xFF);
                blbView.setUint8(off + 41, (fg >> 24) & 0xFF); blbView.setUint8(off + 42, (fg >> 16) & 0xFF); blbView.setUint8(off + 43, (fg >> 8) & 0xFF); blbView.setUint8(off + 44, fg & 0xFF);
                blbView.setUint16(off + 45, parseFloat(style.borderRadius) || 0);
                let zIndex = parseInt(style.zIndex); blbView.setInt16(off + 47, isNaN(zIndex) ? 0 : zIndex);
                blbView.setUint8(off + 49, blbFlags);
                off += 50;
            }

            const bmsBuffers = [];
            let bmsCount = 0;
            for (let i = 0; i < flatNodes.length; i++) {
                if (flatNodes[i].meta) {
                    bmsCount++;
                    let entryCount = 0, entriesData = [];
                    for (let [k, v] of Object.entries(flatNodes[i].meta)) {
                        if (k.startsWith('aria-')) {
                            entryCount++; const vBuf = enc.encode(`${k}=${v}`); entriesData.push(0x01, (vBuf.length >> 8) & 0xFF, vBuf.length & 0xFF, ...vBuf);
                        } else if (k.startsWith('data-')) {
                            entryCount++; const vBuf = enc.encode(`${k}=${v}`); entriesData.push(0x02, (vBuf.length >> 8) & 0xFF, vBuf.length & 0xFF, ...vBuf);
                        } else if (k.startsWith('event_')) {
                            entryCount++; let mask = 0; if (k === 'event_click') mask |= 0x01; if (k === 'event_hover') mask |= 0x04;
                            entriesData.push(0x03, 0, 2, (mask >> 8) & 0xFF, mask & 0xFF);
                        }
                    }
                    bmsBuffers.push((i >> 8) & 0xFF, i & 0xFF, entryCount, ...entriesData);
                }
            }
            const bmsSection = [(bmsCount >> 8) & 0xFF, bmsCount & 0xFF, ...bmsBuffers];

            return { bml: [0x42, 0x4D, 0x4C, 0x01, ...bmlBuf], bdt: Array.from(new Uint8Array(bdtBuf)), blb: Array.from(new Uint8Array(blbBuf)), bms: bmsSection, imagesList: Array.from(globalImages.values()) };
        });

        console.log('[INFO] Successfully Extracted Nodes:', bwebData.blb.length / 50);

        const imagesBuffers = [];
        for (const [url, buf] of Object.entries(interceptedAssets)) {
            const ext = url.split('.').pop().split('?')[0].toLowerCase();
            if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'svg' || url.startsWith('data:image/svg')) {
                imagesBuffers.push({ id: imagesBuffers.length, buffer: buf });
            }
        }
        
        let bibHeaders = Buffer.alloc(2 + (imagesBuffers.length * 13)); 
        bibHeaders.writeUInt16BE(imagesBuffers.length, 0);
        let bibData = Buffer.alloc(0);
        let hPos = 2;
        for (const img of imagesBuffers) {
            bibHeaders.writeUInt16BE(img.id, hPos);
            bibHeaders.writeUInt32BE(bibData.length, hPos + 2);
            bibHeaders.writeUInt32BE(img.buffer.length, hPos + 6);
            bibHeaders.writeUInt8(0, hPos + 10); bibHeaders.writeUInt8(0, hPos + 11); bibHeaders.writeUInt8(0, hPos + 12);
            hPos += 13;
            bibData = Buffer.concat([bibData, img.buffer]);
        }
        const bibBuf = Buffer.concat([bibHeaders, bibData]);

        // BFF Section (Type ID 7)
        const fontsBuffers = [];
        for (const [url, buf] of Object.entries(interceptedAssets)) {
            if (url.endsWith('.woff') || url.endsWith('.woff2') || url.endsWith('.ttf') || url.endsWith('.otf')) {
                const familyName = fontMap[url] || `BWEBFont${fontsBuffers.length}`;
                fontsBuffers.push({ familyName, buffer: buf });
            }
        }
        
        let bffDataArray = [];
        const bffCountBuf = Buffer.alloc(2); bffCountBuf.writeUInt16BE(fontsBuffers.length, 0);
        bffDataArray.push(bffCountBuf);
        for (const font of fontsBuffers) {
            const nameBuf = Buffer.from(font.familyName);
            const header = Buffer.alloc(1 + nameBuf.length + 4);
            header.writeUInt8(nameBuf.length, 0);
            nameBuf.copy(header, 1);
            header.writeUInt32BE(font.buffer.length, 1 + nameBuf.length);
            bffDataArray.push(header, font.buffer);
        }
        const bffBuf = Buffer.concat(bffDataArray);

        const bmlBuf = Buffer.from(bwebData.bml);
        const bdtBuf = Buffer.from(bwebData.bdt);
        const blbBuf = Buffer.from(bwebData.blb);
        const bmsBuf = Buffer.from(bwebData.bms);
        
        const tocMap = { [htmlFiles[0]]: { index: 0 } };
        const tocBytes = Buffer.from("VFS\x01" + JSON.stringify(tocMap));
        const numSections = 7;
        const bwebHeader = Buffer.alloc(8 + 8*numSections);
        bwebHeader.writeUInt32BE(0x42574542, 0);
        bwebHeader.writeUInt32BE(numSections, 4);
        
        let currentOffset = bwebHeader.length;
        bwebHeader.writeUInt8(9, 8); bwebHeader.writeUInt32BE(tocBytes.length, 9); bwebHeader.writeUInt8(0, 13); bwebHeader.writeUInt16BE(0, 14); currentOffset += tocBytes.length;
        bwebHeader.writeUInt8(1, 16); bwebHeader.writeUInt32BE(bmlBuf.length, 17); bwebHeader.writeUInt8(0, 21); bwebHeader.writeUInt16BE(0, 22); currentOffset += bmlBuf.length;
        bwebHeader.writeUInt8(2, 24); bwebHeader.writeUInt32BE(bdtBuf.length, 25); bwebHeader.writeUInt8(0, 29); bwebHeader.writeUInt16BE(0, 30); currentOffset += bdtBuf.length;
        
        const countBuf = Buffer.alloc(2); countBuf.writeUInt16BE(bwebData.blb.length / 50, 0);
        const finalBlbBuf = Buffer.concat([countBuf, blbBuf]);
        bwebHeader.writeUInt8(3, 32); bwebHeader.writeUInt32BE(finalBlbBuf.length, 33); bwebHeader.writeUInt8(0, 37); bwebHeader.writeUInt16BE(0, 38); currentOffset += finalBlbBuf.length;
        bwebHeader.writeUInt8(4, 40); bwebHeader.writeUInt32BE(bibBuf.length, 41); bwebHeader.writeUInt8(0, 45); bwebHeader.writeUInt16BE(0, 46); currentOffset += bibBuf.length;
        bwebHeader.writeUInt8(6, 48); bwebHeader.writeUInt32BE(bmsBuf.length, 49); bwebHeader.writeUInt8(0, 53); bwebHeader.writeUInt16BE(0, 54); currentOffset += bmsBuf.length;
        bwebHeader.writeUInt8(7, 56); bwebHeader.writeUInt32BE(bffBuf.length, 57); bwebHeader.writeUInt8(0, 61); bwebHeader.writeUInt16BE(0, 62); currentOffset += bffBuf.length;

        const bwebFile = Buffer.concat([bwebHeader, tocBytes, bmlBuf, bdtBuf, finalBlbBuf, bibBuf, bmsBuf, bffBuf]);

        const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
        const pubKeyBytes = publicKey.export({ type: 'spki', format: 'der' });
        const hash = crypto.createHash('sha256'); hash.update(bwebFile); const integrityHash = hash.digest();
        const sign = crypto.createSign('SHA256'); sign.update(bwebFile); const signature = sign.sign(privateKey);

        const bpgHeader = Buffer.alloc(50);
        bpgHeader.write('BPG1', 0); bpgHeader.writeUInt8(1, 4); bpgHeader.writeUInt8(0, 5); bpgHeader.writeUInt16BE(0, 6);
        bpgHeader.writeUInt32BE(bwebFile.length, 8); bpgHeader.writeUInt32BE(0, 12); integrityHash.copy(bpgHeader, 16);
        bpgHeader.writeUInt16BE(pubKeyBytes.length, 48);

        const tokenHeaderBuf = Buffer.alloc(2); tokenHeaderBuf.writeUInt16BE(signature.length, 0);
        const bpgFile = Buffer.concat([bpgHeader, pubKeyBytes, tokenHeaderBuf, signature, bwebFile]);

        const outStream = fs.createWriteStream(outputFile.replace('.bweb', '.bpg'));
        outStream.write(bpgFile); outStream.end();
        console.log(`[SUCCESS] BPG V2.0 Container written to ${outputFile.replace('.bweb', '.bpg')}`);
        
        await browser.close(); server.close();
    } catch (e) { console.error(e); server.close(); process.exit(1); }
});
