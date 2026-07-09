import re

with open('bweb-converter/generate_polyfill.js', 'r', encoding='utf-8') as f:
    text = f.read()

# I will replace the portion from `let pagesMap = {};` to the end of the script template.
start_idx = text.find('let pagesMap = {};')
end_idx = text.find('try {', start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find polyfill script boundaries")
    exit(1)

new_script = """let pagesMap = {};
        window.domCache = {};
        window.baseDOM = null;

        async function loadBWEB(buf) {
            const sections = parseBWEB(buf);
            globalSections = sections;
            
            if (sections[9] && sections[9].length > 0) {
                window.BWEB_THEMES = new BTBParser(sections[9][0]).parse();
                if (Object.keys(window.BWEB_THEMES).length > 0) {
                    window.CURRENT_THEME = Object.keys(window.BWEB_THEMES)[0];
                    document.documentElement.setAttribute('data-theme', window.CURRENT_THEME);
                    const vars = window.BWEB_THEMES[window.CURRENT_THEME] || {};
                    for (const [k, v] of Object.entries(vars)) {
                        document.documentElement.style.setProperty(k, v);
                    }
                }
            }

            if (sections[8] && sections[8].length > 0) {
                sections[8].forEach(bpgBuf => {
                    const page = parseBPG(bpgBuf);
                    pagesMap[page.url] = page;
                });
            } else {
                pagesMap['index.html'] = { url: 'index.html', sections: sections };
            }

            window.addEventListener('popstate', (e) => {
                if (e.state && e.state.url) {
                    navigate(e.state.url, false);
                } else {
                    navigate('index.html', false);
                }
            });

            const initialUrl = window.location.pathname.split('/').pop() || 'index.html';
            let currentUrl = initialUrl;
            navigate(currentUrl, false);
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

                navigate(fullTarget, true, origUrl);
            });
        }

        async function navigate(fullTarget, pushState = true, origUrl = '') {
            let bduMutations = null;
            if (globalSections[0x0A]) {
                const bduParser = new BDUParser(globalSections[0x0A][0]);
                bduMutations = bduParser.getMutationsForUrl(fullTarget) || bduParser.getMutationsForUrl(origUrl);
            }

            if (bduMutations) {
                if (!window.baseDOM) {
                    await renderPage('index.html', false);
                }
                if (pushState) window.history.pushState({url: fullTarget}, "", fullTarget);
                
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
                attachRouter(targetEl.firstChild);
            } else if (pagesMap[fullTarget.split('?')[0]]) {
                await renderPage(fullTarget.split('?')[0], pushState);
            } else if (pagesMap[fullTarget]) {
                await renderPage(fullTarget, pushState);
            } else {
                console.error('Page not found in BWEB:', fullTarget);
                alert('Seite nicht im BWEB Container gefunden: ' + fullTarget);
            }
        }

        async function renderPage(url, pushState = true) {
            const pageData = pagesMap[url];
            if (!pageData) {
                console.error("Page not found:", url);
                return;
            }
            if (pushState) {
                window.history.pushState({url}, "", url === 'index.html' ? window.location.pathname : url);
            }
            const sections = pageData.sections;
            
            let bmlBuf = sections[1];
            let bdtBuf = sections[2];
            let blbBuf = sections[3];
            let bexBuf = sections[7];

            let rootEl = null, blbBlocks = null, bdtNodes = null;

            if (bmlBuf) {
                const bmlView = new Uint8Array(bmlBuf);
                let bmlStart = 0;
                if (bmlView[0] === 0x42 && bmlView[1] === 0x4D && bmlView[2] === 0x4C) bmlStart = 4;
                const parser = new BMLParser(bmlBuf, bmlStart);
                rootEl = parser.parseNode();
            }

            if (bdtBuf) {
                const bdtView = new Uint8Array(bdtBuf);
                let bdtStart = 0;
                if (bdtView[0] === 0x42 && bdtView[1] === 0x44 && bdtView[2] === 0x54) bdtStart = 4;
                bdtNodes = new BDTParser(bdtBuf, bdtStart).parse();
            }

            if (blbBuf && rootEl) {
                const blbView = new Uint8Array(blbBuf);
                let blbStart = 0;
                if (blbView[0] === 0x42 && blbView[1] === 0x4C && blbView[2] === 0x42) blbStart = 4;
                blbBlocks = new BLBParser(blbBuf, blbStart).parse();
                applyBLB(rootEl, blbBlocks);
            }

            if (bexBuf && rootEl) {
                const bexView = new Uint8Array(bexBuf);
                let bexStart = 0;
                if (bexView[0] === 0x42 && bexView[1] === 0x45 && bexView[2] === 0x58) bexStart = 4;
                const rules = new BEXParser(bexBuf, bexStart).parse();
                applyBEX(rootEl, rules);
            }

            if (globalSections[4] && rootEl) {
                const imgs = new BIBParser(globalSections[4][0] || globalSections[4]).parse();
                applyBIB(rootEl, imgs);
            }

            if (rootEl) {
                const vp = document.getElementById('renderTarget');
                vp.replaceChildren(rootEl);
                vp.dataset.currentUrl = url;
                attachRouter(vp);
                
                if (url === 'index.html' && !window.baseDOM) {
                    window.baseDOM = rootEl.cloneNode(true);
                    window.domCache['index.html'] = window.baseDOM;
                }
            }
        }

        """

with open('bweb-converter/generate_polyfill.js', 'w', encoding='utf-8') as f:
    f.write(text[:start_idx] + new_script + text[end_idx:])
