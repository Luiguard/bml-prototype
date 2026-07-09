#!/usr/bin/env python3
"""BWEB Converter Pipeline Fix — Phase 1+2+Rendering Wave 1"""
import re, sys

with open('bweb-converter/converter.html', 'r', encoding='utf-8') as f:
    c = f.read()

changes = 0

def safe_replace(content, old, new, label, count=1):
    global changes
    n = content.count(old)
    if n == 0:
        print(f"  WARN: '{label}' not found!")
        return content
    if n > count:
        print(f"  WARN: '{label}' found {n} times, expected {count}")
    content = content.replace(old, new, count)
    changes += 1
    print(f"  OK: {label}")
    return content

print("=== Phase 1: BMLParser Enhancement ===")

# 1a. Add parse() method to BMLParser
c = safe_replace(c,
    "constructor(buf,offset=0){this.v=new DataView(buf);this.d=new TextDecoder('utf-8');this.o=offset}\n    parseNode(depth=0){",
    "constructor(buf,offset=0){this.v=new DataView(buf);this.d=new TextDecoder('utf-8');this.o=offset}\n    parse(){return this.parseNode(0)}\n    parseNode(depth=0){",
    "BMLParser.parse() method"
)

# 1b. Add .tag and .attributes to BMLParser output
c = safe_replace(c,
    """let el = {
            tagName: tagName,
            attrs: {},
            children: [],
            text: '',
            isText: tagName === '#text'
        };""",
    """let el = {
            tag: tag,
            tagName: tagName,
            attrs: {},
            attributes: [],
            children: [],
            text: '',
            isText: tagName === '#text'
        };""",
    "BMLParser .tag/.attributes"
)

# 1c. Capture raw attribute bytes in BMLParser
c = safe_replace(c,
    "const aVal=this.d.decode(new Uint8Array(this.v.buffer,this.o,aLen));this.o+=aLen;\n            const aName=ATTR_REV[aId];\n            if(!aName||aName==='style'||DANGEROUS_ATTRS.has(aName))continue;",
    "const rawBytes=new Uint8Array(this.v.buffer,this.o,aLen);\n            el.attributes.push({id:aId,val:new Uint8Array(rawBytes)});\n            const aVal=this.d.decode(rawBytes);this.o+=aLen;\n            const aName=ATTR_REV[aId];\n            if(!aName||aName==='style'||DANGEROUS_ATTRS.has(aName))continue;",
    "BMLParser attribute capture"
)

print("\n=== Phase 1: BLBParser Type 3 (String) ===")

# 2. Add type 3 to BLBParser
c = safe_replace(c,
    """} else if(type === 2) { // Color
                    val = this.v.getUint32(this.o); this.o+=4;
                }
                b.props[tag] = val;""",
    """} else if(type === 2) { // Color
                    val = this.v.getUint32(this.o); this.o+=4;
                } else if(type === 3) { // String
                    const sLen = this.v.getUint16(this.o); this.o += 2;
                    val = new TextDecoder().decode(new Uint8Array(this.v.buffer, this.o, sLen));
                    this.o += sLen;
                }
                b.props[tag] = val;""",
    "BLBParser type 3 string"
)

print("\n=== Phase 2: Wrapper Functions ===")

# 3. Add parseBLB and parseBDT wrapper functions after BLBParser
c = safe_replace(c,
    "const MAX_CANVAS_DIM = 8192;",
    """function parseBLB(buf) {
    const p = new BLBParser(buf);
    return p.parse();
}

function parseBDT(buf) {
    const u8 = new Uint8Array(buf);
    let off = 0;
    if(u8[0]===0x42 && u8[1]===0x44 && u8[2]===0x54) off = 4;
    const p = new BDTParser(buf, off);
    return p.parse();
}

const MAX_CANVAS_DIM = 8192;""",
    "parseBLB/parseBDT wrappers"
)

print("\n=== Phase 1: Fix colorToU32 Regex ===")

