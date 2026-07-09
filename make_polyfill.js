const fs = require('fs');

const polyfillHtml = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BWEB Polyfill Engine</title>
</head>
<body style="margin:0; padding:0; background: transparent;">
    <div id="renderTarget"></div>
    <script>
    (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const fileParam = urlParams.get('file');
        if (!fileParam || !/^[a-zA-Z0-9_\\-\\/\.]+\\.(bweb|bml|bdt|blb|bib)$/.test(fileParam) || fileParam.includes('..')) {
            document.getElementById('renderTarget').innerHTML = '<div style="padding:2rem;text-align:center">Ungültige BWEB-Datei angegeben.</div>';
            return;
        }

        const url = window.location.href;
        const ext = fileParam.split('.').pop();

        try {
            const fetchUrl = \`\${window.location.protocol}//\${window.location.host}/\${fileParam}\${fileParam.includes('?') ? '&' : '?'}raw=true\`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(\`HTTP Fehler \${response.status}\`);
            const buffer = await response.arrayBuffer();

        const DANGEROUS_TAGS = new Set(['script','iframe','object','embed','applet','meta','link','base']);
        const DANGEROUS_ATTRS = new Set(['onclick','onsubmit','onload','onerror','onmouseover','onfocus','onblur','onchange','oninput','onkeydown','onkeyup','onkeypress','formaction','xlink:href','srcdoc','data']);
        const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'div',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFD:'#text',0xFE:'div',0xFF:'div'};
        const ATTR_REV={0x10:'class',0x11:'id',0x12:'href',0x13:'src',0x14:'style',0x15:'type',0x16:'name',0x17:'value',0x18:'placeholder',0x19:'alt',0x1A:'title',0x1B:'action',0x1C:'method',0x1D:'target',0x1E:'rel',0x1F:'role',0x20:'aria-label',0x21:'data-bind',0x22:'data-onclick',0x23:'data-onsubmit',0x24:'width',0x25:'height',0x26:'disabled',0x27:'checked',0x28:'selected',0x29:'required',0x2A:'autofocus',0x2B:'autocomplete',0x2C:'min',0x2D:'max',0x2E:'step',0x2F:'pattern',0x30:'for',0x31:'tabindex',0x32:'content',0x33:'charset',0x34:'http-equiv',0x35:'lang',0x36:'dir',0x37:'hidden'};

        async function parseBWEBAsync(buf) {
            const dv = new DataView(buf);
            if (buf.byteLength < 8) throw new Error('BWEB: Container zu klein');
            const magic = dv.getUint32(0);
            if (magic !== 0x42574542) throw new Error('Ungültiges BWEB Magic');
            
            const numSections = dv.getUint32(4);
            let headerOffset = 8;
            let dataOffset = 8 + numSections * 8;
            
            const sections = {};
            for (let i = 0; i < numSections; i++) {
                const type = dv.getUint8(headerOffset);
                const len = dv.getUint32(headerOffset + 1);
                const compressed = dv.getUint8(headerOffset + 5);
                headerOffset += 8;
                
                let chunk = buf.slice(dataOffset, dataOffset + len);
                dataOffset += len;
                
                if (compressed === 1) {
                    const ds = new DecompressionStream('deflate');
                    const writer = ds.writable.getWriter();
                    writer.write(new Uint8Array(chunk));
                    writer.close();
                    
                    const decompressedChunks = [];
                    const reader = ds.readable.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        decompressedChunks.push(value);
                    }
                    
                    let totalLen = 0;
                    for (const c of decompressedChunks) totalLen += c.length;
                    const res = new Uint8Array(totalLen);
                    let offset = 0;
                    for (const c of decompressedChunks) {
                        res.set(c, offset);
                        offset += c.length;
                    }
                    chunk = res.buffer;
                }
                
                sections[type] = chunk;
            }
            return sections;
        }

        class BMLParser {
            constructor(buf, offset=0) {
                this.v = new DataView(buf);
                this.d = new TextDecoder('utf-8');
                this.o = offset;
                this.nodes = [];
            }
            parse() {
                let nodeId = 0;
                while (this.o < this.v.byteLength) {
                    const tagByte = this.v.getUint8(this.o++);
                    const nAttr = this.v.getUint8(this.o++);
                    
                    if (tagByte === 0xFF) {
                        this.o--; 
                        const tLen = this.v.getUint16(this.o); this.o += 2;
                        const txt = tLen > 0 ? this.d.decode(new Uint8Array(this.v.buffer, this.v.byteOffset + this.o, tLen)) : '';
                        this.o += tLen;
                        
                        const textNode = document.createTextNode(txt);
                        this.nodes.push(textNode);
                        nodeId++;
                        continue;
                    }
                    
                    const tagName = TAG_REV[tagByte] || 'div';
                    const el = document.createElement(tagName);
                    el.classList.add('rendered-node', \`bml-tag-\${tagName}\`);
                    el.setAttribute('data-node-id', nodeId);
                    
                    for (let i = 0; i < nAttr; i++) {
                        if (this.o + 3 > this.v.byteLength) break;
                        const aId = this.v.getUint8(this.o++);
                        const aLen = this.v.getUint16(this.o); this.o += 2;
                        if (this.o + aLen > this.v.byteLength) break;
                        const aVal = this.d.decode(new Uint8Array(this.v.buffer, this.v.byteOffset + this.o, aLen)); this.o += aLen;
                        
                        const aName = ATTR_REV[aId];
                        if (!aName || aName === 'style' || DANGEROUS_ATTRS.has(aName)) continue;
                        if (aName === 'class') {
                            el.className = \`rendered-node bml-tag-\${tagName} \${aVal}\`;
                        } else {
                            try { el.setAttribute(aName, aVal); } catch(e){}
                        }
                    }
                    this.nodes.push(el);
                    nodeId++;
                }
                return this.nodes;
            }
        }
        
        function applyBDTTopology(bmlNodes, bdtBuf, bdtStart) {
            const v = new DataView(bdtBuf);
            let o = bdtStart;
            const numNodes = bmlNodes.length;
            let rootEl = null;
            
            for (let i = 0; i < numNodes; i++) {
                if (o + 15 > v.byteLength) break;
                const id = v.getUint32(o); o += 4;
                const parentId = v.getUint16(o); o += 2;
                const nextSibling = v.getUint16(o); o += 2;
                const lastChild = v.getUint16(o); o += 2;
                const prevSibling = v.getUint16(o); o += 2;
                const nodeType = v.getUint8(o++);
                const tagByte = v.getUint8(o++);
                const depth = v.getUint8(o++);
                
                const el = bmlNodes[id - 1];
                if (!el) continue;
                
                if (parentId === 0xFFFF) {
                    if (!rootEl) rootEl = el;
                } else {
                    const parentEl = bmlNodes[parentId - 1];
                    if (parentEl) {
                        parentEl.appendChild(el);
                    }
                }
            }
            return rootEl;
        }

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
                        
                        if (type === 0) { 
                            const unit = this.v.getUint8(this.o++);
                            const num = this.v.getInt32(this.o); this.o += 4;
                            const v = num / 100;
                            let uStr = 'px';
                            if (unit === 1) uStr = '%';
                            else if (unit === 2) uStr = 'em';
                            else if (unit === 3) uStr = 'vw'; 
                            else if (unit === 4) { uStr = ''; val = 'auto'; }
                            if (val !== 'auto') val = v + uStr;
                        } else if (type === 1) { 
                            val = this.v.getUint8(this.o++);
                        } else if (type === 2) { 
                            const c32 = this.v.getUint32(this.o); this.o += 4;
                            const r = (c32 >>> 24) & 255;
                            const g = (c32 >>> 16) & 255;
                            const b = (c32 >>> 8) & 255;
                            const a = (c32 & 255) / 255;
                            val = \`rgba(\${r},\${g},\${b},\${a})\`;
                        } else if (type === 3) { 
                            const len = this.v.getUint16(this.o); this.o += 2;
                            val = this.d.decode(new Uint8Array(this.v.buffer, this.v.byteOffset + this.o, len));
                            this.o += len;
                        } else if (type === 4) { 
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
                const el = elements[b.nid - 1];
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

        class AssetParser {
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

        async function renderBinary(buf){
            const sections = await parseBWEBAsync(buf);
            const bmlBuf=sections[1];
            const bdtBuf=sections[2];
            const blbBuf=sections[3];

            let rootEl=null;

            if(bmlBuf){
                const bmlView=new Uint8Array(bmlBuf);
                let bmlStart=0;
                if(bmlView[0]===0x42&&bmlView[1]===0x4D&&bmlView[2]===0x4C)bmlStart=4;
                const parser=new BMLParser(bmlBuf,bmlStart); 
                const bmlNodes = parser.parse(); 
                window.__bmlNodes = bmlNodes;
            }

            if(bdtBuf){
                const bdtView=new Uint8Array(bdtBuf);
                let bdtStart=0;
                if(bdtView[0]===0x42&&bdtView[1]===0x44&&bdtView[2]===0x54)bdtStart=4;
                rootEl = applyBDTTopology(window.__bmlNodes, bdtBuf, bdtStart); 
                const elements = {}; 
                for(let i=0; i<window.__bmlNodes.length; i++) { 
                    if (window.__bmlNodes[i].nodeType === 1) elements[i] = window.__bmlNodes[i]; 
                }

                if(blbBuf){
                    const blbView=new Uint8Array(blbBuf);
                    let blbStart=0;
                    if(blbView[0]===0x42&&blbView[1]===0x4C&&blbView[2]===0x42)blbStart=4;
                    const blbBlocks=new BLBParser(blbBuf,blbStart).parse();
                    await applyBLB(elements,blbBlocks);
                }
            }

            if(rootEl&&sections[4]){
                const bibBuf=sections[4];
                const bibView=new Uint8Array(bibBuf);
                let bibStart=0;
                if(bibView[0]===0x42&&bibView[1]===0x49&&bibView[2]===0x42)bibStart=4;
                const imgs=new AssetParser(bibBuf,bibStart).parse();
                await applyBIB(rootEl,imgs);
            }

            if(rootEl&&sections[5]){
                const bvsBuf=sections[5];
                const bvsView=new Uint8Array(bvsBuf);
                let bvsStart=0;
                if(bvsView[0]===0x42&&bvsView[1]===0x56&&bvsView[2]===0x53)bvsStart=4;
                const videos=new AssetParser(bvsBuf,bvsStart).parse();
                await applyBVS(rootEl,videos);
            }

            if(rootEl&&sections[6]){
                const basBuf=sections[6];
                const basView=new Uint8Array(basBuf);
                let basStart=0;
                if(basView[0]===0x42&&basView[1]===0x41&&basView[2]===0x53)basStart=4;
                const audios=new AssetParser(basBuf,basStart).parse();
                await applyBAS(rootEl,audios);
            }

            const target=document.getElementById('renderTarget');
            target.innerHTML='';
            if(rootEl){ 
                target.appendChild(rootEl); 
            }
        }

        await renderBinary(buffer);

        } catch(e) {
            console.error("BWEB Polyfill Engine Error:", e);
            const target=document.getElementById('renderTarget');
            target.innerHTML='';
            const errBox=document.createElement('div');
            errBox.setAttribute('style','padding: 2rem; max-width: 600px; margin: 40px auto; background: #1e1b4b; border: 1px solid #312e81; border-radius: 8px; text-align: center;');
            const h=document.createElement('h2');h.setAttribute('style','color: #ef4444; margin-top: 0;');h.textContent='BWEB Polyfill Ladefehler';errBox.appendChild(h);
            const p1=document.createElement('p');p1.setAttribute('style','color: #cbd5e1; line-height: 1.6;');p1.textContent='Die JS-Polyfill-Engine konnte die Binärdatei nicht laden oder decodieren.';errBox.appendChild(p1);
            const p2=document.createElement('p');p2.setAttribute('style','color: #94a3b8; font-size: 0.85rem;');p2.textContent='Details: '+(e instanceof Error?e.message:'Unbekannter Fehler');errBox.appendChild(p2);
            target.appendChild(errBox);
        }
    })();
    </script>
</body>
</html>`;

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Successfully wrote clean polyfill.html');
