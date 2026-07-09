import re

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace applyBLB with renderCanvas
old_apply_blb = """function applyBLB(root, blocks) {
    const map = {};
    for(const b of blocks) map[b.nid] = b;
    const q = [root];
    while(q.length > 0) {
        const n = q.shift();
        const b = map[n.id];
        if (b && n.style) {
            n.style.display = DISPLAY[b.display]||'';
            n.style.position = POSITION[b.position]||'';
            n.style.boxSizing = b.boxSizing ? 'border-box' : 'content-box';
            if (b.width !== 0xFFFF) n.style.width = (b.width/10) + 'px';
            if (b.height !== 0xFFFF) n.style.height = (b.height/10) + 'px';
            n.style.margin = `${b.mt/10}px ${b.mr/10}px ${b.mb/10}px ${b.ml/10}px`;
            n.style.padding = `${b.pt/10}px ${b.pr/10}px ${b.pb/10}px ${b.pl/10}px`;
            n.style.borderWidth = `${b.bwt/10}px ${b.bwr/10}px ${b.bwb/10}px ${b.bwl/10}px`;
            n.style.borderStyle = 'solid';
            if(b.borderColor!==0) n.style.borderColor = u32ToColor(b.borderColor);
            if(b.bgColor!==0) n.style.backgroundColor = u32ToColor(b.bgColor);
            if(b.color!==0) n.style.color = u32ToColor(b.color);
            n.style.fontSize = (b.fontSize/10) + 'px';
            n.style.fontWeight = b.fontWeight;
            if(b.lineHeight > 0) n.style.lineHeight = (b.lineHeight/10) + 'px';
            n.style.textAlign = TEXT_ALIGN[b.textAlign]||'';
            n.style.flexDirection = FLEX_DIR[b.flexDir]||'';
            n.style.flexWrap = b.flexWrap ? 'wrap' : 'nowrap';
            n.style.justifyContent = JUSTIFY[b.justifyContent]||'';
            n.style.alignItems = ALIGN_ITEMS[b.alignItems]||'';
            n.style.gap = (b.gap/10) + 'px';
            n.style.borderRadius = (b.borderRadius/10) + 'px';
            n.style.overflow = OVERFLOW[b.overflow]||'';
            n.style.opacity = b.opacity / 255;
            if(b.zIndex !== 0) n.style.zIndex = b.zIndex;
        }
        if(n.children) {
            for(let i=0; i<n.children.length; i++) q.push(n.children[i]);
        }
    }
}"""

new_render_canvas = """// --- BWEB Canvas Layout Engine (BLB-2) ---
class CanvasEngine {
    constructor(rootVNode, bdtNodes, blbBlocks) {
        this.root = rootVNode;
        this.bdt = bdtNodes;
        this.blbMap = {};
        for(const b of blbBlocks) this.blbMap[b.nid] = b.props;
        
        // Link BDT id to VDOM
        let bdtIdx = 0;
        const linkTree = (node) => {
            if(!node) return;
            node.id = bdtIdx++; // Simplified 1:1 mapping if trees match exactly
            for(const c of node.children) linkTree(c);
        };
        linkTree(this.root);
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Setup Resize Observer
        window.addEventListener('resize', () => this.draw());
    }

    mount(container) {
        container.innerHTML = '';
        container.appendChild(this.canvas);
        this.draw();
    }
    
    getVal(val, parentSize) {
        if(!val) return 0;
        if(val.u === 0) return val.v / 10; // px
        if(val.u === 1) return (val.v / 1000) * parentSize; // %
        if(val.u === 2) return (val.v / 1000) * window.innerWidth; // vw
        if(val.u === 3) return (val.v / 1000) * window.innerHeight; // vh
        return 0; // auto
    }

    draw() {
        // High-DPI canvas setup
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.parentElement.clientWidth || window.innerWidth;
        const h = this.canvas.parentElement.clientHeight || window.innerHeight;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.scale(dpr, dpr);
        
        this.ctx.clearRect(0,0,w,h);
        
        // Phase 1: Basic layout and rendering (recursive)
        // Note: For this prototype milestone, we implement absolute top-down stacking
        // Full Flexbox requires a 2-pass Measure & Layout which is next step.
        let currentY = 0;
        const renderNode = (node, x, y, parentW) => {
            if(!node || node.isText) return 0;
            const style = this.blbMap[node.id] || {};
            
            // Resolve dimensions
            const width = style[1] && style[1].u !== 4 ? this.getVal(style[1], parentW) : parentW;
            const height = style[2] && style[2].u !== 4 ? this.getVal(style[2], 0) : 0; // 0=auto
            const mt = this.getVal(style[8], parentW), mb = this.getVal(style[10], parentW);
            const pt = this.getVal(style[12], parentW), pb = this.getVal(style[14], parentW);
            
            let drawY = y + mt;
            let drawH = height;
            
            // Draw background
            if(style[17]) {
                this.ctx.fillStyle = u32ToColor(style[17]);
                // if height is auto, we need to know children height first.
                // For this prototype, we'll draw rect after children (post-order).
            }
            
            let childY = drawY + pt;
            for(const c of node.children) {
                if(c.isText) {
                    if(c.text.trim()) {
                        this.ctx.fillStyle = style[18] ? u32ToColor(style[18]) : '#000';
                        const fs = style[19] ? this.getVal(style[19], parentW) : 16;
                        this.ctx.font = `${fs}px sans-serif`;
                        this.ctx.fillText(c.text.trim(), x + this.getVal(style[15], parentW), childY + fs);
                        childY += fs + 4; // simple line height
                    }
                } else {
                    const ch = renderNode(c, x + this.getVal(style[15], parentW), childY, width - this.getVal(style[13], parentW) - this.getVal(style[15], parentW));
                    childY += ch;
                }
            }
            
            if(height === 0) drawH = childY - drawY + pb;
            
            if(style[17]) {
                this.ctx.fillStyle = u32ToColor(style[17]);
                this.ctx.fillRect(x, drawY, width, drawH);
            }
            
            return drawH + mt + mb;
        };
        
        renderNode(this.root, 0, 0, w);
    }
}
function u32ToColor(u) {
    if(!u) return 'transparent';
    const a = (u >>> 24)/255;
    const r = (u >> 16) & 255;
    const g = (u >> 8) & 255;
    const b = u & 255;
    return `rgba(${r},${g},${b},${a})`;
}
function applyBLB(root, blocks) {
    // Keep function signature to not break renderBinary yet
}
"""

if old_apply_blb in content:
    content = content.replace(old_apply_blb, new_render_canvas)
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Canvas Layout Engine prototype patched.")
else:
    print("FAILED: Old applyBLB not found.")
