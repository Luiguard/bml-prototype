        class BEXParser {
            constructor(buf, offset = 0) {
                this.v = new DataView(buf);
                this.o = offset;
                this.u8 = new Uint8Array(buf);
            }
            parse() {
                const count = this.v.getUint32(this.o); this.o += 4;
                const rules = [];
                const decoder = new TextDecoder();
                for(let i=0; i<count; i++) {
                    const triggerNode = this.v.getUint32(this.o); this.o += 4;
                    const eventType = this.v.getUint8(this.o++);
                    const actionType = this.v.getUint8(this.o++);
                    const targetNode = this.v.getUint32(this.o); this.o += 4;
                    const strLen = this.v.getUint16(this.o); this.o += 2;
                    const paramStr = decoder.decode(this.u8.slice(this.o, this.o + strLen));
                    this.o += strLen;
                    rules.push({triggerNode, eventType, actionType, targetNode, paramStr});
                }
                return rules;
            }
        }

        async function applyBEX(rootEl, rules) {
            rules.forEach(rule => {
                const triggerEl = rootEl.querySelector(`[data-node-id="${rule.triggerNode}"]`);
                if(!triggerEl) return;
                
                triggerEl.addEventListener('click', () => {
                    if(rule.actionType === 0x01) { // Toggle Class
                        const target = rule.targetNode === 0xFFFFFFFF ? triggerEl : rootEl.querySelector(`[data-node-id="${rule.targetNode}"]`);
                        if(target) target.classList.toggle(rule.paramStr);
                    } else if(rule.actionType === 0x02) { // Add Class
                        const target = rule.targetNode === 0xFFFFFFFF ? triggerEl : rootEl.querySelector(`[data-node-id="${rule.targetNode}"]`);
                        if(target) target.classList.add(rule.paramStr);
                    }
                });
            });
        }
