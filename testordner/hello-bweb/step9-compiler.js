const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

const args = process.argv.slice(2);
if (args[0] !== 'build' || !args[1] || !args[2]) {
    console.error("Usage: node step9-compiler.js build <input.html> <output.bweb>");
    process.exit(1);
}

const inputFile = path.resolve(args[1]);
const outputFile = path.resolve(args[2]);

// Custom mappings for our simple BWEB format
const TAG_MAP = { '#text': 0, 'h1': 1, 'p': 2, 'div': 3, 'button': 4, 'h2': 5 };
const NULL_ID = 0xFFFF;

(async () => {
    console.log(`Launching Puppeteer to extract real CSS layout from ${inputFile}...`);
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 800 });
    await page.goto(`file://${inputFile}`, { waitUntil: 'networkidle0' });

    const nodesData = await page.evaluate(() => {
        let nodeIdCounter = 0;
        const nodes = [];

        function parseColor(str) {
            const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) {
                return { 
                    r: parseInt(m[1]), 
                    g: parseInt(m[2]), 
                    b: parseInt(m[3]), 
                    a: m[4] ? Math.round(parseFloat(m[4]) * 255) : 255 
                };
            }
            return { r: 0, g: 0, b: 0, a: 0 }; // Transparent fallback
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
                if (currentLineText.trim()) {
                    lines.push({ text: currentLineText.trim(), rect: currentLineRect });
                }
                
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
                        fgR: fg.r, fgG: fg.g, fgB: fg.b, 
                        bgR: 0, bgG: 0, bgB: 0, bgA: 0, radius: 0 
                    };
                    
                    const nodeData = {
                        id, parentId, tag: '#text', isText: true, textContent: line.text, layout,
                        firstChild: 0xFFFF, nextSibling: 0xFFFF, flags: 0
                    };
                    nodes.push(nodeData);
                    
                    if (firstLineId === 0xFFFF) firstLineId = id;
                    if (prevLineId !== 0xFFFF) nodes[prevLineId].nextSibling = id;
                    prevLineId = id;
                }
                
                return firstLineId; // Return the head of the chain
            }

            const id = nodeIdCounter++;
            let tag = element.tagName.toLowerCase();
            if (tag === 'body' || tag === 'html') tag = 'div'; 

            let layout = { x: 0, y: 0, w: 0, h: 0, size: 0, fgR:0, fgG:0, fgB:0, bgR:0, bgG:0, bgB:0, bgA:0, radius: 0 };
            
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const bg = parseColor(style.backgroundColor);
            const fg = parseColor(style.color);
            
            layout.x = rect.x;
            layout.y = rect.y;
            layout.w = rect.width;
            layout.h = rect.height;
            layout.size = parseFloat(style.fontSize) || 16;
            layout.fgR = fg.r; layout.fgG = fg.g; layout.fgB = fg.b;
            layout.bgR = bg.r; layout.bgG = bg.g; layout.bgB = bg.b; layout.bgA = bg.a;
            layout.radius = parseFloat(style.borderRadius) || 0;

            const nodeData = {
                id,
                parentId,
                tag,
                isText: false,
                textContent: '',
                layout,
                firstChild: 0xFFFF,
                nextSibling: 0xFFFF,
                flags: 0
            };
            nodes.push(nodeData);

            let childId = 0xFFFF;
            let lastChildId = 0xFFFF;
            for (const child of element.childNodes) {
                const cid = traverse(child, id); // cid is the start of the chain returned by traverse
                if (cid !== 0xFFFF) {
                    if (childId === 0xFFFF) childId = cid;
                    if (lastChildId !== 0xFFFF) {
                        nodes[lastChildId].nextSibling = cid;
                    }
                    
                    // The child might be a chain of text nodes. Find the last node in the chain!
                    let endOfChain = cid;
                    while (nodes[endOfChain] && nodes[endOfChain].nextSibling !== 0xFFFF) {
                        endOfChain = nodes[endOfChain].nextSibling;
                    }
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

    console.log(`Extracted ${nodesData.length} nodes (including text line splits).`);

    let textPool = Buffer.alloc(0);
    
    // Convert to binary
    const bdtBuffers = [];
    const bmlBuffers = [];
    const blbBuffers = [];

    for (const node of nodesData) {
        // BDT: id (2), parent (2), firstChild (2), nextSibling (2), flags (1) = 9 bytes
        const bdtBuf = Buffer.alloc(9);
        bdtBuf.writeUInt16BE(node.id, 0);
        bdtBuf.writeUInt16BE(node.parentId, 2);
        bdtBuf.writeUInt16BE(node.firstChild, 4);
        bdtBuf.writeUInt16BE(node.nextSibling, 6);
        bdtBuf.writeUInt8(node.flags, 8);
        bdtBuffers.push(bdtBuf);

        // BML: tagId (1), textOffset (4), textLength (2) = 7 bytes
        const tagId = TAG_MAP[node.tag] !== undefined ? TAG_MAP[node.tag] : 3; // default to div
        const bmlBuf = Buffer.alloc(7);
        bmlBuf.writeUInt8(tagId, 0);
        if (node.isText && node.textContent) {
            const textBuf = Buffer.from(node.textContent, 'utf8');
            bmlBuf.writeUInt32BE(textPool.length, 1);
            bmlBuf.writeUInt16BE(textBuf.length, 5);
            textPool = Buffer.concat([textPool, textBuf]);
        } else {
            bmlBuf.writeUInt32BE(0, 1);
            bmlBuf.writeUInt16BE(0, 5);
        }
        bmlBuffers.push(bmlBuf);

        // BLB: x,y,w,h (16) + size(1) + fg(3) + bg(4) + radius(2) + isText(1) + pad(1) = 28 bytes
        const blbBuf = Buffer.alloc(28);
        blbBuf.writeFloatBE(node.layout.x, 0);
        blbBuf.writeFloatBE(node.layout.y, 4);
        blbBuf.writeFloatBE(node.layout.w, 8);
        blbBuf.writeFloatBE(node.layout.h, 12);
        blbBuf.writeUInt8(node.layout.size, 16);
        blbBuf.writeUInt8(node.layout.fgR, 17);
        blbBuf.writeUInt8(node.layout.fgG, 18);
        blbBuf.writeUInt8(node.layout.fgB, 19);
        blbBuf.writeUInt8(node.layout.bgR, 20);
        blbBuf.writeUInt8(node.layout.bgG, 21);
        blbBuf.writeUInt8(node.layout.bgB, 22);
        blbBuf.writeUInt8(node.layout.bgA, 23);
        blbBuf.writeUInt16BE(node.layout.radius, 24);
        blbBuf.writeUInt8(node.isText ? 1 : 0, 26);
        blbBuf.writeUInt8(0, 27); // pad
        blbBuffers.push(blbBuf);
    }

    const nodeCount = nodesData.length;
    const countBuf = Buffer.alloc(2); countBuf.writeUInt16BE(nodeCount, 0);

    const bdtSection = Buffer.concat([countBuf, ...bdtBuffers]);
    
    const textPoolSizeBuf = Buffer.alloc(4); textPoolSizeBuf.writeUInt32BE(textPool.length, 0);
    const bmlSection = Buffer.concat([countBuf, ...bmlBuffers, textPoolSizeBuf, textPool]);
    
    const blbSection = Buffer.concat([countBuf, ...blbBuffers]);

    // Header
    const headerBuf = Buffer.alloc(6 + (3 * 9));
    headerBuf.write('BWEB', 0);
    headerBuf.writeUInt8(1, 4);
    headerBuf.writeUInt8(3, 5);

    let offset = 6 + (3 * 9);

    // Sec 0: BDT
    headerBuf.writeUInt8(0, 6); headerBuf.writeUInt32BE(offset, 7); headerBuf.writeUInt32BE(bdtSection.length, 11); offset += bdtSection.length;
    // Sec 1: BML
    headerBuf.writeUInt8(1, 15); headerBuf.writeUInt32BE(offset, 16); headerBuf.writeUInt32BE(bmlSection.length, 20); offset += bmlSection.length;
    // Sec 2: BLB
    headerBuf.writeUInt8(2, 24); headerBuf.writeUInt32BE(offset, 25); headerBuf.writeUInt32BE(blbSection.length, 29);

    const bwebFile = Buffer.concat([headerBuf, bdtSection, bmlSection, blbSection]);
    fs.writeFileSync(outputFile, bwebFile);
    console.log(`Success! Wrote ${bwebFile.length} bytes to ${outputFile}`);

})();
