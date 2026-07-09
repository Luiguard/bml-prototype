import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

start_str = "async function snapshotSinglePage(htmlContent) {"
end_str = "const vfsBlocks = [];"

parts = content.split(start_str)
if len(parts) < 2:
    print("FAILED: snapshotSinglePage not found")
    sys.exit(1)

pre_snap = parts[0]
post_parts = parts[1].split(end_str)
post_snap = end_str + end_str.join(post_parts[1:])

new_snap = """async function snapshotSinglePage(htmlContent) {
            return new Promise((res) => {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.height = '1080px';
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
                document.body.appendChild(iframe);

                const cleanHtml = htmlContent
                    .replace(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi, '')
                    .replace(/\\son[a-z]+\\s*=\\s*(['"])(.*?)\\1/gi, '');

                const blob = new Blob([cleanHtml], {type: 'text/html'});
                iframe.src = URL.createObjectURL(blob);
                iframe.onload = async () => {
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
                            if (tag === 'img') tag = 'canvas';
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

                        const extractBLB = () => {
                            const blbBuf = new ArrayBuffer(4 + flatNodes.length * 150);
                            const blbView = new DataView(blbBuf);
                            blbView.setUint32(0, flatNodes.length);
                            let off = 4;
                            for(let i=0; i<flatNodes.length; i++){
                                const n = flatNodes[i].node;
                                blbView.setUint16(off, flatNodes[i].id); off += 2;
                                if(n.nodeType!==1) { blbView.setUint8(off++, 0); continue; }
                                const s = iframe.contentWindow.getComputedStyle(n);
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
                                    addEnum(26, AIM[s.alignItems]||0);
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
                            return blbBuf.slice(0, off);
                        };

                        const runViewport = (width) => new Promise(resolvePass => {
                            iframe.style.width = width + 'px';
                            setTimeout(() => {
                                resolvePass(extractBLB());
                            }, 100);
                        });

                        const blbDesktop = await runViewport(1920);
                        const blbTablet = await runViewport(768);
                        const blbMobile = await runViewport(375);
                        
                        const bmlData = new Uint8Array([0x42,0x4D,0x4C,0x01, ...bmlBuf]);
                        document.body.removeChild(iframe);
                        
                        res({ bml: bmlData, bdt: bdtBuf, blbDesktop, blbTablet, blbMobile });
                    } catch(e) {
                        console.error(e);
                        res(null);
                    }
                };
            });
        }
"""
content = pre_snap + new_snap + "\n        " + post_snap

# We also need to update the appendSection logic in clientSideConvert
old_append = """        for(const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blb);
        }"""
new_append = """        for(const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blbDesktop);
            archiveSize += appendSection(8, vfs.blbTablet);
            archiveSize += appendSection(10, vfs.blbMobile);
        }"""
content = content.replace(old_append, new_append)

# Also update the secCount calculation
old_secCount = "let secCount = 1 + (vfsBlocks.length * 3);"
new_secCount = "let secCount = 1 + (vfsBlocks.length * 5);"
content = content.replace(old_secCount, new_secCount)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Multi-viewport snapshotting integrated.")
