const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

const args = process.argv.slice(2);
if (args[0] !== 'build' || !args[1] || !args[2]) {
    console.error("Usage: node bwebc.js build <input.html> <output.bweb>");
    process.exit(1);
}

const isHttp = args[1].startsWith('http');
const inputPath = isHttp ? args[1] : path.resolve(args[1]);
const inputDir = isHttp ? process.cwd() : path.dirname(inputPath);
const outputFile = path.resolve(args[2]);

const TAG_MAP = { '#text': 0, 'h1': 1, 'p': 2, 'div': 3, 'button': 4, 'h2': 5, 'img': 6, 'video': 7, 'header': 8, 'main': 9, 'article': 10, 'span': 11, 'table': 12, 'tr': 13, 'td': 14, 'th': 15, 'font': 16, 'audio': 17, 'nav': 18, 'footer': 19, 'section': 20, 'form': 21, 'input': 22, 'textarea': 23, 'select': 24, 'option': 25, 'label': 26, 'script': 27, 'iframe': 28 };

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });
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

    const url = inputPath.startsWith('http') ? inputPath : `file://${inputPath}`;
    await page.goto(url, { waitUntil: 'networkidle2' });

    const nodesData = await page.evaluate(() => {
        let nodeIdCounter = 0;
        const nodes = [];

        function parseColor(str) {
            const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]), a: m[4] ? Math.round(parseFloat(m[4]) * 255) : 255 };
            return { r: 0, g: 0, b: 0, a: 0 };
        }

        function traverse(element, parentId = 0xFFFF) {
            if (element.nodeType !== 1 && element.nodeType !== 3) return 0xFFFF;
            if (element.tagName && ['SCRIPT', 'STYLE', 'HEAD', 'META', 'TITLE'].includes(element.tagName)) return 0xFFFF;

            const isText = element.nodeType === 3;
            
            if (isText) {
                let originalText = element.nodeValue;
                if (!originalText.trim()) return 0xFFFF;
                
                const parentStyle = window.getComputedStyle(element.parentElement);
                if (parentStyle.textTransform === 'uppercase') originalText = originalText.toUpperCase();
                else if (parentStyle.textTransform === 'lowercase') originalText = originalText.toLowerCase();
                
                const range = document.createRange();
                let lines = [];
                let currentLineText = "";
                let currentLineRect = null;
                let lastY = null;

                for (let i = 0; i < originalText.length; i++) {
                    range.setStart(element, i);
                    range.setEnd(element, i + 1);
                    const rects = range.getClientRects();
                    if (rects.length === 0) continue;
                    const rect = rects[0];
                    
                    if (lastY === null) {
                        lastY = rect.y;
                        currentLineText = originalText[i];
                        currentLineRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
                    } else if (Math.abs(rect.y - lastY) > rect.height * 0.5) {
                        lines.push({ text: currentLineText.trim(), rect: currentLineRect });
                        lastY = rect.y;
                        currentLineText = originalText[i];
                        currentLineRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
                    } else {
                        currentLineText += originalText[i];
                        currentLineRect.w = (rect.x + rect.width) - currentLineRect.x;
                        currentLineRect.h = Math.max(currentLineRect.h, rect.height);
                    }
                }
                if (currentLineText.trim()) lines.push({ text: currentLineText.trim(), rect: currentLineRect });
                if (lines.length === 0) return 0xFFFF;
                
                const style = window.getComputedStyle(element.parentElement);
                const fg = parseColor(style.color);
                
                let firstLineId = 0xFFFF;
                let prevLineId = 0xFFFF;
                
                for (const line of lines) {
                    if (!line.text) continue;
                    const id = nodeIdCounter++;
                    let layout = { 
                        x: line.rect.x, y: line.rect.y, w: line.rect.w, h: line.rect.h, 
                        pTop: 0, pRight: 0, pBottom: 0, pLeft: 0,
                        bwTop: 0, bwRight: 0, bwBottom: 0, bwLeft: 0,
                        borderStyle: 0,
                        fgR: fg.r, fgG: fg.g, fgB: fg.b, fgA: fg.a, 
                        bgR: 0, bgG: 0, bgB: 0, bgA: 0, radius: 0, zIndex: 0, flags: 0 
                    };
                    
                    let bmlAttrs = { text: line.text };
                    const computed = window.getComputedStyle(element.parentElement);
                    let fSize = parseInt(computed.fontSize);
                    if (!isNaN(fSize)) bmlAttrs.fontSize = fSize;
                    let align = computed.textAlign;
                    if (align && align !== 'start' && align !== 'left') bmlAttrs.textAlign = align;
                    
                    let meta = {};
                    
                    const nodeData = { 
                        id, parentId, tag: '#text', nodeType: 1, 
                        textContent: line.text, layout, firstChild: 0xFFFF, nextSibling: 0xFFFF, flags: 0, 
                        meta: meta, attributes: bmlAttrs 
                    };
                    nodes.push(nodeData);
                    
                    if (firstLineId === 0xFFFF) firstLineId = id;
                    if (prevLineId !== 0xFFFF) nodes[prevLineId].nextSibling = id;
                    prevLineId = id;
                }
                return firstLineId;
            }

            const id = nodeIdCounter++;
            let tag = element.tagName.toLowerCase();
            if (tag === 'body' || tag === 'html') tag = 'div'; 

            let src = null;
            let bmlAttrs = {};
            if (tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'iframe') {
                src = element.currentSrc || element.getAttribute('src');
            } else if (tag === 'input' || tag === 'textarea') {
                src = element.value || element.placeholder || '';
            } else if (tag === 'script') {
                if (!element.hasAttribute('src') && element.getAttribute('type') !== 'module') {
                    src = element.textContent;
                }
            }
            if (src) bmlAttrs.text = src;
            
            let meta = {};
            const attrs = element.attributes;
            for (let i = 0; i < attrs.length; i++) {
                const attr = attrs[i];
                if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
                    meta[attr.name] = attr.value || 'true';
                }
                bmlAttrs[attr.name] = attr.value || 'true';
            }
            if (element.onclick || element.hasAttribute('onclick')) meta['event_click'] = true;
            
            const computedStyle = window.getComputedStyle(element);
            let fSize = parseInt(computedStyle.fontSize);
            if (!isNaN(fSize)) bmlAttrs.fontSize = fSize;
            let align = computedStyle.textAlign;
            if (align && align !== 'start' && align !== 'left') bmlAttrs.textAlign = align;
            if (element.onmouseenter) meta['event_hover'] = true;

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            let blbFlags = 0;
            if (style.overflow === 'hidden') blbFlags |= 0x04;
            if (style.overflow === 'scroll' || style.overflow === 'auto') blbFlags |= 0x08;
            if (style.display === 'flex' || style.display === 'grid') blbFlags |= 0x02;

            const bg = parseColor(style.backgroundColor);
            const fg = parseColor(style.color);
            let bStyle = 0;
            if (style.borderStyle.includes('dashed')) bStyle = 2;
            else if (style.borderStyle.includes('solid')) bStyle = 1;
            
            let zIndex = parseInt(style.zIndex);
            if (isNaN(zIndex)) zIndex = 0;
            
            let layout = { 
                x: rect.x, y: rect.y, w: rect.width, h: rect.height, 
                pTop: parseFloat(style.paddingTop)||0, pRight: parseFloat(style.paddingRight)||0, pBottom: parseFloat(style.paddingBottom)||0, pLeft: parseFloat(style.paddingLeft)||0,
                bwTop: parseFloat(style.borderTopWidth)||0, bwRight: parseFloat(style.borderRightWidth)||0, bwBottom: parseFloat(style.borderBottomWidth)||0, bwLeft: parseFloat(style.borderLeftWidth)||0,
                borderStyle: bStyle,
                fgR: fg.r, fgG: fg.g, fgB: fg.b, fgA: fg.a,
                bgR: bg.r, bgG: bg.g, bgB: bg.b, bgA: bg.a,
                radius: parseFloat(style.borderRadius)||0,
                zIndex: zIndex,
                flags: blbFlags
            };

            const nodeData = { 
                id, parentId, tag, nodeType: 0, textContent: src || '', layout, 
                firstChild: 0xFFFF, nextSibling: 0xFFFF, flags: 0, 
                meta: Object.keys(meta).length > 0 ? meta : null,
                attributes: bmlAttrs
            };
            nodes.push(nodeData);

            let childId = 0xFFFF;
            let lastChildId = 0xFFFF;
            for (const child of element.childNodes) {
                const cid = traverse(child, id);
                if (cid !== 0xFFFF) {
                    if (childId === 0xFFFF) childId = cid;
                    if (lastChildId !== 0xFFFF) nodes[lastChildId].nextSibling = cid;
                    let endOfChain = cid;
                    while (nodes[endOfChain] && nodes[endOfChain].nextSibling !== 0xFFFF) endOfChain = nodes[endOfChain].nextSibling;
                    lastChildId = endOfChain;
                }
            }
            nodeData.firstChild = childId;
            return id;
        }

        traverse(document.documentElement);
        return nodes;
    });

    await browser.close();

    const images = [];
    const videos = [];
    let imgCounter = 0;

    for (const node of nodesData) {
        if ((node.tag === 'img' || node.tag === 'video' || node.tag === 'audio') && node.textContent) {
            let assetUrl = node.textContent;
            let assetBuf = null;
            
            if (!assetUrl.startsWith('http')) {
                const filePath = path.join(inputDir, assetUrl);
                if (fs.existsSync(filePath)) assetBuf = fs.readFileSync(filePath);
            }
            
            if (!assetBuf) {
                assetBuf = interceptedAssets[assetUrl];
                if (!assetBuf) {
                    const absoluteUrl = new URL(assetUrl, `file://${inputDir}/`).href;
                    assetBuf = interceptedAssets[absoluteUrl];
                }
            }

            if (assetBuf) {
                images.push({ id: imgCounter, buffer: assetBuf });
                node.attributes['text'] = `bib://${imgCounter}`;
                imgCounter++;
            }
        }
    }

    // BIB Section (Type ID 4)
    let bibHeaders = Buffer.alloc(2 + (images.length * 13)); 
    bibHeaders.writeUInt16BE(images.length, 0);
    let bibData = Buffer.alloc(0);
    let hPos = 2;
    for (const img of images) {
        bibHeaders.writeUInt16BE(img.id, hPos);
        bibHeaders.writeUInt32BE(bibData.length, hPos + 2);
        bibHeaders.writeUInt32BE(img.buffer.length, hPos + 6);
        bibHeaders.writeUInt8(0, hPos + 10); // chunk index
        bibHeaders.writeUInt8(0, hPos + 11); // compression
        bibHeaders.writeUInt8(0, hPos + 12); // stream hint
        hPos += 13;
        bibData = Buffer.concat([bibData, img.buffer]);
    }
    const bibSection = Buffer.concat([bibHeaders, bibData]);
    const bvsSection = Buffer.alloc(2);

    // BMS Section (Type ID 6) - TLV Format
    const bmsBuffers = [];
    let bmsCount = 0;
    for (const node of nodesData) {
        if (node.meta) {
            bmsCount++;
            let entryCount = 0;
            let entriesData = Buffer.alloc(0);
            
            // Aria-Label (0x01)
            for (let [k, v] of Object.entries(node.meta)) {
                if (k.startsWith('aria-')) {
                    entryCount++;
                    const vBuf = Buffer.from(`${k}=${v}`, 'utf8');
                    const eBuf = Buffer.alloc(3 + vBuf.length);
                    eBuf.writeUInt8(0x01, 0);
                    eBuf.writeUInt16BE(vBuf.length, 1);
                    vBuf.copy(eBuf, 3);
                    entriesData = Buffer.concat([entriesData, eBuf]);
                } else if (k.startsWith('data-')) {
                    entryCount++;
                    const vBuf = Buffer.from(`${k}=${v}`, 'utf8');
                    const eBuf = Buffer.alloc(3 + vBuf.length);
                    eBuf.writeUInt8(0x02, 0);
                    eBuf.writeUInt16BE(vBuf.length, 1);
                    vBuf.copy(eBuf, 3);
                    entriesData = Buffer.concat([entriesData, eBuf]);
                } else if (k.startsWith('event_')) {
                    entryCount++;
                    let mask = 0;
                    if (k === 'event_click') mask |= 0x01;
                    if (k === 'event_hover') mask |= 0x04;
                    const eBuf = Buffer.alloc(3 + 2);
                    eBuf.writeUInt8(0x03, 0);
                    eBuf.writeUInt16BE(2, 1);
                    eBuf.writeUInt16BE(mask, 3);
                    entriesData = Buffer.concat([entriesData, eBuf]);
                }
            }
            const headBuf = Buffer.alloc(3);
            headBuf.writeUInt16BE(node.id, 0);
            headBuf.writeUInt8(entryCount, 2);
            bmsBuffers.push(Buffer.concat([headBuf, entriesData]));
        }
    }
    const bmsCountBuf = Buffer.alloc(2); bmsCountBuf.writeUInt16BE(bmsCount, 0);
    const bmsSection = Buffer.concat([bmsCountBuf, ...bmsBuffers]);

    // BML Section (Type ID 1) & Text Pool
    let textPool = Buffer.alloc(0);
    let poolSize = 0;
    function addStringToPool(str) {
        const strBuf = Buffer.from(str, 'utf8');
        const entryBuf = Buffer.alloc(2 + strBuf.length);
        entryBuf.writeUInt16BE(strBuf.length, 0);
        strBuf.copy(entryBuf, 2);
        const offset = poolSize;
        textPool = Buffer.concat([textPool, entryBuf]);
        poolSize += entryBuf.length;
        return offset;
    }

    const bmlBuffers = [];
    const bdtBuffers = [];
    const blbBuffers = [];

    for (const node of nodesData) {
        // BDT (10 Bytes)
        const bdtBuf = Buffer.alloc(10);
        bdtBuf.writeUInt16BE(node.id, 0); 
        bdtBuf.writeUInt16BE(node.parentId, 2);
        bdtBuf.writeUInt16BE(node.firstChild, 4); 
        bdtBuf.writeUInt16BE(node.nextSibling, 6);
        bdtBuf.writeUInt8(node.nodeType, 8);
        bdtBuf.writeUInt8(node.flags, 9);
        bdtBuffers.push(bdtBuf);

        // BML (7 Bytes + Attrs)
        const tagId = TAG_MAP[node.tag] !== undefined ? TAG_MAP[node.tag] : 255;
        const bmlBuf = Buffer.alloc(7);
        bmlBuf.writeUInt8(tagId, 0);
        bmlBuf.writeUInt32BE(0, 1); // nsOffset = 0 (standard HTML namespace)
        
        const attrs = Object.keys(node.attributes || {});
        bmlBuf.writeUInt16BE(attrs.length, 5);
        
        let attrData = Buffer.alloc(0);
        for (const key of attrs) {
            const val = node.attributes[key];
            const aBuf = Buffer.alloc(9);
            const keyOff = addStringToPool(key);
            aBuf.writeUInt32BE(keyOff, 0);
            
            if (typeof val === 'boolean') {
                aBuf.writeUInt8(0, 4);
                aBuf.writeUInt32BE(val ? 1 : 0, 5);
            } else if (typeof val === 'number' && Number.isInteger(val)) {
                aBuf.writeUInt8(1, 4);
                aBuf.writeUInt32BE(val, 5);
            } else if (typeof val === 'number') {
                aBuf.writeUInt8(2, 4);
                let fbuf = Buffer.alloc(4);
                fbuf.writeFloatBE(val, 0);
                fbuf.copy(aBuf, 5);
            } else {
                aBuf.writeUInt8(3, 4);
                const valOff = addStringToPool(String(val));
                aBuf.writeUInt32BE(valOff, 5);
            }
            attrData = Buffer.concat([attrData, aBuf]);
        }
        bmlBuffers.push(Buffer.concat([bmlBuf, attrData]));

        // BLB (50 Bytes)
        const blbBuf = Buffer.alloc(50);
        blbBuf.writeFloatBE(node.layout.x, 0); blbBuf.writeFloatBE(node.layout.y, 4);
        blbBuf.writeFloatBE(node.layout.w, 8); blbBuf.writeFloatBE(node.layout.h, 12);
        blbBuf.writeFloatBE(node.layout.pTop, 16); blbBuf.writeFloatBE(node.layout.pRight, 20);
        blbBuf.writeFloatBE(node.layout.pBottom, 24); blbBuf.writeFloatBE(node.layout.pLeft, 28);
        blbBuf.writeUInt8(Math.min(255, node.layout.bwTop), 32); blbBuf.writeUInt8(Math.min(255, node.layout.bwRight), 33);
        blbBuf.writeUInt8(Math.min(255, node.layout.bwBottom), 34); blbBuf.writeUInt8(Math.min(255, node.layout.bwLeft), 35);
        blbBuf.writeUInt8(node.layout.borderStyle, 36);
        blbBuf.writeUInt8(node.layout.bgR, 37); blbBuf.writeUInt8(node.layout.bgG, 38); blbBuf.writeUInt8(node.layout.bgB, 39); blbBuf.writeUInt8(node.layout.bgA, 40);
        blbBuf.writeUInt8(node.layout.fgR, 41); blbBuf.writeUInt8(node.layout.fgG, 42); blbBuf.writeUInt8(node.layout.fgB, 43); blbBuf.writeUInt8(node.layout.fgA, 44);
        blbBuf.writeUInt16BE(node.layout.radius, 45);
        blbBuf.writeInt16BE(node.layout.zIndex, 47);
        blbBuf.writeUInt8(node.layout.flags, 49);
        blbBuffers.push(blbBuf);
    }

    const countBuf = Buffer.alloc(2); countBuf.writeUInt16BE(nodesData.length, 0);
    const bdtSection = Buffer.concat([countBuf, ...bdtBuffers]);
    const bmlSection = Buffer.concat([countBuf, ...bmlBuffers]);
    const textPoolSizeBuf = Buffer.alloc(4); textPoolSizeBuf.writeUInt32BE(poolSize, 0);
    const bmlFinalSection = Buffer.concat([bmlSection, textPoolSizeBuf, textPool]);
    const blbSection = Buffer.concat([countBuf, ...blbBuffers]);

    // BFF Section (Type ID 7)
    let bffSection;
    try {
        const fontBuf = fs.readFileSync(path.join(inputDir, 'assets/Pacifico.ttf'));
        let bffHeader = Buffer.alloc(2 + 13 + 4);
        bffHeader.writeUInt16BE(1, 0); // 1 font
        bffHeader.writeUInt16BE(0, 2); // Font ID 0
        bffHeader.writeUInt32BE(0, 4); // Offset 0
        bffHeader.writeUInt32BE(fontBuf.length, 8); // Length
        bffHeader.writeUInt8(0, 12); // Chunk Index
        bffHeader.writeUInt8(0, 13); // Compression
        bffHeader.writeUInt8(0, 14); // Stream Hint
        bffHeader.writeUInt32BE(fontBuf.length, 15); // Pool size
        bffSection = Buffer.concat([bffHeader, fontBuf]);
    } catch(e) {
        const bffHeader = Buffer.alloc(2 + 4);
        bffHeader.writeUInt16BE(0, 0);
        bffHeader.writeUInt32BE(0, 2);
        bffSection = bffHeader;
    }

    const headerBuf = Buffer.alloc(6 + (7 * 9));
    headerBuf.write('BWEB', 0);
    headerBuf.writeUInt8(1, 4); // V1.1 -> version byte is still 1 conceptually, but spec says 1 is v1.1
    headerBuf.writeUInt8(7, 5); // 7 sections

    let offset = 6 + (7 * 9);
    headerBuf.writeUInt8(0, 6); headerBuf.writeUInt32BE(offset, 7); headerBuf.writeUInt32BE(bdtSection.length, 11); offset += bdtSection.length;
    headerBuf.writeUInt8(1, 15); headerBuf.writeUInt32BE(offset, 16); headerBuf.writeUInt32BE(bmlFinalSection.length, 20); offset += bmlFinalSection.length;
    headerBuf.writeUInt8(2, 24); headerBuf.writeUInt32BE(offset, 25); headerBuf.writeUInt32BE(blbSection.length, 29); offset += blbSection.length;
    headerBuf.writeUInt8(4, 33); headerBuf.writeUInt32BE(offset, 34); headerBuf.writeUInt32BE(bibSection.length, 38); offset += bibSection.length;
    headerBuf.writeUInt8(5, 42); headerBuf.writeUInt32BE(offset, 43); headerBuf.writeUInt32BE(bvsSection.length, 47); offset += bvsSection.length;
    headerBuf.writeUInt8(6, 51); headerBuf.writeUInt32BE(offset, 52); headerBuf.writeUInt32BE(bmsSection.length, 56); offset += bmsSection.length;
    headerBuf.writeUInt8(7, 60); headerBuf.writeUInt32BE(offset, 61); headerBuf.writeUInt32BE(bffSection.length, 65);

    const bwebFile = Buffer.concat([headerBuf, bdtSection, bmlFinalSection, blbSection, bibSection, bvsSection, bmsSection, bffSection]);
    fs.writeFileSync(outputFile, bwebFile);
    console.log(`BWEB V1.1 compilation complete: ${outputFile}`);
})();
