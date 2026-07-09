import re

with open('/home/benjamin/projects/mediclean-pro/bweb-converter/converter.html', 'r', encoding='utf-8') as f:
    conv = f.read()

with open('/home/benjamin/projects/mediclean-pro/bweb-converter/polyfill.html', 'r', encoding='utf-8') as f:
    poly = f.read()

# Extract the parser block from converter.html (from const DANGEROUS_TAGS down to end of function parseBPG)
parser_match = re.search(r'(const DANGEROUS_TAGS.*?} // end parseBPG)', conv, re.DOTALL)
if not parser_match:
    # let's try a different boundary
    parser_match = re.search(r'(const DANGEROUS_TAGS = new Set.*?function parseBPG.*?return \{ url, sections: innerSections \};\n        })', conv, re.DOTALL)

parsers = parser_match.group(1)

# Extract the applyBEX, applyBIB, applyBVS, applyBAS, applyBDT, applyBLB functions
apply_match = re.search(r'(async function applyBDT.*?async function applyBAS.*?})', conv, re.DOTALL)
applies = apply_match.group(1)

# We want to replace everything in polyfill.html inside the (async () => { ... }) block
poly_top = poly.split('const DANGEROUS_TAGS')[0]

poly_script = f"""
        {parsers}

        {applies}

        let globalSections = null;
        let pagesMap = {{}};
        let bpgBlocks = [];

        async function renderPage(url, pushState = true) {{
            const pageData = pagesMap[url];
            if (!pageData) {{
                console.error("Page not found:", url);
                return;
            }}
            
            if (pushState) {{
                window.history.pushState({{url}}, "", url === 'index.html' ? window.location.pathname : url);
            }}

            const sections = pageData.sections;
            const bmlBuf = sections[1];
            const bdtBuf = sections[2];
            const blbBuf = sections[3];
            const bexBuf = sections[7];

            let rootEl = null;

            if(bmlBuf){{
                const bmlView=new Uint8Array(bmlBuf);
                let bmlStart=0;
                if(bmlView[0]===0x42&&bmlView[1]===0x4D&&bmlView[2]===0x4C)bmlStart=4;
                const parser=new BMLParser(bmlBuf,bmlStart);
                rootEl=parser.parseNode();
            }}

            if(bdtBuf&&rootEl){{
                const bdtView=new Uint8Array(bdtBuf);
                let bdtStart=0;
                if(bdtView[0]===0x42&&bdtView[1]===0x44&&bdtView[2]===0x54)bdtStart=4;
                const bdtNodes=new BDTParser(bdtBuf,bdtStart).parse();
                const elements=await applyBDT(rootEl,bdtNodes);

                if(blbBuf){{
                    const blbView=new Uint8Array(blbBuf);
                    let blbStart=0;
                    if(blbView[0]===0x42&&blbView[1]===0x4C&&blbView[2]===0x42)blbStart=4;
                    const blbBlocks=new BLBParser(blbBuf,blbStart).parse();
                    await applyBLB(elements,blbBlocks);
                }}
            }}

            if(rootEl&&bexBuf){{
                const bexView=new Uint8Array(bexBuf);
                let bexStart=0;
                if(bexView[0]===0x42&&bexView[1]===0x45&&bexView[2]===0x58)bexStart=4;
                const rules=new BEXParser(bexBuf,bexStart).parse();
                await applyBEX(rootEl,rules);
            }}

            if(rootEl&&globalSections[4]){{
                const bibBuf=globalSections[4];
                const bibView=new Uint8Array(bibBuf);
                let bibStart=0;
                if(bibView[0]===0x42&&bibView[1]===0x49&&bibView[2]===0x42)bibStart=4;
                const imgs=new BIBParser(bibBuf,bibStart).parse();
                await applyBIB(rootEl,imgs);
            }}

            if(rootEl&&globalSections[5]){{
                const bvsBuf=globalSections[5];
                const bvsView=new Uint8Array(bvsBuf);
                let bvsStart=0;
                if(bvsView[0]===0x42&&bvsView[1]===0x56&&bvsView[2]===0x53)bvsStart=4;
                const videos=new BVSParser(bvsBuf,bvsStart).parse();
                await applyBVS(rootEl,videos);
            }}

            if(rootEl&&globalSections[6]){{
                const basBuf=globalSections[6];
                const basView=new Uint8Array(basBuf);
                let basStart=0;
                if(basView[0]===0x42&&basView[1]===0x41&&basView[2]===0x53)basStart=4;
                const audios=new BASParser(basBuf,basStart).parse();
                await applyBAS(rootEl,audios);
            }}

            const target=document.getElementById('renderTarget');
            target.innerHTML='';
            if(rootEl){{
                target.appendChild(rootEl);
            }}
        }}

        try {{
            const fetchUrl = `${{window.location.protocol}}//${{window.location.host}}/${{fileParam}}${{fileParam.includes('?') ? '&' : '?'}}raw=true`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(`HTTP Fehler ${{response.status}}`);
            const buffer = await response.arrayBuffer();

            globalSections = parseBWEB(buffer);
            
            if (globalSections[8] && globalSections[8].length > 0) {{
                globalSections[8].forEach(bpgBuf => {{
                    const page = parseBPG(bpgBuf);
                    pagesMap[page.url] = page;
                }});
            }} else {{
                // Fallback for single-page BWEB files without BPG sections
                pagesMap['index.html'] = {{ url: 'index.html', sections: globalSections }};
            }}

            window.addEventListener('popstate', (e) => {{
                if (e.state && e.state.url) {{
                    renderPage(e.state.url, false);
                }} else {{
                    renderPage('index.html', false);
                }}
            }});

            const initialUrl = window.location.pathname.split('/').pop() || 'index.html';
            renderPage(pagesMap[initialUrl] ? initialUrl : 'index.html', false);

        }} catch(e) {{
            console.error("BWEB Polyfill Engine Error:", e);
            const target=document.getElementById('renderTarget');
            target.innerHTML='';
            const errBox=document.createElement('div');
            errBox.setAttribute('style','padding: 2rem; max-width: 600px; margin: 40px auto; background: #1e1b4b; border: 1px solid #312e81; border-radius: 8px; text-align: center;');
            const h=document.createElement('h2');h.setAttribute('style','color: #ef4444; margin-top: 0;');h.textContent='BWEB Polyfill Ladefehler';errBox.appendChild(h);
            const p1=document.createElement('p');p1.setAttribute('style','color: #cbd5e1; line-height: 1.6;');p1.textContent='Die JS-Polyfill-Engine konnte die Binärdatei nicht laden oder decodieren.';errBox.appendChild(p1);
            const p2=document.createElement('p');p2.setAttribute('style','color: #94a3b8; font-size: 0.85rem;');p2.textContent='Details: '+(e instanceof Error?e.message:'Unbekannter Fehler');errBox.appendChild(p2);
            target.appendChild(errBox);
        }}
    }})();
    </script>
</body>
</html>
"""

with open('/home/benjamin/projects/mediclean-pro/bweb-converter/polyfill.html', 'w', encoding='utf-8') as f:
    f.write(poly_top + poly_script)

