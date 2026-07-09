const fs = require('fs');
const cheerio = require('cheerio');

const args = process.argv.slice(2);
if (args[0] !== 'build' || !args[1] || !args[2]) {
    console.error("Usage: node step8-compiler.js build <input.html> <output.bweb>");
    process.exit(1);
}

const inputFile = args[1];
const outputFile = args[2];

const html = fs.readFileSync(inputFile, 'utf-8');
const $ = cheerio.load(html);

const TAG_MAP = { 'h1': 1, 'p': 2, 'div': 3, 'button': 4, 'use': 5 };
const FLAG_CLICKABLE = 1;
const FLAG_PROP_BINDING = 2; // Marks that a node relies on a prop
const NULL_ID = 0xFFFF;

const nodes = [];
let textPool = Buffer.alloc(0);

// --- Phase 1: Build Tree ---
function buildTree(el, parentId) {
    if (el.type === 'text') return NULL_ID;
    
    const tagName = el.name;
    
    // Ignore <template> tags when traversing the main document
    if (tagName === 'template') return NULL_ID;

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
    let flags = tagName === 'button' ? FLAG_CLICKABLE : 0;
    const propAttr = el.attribs && el.attribs['data-prop'];
    if (propAttr) flags |= FLAG_PROP_BINDING;
    
    const node = {
        id: nodeId,
        tagId: TAG_MAP[tagName],
        parentId: parentId,
        firstChildId: NULL_ID,
        nextSiblingId: NULL_ID,
        flags: flags,
        text: null,
        layout: { x: 0, y: 0, w: 0, h: 0, size: 0, r: 0, g: 0, b: 0 }
    };
    nodes.push(node);

    if (tagName === 'use') {
        const ref = el.attribs['ref'];
        node.firstChildId = templates[ref] !== undefined ? templates[ref] : NULL_ID;
        const props = { ...el.attribs };
        delete props.ref;
        node.text = JSON.stringify(props);
    } else if (propAttr) {
        node.text = 'PROP:' + propAttr;
    } else {
        const textChild = (el.children || []).find(c => c.type === 'text' && $(c).text().trim().length > 0);
        if (textChild) node.text = $(textChild).text().trim();
    }

    let firstChildId = NULL_ID;
    let prevId = NULL_ID;
    
    // Do not parse children for <use>, it just instances the template
    if (tagName !== 'use') {
        for (const child of el.children || []) {
            if (child.type === 'text') continue;
            const childId = buildTree(child, nodeId);
            if (childId !== NULL_ID) {
                if (firstChildId === NULL_ID) firstChildId = childId;
                if (prevId !== NULL_ID) nodes[prevId].nextSiblingId = childId;
                prevId = childId;
            }
        }
    }
    
    if (tagName !== 'use') {
        node.firstChildId = firstChildId;
    }

    return nodeId;
}

// 1. Process templates first
let currentY = 0;
const templates = {};

$('template').each((i, el) => {
    const id = $(el).attr('id');
    let rootEl;
    if (el.children[0] && el.children[0].type === 'root') {
        rootEl = el.children[0].children.find(c => c.type === 'tag');
    } else {
        rootEl = el.children.find(c => c.type === 'tag');
    }
    
    if (rootEl) {
        const rootId = buildTree(rootEl, NULL_ID);
        templates[id] = rootId;
        
        let savedY = currentY;
        currentY = 0;
        doLayout(rootId, 0); // Compute relative layout
        nodes[rootId].layout.h = currentY; // Store total height of the template
        currentY = savedY;
    }
});

// 2. Process main body
currentY = 80;
const rootId = buildTree($('body')[0], NULL_ID);
doLayout(rootId, 100);

