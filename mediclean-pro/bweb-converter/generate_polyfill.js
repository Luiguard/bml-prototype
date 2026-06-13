const fs = require('fs');

const conv = fs.readFileSync('converter.html', 'utf-8');
const poly = fs.readFileSync('polyfill.html', 'utf-8');

// Extract all parsers from converter.html
const DANGEROUS_TAGS_INDEX = conv.indexOf('const TAG_REV');
const APPLY_END = conv.indexOf('function renderBDTTree', DANGEROUS_TAGS_INDEX);

if (DANGEROUS_TAGS_INDEX === -1 || APPLY_END === -1) {
    console.error("Could not find start or end of parsers block");
    process.exit(1);
}

const parsersAndApplies = conv.substring(DANGEROUS_TAGS_INDEX, APPLY_END);

const newScript = `
    <script>
    (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const fileParam = urlParams.get('file');
        if (!fileParam || !/^[a-zA-Z0-9_\\-\\/\.]+\\.(bweb|bml|bdt|blb|bib)$/.test(fileParam) || fileParam.includes('..')) {
            document.getElementById('renderTarget').innerHTML = '<div style="padding:2rem;text-align:center">Ung\u00fcltige BWEB-Datei angegeben.</div>';
            return;
        }

        ${parsersAndApplies}

        let pagesMap = {};
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

        try {
            const fetchUrl = \`\${window.location.protocol}//\${window.location.host}/\${fileParam}\${fileParam.includes('?') ? '&' : '?'}raw=true\`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(\`HTTP Fehler \${response.status}\`);
            const buffer = await response.arrayBuffer();
            await loadBWEB(buffer);
        } catch(e) {
            console.error("BWEB Polyfill Engine Error:", e);
            const target=document.getElementById('renderTarget');
            target.innerHTML='';
            const errBox=document.createElement('div');
            errBox.setAttribute('style','padding: 2rem; max-width: 600px; margin: 40px auto; background: #1e1b4b; border: 1px solid #312e81; border-radius: 8px; text-align: center;');
            const h=document.createElement('h2');h.setAttribute('style','color: #ef4444; margin-top: 0;');h.textContent='BWEB Polyfill Ladefehler';errBox.appendChild(h);
            const p1=document.createElement('p');p1.setAttribute('style','color: #cbd5e1; line-height: 1.6;');p1.textContent='Die JS-Polyfill-Engine konnte die Bin\u00e4rdatei nicht laden oder decodieren.';errBox.appendChild(p1);
            const p2=document.createElement('p');p2.setAttribute('style','color: #94a3b8; font-size: 0.85rem;');p2.textContent='Details: '+(e instanceof Error?e.message:'Unbekannter Fehler');errBox.appendChild(p2);
            target.appendChild(errBox);
        }
    })();
    </script>
`;

const SCRIPT_START = poly.indexOf('<script>');
const SCRIPT_END = poly.indexOf('</script>') + 9;

if (SCRIPT_START === -1 || SCRIPT_END < 9) {
    console.error("Could not find <script> tags in polyfill.html");
    process.exit(1);
}

const newPoly = poly.substring(0, SCRIPT_START) + newScript + poly.substring(SCRIPT_END);

fs.writeFileSync('polyfill.html', newPoly);
console.log("Polyfill updated successfully.");
