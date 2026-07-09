const fs = require('fs');
const zlib = require('zlib');

const bweb = fs.readFileSync('/home/benjamin/projects/mediclean-pro/service.bweb');
const numSections = bweb.readUInt32BE(4);
let headerOffset = 8;
let dataOffset = 8 + numSections * 8;

let blbBuf = null;

for (let i = 0; i < numSections; i++) {
    const type = bweb.readUInt8(headerOffset);
    const len = bweb.readUInt32BE(headerOffset + 1);
    const compressed = bweb.readUInt8(headerOffset + 5);
    headerOffset += 8;
    
    let chunk = bweb.slice(dataOffset, dataOffset + len);
    dataOffset += len;
    
    if (type === 3) {
        if (compressed === 1) {
            blbBuf = zlib.inflateSync(chunk);
        } else {
            blbBuf = chunk;
        }
    }
}

let o = 0;
const numNodes = blbBuf.readUInt32BE(o); o += 4;
console.log(`BLB nodes: ${numNodes}`);

let parsedProps = 0;
for (let j = 0; j < Math.min(numNodes, 5); j++) {
    const nid = blbBuf.readUInt16BE(o); o += 2;
    const propCount = blbBuf.readUInt8(o++);
    console.log(`Node ${nid} has ${propCount} props`);
    for (let p = 0; p < propCount; p++) {
        const tag = blbBuf.readUInt8(o++);
        const type = blbBuf.readUInt8(o++);
        let val = null;
        if (type === 0) {
            const unit = blbBuf.readUInt8(o++);
            const num = blbBuf.readInt32BE(o); o += 4;
            let uStr = 'px';
            if (unit === 1) uStr = '%'; else if (unit === 2) uStr = 'em'; else if (unit === 3) uStr = 'vw'; else if (unit === 4) uStr = 'auto';
            val = (num/100) + uStr;
        } else if (type === 1) {
            val = blbBuf.readUInt8(o++);
        } else if (type === 2) {
            const c32 = blbBuf.readUInt32BE(o); o += 4;
            const r = (c32 >>> 24) & 255;
            const g = (c32 >>> 16) & 255;
            const b = (c32 >>> 8) & 255;
            const a = (c32 & 255) / 255;
            val = `rgba(${r},${g},${b},${a})`;
        } else if (type === 3) {
            const len = blbBuf.readUInt16BE(o); o += 2;
            val = blbBuf.slice(o, o + len).toString('utf-8');
            o += len;
        } else if (type === 4) {
            val = blbBuf.readUInt16BE(o); o += 2;
        }
        console.log(`  Tag ${tag} = ${val}`);
        parsedProps++;
    }
}
