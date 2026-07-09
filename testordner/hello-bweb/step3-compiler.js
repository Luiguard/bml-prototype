const fs = require('fs');

const TAG_H1 = 1;
const TAG_P = 2;
const TAG_DIV = 3;

const NULL_ID = 0xFFFF;

const nodes = [
    { id: 0, tagId: TAG_DIV, parentId: NULL_ID, firstChildId: 1, nextSiblingId: NULL_ID, text: null },
    { id: 1, tagId: TAG_H1, parentId: 0, firstChildId: NULL_ID, nextSiblingId: 2, text: "Hello BWEB" },
    { id: 2, tagId: TAG_DIV, parentId: 0, firstChildId: 3, nextSiblingId: 4, text: null },
    { id: 3, tagId: TAG_P, parentId: 2, firstChildId: NULL_ID, nextSiblingId: NULL_ID, text: "Einfache Box mit Textinhalt" },
    { id: 4, tagId: TAG_DIV, parentId: 0, firstChildId: 5, nextSiblingId: 6, text: null },
    { id: 5, tagId: TAG_P, parentId: 4, firstChildId: NULL_ID, nextSiblingId: NULL_ID, text: "Zweite Box (Binary Render)" },
    { id: 6, tagId: TAG_DIV, parentId: 0, firstChildId: 7, nextSiblingId: NULL_ID, text: null },
    { id: 7, tagId: TAG_P, parentId: 6, firstChildId: NULL_ID, nextSiblingId: NULL_ID, text: "Dritte Box (Pure Canvas)" }
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

const headerBuf = Buffer.alloc(15);
headerBuf.write('BWEB', 0);
headerBuf.writeUInt8(1, 4);
headerBuf.writeUInt8(1, 5);
headerBuf.writeUInt8(1, 6);
headerBuf.writeUInt32BE(15, 7);
headerBuf.writeUInt32BE(bmlSection.length, 11);

const bwebFile = Buffer.concat([headerBuf, bmlSection]);
fs.writeFileSync('step3.bweb', bwebFile);
console.log('step3.bweb compiled successfully. Size:', bwebFile.length, 'bytes');
