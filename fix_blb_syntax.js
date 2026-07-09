const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

// There are TWO applyBLB definitions now.
// The second one is the old one that my regex missed.
// We need to remove the second applyBLB.
const lines = polyfillHtml.split('\n');
let inOldApplyBLB = false;
let newLines = [];
let braceDepth = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inOldApplyBLB && line.trim().startsWith('async function applyBLB(elements,blocks){')) {
        // Wait! We have TWO applyBLB. We want to keep the FIRST one (which I injected).
        // Let's count them.
    }
}

// Easier: just find the index of the first applyBLB, and then find the second applyBLB
const firstIndex = polyfillHtml.indexOf('async function applyBLB(elements, blocks)'); // new one has space
const secondIndex = polyfillHtml.indexOf('async function applyBLB(elements,blocks)'); // old one has no space after comma

if (secondIndex > -1) {
    // Find the end of the second applyBLB block
    let endOfBlock = polyfillHtml.indexOf('async function applyBIB', secondIndex);
    if (endOfBlock > -1) {
        polyfillHtml = polyfillHtml.substring(0, secondIndex) + polyfillHtml.substring(endOfBlock);
    }
}

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Fixed syntax error');
