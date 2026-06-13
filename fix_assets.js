const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

const newAssetParsers = `
        class BIBParser {
            constructor(buf, offset=0) {
                this.v = new DataView(buf);
                this.u8 = new Uint8Array(buf);
                this.o = offset;
            }
            parse() {
                const assets = {};
                let o = this.o;
                while (o < this.v.byteLength) {
                    if (o + 8 > this.v.byteLength) break;
                    const id = this.v.getUint16(o); o += 2;
                    const format = this.v.getUint8(o++);
                    const compress = this.v.getUint8(o++);
                    const len = this.v.getUint32(o); o += 4;
                    if (o + len > this.v.byteLength) break;
                    
                    const data = this.u8.slice(o, o + len);
                    o += len;
                    
                    assets[id] = data;
                }
                return assets;
            }
        }
        
        async function applyBIB(rootEl, images) {
            const imgs = rootEl.querySelectorAll('img[src^="bib://"]');
            for (const img of imgs) {
                const src = img.getAttribute('src');
                const id = parseInt(src.replace('bib://', ''), 10);
                const data = images[id];
                if (data) {
                    let mime = 'application/octet-stream';
                    if (data[0]===0x89 && data[1]===0x50 && data[2]===0x4E && data[3]===0x47) mime = 'image/png';
                    else if (data[0]===0xFF && data[1]===0xD8 && data[2]===0xFF) mime = 'image/jpeg';
                    else if (data[0]===0x47 && data[1]===0x49 && data[2]===0x46) mime = 'image/gif';
                    else if (data[0]===0x3C && data[1]===0x73 && data[2]===0x76 && data[3]===0x67) mime = 'image/svg+xml';
                    
                    const blob = new Blob([data], { type: mime });
                    img.src = URL.createObjectURL(blob);
                }
            }
        }

        class BVSParser {
            constructor(buf, offset=0) {
                this.v = new DataView(buf);
                this.u8 = new Uint8Array(buf);
                this.o = offset;
            }
            parse() {
                const assets = {};
                let o = this.o;
                while (o < this.v.byteLength) {
                    if (o + 8 > this.v.byteLength) break;
                    const id = this.v.getUint16(o); o += 2;
                    const format = this.v.getUint8(o++);
                    const compress = this.v.getUint8(o++);
                    const len = this.v.getUint32(o); o += 4;
                    if (o + len > this.v.byteLength) break;
                    
                    const data = this.u8.slice(o, o + len);
                    o += len;
                    
                    assets[id] = data;
                }
                return assets;
            }
        }
        
        async function applyBVS(rootEl, videos) {
            const vids = rootEl.querySelectorAll('video[src^="bvs://"], source[src^="bvs://"]');
            for (const v of vids) {
                const src = v.getAttribute('src');
                const id = parseInt(src.replace('bvs://', ''), 10);
                const data = videos[id];
                if (data) {
                    let mime = 'video/mp4';
                    const blob = new Blob([data], { type: mime });
                    v.src = URL.createObjectURL(blob);
                    
                    if (v.tagName.toLowerCase() === 'source' && v.parentElement && v.parentElement.tagName.toLowerCase() === 'video') {
                        v.parentElement.load();
                    }
                }
            }
        }

        class BASParser {
            constructor(buf, offset=0) {
                this.v = new DataView(buf);
                this.u8 = new Uint8Array(buf);
                this.o = offset;
            }
            parse() {
                const assets = {};
                let o = this.o;
                while (o < this.v.byteLength) {
                    if (o + 8 > this.v.byteLength) break;
                    const id = this.v.getUint16(o); o += 2;
                    const format = this.v.getUint8(o++);
                    const compress = this.v.getUint8(o++);
                    const len = this.v.getUint32(o); o += 4;
                    if (o + len > this.v.byteLength) break;
                    
                    const data = this.u8.slice(o, o + len);
                    o += len;
                    
                    assets[id] = data;
                }
                return assets;
            }
        }
        
        async function applyBAS(rootEl, audios) {
            const auds = rootEl.querySelectorAll('audio[src^="bas://"], source[src^="bas://"]');
            for (const a of auds) {
                const src = a.getAttribute('src');
                const id = parseInt(src.replace('bas://', ''), 10);
                const data = audios[id];
                if (data) {
                    let mime = 'audio/mpeg';
                    const blob = new Blob([data], { type: mime });
                    a.src = URL.createObjectURL(blob);
                    
                    if (a.tagName.toLowerCase() === 'source' && a.parentElement && a.parentElement.tagName.toLowerCase() === 'audio') {
                        a.parentElement.load();
                    }
                }
            }
        }
`;

// Replace all three asset parsers
let replaced = polyfillHtml;

// Replace BIBParser block
replaced = replaced.replace(/class BIBParser\{[\s\S]*?\}\s*\}\s*async function applyBIB[\s\S]*?\}\s*\}/, "/* BIB/BVS REPLACED */");

// Replace BVSParser block
replaced = replaced.replace(/class BVSParser\{[\s\S]*?\}\s*\}\s*async function applyBVS[\s\S]*?playbackLoop\(\);\s*\}/, "");

// Replace BASParser block
replaced = replaced.replace(/class BASParser\{[\s\S]*?\}\s*\}\s*async function applyBAS[\s\S]*?playAudio\(0\);\s*\}\s*\}/, "");

replaced = replaced.replace("/* BIB/BVS REPLACED */", newAssetParsers);

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', replaced);
console.log('Rewrote asset logic');
