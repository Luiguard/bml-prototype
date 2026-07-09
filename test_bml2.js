const fs = require('fs');

const bweb = fs.readFileSync('/home/benjamin/projects/mediclean-pro/service.bweb');
const numSections = bweb.readUInt32BE(4);
let headerOffset = 8;
let dataOffset = 8 + numSections * 8;

let bmlBuf = null;

for (let i = 0; i < numSections; i++) {
    const type = bweb.readUInt8(headerOffset);
    const len = bweb.readUInt32BE(headerOffset + 1);
    const compressed = bweb.readUInt8(headerOffset + 5);
    headerOffset += 8;
    
    let chunk = bweb.slice(dataOffset, dataOffset + len);
    dataOffset += len;
    
    if (type === 1) {
        const zlib = require('zlib');
        bmlBuf = compressed === 1 ? zlib.inflateSync(chunk) : chunk;
        break;
    }
}

let o = 4; // Skip BML\x01
let textCount = 0;

while (o < bmlBuf.length) {
    const tagByte = bmlBuf.readUInt8(o++);
    const nAttr = bmlBuf.readUInt8(o++);
    
    if (tagByte === 0xFF) {
        o--;
        const tLen = bmlBuf.readUInt16BE(o); o += 2;
        const txt = bmlBuf.slice(o, o + tLen).toString('utf-8');
        o += tLen;
        console.log(`Text node: len=${tLen}, txt="${txt.substring(0, 15)}"`);
        textCount++;
        continue;
    }
    
    for (let i = 0; i < nAttr; i++) {
        const aId = bmlBuf.readUInt8(o++);
        const aLen = bmlBuf.readUInt16BE(o); o += 2;
        o += aLen;
    }
}
console.log("Done");
