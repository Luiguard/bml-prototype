const express = require('express');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const port = 4000;

app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiting middleware to API calls only
app.use('/api/', apiLimiter);

// Main GUI Dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BWEB Compiler GUI</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --panel-bg: #1e293b;
            --text-color: #f8fafc;
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --border: #334155;
            --term-bg: #000000;
            --term-text: #22c55e;
            --error: #ef4444;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 800px;
        }
        h1 { margin-top: 0; font-size: 24px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
        .card {
            background-color: var(--panel-bg);
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            border: 1px solid var(--border);
            margin-bottom: 25px;
        }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 500; font-size: 14px; color: #cbd5e1; }
        .input-group { display: flex; gap: 10px; }
        input[type="text"] {
            flex: 1;
            padding: 10px 12px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background-color: #0f172a;
            color: white;
            font-size: 14px;
        }
        button {
            padding: 10px 16px;
            background-color: var(--border);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }
        button:hover { background-color: #475569; }
        button.primary {
            background-color: var(--primary);
            width: 100%;
            padding: 14px;
            font-size: 16px;
            margin-top: 10px;
        }
        button.primary:hover { background-color: var(--primary-hover); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .terminal-wrapper {
            background-color: var(--term-bg);
            border-radius: 8px;
            border: 1px solid var(--border);
            overflow: hidden;
            margin-top: 25px;
            display: none;
        }
        .terminal-header {
            background-color: #1e293b;
            padding: 8px 15px;
            font-size: 12px;
            color: #94a3b8;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .circle { width: 10px; height: 10px; border-radius: 50%; }
        .circle.red { background-color: #ef4444; }
        .circle.yellow { background-color: #eab308; }
        .circle.green { background-color: #22c55e; }
        .terminal-body {
            padding: 15px;
            height: 300px;
            overflow-y: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            color: var(--term-text);
            line-height: 1.5;
        }
        .log-error { color: var(--error); }
        .log-info { color: #38bdf8; }
        .log-success { color: #22c55e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>BWEB Compiler Studio</h1>
            <div class="form-group">
                <label>Quellordner (Website-Projekt)</label>
                <div class="input-group">
                    <input type="text" id="inputPath" placeholder="Wähle den Ordner mit deiner HTML/CSS/JS Struktur" readonly>
                    <button onclick="browse('folder')">Browse...</button>
                </div>
            </div>
            
            <div class="form-group">
                <label>Output-Datei (.bpg)</label>
                <div class="input-group">
                    <input type="text" id="outputPath" placeholder="Wo soll das BWEB-Format gespeichert werden?" readonly>
                    <button onclick="browse('file')">Browse...</button>
                </div>
            </div>

            <button id="btnStart" class="primary" onclick="startCompile()" disabled>Kompilieren Starten</button>
        </div>

        <div class="terminal-wrapper" id="terminalWrapper">
            <div class="terminal-header">
                <div class="circle red"></div>
                <div class="circle yellow"></div>
                <div class="circle green"></div>
                <span style="margin-left: 10px">Compiler Logs</span>
            </div>
            <div class="terminal-body" id="terminal"></div>
        </div>
    </div>

    <script>
        const inputPath = document.getElementById('inputPath');
        const outputPath = document.getElementById('outputPath');
        const btnStart = document.getElementById('btnStart');
        const terminal = document.getElementById('terminal');
        const terminalWrapper = document.getElementById('terminalWrapper');

        function checkReady() {
            btnStart.disabled = !(inputPath.value && outputPath.value);
        }

        async function browse(type) {
            try {
                const res = await fetch('/api/browse?type=' + type);
                const data = await res.json();
                if (data.path) {
                    if (type === 'folder') inputPath.value = data.path;
                    if (type === 'file') outputPath.value = data.path;
                    checkReady();
                }
            } catch (e) {
                alert('Fehler beim Öffnen des Dialogs.');
            }
        }

        function log(msg, type = '') {
            const el = document.createElement('div');
            el.textContent = '> ' + msg;
            if (type) el.className = 'log-' + type;
            terminal.appendChild(el);
            terminal.scrollTop = terminal.scrollHeight;
        }

        async function startCompile() {
            terminalWrapper.style.display = 'block';
            terminal.innerHTML = '';
            btnStart.disabled = true;
            
            const evtSource = new EventSource(\`/api/convert?input=\${encodeURIComponent(inputPath.value)}&output=\${encodeURIComponent(outputPath.value)}\`);
            
            evtSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                if (data.type === 'end') {
                    evtSource.close();
                    checkReady();
                    return;
                }
                log(data.msg, data.type);
            };
            
            evtSource.onerror = function() {
                log('Verbindung zum Compiler verloren.', 'error');
                evtSource.close();
                checkReady();
            };
        }
    </script>
</body>
</html>
    `);
});

// Native file dialogs using zenity
app.get('/api/browse', (req, res) => {
    const isFolder = req.query.type === 'folder';
    const cmd = isFolder 
        ? 'zenity --file-selection --directory --title="Wähle den Quellordner"'
        : 'zenity --file-selection --save --confirm-overwrite --title="Output Datei wählen" --filename="website.bpg"';
    
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            // Error usually means user cancelled the dialog
            return res.json({ path: null });
        }
        res.json({ path: stdout.trim() });
    });
});

// The core compilation logic triggered via SSE
// The core compilation logic triggered via SSE
app.get('/api/convert', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    const sendLog = (msg, type = 'info') => {
        res.write(`data: ${JSON.stringify({ msg, type })}\n\n`);
    };

    const inputDir = req.query.input;
    const outputFile = req.query.output;

    if (!inputDir || !outputFile) {
        sendLog('Fehlerhafte Pfade übermittelt.', 'error');
        res.write(`data: {"type":"end"}\n\n`);
        return res.end();
    }

    sendLog(`[Init] Starte Kompilierung...`);
    sendLog(`[Init] Quellordner: ${inputDir}`);
    sendLog(`[Init] Zielordner: ${outputFile}`);

    let localServer = null;
    let browser = null;

    try {
        function getHtmlFiles(dir, base = '') {
            let results = [];
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const relPath = path.posix.join(base, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    results = results.concat(getHtmlFiles(fullPath, relPath));
                } else if (file.endsWith('.html')) {
                    results.push(relPath);
                }
            }
            return results;
        }

        const htmlFiles = getHtmlFiles(inputDir);
        
        // Inject dynamic query parameter pages manually for compilation
        const dynamicRoutes = [
            'service.html?type=ordination',
            'service.html?type=buero',
            'service.html?type=grund',
            'service.html?type=fenster',
            'service.html?type=stiegenhaus',
            'service.html?type=haushalt',
            'consulting.html?type=hygiene',
            'consulting.html?type=qualitaet',
            'consulting.html?type=datenschutz'
        ];
        htmlFiles.push(...dynamicRoutes);
        
        if (htmlFiles.length === 0) {
            throw new Error(`Keine .html Dateien im Ordner ${inputDir} gefunden.`);
        }

        sendLog(`[VFS] ${htmlFiles.length} Routen/Seiten gefunden.`);

        const tempApp = express();
        tempApp.use(express.static(inputDir));
        
        await new Promise(r => {
            localServer = tempApp.listen(0, () => {
                sendLog(`[VFS] Lokaler Render-Server läuft auf Port ${localServer.address().port}`, 'success');
                r();
            });
        });

const port = localServer.address().port;
        
        sendLog('[Puppeteer] Starte Headless Browser...');
        browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        const vfsBlocks = [];
        const globalAssets = new Map(); // key: url, val: { id, type }
        const toc = {};
        let fileIndex = 0;

        // Ensure index.html is first
        htmlFiles.sort((a, b) => {
            if (a === 'index.html') return -1;
            if (b === 'index.html') return 1;
            return a.localeCompare(b);
        });

        for (const htmlFile of htmlFiles) {
            const targetUrl = `http://localhost:${port}/${htmlFile}`;
            sendLog(`[Puppeteer] Lade und Render Seite: ${targetUrl}`);
            await page.setViewport({ width: 1920, height: 1080 });
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            
            sendLog(`[Puppeteer] Seite ${htmlFile} vollständig geladen. Warte auf Layouts...`);
            await new Promise(r => setTimeout(r, 500));

            // We need to pass the current global assets map to puppeteer so it assigns correct IDs
            const currentAssets = Array.from(globalAssets.entries());

            sendLog(`[BWEB] Injiziere Serialisierungs-Logik für ${htmlFile}...`);
            
            const bwebData = await page.evaluate(async (existingAssets) => {
                const enc = new TextEncoder();
                const globalAssets = new Map(existingAssets);
                let nextAssetId = globalAssets.size;
                const newAssets = [];

                function colorToU32(c) {
                    const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                    if (!m) return 0;
                    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                    const a = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255;
                    return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
                }

                const DM={'block':0,'inline':1,'flex':2,'grid':3,'none':4,'inline-block':5,'inline-flex':6,'list-item':7,'table':8,'table-row':9,'table-cell':10,'inline-grid':11};
                const PM_={'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4};
                const TAM={'left':0,'center':1,'right':2,'justify':3,'start':0,'end':2};
                const FDM={'row':0,'column':1,'row-reverse':2,'column-reverse':3};
                const FWM={'nowrap':0,'wrap':1,'wrap-reverse':2};
                const JCM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5,'normal':0};
                const AIM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'stretch':3,'baseline':4,'normal':3};

                const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'iframe',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFD:'#text',0xFE:'div',0xFF:'div'};
                const TAG_FWD = {};
                for(const[k,v]of Object.entries(TAG_REV))TAG_FWD[v]=parseInt(k);
                const ATTR_FWD = {'class':0x10,'id':0x11,'href':0x12,'src':0x13,'style':0x14,'type':0x15,'name':0x16,'value':0x17,'placeholder':0x18,'alt':0x19,'title':0x1A,'action':0x1B,'method':0x1C,'target':0x1D,'rel':0x1E,'role':0x1F,'aria-label':0x20,'data-bind':0x21,'onclick':0x22,'onsubmit':0x23,'width':0x24,'height':0x25,'disabled':0x26,'checked':0x27,'selected':0x28,'required':0x29,'autofocus':0x2A,'autocomplete':0x2B,'min':0x2C,'max':0x2D,'step':0x2E,'pattern':0x2F,'for':0x30,'tabindex':0x31,'content':0x32,'charset':0x33,'http-equiv':0x34,'lang':0x35,'dir':0x36,'hidden':0x37};
                const SKIP_TAGS = new Set(['script','style','noscript','template','iframe','object','embed','applet','link','meta','base','head','source','track','slot']);

                // Wrap bare text nodes
                const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                const textNodesToWrap = [];
                while(tw.nextNode()) textNodesToWrap.push(tw.currentNode);
                for(const tn of textNodesToWrap) {
                    if(tn.textContent.trim() && tn.parentNode) {
                        const wrapper = document.createElement('span');
                        wrapper.style.cssText = 'display:inline;margin:0;padding:0;border:0;';
                        tn.parentNode.insertBefore(wrapper, tn);
                        wrapper.appendChild(tn);
                    }
                }

                // Materialize pseudo-elements
                const allEls = document.body.querySelectorAll('*');
                for (const el of allEls) {
                    for (const pseudo of ['::before', '::after']) {
                        const ps = window.getComputedStyle(el, pseudo);
                        const content = ps.content;
                        if (!content || content === 'none' || content === 'normal') continue;
                        const pNode = document.createElement('span');
                        pNode.setAttribute('data-pseudo', pseudo);
                        pNode.style.cssText = `display:${ps.display};position:${ps.position};width:${ps.width};height:${ps.height};background-color:${ps.backgroundColor};background-image:${ps.backgroundImage};color:${ps.color};font-size:${ps.fontSize};font-weight:${ps.fontWeight};font-family:${ps.fontFamily};top:${ps.top};left:${ps.left};right:${ps.right};bottom:${ps.bottom};border-radius:${ps.borderRadius};opacity:${ps.opacity};z-index:${ps.zIndex};overflow:hidden;pointer-events:none;`;
                        const textContent = content.replace(/^["']|["']$/g, '');
                        if (textContent && textContent !== '""' && textContent !== "''") {
                            pNode.textContent = textContent;
                        }
                        if (pseudo === '::before') el.insertBefore(pNode, el.firstChild);
                        else el.appendChild(pNode);
                    }
                }
                
                // Extract Images
                for (const imgEl of document.querySelectorAll('img')) {
                    const src = imgEl.src;
                    if (src && !src.startsWith('bib://')) {
                        if (!globalAssets.has(src)) {
                            globalAssets.set(src, { id: nextAssetId, type: 'image' });
                            newAssets.push({ url: src, id: nextAssetId, type: 'image' });
                            nextAssetId++;
                        }
                    }
                }
                
                // Extract Videos
                for (const vidEl of document.querySelectorAll('video')) {
                    const src = vidEl.src || (vidEl.querySelector('source') ? vidEl.querySelector('source').src : null);
                    if (src && !src.startsWith('bvd://')) {
                        if (!globalAssets.has(src)) {
                            globalAssets.set(src, { id: nextAssetId, type: 'video' });
                            newAssets.push({ url: src, id: nextAssetId, type: 'video' });
                            nextAssetId++;
                        }
                    }
                }

                const bmlBuf = [];
                const flatNodes = [];

                function serNode(el, parentIdx) {
                    if (el.nodeType === 3) {
                        const t = el.textContent.trim();
                        if (!t) return;
                        const textBytes = enc.encode(t + " ");
                        bmlBuf.push(0xFD, 0, 0, 0);
                        bmlBuf.push((textBytes.length >> 8) & 0xFF, textBytes.length & 0xFF);
                        for (const b of textBytes) bmlBuf.push(b);
                        return;
                    }
                    if (el.nodeType !== 1) return;
                    let tag = el.tagName ? el.tagName.toLowerCase() : 'div';
                    if (SKIP_TAGS.has(tag)) return;
                    if (tag === 'img') tag = 'canvas'; // Replace imgs with canvas for binary format
                    
                    const myIdx = flatNodes.length;
                    flatNodes.push({ node: el, tag: TAG_FWD[tag] || 255, parentIdx, children: [], id: myIdx });
                    if (parentIdx >= 0) flatNodes[parentIdx].children.push(myIdx);
                    
                    const attrs = [];
                    for (const a of el.attributes) {
                        if (el.tagName && el.tagName.toLowerCase() === 'img' && a.name === 'src') {
                            const asset = globalAssets.get(el.src);
                            if (asset !== undefined) {
                                attrs.push({id: ATTR_FWD['src'] || 19, val: enc.encode(`bib://${asset.id}`)});
                            }
                            continue;
                        }
                        if (el.tagName && el.tagName.toLowerCase() === 'video' && a.name === 'src') {
                            const asset = globalAssets.get(el.src);
                            if (asset !== undefined) {
                                attrs.push({id: ATTR_FWD['src'] || 19, val: enc.encode(`bvd://${asset.id}`)});
                            }
                            continue;
                        }
                        if(a.name === 'data-bib') {
                            attrs.push({id:ATTR_FWD['src']||19,val:enc.encode(`bib://${a.value}`)});
                            continue;
                        }
                        const aid = ATTR_FWD[a.name];
                        if (aid !== undefined) {
                            attrs.push({ id: aid, val: enc.encode(a.value) });
                        } else if(a.name === 'href') {
                            attrs.push({id:ATTR_FWD['href']||18,val:enc.encode(a.value)});
                        }
                    }
                    
                    let nChild = 0;
                    for (const ch of el.childNodes) {
                        if (ch.nodeType === 3 && ch.textContent.trim()) nChild++;
                        else if (ch.nodeType === 1) { const ct = ch.tagName ? ch.tagName.toLowerCase() : ''; if (!SKIP_TAGS.has(ct)) nChild++; }
                    }

                    bmlBuf.push(flatNodes[myIdx].tag);
                    bmlBuf.push(attrs.length);
                    bmlBuf.push((nChild >> 8) & 0xFF, nChild & 0xFF);
                    bmlBuf.push(0, 0); 
                    
                    for (const a of attrs) {
                        bmlBuf.push(a.id);
                        bmlBuf.push((a.val.length >> 8) & 0xFF, a.val.length & 0xFF);
                        for (const b of a.val) bmlBuf.push(b);
                    }
                    
                    for (const c of el.childNodes) serNode(c, myIdx);
                }

                serNode(document.body, -1);

                // BDT Tree
                const bdtBuf = new ArrayBuffer(4 + 4 + flatNodes.length * 16);
                const bdtView = new DataView(bdtBuf);
                bdtView.setUint8(0, 0x42); bdtView.setUint8(1, 0x44); bdtView.setUint8(2, 0x54); bdtView.setUint8(3, 0x01);
                bdtView.setUint32(4, flatNodes.length);
                const depths = new Array(flatNodes.length).fill(0);
                for (let i = 0; i < flatNodes.length; i++) { if (flatNodes[i].parentIdx >= 0) depths[i] = depths[flatNodes[i].parentIdx] + 1; }
                for (let i = 0; i < flatNodes.length; i++) {
                    const off = 8 + i * 16;
                    const n = flatNodes[i];
                    bdtView.setUint16(off, i);
                    bdtView.setUint16(off + 2, n.parentIdx >= 0 ? n.parentIdx : 0xFFFF);
                    bdtView.setUint16(off + 4, n.children.length ? n.children[0] : 0xFFFF);
                    let ns = 0xFFFF, ps = 0xFFFF;
                    if (n.parentIdx >= 0) {
                        const siblings = flatNodes[n.parentIdx].children;
                        const myPos = siblings.indexOf(i);
                        if (myPos >= 0 && myPos < siblings.length - 1) ns = siblings[myPos + 1];
                        if (myPos > 0) ps = siblings[myPos - 1];
                    }
                    bdtView.setUint16(off + 6, ns);
                    bdtView.setUint16(off + 8, n.children.length ? n.children[n.children.length - 1] : 0xFFFF);
                    bdtView.setUint16(off + 10, ps);
                    bdtView.setUint8(off + 12, 1);
                    bdtView.setUint8(off + 13, n.tag);
                    bdtView.setUint8(off + 14, depths[i]);
                }

                function parseUnitValue(val) {
                    if(!val || val==='auto' || val==='none') return {u:4, v:0};
                    if(val.endsWith('%')) return {u:1, v:Math.round(parseFloat(val)*10)};
                    if(val.endsWith('vw')) return {u:2, v:Math.round(parseFloat(val)*10)};
                    if(val.endsWith('vh')) return {u:3, v:Math.round(parseFloat(val)*10)};
                    const n = parseFloat(val);
                    return isNaN(n) ? {u:4, v:0} : {u:0, v:Math.round(n*10)};
                }

                const extractBLB = () => {
                    const blbBuf = new ArrayBuffer(50 * 1024 * 1024);
                    const blbView = new DataView(blbBuf);
                    blbView.setUint32(0, flatNodes.length);
                    let off = 4;
                    for(let i = 0; i < flatNodes.length; i++){
                        const n = flatNodes[i].node;
                        blbView.setUint16(off, flatNodes[i].id); off += 2;
                        if(n.nodeType !== 1) { blbView.setUint8(off++, 0); continue; }
                        const s = window.getComputedStyle(n);
                        const props = [];
                        const addDim = (tag, cssProp) => {
                            const raw = s[cssProp];
                            const {u,v} = parseUnitValue(raw);
                            if(u!==4 || (tag===1 || tag===2)) props.push({tag, type:0, len:5, write:(vwr, o)=>{ vwr.setUint8(o, u); vwr.setInt32(o+1, v); }});
                        };
                        const addEnum = (tag, val) => { if(val!==undefined) props.push({tag, type:1, len:1, write:(vwr, o)=>vwr.setUint8(o, val)}); };
                        const addColor = (tag, val) => {
                            const c = colorToU32(val);
                            if(c!==0) props.push({tag, type:2, len:4, write:(vwr, o)=>vwr.setUint32(o, c)});
                        };
                        
                        addDim(1, 'width'); addDim(2, 'height'); addDim(3, 'minWidth'); addDim(4, 'minHeight');
                        addEnum(5, DM[s.display]); addEnum(6, PM_[s.position]); addEnum(7, s.boxSizing==='border-box'?1:0);
                        addDim(8, 'marginTop'); addDim(9, 'marginRight'); addDim(10, 'marginBottom'); addDim(11, 'marginLeft');
                        addDim(12, 'paddingTop'); addDim(13, 'paddingRight'); addDim(14, 'paddingBottom'); addDim(15, 'paddingLeft');
                        addColor(16, s.borderColor); addColor(17, s.backgroundColor); addColor(18, s.color);
                        addDim(19, 'fontSize'); addDim(20, 'lineHeight');
                        props.push({tag: 21, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, parseInt(s.fontWeight)||400)});
                        addEnum(22, TAM[s.textAlign]);
                        
                        if (DM[s.display]===2 || DM[s.display]===6 || DM[s.display]===11) { 
                            addEnum(23, FDM[s.flexDirection]); addEnum(24, FWM[s.flexWrap]);
                            addEnum(25, JCM[s.justifyContent]); addEnum(26, AIM[s.alignItems]||0);
                            props.push({tag:27, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexGrow||0)*100))});
                            props.push({tag:28, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexShrink||1)*100))});
                            addDim(30, 'gap');
                        }
                        addDim(31, 'borderRadius');
                        const ovMap={'visible':0,'hidden':1,'scroll':2,'auto':3};
                        addEnum(32, ovMap[s.overflow]||0);
                        const ff = s.fontFamily;
                        if(ff) {
                            const ffClean = ff.split(',')[0].replace(/['"]/g,'').trim();
                            const ffB = enc.encode(ffClean);
                            props.push({tag:33,type:3,len:4+ffB.length,write:(vwr,o)=>{vwr.setUint32(o,ffB.length);new Uint8Array(vwr.buffer).set(ffB,o+vwr.byteOffset+4);}});
                        }
                        const opVal=parseFloat(s.opacity); if(opVal<1.0) props.push({tag:34,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,Math.round(opVal*255))});
                        const tdLine=s.textDecorationLine||s.textDecoration||'';if(tdLine!=='none'&&tdLine!==''){let tdV=0;if(tdLine.includes('underline'))tdV|=1;if(tdLine.includes('line-through'))tdV|=2;if(tdV)props.push({tag:35,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,tdV)});}
                        const bs=s.boxShadow;if(bs&&bs!=='none'){const bsB=enc.encode(bs);props.push({tag:36,type:3,len:4+bsB.length,write:(vwr,o)=>{vwr.setUint32(o,bsB.length);new Uint8Array(vwr.buffer).set(bsB,o+vwr.byteOffset+4);}});}
                        const bi=s.backgroundImage;if(bi&&bi!=='none'){const biB=enc.encode(bi);props.push({tag:37,type:3,len:4+biB.length,write:(vwr,o)=>{vwr.setUint32(o,biB.length);new Uint8Array(vwr.buffer).set(biB,o+vwr.byteOffset+4);}});}
                        const ttMap={'none':0,'uppercase':1,'lowercase':2,'capitalize':3};if(s.textTransform&&ttMap[s.textTransform]){props.push({tag:38,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,ttMap[s.textTransform])});}
                        const ls=parseFloat(s.letterSpacing);if(!isNaN(ls)&&ls!==0){props.push({tag:39,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(ls*100));}});}
                        addDim(40, 'top'); addDim(41, 'right'); addDim(42, 'bottom'); addDim(43, 'left');
                        if(s.zIndex&&s.zIndex!=='auto'){const zi=parseInt(s.zIndex);if(!isNaN(zi))props.push({tag:44,type:1,len:2,write:(vwr,o)=>vwr.setInt16(o,zi)});}
                        if(s.visibility==='hidden')addEnum(45, 1);
                        
                        const rect = n.getBoundingClientRect();
                        props.push({tag:46,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.left*10))}});
                        props.push({tag:47,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.top*10))}});
                        props.push({tag:48,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.width*10))}});
                        props.push({tag:49,type:0,len:5,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setInt32(o+1,Math.round(rect.height*10))}});
                        
                        blbView.setUint8(off++, props.length);
                        for(const p of props) {
                            blbView.setUint8(off++, p.tag);
                            blbView.setUint8(off++, p.type);
                            p.write(blbView, off); off += p.len;
                        }
                    }
                    return new Uint8Array(blbBuf.slice(0, off));
                };

                const blbDesktop = extractBLB();
                return {
                    bml: Array.from(new Uint8Array([0x42, 0x4D, 0x4C, 0x01, ...bmlBuf])),
                    bdt: Array.from(new Uint8Array(bdtBuf)),
                    blbDesktop: Array.from(blbDesktop),
                    newAssets
                };
            }, currentAssets);

            for (const asset of bwebData.newAssets) {
                globalAssets.set(asset.url, { id: asset.id, type: asset.type });
            }
            
            toc[htmlFile] = { index: fileIndex++ };
            vfsBlocks.push({
                bml: Buffer.from(bwebData.bml),
                bdt: Buffer.from(bwebData.bdt),
                blbDesktop: Buffer.from(bwebData.blbDesktop)
            });
            sendLog(`[BWEB] Layout-Graphen für ${htmlFile} extrahiert.`);
        }

        sendLog(`[BWEB] Downloade ${globalAssets.size} globale Assets für BIB/BVD...`);
        
        // Make sure output directory exists early for asset writing
        if (!fs.existsSync(outputFile)) {
            fs.mkdirSync(outputFile, { recursive: true });
        }
        const assetsDir = path.join(outputFile, 'assets');
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        if (globalAssets.size > 0) {
            for (const [url, asset] of globalAssets.entries()) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        const arr = await response.arrayBuffer();
                        const buffer = Buffer.from(arr);
                        
                        if (asset.type === 'image') {
                            const comp = response.headers.get('content-type').includes('png') ? 1 : 
                                         response.headers.get('content-type').includes('jpeg') ? 2 : 
                                         response.headers.get('content-type').includes('webp') ? 3 : 0;
                            
                            // Write single .bib file
                            const bibArr = Buffer.alloc(8 + 24 + buffer.length);
                            bibArr.writeUInt8(0x42, 0); bibArr.writeUInt8(0x49, 1); bibArr.writeUInt8(0x42, 2); bibArr.writeUInt8(0x01, 3);
                            bibArr.writeUInt32BE(1, 4); // 1 image
                            let off = 8;
                            bibArr.writeUInt32BE(asset.id, off); off+=4;
                            bibArr.writeUInt16BE(0, off); off+=2; // width
                            bibArr.writeUInt16BE(0, off); off+=2; // height
                            bibArr.writeUInt8(1, off++); // RGBA format
                            bibArr.writeUInt8(comp, off++); // Compression
                            off += 6; // padding
                            bibArr.writeUInt16BE(0, off); off+=2; // blocks
                            bibArr.writeUInt32BE(buffer.length, off); off+=4;
                            buffer.copy(bibArr, off);
                            
                            fs.writeFileSync(path.join(assetsDir, `${asset.id}.bib`), bibArr);
                        } else if (asset.type === 'video') {
                            // Write single .bvd file
                            const bvdArr = Buffer.alloc(12 + buffer.length);
                            bvdArr.writeUInt8(0x42, 0); bvdArr.writeUInt8(0x56, 1); bvdArr.writeUInt8(0x44, 2); bvdArr.writeUInt8(0x01, 3); // BVD\x01
                            bvdArr.writeUInt32BE(asset.id, 4);
                            bvdArr.writeUInt32BE(buffer.length, 8);
                            buffer.copy(bvdArr, 12);
                            
                            fs.writeFileSync(path.join(assetsDir, `${asset.id}.bvd`), bvdArr);
                        }
                    }
                } catch(e) {
                    console.error("Asset download error:", e);
                }
            }
        }

        sendLog(`[BWEB] Schreibe Archive File...`);
        const sections = [];
        function appendSection(type, dataBuf) {
            const head = Buffer.alloc(5);
            head.writeUInt8(type, 0);
            head.writeUInt32BE(dataBuf.length, 1);
            sections.push(head);
            sections.push(dataBuf);
            return 5 + dataBuf.length;
        }

        let archiveSize = 6;
        
        const tocBytes = Buffer.from(JSON.stringify(toc));
        const tocPayload = Buffer.alloc(4 + tocBytes.length);
        tocPayload.set([0x56, 0x46, 0x53, 0x01], 0);
        tocBytes.copy(tocPayload, 4);
        
        archiveSize += appendSection(9, tocPayload);
        
        for (const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blbDesktop);
        }

        // No bibBuf included inline anymore!

        // Write BWEB Header
        const bwebHeader = Buffer.alloc(6);
        bwebHeader.set([0x42, 0x57, 0x45, 0x42, 0x01], 0);
        bwebHeader.writeUInt8(sections.length / 2, 5);

        
        // outputFile is the directory and we already ensured it exists

        const bwebPath = path.join(outputFile, 'website.bpg');
        const outStream = fs.createWriteStream(bwebPath);
        outStream.write(bwebHeader);
        for (const chunk of sections) {
            outStream.write(chunk);
        }
        outStream.end();

        sendLog('[Polyfill] Extrahiere Render-Engine aus converter.html...');
        
        // Read polyfill.js for the runtime environment
        const polyfillSrc = fs.readFileSync(path.join(__dirname, 'polyfill.js'), 'utf8');

        const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BWEB Application</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #ffffff; }
        canvas { display: block; width: 100vw; }
    </style>
