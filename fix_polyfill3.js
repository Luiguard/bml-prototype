const fs = require('fs');
const contentJs = fs.readFileSync('/home/benjamin/projects/bml-prototype/bweb-converter/chrome-extension/content.js', 'utf-8');

const startIndex = contentJs.indexOf('const DANGEROUS_TAGS =');
const endIndex = contentJs.lastIndexOf('} catch(e) {');
let logicBlock = contentJs.substring(startIndex, endIndex);

// Remove the `try {` line entirely from logicBlock!
logicBlock = logicBlock.replace(/try\s*\{/, '');

// Remove the fetch code from logicBlock!
logicBlock = logicBlock.replace(/const response\s*=\s*await fetch\(url\);[\s\S]*?const buffer\s*=\s*await response\.arrayBuffer\(\);/, '');

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

        const url = window.location.href;
        const ext = fileParam.split('.').pop();

        try {
            const fetchUrl = \`\${window.location.protocol}//\${window.location.host}/\${fileParam}\${fileParam.includes('?') ? '&' : '?'}raw=true\`;
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error(\`HTTP Fehler \${response.status}\`);
            const buffer = await response.arrayBuffer();

            \n${logicBlock}

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
console.log("Added missing variables!");
