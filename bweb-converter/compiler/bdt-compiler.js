const { Buffer } = require('buffer');

class BdtCompiler {
    constructor(logger) {
        this.logger = logger;
        this.tagMap = {
            'div': 0x01, 'span': 0x02, 'p': 0x03, 'a': 0x04,
            'h1': 0x05, 'h2': 0x06, 'h3': 0x07, 'h4': 0x08,
            'h5': 0x09, 'h6': 0x0A, 'img': 0x0B, 'button': 0x0C,
            'input': 0x0D, 'form': 0x0E, 'ul': 0x0F, 'li': 0x10,
            'header': 0x11, 'footer': 0x12, 'nav': 0x13, 'section': 0x14,
            'article': 0x15, 'aside': 0x16, 'main': 0x17, '#text': 0xFF
        };
    }

    compile(astNodes) {
        const bufs = [];
        const events = [];

        // Build relationships for parent, siblings, children
        const nodeById = {};
        for (const n of astNodes) {
            nodeById[n.id] = { ...n, children: [], depth: 0, prevSibling: 0xFFFF };
        }

        // Pass 1: Tree building
        for (const n of Object.values(nodeById)) {
            if (n.parentId !== 0xFFFF && nodeById[n.parentId]) {
                const parent = nodeById[n.parentId];
                const siblings = parent.children;
                if (siblings.length > 0) {
                    const prevId = siblings[siblings.length - 1];
                    n.prevSibling = prevId;
                }
                parent.children.push(n.id);
                n.depth = parent.depth + 1;
            }
        }

        // Pass 2: BDT Byte generation
        for (const n of astNodes) {
            const enriched = nodeById[n.id];
            const parentId = enriched.parentId;
            const nextSibling = enriched.nextSibling;
            const lastChild = enriched.children.length ? enriched.children[enriched.children.length - 1] : 0xFFFF;
            const prevSibling = enriched.prevSibling;
            const nodeType = enriched.isText ? 3 : 1;
            const tagByte = this.tagMap[enriched.tag] || 0x01;
            const depth = Math.min(enriched.depth, 255);

            // 15 bytes structure as required by Engine
            const nodeBuf = Buffer.alloc(15);
            nodeBuf.writeUInt32BE(enriched.id, 0);
            nodeBuf.writeUInt16BE(parentId, 4);
            nodeBuf.writeUInt16BE(nextSibling, 6);
            nodeBuf.writeUInt16BE(lastChild, 8);
            nodeBuf.writeUInt16BE(prevSibling, 10);
            nodeBuf.writeUInt8(nodeType, 12);
            nodeBuf.writeUInt8(tagByte, 13);
            nodeBuf.writeUInt8(depth, 14);

            bufs.push(nodeBuf);

            // Static Event Extraction (Phase 1)
            if (enriched.attributes) {
                if (enriched.attributes['onclick'] || enriched.attributes['data-bind']) {
                    const eventBuf = Buffer.alloc(4);
                    eventBuf.writeUInt16BE(enriched.id, 0);
                    eventBuf.writeUInt8(0x01, 2); // 0x01 = ON_CLICK
                    eventBuf.writeUInt8(0x10, 3); // 0x10 = CALL_HANDLER_ID
                    events.push(eventBuf);
                }
            }
        }

        const bdtNodesBuffer = Buffer.concat(bufs);
        
        // Append events
        const eventCountBuf = Buffer.alloc(4);
        eventCountBuf.writeUInt32BE(events.length, 0);
        const eventBuffer = Buffer.concat([eventCountBuf, ...events]);

        const finalBuffer = Buffer.concat([bdtNodesBuffer, eventBuffer]);

        if (this.logger) this.logger.logEmitBlock('BDT', finalBuffer.length, astNodes.length);

        return finalBuffer;
    }
}

module.exports = { BdtCompiler };
