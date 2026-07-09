const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node build-bweb.js <path-to-folder> [output-file]');
    process.exit(1);
}

const inputDir = path.resolve(args[0]);
if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    console.error(`Error: ${inputDir} is not a valid directory.`);
    process.exit(1);
}

const outputFile = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), 'website.bweb');

// Find all HTML files to know what to compile
function getHtmlFiles(dir, base = '') {
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.posix.join(base, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(getHtmlFiles(fullPath, relPath));
        } else if (file.endsWith('.html')) {
            results.push(relPath);
        }
    }
    return results;
}

const htmlFiles = getHtmlFiles(inputDir);
if (htmlFiles.length === 0) {
    console.error(`Error: No .html files found in ${inputDir}`);
    process.exit(1);
}

console.log(`[INFO] Found ${htmlFiles.length} HTML pages to process.`);

const app = express();
app.use(express.static(inputDir));

const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`[INFO] Local server running on http://localhost:${port}`);

    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        await page.setViewport({ width: 1920, height: 1080 });
        
        console.log(`[INFO] Processing ${htmlFiles[0]} (Desktop)...`);
        await page.goto(`http://localhost:${port}/${htmlFiles[0]}`, { waitUntil: 'networkidle0' });
        
        // Wait an extra 500ms to ensure all custom JS has finished rendering and fonts are fully applied
        await new Promise(r => setTimeout(r, 500));

        console.log('[INFO] Injecting Serializer...');
        
        const bwebData = await page.evaluate(async () => {
            const enc = new TextEncoder();
            
            function colorToU32(c) {
                const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (!m) return 0;
                const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255;
                return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
            }

            const DM={'block':0,'inline':1,'flex':2,'grid':3,'none':4,'inline-block':5,'inline-flex':6,'list-item':7,'table':8,'table-row':9,'table-cell':10,'inline-grid':11};
            const PM_={'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4};
            const TAM={'left':0,'center':1,'right':2,'justify':3,'start':0,'end':2};
            const FDM={'row':0,'column':1,'row-reverse':2,'column-reverse':3};
            const FWM={'nowrap':0,'wrap':1,'wrap-reverse':2};
            const JCM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5,'normal':0};
            const AIM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'stretch':3,'baseline':4,'normal':3};

            const TAG_FWD = {'div':1,'p':2,'span':3,'a':4,'button':5,'img':6,'input':7,'form':8,'ul':9,'li':10,'h1':11,'h2':12,'h3':13,'h4':14,'h5':15,'h6':16,'canvas':17,'svg':18,'header':19,'footer':20,'section':21,'nav':22,'main':23,'aside':24,'article':25,'figure':26,'figcaption':27,'table':28,'thead':29,'tbody':30,'tr':31,'td':32,'th':33};
            const ATTR_FWD = {'id':1,'class':2,'href':3,'src':4,'alt':5,'type':6,'value':7,'name':8,'placeholder':9,'disabled':10,'checked':11,'required':12,'readonly':13,'maxlength':14,'minlength':15,'min':16,'max':17,'step':18,'pattern':19,'title':20,'target':21,'rel':22,'style':23,'role':24,'aria-label':25,'aria-hidden':26};
            const SKIP_TAGS = new Set(['script','style','noscript','template','iframe','object','embed','applet','link','meta','base','head','source','track','slot']);

            const globalImages = new Map();
            const fontsExtracted = [];

            // Wrap bare text nodes in spans so they get their own BLB entries with accurate absolute positions
            const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            const textNodesToWrap = [];
            while(tw.nextNode()) textNodesToWrap.push(tw.currentNode);
            for(const tn of textNodesToWrap) {
                if(tn.textContent.trim() && tn.parentNode) {
                    const wrapper = document.createElement('span');
                    wrapper.style.cssText = 'display:inline;margin:0;padding:0;border:0;';
                    tn.parentNode.insertBefore(wrapper, tn);
                    wrapper.appendChild(tn);
                }
            }

            // Materialize pseudo-elements
            const allEls = document.body.querySelectorAll('*');
            for (const el of allEls) {
                for (const pseudo of ['::before', '::after']) {
                    const ps = window.getComputedStyle(el, pseudo);
                    const content = ps.content;
                    if (!content || content === 'none' || content === 'normal') continue;
                    const pNode = document.createElement('span');
                    pNode.setAttribute('data-pseudo', pseudo);
                    pNode.style.cssText = `display:${ps.display};position:${ps.position};width:${ps.width};height:${ps.height};background-color:${ps.backgroundColor};background-image:${ps.backgroundImage};color:${ps.color};font-size:${ps.fontSize};font-weight:${ps.fontWeight};font-family:${ps.fontFamily};top:${ps.top};left:${ps.left};right:${ps.right};bottom:${ps.bottom};border-radius:${ps.borderRadius};opacity:${ps.opacity};z-index:${ps.zIndex};overflow:hidden;pointer-events:none;`;
                    const textContent = content.replace(/^["']|["']$/g, '');
                    if (textContent && textContent !== '""' && textContent !== "''") {
                        pNode.textContent = textContent;
                    }
                    if (pseudo === '::before') el.insertBefore(pNode, el.firstChild);
                    else el.appendChild(pNode);
                }
            }
            
            // Extract Images and Videos from document
            for (const el of document.querySelectorAll('img, video')) {
                const src = el.src || el.currentSrc;
                if (src && !src.startsWith('bib://') && !src.startsWith('bvs://')) {
                    if (!globalImages.has(src)) {
                        globalImages.set(src, { id: globalImages.size + 1, url: src, isVideo: el.tagName.toLowerCase() === 'video' });
                    }
                }
            }

            const bmlBuf = [];
            const flatNodes = [];

            function serNode(el, parentIdx) {
                if (el.nodeType === 3) {
                    const t = el.textContent.trim();
                    if (!t) return;
                    const textBytes = enc.encode(t + " ");
                    bmlBuf.push(0xFD, 0, 0, 0);
                    bmlBuf.push((textBytes.length >> 8) & 0xFF, textBytes.length & 0xFF);
                    for (const b of textBytes) bmlBuf.push(b);
                    return;
                }
                if (el.nodeType !== 1) return;
                let tag = el.tagName ? el.tagName.toLowerCase() : 'div';
                if (SKIP_TAGS.has(tag)) return;
                if (tag === 'img' || tag === 'video') tag = 'canvas'; // Rendered externally via Canvas
                
                const myIdx = flatNodes.length;
                flatNodes.push({ node: el, tag: TAG_FWD[tag] || 255, parentIdx, children: [], id: myIdx });
                if (parentIdx >= 0) flatNodes[parentIdx].children.push(myIdx);
                
                const attrs = [];
                for (const a of el.attributes) {
                    const elTag = el.tagName ? el.tagName.toLowerCase() : '';
                    if ((elTag === 'img' || elTag === 'video') && a.name === 'src') {
                        const fullSrc = el.src || el.currentSrc;
                        if(globalImages.has(fullSrc)) {
                            const asset = globalImages.get(fullSrc);
                            const prefix = asset.isVideo ? 'bvs://' : 'bib://';
                            attrs.push({id: ATTR_FWD['src'] || 4, val: enc.encode(`${prefix}${asset.id}`)});
                        }
                        continue;
                    }
                    const n = a.name.toLowerCase();
                    if (ATTR_FWD[n]) {
                        attrs.push({ id: ATTR_FWD[n], val: enc.encode(a.value) });
                    } else if (n.startsWith('data-')) {
                        attrs.push({ id: 254, name: enc.encode(n), val: enc.encode(a.value) });
                    }
                }
                
                bmlBuf.push(flatNodes[myIdx].tag);
                bmlBuf.push(attrs.length);
                bmlBuf.push(0, 0); // Placeholder for child count
                bmlBuf.push(0, 0, 0, 0); // Placeholder for text length
                
                for (const a of attrs) {
                    bmlBuf.push(a.id);
                    if (a.id === 254) {
                        bmlBuf.push(a.name.length);
                        for (const b of a.name) bmlBuf.push(b);
                    }
                    bmlBuf.push((a.val.length >> 8) & 0xFF, a.val.length & 0xFF);
                    for (const b of a.val) bmlBuf.push(b);
                }
                
                for (const c of el.childNodes) serNode(c, myIdx);
            }

            serNode(document.body, -1);

            // BDT Tree
            const depths = new Int32Array(flatNodes.length);
            for (let i = 0; i < flatNodes.length; i++) {
                let d = 0, p = flatNodes[i].parentIdx;
                while (p !== -1) { d++; p = flatNodes[p].parentIdx; }
                depths[i] = d;
            }
            const bdtBuf = new ArrayBuffer(flatNodes.length * 16);
            const bdtView = new DataView(bdtBuf);
            for (let i = 0; i < flatNodes.length; i++) {
                const n = flatNodes[i];
                const off = i * 16;
                bdtView.setUint32(off, n.id);
                bdtView.setUint16(off + 4, n.parentIdx === -1 ? 0xFFFF : n.parentIdx);
                const siblings = n.parentIdx === -1 ? [0] : flatNodes[n.parentIdx].children;
                const myPos = siblings.indexOf(i);
                const ps = myPos > 0 ? siblings[myPos - 1] : 0xFFFF;
                const ns = myPos < siblings.length - 1 ? siblings[myPos + 1] : 0xFFFF;
                bdtView.setUint16(off + 6, ns);
                bdtView.setUint16(off + 8, n.children.length ? n.children[n.children.length - 1] : 0xFFFF);
                bdtView.setUint16(off + 10, ps);
                bdtView.setUint8(off + 12, 1);
                bdtView.setUint8(off + 13, n.tag);
                bdtView.setUint8(off + 14, depths[i]);
            }

            // BLB extraction
            function parseUnitValue(val) {
                if(!val || val==='auto' || val==='none') return {u:4, v:0};
                if(val.endsWith('%')) return {u:1, v:Math.round(parseFloat(val)*10)};
                if(val.endsWith('vw')) return {u:2, v:Math.round(parseFloat(val)*10)};
                if(val.endsWith('vh')) return {u:3, v:Math.round(parseFloat(val)*10)};
                const n = parseFloat(val);
                return isNaN(n) ? {u:4, v:0} : {u:0, v:Math.round(n*10)};
            }

            const extractBLB = () => {
                const blbBuf = new ArrayBuffer(50 * 1024 * 1024);
                const blbView = new DataView(blbBuf);
                blbView.setUint32(0, flatNodes.length);
                let off = 4;
                for(let i = 0; i < flatNodes.length; i++){
                    const n = flatNodes[i].node;
                    blbView.setUint16(off, flatNodes[i].id); off += 2;
                    if(n.nodeType !== 1) { blbView.setUint8(off++, 0); continue; }
                    const s = window.getComputedStyle(n);
                    const props = [];
                    const addDim = (tag, cssProp) => {
                        const raw = s[cssProp];
                        const {u,v} = parseUnitValue(raw);
                        if(u!==4 || (tag===1 || tag===2)) props.push({tag, type:0, len:5, write:(vwr, o)=>{ vwr.setUint8(o, u); vwr.setInt32(o+1, v); }});
                    };
                    const addEnum = (tag, val) => { if(val!==undefined) props.push({tag, type:1, len:1, write:(vwr, o)=>vwr.setUint8(o, val)}); };
                    const addColor = (tag, val) => {
                        const c = colorToU32(val);
                        if(c!==0) props.push({tag, type:2, len:4, write:(vwr, o)=>vwr.setUint32(o, c)});
                    };
                    
                    addDim(1, 'width'); addDim(2, 'height'); addDim(3, 'minWidth'); addDim(4, 'minHeight');
                    addEnum(5, DM[s.display]); addEnum(6, PM_[s.position]); addEnum(7, s.boxSizing==='border-box'?1:0);
                    addDim(8, 'marginTop'); addDim(9, 'marginRight'); addDim(10, 'marginBottom'); addDim(11, 'marginLeft');
                    addDim(12, 'paddingTop'); addDim(13, 'paddingRight'); addDim(14, 'paddingBottom'); addDim(15, 'paddingLeft');
                    addColor(16, s.borderColor); addColor(17, s.backgroundColor); addColor(18, s.color);
                    addDim(19, 'fontSize'); addDim(20, 'lineHeight');
                    props.push({tag: 21, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, parseInt(s.fontWeight)||400)});
                    addEnum(22, TAM[s.textAlign]);
                    
                    if (DM[s.display]===2 || DM[s.display]===6 || DM[s.display]===11) { 
                        addEnum(23, FDM[s.flexDirection]); addEnum(24, FWM[s.flexWrap]);
                        addEnum(25, JCM[s.justifyContent]); addEnum(26, AIM[s.alignItems]||0);
                        props.push({tag:27, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexGrow||0)*100))});
                        props.push({tag:28, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexShrink||1)*100))});
                        addDim(30, 'gap');
                    }
                    addDim(31, 'borderRadius');
                    const ovMap={'visible':0,'hidden':1,'scroll':2,'auto':3};
                    addEnum(32, ovMap[s.overflow]||0);
                    const ff = s.fontFamily;
                    if(ff) {
                        const ffClean = ff.split(',')[0].replace(/['"]/g,'').trim();
                        const ffB = enc.encode(ffClean);
                        props.push({tag:33,type:3,len:4+ffB.length,write:(vwr,o)=>{vwr.setUint32(o,ffB.length);new Uint8Array(vwr.buffer).set(ffB,o+vwr.byteOffset+4);}});
                    }
                    const opVal=parseFloat(s.opacity); if(opVal<1.0) props.push({tag:34,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,Math.round(opVal*255))});
                    
                    const rect = n.getBoundingClientRect();
                    props.push({tag:46,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.left*10))}});
                    props.push({tag:47,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.top*10))}});
                    props.push({tag:48,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.width*10))}});
                    props.push({tag:49,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.height*10))}});
                    
                    blbView.setUint8(off++, props.length);
                    for(const p of props) {
                        blbView.setUint8(off++, p.tag);
                        blbView.setUint8(off++, p.type);
                        p.write(blbView, off); off += p.len;
                    }
                }
                return new Uint8Array(blbBuf.slice(0, off));
            };

            const blbDesktop = extractBLB();

            // Format to BWEB
            const bmlData = new Uint8Array([0x42, 0x4D, 0x4C, 0x01, ...bmlBuf]);
            return {
                bml: Array.from(bmlData),
                bdt: Array.from(new Uint8Array(bdtBuf)),
                blbDesktop: Array.from(blbDesktop),
                assets: Array.from(globalImages.values())
            };
        });

        console.log('[INFO] Successfully Extracted Nodes:', bwebData.blbDesktop.length / 50, '(approx)');

        // We will mock the wrapper around this to generate the final .bweb file format
        // In the real implementation, we should also fetch the images to base64, but for now we focus on layout serialization.
        
        const bmlBuf = Buffer.from(bwebData.bml);
        const bdtBuf = Buffer.from(bwebData.bdt);
        const blbBuf = Buffer.from(bwebData.blbDesktop);
        
        // Pack Assets (BIB & BVS)
        const bibBufs = [];
        const bvsBufs = [];
        for (const asset of bwebData.assets) {
            try {
                const url = new URL(asset.url);
                const localPath = path.join(inputDir, url.pathname.replace(/^\//, ''));
                if (!fs.existsSync(localPath)) continue;
                
                const fileData = fs.readFileSync(localPath);
                const header = Buffer.alloc(7);
                header.writeUInt16BE(asset.id, 0);
                
                if (asset.isVideo) {
                    header.writeUInt8(localPath.endsWith('.webm') ? 2 : 1, 2); // 1=MP4, 2=WebM
                    header.writeUInt32BE(fileData.length, 3);
                    bvsBufs.push(Buffer.concat([Buffer.from("BVS\x01"), header, fileData]));
                } else {
                    let mime = 2; // PNG
                    if (localPath.endsWith('.jpg') || localPath.endsWith('.jpeg')) mime = 1;
                    else if (localPath.endsWith('.svg')) mime = 3;
                    else if (localPath.endsWith('.webp')) mime = 4;
                    
                    header.writeUInt8(mime, 2);
                    header.writeUInt32BE(fileData.length, 3);
                    bibBufs.push(Buffer.concat([Buffer.from("BIB\x01"), header, fileData]));
                }
            } catch(e) {
                console.warn("[WARN] Failed to pack asset:", asset.url);
            }
        }
        
        const totalBibBuf = Buffer.concat(bibBufs);
        const totalBvsBuf = Buffer.concat(bvsBufs);
        
        // Write .bweb container
        const tocMap = {}; htmlFiles.forEach((f, i) => tocMap["/" + f] = { index: i });
        const tocBytes = Buffer.from("VFS\x01" + JSON.stringify(tocMap));
        
        let numSections = 4; // TOC, BML, BDT, BLB
        if (totalBibBuf.length > 0) numSections++;
        if (totalBvsBuf.length > 0) numSections++;
        
        const bwebHeader = Buffer.alloc(8 + 8*numSections);
        bwebHeader.writeUInt32BE(0x42574542, 0); // BWEB
        bwebHeader.writeUInt32BE(numSections, 4);
        
        let currentOffset = bwebHeader.length;
        bwebHeader.writeUInt8(9, 8); // TOC
        bwebHeader.writeUInt32BE(tocBytes.length, 9);
        bwebHeader.writeUInt8(0, 13);
        bwebHeader.writeUInt16BE(0, 14);
        currentOffset += tocBytes.length;
        
        bwebHeader.writeUInt8(1, 16); // BML
        bwebHeader.writeUInt32BE(bmlBuf.length, 17);
        bwebHeader.writeUInt8(0, 21);
        bwebHeader.writeUInt16BE(0, 22);
        currentOffset += bmlBuf.length;
        
        bwebHeader.writeUInt8(2, 24); // BDT
        bwebHeader.writeUInt32BE(bdtBuf.length, 25);
        bwebHeader.writeUInt8(0, 29);
        bwebHeader.writeUInt16BE(0, 30);
        currentOffset += bdtBuf.length;

        bwebHeader.writeUInt8(3, 32); // BLB
        bwebHeader.writeUInt32BE(blbBuf.length, 33);
        bwebHeader.writeUInt8(0, 37);
        bwebHeader.writeUInt16BE(0, 38);
        currentOffset += blbBuf.length;
        
        let sectionIndex = 40;
        if (totalBibBuf.length > 0) {
            bwebHeader.writeUInt8(4, sectionIndex); // BIB
            bwebHeader.writeUInt32BE(totalBibBuf.length, sectionIndex+1);
            bwebHeader.writeUInt8(0, sectionIndex+5);
            bwebHeader.writeUInt16BE(0, sectionIndex+6);
            currentOffset += totalBibBuf.length;
            sectionIndex += 8;
        }
        
        if (totalBvsBuf.length > 0) {
            bwebHeader.writeUInt8(5, sectionIndex); // BVS
            bwebHeader.writeUInt32BE(totalBvsBuf.length, sectionIndex+1);
            bwebHeader.writeUInt8(0, sectionIndex+5);
            bwebHeader.writeUInt16BE(0, sectionIndex+6);
            currentOffset += totalBvsBuf.length;
            sectionIndex += 8;
        }
        
        // Output it
        const outStream = fs.createWriteStream(outputFile);
        outStream.write(bwebHeader);
        outStream.write(tocBytes);
        outStream.write(bmlBuf);
        outStream.write(bdtBuf);
        outStream.write(blbBuf);
        if (totalBibBuf.length > 0) outStream.write(totalBibBuf);
        if (totalBvsBuf.length > 0) outStream.write(totalBvsBuf);
        
        outStream.end();
        console.log(`[SUCCESS] BWEB written to ${outputFile}`);
        
        // Generate manifest.bpg with ECDSA signature
        const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const hashStream = crypto.createHash('sha256');
        hashStream.update(bwebHeader).update(tocBytes).update(bmlBuf).update(bdtBuf).update(blbBuf);
        if (totalBibBuf.length > 0) hashStream.update(totalBibBuf);
        if (totalBvsBuf.length > 0) hashStream.update(totalBvsBuf);
        const bwebHash = hashStream.digest();
        const sign = crypto.createSign('SHA256');
        sign.update(bwebHash);
        const signature = sign.sign(privateKey);
        
        const manifest = {
            version: Date.now().toString(),
            hash: bwebHash.toString('hex'),
            signature: signature.toString('base64'),
            public_key: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
            feature_flags: { 'new_layout': true }
        };
        fs.writeFileSync(path.join(path.dirname(outputFile), 'manifest.bpg'), JSON.stringify(manifest, null, 2));
        console.log(`[SUCCESS] manifest.bpg signed and written.`);
        
        await browser.close();
        server.close();
    } catch (e) {
        console.error(e);
        server.close();
        process.exit(1);
    }
});
