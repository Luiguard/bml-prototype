class BEXParser {
    constructor(buf, offset = 0) {
        this.v = new DataView(buf);
        this.d = new TextDecoder('utf-8');
        this.o = offset;
    }
    parse() {
        if (this.o + 4 > this.v.byteLength) return [];
        const count = this.v.getUint32(this.o); this.o += 4;
        const rules = [];
        for (let i = 0; i < count; i++) {
            if (this.o + 14 > this.v.byteLength) break;
            const triggerNode = this.v.getUint32(this.o); this.o += 4;
            const eventType = this.v.getUint8(this.o++);
            const actionType = this.v.getUint8(this.o++);
            const targetNode = this.v.getUint32(this.o); this.o += 4;
            const paramLen = this.v.getUint16(this.o); this.o += 2;
            
            if (this.o + paramLen > this.v.byteLength) break;
            const paramStr = this.d.decode(new Uint8Array(this.v.buffer, this.o, paramLen));
            this.o += paramLen;
            
            rules.push({ triggerNode, eventType, actionType, targetNode, paramStr });
        }
        return rules;
    }
}

async function applyBEX(elements, rules) {
    const root = document.documentElement;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const action = entry.target._bexIntersectAction;
                if(action) executeBEXAction(action, elements, root);
            }
        });
    }, { threshold: 0.1 });

    for (const rule of rules) {
        const triggerEl = elements[rule.triggerNode];
        if (!triggerEl) continue;

        if (rule.eventType === 0x01) { // Click
            triggerEl.addEventListener('click', () => executeBEXAction(rule, elements, root));
        } else if (rule.eventType === 0x03) { // Scroll Intersect (Reveal)
            triggerEl._bexIntersectAction = rule;
            observer.observe(triggerEl);
        }
    }
}

function executeBEXAction(rule, elements, root) {
    const targetEl = rule.targetNode === 0xFFFFFFFF ? root : elements[rule.targetNode];
    if (!targetEl) return;
    
    switch (rule.actionType) {
        case 0x01: targetEl.classList.toggle(rule.paramStr); break;
        case 0x02: targetEl.classList.add(rule.paramStr); break;
        case 0x03: targetEl.classList.remove(rule.paramStr); break;
        case 0x04: 
            const [k, v] = rule.paramStr.split(':');
            if (k && v) targetEl.style[k.trim()] = v.trim();
            break;
    }
}
