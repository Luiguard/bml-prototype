const fs = require('fs');

// BML Constants
const TAG_DIV = 1;
const TAG_H1 = 2;
const TAG_P = 3;
const TAG_H2 = 4;
const TAG_TEXT = 255;
const ATTR_CLASS = 1;

function writeString(buf, offset, str) {
    const bytes = Buffer.from(str, 'utf8');
    buf.writeUInt16BE(bytes.length, offset);
    bytes.copy(buf, offset + 2);
    return offset + 2 + bytes.length;
}

function createTextNode(text) {
    const textBytes = Buffer.from(text, 'utf8');
    const buf = Buffer.alloc(1 + 2 + textBytes.length);
    buf.writeUInt8(TAG_TEXT, 0);
    buf.writeUInt16BE(textBytes.length, 1);
    textBytes.copy(buf, 3);
    return buf;
}

function createElementNode(tag, className, children) {
    let attrsBuf = Buffer.alloc(1);
    if (className) {
        attrsBuf.writeUInt8(1, 0); // 1 attribute
        const classBuf = Buffer.alloc(1 + 2 + Buffer.byteLength(className));
        classBuf.writeUInt8(ATTR_CLASS, 0);
        writeString(classBuf, 1, className);
        attrsBuf = Buffer.concat([attrsBuf, classBuf]);
    } else {
        attrsBuf.writeUInt8(0, 0); // 0 attributes
    }

    const childrenCountBuf = Buffer.alloc(2);
    childrenCountBuf.writeUInt16BE(children.length, 0);

    return Buffer.concat([
        Buffer.from([tag]),
        attrsBuf,
        childrenCountBuf,
        ...children
    ]);
}

// Build Tree
const tree = createElementNode(TAG_DIV, null, [
    createElementNode(TAG_DIV, 'header', [
        createElementNode(TAG_H1, null, [createTextNode('Hello BWEB')]),
        createElementNode(TAG_P, 'subtitle', [createTextNode('Verifikation der BWEB Architektur - Schritt 0')])
    ]),
    createElementNode(TAG_DIV, 'cards', [
        createElementNode(TAG_DIV, 'card', [
            createElementNode(TAG_H2, null, [createTextNode('Card 1')]),
            createElementNode(TAG_P, null, [createTextNode('Einfache Box mit Textinhalt.')])
        ]),
        createElementNode(TAG_DIV, 'card', [
            createElementNode(TAG_H2, null, [createTextNode('Card 2')]),
            createElementNode(TAG_P, null, [createTextNode('Zweite Box.')])
        ]),
        createElementNode(TAG_DIV, 'card', [
            createElementNode(TAG_H2, null, [createTextNode('Card 3')]),
            createElementNode(TAG_P, null, [createTextNode('Dritte Box.')])
        ])
    ])
]);

// Header
// 'BWEB' (4) + Version (1) + Sections (1)
// Section Table: Type (1) + Offset (4) + Length (4)
const headerBuf = Buffer.alloc(4 + 1 + 1 + 1 + 4 + 4);
headerBuf.write('BWEB', 0);
headerBuf.writeUInt8(1, 4); // Version 1
headerBuf.writeUInt8(1, 5); // 1 Section

headerBuf.writeUInt8(1, 6); // Section Type 1 (BML)
headerBuf.writeUInt32BE(15, 7); // Offset = 15 (immediately after header)
headerBuf.writeUInt32BE(tree.length, 11); // Length

const bwebFile = Buffer.concat([headerBuf, tree]);

fs.writeFileSync('step1.bweb', bwebFile);
console.log('step1.bweb compiled successfully. Size:', bwebFile.length, 'bytes');
