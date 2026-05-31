/**
 * BWEB Core Orchestrator
 * Verbindet Layout-Engine, Canvas-Renderer, A11y-Bridge und die WASM-VM.
 */
import { BwebLayoutEngine } from './layout.js';
import { BwebRenderer } from './render.js?v=2';
import { BwebA11yBridge } from './a11y.js';

import initWasm, { BdtVm } from './vm/pkg/bweb_vm.js';

export class BwebCore {
    constructor(canvas, container) {
        this.layout = new BwebLayoutEngine();
        this.renderer = new BwebRenderer(canvas);
        
        // Renderer Event-Callback injizieren
        this.renderer.onEvent = (nodeId, eventType) => this.dispatchVMEvent(nodeId, eventType);
        
        this.a11y = new BwebA11yBridge(container);
        this.vm = null; // Echtes WASM-Binding
    }

    async init() {
        console.log("[BWEB Core] Initialisiere echte WASM VM...");
        await initWasm(); // Lädt das WebAssembly Modul
        this.vm = new BdtVm(1048576, 50000); // 1MB Memory, 50k Cycles Limit
    }

    load(blbBlocks, bdtNodes) {
        this.layout.buildTree(blbBlocks, bdtNodes);
        this.doFrame();
    }

    dispatchVMEvent(nodePath, eventType) {
        // JS Controller (Polyfill) ausführen
        if (this.onEvent) {
            this.onEvent(nodePath, eventType);
        }

        if (!this.vm) return;
        
        // VM nimmt zusätzlich den State-Change vor (nur primary Node für WASM)
        const primaryNodeId = Array.isArray(nodePath) ? nodePath[0] : nodePath;
        const stateChanged = this.vm.execute_event(primaryNodeId, eventType);
        
        if (stateChanged > 0) {
            console.log(`[BWEB Core] VM meldet State-Change. Triggere Reflow...`);
            this.doFrame();
        }
    }

    doFrame() {
        // 1. Layout berechnen (Flexbox/Grid falls dynamisch)
        this.layout.reflow(1, window.innerWidth, window.innerHeight);
        
        // 2. An Renderer übergeben und painten
        this.renderer.setNodes(this.layout.nodes);
        this.renderer.paint();
        
        // 3. A11y Shadow-DOM für Screenreader nachziehen
        this.a11y.sync(this.layout.nodes);
    }
}
