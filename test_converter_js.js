const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/home/benjamin/projects/bml-prototype/converter.html', 'utf-8');
const fileDom = new JSDOM(html);
const scripts = fileDom.window.document.querySelectorAll('script');
const scriptContent = scripts[1] ? scripts[1].textContent : '';
if (scriptContent) {
    try {
        new Function(scriptContent);
        console.log('Syntax OK');
    } catch(e) {
        console.error('Syntax Error:', e);
    }
}
