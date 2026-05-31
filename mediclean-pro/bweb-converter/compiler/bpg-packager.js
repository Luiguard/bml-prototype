const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

class BpgPackager {
    constructor(logger) {
        this.logger = logger;
    }

    package(outputFile, sections) {
        // sections = { bml: Buffer, bdt: Buffer, blb: Buffer, bib: Buffer, bvs: Buffer, vfsManifest: object }
        const tocMap = { "index.html": { index: 0 } }; // Simplified TOC
        const tocBytes = Buffer.from("VFS\x01" + JSON.stringify(tocMap));

        // Compress Phase
        const bmlC = zlib.deflateSync(sections.bml);
        const bdtC = zlib.deflateSync(sections.bdt);
        const blbC = zlib.deflateSync(sections.blb);
        const bib = sections.bib || Buffer.alloc(0);
        const bvs = sections.bvs || Buffer.alloc(0);

        const activeSections = [
            { id: 9, buf: tocBytes, compressed: 0 },
            { id: 1, buf: bmlC, compressed: 1 },
            { id: 2, buf: bdtC, compressed: 1 },
            { id: 3, buf: blbC, compressed: 1 }
        ];
        if (bib.length > 0) activeSections.push({ id: 4, buf: bib, compressed: 0 });
        if (bvs.length > 0) activeSections.push({ id: 5, buf: bvs, compressed: 0 });

        const numSections = activeSections.length;
        const bwebHeader = Buffer.alloc(8 + 8 * numSections);
        bwebHeader.writeUInt32BE(0x42574542, 0); // BWEB
        bwebHeader.writeUInt32BE(numSections, 4);

        let headerOffset = 8;
        for (const sec of activeSections) {
            bwebHeader.writeUInt8(sec.id, headerOffset);
            bwebHeader.writeUInt32BE(sec.buf.length, headerOffset + 1);
            bwebHeader.writeUInt8(sec.compressed, headerOffset + 5);
            bwebHeader.writeUInt16BE(0, headerOffset + 6); // Padding
            headerOffset += 8;
        }

        const outStream = fs.createWriteStream(outputFile);
        outStream.write(bwebHeader);
        for (const sec of activeSections) {
            outStream.write(sec.buf);
        }
        outStream.end();

        // Calculate Hash and ECDSA
        const hashSum = crypto.createHash('sha256');
        hashSum.update(bwebHeader);
        for (const sec of activeSections) {
            hashSum.update(sec.buf);
        }
        const bwebHash = hashSum.digest();

        const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const sign = crypto.createSign('SHA256');
        sign.update(bwebHash);
        const signature = sign.sign(privateKey);

        const manifest = {
            version: Date.now().toString(),
            hash: bwebHash.toString('hex'),
            signature: signature.toString('base64'),
            public_key: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
            compilation_id: this.logger ? this.logger.compilationId : 'unknown',
            feature_flags: { 'bwebc_core_1_0': true }
        };

        const manifestPath = path.join(path.dirname(outputFile), 'manifest.bpg');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        console.log(`[Packager] BWEB written to ${outputFile}`);
        console.log(`[Packager] manifest.bpg signed and written.`);
        
        return bwebHash.toString('hex');
    }
}

module.exports = { BpgPackager };