# 4. Fix broken colorToU32 regex (double backslashes)
idx = c.find('function colorToU32(c)')
if idx > 0:
    end = c.find('}\n', idx + 50)
    old_func = c[idx:end+2]
    new_func = r"""function colorToU32(c) {
            const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (!m) return 0;
            const r=parseInt(m[1]),g=parseInt(m[2]),b=parseInt(m[3]);
            const a=m[4]!==undefined?Math.round(parseFloat(m[4])*255):255;
            return((r<<24)|(g<<16)|(b<<8)|a)>>>0;
        }
"""
    c = c[:idx] + new_func + c[end+2:]
    changes += 1
    print("  OK: colorToU32 regex fix")
else:
    print("  WARN: colorToU32 not found!")

print("\n=== Phase 1: Fix BML Serializer (serNode) ===")

# 5. Replace serNode to write parser-compatible format
old_serNode = """function serNode(el,parentIdx){
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
                        }"""

new_serNode = """function serNode(el,parentIdx){
                            if(el.nodeType===3){
                                const t=el.textContent.trim();
                                if(!t)return;
                                const textBytes=enc.encode(t + " ");
                                bmlBuf.push(0xFD, 0, 0, 0);
                                bmlBuf.push((textBytes.length>>8)&0xFF,textBytes.length&0xFF);
                                for(const b of textBytes)bmlBuf.push(b);
                                return;
                            }
                            if (el.nodeType !== 1) return;
                            let tag=el.tagName?el.tagName.toLowerCase():'div';
                            if(SKIP_TAGS.has(tag))return;
                            if (tag === 'img') tag = 'canvas';
                            const myIdx=flatNodes.length;
                            flatNodes.push({node:el,tag:TAG_FWD[tag]||255,parentIdx,children:[],id:myIdx});
                            if(parentIdx>=0) flatNodes[parentIdx].children.push(myIdx);
                            const attrs=[];
                            for(const a of el.attributes){
                                const aid=ATTR_FWD[a.name];
                                if(aid!==undefined){
                                    attrs.push({id:aid,val:enc.encode(a.value)});
                                } else if(a.name === 'href') {
                                    attrs.push({id:ATTR_FWD['href']||18,val:enc.encode(a.value)});
                                }
                            }
                            let nChild=0;
                            for(const ch of el.childNodes){
                                if(ch.nodeType===3&&ch.textContent.trim())nChild++;
                                else if(ch.nodeType===1){const ct=ch.tagName?ch.tagName.toLowerCase():'';if(!SKIP_TAGS.has(ct))nChild++;}
                            }
                            bmlBuf.push(TAG_FWD[tag]||255);
                            bmlBuf.push(attrs.length);
                            bmlBuf.push((nChild>>8)&0xFF,nChild&0xFF);
                            bmlBuf.push(0,0);
                            for(const a of attrs){
                                bmlBuf.push(a.id);
                                bmlBuf.push((a.val.length>>8)&0xFF,a.val.length&0xFF);
                                for(const b of a.val)bmlBuf.push(b);
                            }
                            for(const ch of el.childNodes) serNode(ch,myIdx);
                        }"""

c = safe_replace(c, old_serNode, new_serNode, "serNode BML format fix")

print("\n=== Phase 1: Fix BDT Serializer ===")

# 6. Fix BDT serializer to match parser format
old_bdt = """const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
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
                        }"""

