import re

with open('bweb-converter/converter.html', 'r', encoding='utf-8') as f:
    text = f.read()

bdu_parser_code = """
        class BDUParser {
            constructor(buf, offset = 0) {
                this.v = new DataView(buf);
                this.o = offset;
                this.u8 = new Uint8Array(buf);
                this.decoder = new TextDecoder();
            }
            
            djb2Hash(str) {
                let hash = 5381;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) + hash) + str.charCodeAt(i);
                }
                return hash >>> 0;
            }

            getMutationsForUrl(url) {
                const targetHash = this.djb2Hash(url);
                const count = this.v.getUint32(this.o);
                const indexStart = this.o + 4;
                const blocksStart = indexStart + count * 8;
                
                for (let i = 0; i < count; i++) {
                    const h = this.v.getUint32(indexStart + i * 8);
                    if (h === targetHash) {
                        const blockOffset = blocksStart + this.v.getUint32(indexStart + i * 8 + 4);
                        return this.parseVariantBlock(blockOffset);
                    }
                }
                return null;
            }
            
            parseVariantBlock(offset) {
                let o = this.o + offset;
                const uLen = this.v.getUint16(o); o += 2;
                const url = this.decoder.decode(new Uint8Array(this.u8.buffer, this.u8.byteOffset + o, uLen));
                o += uLen;
                
                const mCount = this.v.getUint32(o); o += 4;
                const mutations = [];
                
                for (let j=0; j<mCount; j++) {
                    const nodeId = this.v.getUint16(o); o += 2;
                    const type = this.v.getUint8(o++);
                    
                    let attrId = 0, visData = 0, pNodeId = 0, sIdx = 0, dLen = 0, data = null;
                    
                    if (type === 1 || type === 4) {
                        dLen = this.v.getUint32(o); o += 4;
                        data = new Uint8Array(this.u8.buffer, this.u8.byteOffset + o, dLen);
                        o += dLen;
                    } else if (type === 2) {
                        attrId = this.v.getUint8(o++);
                        dLen = this.v.getUint32(o); o += 4;
                        data = new Uint8Array(this.u8.buffer, this.u8.byteOffset + o, dLen);
                        o += dLen;
                    } else if (type === 3) {
                        visData = this.v.getUint8(o++);
                    } else if (type === 5) {
                        pNodeId = nodeId;
                        sIdx = this.v.getUint16(o); o += 2;
                        dLen = this.v.getUint32(o); o += 4;
                        data = new Uint8Array(this.u8.buffer, this.u8.byteOffset + o, dLen);
                        o += dLen;
                    } else if (type === 6) {
                        // Remove, no extra data
                    }
                    
                    mutations.push({
                        nodeId: type === 5 ? pNodeId : nodeId, 
                        type, attrId, visData, siblingIdx: sIdx, data,
                        dataStr: data ? this.decoder.decode(data) : null
                    });
                }
                return mutations;
            }
        }

        function applyBDU(rootEl, mutations) {
            const flatNodes = [rootEl, ...Array.from(rootEl.querySelectorAll('*'))];
            
            for (const m of mutations) {
                const target = flatNodes[m.nodeId];
                if (!target && m.type !== 5) continue;
                
                if (m.type === 1) {
                    let textNode = Array.from(target.childNodes).find(n => n.nodeType === 3);
                    if (textNode) {
                        textNode.textContent = m.dataStr;
                    } else {
                        target.insertBefore(document.createTextNode(m.dataStr), target.firstChild);
                    }
                } else if (m.type === 2) {
                    if (m.attrId === 0x10) { // class
                        const classes = m.dataStr.split(' ').filter(Boolean);
                        const preserve = Array.from(target.classList).filter(c => c === 'rendered-node' || c.startsWith('bml-tag-'));
                        target.className = '';
                        target.classList.add(...preserve, ...classes);
                    }
                } else if (m.type === 3) {
                    if (m.visData === 0) {
                        target.style.display = 'none';
                    } else {
                        target.style.display = ''; // Restore original
                    }
                } else if (m.type === 4) { // Replace
                    const bmlParser = new BMLParser(m.data.buffer, m.data.byteOffset);
                    const newEl = bmlParser.parseNode();
                    target.replaceWith(newEl);
                } else if (m.type === 5) { // Insert
                    if (!target) continue;
                    const bmlParser = new BMLParser(m.data.buffer, m.data.byteOffset);
                    const newEl = bmlParser.parseNode();
                    const children = Array.from(target.children);
                    if (m.siblingIdx >= children.length) {
                        target.appendChild(newEl);
                    } else {
                        target.insertBefore(newEl, children[m.siblingIdx]);
                    }
                } else if (m.type === 6) { // Remove
                    target.remove();
                }
            }
        }
"""

text = re.sub(
    r'(function applyBEX\\(rootEl, rules\\) \\{[\\s\\S]*?\\})',
    r'\\1\\n' + bdu_parser_code,
    text
)

with open('bweb-converter/converter.html', 'w', encoding='utf-8') as f:
    f.write(text)

