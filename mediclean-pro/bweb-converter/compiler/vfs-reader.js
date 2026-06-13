const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class VFSReader {
    constructor(inputDir, logger) {
        this.inputDir = path.resolve(inputDir);
        this.logger = logger;
        this.manifest = { files: {} };
        this.vfsCounter = 0;
        this.bibCounter = 0;
    }

    scan() {
        console.log(`[VFS] Scanning directory: ${this.inputDir}`);
        const files = this._walkDir(this.inputDir);
        
        // Deterministische Sortierung!
        files.sort();

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const relPath = path.relative(this.inputDir, file).replace(/\\/g, '/');
            const hash = this._hashFile(file);

            let vfsId;
            let type;
            if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
                vfsId = `bib_${String(this.bibCounter++).padStart(3, '0')}`;
                type = 'image';
            } else if (['.mp4', '.webm'].includes(ext)) {
                vfsId = `bvs_${String(this.bibCounter++).padStart(3, '0')}`;
                type = 'video';
            } else if (['.html', '.htm'].includes(ext)) {
                vfsId = `vfs_${String(this.vfsCounter++).padStart(3, '0')}`;
                type = 'html';
            } else if (['.css'].includes(ext)) {
                vfsId = `vfs_${String(this.vfsCounter++).padStart(3, '0')}`;
                type = 'css';
            } else if (['.js'].includes(ext)) {
                vfsId = `vfs_${String(this.vfsCounter++).padStart(3, '0')}`;
                type = 'js';
            } else {
                continue; // Ignore unknown types
            }

            this.manifest.files[relPath] = {
                id: vfsId,
                type: type,
                hash: hash,
                absolutePath: file
            };

            if (this.logger) {
                this.logger.logMapRoute(vfsId, relPath, hash);
            }
        }

        const manifestPath = path.join(this.inputDir, '.bweb-input.json');
        fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
        console.log(`[VFS] Manifest written to ${manifestPath}`);
        return this.manifest;
    }

    _walkDir(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            // Exclusions
            if (['node_modules', '.git', 'showcase'].includes(file) || file.endsWith('.bweb') || file.endsWith('.bpg') || file === '.bweb-input.json') {
                continue;
            }
            const absPath = path.join(dir, file);
            if (fs.statSync(absPath).isDirectory()) {
                this._walkDir(absPath, fileList);
            } else {
                fileList.push(absPath);
            }
        }
        return fileList;
    }

    _hashFile(filePath) {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }
}

module.exports = { VFSReader };