new_bdt = """const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
                        const bdtView=new DataView(bdtBuf);
                        bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
                        bdtView.setUint32(4,flatNodes.length);
                        const depths=new Array(flatNodes.length).fill(0);
                        for(let i=0;i<flatNodes.length;i++){if(flatNodes[i].parentIdx>=0)depths[i]=depths[flatNodes[i].parentIdx]+1;}
                        for(let i=0;i<flatNodes.length;i++){
                            const off=8+i*16;
                            const n=flatNodes[i];
                            bdtView.setUint16(off,i);
                            bdtView.setUint16(off+2,n.parentIdx>=0?n.parentIdx:0xFFFF);
                            bdtView.setUint16(off+4,n.children.length?n.children[0]:0xFFFF);
                            let ns=0xFFFF,ps=0xFFFF;
                            if(n.parentIdx>=0){
                                const siblings=flatNodes[n.parentIdx].children;
                                const myPos=siblings.indexOf(i);
                                if(myPos>=0&&myPos<siblings.length-1)ns=siblings[myPos+1];
                                if(myPos>0)ps=siblings[myPos-1];
                            }
                            bdtView.setUint16(off+6,ns);
                            bdtView.setUint16(off+8,n.children.length?n.children[n.children.length-1]:0xFFFF);
                            bdtView.setUint16(off+10,ps);
                            bdtView.setUint8(off+12,1);
                            bdtView.setUint8(off+13,n.tag);
                            bdtView.setUint8(off+14,depths[i]);
                        }"""

c = safe_replace(c, old_bdt, new_bdt, "BDT serializer fix")

print("\n=== Phase 1: Fix BLB Extractor (add font-family, opacity, text-decoration) ===")

# 7. Add font-family, opacity, text-decoration, overflow fix to BLB extractor
c = safe_replace(c,
    "addDim(31, 'borderRadius');\n                                addEnum(32, s.overflow==='hidden'?1:(s.overflow==='scroll'?2:0));",
    """addDim(31, 'borderRadius');
                                const ovMap={'visible':0,'hidden':1,'scroll':2,'auto':3};
                                addEnum(32, ovMap[s.overflow]||0);
                                const ff=s.fontFamily;
                                if(ff){const ffClean=ff.split(',')[0].replace(/['"]/g,'').trim();const ffB=enc.encode(ffClean);props.push({tag:33,type:3,len:2+ffB.length,write:(vwr,o)=>{vwr.setUint16(o,ffB.length);new Uint8Array(vwr.buffer).set(ffB,o+2);}});}
                                const opVal=parseFloat(s.opacity);if(opVal<1.0)props.push({tag:34,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,Math.round(opVal*255))});
                                const tdLine=s.textDecorationLine||s.textDecoration||'';if(tdLine!=='none'&&tdLine!==''){let tdV=0;if(tdLine.includes('underline'))tdV|=1;if(tdLine.includes('line-through'))tdV|=2;if(tdV)props.push({tag:35,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,tdV)});}""",
    "BLB extractor font/opacity/text-decoration"
)

# 7b. Increase BLB buffer size
c = safe_replace(c,
    "const blbBuf = new ArrayBuffer(4 + flatNodes.length * 150);",
    "const blbBuf = new ArrayBuffer(4 + flatNodes.length * 300);",
    "BLB buffer size increase"
)

print("\n=== Phase 3: Fix findBMLElementForNode ===")

# 8. Fix findBMLElementForNode: cache + isText check
old_find = """function findBMLElementForNode(id, el) {
    if(!el) return null;
    // Simple BFS/DFS map if IDs align. Actually flatNodes indices are mapped to id.
    // In our parser, BML elements aren't given flatNode IDs explicitly.
    // But we know BDT nodes were built in exact DFS order of BML elements!
    // So we can flatten BML elements and index by id.
    const flatBML = [];
    const flatten = (n) => {
        if(n.type === 'text') return;
        flatBML.push(n);
        for(const c of n.children) flatten(c);
    };
    flatten(el);
    return flatBML[id] || null;
}"""

new_find = """let cachedFlatBML=null,cachedBMLRoot=null;
function findBMLElementForNode(id, el) {
    if(!el) return null;
    if(el!==cachedBMLRoot){
        cachedBMLRoot=el;
        cachedFlatBML=[];
        const flatten=(n)=>{
            if(!n.isText) cachedFlatBML.push(n);
            if(n.children) for(const ch of n.children) flatten(ch);
        };
        flatten(el);
    }
    return cachedFlatBML[id]||null;
}"""

c = safe_replace(c, old_find, new_find, "findBMLElementForNode fix")

