import re

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the BLB struct encoding in clientSideConvert
old_blb_gen = """            const blbBuf = new ArrayBuffer(4 + flatNodes.length * 60);
            const blbView = new DataView(blbBuf);
            blbView.setUint32(0, flatNodes.length);
            
            for(let i=0; i<flatNodes.length; i++){
                const n = flatNodes[i].node;
                const off = 4 + i * 60;
                blbView.setUint16(off, flatNodes[i].id);
                if(n.nodeType===1){
                    const s = getComputedStyle(n);
                    blbView.setUint8(off+2,DM[s.display]??0);
                    blbView.setUint8(off+3,PM_[s.position]??0);
                    blbView.setUint8(off+4,s.boxSizing==='border-box'?1:0);
                    const isMedia = ['img','video','canvas','svg','iframe'].includes(n.tagName.toLowerCase());
                    blbView.setUint16(off+5, isMedia ? cssV(s.width) : 0xFFFF);
                    blbView.setUint16(off+7, isMedia ? cssV(s.height) : 0xFFFF);
                    blbView.setInt16(off+9,Math.round((parseFloat(s.marginTop)||0)*10));
                    blbView.setInt16(off+11,Math.round((parseFloat(s.marginRight)||0)*10));
                    blbView.setInt16(off+13,Math.round((parseFloat(s.marginBottom)||0)*10));
                    blbView.setInt16(off+15,Math.round((parseFloat(s.marginLeft)||0)*10));
                    blbView.setUint16(off+17,Math.round((parseFloat(s.paddingTop)||0)*10));
                    blbView.setUint16(off+19,Math.round((parseFloat(s.paddingRight)||0)*10));
                    blbView.setUint16(off+21,Math.round((parseFloat(s.paddingBottom)||0)*10));
                    blbView.setUint16(off+23,Math.round((parseFloat(s.paddingLeft)||0)*10));
                    blbView.setUint8(off+25,Math.round(parseFloat(s.borderTopWidth)||0));
                    blbView.setUint8(off+26,Math.round(parseFloat(s.borderRightWidth)||0));
                    blbView.setUint8(off+27,Math.round(parseFloat(s.borderBottomWidth)||0));
                    blbView.setUint8(off+28,Math.round(parseFloat(s.borderLeftWidth)||0));
                    blbView.setUint32(off+29,colorToU32(s.borderColor));
                    blbView.setUint32(off+33,colorToU32(s.backgroundColor));
                    blbView.setUint32(off+37,colorToU32(s.color));
                    blbView.setUint16(off+41,Math.round((parseFloat(s.fontSize)||16)*10));
                    blbView.setUint16(off+43,parseInt(s.fontWeight)||400);
                    blbView.setUint16(off+45,Math.round((parseFloat(s.lineHeight)||0)*10));
                    blbView.setUint8(off+47,TAM[s.textAlign]??0);
                    blbView.setUint8(off+48,FDM[s.flexDirection]??0);
                    blbView.setUint8(off+49,FWM[s.flexWrap]??0);
                    blbView.setUint8(off+50,JCM[s.justifyContent]??0);
                    blbView.setUint8(off+51,JCM[s.alignItems]??0);
                    blbView.setUint16(off+52,Math.max(0,Math.round((parseFloat(s.gap)||0)*10)));
                    blbView.setUint16(off+54,Math.max(0,Math.round((parseFloat(s.borderRadius)||0)*10)));
                    blbView.setUint8(off+56,s.overflow==='hidden'?1:(s.overflow==='scroll'?2:0));
                    blbView.setUint8(off+57,Math.round((parseFloat(s.opacity)||1)*255));
                    blbView.setInt16(off+58,s.zIndex==='auto'?0:parseInt(s.zIndex));
                }
            }"""

