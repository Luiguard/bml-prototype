/**
 * BWEB Accessibility (A11y) Bridge
 * Generiert ein unsichtbares, absolut positioniertes Shadow-DOM-Overlay,
 * welches Screenreadern ermöglicht, mit dem Canvas zu interagieren.
 */

export class BwebA11yBridge {
    constructor(canvasContainer) {
        this.container = canvasContainer;
        this.shadowRoot = document.createElement('div');
        this.shadowRoot.id = 'bweb-a11y-root';
        this.shadowRoot.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;opacity:0;';
        this.container.appendChild(this.shadowRoot);
        
        this.a11yNodes = new Map();
        
        // Reverse Mapping für BML Tags (zurück zu HTML Semantic)
        this.tagRev = {
            0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',
            0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',
            0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main'
        };
    }

    /**
     * Erzeugt oder aktualisiert das Shadow-DOM basierend auf den BDT/BLB-Daten.
     */
    sync(nodesMap) {
        // Aufräumen nicht mehr existenter Nodes
        for (const [id, el] of this.a11yNodes.entries()) {
            if (!nodesMap.has(id)) {
                el.remove();
                this.a11yNodes.delete(id);
            }
        }

        for (const [id, node] of nodesMap.entries()) {
            const bdt = node.bdt;
            const blb = node.blb;
            const comp = node.computed;

            if (blb.display === 4) { // display: none
                if (this.a11yNodes.has(id)) {
                    this.a11yNodes.get(id).style.display = 'none';
                }
                continue;
            }

            let el = this.a11yNodes.get(id);
            if (!el) {
                const tagStr = this.tagRev[bdt.tagByte] || 'div';
                el = document.createElement(tagStr);
                
                // Semantik/Rollen Mapping
                if (bdt.tagByte === 0x04) el.setAttribute('role', 'link');
                if (bdt.tagByte === 0x17) el.setAttribute('role', 'button');
                if (bdt.tagByte >= 0x05 && bdt.tagByte <= 0x0A) el.setAttribute('role', 'heading');

                // Pointer Events für interaktive Elemente freischalten (Fokus/Click)
                if (bdt.tagByte === 0x04 || bdt.tagByte === 0x17 || bdt.tagByte === 0x16) {
                    el.style.pointerEvents = 'auto';
                    el.tabIndex = 0; // In Fokus-Order aufnehmen
                    
                    // Event-Delegation vom Shadow-DOM zur VM
                    el.addEventListener('click', (e) => {
                        console.log(`[A11y Bridge] Keyboard/Click Event auf Node ${id}`);
                    });
                }
                
                this.shadowRoot.appendChild(el);
                this.a11yNodes.set(id, el);
            }

            // Text aktualisieren
            if (node.bdt.text && el.textContent !== node.bdt.text) {
                el.textContent = node.bdt.text;
                // Aria-Label Fallback
                el.setAttribute('aria-label', node.bdt.text);
            }

            // Position & Bounds strikt synchronisieren (für Screenreader Highlight)
            el.style.display = 'block';
            el.style.position = 'absolute';
            el.style.left = `${comp.x}px`;
            el.style.top = `${comp.y}px`;
            el.style.width = `${comp.w}px`;
            el.style.height = `${comp.h}px`;
            
            // Zustände synchronisieren
            if (blb.disabled) el.setAttribute('aria-disabled', 'true');
            if (blb.checked) el.setAttribute('aria-checked', 'true');
        }
    }
}
