const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

const newBLBParser = `
        class BLBParser {
            constructor(buf, offset=0) {
                this.v = new DataView(buf);
                this.d = new TextDecoder('utf-8');
                this.o = offset;
            }
            parse() {
                const blocks = [];
                if (this.o + 4 > this.v.byteLength) return blocks;
                const numNodes = this.v.getUint32(this.o); this.o += 4;
                
                for (let i = 0; i < numNodes; i++) {
                    if (this.o + 2 > this.v.byteLength) break;
                    const nid = this.v.getUint16(this.o); this.o += 2;
                    if (this.o + 1 > this.v.byteLength) break;
                    const propCount = this.v.getUint8(this.o++);
                    
                    if (propCount === 0) continue;
                    
                    const props = {};
                    for (let p = 0; p < propCount; p++) {
                        if (this.o + 2 > this.v.byteLength) break;
                        const tag = this.v.getUint8(this.o++);
                        const type = this.v.getUint8(this.o++);
                        let val = null;
                        
                        if (type === 0) { // dimension
                            const unit = this.v.getUint8(this.o++);
                            const num = this.v.getInt32(this.o); this.o += 4;
                            const v = num / 100;
                            let uStr = 'px';
                            if (unit === 1) uStr = '%';
                            else if (unit === 2) uStr = 'em';
                            else if (unit === 3) uStr = 'vw'; // we just use vw for vw/vh right now or assume css handles it, wait it was vw/vh, let's use vw as generic or keep as is? wait, BlbCompiler uses 3 for vw/vh. Let's just output vw for now.
                            else if (unit === 4) { uStr = ''; val = 'auto'; }
                            if (val !== 'auto') val = v + uStr;
                        } else if (type === 1) { // enum/u8
                            val = this.v.getUint8(this.o++);
                        } else if (type === 2) { // color
                            const c32 = this.v.getUint32(this.o); this.o += 4;
                            const r = (c32 >>> 24) & 255;
                            const g = (c32 >>> 16) & 255;
                            const b = (c32 >>> 8) & 255;
                            const a = (c32 & 255) / 255;
                            val = \`rgba(\${r},\${g},\${b},\${a})\`;
                        } else if (type === 3) { // string
                            const len = this.v.getUint16(this.o); this.o += 2;
                            val = this.d.decode(new Uint8Array(this.v.buffer, this.v.byteOffset + this.o, len));
                            this.o += len;
                        } else if (type === 4) { // uint16
                            val = this.v.getUint16(this.o); this.o += 2;
                        }
                        
                        props[tag] = val;
                    }
                    blocks.push({ nid, props });
                }
                return blocks;
            }
        }
        
        async function applyBLB(elements, blocks) {
            const displayMapRev = {0:'none',1:'block',2:'flex',3:'inline',4:'inline-block',5:'grid'};
            const posMapRev = {0:'static',1:'relative',2:'absolute',3:'fixed',4:'sticky'};
            
            for (const b of blocks) {
                const el = elements[b.nid - 1]; // id is 1-indexed, elements are 0-indexed!
                if (!el) continue;
                
                const s = el.style;
                s.boxSizing = 'border-box';
                const p = b.props;
                
                if (p[1] !== undefined) s.width = p[1];
                if (p[2] !== undefined) s.height = p[2];
                if (p[5] !== undefined) s.display = displayMapRev[p[5]] || '';
                if (p[6] !== undefined) s.position = posMapRev[p[6]] || '';
                
                if (p[8] !== undefined) s.marginTop = p[8];
                if (p[9] !== undefined) s.marginRight = p[9];
                if (p[10] !== undefined) s.marginBottom = p[10];
                if (p[11] !== undefined) s.marginLeft = p[11];
                
                if (p[12] !== undefined) s.paddingTop = p[12];
                if (p[13] !== undefined) s.paddingRight = p[13];
                if (p[14] !== undefined) s.paddingBottom = p[14];
                if (p[15] !== undefined) s.paddingLeft = p[15];
                
                if (p[17] !== undefined) s.backgroundColor = p[17];
                if (p[18] !== undefined) s.color = p[18];
                if (p[36] !== undefined) { s.borderStyle = 'solid'; s.borderWidth = '1px'; s.borderColor = p[36]; }
                
                if (p[19] !== undefined) s.fontSize = p[19];
                if (p[35] !== undefined) s.borderRadius = p[35];
                if (p[21] !== undefined) s.fontFamily = p[21];
                if (p[22] !== undefined) s.fontWeight = p[22];
                
                if (p[38] !== undefined) { s.backdropFilter = 'blur(16px)'; s.webkitBackdropFilter = 'blur(16px)'; }
                if (p[39] !== undefined) s.filter = \`blur(\${p[39]}px)\`;
                
                if (p[46] !== undefined) s.left = p[46];
                if (p[47] !== undefined) s.top = p[47];
            }
        }
`;

let replaced = polyfillHtml.replace(/class BLBParser\{[\s\S]*?return blocks;\s*\}\s*\}/, "/* BLBParser REPLACED */");
replaced = replaced.replace(/async function applyBLB\(elements,blocks\)\{[\s\S]*?if\(b\.opacity!==0xFF\)s\.opacity=\(b\.opacity\/255\)\.toFixed\(2\);\s*\}/, "/* applyBLB REPLACED */");

// Inject new code
replaced = replaced.replace("/* BLBParser REPLACED */\n", newBLBParser);
replaced = replaced.replace("/* applyBLB REPLACED */", ""); // already injected with newBLBParser

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', replaced);
console.log('Rewrote BLB logic');
