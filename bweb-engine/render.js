/**
 * BWEB Canvas Rendering Pipeline (BVS)
 * Zeichnet BWEB-Knoten absolut deterministisch auf einen HTML5 Canvas.
 */

export class BwebRenderer {
    /**
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.nodes = new Map(); // Berechnete Layout-Knoten
        this.scrollY = 0;
        this.maxScrollY = 2000; // Will be calculated dynamically
        this._setupEventDelegation();
    }

    _setupEventDelegation() {
        ['click', 'mousemove', 'mousedown', 'mouseup'].forEach(evtType => {
            this.canvas.addEventListener(evtType, (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top + this.scrollY;
                this._handleEvent(evtType, x, y, e);
            });
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.scrollY += e.deltaY;
            if (this.scrollY < 0) this.scrollY = 0;
            if (this.scrollY > this.maxScrollY) this.scrollY = this.maxScrollY;
            this.paint();
        }, { passive: false });
    }

    _handleEvent(type, x, y, originalEvent) {
        // Z-Index Sorting für Hit-Testing (höchster z-index zuerst, Kinder vor Eltern bei gleichem z-index)
        const hitQueue = Array.from(this.nodes.values()).reverse().sort((a, b) => {
            const zA = a.blb.zIndex || 0;
            const zB = b.blb.zIndex || 0;
            return zB - zA;
        });

        for (const node of hitQueue) {
            if (this._isHidden(node)) continue;
            
            const comp = node.computed;
            if (x >= comp.x && x <= comp.x + comp.w && y >= comp.y && y <= comp.y + comp.h) {
                // Treffer! Event an Orchestrator / VM delegieren
                if (this.onEvent) {
                    const nodePath = [];
                    let curr = node;
                    while (curr) {
                        nodePath.push(curr.bdt.nodeId);
                        if (curr.bdt.parentId === 65535) break;
                        curr = this.nodes.get(curr.bdt.parentId);
                    }
                    this.onEvent(nodePath, type);
                } else if (type === 'click') {
                    console.log(`[BWEB Event] ${type} auf Node ID ${node.bdt.nodeId} (Keine VM angebunden)`, node);
                }
                
                // Cursor für interaktive Elemente
                if (type === 'mousemove' && (node.bdt.tagByte === 0x04 || node.bdt.tagByte === 0x17)) { // 'a' or 'button'
                    this.canvas.style.cursor = 'pointer';
                    return;
                }
                break;
            }
        }
        if (type === 'mousemove') this.canvas.style.cursor = 'default';
    }

    setNodes(nodeMap) {
        this.nodes = nodeMap;
        let maxY = 0;
        for (const node of this.nodes.values()) {
            const bottom = node.computed.y + node.computed.h;
            if (bottom > maxY) maxY = bottom;
        }
        this.maxScrollY = Math.max(0, maxY - this.canvas.height / (window.devicePixelRatio || 1) + 100);
    }

    /**
     * Führt einen kompletten Paint-Zyklus durch.
     */
    paint() {
        const start = performance.now();
        this.ctx.resetTransform();
        if (typeof window !== 'undefined') {
            this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(0, -this.scrollY);

        // Z-Index Sorting
        const renderQueue = Array.from(this.nodes.values()).sort((a, b) => {
            const zA = a.blb.zIndex || 0;
            const zB = b.blb.zIndex || 0;
            return zA - zB;
        });

        for (const node of renderQueue) {
            this._drawNode(node);
        }
        
        const end = performance.now();
        if (typeof window !== 'undefined') {
            window.__BWEB_PERF__ = window.__BWEB_PERF__ || {};
            window.__BWEB_PERF__.renderTime = end - start;
            window.__BWEB_PERF__.renderedNodes = renderQueue.length;
        }
    }

    _isHidden(node) {
        let curr = node;
        while (curr) {
            if (curr.blb && curr.blb.display === 0) return true;
            if (curr.bdt && curr.bdt.parentId === 65535) break; // 0xFFFF
            curr = this.nodes.get(curr.bdt.parentId);
        }
        return false;
    }

    _drawNode(node) {
        if (this._isHidden(node)) return;

        // BLB (Binary Layout Block) anwenden
        const blb = node.blb;
        if (blb.opacity === 0) return;

        const comp = node.computed;

        this.ctx.save();
        this.ctx.globalAlpha = (blb.opacity !== undefined ? blb.opacity : 255) / 255.0;

        // Blur Filter (Glow/Mesh Effekte)
        if (blb.filterBlurPx > 0) {
            this.ctx.filter = `blur(${blb.filterBlurPx}px)`;
        } else {
            this.ctx.filter = 'none';
        }

        if (blb.backgroundColor) {
            this.ctx.fillStyle = this._toRgba(blb.backgroundColor);
            this._roundRect(comp.x, comp.y, comp.w, comp.h, blb.borderRadius || 0);
            this.ctx.fill();
        }

        if (blb.borderColor) {
            this.ctx.strokeStyle = this._toRgba(blb.borderColor);
            this.ctx.lineWidth = 1;
            this._roundRect(comp.x, comp.y, comp.w, comp.h, blb.borderRadius || 0);
            this.ctx.stroke();
        }
        
        // Borders
        if (blb.borderColor && blb.borderWidthTop > 0) {
            this.ctx.strokeStyle = this._toRgba(blb.borderColor);
            this.ctx.lineWidth = blb.borderWidthTop;
            this._roundRect(comp.x, comp.y, comp.w, comp.h, blb.borderRadius || 0);
            this.ctx.stroke();
        }

        // Media (BIB / BVS)
        if (node.bdt.src && this.assets && this.assets[node.bdt.src]) {
            const asset = this.assets[node.bdt.src];
            if (asset.type === 'image' && asset.bitmap) {
                this.ctx.drawImage(asset.bitmap, comp.x, comp.y, comp.w, comp.h);
            } else if (asset.type === 'video' && asset.video) {
                // Video wird framegenau ins Canvas kopiert
                this.ctx.drawImage(asset.video, comp.x, comp.y, comp.w, comp.h);
            }
        }

        // Text (BML Payload)
        // Text-Rendering wird über BML/Text-Knoten gesteuert.
        // Falls dieser Knoten direkten Text enthält (oder ein generierter Span ist):
        if (node.bdt.text && node.bdt.text !== "") {
            this.ctx.fillStyle = this._toRgba(blb.color || 0x000000FF);
            const fontFamily = blb.fontFamily ? blb.fontFamily : 'sans-serif';
            this.ctx.font = `${blb.fontWeight || 400} ${blb.fontSize || 16}px ${fontFamily}`;
            
            // Text-Align
            let tx = comp.x;
            if (blb.textAlign === 1) { // Center
                this.ctx.textAlign = 'center';
                tx = comp.x + (comp.w / 2);
            } else if (blb.textAlign === 2) { // Right
                this.ctx.textAlign = 'right';
                tx = comp.x + comp.w;
            } else {
                this.ctx.textAlign = 'left';
            }

            this.ctx.textBaseline = 'top';

            const fullMetrics = this.ctx.measureText(node.bdt.text);
            if (fullMetrics.width <= comp.w + 20) {
                // Fast-Path: Text passt (unter Berücksichtigung von Font-Toleranzen) auf eine Zeile
                this.ctx.fillText(node.bdt.text, tx, comp.y);
            } else {
                // Custom Text-Wrapping für Canvas (Multi-Line Paragraphs)
                const fontSize = blb.fontSize || 16;
                const lineHeight = fontSize * 1.4;
                const words = node.bdt.text.split(' ');
                let line = '';
                let currentY = comp.y;

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = this.ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    
                    if (testWidth > comp.w + 4 && n > 0) {
                        this.ctx.fillText(line, tx, currentY);
                        line = words[n] + ' ';
                        currentY += lineHeight;
                    } else {
                        line = testLine;
                    }
                }
                this.ctx.fillText(line, tx, currentY);
            }
        }

        this.ctx.restore();
    }

    _toRgba(u32) {
        const r = (u32 >>> 24) & 0xFF;
        const g = (u32 >>> 16) & 0xFF;
        const b = (u32 >>> 8) & 0xFF;
        const a = (u32 & 0xFF) / 255.0;
        return `rgba(${r},${g},${b},${a})`;
    }

    _roundRect(x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
    }
}
