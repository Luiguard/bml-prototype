import re

with open('bweb-converter/generate_polyfill.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the old BDUParser and attachRouter logic
start_idx = text.find('class BDUParser {')
end_idx = text.find('async function renderPage(', start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find polyfill boundaries")
    exit(1)

new_polyfill_logic = """class BDUParser {
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
                
                // Binary search or linear search the index
                // Actually they are just written in order, so linear search is fine
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
                let o = offset;
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

        window.domCache = {};
        window.baseDOM = null;

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

        function attachRouter(container) {
            if (container.dataset.routerAttached) return;
            container.dataset.routerAttached = "true";
            container.addEventListener('click', (e) => {
                const a = e.target.closest('a');
                if (!a) return;
                const href = a.getAttribute('href');
                if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') || href.startsWith('javascript:')) return;
                e.preventDefault();

                let targetUrl = href.split('#')[0];
                if (targetUrl === '') return;

                let currentUrl = container.dataset.currentUrl || 'index.html';

                if (!targetUrl.startsWith('/')) {
                    const baseParts = currentUrl.split('/');
                    baseParts.pop();
                    const hrefParts = targetUrl.split('/');
                    for (const part of hrefParts) {
                        if (part === '.') continue;
                        if (part === '..') {
                            if (baseParts.length > 0) baseParts.pop();
                        } else {
                            baseParts.push(part);
                        }
                    }
                    targetUrl = baseParts.join('/');
                } else {
                    targetUrl = targetUrl.substring(1);
                }
                
                const origUrl = href;
                let fullTarget = targetUrl;
                if (origUrl.includes('?') && !targetUrl.includes('?')) {
                    fullTarget = targetUrl + '?' + origUrl.split('?').slice(1).join('?');
                } else if (targetUrl.includes('?')) {
                    fullTarget = targetUrl;
                }
                
                if (fullTarget.endsWith('/')) fullTarget = fullTarget.substring(0, fullTarget.length - 1);
                if (fullTarget === '') fullTarget = 'index.html';

                let bduMutations = null;
                if (globalSections[0x0A]) {
                    const bduParser = new BDUParser(globalSections[0x0A][0]);
                    bduMutations = bduParser.getMutationsForUrl(fullTarget) || bduParser.getMutationsForUrl(origUrl);
                }

                if (bduMutations) {
                    window.history.pushState({url: fullTarget}, "", fullTarget);
                    const targetEl = document.getElementById('renderTarget');
                    
                    if (window.domCache[fullTarget]) {
                        targetEl.replaceChildren(window.domCache[fullTarget]);
                    } else {
                        const newDom = window.baseDOM.cloneNode(true);
                        applyBDU(newDom, bduMutations);
                        window.domCache[fullTarget] = newDom;
                        targetEl.replaceChildren(newDom);
                    }
                    targetEl.dataset.currentUrl = fullTarget;
                } else if (pagesMap[targetUrl.split('?')[0]]) {
                    renderPage(targetUrl.split('?')[0], true);
                } else if (pagesMap[fullTarget]) {
                    renderPage(fullTarget, true);
                } else {
                    console.error('Page not found in BWEB:', fullTarget);
                    alert('Seite nicht im BWEB Container gefunden: ' + fullTarget);
                }
            });
        }

        """

text_before = text[:start_idx]
text_after = text[end_idx:]

with open('bweb-converter/generate_polyfill.js', 'w', encoding='utf-8') as f:
    f.write(text_before + new_polyfill_logic + text_after)
