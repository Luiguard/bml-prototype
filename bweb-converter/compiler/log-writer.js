const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LogWriter {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.compilationId = crypto.randomUUID();
        this.logFile = path.join(outputDir, `bweb-compile-${this.compilationId}.log`);
        // Start log file
        fs.writeFileSync(this.logFile, `{"event":"COMPILATION_START","compilation_id":"${this.compilationId}","timestamp":"${new Date().toISOString()}"}\n`);
    }

    _write(type, data) {
        const entry = {
            event: type,
            timestamp: new Date().toISOString(),
            ...data
        };
        fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    }

    logMapRoute(vfsId, originalPath, hash) {
        this._write('MAP_ROUTE', { vfs_id: vfsId, source_path: originalPath, hash });
    }

    logEmitBlock(section, lengthBytes, nodeCount = 0) {
        this._write('EMIT_BLOCK', { section, length_bytes: lengthBytes, node_count: nodeCount });
    }

    logMissingRef(refType, sourcePath) {
        this._write('MISSING_REF', { ref_type: refType, source_path: sourcePath });
    }
    
    logDone(finalHash) {
        this._write('COMPILATION_END', { hash: finalHash });
        console.log(`[LogWriter] Compilation log written to ${this.logFile}`);
    }
}

module.exports = { LogWriter };
