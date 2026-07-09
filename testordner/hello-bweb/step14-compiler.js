const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

const args = process.argv.slice(2);
if (args[0] !== 'build' || !args[1] || !args[2]) {
    console.error("Usage: node step14-compiler.js build <input.html> <output.bweb>");
    process.exit(1);
}

const inputPath = path.resolve(args[1]);
const inputDir = path.dirname(inputPath);
const outputFile = path.resolve(args[2]);

const TAG_MAP = { '#text': 0, 'h1': 1, 'p': 2, 'div': 3, 'button': 4, 'h2': 5, 'img': 6, 'video': 7, 'header': 8, 'main': 9, 'article': 10, 'span': 11, 'table': 12, 'tr': 13, 'td': 14, 'th': 15 };

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });
    await page.goto(`file://${inputPath}`, { waitUntil: 'networkidle0' });

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
                const originalText = element.nodeValue;
                if (!originalText.trim()) return 0xFFFF;
                
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
                        size: parseFloat(style.fontSize) || 16, 
                        fgR: fg.r, fgG: fg.g, fgB: fg.b, bgR: 0, bgG: 0, bgB: 0, bgA: 0, radius: 0 
                    };
                    
                    let meta = {};
                    const zIndex = parseInt(style.zIndex);
                    if (!isNaN(zIndex)) meta.zIndex = zIndex;
                    
                    const nodeData = { id, parentId, tag: '#text', isText: true, textContent: line.text, layout, firstChild: 0xFFFF, nextSibling: 0xFFFF, flags: 0, meta: Object.keys(meta).length > 0 ? meta : null };
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
            if (tag === 'img' || tag === 'video') {
                src = element.getAttribute('src');
            }
            
            let meta = {};
            const attrs = element.attributes;
            for (let i = 0; i < attrs.length; i++) {
                const attr = attrs[i];
                if (attr.name.startsWith('data-') || attr.name.startsWith('aria-') || attr.name === 'role' || attr.name === 'alt' || attr.name === 'tabindex' || attr.name === 'id') {
                    meta[attr.name] = attr.value;
                }
                if (attr.name === 'onclick') {
                    meta.onclick = attr.value;
                }
            }

            let layout = { x: 0, y: 0, w: 0, h: 0, size: 0, fgR:0, fgG:0, fgB:0, bgR:0, bgG:0, bgB:0, bgA:0, radius: 0 };
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            const opacity = parseFloat(style.opacity);
            if (!isNaN(opacity)) meta.opacity = opacity;
            
            const zIndex = parseInt(style.zIndex);
            if (!isNaN(zIndex)) meta.zIndex = zIndex;

            const bw = parseFloat(style.borderTopWidth);
            if (bw > 0) {
                meta.borderW = bw;
                meta.borderC = style.borderTopColor;
            }

            const bg = parseColor(style.backgroundColor);
            const fg = parseColor(style.color);
            
            layout.x = rect.x; layout.y = rect.y; layout.w = rect.width; layout.h = rect.height;
            layout.size = parseFloat(style.fontSize) || 16;
            layout.fgR = fg.r; layout.fgG = fg.g; layout.fgB = fg.b;
            layout.bgR = bg.r; layout.bgG = bg.g; layout.bgB = bg.b; layout.bgA = bg.a;
            layout.radius = parseFloat(style.borderRadius) || 0;

            const nodeData = { id, parentId, tag, isText: false, textContent: src || '', layout, firstChild: 0xFFFF, nextSibling: 0xFFFF, flags: 0, meta: Object.keys(meta).length > 0 ? meta : null };
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
    let vidCounter = 0;

    for (const node of nodesData) {
        if (node.tag === 'img' && node.textContent) {
            const filePath = path.join(inputDir, node.textContent);
            if (fs.existsSync(filePath)) {
                images.push({ id: imgCounter, buffer: fs.readFileSync(filePath) });
                node.textContent = `bib://${imgCounter}`;
                imgCounter++;
            }
        }
    }

    let bibHeaders = Buffer.alloc(2 + (images.length * 10)); 
    bibHeaders.writeUInt16BE(images.length, 0);
    let bibData = Buffer.alloc(0);
    let hPos = 2;
    for (const img of images) {
        bibHeaders.writeUInt16BE(img.id, hPos);
        bibHeaders.writeUInt32BE(bibData.length, hPos + 2);
        bibHeaders.writeUInt32BE(img.buffer.length, hPos + 6);
        hPos += 10;
        bibData = Buffer.concat([bibData, img.buffer]);
    }
    const bibSection = Buffer.concat([bibHeaders, bibData]);

    const bvsSection = Buffer.alloc(2);

    const bmsBuffers = [];
    let metaTextPool = Buffer.alloc(0);
    let bmsCount = 0;
    for (const node of nodesData) {
        if (node.meta) {
            bmsCount++;
            const metaBuf = Buffer.alloc(10);
            metaBuf.writeUInt16BE(node.id, 0);
            const textBuf = Buffer.from(JSON.stringify(node.meta), 'utf8');
            metaBuf.writeUInt32BE(metaTextPool.length, 2);
            metaBuf.writeUInt32BE(textBuf.length, 6);
            bmsBuffers.push(metaBuf);
            metaTextPool = Buffer.concat([metaTextPool, textBuf]);
        }
    }
    const bmsCountBuf = Buffer.alloc(2); bmsCountBuf.writeUInt16BE(bmsCount, 0);
    const bmsTextPoolSizeBuf = Buffer.alloc(4); bmsTextPoolSizeBuf.writeUInt32BE(metaTextPool.length, 0);
    const bmsSection = Buffer.concat([bmsCountBuf, ...bmsBuffers, bmsTextPoolSizeBuf, metaTextPool]);

    let textPool = Buffer.alloc(0);
    const bdtBuffers = [];
    const bmlBuffers = [];
    const blbBuffers = [];

    for (const node of nodesData) {
        const bdtBuf = Buffer.alloc(9);
        bdtBuf.writeUInt16BE(node.id, 0); bdtBuf.writeUInt16BE(node.parentId, 2);
        bdtBuf.writeUInt16BE(node.firstChild, 4); bdtBuf.writeUInt16BE(node.nextSibling, 6);
        bdtBuf.writeUInt8(node.flags, 8);
        bdtBuffers.push(bdtBuf);

        const tagId = TAG_MAP[node.tag] !== undefined ? TAG_MAP[node.tag] : 3;
        const bmlBuf = Buffer.alloc(7);
        bmlBuf.writeUInt8(tagId, 0);
        if (node.textContent) {
            const textBuf = Buffer.from(node.textContent, 'utf8');
            bmlBuf.writeUInt32BE(textPool.length, 1);
            bmlBuf.writeUInt16BE(textBuf.length, 5);
            textPool = Buffer.concat([textPool, textBuf]);
        } else {
            bmlBuf.writeUInt32BE(0, 1); bmlBuf.writeUInt16BE(0, 5);
        }
        bmlBuffers.push(bmlBuf);

        const blbBuf = Buffer.alloc(28);
        blbBuf.writeFloatBE(node.layout.x, 0); blbBuf.writeFloatBE(node.layout.y, 4);
        blbBuf.writeFloatBE(node.layout.w, 8); blbBuf.writeFloatBE(node.layout.h, 12);
        blbBuf.writeUInt8(node.layout.size, 16);
        blbBuf.writeUInt8(node.layout.fgR, 17); blbBuf.writeUInt8(node.layout.fgG, 18); blbBuf.writeUInt8(node.layout.fgB, 19);
        blbBuf.writeUInt8(node.layout.bgR, 20); blbBuf.writeUInt8(node.layout.bgG, 21); blbBuf.writeUInt8(node.layout.bgB, 22); blbBuf.writeUInt8(node.layout.bgA, 23);
        blbBuf.writeUInt16BE(node.layout.radius, 24);
        blbBuf.writeUInt8(node.isText ? 1 : 0, 26); blbBuf.writeUInt8(0, 27);
        blbBuffers.push(blbBuf);
    }

    const countBuf = Buffer.alloc(2); countBuf.writeUInt16BE(nodesData.length, 0);
    const bdtSection = Buffer.concat([countBuf, ...bdtBuffers]);
    const textPoolSizeBuf = Buffer.alloc(4); textPoolSizeBuf.writeUInt32BE(textPool.length, 0);
    const bmlSection = Buffer.concat([countBuf, ...bmlBuffers, textPoolSizeBuf, textPool]);
    const blbSection = Buffer.concat([countBuf, ...blbBuffers]);

    const headerBuf = Buffer.alloc(6 + (6 * 9));
    headerBuf.write('BWEB', 0);
    headerBuf.writeUInt8(1, 4);
    headerBuf.writeUInt8(6, 5); 

    let offset = 6 + (6 * 9);

    headerBuf.writeUInt8(0, 6); headerBuf.writeUInt32BE(offset, 7); headerBuf.writeUInt32BE(bdtSection.length, 11); offset += bdtSection.length;
    headerBuf.writeUInt8(1, 15); headerBuf.writeUInt32BE(offset, 16); headerBuf.writeUInt32BE(bmlSection.length, 20); offset += bmlSection.length;
    headerBuf.writeUInt8(2, 24); headerBuf.writeUInt32BE(offset, 25); headerBuf.writeUInt32BE(blbSection.length, 29); offset += blbSection.length;
    headerBuf.writeUInt8(4, 33); headerBuf.writeUInt32BE(offset, 34); headerBuf.writeUInt32BE(bibSection.length, 38); offset += bibSection.length;
    headerBuf.writeUInt8(5, 42); headerBuf.writeUInt32BE(offset, 43); headerBuf.writeUInt32BE(bvsSection.length, 47); offset += bvsSection.length;
    headerBuf.writeUInt8(6, 51); headerBuf.writeUInt32BE(offset, 52); headerBuf.writeUInt32BE(bmsSection.length, 56);

    const bwebFile = Buffer.concat([headerBuf, bdtSection, bmlSection, blbSection, bibSection, bvsSection, bmsSection]);
    fs.writeFileSync(outputFile, bwebFile);
})();
