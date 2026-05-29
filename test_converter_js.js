const fs = require('fs');
const html = fs.readFileSync('/home/benjamin/projects/bml-prototype/converter.html', 'utf-8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
    try {
        new Function(scriptMatch[1]);
        console.log('Syntax OK');
    } catch(e) {
        console.error('Syntax Error:', e);
    }
}