new_blb_gen = """            // --- TLV-BLB Generator (BLB-2) ---
            function getOriginalCSS(el, prop, computed) {
                if(el.style[prop]) return el.style[prop];
                try {
                    for(const sheet of document.styleSheets) {
                        for(const rule of sheet.cssRules) {
                            if(rule.type === 1 && el.matches(rule.selectorText)) {
                                if(rule.style[prop]) return rule.style[prop];
                            }
                        }
                    }
                }catch(e){}
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

            // Estimate max size (100 bytes per node max)
            const blbBuf = new ArrayBuffer(4 + flatNodes.length * 100);
            const blbView = new DataView(blbBuf);
            blbView.setUint32(0, flatNodes.length);
            let off = 4;
            
            for(let i=0; i<flatNodes.length; i++){
                const n = flatNodes[i].node;
                blbView.setUint16(off, flatNodes[i].id); off += 2;
                
                if(n.nodeType!==1) {
                    blbView.setUint8(off++, 0); // 0 properties
                    continue;
                }
                
                const s = getComputedStyle(n);
                const props = [];
                
                // Helper to add TLV
                const addDim = (tag, cssProp) => {
                    const raw = getOriginalCSS(n, cssProp, s[cssProp]);
                    const {u,v} = parseUnitValue(raw);
                    if(u!==4 || (tag===1 || tag===2)) { // always save width/height even if auto (for explicit media tags maybe)
                        props.push({tag, type:0, len:3, write:(vwr, o)=>{ vwr.setUint8(o, u); vwr.setUint16(o+1, v); }});
                    }
                };
                
                const addEnum = (tag, val) => {
                    if(val!==undefined) props.push({tag, type:1, len:1, write:(vwr, o)=>vwr.setUint8(o, val)});
                };
                
                const addColor = (tag, val) => {
                    const c = colorToU32(val);
                    if(c!==0) props.push({tag, type:2, len:4, write:(vwr, o)=>vwr.setUint32(o, c)});
                };
                
                addDim(1, 'width');
                addDim(2, 'height');
                addDim(3, 'minWidth');
                addDim(4, 'minHeight');
                
                addEnum(5, DM[s.display]);
                addEnum(6, PM_[s.position]);
                addEnum(7, s.boxSizing==='border-box'?1:0);
                
                addDim(8, 'marginTop'); addDim(9, 'marginRight'); addDim(10, 'marginBottom'); addDim(11, 'marginLeft');
                addDim(12, 'paddingTop'); addDim(13, 'paddingRight'); addDim(14, 'paddingBottom'); addDim(15, 'paddingLeft');
                
                addColor(16, s.borderColor); addColor(17, s.backgroundColor); addColor(18, s.color);
                
                addDim(19, 'fontSize');
                addDim(20, 'lineHeight');
                props.push({tag: 21, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, parseInt(s.fontWeight)||400)});
                addEnum(22, TAM[s.textAlign]);
                
                if (DM[s.display]===2 || DM[s.display]===6) { // flex
                    addEnum(23, FDM[s.flexDirection]);
                    addEnum(24, FWM[s.flexWrap]);
                    addEnum(25, JCM[s.justifyContent]);
                    addEnum(26, JCM[s.alignItems]);
                    props.push({tag:27, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexGrow||0)*100))});
                    props.push({tag:28, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexShrink||1)*100))});
                    addDim(29, 'flexBasis');
                    addDim(30, 'gap');
                }
                
                addDim(31, 'borderRadius');
                addEnum(32, s.overflow==='hidden'?1:(s.overflow==='scroll'?2:0));
                
                blbView.setUint8(off++, props.length);
                for(const p of props) {
                    blbView.setUint8(off++, p.tag);
                    blbView.setUint8(off++, p.type);
                    p.write(blbView, off);
                    off += p.len;
                }
            }
            // Trim buffer
            const finalBlb = blbBuf.slice(0, off);"""

if old_blb_gen in content:
    content = content.replace(old_blb_gen, new_blb_gen)
    # Also replace where blbBuf is appended!
    content = content.replace("bwebOffset += appendSection(7, blbBuf);", "bwebOffset += appendSection(7, finalBlb);")
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: TLV BLB-2 compiler patched.")
else:
    print("FAILED: Old BLB gen not found.")
