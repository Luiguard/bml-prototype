#!/usr/bin/env python3
"""BWEB Converter Pipeline Fix — Phase 4 Wave 2 CSS"""
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

print("=== Phase 4 Wave 2: Extracting CSS Properties ===")

# 1. Extractor updates
old_extract = """                                const tdLine=s.textDecorationLine||s.textDecoration||'';if(tdLine!=='none'&&tdLine!==''){let tdV=0;if(tdLine.includes('underline'))tdV|=1;if(tdLine.includes('line-through'))tdV|=2;if(tdV)props.push({tag:35,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,tdV)});}"""

new_extract = """                                const tdLine=s.textDecorationLine||s.textDecoration||'';if(tdLine!=='none'&&tdLine!==''){let tdV=0;if(tdLine.includes('underline'))tdV|=1;if(tdLine.includes('line-through'))tdV|=2;if(tdV)props.push({tag:35,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,tdV)});}
                                const bs=s.boxShadow;if(bs&&bs!=='none'){const bsB=enc.encode(bs);props.push({tag:36,type:3,len:2+bsB.length,write:(vwr,o)=>{vwr.setUint16(o,bsB.length);new Uint8Array(vwr.buffer).set(bsB,o+2);}});}
                                const bi=s.backgroundImage;if(bi&&bi!=='none'){const biB=enc.encode(bi);props.push({tag:37,type:3,len:2+biB.length,write:(vwr,o)=>{vwr.setUint16(o,biB.length);new Uint8Array(vwr.buffer).set(biB,o+2);}});}
                                const ttMap={'none':0,'uppercase':1,'lowercase':2,'capitalize':3};if(s.textTransform&&ttMap[s.textTransform]){props.push({tag:38,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,ttMap[s.textTransform])});}
                                const ls=parseFloat(s.letterSpacing);if(!isNaN(ls)&&ls!==0){props.push({tag:39,type:0,len:3,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setUint16(o+1,Math.round(ls*100));}});}"""

c = safe_replace(c, old_extract, new_extract, "Extractor updates (box-shadow, bg-img, text-transform, letter-spacing)")

print("\n=== Phase 4 Wave 2: CanvasEngine Paint Node ===")

# 2. Paint Node Background
old_paint_bg = """                if (node.isHovered) {
                    const cr=(color>>>24)&0xFF,cg=(color>>>16)&0xFF,cb=(color>>>8)&0xFF,ca=color&0xFF;
                    color = ((Math.min(255,cr+20))<<24) | ((Math.min(255,cg+20))<<16) | ((Math.min(255,cb+20))<<8) | ca;
                }
                this.ctx.fillStyle = rgba(color);
                if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.fill(); }
                else { this.ctx.fillRect(rx, ry, rw, rh); }
            }"""

new_paint_bg = """                if (node.isHovered) {
                    const cr=(color>>>24)&0xFF,cg=(color>>>16)&0xFF,cb=(color>>>8)&0xFF,ca=color&0xFF;
                    color = ((Math.min(255,cr+20))<<24) | ((Math.min(255,cg+20))<<16) | ((Math.min(255,cb+20))<<8) | ca;
                }
                this.ctx.fillStyle = rgba(color);
                
                if(s[36]) { // box-shadow
                    const shadowMatch = s[36].match(/(rgba?\\([^)]+\\)|#[0-9a-fA-F]+)\\s+([\\d.-]+)px\\s+([\\d.-]+)px\\s+([\\d.-]+)px(?:\\s+([\\d.-]+)px)?/);
                    if(shadowMatch) {
                        this.ctx.shadowColor = shadowMatch[1];
                        this.ctx.shadowOffsetX = parseFloat(shadowMatch[2]);
                        this.ctx.shadowOffsetY = parseFloat(shadowMatch[3]);
                        this.ctx.shadowBlur = parseFloat(shadowMatch[4]);
                    }
                }
                
                if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.fill(); }
                else { this.ctx.fillRect(rx, ry, rw, rh); }
                
                if(s[36]) { this.ctx.shadowColor = 'transparent'; this.ctx.shadowBlur = 0; this.ctx.shadowOffsetX = 0; this.ctx.shadowOffsetY = 0; }
            }
            
            if(s[37] && s[37].includes('linear-gradient')) {
                const gradStr = s[37];
                const match = gradStr.match(/linear-gradient\\(\\s*([^,]+)\\s*,(.*)\\)/);
                if(match) {
                    const dirStr = match[1].trim();
                    const stopsStr = match[2];
                    // Very basic gradient parser
                    let y1=ry, y0=ry, x0=rx, x1=rx;
                    if(dirStr==='to bottom') { y1=ry+rh; }
                    else if(dirStr==='to right') { x1=rx+rw; }
                    else if(dirStr.includes('deg')) {
                        const deg=parseFloat(dirStr);
                        if(deg===180) y1=ry+rh;
                        else if(deg===90) x1=rx+rw;
                        else if(deg===0) { y1=ry; y0=ry+rh; }
                    } else { y1=ry+rh; } // default
                    
                    const grad = this.ctx.createLinearGradient(x0, y0, x1, y1);
                    const stopParts = stopsStr.split(/,(?![^(]*\\))/);
                    for(let i=0; i<stopParts.length; i++) {
                        const pt = stopParts[i].trim();
                        const colMatch = pt.match(/(rgba?\\([^)]+\\)|#[0-9a-fA-F]+|\\w+)\\s*(\\d+%|\\d+px)?/);
                        if(colMatch) {
                            const cStr = colMatch[1];
                            let pos = i / (Math.max(1, stopParts.length - 1));
                            if(colMatch[2] && colMatch[2].includes('%')) pos = parseFloat(colMatch[2])/100;
                            grad.addColorStop(Math.min(1, Math.max(0, pos)), cStr);
                        }
                    }
                    this.ctx.fillStyle = grad;
                    if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.fill(); }
                    else { this.ctx.fillRect(rx, ry, rw, rh); }
                }
            }"""

c = safe_replace(c, old_paint_bg, new_paint_bg, "Paint: Background / box-shadow / linear-gradient")

# 3. Text rendering fixes (text-transform, letter-spacing)
old_paint_text = """                let lY = ry;
                for(const line of node.layout.lines) {
                    let lx = rx;
                    if(ta === 1) lx = rx + (node.layout.w - this.ctx.measureText(line).width) / 2;
                    else if(ta === 2) lx = rx + node.layout.w - this.ctx.measureText(line).width;
                    this.ctx.fillText(line, lx, lY);"""

new_paint_text = """                let lY = ry;
                if(s[39] && s[39].v) { this.ctx.letterSpacing = (s[39].v/100) + 'px'; } else { this.ctx.letterSpacing = 'normal'; }
                
                for(let line of node.layout.lines) {
                    if(s[38]===1) line = line.toUpperCase();
                    else if(s[38]===2) line = line.toLowerCase();
                    else if(s[38]===3) line = line.replace(/\\b\\w/g, c => c.toUpperCase());
                    
                    let lx = rx;
                    if(ta === 1) lx = rx + (node.layout.w - this.ctx.measureText(line).width) / 2;
                    else if(ta === 2) lx = rx + node.layout.w - this.ctx.measureText(line).width;
                    this.ctx.fillText(line, lx, lY);"""

c = safe_replace(c, old_paint_text, new_paint_text, "Paint: text-transform and letter-spacing")

print(f"\n=== Done: {changes} changes applied ===")

with open('bweb-converter/converter.html', 'w', encoding='utf-8') as f:
    f.write(c)

print("File written.")
