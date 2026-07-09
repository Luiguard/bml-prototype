const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const args = process.argv.slice(2);
if (args[0] !== 'pack' || !args[1] || !args[2]) {
    console.error("Usage: node bweb-pack.js pack <input.bweb> <output.bpg>");
    process.exit(1);
}

const inputPath = path.resolve(args[1]);
const outputFile = path.resolve(args[2]);

// 1. Read Payload
const payload = fs.readFileSync(inputPath);

// 2. Generate Key Pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1'
});
const pubKeyBytes = publicKey.export({ type: 'spki', format: 'der' });

// 3. Hash Payload (Integrity Check)
const hash = crypto.createHash('sha256');
hash.update(payload);
const integrityHash = hash.digest();

// 4. Sign Hash (Handshake Token)
const sign = crypto.createSign('SHA256');
sign.update(payload);
const signature = sign.sign(privateKey);

// 5. Build BPG V1.1 Container
const headerBuf = Buffer.alloc(50);
headerBuf.write('BPG1', 0);
headerBuf.writeUInt8(1, 4); // Major
headerBuf.writeUInt8(0, 5); // Minor
headerBuf.writeUInt16BE(0, 6); // Flags
headerBuf.writeUInt32BE(payload.length, 8); // Payload Length
headerBuf.writeUInt32BE(0, 12); // Index Offset
integrityHash.copy(headerBuf, 16); // Integrity Check (32 bytes)
headerBuf.writeUInt16BE(pubKeyBytes.length, 48); // Identity Length

const tokenHeaderBuf = Buffer.alloc(2);
tokenHeaderBuf.writeUInt16BE(signature.length, 0);

const bpgFile = Buffer.concat([
    headerBuf,
    pubKeyBytes,
    tokenHeaderBuf,
    signature,
    payload
]);

fs.writeFileSync(outputFile, bpgFile);

console.log(`[BPG Packager] Packed ${args[1]} into ${args[2]}`);
console.log(`[BPG Packager] Integrity Check: ${integrityHash.toString('hex')}`);
console.log(`[BPG Packager] Handshake Identity Length: ${pubKeyBytes.length} bytes`);
console.log(`[BPG Packager] Handshake Token Length: ${signature.length} bytes`);
console.log(`[BPG Packager] Handshake ready.`);