print("\n=== Phase 3: Fix loadPage (use BML tree as rootVNode) ===")

# 9. Fix loadPage to use BML tree
c = safe_replace(c,
    "if(bdtNodes && blbs.desktop) {\n        globalEngine.update(bdtNodes[0], bdtNodes, blbs);\n    }",
    "if(currentBMLRoot && blbs.desktop) {\n        globalEngine.update(currentBMLRoot, bdtNodes, blbs);\n    }",
    "loadPage: BML tree as rootVNode"
)

print("\n=== Phase 3: Fix CanvasEngine linkTree (element-only IDs) ===")

# 10. Fix linkTree to only assign IDs to non-text nodes
old_linkTree = """        let bdtIdx = 0;
        const linkTree = (node, parentNode) => {
            if(!node) return;
            node.id = bdtIdx++;
            node.parent = parentNode;
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[], scrollY: 0 };"""

new_linkTree = """        let bdtIdx = 0;
        const linkTree = (node, parentNode) => {
            if(!node) return;
            node.parent = parentNode;
            if(!node.isText) { node.id = bdtIdx++; } else { node.id = -1; }
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[], scrollY: 0 };"""

c = safe_replace(c, old_linkTree, new_linkTree, "linkTree element-only IDs")

print("\n=== Phase 4: Fix CanvasEngine measureNode (font-family, display:none, parent styles for text) ===")

# 11. Fix measureNode
old_measure_start = """    measureNode(node, parentW) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};"""

new_measure_start = """    measureNode(node, parentW) {
        if(!node) return;
        const s = node.isText ? (this.blbMap[node.parent?.id] || {}) : (this.blbMap[node.id] || {});
        if(!node.isText && s[5] === 4) { node.layout.w=0; node.layout.h=0; return; }"""

c = safe_replace(c, old_measure_start, new_measure_start, "measureNode: text parent styles + display:none")

# 11b. Fix font in measureNode
c = safe_replace(c,
    "const fs = s[19] ? this.getVal(s[19], parentW) : 16;\n            this.ctx.font = `${s[21]||400} ${fs}px sans-serif`;",
    "const fs = s[19] ? this.getVal(s[19], parentW) : 16;\n            const ff = s[33] || 'sans-serif';\n            this.ctx.font = `${s[21]||400} ${fs}px ${ff}`;",
    "measureNode: font-family"
)

print("\n=== Phase 4: Fix CanvasEngine paintNode (border-radius, opacity, font-family, text-decoration, display:none) ===")

# 12. Fix paintNode - text parent styles + display:none
old_paint_s = """        const s = this.blbMap[node.id] || {};
        
        let rx = node.layout.x - accX;"""

new_paint_s = """        const s = node.isText ? (this.blbMap[node.parent?.id] || {}) : (this.blbMap[node.id] || {});
        if(!node.isText && s[5] === 4) return;
        
        let rx = node.layout.x - accX;"""

c = safe_replace(c, old_paint_s, new_paint_s, "paintNode: text parent styles + display:none")

# 12b. Fix paintNode background: add border-radius + opacity
old_paint_bg = """        if(!node.isText) {
            if(s[17]) {
                let color = s[17];
                if (node.isHovered) {
                    // Simple hover effect: alpha reduction or lighten
                    const r=(color>>>24)&0xFF,g=(color>>>16)&0xFF,b=(color>>>8)&0xFF,a=color&0xFF;
                    color = ((r+20)<<24) | ((g+20)<<16) | ((b+20)<<8) | a;
                }
                this.ctx.fillStyle = rgba(color);
                this.ctx.fillRect(rx, ry, rw, rh);
            }"""