// --- Phase 2: Compute Layout ---
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
    else if (node.tagId === 4) { // BUTTON
        node.layout = { x, y: currentY, w: 200, h: 40, size: 16, r: 41, g: 128, b: 185 };
        currentY += 50;
    }
    else if (node.tagId === 5) { // USE
        const templateRootId = node.firstChildId;
        if (templateRootId !== NULL_ID) {
            const templateRoot = nodes[templateRootId];
            // Store instance absolute x/y, width, and template's height
            node.layout = { x, y: currentY, w: templateRoot.layout.w || 600, h: templateRoot.layout.h, size: 0, r: 0, g: 0, b: 0 };
            currentY += templateRoot.layout.h;
        }
    }
    else if (node.tagId === 3) { // DIV
        let isCard = false;
        let c = node.firstChildId;
        while (c !== NULL_ID) {
            if (nodes[c].tagId === 2 || nodes[c].tagId === 4) isCard = true;
            c = nodes[c].nextSiblingId;
        }
        
        if (isCard) {
            const boxY = currentY;
            node.layout = { x, y: boxY, w: 600, h: 100, size: 0, r: 224, g: 224, b: 224 };
            currentY += 10;
            
            let child = node.firstChildId;
            while (child !== NULL_ID) {
                doLayout(child, x + 20);
                child = nodes[child].nextSiblingId;
            }
            currentY = boxY + 100 + 20;
        } else {
            let child = node.firstChildId;
            while (child !== NULL_ID) {
                doLayout(child, x);
                child = nodes[child].nextSiblingId;
            }
        }
    }
}

// --- Phase 3: Build Binary Sections ---

// 0. BDT Section
const bdtBuffers = [];
for (const node of nodes) {
    const buf = Buffer.alloc(9);
    buf.writeUInt16BE(node.id, 0);
    buf.writeUInt16BE(node.parentId, 2);
    buf.writeUInt16BE(node.firstChildId, 4);
    buf.writeUInt16BE(node.nextSiblingId, 6);
    buf.writeUInt8(node.flags, 8);
    bdtBuffers.push(buf);
}
const bdtSection = Buffer.concat([
    (() => { const b = Buffer.alloc(2); b.writeUInt16BE(nodes.length, 0); return b; })(),
    ...bdtBuffers
]);

// 1. BML Section
const bmlBuffers = [];
for (const node of nodes) {
    const buf = Buffer.alloc(7);
    buf.writeUInt8(node.tagId, 0);
    if (node.text) {
        const textBuf = Buffer.from(node.text, 'utf8');
        buf.writeUInt32BE(textPool.length, 1);
        buf.writeUInt16BE(textBuf.length, 5);
        textPool = Buffer.concat([textPool, textBuf]);
    } else {
        buf.writeUInt32BE(0, 1);
        buf.writeUInt16BE(0, 5);
    }
    bmlBuffers.push(buf);
}
const bmlSection = Buffer.concat([
    (() => { const b = Buffer.alloc(2); b.writeUInt16BE(nodes.length, 0); return b; })(),
    ...bmlBuffers,
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(textPool.length, 0); return b; })(),
    textPool
]);

// 2. BLB Section
const blbBuffers = [];
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
    blbBuffers.push(buf);
}
const blbSection = Buffer.concat([
    (() => { const b = Buffer.alloc(2); b.writeUInt16BE(nodes.length, 0); return b; })(),
    ...blbBuffers
]);

const headerBuf = Buffer.alloc(4 + 1 + 1 + (3 * 9));
headerBuf.write('BWEB', 0);
headerBuf.writeUInt8(1, 4);
headerBuf.writeUInt8(3, 5);

let offset = 6 + (3 * 9);

headerBuf.writeUInt8(0, 6);
headerBuf.writeUInt32BE(offset, 7);
headerBuf.writeUInt32BE(bdtSection.length, 11);
offset += bdtSection.length;

headerBuf.writeUInt8(1, 15);
headerBuf.writeUInt32BE(offset, 16);
headerBuf.writeUInt32BE(bmlSection.length, 20);
offset += bmlSection.length;

headerBuf.writeUInt8(2, 24);
headerBuf.writeUInt32BE(offset, 25);
headerBuf.writeUInt32BE(blbSection.length, 29);

const bwebFile = Buffer.concat([headerBuf, bdtSection, bmlSection, blbSection]);
fs.writeFileSync(outputFile, bwebFile);
console.log(`Compiled ${inputFile} -> ${outputFile}. Size: ${bwebFile.length} bytes`);
