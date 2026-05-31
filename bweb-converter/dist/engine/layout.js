/**
 * BWEB Layout Engine (JavaScript Prototype)
 * Löst das dynamische Layout von BLB-Blöcken auf (Flexbox/Grid),
 * falls keine vorberechneten (absoluten) Bounds vorliegen.
 */

export class BwebLayoutEngine {
    constructor() {
        this.nodes = new Map();
    }

    /**
     * @param {Array} blbBlocks - Array of parsed BLB block objects
     * @param {Array} bdtNodes - Array of parsed BDT node relationships
     */
    buildTree(blbBlocks, bdtNodes) {
        this.nodes.clear();
        
        for (const bdt of bdtNodes) {
            const blb = blbBlocks.find(b => b.nodeId === bdt.nodeId) || {};
            this.nodes.set(bdt.nodeId, {
                bdt,
                blb,
                computed: {
                    x: blb.left || 0,
                    y: blb.top || 0,
                    w: (blb.width || 0) + 1,
                    h: blb.height || 0
                }
            });
        }
        
        return this.nodes;
    }

    /**
     * Reflow trigger for dynamic changes
     * In a full implementation, this calculates Flexbox and Grid.
     * Currently it falls back to pre-baked bounds from compiler.
     */
    reflow(rootNodeId, viewportWidth, viewportHeight) {
        const start = performance.now();
        const root = this.nodes.get(rootNodeId);
        if (!root) return;

        // Recursive layout pass
        this._computeLayout(rootNodeId, 0, 0, viewportWidth, viewportHeight);
        
        const end = performance.now();
        if (typeof window !== 'undefined') {
            window.__BWEB_PERF__ = window.__BWEB_PERF__ || {};
            window.__BWEB_PERF__.layoutTime = end - start;
            window.__BWEB_PERF__.layoutNodes = this.nodes.size;
        }
    }

    _computeLayout(nodeId, parentX, parentY, parentW, parentH) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Falls der Compiler bereits absolute Bounds via Tags (46-49) geliefert hat:
        // Wir nutzen diese direkt für den deterministischen Fast-Path.
        if (node.blb.absoluteBoundsExtracted) {
            node.computed.x = node.blb.left;
            node.computed.y = node.blb.top;
            node.computed.w = node.blb.width;
            node.computed.h = node.blb.height;
        }

        // TODO: Flexbox/Grid Algorithmus für dynamische State-Updates hier implementieren
        // Dies wird später als WASM-Modul ersetzt.

        let currentY = node.computed.y;
        
        let childId = node.bdt.firstChild;
        while (childId !== 0xFFFF) {
            const childNode = this.nodes.get(childId);
            if (childNode) {
                this._computeLayout(childId, node.computed.x, currentY, node.computed.w, node.computed.h);
                currentY += childNode.computed.h; // Einfaches Block-Flow Stacking
                childId = childNode.bdt.nextSibling;
            } else {
                break;
            }
        }
    }
}