new_paint_bg = """        if(!node.isText) {
            const br = s[31] ? this.getVal(s[31], rw) : 0;
            const hasOpacity = s[34] !== undefined && s[34] < 255;
            if(hasOpacity) { this.ctx.save(); this.ctx.globalAlpha = s[34]/255; }
            if(s[17]) {
                let color = s[17];
                if (node.isHovered) {
                    const cr=(color>>>24)&0xFF,cg=(color>>>16)&0xFF,cb=(color>>>8)&0xFF,ca=color&0xFF;
                    color = ((Math.min(255,cr+20))<<24) | ((Math.min(255,cg+20))<<16) | ((Math.min(255,cb+20))<<8) | ca;
                }
                this.ctx.fillStyle = rgba(color);
                if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.fill(); }
                else { this.ctx.fillRect(rx, ry, rw, rh); }
            }"""

c = safe_replace(c, old_paint_bg, new_paint_bg, "paintNode: border-radius + opacity")

# 12c. Fix border stroke to also use border-radius + close opacity
old_paint_border = """            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                this.ctx.strokeRect(rx, ry, rw, rh);
            }
        } else {"""

new_paint_border = """            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.stroke(); }
                else { this.ctx.strokeRect(rx, ry, rw, rh); }
            }
            if(hasOpacity) this.ctx.restore();
        } else {"""

c = safe_replace(c, old_paint_border, new_paint_border, "paintNode: border-radius stroke + opacity restore")

# 12d. Fix text rendering: font-family + text-decoration
old_paint_text = """            if(node.layout.lines && node.layout.lines.length > 0) {
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px sans-serif`;
                this.ctx.textBaseline = "top";
                let lY = ry;
                for(const line of node.layout.lines) {
                    this.ctx.fillText(line, rx, lY);
                    lY += node.layout.lh;
                }
            }"""

new_paint_text = """            if(node.layout.lines && node.layout.lines.length > 0) {
                const ff = s[33] || 'sans-serif';
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px ${ff}`;
                this.ctx.textBaseline = "top";
                const ta = s[22] || 0;
                let lY = ry;
                for(const line of node.layout.lines) {
                    let lx = rx;
                    if(ta === 1) lx = rx + (node.layout.w - this.ctx.measureText(line).width) / 2;
                    else if(ta === 2) lx = rx + node.layout.w - this.ctx.measureText(line).width;
                    this.ctx.fillText(line, lx, lY);
                    if(s[35]) {
                        const tw = this.ctx.measureText(line).width;
                        this.ctx.strokeStyle = this.ctx.fillStyle;
                        this.ctx.lineWidth = 1;
                        if(s[35] & 1) { this.ctx.beginPath(); this.ctx.moveTo(lx, lY+node.layout.fs+1); this.ctx.lineTo(lx+tw, lY+node.layout.fs+1); this.ctx.stroke(); }
                        if(s[35] & 2) { this.ctx.beginPath(); this.ctx.moveTo(lx, lY+node.layout.fs*0.5); this.ctx.lineTo(lx+tw, lY+node.layout.fs*0.5); this.ctx.stroke(); }
                    }
                    lY += node.layout.lh;
                }
            }"""

c = safe_replace(c, old_paint_text, new_paint_text, "paintNode: font-family + text-align + text-decoration")

print("\n=== Phase 4: Fix CanvasEngine layoutNode (justify-content) ===")

# 13. Fix layoutNode flex-row justify-content
old_layout_flex = """        if(isFlexRow) {
            let freeSpace = node.layout.w - node.layout.pl - node.layout.pr - node.layout.innerW;
            let totalGrow = 0;
            for(const c of node.children) {
                if(c.layout.position !== 2) {
                    const cStyle = this.blbMap[c.id] || {};
                    totalGrow += (cStyle[27] || 0);
                }
            }
            
            for(const c of node.children) {
                if(c.layout.position === 2) {
                    this.layoutNode(c, cx + c.layout.ml, cy + c.layout.mt);
                    continue;
                }
                
                const cStyle = this.blbMap[c.id] || {};
                let cW = c.layout.w;
                if(freeSpace > 0 && totalGrow > 0) {
                    const grow = cStyle[27] || 0;
                    cW += (grow / totalGrow) * freeSpace;
                    c.layout.w = cW;
                }
                
                let aY = cy + c.layout.mt;
                let cHeight = c.layout.h;
                const ai = s[26] || 0;
                if(ai === 2) {
                    aY = cy + (node.layout.innerH - cHeight) / 2;
                } else if(ai === 3 && (cStyle[2] && cStyle[2].u===4)) {
                    cHeight = node.layout.innerH - c.layout.mt - c.layout.mb;
                    c.layout.h = cHeight;
                }
                
                this.layoutNode(c, cx + c.layout.ml, aY);
                cx += cW + c.layout.ml + c.layout.mr + gap;
            }"""

