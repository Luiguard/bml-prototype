const fs = require('fs');
const { Buffer } = require('buffer');

class AssetCompiler {
    constructor(logger) {
        this.logger = logger;
    }

    compile(vfsManifest) {
        const bibBufs = [];
        let bibCount = 0;
        const bvsBufs = [];
        let bvsCount = 0;

        for (const [relPath, entry] of Object.entries(vfsManifest.files)) {
            if (entry.id.startsWith('bib_')) {
                const numericId = parseInt(entry.id.replace('bib_', ''), 10);
                const fileBytes = fs.readFileSync(entry.absolutePath);
                
                // Asset Header: ID(2), Format(1), Compress(1), Length(4)
                const header = Buffer.alloc(8);
                header.writeUInt16BE(numericId, 0);
                header.writeUInt8(0, 2); // 0 = Format Original Raw
                header.writeUInt8(0, 3); // 0 = Uncompressed
                header.writeUInt32BE(fileBytes.length, 4);

                bibBufs.push(header, fileBytes);
                bibCount++;
            } else if (entry.id.startsWith('bvs_')) {
                const numericId = parseInt(entry.id.replace('bvs_', ''), 10);
                const fileBytes = fs.readFileSync(entry.absolutePath);
                
                const header = Buffer.alloc(8);
                header.writeUInt16BE(numericId, 0);
                header.writeUInt8(0, 2); // 0 = Format Original Raw
                header.writeUInt8(0, 3); // 0 = Uncompressed
                header.writeUInt32BE(fileBytes.length, 4);

                bvsBufs.push(header, fileBytes);
                bvsCount++;
            }
        }

        const bibBuffer = Buffer.concat(bibBufs);
        const bvsBuffer = Buffer.concat(bvsBufs);

        if (this.logger && bibCount > 0) this.logger.logEmitBlock('BIB', bibBuffer.length, bibCount);
        if (this.logger && bvsCount > 0) this.logger.logEmitBlock('BVS', bvsBuffer.length, bvsCount);

        return { bibBuffer, bvsBuffer, bibCount, bvsCount };
    }
}

module.exports = { AssetCompiler };
