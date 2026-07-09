const zlib = require('zlib');
const fs = require('fs');

async function test() {
    const rawData = Buffer.from("Hello world, this is a test of zlib deflate sync!");
    const compressed = zlib.deflateSync(rawData);
    
    console.log("Compressed length:", compressed.length);
    
    try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(new Uint8Array(compressed));
        writer.close();
        
        const reader = ds.readable.getReader();
        const chunks = [];
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        console.log("Decompressed successfully! Length:", Buffer.concat(chunks).length);
    } catch(e) {
        console.error("DecompressionStream error:", e);
    }
}
test();
