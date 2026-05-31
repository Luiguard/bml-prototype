import { BwebLayoutEngine } from '../../bweb-engine/layout.js';
import { BwebRenderer } from '../../bweb-engine/render.js';

const NUM_NODES = 10000;

function generateData() {
    const nodes = [];
    for(let i=0; i<NUM_NODES; i++) {
        nodes.push({
            id: i,
            x: Math.random() * 750,
            y: Math.random() * 550,
            w: 10 + Math.random() * 40,
            h: 10 + Math.random() * 40,
            bg: `rgba(${Math.random()*255|0}, ${Math.random()*255|0}, ${Math.random()*255|0}, 1)`
        });
    }
    return nodes;
}

const data = generateData();

document.getElementById('btn-dom').addEventListener('click', () => {
    const container = document.getElementById('dom-container');
    container.innerHTML = '';
    
    const start = performance.now();
    const frag = document.createDocumentFragment();
    for(const d of data) {
        const div = document.createElement('div');
        div.className = 'box';
        div.style.left = d.x + 'px';
        div.style.top = d.y + 'px';
        div.style.width = d.w + 'px';
        div.style.height = d.h + 'px';
        div.style.backgroundColor = d.bg;
        frag.appendChild(div);
    }
    container.appendChild(frag);
    // Force layout calculation
    container.offsetHeight;
    const end = performance.now();
    
    document.getElementById('results').innerText = `DOM Time: ${(end - start).toFixed(2)} ms`;
});

document.getElementById('btn-bweb').addEventListener('click', () => {
    const canvas = document.getElementById('bweb-canvas');
    const renderer = new BwebRenderer(canvas);
    
    const start = performance.now();
    
    // Simulate BWEB Engine Nodes Array
    const bwebNodes = new Map();
    for(const d of data) {
        // Pseudo U32 Color Parse
        const bgMatch = d.bg.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        const u32Color = ((parseInt(bgMatch[1]) << 24) | (parseInt(bgMatch[2]) << 16) | (parseInt(bgMatch[3]) << 8) | 255) >>> 0;
        
        bwebNodes.set(d.id, {
            bdt: { nodeId: d.id, tagByte: 0x01 },
            blb: { display: 0, backgroundColor: u32Color, borderWidthTop: 1, borderColor: 0x000000FF },
            computed: { x: d.x, y: d.y, w: d.w, h: d.h }
        });
    }
    
    renderer.setNodes(bwebNodes);
    renderer.paint();
    const end = performance.now();
    
    document.getElementById('results').innerText += ` | BWEB Canvas Time: ${(end - start).toFixed(2)} ms`;
});
