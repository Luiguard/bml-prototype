(async () => {
    const injectScript = document.createElement('script');
    injectScript.textContent = 'window.__BWEB_NATIVE_ACTIVE__ = true;';
    (document.head || document.documentElement).appendChild(injectScript);
    injectScript.remove();

    const url = window.location.href;
    const pathname = window.location.pathname.toLowerCase();
    const ext = pathname.split('.').pop();
    const bwebExtensions = ['bpg', 'bweb'];

    if (!bwebExtensions.includes(ext)) {
        return;
    }

    console.log(`⚡ BWEB Native Engine V2.0: Intercepted ${ext.toUpperCase()} load for ${url}`);

    document.documentElement.innerHTML = `
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BWEB V2.0 Player</title>
        <style>
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #fff; }
            #bweb-canvas { display: block; position: absolute; top: 0; left: 0; z-index: 1; }
            #a11y-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }
            .a11y-node { position: absolute; pointer-events: auto; outline: none; opacity: 0; }
            .a11y-node:focus { outline: 2px solid #3498db; opacity: 1; background: rgba(52, 152, 219, 0.1); }
            #error-box { position: absolute; z-index: 999; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 2rem; background: #1e1b4b; border: 1px solid #312e81; border-radius: 8px; text-align: center; color: #fff; font-family: system-ui; display: none; }
        </style>
    </head>
    <body>
        <canvas id="bweb-canvas"></canvas>
        <div id="a11y-layer"></div>
        <div id="error-box"></div>
    </body>`;

    const canvas = document.getElementById('bweb-canvas');
    const ctx = canvas.getContext('2d');
    const a11yLayer = document.getElementById('a11y-layer');
    const errorBox = document.getElementById('error-box');
    let dpr = window.devicePixelRatio || 1;

    function resize() {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    const doc = { bdt: [], bml: [], blb: [], bib: {}, bvs: {}, bas: {}, bms: {}, bex: [], bff: {}, scrollY: {}, activeFrames: {} };

    function showError(msg) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = `<h2 style="color: #ef4444; margin-top: 0;">BWEB Ladefehler</h2><p>${msg}</p>`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Fehler ${response.status}`);
        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);

        let payloadOffset = 0;
        const magicBPG = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        
        if (magicBPG === 'BPG1') {
            console.log("[BWEB Engine] BPG Container detected. Initiating Handshake Verification...");
            const payloadLen = view.getUint32(8);
            const idLen = view.getUint16(48);
            const tokenLen = view.getUint16(50 + idLen);
            payloadOffset = 52 + idLen + tokenLen;
            
            const expectedHash = new Uint8Array(buffer, 16, 32);
            const payloadData = new Uint8Array(buffer, payloadOffset, payloadLen);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', payloadData);
            const actualHash = new Uint8Array(hashBuffer);
            
            let integrityPassed = true;
            for (let i = 0; i < 32; i++) {
                if (expectedHash[i] !== actualHash[i]) integrityPassed = false;
            }
            if (!integrityPassed) {
                throw new Error("Handshake Verification FAILED! Integrity Check mismatch.");
            }
            console.log("[BWEB Engine] Handshake Verification SUCCESS.");
        }

        const magicBWEB = String.fromCharCode(view.getUint8(payloadOffset), view.getUint8(payloadOffset+1), view.getUint8(payloadOffset+2), view.getUint8(payloadOffset+3));
        if (magicBWEB !== 'BWEB') throw new Error("Invalid BWEB magic string.");

        const sectionCount = view.getUint8(payloadOffset + 5);
        let offset = payloadOffset + 6;
        const sections = [];
        for (let i = 0; i < sectionCount; i++) {
            sections.push({ id: view.getUint8(offset), offset: view.getUint32(offset + 1) + payloadOffset, length: view.getUint32(offset + 5) });
            offset += 9;
        }

        // BDT, BML, BLB Parsers
        for (const sec of sections) {
            let p = sec.offset;
            if (sec.id === 0) {
                const count = view.getUint16(p); p += 2;
                for (let i = 0; i < count; i++) {
                    doc.bdt.push({ id: view.getUint16(p), parentId: view.getUint16(p+2), firstChild: view.getUint16(p+4), nextSibling: view.getUint16(p+6), nodeType: view.getUint8(p+8), flags: view.getUint8(p+9) });
                    p += 10;
                }
            } else if (sec.id === 1) {
                const count = view.getUint16(p); p += 2;
                for (let i = 0; i < count; i++) {
                    const tagId = view.getUint8(p++);
                    if (tagId === 253) {
                        p += 3; // padding
                        const len = view.getUint16(p); p += 2;
                        const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p, len));
                        p += len;
                        doc.bml.push({ tagId, attributes: {}, text });
                    } else {
                        const attrCount = view.getUint8(p++);
                        p += 6; // padding
                        const attrs = {};
                        for (let a = 0; a < attrCount; a++) {
                            const attrId = view.getUint8(p++);
                            let name = '';
                            if (attrId === 254) {
                                const nLen = view.getUint8(p++);
                                name = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p, nLen));
                                p += nLen;
                            }
                            const vLen = view.getUint16(p); p += 2;
                            const val = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p, vLen));
                            p += vLen;
                            
                            if (attrId === 254) attrs[name] = val;
                            else if (attrId === 19) attrs['src'] = val;
                        }
                        doc.bml.push({ tagId, attributes: attrs, text: '' });
                    }
                }
            } else if (sec.id === 2) {
                const count = view.getUint16(p); p += 2;
                for (let i = 0; i < count; i++) {
                    doc.blb.push({
                        x: view.getFloat32(p), y: view.getFloat32(p+4), w: view.getFloat32(p+8), h: view.getFloat32(p+12),
                        pTop: view.getFloat32(p+16), pRight: view.getFloat32(p+20), pBottom: view.getFloat32(p+24), pLeft: view.getFloat32(p+28),
                        bwTop: view.getUint8(p+32), bwRight: view.getUint8(p+33), bwBottom: view.getUint8(p+34), bwLeft: view.getUint8(p+35),
                        borderStyle: view.getUint8(p+36),
                        bgR: view.getUint8(p+37), bgG: view.getUint8(p+38), bgB: view.getUint8(p+39), bgA: view.getUint8(p+40),
                        fgR: view.getUint8(p+41), fgG: view.getUint8(p+42), fgB: view.getUint8(p+43), fgA: view.getUint8(p+44),
                        radius: view.getUint16(p+45), zIndex: view.getInt16(p+47), flags: view.getUint8(p+49)
                    });
                    p += 50;
                }
            } else if (sec.id === 4) { // BIB
                const count = view.getUint16(p); p += 2;
                for (let i = 0; i < count; i++) {
                    const id = view.getUint16(p);
                    const off = view.getUint32(p+2) + sec.offset;
                    const len = view.getUint32(p+6);
                    p += 13;
                    const blob = new Blob([new Uint8Array(buffer, off, len)]);
                    const img = new Image();
                    img.src = URL.createObjectURL(blob);
                    doc.bib[id] = img;
                }
            } else if (sec.id === 7) { // BFF
                const count = view.getUint16(p); p += 2;
                for (let i = 0; i < count; i++) {
                    const nameLen = view.getUint8(p++);
                    const familyName = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p, nameLen));
                    p += nameLen;
                    const dataLen = view.getUint32(p); p += 4;
                    const fontData = new Uint8Array(buffer, p, dataLen);
                    p += dataLen;
                    
                    const fontFace = new FontFace(familyName, fontData);
                    fontFace.load().then(f => {
                        document.fonts.add(f);
                        doc.bff[familyName] = f;
                        render();
                    }).catch(err => console.error("BFF Font load failed:", err));
                }
            } else if (sec.id === 5) { // BVS
                const count = view.getUint32(p); p += 4;
                for(let i=0; i<count; i++){
                    const id = view.getUint32(p); p += 4;
                    const w = view.getUint16(p); p += 2;
                    const h = view.getUint16(p); p += 2;
                    const cLen = view.getUint8(p++);
                    const codec = new TextDecoder('ascii').decode(new Uint8Array(buffer, p, cLen)); p += cLen;
                    const chunkCount = view.getUint32(p); p += 4;
                    const chunks = [];
                    for(let j=0; j<chunkCount; j++) {
                        const isKey = (view.getUint8(p++) & 1) === 1;
                        const pts = Number((BigInt(view.getUint32(p))<<32n)|BigInt(view.getUint32(p+4))); p += 8;
                        const dur = view.getUint32(p); p += 4;
                        const dLen = view.getUint32(p); p += 4;
                        chunks.push({type: isKey?'key':'delta', timestamp: pts, duration: dur, data: new Uint8Array(buffer, p, dLen)});
                        p += dLen;
                    }
                    doc.bvs[id] = {w, h, codec, chunks};
                }
            } else if (sec.id === 6) { // BMS
                const count = view.getUint16(p); p += 2;
                for (let i = 0; i < count; i++) {
                    const nodeId = view.getUint16(p); p += 2;
                    const entryCount = view.getUint8(p); p++;
                    doc.bms[nodeId] = [];
                    for (let e = 0; e < entryCount; e++) {
                        const typeId = view.getUint8(p); p++;
                        const vLen = view.getUint16(p); p += 2;
                        doc.bms[nodeId].push({ typeId, value: new Uint8Array(buffer, p, vLen) });
                        p += vLen;
                    }
                }
            } else if (sec.id === 8) { // BEX
                const count = view.getUint32(p); p += 4;
                for (let i = 0; i < count; i++) {
                    const triggerNode = view.getUint32(p); p += 4;
                    const eventType = view.getUint8(p++);
                    const actionType = view.getUint8(p++);
                    const targetNode = view.getUint32(p); p += 4;
                    const paramLen = view.getUint16(p); p += 2;
                    const paramStr = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p, paramLen));
                    p += paramLen;
                    doc.bex.push({ triggerNode, eventType, actionType, targetNode, paramStr });
                }
            } else if (sec.id === 9) { // TOC
                const tocMagic = String.fromCharCode(view.getUint8(p), view.getUint8(p+1), view.getUint8(p+2));
                const tocVersion = view.getUint8(p+3);
                if (tocMagic === 'VFS' && tocVersion === 1) {
                    const jsonStr = new TextDecoder('utf-8').decode(new Uint8Array(buffer, p+4, sec.length - 4));
                    try { doc.toc = JSON.parse(jsonStr); } catch(e) {}
                }
            }
        }

        doc.renderOrder = Array.from({length: doc.blb.length}, (_, i) => i).sort((a, b) => doc.blb[a].zIndex - doc.blb[b].zIndex);
        
        let hoveredNodeId = -1;
        let clickedNodeId = -1;

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const i of doc.renderOrder) {
                const blb = doc.blb[i];
                if (blb.flags & 0x10) continue; // Skip hidden elements
                let currentScrollY = 0;
                let currParent = doc.bdt[i].parentId;
                while(currParent !== 0xFFFF && currParent !== undefined) {
                    if (doc.scrollY[currParent]) currentScrollY += doc.scrollY[currParent];
                    currParent = doc.bdt[currParent].parentId;
                }
                let drawY = blb.y - currentScrollY;
                
                ctx.save();
                if (blb.flags & 0x04 || blb.flags & 0x08) { 
                    ctx.beginPath(); ctx.rect(blb.x, drawY, blb.w, blb.h); ctx.clip();
                }
                
                let a = blb.bgA, r = blb.bgR, g = blb.bgG, b = blb.bgB;
                if (i === hoveredNodeId) { a = 255; r = Math.max(0, r - 30); g = Math.max(0, g - 30); b = Math.max(0, b - 30); }
                if (i === clickedNodeId) r = Math.min(255, r + 50);
                
                if (a > 0) {
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
                    if (blb.radius > 0) { ctx.beginPath(); ctx.roundRect(blb.x, drawY, blb.w, blb.h, blb.radius); ctx.fill(); }
                    else ctx.fillRect(blb.x, drawY, blb.w, blb.h);
                }
                
                if (blb.bwTop > 0 || blb.bwLeft > 0) {
                    ctx.strokeStyle = `rgba(${blb.fgR}, ${blb.fgG}, ${blb.fgB}, 1)`; ctx.lineWidth = blb.bwTop || blb.bwLeft;
                    if (blb.radius > 0) { ctx.beginPath(); ctx.roundRect(blb.x, drawY, blb.w, blb.h, blb.radius); ctx.stroke(); }
                    else ctx.strokeRect(blb.x, drawY, blb.w, blb.h);
                }

                if (i < doc.bml.length) {
                    const text = doc.bml[i].text;
                    const attrs = doc.bml[i].attributes || {};
                    if (doc.bml[i].tagId === 6 && attrs.src && attrs.src.startsWith('bib://')) {
                        const img = doc.bib[parseInt(attrs.src.split('://')[1])];
                        if (img && img.complete) ctx.drawImage(img, blb.x, drawY, blb.w, blb.h);
                        else if (img) img.onload = render;
                    } else if (doc.bml[i].tagId === 6 && attrs.src && attrs.src.startsWith('data:image/')) {
                        if (!doc.bib[attrs.src]) {
                            const img = new Image();
                            img.src = attrs.src;
                            doc.bib[attrs.src] = img;
                            img.onload = render;
                        } else if (doc.bib[attrs.src].complete) {
                            ctx.drawImage(doc.bib[attrs.src], blb.x, drawY, blb.w, blb.h);
                        }
                    } else if (doc.bml[i].tagId === 7 && attrs.src && attrs.src.startsWith('bvs://')) {
                        const frame = doc.activeFrames[parseInt(attrs.src.split('://')[1])];
                        if (frame) ctx.drawImage(frame, blb.x, drawY, blb.w, blb.h);
                    } else if (doc.bdt[i].nodeType === 1 && text && !text.startsWith('bib://') && !text.startsWith('bvs://')) {
                        const attrs = doc.bml[i].attributes;
                        ctx.fillStyle = `rgba(${blb.fgR},${blb.fgG},${blb.fgB},${blb.fgA/255})`;
                        const customFonts = Object.keys(doc.bff).map(f => `"${f}"`).join(', ');
                        const fontStr = customFonts ? `${customFonts}, ${attrs.fontFamily || 'sans-serif'}` : (attrs.fontFamily || 'sans-serif');
                        ctx.font = `${attrs.fontSize || 16}px ${fontStr}`;
                        ctx.textBaseline = 'top';
                        let textX = blb.x;
                        if (attrs.textAlign === 'center') { ctx.textAlign = 'center'; textX = blb.x + blb.w / 2; }
                        else if (attrs.textAlign === 'right') { ctx.textAlign = 'right'; textX = blb.x + blb.w; }
                        else ctx.textAlign = 'left';
                        ctx.fillText(text, textX, drawY);
                    }
                }
                
                if (i === hoveredNodeId) { ctx.strokeStyle = '#3498db'; ctx.lineWidth = 2; ctx.strokeRect(blb.x - 2, drawY - 2, blb.w + 4, blb.h + 4); }
                ctx.restore();
            }
        }

        // WebCodecs V1.1 integration
        if ('VideoDecoder' in window && Object.keys(doc.bvs).length > 0) {
            for (const [vidId, vid] of Object.entries(doc.bvs)) {
                let currentChunk = 0, startRealTime = performance.now();
                const decoder = new VideoDecoder({
                    output: (frame) => {
                        const elapsed = (performance.now() - startRealTime) * 1000;
                        if (frame.timestamp <= elapsed) {
                            if (doc.activeFrames[vidId]) doc.activeFrames[vidId].close();
                            doc.activeFrames[vidId] = frame;
                            render();
                        } else {
                            setTimeout(() => {
                                if (doc.activeFrames[vidId]) doc.activeFrames[vidId].close();
                                doc.activeFrames[vidId] = frame;
                                render();
                            }, (frame.timestamp - elapsed) / 1000);
                        }
                    },
                    error: (e) => console.error(e)
                });
                decoder.configure({ codec: vid.codec, codedWidth: vid.w, codedHeight: vid.h, hardwareAcceleration: 'prefer-hardware' });
                const pump = async () => {
                    while (decoder.decodeQueueSize < 10 && currentChunk < vid.chunks.length) {
                        decoder.decode(new EncodedVideoChunk(vid.chunks[currentChunk++]));
                    }
                    if (currentChunk >= vid.chunks.length && decoder.decodeQueueSize === 0) {
                        await decoder.flush(); currentChunk = 0; startRealTime = performance.now();
                    }
                    requestAnimationFrame(pump);
                };
                pump();
            }
        }

        function buildA11y() {
            a11yLayer.innerHTML = '';
            for (let i = 0; i < doc.blb.length; i++) {
                const blb = doc.blb[i];
                let currentScrollY = 0;
                let currParent = doc.bdt[i].parentId;
                while(currParent !== 0xFFFF && currParent !== undefined) {
                    if (doc.scrollY[currParent]) currentScrollY += doc.scrollY[currParent];
                    currParent = doc.bdt[currParent].parentId;
                }
                const drawY = blb.y - currentScrollY;
                const bdt = doc.bdt[i];
                const bml = doc.bml[i];

                if (bdt && bdt.nodeType === 1 && bml && bml.text && !bml.text.startsWith('bib://') && !bml.text.startsWith('bvs://')) {
                    const el = document.createElement('span');
                    el.style.position = 'absolute';
                    el.style.left = blb.x + 'px';
                    el.style.top = drawY + 'px';
                    el.style.width = blb.w + 'px';
                    el.style.height = blb.h + 'px';
                    el.style.color = 'transparent';
                    el.style.pointerEvents = 'auto';
                    el.style.userSelect = 'text';
                    el.style.fontSize = (bml.attributes && bml.attributes.fontSize ? bml.attributes.fontSize : 16) + 'px';
                    el.style.fontFamily = 'sans-serif';
                    el.style.lineHeight = blb.h + 'px';
                    el.style.whiteSpace = 'nowrap';
                    el.style.overflow = 'hidden';
                    el.textContent = bml.text;
                    a11yLayer.appendChild(el);
                    continue;
                }

                if (bml && (bml.tagId === 7 || bml.tagId === 34)) {
                    const el = document.createElement(bml.tagId === 7 ? 'input' : 'textarea');
                    el.style.position = 'absolute';
                    el.style.left = blb.x + 'px';
                    el.style.top = drawY + 'px';
                    el.style.width = blb.w + 'px';
                    el.style.height = blb.h + 'px';
                    el.style.opacity = '1';
                    el.style.background = 'transparent';
                    el.style.border = 'none';
                    el.style.color = `rgba(${blb.fgR},${blb.fgG},${blb.fgB},${blb.fgA/255})`;
                    el.style.fontSize = (bml.attributes && bml.attributes.fontSize ? bml.attributes.fontSize : 16) + 'px';
                    el.style.padding = `${blb.pTop}px ${blb.pRight}px ${blb.pBottom}px ${blb.pLeft}px`;
                    el.style.pointerEvents = 'auto';
                    el.style.outline = 'none';
                    if (bml.attributes) {
                        if (bml.attributes.type) el.type = bml.attributes.type;
                        if (bml.attributes.placeholder) el.placeholder = bml.attributes.placeholder;
                        if (bml.attributes.value) el.value = bml.attributes.value;
                    }
                    el.addEventListener('input', (e) => {
                        if(!doc.bml[i].attributes) doc.bml[i].attributes = {};
                        doc.bml[i].attributes.value = e.target.value;
                    });
                    a11yLayer.appendChild(el);
                    blb.flags |= 0x20;
                }

                if (doc.bms[i]) {
                    let isInteractive = false;
                    for (const entry of doc.bms[i]) {
                        if (entry.typeId === 3 && entry.value.length >= 2) {
                            const mask = (entry.value[0] << 8) | entry.value[1];
                            if (mask & 0x01 || mask & 0x08) isInteractive = true;
                        }
                    }
                    if (isInteractive) {
                        const el = document.createElement('div');
                        el.className = 'a11y-node'; el.tabIndex = 0;
                        el.style.left = blb.x + 'px'; el.style.top = drawY + 'px'; el.style.width = blb.w + 'px'; el.style.height = blb.h + 'px';
                        el.addEventListener('focus', () => { hoveredNodeId = i; render(); });
                        el.addEventListener('blur', () => { hoveredNodeId = -1; render(); });
                        el.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                clickedNodeId = i; render();
                                setTimeout(() => { clickedNodeId = -1; render(); }, 150);
                            }
                        });
                        a11yLayer.appendChild(el);
                    }
                }
            }
        }

        function getHitNode(x, y) {
            for (let k = doc.renderOrder.length - 1; k >= 0; k--) {
                const i = doc.renderOrder[k]; const b = doc.blb[i];
                let currentScrollY = 0, currParent = doc.bdt[i].parentId;
                while(currParent !== 0xFFFF && currParent !== undefined) {
                    if (doc.scrollY[currParent]) currentScrollY += doc.scrollY[currParent];
                    currParent = doc.bdt[currParent].parentId;
                }
                let checkY = y + currentScrollY;
                if (x >= b.x && x <= b.x + b.w && checkY >= b.y && checkY <= b.y + b.h) return i;
            }
            return -1;
        }

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            let hitNode = getHitNode(e.clientX - rect.left, e.clientY - rect.top), hit = -1;
            if (hitNode !== -1 && doc.bms[hitNode]) {
                for (const entry of doc.bms[hitNode]) {
                    if (entry.typeId === 3 && entry.value.length >= 2 && ((entry.value[0] << 8) | entry.value[1]) & 0x05) { hit = hitNode; break; }
                }
            }
            if (hit !== hoveredNodeId) { 
                hoveredNodeId = hit; 
                canvas.style.cursor = hit !== -1 ? 'pointer' : 'default';
                render(); 
            }
        });
        canvas.addEventListener('mousedown', () => { if (hoveredNodeId !== -1) { clickedNodeId = hoveredNodeId; render(); } });
        canvas.addEventListener('mouseup', () => { 
            if (clickedNodeId !== -1) { 
                const nodeId = clickedNodeId;
                clickedNodeId = -1; 
                
                // Execute BEX rules
                let needsRender = true;
                for (const rule of doc.bex) {
                    if (rule.triggerNode === nodeId && rule.eventType === 1 /* Click */) {
                        if (rule.actionType === 1 /* Toggle Display */) {
                            if (doc.blb[rule.targetNode]) {
                                // Toggle display none using a custom flag (0x10)
                                if (doc.blb[rule.targetNode].flags & 0x10) {
                                    doc.blb[rule.targetNode].flags &= ~0x10; // Show
                                } else {
                                    doc.blb[rule.targetNode].flags |= 0x10; // Hide
                                }
                            }
                        } else if (rule.actionType === 2 /* Navigate */) {
                            console.log("BEX Navigation to:", rule.paramStr);
                            if (rule.paramStr.startsWith('http')) {
                                window.location.href = rule.paramStr;
                            } else if (doc.toc[rule.paramStr] !== undefined) {
                                console.log("Internal TOC jump not fully implemented.");
                            }
                        }
                    }
                }
                if (needsRender) render(); 
            } 
        });
        canvas.addEventListener('wheel', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            for (let k = doc.renderOrder.length - 1; k >= 0; k--) {
                const i = doc.renderOrder[k], b = doc.blb[i];
                let currentScrollY = 0, currParent = doc.bdt[i].parentId;
                while(currParent !== 0xFFFF && currParent !== undefined) {
                    if (doc.scrollY[currParent]) currentScrollY += doc.scrollY[currParent];
                    currParent = doc.bdt[currParent].parentId;
                }
                if (x >= b.x && x <= b.x + b.w && (y + currentScrollY) >= b.y && (y + currentScrollY) <= b.y + b.h) {
                    if (b.flags & 0x08) { 
                        doc.scrollY[i] = Math.max(0, (doc.scrollY[i] || 0) + e.deltaY);
                        render(); e.preventDefault(); return;
                    }
                }
            }
        }, { passive: false });

        render();
        buildA11y();

    } catch(e) {
        console.error(e);
        showError(e.message);
    }
})();
