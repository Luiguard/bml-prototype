import re

with open('bweb-converter/generate_polyfill.js', 'r', encoding='utf-8') as f:
    text = f.read()

bdu_parser = """
        class BDUParser {
            constructor(buf, offset = 0) {
                this.v = new DataView(buf);
                this.o = offset;
                this.u8 = new Uint8Array(buf);
                this.decoder = new TextDecoder();
            }
            parse() {
                const map = {};
                const count = this.v.getUint32(this.o); this.o += 4;
                for (let i=0; i<count; i++) {
                    const uLen = this.v.getUint16(this.o); this.o += 2;
                    const url = this.decoder.decode(new Uint8Array(this.u8.buffer, this.o, uLen));
                    this.o += uLen;
                    
                    const mCount = this.v.getUint32(this.o); this.o += 4;
                    const mutations = [];
                    for (let j=0; j<mCount; j++) {
                        const nodeId = this.v.getUint16(this.o); this.o += 2;
                        const type = this.v.getUint8(this.o++);
                        let attrId = 0, dLen = 0;
                        if (type === 1) {
                            dLen = this.v.getUint32(this.o); this.o += 4;
                        } else {
                            attrId = this.v.getUint8(this.o++);
                            dLen = this.v.getUint32(this.o); this.o += 4;
                        }
                        const data = new Uint8Array(this.u8.buffer, this.o, dLen);
                        this.o += dLen;
                        mutations.push({nodeId, type, attrId, data, dataStr: this.decoder.decode(data)});
                    }
                    map[url] = mutations;
                }
                return map;
            }
        }

        function applyBDU(rootEl, mutations) {
            // Flat nodes map would be best. In BMLParser we didn't store flat nodes...
            // Wait, we need to find elements by nodeIdx!
            // Let's use `document.querySelectorAll('.rendered-node')` ? 
            // In BMLParser, we can add a data-bdt-id attribute to quickly find them!
            // For now, let's just traverse the tree.
            
            // Wait, BDT stores the tree. BDU refers to flatNodes index (which matches BML parsing order).
            // BMLParser traverses pre-order depth-first. 
            // document.querySelectorAll('*') also returns elements in pre-order depth-first!
            const allElements = rootEl.querySelectorAll('*');
            // Element 0 is the wrapDiv (rootEl), then its children. 
            // Let's create an array including rootEl:
            const flatNodes = [rootEl, ...Array.from(allElements)];
            
            for (const m of mutations) {
                const target = flatNodes[m.nodeId];
                if (!target) continue;
                if (m.type === 1) {
                    // Update Text
                    // We must find the text node or create one.
                    // Simple approach: if it has child text nodes, update the first one. Otherwise create it.
                    // Wait, we can just replace textContent, but what if it has child elements?
                    // Text replacement in my compilation logic was just `t=cn.textContent`. If we set `textContent`, we wipe child elements!
                    // In serNode, we only serialized the text of direct child text nodes.
                    // Better: find existing text node and update it, or prepend a new text node.
                    let textNode = Array.from(target.childNodes).find(n => n.nodeType === 3);
                    if (textNode) {
                        textNode.textContent = m.dataStr;
                    } else {
                        target.insertBefore(document.createTextNode(m.dataStr), target.firstChild);
                    }
                } else if (m.type === 2) {
                    // Update Attribute
                    // Specifically class
                    if (m.attrId === 0x10) { // class
                        const classes = m.dataStr.split(' ').filter(Boolean);
                        // preserve 'rendered-node' and 'bml-tag-*'
                        const preserve = Array.from(target.classList).filter(c => c === 'rendered-node' || c.startsWith('bml-tag-'));
                        target.className = '';
                        target.classList.add(...preserve, ...classes);
                    }
                }
            }
        }
"""

text = re.sub(
    r'class BEXParser \{',
    bdu_parser + '\\n        class BEXParser {',
    text
)

router_logic = """
            if (sections[0x0A] && sections[0x0A].length > 0) {
                window.bduVariants = new BDUParser(sections[0x0A][0]).parse();
            } else {
                window.bduVariants = {};
            }

            if (sections[8] && sections[8].length > 0) {
"""

text = re.sub(
    r'if \\(sections\\[8\\] && sections\\[8\\]\\.length > 0\\) \\{',
    router_logic,
    text
)

# Replace attachRouter to handle BDUs
new_attach_router = """
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
                
                // Keep query params intact for targetUrl, as BDU relies on them!
                const origUrl = href;
                let fullTarget = targetUrl;
                if (origUrl.includes('?') && !targetUrl.includes('?')) {
                    fullTarget = targetUrl + '?' + origUrl.split('?').slice(1).join('?');
                } else if (targetUrl.includes('?')) {
                    fullTarget = targetUrl;
                }
                
                if (fullTarget.endsWith('/')) fullTarget = fullTarget.substring(0, fullTarget.length - 1);
                if (fullTarget === '') fullTarget = 'index.html';

                if (window.bduVariants && window.bduVariants[fullTarget]) {
                    // It's a BDU Delta Update!
                    // First reset DOM to base index.html
                    renderPage('index.html', false).then(() => {
                        window.history.pushState({url: fullTarget}, "", fullTarget);
                        const rootEl = document.getElementById('renderTarget').firstChild;
                        applyBDU(rootEl, window.bduVariants[fullTarget]);
                        document.getElementById('renderTarget').dataset.currentUrl = fullTarget;
                    });
                } else if (window.bduVariants && window.bduVariants[origUrl]) {
                    renderPage('index.html', false).then(() => {
                        window.history.pushState({url: origUrl}, "", origUrl);
                        const rootEl = document.getElementById('renderTarget').firstChild;
                        applyBDU(rootEl, window.bduVariants[origUrl]);
                        document.getElementById('renderTarget').dataset.currentUrl = origUrl;
                    });
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

# Replace the old attachRouter block
text = re.sub(
    r'function attachRouter\\(container\\) \\{[\\s\\S]*?async function renderPage',
    new_attach_router.strip() + '\\n\\n        async function renderPage',
    text
)

with open('bweb-converter/generate_polyfill.js', 'w', encoding='utf-8') as f:
    f.write(text)

