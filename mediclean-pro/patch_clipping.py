import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace paintNode
start_paint = "    paintNode(node) {"
end_paint = "    measureAndLayout() {"

parts = content.split(start_paint)
pre_paint = parts[0]
post_parts = parts[1].split(end_paint)
post_paint = end_paint + end_paint.join(post_parts[1:])

new_paint = """    paintNode(node, accX = 0, accY = 0) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        let rx = node.layout.x - accX;
        let ry = node.layout.y - accY;
        let rw = node.layout.w;
        let rh = node.layout.h;
        
        let clipped = false;
        if(s[32] === 1 || s[32] === 2) { // hidden or scroll
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(rx, ry, rw, rh);
            this.ctx.clip();
            clipped = true;
        }

        if(!node.isText) {
            if(s[17]) {
                this.ctx.fillStyle = rgba(s[17]);
                this.ctx.fillRect(rx, ry, rw, rh);
            }
            
            const el = findBMLElementForNode(node.id, currentBMLRoot);
            if (el && (el.tag === 11 || el.tag === 43)) {
                let srcAttr = null;
                if(el.attributes) srcAttr = el.attributes.find(a => a.id === 19 || a.id === 33);
                if (srcAttr) {
                    const srcStr = new TextDecoder().decode(srcAttr.val);
                    let bibId = null;
                    if (srcStr.startsWith('bib://')) bibId = parseInt(srcStr.split('://')[1], 10);
                    else bibId = parseInt(srcStr, 10);
                    
                    if (!isNaN(bibId) && window.bwebBIB && window.bwebBIB[bibId]) {
                        this.ctx.drawImage(window.bwebBIB[bibId], rx + node.layout.pl, ry + node.layout.pt, rw - node.layout.pl - node.layout.pr, rh - node.layout.pt - node.layout.pb);
                    }
                }
            }
            
            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                this.ctx.strokeRect(rx, ry, rw, rh);
            }
        } else {
            if(node.layout.lines && node.layout.lines.length > 0) {
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px sans-serif`;
                this.ctx.textBaseline = "top";
                let lY = ry;
                for(const line of node.layout.lines) {
                    this.ctx.fillText(line, rx, lY);
                    lY += node.layout.lh;
                }
            }
        }
        
        let nScrollX = node.layout.scrollX || 0;
        let nScrollY = node.layout.scrollY || 0;
        for(const c of node.children) this.paintNode(c, accX + nScrollX, accY + nScrollY);
        
        if (clipped) {
            this.ctx.restore();
        }
    }

"""

content = pre_paint + new_paint + post_paint

# Replace hitTest
start_hit = "    hitTest(x, y) {"
end_hit = "}\n}" # End of hitTest and CanvasEngine class

parts2 = content.split(start_hit)
pre_hit = parts2[0]
post_hit_parts = parts2[1].split(end_hit)
post_hit = end_hit + end_hit.join(post_hit_parts[1:])

new_hit = """    hitTest(x, y) {
        if(!this.root) return null;
        let result = null;
        const search = (node, accX, accY) => {
            if(!node) return;
            const l = node.layout;
            const rx = l.x - accX;
            const ry = l.y - accY;
            
            const s = this.blbMap[node.id] || {};
            let isInside = (x >= rx && x <= rx + l.w && y >= ry && y <= ry + l.h);
            
            if (isInside) {
                result = node;
            } else if (s[32] === 1 || s[32] === 2) {
                // If clipped and click is outside, children cannot be hit
                return; 
            }
            
            const nScrollX = node.layout.scrollX || 0;
            const nScrollY = node.layout.scrollY || 0;
            for(const c of node.children) search(c, accX + nScrollX, accY + nScrollY);
        };
        search(this.root, 0, 0);
        return result;
    }
"""

content = pre_hit + new_hit + post_hit

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Scrolling and Clipping implementation done in CanvasEngine.")
