const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="renderTarget"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.performance = { now: () => Date.now() };
global.TextDecoder = require('util').TextDecoder;
global.TextEncoder = require('util').TextEncoder;

const html = fs.readFileSync('converter.html', 'utf8');
const parsedDoc = new JSDOM(html).window.document;
const inlineScripts = Array.from(parsedDoc.querySelectorAll('script:not([src])'));
let polyfillCode = inlineScripts.length > 0 ? inlineScripts[0].textContent : '';

// Evaluate polyfill
eval(polyfillCode);

async function run() {
    const buf = fs.readFileSync('../mediclean-pro.bweb');
    await renderBinary(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    
    // Check overlapping h2 tags
    const h2s = document.querySelectorAll('h2');
    h2s.forEach(h2 => {
        console.log(`H2: ${h2.textContent.trim()} | style: ${h2.getAttribute('style')}`);
        const next = h2.nextElementSibling;
        if(next) {
            console.log(`  Next sibling: ${next.tagName} | style: ${next.getAttribute('style')}`);
        }
    });
}
run().catch(console.error);
