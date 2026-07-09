const fs = require('fs');
const cheerio = require('cheerio');

const args = process.argv.slice(2);
if (args[0] !== 'build' || !args[1] || !args[2]) {
    console.error("Usage: node step5-compiler.js build <input.html> <output.bweb>");
    process.exit(1);
}

const inputFile = args[1];
const outputFile = args[2];

const html = fs.readFileSync(inputFile, 'utf-8');
const $ = cheerio.load(html);

const TAG_MAP = { 'h1': 1, 'p': 2, 'div': 3 };
const NULL_ID = 0xFFFF;

const nodes = [];
let textPool = Buffer.alloc(0);

// --- Phase 1: Build BML Tree ---
function buildTree(el, parentId) {
    if (el.type === 'text') return NULL_ID;
    
    const tagName = el.name;
    if (!TAG_MAP[tagName]) {
        let firstChildId = NULL_ID;
        let prevId = NULL_ID;
        for (const child of el.children || []) {
            const childId = buildTree(child, parentId);
            if (childId !== NULL_ID) {
                if (firstChildId === NULL_ID) firstChildId = childId;
                if (prevId !== NULL_ID) nodes[prevId].nextSiblingId = childId;
                prevId = childId;
            }
        }
        return firstChildId;
    }

    const nodeId = nodes.length;
    const node = {
        id: nodeId,
        tagId: TAG_MAP[tagName],
        parentId: parentId,
        firstChildId: NULL_ID,
        nextSiblingId: NULL_ID,
        text: null,
        layout: { x: 0, y: 0, w: 0, h: 0, size: 0, r: 0, g: 0, b: 0 }
    };
    nodes.push(node);

    const textChild = (el.children || []).find(c => c.type === 'text' && $(c).text().trim().length > 0);
    if (textChild) node.text = $(textChild).text().trim();

    let firstChildId = NULL_ID;
    let prevId = NULL_ID;
    for (const child of el.children || []) {
        if (child.type === 'text') continue;
        const childId = buildTree(child, nodeId);
        if (childId !== NULL_ID) {
            if (firstChildId === NULL_ID) firstChildId = childId;
            if (prevId !== NULL_ID) nodes[prevId].nextSiblingId = childId;
            prevId = childId;
        }
    }
    node.firstChildId = firstChildId;
    return nodeId;
}

const rootId = buildTree($('body')[0], NULL_ID);

// --- Phase 2: Compute BLB Layout ---
let currentY = 80;

function doLayout(nodeId, x) {
    if (nodeId === NULL_ID) return;
    const node = nodes[nodeId];
    
    if (node.tagId === 1) { // H1
        node.layout = { x, y: currentY, w: 600, h: 40, size: 36, r: 44, g: 62, b: 80 };
        currentY += 60;
    } 
    else if (node.tagId === 2) { // P
        node.layout = { x, y: currentY, w: 560, h: 20, size: 16, r: 85, g: 85, b: 85 };
        currentY += 40;
    } 
    else if (node.tagId === 3) { // DIV
        let isCard = false;
        let c = node.firstChildId;
        while (c !== NULL_ID) {
            if (nodes[c].tagId === 2) isCard = true;
            c = nodes[c].nextSiblingId;
        }
        
        if (isCard) {
            const boxY = currentY - 20;
            node.layout = { x, y: boxY, w: 600, h: 80, size: 0, r: 224, g: 224, b: 224 };
            currentY += 30; // Move inside
            
            let child = node.firstChildId;
            while (child !== NULL_ID) {
                doLayout(child, x + 20);
                child = nodes[child].nextSiblingId;
            }
            currentY = boxY + 80 + 30; // Move past box
        } else {
            let child = node.firstChildId;
            while (child !== NULL_ID) {
                doLayout(child, x);
                child = nodes[child].nextSiblingId;
            }
        }
    }
}

doLayout(rootId, 100);

// --- Phase 3: Build Binary Sections ---

// 1. BML Section
const nodeBuffers = [];
for (const node of nodes) {
    const buf = Buffer.alloc(13);
    buf.writeUInt8(node.tagId, 0);
    buf.writeUInt16BE(node.parentId, 1);
    buf.writeUInt16BE(node.firstChildId, 3);
    buf.writeUInt16BE(node.nextSiblingId, 5);
    
    if (node.text) {
        const textBuf = Buffer.from(node.text, 'utf8');
        buf.writeUInt32BE(textPool.length, 7);
        buf.writeUInt16BE(textBuf.length, 11);
        textPool = Buffer.concat([textPool, textBuf]);
    } else {
        buf.writeUInt32BE(0, 7);
        buf.writeUInt16BE(0, 11);
    }
    nodeBuffers.push(buf);
}
const nodeCountBuf = Buffer.alloc(2);
nodeCountBuf.writeUInt16BE(nodes.length, 0);
const textPoolSizeBuf = Buffer.alloc(4);
textPoolSizeBuf.writeUInt32BE(textPool.length, 0);
const bmlSection = Buffer.concat([nodeCountBuf, ...nodeBuffers, textPoolSizeBuf, textPool]);

// 2. BLB Section
const layoutBuffers = [];
for (const node of nodes) {
    const buf = Buffer.alloc(20);
    buf.writeFloatBE(node.layout.x, 0);
    buf.writeFloatBE(node.layout.y, 4);
    buf.writeFloatBE(node.layout.w, 8);
    buf.writeFloatBE(node.layout.h, 12);
    buf.writeUInt8(node.layout.size, 16);
    buf.writeUInt8(node.layout.r, 17);
    buf.writeUInt8(node.layout.g, 18);
    buf.writeUInt8(node.layout.b, 19);
    layoutBuffers.push(buf);
}
const blbSection = Buffer.concat(layoutBuffers);

// Header (2 Sections)
const headerBuf = Buffer.alloc(24);
headerBuf.write('BWEB', 0);
headerBuf.writeUInt8(1, 4);
headerBuf.writeUInt8(2, 5); // 2 Sections

// Section 0 (BML)
headerBuf.writeUInt8(1, 6); // Type 1
headerBuf.writeUInt32BE(24, 7); // Offset
headerBuf.writeUInt32BE(bmlSection.length, 11); // Length

// Section 1 (BLB)
headerBuf.writeUInt8(2, 15); // Type 2
headerBuf.writeUInt32BE(24 + bmlSection.length, 16); // Offset
headerBuf.writeUInt32BE(blbSection.length, 20); // Length

const bwebFile = Buffer.concat([headerBuf, bmlSection, blbSection]);
fs.writeFileSync(outputFile, bwebFile);
console.log(`Compiled ${inputFile} -> ${outputFile}. Size: ${bwebFile.length} bytes`);
