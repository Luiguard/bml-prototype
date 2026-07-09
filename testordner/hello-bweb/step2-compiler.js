const fs = require('fs');

const TAG_H1 = 1;
const TAG_P = 2;
const TAG_DIV = 3;

const NULL_ID = 0xFFFF;

// Node format:
// 1 byte: tagId
// 2 bytes: parentId
// 2 bytes: firstChildId
// 2 bytes: nextSiblingId
// 4 bytes: textOffset
// 2 bytes: textLength
// Total: 13 bytes per node

const nodes = [
    { id: 0, tagId: TAG_DIV, parentId: NULL_ID, firstChildId: 1, nextSiblingId: NULL_ID, text: null },
    { id: 1, tagId: TAG_H1, parentId: 0, firstChildId: NULL_ID, nextSiblingId: 2, text: "Hello BWEB" },
    { id: 2, tagId: TAG_P, parentId: 0, firstChildId: NULL_ID, nextSiblingId: NULL_ID, text: "Step 2 Verification" }
];

let textPool = Buffer.alloc(0);
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

const bmlSection = Buffer.concat([
    nodeCountBuf,
    ...nodeBuffers,
    textPoolSizeBuf,
    textPool
]);

// Header
// 'BWEB' (4) + Version (1) + Sections (1)
// Section Table: Type (1) + Offset (4) + Length (4)
const headerBuf = Buffer.alloc(15);
headerBuf.write('BWEB', 0);
headerBuf.writeUInt8(1, 4); // Version 1
headerBuf.writeUInt8(1, 5); // 1 Section
headerBuf.writeUInt8(1, 6); // Section Type 1 (BML)
headerBuf.writeUInt32BE(15, 7); // Offset = 15
headerBuf.writeUInt32BE(bmlSection.length, 11); // Length

const bwebFile = Buffer.concat([headerBuf, bmlSection]);
fs.writeFileSync('step2.bweb', bwebFile);
console.log('step2.bweb compiled successfully. Size:', bwebFile.length, 'bytes');