</head>
<body>
    <canvas id="app-canvas"></canvas>
    <script>
        // --- BWEB Polyfill Runtime ---
        ${polyfillSrc}

        // --- Init App ---
        let bwebData = null;
        let engine = null;

        // Base BWEB path extraction
        const baseHref = window.location.pathname.replace(/\\/[^\\/]*$/, '/');

        function loadPage(urlStr) {
            try {
                const url = new URL(urlStr, window.location.href);
                let path = url.pathname;
                if (path.startsWith(baseHref)) {
                    path = path.substring(baseHref.length);
                } else if (path.startsWith('/')) {
                    path = path.substring(1);
                }
                if (path === '' || path === '/') path = 'index.html';
                
                // Construct the full path including search query for matching
                const fullPath = path + url.search;
                
                // Find in VFS (match exact full path first, then fallback to base path without query)
                const targetPage = bwebData.vfs.find(p => p.name === fullPath || p.name === path);
                if(targetPage) {
                    window.scrollTo(0, 0); // Reset scroll
                    let bmlStart = 0;
                    const bmlView = new Uint8Array(targetPage.bml);
                    if(bmlView[0]===0x42&&bmlView[1]===0x4D&&bmlView[2]===0x4C) bmlStart=4;
                    const parser = new BMLParser(targetPage.bml, bmlStart);
                    const bmlRoot = parser.parse();
                    const bdtNodes = targetPage.bdt ? parseBDT(targetPage.bdt) : null;
                    const blb = { desktop: targetPage.blbDesktop ? parseBLB(targetPage.blbDesktop) : null };
                    engine.update(bmlRoot, bdtNodes, blb);
                    history.pushState(null, '', urlStr);
                    return true;
                }
            } catch(e) {
                console.error("Navigation error:", e);
            }
            return false;
        }

        document.addEventListener('click', (e) => {
            const a = e.target.closest('a');
            if(a && a.href) {
                const url = new URL(a.href, window.location.href);
                // Only intercept internal links
                if(url.origin === window.location.origin) {
                    e.preventDefault();
                    if(!loadPage(a.href)) {
                        console.warn("Page not found in BWEB:", a.href);
                    }
                }
            }
        });

        window.addEventListener('popstate', () => {
            loadPage(window.location.href);
        });

        async function initApp() {
            if (window.__BWEB_NATIVE_ACTIVE__) {
                console.log("⚡ BWEB Native Engine detected. Stopping Polyfill.");
                document.body.innerHTML = "<h2 style='text-align:center; margin-top:20vh; font-family:sans-serif;'>Natives BWEB-Rendering aktiv.</h2>";
                return;
            }
            try {
                const res = await fetch('website.bpg');
                if (!res.ok) throw new Error('Failed to load website.bpg');
                const buf = await res.arrayBuffer();
                
                bwebData = parseBWEB(buf);
                await prepareGlobalBIB(bwebData.bib || []);
                
                engine = new CanvasEngine();
                engine.mount(document.getElementById('app-canvas'));
                
                // Mount initial page
                loadPage(window.location.href);
                
                // Show extension prompt if applicable
                if (typeof showBWEBExtensionModal === 'function') {
                    showBWEBExtensionModal();
                }
            } catch (e) {
                console.error("BWEB Boot Error:", e);
                document.body.innerHTML = "<div style='color:red;padding:20px;font-family:sans-serif;'><h3>BWEB Error</h3>" + e.message + "</div>";
            }
        }

        window.onload = initApp;
    </script>
</body>
</html>`;

        fs.writeFileSync(path.join(outputFile, 'index.html'), indexHtmlContent);
        sendLog('[Polyfill] index.html und website.bpg im Zielordner erstellt.', 'success');


        sendLog(`[Fertig] BWEB erfolgreich erstellt: ${archiveSize} Bytes`, 'success');
        
    } catch (e) {
        sendLog(e.toString(), 'error');
    } finally {
        if (browser) await browser.close();
        if (localServer) localServer.close();
        res.write(`data: {"type":"end"}\n\n`);
        res.end();
    }
});

app.listen(port, () => {
    console.log(`[BWEB GUI] Server running on http://localhost:${port}`);
    exec(`xdg-open http://localhost:${port}`);
});
