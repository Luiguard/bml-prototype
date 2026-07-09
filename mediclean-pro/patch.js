    measureNode(node, parentW) {
        if(!node) return;
        const s = node.isText ? (this.blbMap[node.parent?.id] || {}) : (this.blbMap[node.id] || {});
        if(!node.isText && s[5] === 4) { node.layout.w=0; node.layout.h=0; return; }
        
        node.layout.mt = this.getVal(s[8], parentW);
        node.layout.mr = this.getVal(s[9], parentW);
        node.layout.mb = this.getVal(s[10], parentW);
        node.layout.ml = this.getVal(s[11], parentW);
        
        node.layout.pt = this.getVal(s[12], parentW);
        node.layout.pr = this.getVal(s[13], parentW);
        node.layout.pb = this.getVal(s[14], parentW);
        node.layout.pl = this.getVal(s[15], parentW);
        
        node.layout.position = s[6] || 0;

        if (s[48] && s[48].u !== 4) node.layout.w = this.getVal(s[48], 0);
        if (s[49] && s[49].u !== 4) node.layout.h = this.getVal(s[49], 0);

        if (node.isText) {
            const text = node.text.trim();
            if(!text) { node.layout.w = 0; node.layout.h = 0; return; }
            if(!node.layout.w || !node.layout.h) {
                const fs = s[19] && s[19].u !== 4 ? this.getVal(s[19], parentW) : 16;
                const fw = s[21] ? s[21] : 400;
                const ff = s[33] ? s[33] : 'sans-serif';
                this.ctx.font = `${fw} ${fs}px ${ff}`;
                const tm = this.ctx.measureText(text);
                node.layout.w = tm.width;
                node.layout.h = fs * 1.2;
            }
        }
        
        node.layout.innerW = Math.max(0, node.layout.w - node.layout.pl - node.layout.pr);
        node.layout.innerH = Math.max(0, node.layout.h - node.layout.pt - node.layout.pb);

        for(let i=0; i<node.children.length; i++) {
            this.measureNode(node.children[i], node.layout.innerW);
        }
    }
