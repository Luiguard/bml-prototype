const fs = require('fs');
const zlib = require('zlib');

const bweb = fs.readFileSync('/home/benjamin/projects/mediclean-pro/service.bweb');
let headerOffset = 8;
const numSections = bweb.readUInt32BE(4);
for (let i = 0; i < numSections; i++) {
    const type = bweb.readUInt8(headerOffset);
    const len = bweb.readUInt32BE(headerOffset + 1);
    const compressed = bweb.readUInt8(headerOffset + 5);
    
    if (type === 3) {
        let chunk = bweb.slice(headerOffset + 8, headerOffset + 8 + len);
        if (compressed === 1) {
            chunk = zlib.inflateSync(chunk);
        }
        console.log(`BLB Section found, uncompressed size: ${chunk.length}`);
        
        let o = 0;
        const numNodes = chunk.readUInt32BE(o); o += 4;
        console.log(`Num nodes in BLB: ${numNodes}`);
        
        let blockCount = 0;
        let lastProps = {};
        for (let j = 0; j < numNodes; j++) {
            if (o + 2 > chunk.length) break;
            const nid = chunk.readUInt16BE(o); o += 2;
            const propCount = chunk.readUInt8(o++);
            
            if (propCount === 0) continue;
            blockCount++;
            
            const props = {};
            for (let p = 0; p < propCount; p++) {
                const tag = chunk.readUInt8(o++);
                const t = chunk.readUInt8(o++);
                let val = null;
                if (t === 0) { o += 5; val = "dim"; }
                else if (t === 1) { o += 1; val = "enum"; }
                else if (t === 2) { o += 4; val = "color"; }
                else if (t === 3) { const l = chunk.readUInt16BE(o); o += 2 + l; val = "string"; }
                else if (t === 4) { o += 2; val = "uint16"; }
                props[tag] = val;
            }
            lastProps = props;
        }
        console.log(`Valid BLB blocks parsed: ${blockCount}, last props:`, lastProps);
    }
    
    headerOffset += 8 + len;
}