new_layout_flex = """        if(isFlexRow) {
            const flowItems = [];
            let totalGrow = 0;
            let totalItemW = 0;
            for(const c of node.children) {
                if(c.layout.position === 2) continue;
                const cStyle = this.blbMap[c.id] || {};
                totalGrow += (cStyle[27] || 0);
                totalItemW += c.layout.w + c.layout.ml + c.layout.mr;
                flowItems.push(c);
            }
            const totalGaps = Math.max(0, flowItems.length - 1) * gap;
            const availW = node.layout.w - node.layout.pl - node.layout.pr;
            let freeSpace = availW - totalItemW - totalGaps;
            
            const jc = s[25] || 0;
            let startX = cx;
            let extraGap = gap;
            if(totalGrow > 0 && freeSpace > 0) { /* grow handles spacing */ }
            else if(jc === 1) { startX = cx + Math.max(0,freeSpace); }
            else if(jc === 2) { startX = cx + Math.max(0,freeSpace)/2; }
            else if(jc === 3 && flowItems.length > 1) { extraGap = gap + Math.max(0,freeSpace)/(flowItems.length-1); }
            else if(jc === 4 && flowItems.length > 0) { const sp=Math.max(0,freeSpace)/flowItems.length; startX=cx+sp/2; extraGap=gap+sp; }
            else if(jc === 5 && flowItems.length > 0) { const sp=Math.max(0,freeSpace)/(flowItems.length+1); startX=cx+sp; extraGap=gap+sp; }
            cx = startX;
            
            for(const c of node.children) {
                if(c.layout.position === 2) {
                    this.layoutNode(c, cx + c.layout.ml, cy + c.layout.mt);
                    continue;
                }
                
                const cStyle = this.blbMap[c.id] || {};
                let cW = c.layout.w;
                if(freeSpace > 0 && totalGrow > 0) {
                    const grow = cStyle[27] || 0;
                    cW += (grow / totalGrow) * freeSpace;
                    c.layout.w = cW;
                }
                
                let aY = cy + c.layout.mt;
                let cHeight = c.layout.h;
                const ai = s[26] || 0;
                if(ai === 2) {
                    aY = cy + (node.layout.innerH - cHeight) / 2;
                } else if(ai === 3 && (cStyle[2] && cStyle[2].u===4)) {
                    cHeight = node.layout.innerH - c.layout.mt - c.layout.mb;
                    c.layout.h = cHeight;
                }
                
                this.layoutNode(c, cx + c.layout.ml, aY);
                cx += cW + c.layout.ml + c.layout.mr + extraGap;
            }"""

c = safe_replace(c, old_layout_flex, new_layout_flex, "layoutNode: justify-content")

print("\n=== Phase 4: Fix A11y tag mapping ===")

# 14. Fix A11y layer tag mapping (el.tag comes from BML parser)
c = safe_replace(c,
    "const el = findBMLElementForNode(node.id, currentBMLRoot);\n            if (el && !node.isText) {",
    "const el = (node.id >= 0) ? findBMLElementForNode(node.id, currentBMLRoot) : null;\n            if (el && !node.isText) {",
    "A11y: skip text nodes in lookup"
)

print(f"\n=== Done: {changes} changes applied ===")

with open('bweb-converter/converter.html', 'w', encoding='utf-8') as f:
    f.write(c)

print("File written. Checking syntax...")
