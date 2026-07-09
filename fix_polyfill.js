const fs = require('fs');

const contentJs = fs.readFileSync('/home/benjamin/projects/bml-prototype/bweb-converter/chrome-extension/content.js', 'utf-8');

const parseBWEBAsyncCode = `
        async function parseBWEBAsync(buf) {
            const dv = new DataView(buf);
            if (buf.byteLength < 8) throw new Error('BWEB: Container zu klein');
            const magic = dv.getUint32(0);
            if (magic !== 0x42574542) throw new Error('Ungültiges BWEB Magic');
            
            const numSections = dv.getUint32(4);
            let headerOffset = 8;
            let dataOffset = 8 + numSections * 8;
            
            const sections = {};
            for (let i = 0; i < numSections; i++) {
                const type = dv.getUint8(headerOffset);
                const len = dv.getUint32(headerOffset + 1);
                const compressed = dv.getUint8(headerOffset + 5);
                headerOffset += 8;
                
                let chunk = buf.slice(dataOffset, dataOffset + len);
                dataOffset += len;
                
                if (compressed === 1) {
                    const ds = new DecompressionStream('deflate');
                    const writer = ds.writable.getWriter();
                    writer.write(new Uint8Array(chunk));
                    writer.close();
                    
                    const decompressedChunks = [];
                    const reader = ds.readable.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        decompressedChunks.push(value);
                    }
                    
                    let totalLen = 0;
                    for (const c of decompressedChunks) totalLen += c.length;
                    const res = new Uint8Array(totalLen);
                    let offset = 0;
                    for (const c of decompressedChunks) {
                        res.set(c, offset);
                        offset += c.length;
                    }
                    chunk = res.buffer;
                }
                
                sections[type] = chunk;
            }
            return sections;
        }
`;

let modifiedContentJs = contentJs.replace(
    /function parseBWEB\(buf\)\{[\s\S]*?return sections;\s*\}/,
    parseBWEBAsyncCode.trim()
);

modifiedContentJs = modifiedContentJs.replace(
    /const sections\s*=\s*parseBWEB\(buf\);/,
    "const sections = await parseBWEBAsync(buf);"
);

// We extract just the CONSTANTS and PARSERS (from DANGEROUS_TAGS to just before applyBVS)
const startIndex = modifiedContentJs.indexOf('const DANGEROUS_TAGS =');
const endIndex = modifiedContentJs.lastIndexOf('} catch(e) {');

const logicBlock = modifiedContentJs.substring(startIndex, endIndex);

// Now wrap it cleanly for polyfill.html
const polyfillHtml = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BWEB Polyfill Engine</title>
</head>
<body style="margin:0; padding:0; background: transparent;">
    <div id="renderTarget"></div>
    <script>
    (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const fileParam = urlParams.get('file');
        if (!fileParam || !/^[a-zA-Z0-9_\\-\\/\.]+\\.(bweb|bml|bdt|blb|bib)$/.test(fileParam) || fileParam.includes('..')) {
            document.getElementById('renderTarget').innerHTML = '<div style="padding:2rem;text-align:center">Ungültige BWEB-Datei angegeben.</div>';
            return;
        }

        try {
            const fetchUrl = \`\${window.location.protocol}//\${window.location.host}/\${fileParam}\${fileParam.includes('?') ? '&' : '?'}raw=true\`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(\`HTTP Fehler \${response.status}\`);
            const buffer = await response.arrayBuffer();

            // === INJECTED PARSERS & LOGIC ===
            // This replaces 'await fetch(url)' and 'buffer' from content.js with our own
            // So we strip those out from the logicBlock!
            
            \n${logicBlock.replace(/const response = await fetch\\(url\\);\\s*if \\(!response\\.ok\\) throw new Error\\(\`HTTP Fehler \\$\\{response\\.status\\}\`\\);\\s*const buffer = await response\\.arrayBuffer\\(\\);/, '')}

        } catch(e) {
            console.error("BWEB Polyfill Engine Error:", e);
            const target=document.getElementById('renderTarget');
            target.innerHTML='';
            const errBox=document.createElement('div');
            errBox.setAttribute('style','padding: 2rem; max-width: 600px; margin: 40px auto; background: #1e1b4b; border: 1px solid #312e81; border-radius: 8px; text-align: center;');
            const h=document.createElement('h2');h.setAttribute('style','color: #ef4444; margin-top: 0;');h.textContent='BWEB Polyfill Ladefehler';errBox.appendChild(h);
            const p1=document.createElement('p');p1.setAttribute('style','color: #cbd5e1; line-height: 1.6;');p1.textContent='Die JS-Polyfill-Engine konnte die Binärdatei nicht laden oder decodieren.';errBox.appendChild(p1);
            const p2=document.createElement('p');p2.setAttribute('style','color: #94a3b8; font-size: 0.85rem;');p2.textContent='Details: '+(e instanceof Error?e.message:'Unbekannter Fehler');errBox.appendChild(p2);
            target.appendChild(errBox);
        }
    })();
    </script>
</body>
</html>`;

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
fs.writeFileSync('/home/benjamin/projects/bml-prototype/bweb-converter/chrome-extension/content.js', modifiedContentJs);

console.log("Successfully rebuilt polyfill.html and content.js!");
