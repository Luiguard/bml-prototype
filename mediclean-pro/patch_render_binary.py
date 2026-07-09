import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

start_str = "function parseBWEB(buf){"
end_str = "// Progress Bar & Overlay Helper Functions"

parts = content.split(start_str)
if len(parts) < 2:
    print("FAILED: parseBWEB not found")
    sys.exit(1)

pre_parse = parts[0]
post_parts = parts[1].split(end_str)
post_parse = end_str + end_str.join(post_parts[1:])

new_logic = """function parseBWEB(buf){
    const u8=new Uint8Array(buf);
    const magic=String.fromCharCode(u8[0],u8[1],u8[2],u8[3]);
    if(magic==='BWEB'){
        const version=u8[4],secCount=u8[5];
        let off=6;
        const sections={ vfs: [] };
        let currentVfs = null;

        for(let i=0;i<secCount;i++){
            if(off>=u8.length) break;
            const secType=u8[off++];
            const secLen=new DataView(buf).getUint32(off);off+=4;
            const chunk = buf.slice(off,off+secLen);
            off+=secLen;

            if (secType === 9) { // TOC
                sections[9] = chunk;
            } else if (secType === 1) {
                currentVfs = { bml: chunk };
            } else if (secType === 2 && currentVfs) {
                currentVfs.bdt = chunk;
            } else if (secType === 7 && currentVfs) {
                currentVfs.blb = chunk;
                sections.vfs.push(currentVfs);
                currentVfs = null;
            } else {
                if(!sections[secType]) sections[secType] = [];
                sections[secType].push(chunk);
            }
        }
        return sections;
    }
    if(u8[0]===0x42&&u8[1]===0x4D&&u8[2]===0x4C) return{1:[buf], vfs:[{bml:buf}]};
    return{1:[buf], vfs:[{bml:buf}]};
}

let currentVFSMap = {};
let globalEngine = null;
let currentBMLRoot = null;

function findBMLElementForNode(id, el) {
    if(!el) return null;
    // Simple BFS/DFS map if IDs align. Actually flatNodes indices are mapped to id.
    // In our parser, BML elements aren't given flatNode IDs explicitly.
    // But we know BDT nodes were built in exact DFS order of BML elements!
    // So we can flatten BML elements and index by id.
    const flatBML = [];
    const flatten = (n) => {
        if(n.type === 'text') return;
        flatBML.push(n);
        for(const c of n.children) flatten(c);
    };
    flatten(el);
    return flatBML[id] || null;
}

async function loadPage(path) {
    if (!currentVFSMap[path]) {
        console.warn("VFS: Page not found:", path);
        // Fallback to first page if not found
        path = Object.keys(currentVFSMap)[0];
        if(!path) return;
    }
    
    const vfsData = window.bwebVFS[currentVFSMap[path].index];
    if (!vfsData) return;

    window.history.pushState({path}, "", path);
    updateLoader(100, "VFS Routing", `Lade Seite: ${path}`);

    // 1. Parse BML
    let bmlStart=0;
    const bmlView=new Uint8Array(vfsData.bml);
    if(bmlView[0]===0x42&&bmlView[1]===0x4D&&bmlView[2]===0x4C)bmlStart=4;
    const parser=new BMLParser(vfsData.bml, bmlStart);
    currentBMLRoot = parser.parse();

    // 2. Parse BDT
    let bdtNodes = null;
    if(vfsData.bdt){
        bdtNodes = parseBDT(vfsData.bdt);
        renderBDTTree(bdtNodes);
    }

    // 3. Parse BLB
    let blbBlocks = null;
    if(vfsData.blb){
        blbBlocks = parseBLB(vfsData.blb);
    }

    // 4. Update Engine
    const canvasContainer = document.getElementById('renderTarget');
    if (!globalEngine) {
        globalEngine = new CanvasEngine();
        globalEngine.mount(canvasContainer);
        
        // --- VFS Router Hit-Testing ---
        globalEngine.canvas.addEventListener('click', (e) => {
            const rect = globalEngine.canvas.getBoundingClientRect();
            const scaleX = globalEngine.canvas.width / rect.width;
            const scaleY = globalEngine.canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            // Native scrolling means e.clientY is relative to the canvas's visible top,
            // but the canvas itself is very tall.
            // Wait, rect.top already accounts for scroll! So e.clientY - rect.top is the exact Y position inside the canvas, even if scrolled!
            const cy = (e.clientY - rect.top) * scaleY;
            
            const hitNode = globalEngine.hitTest(cx, cy);
            if (hitNode) {
                const el = findBMLElementForNode(hitNode.id, currentBMLRoot);
                if (el && el.attributes) {
                    const hrefAttr = el.attributes.find(a => a.id === 18 || a.id === ATTR_FWD['href']); 
                    if (hrefAttr) {
                        const hrefStr = new TextDecoder().decode(hrefAttr.val);
                        let newPath = hrefStr;
                        if (!newPath.startsWith('/')) {
                            const parts = window.location.pathname.split('/');
                            parts.pop();
                            parts.push(newPath);
                            newPath = parts.join('/');
                            newPath = newPath.replace(/\\/\\//g, '/');
                        }
                        newPath = newPath.split('?')[0].split('#')[0];
                        if(!newPath.startsWith('/')) newPath = '/' + newPath;
                        if (currentVFSMap[newPath]) {
                            showLoader("VFS Router", "Navigiere...");
                            setTimeout(() => loadPage(newPath), 50);
                        }
                    }
                }
            }
        });

        globalEngine.canvas.addEventListener('mousemove', (e) => {
            const rect = globalEngine.canvas.getBoundingClientRect();
            const scaleX = globalEngine.canvas.width / rect.width;
            const scaleY = globalEngine.canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;
            
            const hitNode = globalEngine.hitTest(cx, cy);
            let isInteractive = false;
            if (hitNode) {
                const el = findBMLElementForNode(hitNode.id, currentBMLRoot);
                if (el && el.attributes) {
                    if (el.attributes.find(a => a.id === 18 || a.id === ATTR_FWD['href'])) isInteractive = true;
                }
            }
            globalEngine.canvas.style.cursor = isInteractive ? 'pointer' : 'default';
        });
    }

    if(bdtNodes && blbBlocks) {
        globalEngine.update(bdtNodes[0], bdtNodes, blbBlocks);
    }
    
    setTimeout(() => hideLoader(), 200);
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.path) loadPage(e.state.path);
});

async function renderBinary(buf){
    const t0=performance.now();
    const sections=parseBWEB(buf);
    
    window.bwebVFS = sections.vfs || [];
    currentVFSMap = {};

    if (sections[9]) {
        const tocView = new Uint8Array(sections[9]);
        if (tocView[0]===0x56 && tocView[1]===0x46 && tocView[2]===0x53 && tocView[3]===0x01) {
            const tocBytes = tocView.slice(4);
            const tocStr = new TextDecoder().decode(tocBytes);
            try { currentVFSMap = JSON.parse(tocStr); } catch(e){}
        }
    }

    let startPage = '/index.html';
    if (!currentVFSMap[startPage] && Object.keys(currentVFSMap).length > 0) {
        startPage = Object.keys(currentVFSMap)[0];
    }
    
    // If no TOC, fake one for the single page
    if(Object.keys(currentVFSMap).length === 0 && window.bwebVFS.length > 0) {
        currentVFSMap['/index.html'] = { index: 0 };
    }

    await loadPage(startPage);

    // Update Stats
    document.getElementById('statsGrid').style.display = 'grid';
    document.getElementById('statTotal').textContent = (buf.byteLength/1024).toFixed(1) + ' KB';
    document.getElementById('statTime').textContent = (performance.now()-t0).toFixed(1) + ' ms';
    if(window.bwebVFS.length > 0) {
        document.getElementById('statBml').textContent = (window.bwebVFS[0].bml.byteLength/1024).toFixed(1) + ' KB';
        document.getElementById('statBdt').textContent = window.bwebVFS[0].bdt ? (window.bwebVFS[0].bdt.byteLength/1024).toFixed(1) + ' KB' : '-';
        document.getElementById('statBlb').textContent = window.bwebVFS[0].blb ? (window.bwebVFS[0].blb.byteLength/1024).toFixed(1) + ' KB' : '-';
    }
    document.getElementById('sectionMap').style.display = 'block';
    const sbar=document.getElementById('sectionBar');
    sbar.innerHTML='';
    const total=buf.byteLength;
    if(sections[1]) sections[1].forEach(s => sbar.innerHTML+=`<div class="sec-bml" style="width:${(s.byteLength/total)*100}%"></div>`);
    if(sections[2]) sections[2].forEach(s => sbar.innerHTML+=`<div class="sec-bdt" style="width:${(s.byteLength/total)*100}%"></div>`);
    if(sections[3]) sections[3].forEach(s => sbar.innerHTML+=`<div class="sec-blb" style="width:${(s.byteLength/total)*100}%"></div>`);
    if(sections[4]) sections[4].forEach(s => sbar.innerHTML+=`<div class="sec-bib" style="width:${(s.byteLength/total)*100}%"></div>`);
}

(async()=>{
    try{
        const r=await fetch('page.bweb');
        if(r.ok){await renderBinary(await r.arrayBuffer());return}
    }catch(e){}
    try{
        const r=await fetch('page.bml');
        if(r.ok){await renderBinary(await r.arrayBuffer());return}
    }catch(e){}
})();

"""

content = pre_parse + new_logic + "\n" + post_parse
with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS: parseBWEB and renderBinary updated for VFS.")
