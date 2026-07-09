import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace CanvasEngine
start_canvas = "class CanvasEngine {"
end_canvas = "function applyBLB(rootEl, blocks) {}"

parts = content.split(start_canvas)
pre_canvas = parts[0]
post_canvas_parts = parts[1].split(end_canvas)
post_canvas = end_canvas + end_canvas.join(post_canvas_parts[1:])

new_canvas = """class CanvasEngine {
    constructor() {
        this.root = null;
        this.blbMap = {};
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.layoutHeight = 0;
        
        window.addEventListener('resize', () => {
            this.measureAndLayout();
            this.draw();
        });
        window.addEventListener('scroll', () => {
            this.draw();
        });
    }

    update(rootVNode, bdtNodes, blbBlocks) {
        this.root = rootVNode;
        this.blbMap = {};
        for(const b of blbBlocks) this.blbMap[b.nid] = b.props;
        
        let bdtIdx = 0;
        const linkTree = (node) => {
            if(!node) return;
            node.id = bdtIdx++;
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[] };
            for(const c of node.children) linkTree(c);
        };
        linkTree(this.root);
        
        this.measureAndLayout();
        this.draw();
    }

    mount(container) {
        container.innerHTML = '';
        container.appendChild(this.canvas);
    }
    
    getVal(val, parentSize) {
        if(!val) return 0;
        if(val.u === 0) return val.v / 10;
        if(val.u === 1) return (val.v / 1000) * parentSize;
        if(val.u === 2) return (val.v / 1000) * window.innerWidth;
        if(val.u === 3) return (val.v / 1000) * window.innerHeight;
        return 0;
    }

    measureNode(node, parentW) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        const pl = this.getVal(s[15], parentW), pr = this.getVal(s[13], parentW);
        const pt = this.getVal(s[12], parentW), pb = this.getVal(s[14], parentW);
        const mt = this.getVal(s[8], parentW), mb = this.getVal(s[10], parentW);
        const ml = this.getVal(s[11], parentW), mr = this.getVal(s[9], parentW);
        
        node.layout.mt=mt; node.layout.mb=mb; node.layout.ml=ml; node.layout.mr=mr;
        node.layout.pt=pt; node.layout.pb=pb; node.layout.pl=pl; node.layout.pr=pr;
        node.layout.position = s[6] || 0; 
        
        let expW = s[1] && s[1].u !== 4 ? this.getVal(s[1], parentW) : null;
        let expH = s[2] && s[2].u !== 4 ? this.getVal(s[2], 0) : null;
        
        let availInnerW = (expW !== null ? expW : parentW - ml - mr) - pl - pr;
        if(availInnerW < 0) availInnerW = 0;
        
        if (node.isText) {
            const text = node.text.trim();
            if(!text) { node.layout.w = 0; node.layout.h = 0; return; }
            
            const fs = s[19] ? this.getVal(s[19], parentW) : 16;
            this.ctx.font = `${s[21]||400} ${fs}px sans-serif`;
            
            const words = text.split(/[ \\t\\n]+/);
            let lines = [];
            let currentLine = words[0];
            let maxW = 0;
            
            for(let i=1; i<words.length; i++) {
                const w = words[i];
                const width = this.ctx.measureText(currentLine + " " + w).width;
                if(width < availInnerW) {
                    currentLine += " " + w;
                } else {
                    lines.push(currentLine);
                    maxW = Math.max(maxW, this.ctx.measureText(currentLine).width);
                    currentLine = w;
                }
            }
            lines.push(currentLine);
            maxW = Math.max(maxW, this.ctx.measureText(currentLine).width);
            
            node.layout.lines = lines;
            node.layout.innerW = maxW;
            const lh = s[20] && s[20].u !== 4 ? this.getVal(s[20], parentW) : (fs * 1.2);
            node.layout.innerH = lines.length * lh;
            node.layout.fs = fs;
            node.layout.lh = lh;
            
            node.layout.w = expW !== null ? expW : node.layout.innerW + pl + pr;
            node.layout.h = expH !== null ? expH : node.layout.innerH + pt + pb;
            return;
        }
        
        let maxChildW = 0;
        let totalChildH = 0;
        let isFlexRow = s[5]===2 && s[23]===0; 
        let totalFlexRowW = 0;
        let maxFlexRowH = 0;
        
        for(const c of node.children) {
            this.measureNode(c, availInnerW);
            if(c.layout.position === 2) continue; 
            
            if(isFlexRow) {
                totalFlexRowW += c.layout.w + c.layout.ml + c.layout.mr;
                maxFlexRowH = Math.max(maxFlexRowH, c.layout.h + c.layout.mt + c.layout.mb);
            } else {
                maxChildW = Math.max(maxChildW, c.layout.w + c.layout.ml + c.layout.mr);
                totalChildH += c.layout.h + c.layout.mt + c.layout.mb;
            }
        }
        
        if(isFlexRow) {
            const gap = s[30] ? this.getVal(s[30], parentW) : 0;
            const gaps = Math.max(0, node.children.length - 1) * gap;
            node.layout.innerW = totalFlexRowW + gaps;
            node.layout.innerH = maxFlexRowH;
        } else {
            node.layout.innerW = maxChildW;
            node.layout.innerH = totalChildH;
        }
        
        node.layout.w = expW !== null ? expW : node.layout.innerW + pl + pr;
        node.layout.h = expH !== null ? expH : node.layout.innerH + pt + pb;
    }

    layoutNode(node, x, y) {
        if(!node) return;
        node.layout.x = x;
        node.layout.y = y;
        
        if(node.isText) return;
        
        const s = this.blbMap[node.id] || {};
        let isFlexRow = s[5]===2 && s[23]===0;
        
        let cx = x + node.layout.pl;
        let cy = y + node.layout.pt;
        const gap = s[30] ? this.getVal(s[30], node.layout.w) : 0;
        
        if(isFlexRow) {
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
            }
        } else {
            for(const c of node.children) {
                if(c.layout.position === 2) {
                    this.layoutNode(c, x + c.layout.ml, y + c.layout.mt);
                    continue;
                }
                
                const cStyle = this.blbMap[c.id] || {};
                if((!cStyle[1] || cStyle[1].u===4) && c.layout.position !== 2 && !c.isText) {
                    c.layout.w = node.layout.w - node.layout.pl - node.layout.pr - c.layout.ml - c.layout.mr;
                }
                
                this.layoutNode(c, cx + c.layout.ml, cy + c.layout.mt);
                cy += c.layout.h + c.layout.mt + c.layout.mb + gap;
            }
        }
    }

    paintNode(node) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        if(!node.isText) {
            if(s[17]) {
                this.ctx.fillStyle = rgba(s[17]);
                this.ctx.fillRect(node.layout.x, node.layout.y, node.layout.w, node.layout.h);
            }
            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                this.ctx.strokeRect(node.layout.x, node.layout.y, node.layout.w, node.layout.h);
            }
        } else {
            if(node.layout.lines && node.layout.lines.length > 0) {
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px sans-serif`;
                this.ctx.textBaseline = "top";
                let lY = node.layout.y;
                for(const line of node.layout.lines) {
                    this.ctx.fillText(line, node.layout.x, lY);
                    lY += node.layout.lh;
                }
            }
        }
        
        for(const c of node.children) this.paintNode(c);
    }
    
    measureAndLayout() {
        if(!this.root) return;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.parentElement.clientWidth || window.innerWidth;
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for measureText
        
        this.measureNode(this.root, w);
        this.layoutNode(this.root, 0, 0);
        
        // Calculate max Y for layoutHeight
        let maxY = 0;
        const findMaxY = (n) => {
            if(!n) return;
            const bottom = n.layout.y + n.layout.h + n.layout.mb;
            if(bottom > maxY) maxY = bottom;
            for(const c of n.children) findMaxY(c);
        };
        findMaxY(this.root);
        this.layoutHeight = maxY;
        
        this.canvas.style.height = this.layoutHeight + 'px';
        this.canvas.height = this.layoutHeight * dpr;
        this.canvas.width = w * dpr;
        this.canvas.style.width = w + 'px';
    }

    draw() {
        if(!this.root) return;
        const dpr = window.devicePixelRatio || 1;
        
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.clearRect(0,0, this.canvas.width, this.canvas.height);
        
        // Native Scrolling Integration
        this.ctx.save();
        // Since the canvas is positioned statically and grows in height, 
        // the browser natively scrolls it. We don't need ctx.translate if the canvas itself is long!
        // But if the container is fixed and we use canvas scroll, we do.
        // Assuming the canvas is full height:
        
        this.paintNode(this.root);
        this.ctx.restore();
    }
    
    hitTest(x, y) {
        if(!this.root) return null;
        let result = null;
        const search = (node) => {
            if(!node) return;
            // Check bounding box
            const l = node.layout;
            if(x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) {
                result = node; // Overwrite to get the topmost (last painted) child
            }
            for(const c of node.children) search(c);
        };
        search(this.root);
        return result;
    }
}
"""

content = pre_canvas + new_canvas + "\n" + post_canvas

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS: CanvasEngine updated.")
