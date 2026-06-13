const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

// Find start of old Asset Parsers (right after applyBLB, or before renderBinary)
const startIdx = polyfillHtml.indexOf('class BIBParser');
const endIdx = polyfillHtml.indexOf('// Native Render Binary Pipeline');

if (startIdx > -1 && endIdx > -1) {
    const before = polyfillHtml.substring(0, startIdx);
    const after = polyfillHtml.substring(endIdx);
    
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
    
    polyfillHtml = before + newAssetParsers + "\n        " + after;
    fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
    console.log('Successfully replaced asset parsers');
} else {
    console.log('Could not find boundaries!');
}
