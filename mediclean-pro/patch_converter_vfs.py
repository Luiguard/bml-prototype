import re

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# We want to replace clientSideConvert entirely, and also update the compileFilesList call.
old_compile = """        const bweb = await clientSideConvert(baseHtml, variantMap);"""
new_compile = """        const bweb = await clientSideConvert(htmlMap);"""
content = content.replace(old_compile, new_compile)

# Find where clientSideConvert starts
start_str = "async function clientSideConvert(baseHtml, variantMap = {}){"
start_idx = content.find(start_str)

# Find where the next major function or block starts
end_str = "// AI Design Assistent"
end_idx = content.find(end_str, start_idx)

if start_idx != -1 and end_idx != -1:
    new_client_side_convert = """async function clientSideConvert(htmlMap) {
    return new Promise(async (resolve, reject) => {
        const TAG_FWD={};
        for(const[k,v]of Object.entries(TAG_REV))TAG_FWD[v]=parseInt(k);
        const ATTR_FWD={};
        for(const[k,v]of Object.entries(ATTR_REV))ATTR_FWD[v]=parseInt(k);
        const enc=new TextEncoder();
        const SKIP_TAGS=new Set(['script','style','noscript','template','iframe','object','embed','applet','link','meta','base','head','source','track','slot']);

        function colorToU32(c) {
            const m = c.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
            if (!m) return 0;
            const r=parseInt(m[1]),g=parseInt(m[2]),b=parseInt(m[3]);
            const a=m[4]!==undefined?Math.round(parseFloat(m[4])*255):255;
            return((r<<24)|(g<<16)|(b<<8)|a)>>>0;
        }
        const DM={'block':0,'inline':1,'flex':2,'grid':3,'none':4,'inline-block':5,'inline-flex':6,'list-item':7,'table':8,'table-row':9,'table-cell':10,'inline-grid':11};
        const PM_={'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4};
        const TAM={'left':0,'center':1,'right':2,'justify':3,'start':0,'end':2};
        const FDM={'row':0,'column':1,'row-reverse':2,'column-reverse':3};
        const FWM={'nowrap':0,'wrap':1,'wrap-reverse':2};
        const JCM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5,'normal':0};
        const AIM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'stretch':3,'baseline':4,'normal':3};

        const extractedImages = [];
        
        async function snapshotSinglePage(htmlContent) {
            return new Promise((res) => {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.width = '1920px';
                iframe.style.height = '1080px';
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
                document.body.appendChild(iframe);

                const cleanHtml = htmlContent
                    .replace(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi, '')
                    .replace(/\\son[a-z]+\\s*=\\s*(['"])(.*?)\\1/gi, '');

                const blob = new Blob([cleanHtml], {type: 'text/html'});
                iframe.src = URL.createObjectURL(blob);
                iframe.onload = () => {
                    setTimeout(() => {
                        try {
                            const doc = iframe.contentWindow.document;
                            const bmlBuf=[];
                            const flatNodes=[];

                            function serNode(el,parentIdx){
                                if(el.nodeType===3){
                                    const t=el.textContent.trim();
                                    if(!t)return;
                                    bmlBuf.push(0xFD, 0, 0, 0);
                                    const textBytes=enc.encode(t + " ");
                                    bmlBuf.push((textBytes.length>>8)&0xFF,textBytes.length&0xFF);
                                    for(const b of textBytes)bmlBuf.push(b);
                                    return;
                                }
                                if (el.nodeType !== 1) return;
                                let tag=el.tagName?el.tagName.toLowerCase():'div';
                                if(SKIP_TAGS.has(tag))return;
                                const attrs=[];
                                
                                if (tag === 'img') tag = 'canvas'; // mock img to canvas
                                
                                const myIdx=flatNodes.length;
                                flatNodes.push({node:el,tag:TAG_FWD[tag]||255,parentIdx,children:[],id:myIdx});
                                if(parentIdx>=0) flatNodes[parentIdx].children.push(myIdx);
                                
                                bmlBuf.push(TAG_FWD[tag]||255);
                                
                                for(const a of el.attributes){
                                    const aid=ATTR_FWD[a.name];
                                    if(aid!==undefined){
                                        const vBytes=enc.encode(a.value);
                                        attrs.push({id:aid,val:vBytes});
                                    } else if(a.name === 'href') {
                                        const vBytes=enc.encode(a.value);
                                        attrs.push({id:ATTR_FWD['href']||18,val:vBytes});
                                    }
                                }
                                bmlBuf.push(attrs.length);
                                for(const a of attrs){
                                    bmlBuf.push(a.id);
                                    bmlBuf.push((a.val.length>>8)&0xFF,a.val.length&0xFF);
                                    for(const b of a.val)bmlBuf.push(b);
                                }
                                for(const c of el.childNodes) serNode(c,myIdx);
                                bmlBuf.push(0xFE);
                            }
                            serNode(doc.body,-1);
                            
                            const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
                            const bdtView=new DataView(bdtBuf);
                            bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
                            bdtView.setUint32(4,flatNodes.length);
                            for(let i=0;i<flatNodes.length;i++){
                                const off=8+i*16;
                                const n=flatNodes[i];
                                bdtView.setUint16(off,i);
                                bdtView.setUint16(off+2,n.parentIdx>=0?n.parentIdx:0xFFFF);
                                bdtView.setUint16(off+4,n.children.length?n.children[0]:0xFFFF);
                                let ns=0xFFFF;
                                if(n.parentIdx>=0){
                                    const siblings=flatNodes[n.parentIdx].children;
                                    const myPos=siblings.indexOf(i);
                                    if(myPos>=0&&myPos<siblings.length-1)ns=siblings[myPos+1];
                                }
                                bdtView.setUint16(off+6,ns);
                                bdtView.setUint8(off+8,1);
                                bdtView.setUint8(off+9,n.tag);
                                bdtView.setUint8(off+10,0);
                            }

                            function getOriginalCSS(el, prop, computed) {
                                if(el.style[prop]) return el.style[prop];
                                return computed;
                            }
                            function parseUnitValue(val) {
                                if(!val || val==='auto' || val==='none') return {u:4, v:0};
                                if(val.endsWith('%')) return {u:1, v:Math.round(parseFloat(val)*10)};
                                if(val.endsWith('vw')) return {u:2, v:Math.round(parseFloat(val)*10)};
                                if(val.endsWith('vh')) return {u:3, v:Math.round(parseFloat(val)*10)};
                                const n = parseFloat(val);
                                return isNaN(n) ? {u:4, v:0} : {u:0, v:Math.round(n*10)};
                            }
                            const blbBuf = new ArrayBuffer(4 + flatNodes.length * 150);
                            const blbView = new DataView(blbBuf);
                            blbView.setUint32(0, flatNodes.length);
                            let off = 4;
                            for(let i=0; i<flatNodes.length; i++){
                                const n = flatNodes[i].node;
                                blbView.setUint16(off, flatNodes[i].id); off += 2;
                                if(n.nodeType!==1) { blbView.setUint8(off++, 0); continue; }
                                const s = getComputedStyle(n);
                                const props = [];
                                const addDim = (tag, cssProp) => {
                                    const raw = getOriginalCSS(n, cssProp, s[cssProp]);
                                    const {u,v} = parseUnitValue(raw);
                                    if(u!==4 || (tag===1 || tag===2)) props.push({tag, type:0, len:3, write:(vwr, o)=>{ vwr.setUint8(o, u); vwr.setUint16(o+1, v); }});
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
                                    addEnum(23, FDM[s.flexDirection]);
                                    addEnum(24, FWM[s.flexWrap]);
                                    addEnum(25, JCM[s.justifyContent]);
                                    addEnum(26, AIM[s.alignItems]);
                                    props.push({tag:27, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexGrow||0)*100))});
                                    props.push({tag:28, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexShrink||1)*100))});
                                    addDim(30, 'gap');
                                }
                                addDim(31, 'borderRadius');
                                addEnum(32, s.overflow==='hidden'?1:(s.overflow==='scroll'?2:0));
                                
                                blbView.setUint8(off++, props.length);
                                for(const p of props) {
                                    blbView.setUint8(off++, p.tag);
                                    blbView.setUint8(off++, p.type);
                                    p.write(blbView, off); off += p.len;
                                }
                            }
                            const finalBlb = blbBuf.slice(0, off);
                            const bmlData = new Uint8Array([0x42,0x4D,0x4C,0x01, ...bmlBuf]);
                            
                            document.body.removeChild(iframe);
                            res({ bml: bmlData, bdt: bdtBuf, blb: finalBlb });
                        } catch(e) {
                            console.error(e);
                            res(null);
                        }
                    }, 100);
                };
            });
        }

        const vfsBlocks = [];
        const toc = {}; 
        
        let fileIndex = 0;
        const htmlKeys = htmlMap ? Object.keys(htmlMap) : [];
        if (htmlKeys.length === 0 && typeof htmlMap === 'string') {
            htmlKeys.push('index.html');
            htmlMap = { 'index.html': htmlMap };
        }

        for (const path of htmlKeys) {
            updateLoader(50 + (fileIndex/htmlKeys.length)*30, "VFS Compilation", `Kompiliere Seite ${path}...`);
            const snap = await snapshotSinglePage(htmlMap[path]);
            if (snap) {
                // We map path -> index in the block arrays
                toc[path] = { index: fileIndex };
                vfsBlocks.push(snap);
                fileIndex++;
            }
        }

        const tocBytes = enc.encode(JSON.stringify(toc));
        
        let secCount = 1 + (vfsBlocks.length * 3);
        
        const sections = [];
        function appendSection(type, data) {
            const head = new DataView(new ArrayBuffer(5));
            head.setUint8(0, type);
            head.setUint32(1, data.byteLength || data.length);
            sections.push(new Uint8Array(head.buffer));
            sections.push(new Uint8Array(data));
            return 5 + (data.byteLength || data.length);
        }

        let archiveSize = 6;
        
        // Custom TOC Header: "VFS\x01" at the beginning of the TOC block
        const tocHeader = new Uint8Array([0x56, 0x46, 0x53, 0x01]);
        const tocPayload = new Uint8Array(4 + tocBytes.length);
        tocPayload.set(tocHeader, 0);
        tocPayload.set(tocBytes, 4);
        
        archiveSize += appendSection(9, tocPayload);
        
        for(const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blb);
        }

        const bwebBuf = new ArrayBuffer(archiveSize);
        const bwebView = new Uint8Array(bwebBuf);
        bwebView.set([0x42, 0x57, 0x45, 0x42, 0x01, secCount], 0);
        let curOffset = 6;
        for(const chunk of sections) {
            bwebView.set(chunk, curOffset);
            curOffset += chunk.length;
        }

        resolve(bwebBuf);
    });
}
"""
    content = content[:start_idx] + new_client_side_convert + "\n" + content[end_idx:]
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: clientSideConvert updated to VFS mode.")
else:
    print("FAILED: start_idx or end_idx not found.")

